import { supabase } from '../integrations/supabase/client';

/**
 * Wrapper around supabase.functions.invoke() that surfaces the REAL error
 * message our edge functions return.
 *
 * supabase-js does not automatically read the JSON body when an edge
 * function responds with a non-2xx status - it just gives you a generic
 * "Edge Function returned a non-2xx status code" message and leaves `data`
 * null, discarding whatever { error: "..." } we actually returned. The real
 * body is available on `error.context` (the raw Response object), so we
 * read it ourselves here instead of letting that message get lost.
 */
export async function invokeEdgeFunction<T = any>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let message = error.message || 'Something went wrong. Please try again.';
    const context = (error as any)?.context;
    if (context && typeof context.json === 'function') {
      try {
        const parsed = await context.json();
        if (parsed?.error) message = parsed.error;
      } catch {
        // Response body wasn't JSON (or already consumed) - fall back to the
        // generic message rather than throwing here.
      }
    }
    throw new Error(message);
  }

  return data as T;
}
