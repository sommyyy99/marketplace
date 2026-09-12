// Creates one pending order per vendor for the signed-in customer.
//
// Prices are ALWAYS looked up server-side from menu_items - the client only
// sends menu item ids and quantities, so it can never set its own price.
// All orders from one checkout share a checkout_group_id so verify-payment can
// mark them paid together.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { DELIVERY_FEE_PER_VENDOR, SERVICE_FEE } from '../_shared/fees.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface RequestItem {
  menuItemId: string;
  quantity: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // --- Auth: identify the caller from their JWT -------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Please sign in to place an order.' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: 'Please sign in again to place your order.' }, 401);
    if (!user.email) return json({ error: 'Your account has no email for payment.' }, 400);

    // --- Validate input ---------------------------------------------------
    const payload = await req.json().catch(() => null);
    const addressId = payload?.addressId;
    const rawItems = payload?.items;

    if (typeof addressId !== 'string' || !UUID_RE.test(addressId)) {
      return json({ error: 'Please choose a delivery address.' }, 400);
    }
    if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
      return json({ error: 'Your basket is empty.' }, 400);
    }

    const items: RequestItem[] = [];
    for (const it of rawItems) {
      const menuItemId = it?.menuItemId;
      const quantity = Number(it?.quantity);
      if (typeof menuItemId !== 'string' || !UUID_RE.test(menuItemId)) {
        return json({ error: 'One of the basket items is invalid.' }, 400);
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return json({ error: 'Item quantities must be between 1 and 50.' }, 400);
      }
      items.push({ menuItemId, quantity });
    }

    // The address must belong to this customer.
    const { data: address } = await admin
      .from('addresses')
      .select('id')
      .eq('id', addressId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!address) return json({ error: 'That delivery address could not be found.' }, 400);

    // --- Look up real prices ---------------------------------------------
    const ids = [...new Set(items.map((i) => i.menuItemId))];
    const { data: menuItems, error: menuErr } = await admin
      .from('menu_items')
      .select('id, name, price, vendor_id, is_available, vendors!menu_items_vendor_id_fkey(id, name, is_active, is_open, paystack_subaccount_code)')
      .in('id', ids);
    if (menuErr) return json({ error: menuErr.message }, 500);

    const byId = new Map((menuItems ?? []).map((m: any) => [m.id, m]));
    for (const id of ids) {
      const m = byId.get(id);
      if (!m) return json({ error: 'One of your items is no longer on the menu.' }, 400);
      if (m.is_available === false) return json({ error: `${m.name} is not available right now.` }, 400);
      if (!m.vendor_id || !m.vendors) return json({ error: `${m.name} isn't linked to a vendor yet.` }, 400);
      if (m.vendors.is_active === false || m.vendors.is_open === false) {
        return json({ error: `${m.vendors.name} is closed right now.` }, 400);
      }
    }

    // --- Group by vendor (a rider collects from one place per trip) -------
    interface Group {
      vendorId: string;
      vendorName: string;
      subaccount: string | null;
      lines: { menu_item_id: string; name: string; price: number; quantity: number; subtotal: number }[];
      subtotal: number;
    }
    const groups = new Map<string, Group>();
    for (const it of items) {
      const m: any = byId.get(it.menuItemId);
      const price = Number(m.price);
      const lineTotal = price * it.quantity;
      const group = groups.get(m.vendor_id) ?? {
        vendorId: m.vendor_id,
        vendorName: m.vendors.name,
        subaccount: m.vendors.paystack_subaccount_code ?? null,
        lines: [],
        subtotal: 0,
      };
      group.lines.push({
        menu_item_id: m.id,
        name: m.name,
        price,
        quantity: it.quantity,
        subtotal: lineTotal,
      });
      group.subtotal += lineTotal;
      groups.set(m.vendor_id, group);
    }

    const checkoutGroupId = crypto.randomUUID();
    const groupList = [...groups.values()];
    const created: { orderId: string; vendorName: string; total: number }[] = [];

    for (const [index, group] of groupList.entries()) {
      // The one-off service fee rides on the first order's delivery fee so the
      // sum of the order totals always equals the amount charged.
      const fee = DELIVERY_FEE_PER_VENDOR + (index === 0 ? SERVICE_FEE : 0);
      const total = group.subtotal + fee;

      const { data: order, error: orderErr } = await admin
        .from('orders')
        .insert({
          customer_id: user.id,
          vendor_id: group.vendorId,
          delivery_address_id: addressId,
          checkout_group_id: checkoutGroupId,
          status: 'placed',
          payment_status: 'pending',
          subtotal: group.subtotal,
          delivery_fee: fee,
          total,
        })
        .select('id')
        .single();
      if (orderErr || !order) {
        console.error('Order insert failed:', orderErr);
        return json({ error: 'Your order could not be created. Please try again.' }, 500);
      }

      const { error: itemsErr } = await admin
        .from('order_items')
        .insert(group.lines.map((l) => ({ ...l, order_id: order.id })));
      if (itemsErr) {
        console.error('Order items insert failed:', itemsErr);
        return json({ error: 'Your order could not be created. Please try again.' }, 500);
      }

      created.push({ orderId: order.id, vendorName: group.vendorName, total });
    }

    const total = created.reduce((sum, o) => sum + o.total, 0);

    // --- Optional Paystack split so vendors are paid directly -------------
    let splitCode = '';
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    const payable = groupList.filter((g) => g.subaccount);
    if (paystackSecret && payable.length > 0) {
      try {
        const shares = payable.map((g) => ({
          subaccount: g.subaccount as string,
          share: Math.max(1, Math.round((g.subtotal / total) * 100)),
        }));
        const res = await fetch('https://api.paystack.co/split', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `sommygo-${checkoutGroupId.slice(0, 8)}`,
            type: 'percentage',
            currency: 'NGN',
            subaccounts: shares,
            bearer_type: 'account',
          }),
        });
        const body = await res.json().catch(() => null);
        if (res.ok && body?.status && body?.data?.split_code) {
          splitCode = body.data.split_code;
        } else {
          console.error(`Paystack split failed [${res.status}]:`, JSON.stringify(body));
        }
      } catch (splitError) {
        // Payment still works without a split - the platform settles manually.
        console.error('Paystack split request failed:', splitError);
      }
    }

    return json({
      checkoutGroupId,
      orders: created,
      total,
      amountKobo: Math.round(total * 100),
      email: user.email,
      splitCode,
    });
  } catch (error) {
    console.error('create-order failed:', error);
    return json({ error: (error as Error).message || 'Checkout failed.' }, 500);
  }
});
