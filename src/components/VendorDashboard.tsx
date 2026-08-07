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

interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean | null;
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
  const [tab, setTab] = useState<'orders' | 'menu'>('orders');

  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuBusyId, setMenuBusyId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [addingItem, setAddingItem] = useState(false);

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

  const loadMenuItems = useCallback(async (vId: string) => {
    const { data, error: err } = await supabase
      .from('menu_items')
      .select('id, name, description, price, is_available')
      .eq('vendor_id', vId)
      .order('name', { ascending: true });
    if (err) {
      setMenuError(err.message);
      setMenuItems([]);
    } else {
      setMenuItems((data as MenuItemRow[]) ?? []);
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
      await Promise.all([loadOrders(vendor.id), loadMenuItems(vendor.id)]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadOrders, loadMenuItems]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return;
    setMenuError(null);

    const trimmedName = newItemName.trim();
    const priceValue = Number(newItemPrice);
    if (!trimmedName || !newItemPrice || Number.isNaN(priceValue) || priceValue <= 0) {
      setMenuError('Enter a valid item name and price.');
      return;
    }

    setAddingItem(true);
    try {
      const { error: insertErr } = await supabase.from('menu_items').insert({
        vendor_id: vendorId,
        name: trimmedName,
        price: priceValue,
        description: newItemDescription.trim() || null,
        is_available: true,
      });
      if (insertErr) throw insertErr;

      setNewItemName('');
      setNewItemPrice('');
      setNewItemDescription('');
      await loadMenuItems(vendorId);
    } catch (err: any) {
      setMenuError(err.message || 'Could not add this item. Please try again.');
    } finally {
      setAddingItem(false);
    }
  };

  const toggleAvailability = async (item: MenuItemRow) => {
    if (!vendorId) return;
    setMenuBusyId(item.id);
    const { error: err } = await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id);
    if (err) setMenuError(err.message);
    else await loadMenuItems(vendorId);
    setMenuBusyId(null);
  };

  const updateItemPrice = async (item: MenuItemRow, newPrice: number) => {
    if (!vendorId || Number.isNaN(newPrice) || newPrice <= 0) return;
    setMenuBusyId(item.id);
    const { error: err } = await supabase
      .from('menu_items')
      .update({ price: newPrice })
      .eq('id', item.id);
    if (err) setMenuError(err.message);
    else await loadMenuItems(vendorId);
    setMenuBusyId(null);
  };

  const deleteItem = async (item: MenuItemRow) => {
    if (!vendorId) return;
    if (!window.confirm(`Remove "${item.name}" from your menu?`)) return;
    setMenuBusyId(item.id);
    const { error: err } = await supabase.from('menu_items').delete().eq('id', item.id);
    if (err) setMenuError(err.message);
    else await loadMenuItems(vendorId);
    setMenuBusyId(null);
  };

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

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('orders')}
          className={`min-h-[40px] rounded-full px-4 text-sm font-bold transition-colors ${
            tab === 'orders' ? 'bg-[#1B5E3E] text-white' : 'bg-[#f7f8fa] text-[#667085] hover:text-[#111827]'
          }`}
        >
          Orders
        </button>
        <button
          onClick={() => setTab('menu')}
          className={`min-h-[40px] rounded-full px-4 text-sm font-bold transition-colors ${
            tab === 'menu' ? 'bg-[#1B5E3E] text-white' : 'bg-[#f7f8fa] text-[#667085] hover:text-[#111827]'
          }`}
        >
          Your Menu
        </button>
      </div>

      {loading && <p className="text-[#667085]">Loading...</p>}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && tab === 'menu' && (
        <div>
          <form
            onSubmit={handleAddItem}
            className="bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-sm mb-6 grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-start"
          >
            <div className="grid gap-3 sm:col-span-3 sm:grid-cols-[2fr_1fr]">
              <input
                type="text"
                required
                placeholder="Item name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E]"
              />
              <input
                type="number"
                min="1"
                step="1"
                required
                placeholder="Price (₦)"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E]"
              />
            </div>
            <input
              type="text"
              placeholder="Description (optional)"
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
              className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E] sm:col-span-2"
            />
            <button
              type="submit"
              disabled={addingItem}
              className="min-h-[44px] rounded-full bg-[#1B5E3E] text-white font-bold px-5 text-sm hover:bg-[#144d32] disabled:opacity-60 sm:col-span-1"
            >
              {addingItem ? 'Adding…' : 'Add item'}
            </button>
            {menuError && <p className="text-sm text-red-600 sm:col-span-3">{menuError}</p>}
          </form>

          {menuItems.length === 0 ? (
            <p className="text-[#667085]">You haven't added any menu items yet.</p>
          ) : (
            <div className="grid gap-3">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[#111827]">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-[#667085] truncate max-w-[320px]">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={item.price}
                      disabled={menuBusyId === item.id}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val !== item.price) updateItemPrice(item, val);
                      }}
                      className="w-24 rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => toggleAvailability(item)}
                      disabled={menuBusyId === item.id}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        item.is_available
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {item.is_available ? 'Available' : 'Unavailable'}
                    </button>
                    <button
                      onClick={() => deleteItem(item)}
                      disabled={menuBusyId === item.id}
                      className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !error && tab === 'orders' && orders.length === 0 && (
        <p className="text-[#667085]">No orders yet.</p>
      )}

      {!loading && !error && tab === 'orders' && (
      <div className="grid gap-4">
        {orders.map((order) => {
          const next = nextStatus(order.status);
          const items = Array.isArray(order.order_items) ? order.order_items : [];
          const statusLabel = (order.status ?? 'placed').replace(/_/g, ' ');
          const paymentLabel = order.payment_status ?? 'pending';
          const orderTotal = Number(order.total) || 0;
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
                    Order #{(order.id ?? '').slice(0, 8)} ·{' '}
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
                    {statusLabel}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full font-bold capitalize ${
                      order.payment_status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {paymentLabel}
                  </span>
                </div>
              </div>

              <ul className="text-sm text-[#111827] mb-3 divide-y divide-[#f0f1f3]">
                {items.length === 0 ? (
                  <li className="py-1.5 text-[#667085]">No items recorded.</li>
                ) : (
                  items.map((it) => (
                    <li key={it.id} className="py-1.5 flex justify-between">
                      <span>
                        {Number(it.quantity) || 0} × {it.name || 'Item'}
                      </span>
                      <span className="text-[#667085]">
                        ₦{((Number(it.price) || 0) * (Number(it.quantity) || 0)).toLocaleString()}
                      </span>
                    </li>
                  ))
                )}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#f0f1f3]">
                <p className="font-black text-[#111827]">
                  Total: ₦{orderTotal.toLocaleString()}
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
      )}
    </main>
  );
}
