import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';

export interface AddressRow {
  id: string;
  label: string | null;
  street_address: string;
  city: string;
  state: string;
}

interface AddressModalProps {
  userId: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (addressId: string) => void;
}

export function AddressModal({ userId, open, onClose, onConfirm }: AddressModalProps) {
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [mode, setMode] = useState<'pick' | 'new'>('new');
  const [label, setLabel] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error: err } = await supabase
        .from('addresses')
        .select('id, label, street_address, city, state')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (err) {
        console.error('Failed to load addresses', err);
        setAddresses([]);
        setMode('new');
      } else {
        const rows = data ?? [];
        setAddresses(rows);
        if (rows.length > 0) {
          setMode('pick');
          setSelectedId(rows[0].id);
        } else {
          setMode('new');
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'pick') {
      if (!selectedId) {
        setError('Please choose a delivery address.');
        return;
      }
      onConfirm(selectedId);
      return;
    }

    const trimmed = {
      street_address: street.trim(),
      city: city.trim(),
      state: stateName.trim(),
      label: label.trim() || null,
    };
    if (!trimmed.street_address || !trimmed.city || !trimmed.state) {
      setError('Street address, city and state are required.');
      return;
    }
    if (trimmed.street_address.length > 200 || trimmed.city.length > 80 || trimmed.state.length > 80) {
      setError('Please shorten your address details.');
      return;
    }

    setSaving(true);
    const { data, error: insertErr } = await supabase
      .from('addresses')
      .insert({ ...trimmed, user_id: userId })
      .select('id')
      .single();
    setSaving(false);
    if (insertErr || !data) {
      console.error('Failed to save address', insertErr);
      setError(insertErr?.message || 'Could not save your address. Please try again.');
      return;
    }
    onConfirm(data.id);
  };

  const inputClass =
    'w-full min-h-[46px] rounded-xl border border-[#e5e7eb] bg-white px-4 text-sm text-[#111827] outline-none focus:border-[#1B5E3E]';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <p className="text-[#1B5E3E] text-xs font-black uppercase tracking-wider mb-1.5">
          Step 1 of 2
        </p>
        <h2 className="text-xl font-bold text-[#111827] mb-4">Delivery address</h2>

        {loading ? (
          <p className="text-sm text-[#667085] py-4">Loading your addresses…</p>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-3">
            {addresses.length > 0 && (
              <>
                <label className="text-sm font-bold text-[#111827]">Deliver to</label>
                <select
                  value={mode === 'new' ? '__new' : selectedId}
                  onChange={(e) => {
                    if (e.target.value === '__new') {
                      setMode('new');
                    } else {
                      setMode('pick');
                      setSelectedId(e.target.value);
                    }
                  }}
                  className={inputClass}
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label ? `${a.label} — ` : ''}
                      {a.street_address}, {a.city}, {a.state}
                    </option>
                  ))}
                  <option value="__new">+ Add a new address</option>
                </select>
              </>
            )}

            {mode === 'new' && (
              <>
                <input
                  className={inputClass}
                  placeholder="Label (optional) e.g. Home, Office"
                  value={label}
                  maxLength={40}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Street address"
                  value={street}
                  maxLength={200}
                  onChange={(e) => setStreet(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={inputClass}
                    placeholder="City"
                    value={city}
                    maxLength={80}
                    onChange={(e) => setCity(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="State"
                    value={stateName}
                    maxLength={80}
                    onChange={(e) => setStateName(e.target.value)}
                  />
                </div>
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="mt-1 w-full min-h-[48px] rounded-full bg-[#1B5E3E] text-white font-bold hover:bg-[#144d32] transition-colors shadow-md disabled:opacity-60"
            >
              {saving ? 'Saving address…' : 'Continue to payment'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] rounded-full bg-[#f7f8fa] text-[#667085] font-bold hover:bg-[#e5e7eb] transition-colors"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
