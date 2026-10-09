import { useState } from 'react';
import { UserProfile } from '../types';
import { changePassword } from '../lib/mockData';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PasswordChange({ user, onSuccess }: { user: UserProfile, onSuccess: (user: UserProfile) => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword === 'admin123') {
      setError('Cannot use the default password. Please choose a unique one.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await changePassword(user.uid, newPassword);
      
      // Create the updated user object and sync state
      const updatedUser: UserProfile = { 
        ...user, 
        needsPasswordChange: false,
      };

      // Persist the updated session for Admin
      localStorage.setItem('adminData', JSON.stringify(updatedUser));
      
      onSuccess(updatedUser);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center p-6 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white border border-gray-100 rounded-[3rem] shadow-2xl p-10 md:p-14"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-3xl font-serif italic text-black mb-2">Security Enforcement</h2>
          <p className="text-center text-black/50 text-xs font-bold uppercase tracking-widest px-6">
            Internal protocol requires a mandatory password update for administrative profiles.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-black/40 uppercase tracking-widest ml-1">New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-black/5 outline-none transition-all text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-black/40 uppercase tracking-widest ml-1">Confirm Update</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-black/5 outline-none transition-all text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest text-center py-2 bg-red-50 rounded-xl">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-black text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Securing...' : <><ArrowRight size={16}/> Apply Security Update</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
