import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';

interface VendorRow {
  id: string;
  name: string;
  service_category: string | null;
  street_address: string | null;
  is_active: boolean;
  is_open: boolean;
  created_at: string | null;
  owner_id: string | null;
}

interface RiderRow {
  id: string;
  vehicle_type: string | null;
  is_available: boolean | null;
  profile_id: string;
}

interface OrderRow {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  placed_at: string | null;
  vendor: { name: string } | null;
}

interface FeedbackRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer: { full_name: string | null } | null;
}

type Tab = 'vendors' | 'riders' | 'orders' | 'feedback';

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('vendors');
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [vendorsRes, ridersRes, ordersRes, feedbackRes] = await Promise.all([
      supabase
        .from('vendors')
        .select('id, name, service_category, street_address, is_active, is_open, created_at, owner_id')
        .order('created_at', { ascending: false }),
      supabase.from('riders').select('id, vehicle_type, is_available, profile_id'),
      supabase
        .from('orders')
        .select('id, status, payment_status, total, placed_at, vendor:vendors!orders_vendor_id_fkey(name)')
        .order('placed_at', { ascending: false })
        .limit(50),
      supabase
        .from('app_feedback')
        .select('id, rating, comment, created_at, customer:profiles!app_feedback_customer_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (vendorsRes.error || ridersRes.error || ordersRes.error || feedbackRes.error) {
      setError(
        vendorsRes.error?.message ||
          ridersRes.error?.message ||
          ordersRes.error?.message ||
          feedbackRes.error?.message ||
          'Failed to load admin data.'
      );
    } else {
      setVendors((vendorsRes.data as VendorRow[]) ?? []);
      setRiders((ridersRes.data as RiderRow[]) ?? []);
      setOrders((ordersRes.data as unknown as OrderRow[]) ?? []);
      setFeedback((feedbackRes.data as unknown as FeedbackRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const setVendorActive = async (vendorId: string, isActive: boolean) => {
    setBusyId(vendorId);
    const { error: err } = await supabase.from('vendors').update({ is_active: isActive }).eq('id', vendorId);
    if (err) setError(err.message);
    else await loadAll();
    setBusyId(null);
  };

  const pendingVendors = vendors.filter((v) => !v.is_active);
  const activeVendors = vendors.filter((v) => v.is_active);

  return (
    <main className="w-full max-w-[1200px] mx-auto px-6 py-8">
      <h1 className="text-3xl font-black text-[#111827] mb-6">Admin Dashboard</h1>

      <div className="flex gap-2 mb-6">
        {(['vendors', 'riders', 'orders', 'feedback'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`min-h-[40px] rounded-full px-4 text-sm font-bold capitalize transition-colors ${
              tab === t ? 'bg-[#1B5E3E] text-white' : 'bg-[#f7f8fa] text-[#667085] hover:text-[#111827]'
            }`}
          >
            {t}
            {t === 'vendors' && pendingVendors.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-amber-400 text-[10px] text-white px-1">
                {pendingVendors.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <p className="text-[#667085]">Loading...</p>}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 mb-4 text-sm">{error}</div>
      )}

      {!loading && !error && tab === 'vendors' && (
        <div className="grid gap-6">
          <section>
            <h2 className="text-lg font-bold text-[#111827] mb-3">
              Pending approval {pendingVendors.length > 0 && `(${pendingVendors.length})`}
            </h2>
            {pendingVendors.length === 0 ? (
              <p className="text-sm text-[#667085]">No vendors waiting for review.</p>
            ) : (
              <div className="grid gap-3">
                {pendingVendors.map((v) => (
                  <div
                    key={v.id}
                    className="bg-white border border-amber-200 bg-amber-50/40 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-[#111827]">{v.name}</p>
                      <p className="text-xs text-[#667085]">
                        {v.service_category ?? 'No category'} · {v.street_address ?? 'No address on file'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setVendorActive(v.id, true)}
                        disabled={busyId === v.id}
                        className="rounded-full bg-[#1B5E3E] text-white text-sm font-bold px-4 py-1.5 hover:bg-[#144d32] disabled:opacity-60"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#111827] mb-3">Active vendors ({activeVendors.length})</h2>
            {activeVendors.length === 0 ? (
              <p className="text-sm text-[#667085]">No active vendors yet.</p>
            ) : (
              <div className="grid gap-3">
                {activeVendors.map((v) => (
                  <div
                    key={v.id}
                    className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-[#111827]">{v.name}</p>
                      <p className="text-xs text-[#667085]">
                        {v.service_category ?? 'No category'} · {v.is_open ? 'Open' : 'Closed'}
                      </p>
                    </div>
                    <button
                      onClick={() => setVendorActive(v.id, false)}
                      disabled={busyId === v.id}
                      className="rounded-full bg-red-50 text-red-700 text-sm font-bold px-4 py-1.5 hover:bg-red-100 disabled:opacity-60"
                    >
                      Suspend
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && !error && tab === 'riders' && (
        <div className="grid gap-3">
          {riders.length === 0 ? (
            <p className="text-sm text-[#667085]">No riders yet.</p>
          ) : (
            riders.map((r) => (
              <div key={r.id} className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <p className="font-bold text-[#111827]">{r.vehicle_type ?? 'Unknown vehicle'}</p>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    r.is_available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {r.is_available ? 'Available' : 'Unavailable'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {!loading && !error && tab === 'orders' && (
        <div className="grid gap-3">
          {orders.length === 0 ? (
            <p className="text-sm text-[#667085]">No orders yet.</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-[#111827]">{o.vendor?.name ?? 'Vendor'}</p>
                  <p className="text-xs text-[#667085]">
                    {o.placed_at ? new Date(o.placed_at).toLocaleString() : '—'} · {o.status.replace(/_/g, ' ')} ·{' '}
                    {o.payment_status}
                  </p>
                </div>
                <p className="font-black text-[#111827]">₦{Number(o.total).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      )}

      {!loading && !error && tab === 'feedback' && (
        <div>
          {feedback.length === 0 ? (
            <p className="text-sm text-[#667085]">No app feedback submitted yet.</p>
          ) : (
            <>
              <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm mb-4 flex items-center gap-3">
                <span className="text-3xl font-black text-[#111827]">
                  {(feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1)}
                </span>
                <div>
                  <p className="text-amber-400 leading-none">
                    {'★'.repeat(Math.round(feedback.reduce((s, f) => s + f.rating, 0) / feedback.length))}
                    <span className="text-[#e5e7eb]">
                      {'★'.repeat(5 - Math.round(feedback.reduce((s, f) => s + f.rating, 0) / feedback.length))}
                    </span>
                  </p>
                  <p className="text-xs text-[#667085] mt-1">
                    Average from {feedback.length} response{feedback.length === 1 ? '' : 's'} · visible to admins only
                  </p>
                </div>
              </div>
              <div className="grid gap-3">
                {feedback.map((f) => (
                  <div key={f.id} className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="font-bold text-[#111827]">{f.customer?.full_name ?? 'A customer'}</p>
                      <p className="text-xs text-[#667085]">{new Date(f.created_at).toLocaleString()}</p>
                    </div>
                    <p className="text-amber-400 leading-none">
                      {'★'.repeat(f.rating)}
                      <span className="text-[#e5e7eb]">{'★'.repeat(5 - f.rating)}</span>
                    </p>
                    {f.comment && <p className="text-sm text-[#667085] mt-2">{f.comment}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
