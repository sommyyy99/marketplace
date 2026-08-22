import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface BecomeVendorModalProps {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const SERVICE_CATEGORIES = ['Food & Drinks', 'Groceries', 'Pharmacy', 'Fashion', 'Beauty', 'Electronics', 'Services', 'Everything Else'];

export function BecomeVendorModal({ open, userId, onClose, onSuccess }: BecomeVendorModalProps) {
  const [name, setName] = useState('');
  const [serviceCategory, setServiceCategory] = useState(SERVICE_CATEGORIES[0]);
  const [category, setCategory] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedStreet = streetAddress.trim();
    if (!trimmedName || !trimmedStreet) {
      setError('Vendor name and street address are required.');
      return;
    }

    setSaving(true);
    try {
      const { error: vendorErr } = await supabase.from('vendors').insert({
        owner_id: userId,
        name: trimmedName,
        service_category: serviceCategory,
        category: category.trim() || null,
        street_address: trimmedStreet,
        description: description.trim() || null,
        is_active: true,
        is_open: true,
      });
      if (vendorErr) throw vendorErr;

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ role: 'vendor' })
        .eq('id', userId);
      if (profileErr) throw profileErr;

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Could not set up your vendor account. Please try again.');
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

        <h2 className="text-2xl font-bold text-[#111827] mb-1">Become a vendor</h2>
        <p className="text-sm text-[#667085] mb-6">
          Set up your storefront to start listing menu items and receiving orders.
        </p>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <input
            type="text"
            required
            placeholder="Vendor / business name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E]"
          />
          <select
            value={serviceCategory}
            onChange={(e) => setServiceCategory(e.target.value)}
            className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E] bg-white"
          >
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder='More specific type (optional, e.g. "Nigerian food", "Sneakers")'
            value={category}
            onChange={(e) => setCategory(e.target.value)}
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
          <textarea
            placeholder="Short description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-[#e5e7eb] px-4 py-3 text-sm outline-none focus:border-[#1B5E3E] resize-none"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[48px] rounded-full bg-[#1B5E3E] text-white font-bold hover:bg-[#144d32] transition-colors shadow-md disabled:opacity-60"
          >
            {saving ? 'Setting up…' : 'Create vendor account'}
          </button>
        </form>
      </div>
    </div>
  );
}
