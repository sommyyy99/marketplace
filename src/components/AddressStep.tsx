import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface AddressRow {
  id: string;
  label: string | null;
  street_address: string;
  city: string;
  state: string;
  is_default: boolean | null;
}

interface AddressStepProps {
  open: boolean;
  userId: string;
  onClose: () => void;
  onConfirm: (addressId: string) => void;
}

const NEW_ADDRESS_VALUE = '__new__';

export function AddressStep({ open, userId, onClose, onConfirm }: AddressStepProps) {
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(NEW_ADDRESS_VALUE);

  const [label, setLabel] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setAddressesLoading(true);

    (async () => {
      const { data, error: fetchErr } = await supabase
        .from('addresses')
        .select('id, label, street_address, city, state, is_default')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (fetchErr) {
        setError(fetchErr.message);
        setAddresses([]);
        setSelectedId(NEW_ADDRESS_VALUE);
      } else {
        const rows = data ?? [];
        setAddresses(rows);
        setSelectedId(rows.length > 0 ? rows[0].id : NEW_ADDRESS_VALUE);
      }
      setAddressesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  const isAddingNew = selectedId === NEW_ADDRESS_VALUE;

  const resetNewAddressForm = () => {
    setLabel('');
    setStreetAddress('');
    setCity('');
    setState('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAddingNew) {
      onConfirm(selectedId);
      return;
    }

    const trimmedStreet = streetAddress.trim();
    const trimmedCity = city.trim();
    const trimmedState = state.trim();

    if (!trimmedStreet || !trimmedCity || !trimmedState) {
      setError('Street address, city, and state are required.');
      return;
    }

    setSaving(true);
    try {
      const { data, error: insertErr } = await supabase
        .from('addresses')
        .insert({
          user_id: userId,
          label: label.trim() || null,
          street_address: trimmedStreet,
          city: trimmedCity,
          state: trimmedState,
          is_default: addresses.length === 0,
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      resetNewAddressForm();
      onConfirm(data.id);
    } catch (err: any) {
      setError(err.message || 'Could not save this address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-full hover:bg-[#f7f8fa]"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-[#667085]" />
        </button>

        <h2 className="text-2xl font-bold text-[#111827] mb-1">Delivery address</h2>
        <p className="text-sm text-[#667085] mb-6">Where should we deliver this order?</p>

        {addressesLoading ? (
          <p className="text-sm text-[#667085] py-3">Loading your addresses…</p>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-3">
            {addresses.length > 0 && (
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-[#667085] uppercase tracking-wider">
                  Saved addresses
                </label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E] bg-white"
                >
                  {addresses.map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.label ? `${addr.label} — ` : ''}
                      {addr.street_address}, {addr.city}
                    </option>
                  ))}
                  <option value={NEW_ADDRESS_VALUE}>+ Add a new address</option>
                </select>
              </div>
            )}

            {isAddingNew && (
              <>
                <input
                  type="text"
                  placeholder='Label (optional, e.g. "Home")'
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E]"
                />
                <input
                  type="text"
                  required
                  placeholder="Street address"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E]"
                />
                <input
                  type="text"
                  required
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E]"
                />
                <input
                  type="text"
                  required
                  placeholder="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E]"
                />
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[48px] rounded-full bg-[#1B5E3E] text-white font-bold hover:bg-[#144d32] transition-colors shadow-md disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Continue to payment'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
