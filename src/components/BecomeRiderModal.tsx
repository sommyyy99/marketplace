import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface BecomeRiderModalProps {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const VEHICLE_TYPES = ['Motorcycle', 'Bicycle', 'Car', 'On foot'];

export function BecomeRiderModal({ open, userId, onClose, onSuccess }: BecomeRiderModalProps) {
  const [vehicleType, setVehicleType] = useState(VEHICLE_TYPES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { error: riderErr } = await supabase.from('riders').insert({
        profile_id: userId,
        vehicle_type: vehicleType,
        is_available: true,
      });
      if (riderErr) throw riderErr;

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ role: 'rider' })
        .eq('id', userId);
      if (profileErr) throw profileErr;

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Could not set up your rider account. Please try again.');
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

        <h2 className="text-2xl font-bold text-[#111827] mb-1">Become a rider</h2>
        <p className="text-sm text-[#667085] mb-6">
          Deliver orders and get paid. Pick your vehicle type to get started.
        </p>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E] bg-white"
          >
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[48px] rounded-full bg-[#1B5E3E] text-white font-bold hover:bg-[#144d32] transition-colors shadow-md disabled:opacity-60"
          >
            {saving ? 'Setting up…' : 'Start riding'}
          </button>
        </form>
      </div>
    </div>
  );
}
