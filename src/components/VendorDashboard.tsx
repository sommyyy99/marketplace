import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';

const STATUS_FLOW = ['placed', 'accepted', 'preparing', 'out_for_delivery', 'delivered'] as const;
type Status = typeof STATUS_FLOW[number];

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface OrderRow {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  placed_at: string | null;
  customer_id: string | null;
  customer: { full_name: string | null } | null;
  order_items: OrderItem[];
}

interface Props {
  userId: string;
}

export function VendorDashboard({ userId }: Props) {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = useCallback(async (vId: string) => {
    const { data, error: err } = await supabase
      .from('orders')
      .select(
        'id, status, payment_status, total, subtotal, delivery_fee, placed_at, customer_id, customer:profiles!orders_customer_id_fkey(full_name), order_items(id, name, quantity, price)'
      )
      .eq('vendor_id', vId)
      .order('placed_at', { ascending: false });
    if (err) {
      setError(err.message);
      setOrders([]);
    } else {
      setOrders((data as unknown as OrderRow[]) ?? []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: vendor, error: vErr } = await supabase
        .from('vendors')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (vErr || !vendor) {
        setError(vErr?.message || 'No vendor record linked to your account.');
        setLoading(false);
        return;
      }
      setVendorId(vendor.id);
      await loadOrders(vendor.id);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadOrders]);

  const updateStatus = async (orderId: string, newStatus: Status) => {
    setUpdatingId(orderId);
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'accepted') patch.accepted_at = new Date().toISOString();
    if (newStatus === 'out_for_delivery') patch.out_for_delivery_at = new Date().toISOString();
    if (newStatus === 'delivered') patch.delivered_at = new Date().toISOString();
    const { error: uErr } = await supabase.from('orders').update(patch).eq('id', orderId);
    if (uErr) {
      setError(uErr.message);
    } else if (vendorId) {
      await loadOrders(vendorId);
    }
    setUpdatingId(null);
  };

  const nextStatus = (current: string): Status | null => {
    const idx = STATUS_FLOW.indexOf(current as Status);
    if (idx === -1 || idx === STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[idx + 1];
  };

  return (
    <main className="w-full max-w-[1200px] mx-auto px-6 py-8">
      <h1 className="text-3xl font-black text-[#111827] mb-6">Vendor Dashboard</h1>

      {loading && <p className="text-[#667085]">Loading orders...</p>}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <p className="text-[#667085]">No orders yet.</p>
      )}

      <div className="grid gap-4">
        {orders.map((order) => {
          const next = nextStatus(order.status);
          return (
            <div
              key={order.id}
              className="bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-bold text-[#111827]">
                    {order.customer?.full_name || 'Customer'}
                  </p>
                  <p className="text-xs text-[#667085] mt-0.5">
                    Order #{order.id.slice(0, 8)} ·{' '}
                    {order.placed_at
                      ? new Date(order.placed_at).toLocaleString()
                      : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`px-3 py-1 rounded-full font-bold capitalize ${
                      order.status === 'delivered'
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'placed'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {order.status.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full font-bold capitalize ${
                      order.payment_status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {order.payment_status}
                  </span>
                </div>
              </div>

              <ul className="text-sm text-[#111827] mb-3 divide-y divide-[#f0f1f3]">
                {order.order_items?.map((it) => (
                  <li key={it.id} className="py-1.5 flex justify-between">
                    <span>
                      {it.quantity} × {it.name}
                    </span>
                    <span className="text-[#667085]">
                      ₦{(it.price * it.quantity).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#f0f1f3]">
                <p className="font-black text-[#111827]">
                  Total: ₦{Number(order.total).toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={order.status}
                    disabled={updatingId === order.id}
                    onChange={(e) => updateStatus(order.id, e.target.value as Status)}
                    className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm bg-white"
                  >
                    {STATUS_FLOW.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                  {next && (
                    <button
                      onClick={() => updateStatus(order.id, next)}
                      disabled={updatingId === order.id}
                      className="rounded-full bg-[#1B5E3E] text-white text-sm font-bold px-4 py-1.5 hover:bg-[#144d32] disabled:opacity-60"
                    >
                      Mark {next.replace(/_/g, ' ')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
