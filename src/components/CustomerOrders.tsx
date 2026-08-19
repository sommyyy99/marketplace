import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';

const STATUS_FLOW = ['placed', 'accepted', 'preparing', 'out_for_delivery', 'delivered'] as const;

const STATUS_LABELS: Record<string, string> = {
  placed: 'Order placed',
  accepted: 'Accepted by vendor',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

interface OrderItemRow {
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
  vendor: { name: string } | null;
  order_items: OrderItemRow[];
}

interface Props {
  userId: string;
}

function StatusTracker({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <span className="inline-block px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold">
        Cancelled
      </span>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STATUS_FLOW.map((step, i) => {
        const done = currentIndex >= i;
        return (
          <div key={step} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${done ? 'bg-[#1B5E3E]' : 'bg-[#e5e7eb]'}`}
              />
              <span className={`text-xs font-bold ${done ? 'text-[#1B5E3E]' : 'text-[#9ca3af]'}`}>
                {STATUS_LABELS[step]}
              </span>
            </div>
            {i < STATUS_FLOW.length - 1 && (
              <span className={`w-4 h-0.5 ${currentIndex > i ? 'bg-[#1B5E3E]' : 'bg-[#e5e7eb]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CustomerOrders({ userId }: Props) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('orders')
      .select(
        'id, status, payment_status, total, subtotal, delivery_fee, placed_at, vendor:vendors!orders_vendor_id_fkey(name), order_items(id, name, quantity, price)'
      )
      .eq('customer_id', userId)
      .order('placed_at', { ascending: false });

    if (err) {
      setError(err.message);
      setOrders([]);
    } else {
      setOrders((data as unknown as OrderRow[]) ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return (
    <main className="w-full max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-black text-[#111827]">Your Orders</h1>
        <button
          onClick={loadOrders}
          className="text-sm font-bold text-[#1B5E3E] hover:underline"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-[#667085]">Loading your orders...</p>}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}
      {!loading && !error && orders.length === 0 && (
        <p className="text-[#667085]">
          You haven't placed any orders yet — once you check out, they'll show up here with live status updates.
        </p>
      )}

      <div className="grid gap-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-bold text-[#111827]">{order.vendor?.name ?? 'Vendor'}</p>
                <p className="text-xs text-[#667085]">
                  {order.placed_at ? new Date(order.placed_at).toLocaleString() : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-black text-[#111827]">₦{Number(order.total).toLocaleString()}</p>
                <p
                  className={`text-xs font-bold ${
                    order.payment_status === 'paid' ? 'text-[#1B5E3E]' : 'text-amber-600'
                  }`}
                >
                  {order.payment_status === 'paid' ? 'Paid' : 'Payment pending'}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <StatusTracker status={order.status} />
            </div>

            <div className="border-t border-[#f0f1f3] pt-3 grid gap-1">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm text-[#667085]">
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span>₦{Number(item.price).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
