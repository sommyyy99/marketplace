import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { invokeEdgeFunction } from '../lib/invokeEdgeFunction';

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

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
}

interface OrderRow {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  placed_at: string | null;
  vendor_id: string | null;
  vendor: { name: string } | null;
  order_items: OrderItemRow[];
  reviews: ReviewRow[];
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

function StarRating({
  value,
  onChange,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={`text-lg leading-none ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'} ${
            n <= value ? 'text-amber-400' : 'text-[#e5e7eb]'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function CustomerOrders({ userId }: Props) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<{ orderId: string; text: string; kind: 'success' | 'error' } | null>(
    null,
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('orders')
      .select(
        'id, status, payment_status, total, subtotal, delivery_fee, placed_at, vendor_id, vendor:vendors!orders_vendor_id_fkey(name), order_items(id, name, quantity, price), reviews(id, rating, comment)'
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

  const cancelOrder = async (orderId: string) => {
    setCancellingId(orderId);
    setCancelMessage(null);
    try {
      const result = await invokeEdgeFunction<{ success: boolean; refundIssued?: boolean; refundError?: string | null }>(
        'cancel-order',
        { orderId },
      );
      if (result.refundError) {
        setCancelMessage({ orderId, kind: 'error', text: `Order cancelled, but: ${result.refundError}` });
      } else if (result.refundIssued) {
        setCancelMessage({ orderId, kind: 'success', text: 'Order cancelled and refunded.' });
      } else {
        setCancelMessage({ orderId, kind: 'success', text: 'Order cancelled.' });
      }
      await loadOrders();
    } catch (err: any) {
      setCancelMessage({ orderId, kind: 'error', text: err.message || 'Could not cancel this order.' });
    } finally {
      setCancellingId(null);
    }
  };

  const [reviewDraft, setReviewDraft] = useState<Record<string, { rating: number; comment: string }>>({});
  const [submittingReviewId, setSubmittingReviewId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<{ orderId: string; text: string; kind: 'success' | 'error' } | null>(
    null,
  );

  const submitReview = async (order: OrderRow) => {
    const draft = reviewDraft[order.id];
    if (!draft || draft.rating < 1) {
      setReviewMessage({ orderId: order.id, kind: 'error', text: 'Pick a star rating first.' });
      return;
    }
    if (!order.vendor_id) return;

    setSubmittingReviewId(order.id);
    setReviewMessage(null);
    try {
      const { error: err } = await supabase.from('reviews').insert({
        order_id: order.id,
        customer_id: userId,
        vendor_id: order.vendor_id,
        rating: draft.rating,
        comment: draft.comment.trim() || null,
      });
      if (err) throw err;
      setReviewMessage({ orderId: order.id, kind: 'success', text: 'Thanks for your review!' });
      await loadOrders();
    } catch (err: any) {
      setReviewMessage({ orderId: order.id, kind: 'error', text: err.message || 'Could not submit your review.' });
    } finally {
      setSubmittingReviewId(null);
    }
  };

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

            {order.status === 'placed' && (
              <div className="border-t border-[#f0f1f3] pt-3 mt-3">
                {cancelMessage?.orderId === order.id && (
                  <p
                    className={`text-sm mb-2 ${
                      cancelMessage.kind === 'success' ? 'text-[#1B5E3E]' : 'text-red-600'
                    }`}
                  >
                    {cancelMessage.text}
                  </p>
                )}
                <button
                  onClick={() => {
                    if (window.confirm('Cancel this order? This cannot be undone.')) {
                      cancelOrder(order.id);
                    }
                  }}
                  disabled={cancellingId === order.id}
                  className="text-sm font-bold text-red-600 hover:underline disabled:opacity-60"
                >
                  {cancellingId === order.id ? 'Cancelling…' : 'Cancel order'}
                </button>
              </div>
            )}

            {order.status === 'delivered' && (
              <div className="border-t border-[#f0f1f3] pt-3 mt-3">
                {order.reviews.length > 0 ? (
                  <div>
                    <p className="text-xs font-bold text-[#667085] mb-1">Your review</p>
                    <StarRating value={order.reviews[0].rating} readOnly />
                    {order.reviews[0].comment && (
                      <p className="text-sm text-[#667085] mt-1">{order.reviews[0].comment}</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-[#667085] mb-2">Rate this order</p>
                    <StarRating
                      value={reviewDraft[order.id]?.rating ?? 0}
                      onChange={(rating) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          [order.id]: { rating, comment: prev[order.id]?.comment ?? '' },
                        }))
                      }
                    />
                    <textarea
                      value={reviewDraft[order.id]?.comment ?? ''}
                      onChange={(e) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          [order.id]: { rating: prev[order.id]?.rating ?? 0, comment: e.target.value },
                        }))
                      }
                      placeholder="Optional: say a bit about your experience"
                      rows={2}
                      className="w-full mt-2 rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm outline-none focus:border-[#1B5E3E]"
                    />
                    {reviewMessage?.orderId === order.id && (
                      <p
                        className={`text-sm mt-1 ${
                          reviewMessage.kind === 'success' ? 'text-[#1B5E3E]' : 'text-red-600'
                        }`}
                      >
                        {reviewMessage.text}
                      </p>
                    )}
                    <button
                      onClick={() => submitReview(order)}
                      disabled={submittingReviewId === order.id}
                      className="mt-2 rounded-full bg-[#1B5E3E] text-white text-sm font-bold px-4 py-1.5 hover:bg-[#144d32] disabled:opacity-60"
                    >
                      {submittingReviewId === order.id ? 'Submitting…' : 'Submit review'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
