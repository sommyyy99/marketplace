// Vendor payout account setup. The payout columns on `vendors` are not
// readable or writable by the browser (column-level privileges are revoked),
// so this function is the only path a store owner has to them.
//
// Actions: list_banks | resolve_account | save_subaccount | get_status
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const paystack = async (secret: string, path: string, init?: RequestInit) => {
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.status) {
    console.error(`Paystack ${path} failed [${res.status}]:`, JSON.stringify(body));
    throw new Error(body?.message || 'Paystack request failed.');
  }
  return body.data;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secret) return json({ error: 'Payouts are not configured yet.' }, 500);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Please sign in again.' }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: 'Please sign in again.' }, 401);

    const payload = await req.json().catch(() => null);
    const action = payload?.action;

    if (action === 'list_banks') {
      const banks = await paystack(secret, '/bank?currency=NGN&perPage=100');
      return json({
        banks: (banks ?? []).map((b: any) => ({ name: b.name, code: b.code })),
      });
    }

    // Everything below needs the caller's own store.
    const { data: vendor, error: vendorErr } = await admin
      .from('vendors')
      .select('id, name, paystack_subaccount_code, paystack_bank_code, paystack_account_number, paystack_account_name')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (vendorErr) return json({ error: vendorErr.message }, 500);
    if (!vendor) return json({ error: 'No store is linked to your account.' }, 404);

    if (action === 'get_status') {
      return json({
        subaccountCode: vendor.paystack_subaccount_code ?? null,
        bankCode: vendor.paystack_bank_code ?? null,
        accountNumber: vendor.paystack_account_number ?? null,
        accountName: vendor.paystack_account_name ?? null,
      });
    }

    const bankCode = typeof payload?.bankCode === 'string' ? payload.bankCode.trim() : '';
    const accountNumber = typeof payload?.accountNumber === 'string' ? payload.accountNumber.trim() : '';

    if (action === 'resolve_account' || action === 'save_subaccount') {
      if (!/^\d{3,6}$/.test(bankCode)) return json({ error: 'Please choose a bank.' }, 400);
      if (!/^\d{10}$/.test(accountNumber)) return json({ error: 'Enter a valid 10-digit account number.' }, 400);
    }

    if (action === 'resolve_account') {
      const resolved = await paystack(
        secret,
        `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      );
      return json({ accountName: resolved?.account_name ?? '' });
    }

    if (action === 'save_subaccount') {
      // Always re-resolve server-side: never trust the name sent by the browser.
      const resolved = await paystack(
        secret,
        `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      );
      const accountName: string = resolved?.account_name ?? '';
      if (!accountName) return json({ error: 'Could not verify this account number.' }, 400);

      let subaccountCode = vendor.paystack_subaccount_code ?? null;
      if (subaccountCode) {
        await paystack(secret, `/subaccount/${subaccountCode}`, {
          method: 'PUT',
          body: JSON.stringify({
            business_name: vendor.name,
            settlement_bank: bankCode,
            account_number: accountNumber,
          }),
        });
      } else {
        const created = await paystack(secret, '/subaccount', {
          method: 'POST',
          body: JSON.stringify({
            business_name: vendor.name,
            settlement_bank: bankCode,
            account_number: accountNumber,
            percentage_charge: 10,
          }),
        });
        subaccountCode = created?.subaccount_code ?? null;
      }
      if (!subaccountCode) return json({ error: 'Could not create your payout account.' }, 502);

      const { error: updateErr } = await admin
        .from('vendors')
        .update({
          paystack_subaccount_code: subaccountCode,
          paystack_bank_code: bankCode,
          paystack_account_number: accountNumber,
          paystack_account_name: accountName,
        })
        .eq('id', vendor.id);
      if (updateErr) {
        console.error('Saving payout account failed:', updateErr);
        return json({ error: 'Could not save your payout account.' }, 500);
      }

      return json({ subaccountCode, accountName });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    console.error('vendor-payout-setup failed:', error);
    return json({ error: (error as Error).message || 'Payout setup failed.' }, 500);
  }
});
