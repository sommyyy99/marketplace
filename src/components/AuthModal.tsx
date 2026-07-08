import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type Mode = 'signin' | 'signup';

export function AuthModal({ open, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (signUpError) throw signUpError;

        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName,
            role: 'customer',
          });
          if (profileError) console.error('Profile insert failed', profileError);
        }

        if (!data.session) {
          setInfo('Check your email to confirm your account.');
        } else {
          onClose();
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
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

        <h2 className="text-2xl font-bold text-[#111827] mb-1">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="text-sm text-[#667085] mb-6">
          {mode === 'signin' ? 'Sign in to continue shopping' : 'Join Sommygo in seconds'}
        </p>

        <form onSubmit={handleSubmit} className="grid gap-3">
          {mode === 'signup' && (
            <input
              type="text"
              required
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E]"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E]"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-[44px] rounded-full border border-[#e5e7eb] px-4 text-sm outline-none focus:border-[#1B5E3E]"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-[#1B5E3E]">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-full bg-[#1B5E3E] text-white font-bold hover:bg-[#144d32] transition-colors shadow-md disabled:opacity-60"
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <p className="text-sm text-[#667085] text-center mt-4">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              reset();
            }}
            className="text-[#1B5E3E] font-bold hover:underline"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
