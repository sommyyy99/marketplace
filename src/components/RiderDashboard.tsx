import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';

interface DeliveryRow {
  id: string;
  total: number;
  placed_at: string | null;
  rider_id: string | null;
  vendor: { name: string; street_address: string | null } | null;
  address: { street_address: string; city: string; state: string } | null;
}

interface Props {
  userId: string;
}

export function RiderDashboard({ userId }: Props) {
  const [riderId, setRiderId] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [available, setAvailable] = useState<DeliveryRow[]>([]);
  const [mine, setMine] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadDeliveries = useCallback(async (rId: string) => {
    const { data, error: err } = await supabase
      .from('orders')
      .select(
        'id, total, placed_at, rider_id, vendor:vendors!orders_vendor_id_fkey(name, street_address), address:addresses!orders_delivery_address_id_fkey(street_address, city, state)'
      )
      .eq('status', 'out_for_delivery')
      .order('placed_at', { ascending: true });

    if (err) {
      setError(err.message);
      setAvailable([]);
      setMine([]);
      return;
    }

    const rows = (data as unknown as DeliveryRow[]) ?? [];
    setAvailable(rows.filter((r) => r.rider_id === null));
    setMine(rows.filter((r) => r.rider_id === rId));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: rider, error: rErr } = await supabase
        .from('riders')
        .select('id, is_available')
        .eq('profile_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (rErr || !rider) {
        setError(rErr?.message || 'No rider record linked to your account.');
        setLoading(false);
        return;
      }
      setRiderId(rider.id);
      setIsAvailable(rider.is_available ?? true);
      await loadDeliveries(rider.id);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadDeliveries]);

  const toggleAvailability = async () => {
    if (!riderId) return;
    const next = !isAvailable;
    setIsAvailable(next);
    const { error: err } = await supabase.from('riders').update({ is_available: next }).eq('id', riderId);
    if (err) setError(err.message);
  };

  const claimDelivery = async (orderId: string) => {
    if (!riderId) return;
    setBusyId(orderId);
    const { error: err } = await supabase
      .from('orders')
      .update({ rider_id: riderId })
      .eq('id', orderId)
      .is('rider_id', null);
    if (err) setError(err.message);
    else await loadDeliveries(riderId);
    setBusyId(null);
  };

  const markDelivered = async (orderId: string) => {
    if (!riderId) return;
    setBusyId(orderId);
    const { error: err } = await supabase
      .from('orders')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('rider_id', riderId);
    if (err) setError(err.message);
    else await loadDeliveries(riderId);
    setBusyId(null);
  };

  return (
    <main className="w-full max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-black text-[#111827]">Rider Dashboard</h1>
        {riderId && (
          <button
            onClick={toggleAvailability}
            className={`min-h-[40px] rounded-full px-4 text-sm font-bold ${
              isAvailable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {isAvailable ? 'Available for deliveries' : 'Not available'}
          </button>
        )}
      </div>

      {loading && <p className="text-[#667085]">Loading...</p>}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-bold text-[#111827] mb-3">My deliveries</h2>
            {mine.length === 0 ? (
              <p className="text-[#667085] text-sm">You haven't claimed any deliveries yet.</p>
            ) : (
              <div className="grid gap-3">
                {mine.map((order) => (
                  <div key={order.id} className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#111827]">{order.vendor?.name ?? 'Vendor'}</p>
                      <p className="text-xs text-[#667085]">
                        {order.address
                          ? `${order.address.street_address}, ${order.address.city}, ${order.address.state}`
                          : 'No delivery address on file'}
                      </p>
                      <p className="text-xs text-[#667085]">₦{Number(order.total).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => markDelivered(order.id)}
                      disabled={busyId === order.id}
                      className="rounded-full bg-[#1B5E3E] text-white text-sm font-bold px-4 py-1.5 hover:bg-[#144d32] disabled:opacity-60"
                    >
                      Mark delivered
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#111827] mb-3">Available deliveries</h2>
            {available.length === 0 ? (
              <p className="text-[#667085] text-sm">No deliveries waiting for a rider right now.</p>
            ) : (
              <div className="grid gap-3">
                {available.map((order) => (
                  <div key={order.id} className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#111827]">{order.vendor?.name ?? 'Vendor'}</p>
                      <p className="text-xs text-[#667085]">
                        Pickup: {order.vendor?.street_address ?? 'Vendor address on file'}
                      </p>
                      <p className="text-xs text-[#667085]">
                        Drop-off:{' '}
                        {order.address
                          ? `${order.address.street_address}, ${order.address.city}, ${order.address.state}`
                          : 'No delivery address on file'}
                      </p>
                      <p className="text-xs text-[#667085]">₦{Number(order.total).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => claimDelivery(order.id)}
                      disabled={busyId === order.id}
                      className="rounded-full bg-[#1B5E3E] text-white text-sm font-bold px-4 py-1.5 hover:bg-[#144d32] disabled:opacity-60"
                    >
                      Claim delivery
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
