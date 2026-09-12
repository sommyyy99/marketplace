// Confirms a Paystack transaction server-side with the secret key, then marks
// every order in the checkout group as paid. The client can never mark an
// order paid by itself.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecret) return json({ error: 'Payments are not configured yet.' }, 500);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Please sign in again.' }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: 'Please sign in again.' }, 401);

    const payload = await req.json().catch(() => null);
    const checkoutGroupId = payload?.checkoutGroupId;
    const reference = payload?.reference;
    if (typeof checkoutGroupId !== 'string' || !UUID_RE.test(checkoutGroupId)) {
      return json({ error: 'Invalid checkout reference.' }, 400);
    }
    if (typeof reference !== 'string' || reference.length < 4 || reference.length > 120) {
      return json({ error: 'Invalid payment reference.' }, 400);
    }

    // The checkout group must belong to this customer.
    const { data: orders, error: ordersErr } = await admin
      .from('orders')
      .select('id, total, payment_status')
      .eq('checkout_group_id', checkoutGroupId)
      .eq('customer_id', user.id);
    if (ordersErr) return json({ error: ordersErr.message }, 500);
    if (!orders || orders.length === 0) return json({ error: 'That order could not be found.' }, 404);

    const expectedKobo = Math.round(orders.reduce((sum, o) => sum + Number(o.total), 0) * 100);

    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.status) {
      console.error(`Paystack verify failed [${res.status}]:`, JSON.stringify(body));
      return json({ error: 'We could not confirm your payment with Paystack.', status: res.status }, 502);
    }

    const tx = body.data;
    if (tx?.status !== 'success') {
      return json({ error: 'Your payment was not successful.' }, 400);
    }
    if (Number(tx?.amount) < expectedKobo) {
      console.error(`Amount mismatch: paid ${tx?.amount}, expected ${expectedKobo}`);
      return json({ error: 'The amount paid does not match your order total.' }, 400);
    }

    const { error: updateErr } = await admin
      .from('orders')
      .update({ payment_status: 'paid', payment_reference: reference })
      .eq('checkout_group_id', checkoutGroupId)
      .eq('customer_id', user.id);
    if (updateErr) {
      console.error('Marking orders paid failed:', updateErr);
      return json({ error: 'Payment succeeded but your order could not be updated. Please contact support.' }, 500);
    }

    return json({ paid: true, orderIds: orders.map((o) => o.id), reference });
  } catch (error) {
    console.error('verify-payment failed:', error);
    return json({ error: (error as Error).message || 'Payment verification failed.' }, 500);
  }
});
