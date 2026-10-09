import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, User, Mail, KeyRound, Eye, EyeOff } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { auth, db } from '../lib/firebase';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

interface AuthProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  // ---------- Login state ----------
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ---------- Registration state (patients only) ----------
  const [isRegistering, setIsRegistering] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // ---------- Password reset state ----------
  const [resetEmail, setResetEmail] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  // -------------------- Admin login (Firestore only) --------------------
  const adminLogin = async (adminUsername: string, pwd: string) => {
    const adminDoc = await getDoc(doc(db, 'users', 'admin'));
    if (!adminDoc.exists()) throw new Error('Admin account not found.');
    const adminData = adminDoc.data() as UserProfile;
    
    const dbUsername = (adminData.username || 'admin').toLowerCase();
    const dbEmail = (adminData.email || 'reliancedialysiscenter.mabini@gmail.com').toLowerCase();
    
    const input = adminUsername.trim().toLowerCase();
    // Allow login using 'admin' or the full email address
    if (input !== dbUsername && input !== dbEmail) {
      throw new Error('Incorrect admin identifier');
    }
    
    if (adminData.password !== pwd) throw new Error('Wrong password. Please try again.');

    // ✅ Check if admin is already logged in on another device
    if (adminData.isOnline) {
      throw new Error('Admin is already logged in on another device/PC. Please logout from the other session first.');
    }

    const sessionId = Math.random().toString(36).substring(7);
    await updateDoc(doc(db, 'users', 'admin'), { isOnline: true, activeSessionId: sessionId });

    const adminUser: UserProfile = {
      uid: 'admin',
      username: adminData.username || 'admin',
      role: UserRole.ADMIN,
      email: dbEmail,
      needsPasswordChange: adminData.needsPasswordChange,
      activeSessionId: sessionId
    };
    localStorage.setItem('adminSession', 'true');
    localStorage.setItem('adminData', JSON.stringify(adminUser));
    onLoginSuccess(adminUser);
  };

  // -------------------- Patient login (Firebase Auth) --------------------
  const patientLogin = async (email: string, pwd: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, pwd);
    const firebaseUser = userCredential.user;
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (!userDoc.exists()) throw new Error('User profile not found.');
    const userData = userDoc.data() as UserProfile;

    onLoginSuccess({
      uid: firebaseUser.uid,
      username: userData.username,
      role: userData.role,
      email: userData.email || firebaseUser.email || '',
      needsPasswordChange: userData.needsPasswordChange,
      fullName: userData.fullName,
      age: userData.age,
      birthday: userData.birthday,
      height: userData.height,
      weight: userData.weight,
      medicalHistory: userData.medicalHistory,
      profileCompleted: userData.profileCompleted
    });
  };

  // -------------------- Main login handler (auto-detect) --------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const trimmedId = identifier.trim();
      const trimmedPassword = password.trim();
      const lowerId = trimmedId.toLowerCase();

      // Robust detection for Admin account
      const isAdmin = lowerId === 'admin' || lowerId === 'reliancedialysiscenter.mabini@gmail.com';

      if (isAdmin || !trimmedId.includes('@')) {
        await adminLogin(trimmedId, trimmedPassword);
      } else {
        await patientLogin(trimmedId, trimmedPassword);
      }
    } catch (err: any) {
      const isTryingAdmin = identifier.toLowerCase().includes('admin') || 
                           identifier.toLowerCase().includes('reliancedialysiscenter');
      
      if (!isTryingAdmin && (err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email')) {
        setError('Invalid credentials. Please check your email and password.');
        return;
      }

      if (isTryingAdmin || err.message?.includes('admin')) {
        setError('Admin Login: ' + err.message);
      } else {
        switch (err.code) {
          case 'auth/user-not-found':
            setError('No account found with this email');
            break;
          case 'auth/wrong-password':
            setError('Incorrect password');
            break;
          default:
            setError('Login failed: ' + (err.message || 'Check your credentials'));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // -------------------- Patient registration --------------------
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim()) {
      setError('Username is required');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      const firebaseUser = userCredential.user;
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        username: regUsername.trim(),
        role: UserRole.PATIENT,
        email: regEmail,
        createdAt: new Date().toISOString(),
        isOnline: false,
        activeSessionId: null
      });
      onLoginSuccess({
        uid: firebaseUser.uid,
        username: regUsername.trim(),
        role: UserRole.PATIENT,
        email: regEmail,
        profileCompleted: false
      });
    } catch (err: any) {
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('Email already registered');
          break;
        case 'auth/weak-password':
          setError('Password must be at least 6 characters');
          break;
        default:
          setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // -------------------- Password reset (patients only) --------------------
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      alert('✅ Password reset link sent to your email.');
      setShowResetModal(false);
      setResetEmail('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------- UI --------------------
  return (
    <div className="min-h-screen bg-[#fcfcfc] text-black flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-black/5 -skew-x-12 translate-x-1/4 pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white border border-gray-100 rounded-[3rem] shadow-2xl overflow-hidden relative z-10"
      >
        <div className="p-10 md:p-14">
          <div className="flex flex-col items-center mb-12">
            <div className="w-20 h-20 bg-black rounded-[2rem] flex items-center justify-center text-white shadow-2xl border-4 border-gray-50 text-3xl font-serif italic mb-6">M</div>
            <h2 className="text-4xl font-serif italic text-black drop-shadow mb-2">MediQueue</h2>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/60 mb-4 text-center">
              Reliance Dialysis Center Inc. - Mabini Branch
            </p>
            <div className="h-1 w-12 bg-black/10 rounded-full"></div>
            <p className="text-black text-opacity-90 text-xs font-bold uppercase tracking-widest mt-4">
              {isRegistering ? 'Patient Registration' : 'Sign in to your account'}
            </p>
          </div>

          {!isRegistering ? (
            // ---------- LOGIN FORM ----------
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40" size={20} />
                  <input
                    type="text"
                    placeholder="Username or Email"
                    className="w-full pl-14 pr-6 py-5 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 text-sm"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40" size={20} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    className="w-full pl-14 pr-14 py-5 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
                  >
                    {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
              </div>

              {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-2xl text-center">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-black text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Sign In'}
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-black/40 text-[10px] font-bold uppercase tracking-widest hover:text-black transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className="text-black text-sm font-bold uppercase tracking-widest hover:text-black transition-colors"
                >
                  Need an account? Register
                </button>
              </div>
            </form>
          ) : (
            // ---------- REGISTRATION FORM (patients only) ----------
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40" size={20} />
                  <input
                    type="email"
                    placeholder="Email address"
                    className="w-full pl-14 pr-6 py-5 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 text-sm"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40" size={20} />
                  <input
                    type="text"
                    placeholder="Display Name"
                    className="w-full pl-14 pr-6 py-5 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 text-sm"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40" size={20} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password (min 6 characters)"
                    className="w-full pl-14 pr-14 py-5 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 text-sm"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
                  >
                    {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
              </div>

              {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-2xl text-center">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-black text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Register'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="text-black text-sm font-bold uppercase tracking-widest hover:text-black transition-colors"
                >
                  Already have an account? Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>

      {/* Password Reset Modal (patients only) */}
      {showResetModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[3rem] p-10 max-w-lg w-full shadow-2xl"
          >
            <div className="flex flex-col items-center mb-8">
              <div className="w-20 h-20 bg-black rounded-[2rem] flex items-center justify-center text-white shadow-xl mb-6">
                <KeyRound size={40} />
              </div>
              <h2 className="text-3xl font-serif italic text-black mb-2">Reset Password</h2>
              <p className="text-black/40 text-[10px] font-bold uppercase tracking-widest text-center px-4">
                Enter the email address registered with your patient account.
              </p>
            </div>
            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40" size={20} />
                <input
                  type="email"
                  placeholder="Your email address"
                  className="w-full pl-14 pr-6 py-5 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 text-sm"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-5 border border-gray-100 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-5 bg-black text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}