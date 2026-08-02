/**
 * Login — email/password + Google sign-in, styled to the Vanguard glass theme.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { useAuth } from '../auth/AuthContext';

// Map Firebase error codes to friendly, human messages.
const ERROR_MESSAGES = {
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account with that email already exists.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
};

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [mode, setMode] = useState('signin'); // 'signin' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Already signed in → bounce to the app.
  if (!authLoading && user) return <Navigate to={from} replace />;

  const friendly = (e) => ERROR_MESSAGES[e?.code] || 'Something went wrong. Please try again.';

  const submitEmail = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[380px]"
      >
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-[#7BB8FF] to-[#C4B5FD] opacity-90" />
            <div className="absolute inset-[1.5px] rounded-[10px] bg-[#07090F]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-[5px] bg-gradient-to-br from-[#7BB8FF] to-[#C4B5FD]" />
            </div>
          </div>
          <h1 className="text-[22px] font-display font-medium tracking-tight text-white/95">
            {mode === 'register' ? 'Create your account' : 'Sign in to Vanguard'}
          </h1>
          <p className="text-[13px] text-white/45 mt-1.5">
            {mode === 'register'
              ? 'Set up access to the security workspace'
              : 'Autonomous security engineer'}
          </p>
        </div>

        <div className="glass-elevated p-6">
          <form onSubmit={submitEmail} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" strokeWidth={1.75} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[14px] text-white/90 placeholder-white/25 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" strokeWidth={1.75} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[14px] text-white/90 placeholder-white/25 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>

            {error && (
              <div className="text-[12.5px] text-[#F87171] flex items-center gap-2 pt-0.5">
                <span className="w-1 h-1 rounded-full bg-[#F87171]" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === 'register' ? 'Create account' : 'Sign in'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <span className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/30">or</span>
            <span className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <button
            onClick={signInGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13.5px] font-medium text-white/85 hover:bg-white/[0.07] transition-colors disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <p className="text-center text-[13px] text-white/45 mt-6">
          {mode === 'register' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setMode(mode === 'register' ? 'signin' : 'register'); setError(null); }}
            className="text-[#7BB8FF] hover:text-[#9CCBFF] transition-colors font-medium"
          >
            {mode === 'register' ? 'Sign in' : 'Register'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 009 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 010-3.44V4.95H.96a9 9 0 000 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 00.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
