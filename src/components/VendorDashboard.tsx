import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { invokeEdgeFunction } from '../lib/invokeEdgeFunction';

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
  category_id: string | null;
  image_url: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
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
  const [tab, setTab] = useState<'orders' | 'menu' | 'payouts'>('orders');

  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [payoutInfo, setPayoutInfo] = useState<{
    paystack_subaccount_code: string | null;
    paystack_bank_code: string | null;
    paystack_account_number: string | null;
    paystack_account_name: string | null;
  } | null>(null);
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuBusyId, setMenuBusyId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemCategoryId, setNewItemCategoryId] = useState('');
  const [newItemImageFile, setNewItemImageFile] = useState<File | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  const [vendorLogoUrl, setVendorLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [uploadingItemImageId, setUploadingItemImageId] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  const loadCategories = useCallback(async (vId: string) => {
    const { data, error: err } = await supabase
      .from('menu_categories')
      .select('id, name')
      .eq('vendor_id', vId)
      .order('sort_order', { ascending: true });
    if (!err) setCategories((data as CategoryRow[]) ?? []);
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return;
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setAddingCategory(true);
    setMenuError(null);
    try {
      const { error: insertErr } = await supabase
        .from('menu_categories')
        .insert({ vendor_id: vendorId, name: trimmed, sort_order: categories.length });
      if (insertErr) throw insertErr;
      setNewCategoryName('');
      await loadCategories(vendorId);
    } catch (err: any) {
      setMenuError(err.message || 'Could not add this category. Please try again.');
    } finally {
      setAddingCategory(false);
    }
  };

  const assignCategory = async (item: MenuItemRow, categoryId: string) => {
    if (!vendorId) return;
    setMenuBusyId(item.id);
    const { error: err } = await supabase
      .from('menu_items')
      .update({ category_id: categoryId || null })
      .eq('id', item.id);
    if (err) setMenuError(err.message);
    else await loadMenuItems(vendorId);
    setMenuBusyId(null);
  };

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
      .select('id, name, description, price, is_available, category_id, image_url')
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
        .select('id, logo_url, paystack_subaccount_code, paystack_bank_code, paystack_account_number, paystack_account_name')
        .eq('owner_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (vErr || !vendor) {
        setError(vErr?.message || 'No vendor record linked to your account.');
        setLoading(false);
        return;
      }
      setVendorId(vendor.id);
      setVendorLogoUrl(vendor.logo_url);
      setPayoutInfo({
        paystack_subaccount_code: vendor.paystack_subaccount_code,
        paystack_bank_code: vendor.paystack_bank_code,
        paystack_account_number: vendor.paystack_account_number,
        paystack_account_name: vendor.paystack_account_name,
      });
      await Promise.all([loadOrders(vendor.id), loadMenuItems(vendor.id), loadCategories(vendor.id)]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadOrders, loadMenuItems, loadCategories]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBanksLoading(true);
      try {
        const result = await invokeEdgeFunction<{ banks: { name: string; code: string }[] }>('vendor-payout-setup', {
          action: 'list_banks',
        });
        if (!cancelled) setBanks(result.banks ?? []);
      } catch {
        // Bank list failing to load isn't fatal - the dropdown just stays empty.
      }
      if (!cancelled) setBanksLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveAccount = async () => {
    setPayoutError(null);
    setResolvedAccountName(null);
    if (!selectedBankCode || accountNumber.trim().length < 10) {
      setPayoutError('Select a bank and enter a valid 10-digit account number.');
      return;
    }
    setResolving(true);
    try {
      const result = await invokeEdgeFunction<{ accountName: string }>('vendor-payout-setup', {
        action: 'resolve_account',
        bankCode: selectedBankCode,
        accountNumber: accountNumber.trim(),
      });
      setResolvedAccountName(result.accountName);
    } catch (e: any) {
      setPayoutError(e.message || 'Could not verify this account number.');
    } finally {
      setResolving(false);
    }
  };

  const savePayoutAccount = async () => {
    if (!resolvedAccountName) return;
    setPayoutError(null);
    setSavingPayout(true);
    try {
      const result = await invokeEdgeFunction<{ subaccountCode: string }>('vendor-payout-setup', {
        action: 'save_subaccount',
        bankCode: selectedBankCode,
        accountNumber: accountNumber.trim(),
        accountName: resolvedAccountName,
      });
      setPayoutInfo({
        paystack_subaccount_code: result.subaccountCode,
        paystack_bank_code: selectedBankCode,
        paystack_account_number: accountNumber.trim(),
        paystack_account_name: resolvedAccountName,
      });
      setResolvedAccountName(null);
      setAccountNumber('');
      setSelectedBankCode('');
    } catch (e: any) {
      setPayoutError(e.message || 'Could not save payout account.');
    } finally {
      setSavingPayout(false);
    }
  };

  const uploadVendorMedia = async (file: File, path: string): Promise<string> => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose an image file.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image must be smaller than 5MB.');
    }
    const { error: uploadErr } = await supabase.storage.from('vendor-media').upload(path, file, {
      upsert: true,
      cacheControl: '3600',
    });
    if (uploadErr) throw uploadErr;
    const { data } = supabase.storage.from('vendor-media').getPublicUrl(path);
    return data.publicUrl;
  };

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
      let imageUrl: string | null = null;
      if (newItemImageFile) {
        const ext = newItemImageFile.name.split('.').pop() || 'jpg';
        imageUrl = await uploadVendorMedia(newItemImageFile, `${vendorId}/items/${crypto.randomUUID()}.${ext}`);
      }

      const { error: insertErr } = await supabase.from('menu_items').insert({
        vendor_id: vendorId,
        name: trimmedName,
        price: priceValue,
        description: newItemDescription.trim() || null,
        category_id: newItemCategoryId || null,
        image_url: imageUrl,
        is_available: true,
      });
      if (insertErr) throw insertErr;

      setNewItemName('');
      setNewItemPrice('');
      setNewItemDescription('');
      setNewItemImageFile(null);
      await loadMenuItems(vendorId);
    } catch (err: any) {
      setMenuError(err.message || 'Could not add this item. Please try again.');
    } finally {
      setAddingItem(false);
    }
  };

  const changeItemImage = async (item: MenuItemRow, file: File) => {
    if (!vendorId) return;
    setUploadingItemImageId(item.id);
    setMenuError(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const imageUrl = await uploadVendorMedia(file, `${vendorId}/items/${item.id}-${Date.now()}.${ext}`);
      const { error: updateErr } = await supabase.from('menu_items').update({ image_url: imageUrl }).eq('id', item.id);
      if (updateErr) throw updateErr;
      await loadMenuItems(vendorId);
    } catch (err: any) {
      setMenuError(err.message || 'Could not upload this image.');
    } finally {
      setUploadingItemImageId(null);
    }
  };

  const changeVendorLogo = async (file: File) => {
    if (!vendorId) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const logoUrl = await uploadVendorMedia(file, `${vendorId}/logo-${Date.now()}.${ext}`);
      const { error: updateErr } = await supabase.from('vendors').update({ logo_url: logoUrl }).eq('id', vendorId);
      if (updateErr) throw updateErr;
      setVendorLogoUrl(logoUrl);
    } catch (err: any) {
      setLogoError(err.message || 'Could not upload your logo.');
    } finally {
      setUploadingLogo(false);
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
        <button
          onClick={() => setTab('payouts')}
          className={`min-h-[40px] rounded-full px-4 text-sm font-bold transition-colors ${
            tab === 'payouts' ? 'bg-[#1B5E3E] text-white' : 'bg-[#f7f8fa] text-[#667085] hover:text-[#111827]'
          }`}
        >
          Payouts
          {!payoutInfo?.paystack_subaccount_code && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-amber-400 text-[10px] text-white px-1">
              !
            </span>
          )}
        </button>
      </div>

      {loading && <p className="text-[#667085]">Loading...</p>}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && tab === 'payouts' && (
        <div className="max-w-lg">
          {payoutInfo?.paystack_subaccount_code ? (
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-bold text-[#1B5E3E] mb-2">✓ Payouts connected</p>
              <p className="text-[#111827] font-bold">{payoutInfo.paystack_account_name}</p>
              <p className="text-sm text-[#667085]">
                Account ending in {payoutInfo.paystack_account_number?.slice(-4)}
              </p>
              <p className="text-xs text-[#667085] mt-3">
                You'll automatically receive the exact subtotal for your goods on every order - delivery and
                service fees go to the platform.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-bold text-[#111827] mb-1">Set up payouts</p>
              <p className="text-xs text-[#667085] mb-4">
                Connect your bank account so you're paid automatically for every order - orders can't be
                accepted until this is set up.
              </p>

              <label className="block text-xs font-bold text-[#667085] mb-1">Bank</label>
              <select
                value={selectedBankCode}
                onChange={(e) => {
                  setSelectedBankCode(e.target.value);
                  setResolvedAccountName(null);
                }}
                disabled={banksLoading}
                className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E] bg-white mb-3"
              >
                <option value="">{banksLoading ? 'Loading banks…' : 'Select your bank'}</option>
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>

              <label className="block text-xs font-bold text-[#667085] mb-1">Account number</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value.replace(/\D/g, ''));
                  setResolvedAccountName(null);
                }}
                placeholder="0123456789"
                className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E] mb-3"
              />

              {payoutError && <p className="text-sm text-red-600 mb-3">{payoutError}</p>}

              {resolvedAccountName ? (
                <div className="bg-[#f7f8fa] rounded-xl px-4 py-3 mb-3">
                  <p className="text-xs text-[#667085]">Account name</p>
                  <p className="font-bold text-[#111827]">{resolvedAccountName}</p>
                </div>
              ) : null}

              {resolvedAccountName ? (
                <button
                  onClick={savePayoutAccount}
                  disabled={savingPayout}
                  className="w-full min-h-[44px] rounded-full bg-[#1B5E3E] text-white font-bold hover:bg-[#144d32] disabled:opacity-60"
                >
                  {savingPayout ? 'Saving…' : 'Confirm and save'}
                </button>
              ) : (
                <button
                  onClick={resolveAccount}
                  disabled={resolving || banksLoading}
                  className="w-full min-h-[44px] rounded-full bg-[#1B5E3E] text-white font-bold hover:bg-[#144d32] disabled:opacity-60"
                >
                  {resolving ? 'Verifying…' : 'Verify account'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && !error && tab === 'menu' && (
        <div>
          <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm mb-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#f7f8fa] grid place-items-center overflow-hidden flex-shrink-0">
              {vendorLogoUrl ? (
                <img src={vendorLogoUrl} alt="Store logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-[#9ca3af]">No logo</span>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[#111827] mb-1">Store logo</p>
              <label className="inline-block rounded-full bg-[#f7f8fa] text-[#1B5E3E] font-bold px-4 py-1.5 text-sm cursor-pointer hover:bg-[#e5e7eb]">
                {uploadingLogo ? 'Uploading…' : vendorLogoUrl ? 'Change logo' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingLogo}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) changeVendorLogo(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {logoError && <p className="text-xs text-red-600 mt-1">{logoError}</p>}
            </div>
          </div>

          <form
            onSubmit={handleAddCategory}
            className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm mb-4 flex flex-wrap items-center gap-3"
          >
            <span className="text-sm font-bold text-[#111827]">Categories</span>
            {categories.length === 0 ? (
              <span className="text-xs text-[#667085]">
                None yet — add one so customers can filter your items.
              </span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <span
                    key={c.id}
                    className="px-3 py-1 rounded-full bg-[#f7f8fa] text-[#111827] text-xs font-bold"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="text"
                placeholder="New category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="min-h-[36px] rounded-full border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#1B5E3E]"
              />
              <button
                type="submit"
                disabled={addingCategory || !newCategoryName.trim()}
                className="min-h-[36px] rounded-full bg-[#f7f8fa] text-[#1B5E3E] font-bold px-4 text-sm hover:bg-[#e5e7eb] disabled:opacity-60"
              >
                {addingCategory ? 'Adding…' : '+ Add'}
              </button>
            </div>
          </form>

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
            <select
              value={newItemCategoryId}
              onChange={(e) => setNewItemCategoryId(e.target.value)}
              className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E] bg-white sm:col-span-1"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="w-full min-h-[44px] rounded-full border border-dashed border-[#e5e7eb] px-4 text-sm flex items-center gap-2 cursor-pointer hover:border-[#1B5E3E] sm:col-span-1 text-[#667085]">
              📷 {newItemImageFile ? newItemImageFile.name.slice(0, 20) : 'Photo (optional)'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setNewItemImageFile(e.target.files?.[0] ?? null)}
              />
            </label>
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
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-[#f7f8fa] grid place-items-center overflow-hidden flex-shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-[#9ca3af]">No photo</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#111827]">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-[#667085] truncate max-w-[320px]">{item.description}</p>
                      )}
                      <label className="text-xs font-bold text-[#1B5E3E] cursor-pointer hover:underline">
                        {uploadingItemImageId === item.id ? 'Uploading…' : item.image_url ? 'Change photo' : 'Add photo'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingItemImageId === item.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) changeItemImage(item, file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={item.category_id ?? ''}
                      disabled={menuBusyId === item.id}
                      onChange={(e) => assignCategory(item, e.target.value)}
                      className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-xs bg-white"
                    >
                      <option value="">No category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
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
