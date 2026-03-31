/**
 * AuthAdditions.tsx — Nexus
 *
 * Drop these two components into AuthPage.tsx and update the wiring below.
 *
 * 1. LoginSuccessPage  — full-screen confirmation shown after successful login
 * 2. SetPasswordView   — unified "set a new password" form for:
 *      a) Forgotten-password flow (user has a reset code from email)
 *      b) newPasswordRequired challenge (admin-created account, first login)
 *
 * ─── Wiring changes needed in AuthPage ───────────────────────────────────────
 *
 *  A) Add two new views to the View union type:
 *       type View = 'signin' | 'signup' | 'verify' | 'forgot' | 'setpassword' | 'success';
 *
 *  B) Add entries to META:
 *       setpassword: { title: 'Set your password', subtitle: 'Choose a strong password to continue' },
 *       success:     { title: 'You're in',          subtitle: 'Taking you to your workspace…' },
 *
 *  C) In AuthPage's JSX, add these two render lines alongside the existing view conditions:
 *       {view === 'setpassword' && (
 *         <SetPasswordView
 *           mode={setPwMode}           // 'forgot' | 'challenge'
 *           email={pendingEmail}
 *           challengeUser={challengeUser}
 *           onSuccess={() => setView('success')}
 *           onSignIn={() => setView('signin')}
 *         />
 *       )}
 *       {view === 'success' && <LoginSuccessPage />}
 *
 *  D) Add state for mode and challenge user:
 *       const [setPwMode,     setSetPwMode]     = useState<'forgot' | 'challenge'>('forgot');
 *       const [challengeUser, setChallengeUser] = useState<CognitoUser | null>(null);
 *
 *  E) In SignInView's newPasswordRequired callback, instead of setError:
 *       newPasswordRequired: () => {
 *         setLoading(false);
 *         setChallengeUser(cognitoUser);   // pass setter down as prop
 *         setSetPwMode('challenge');
 *         setPendingEmail(email.trim());
 *         setView('setpassword');
 *       }
 *
 *  F) Update ForgotView's onSuccess to route to setpassword instead of staying internal:
 *       After step 'request' succeeds → call onSetPassword(email) instead of setStep('reset')
 *       Pass onSetPassword as a prop: ({ onSignIn, onSetPassword }: { ... onSetPassword:(e:string)=>void })
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CognitoUser,
  CognitoUserSession,
  
} from 'amazon-cognito-identity-js';
import { userPool, useAuth } from '@/contexts/AuthContext';
import { AuthenticationDetails } from 'amazon-cognito-identity-js';
// ─── Shared primitives (already in AuthPage — import from there instead) ──────
// Copied here for standalone reference only.

function Field({
  label, type = 'text', value, onChange, placeholder, autoComplete, error,
}: {
  label: string; type?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; autoComplete?: string; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const isPw = type === 'password';
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', marginBottom: 6,
        color: focused ? '#6366f1' : '#64748b', transition: 'color .2s',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={isPw && showPass ? 'text' : type}
          value={value} onChange={onChange} placeholder={placeholder}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: isPw ? '11px 52px 11px 14px' : '11px 14px',
            fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: '#0f172a',
            background: focused ? '#fff' : '#f8fafc',
            border: `1.5px solid ${error ? '#ef4444' : focused ? '#6366f1' : '#e2e8f0'}`,
            borderRadius: 10, outline: 'none', transition: 'all .2s',
            boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
          }}
        />
        {isPw && (
          <button type="button" onClick={() => setShowPass(v => !v)} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: '#94a3b8', fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
          }}>
            {showPass ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error && <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444', fontFamily: "'DM Sans', sans-serif" }}>{error}</p>}
    </div>
  );
}

function Btn({ children, onClick, loading, disabled, type = 'button' }: {
  children: React.ReactNode; onClick?: () => void;
  loading?: boolean; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '12px 20px', border: 'none', borderRadius: 10,
        fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", color: '#fff',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        background: loading || disabled ? '#a5b4fc'
          : hovered ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
          : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        boxShadow: hovered && !disabled ? '0 8px 25px rgba(99,102,241,0.4)' : '0 2px 8px rgba(99,102,241,0.2)',
        transform: hovered && !disabled ? 'translateY(-1px)' : 'none',
        transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
      {loading && (
        <span style={{
          width: 15, height: 15, border: '2px solid rgba(255,255,255,0.35)',
          borderTopColor: '#fff', borderRadius: '50%',
          display: 'inline-block', animation: 'nx-spin .7s linear infinite',
        }} />
      )}
      {children}
    </button>
  );
}

function Alert({ message, type = 'error' }: { message: string; type?: 'error' | 'success' | 'info' }) {
  if (!message) return null;
  const palette = {
    error:   { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', icon: '✕' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', icon: '✓' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb', icon: 'ℹ' },
  }[type];
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 10, marginBottom: 16,
      background: palette.bg, border: `1px solid ${palette.border}`,
    }}>
      <span style={{ color: palette.color, fontWeight: 700, fontSize: 13, marginTop: 1 }}>{palette.icon}</span>
      <p style={{ margin: 0, fontSize: 13, color: palette.color, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>{message}</p>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div style={{ marginTop: -8, marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= score ? colors[score] : '#e2e8f0', transition: 'background .3s',
          }} />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: colors[score], fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
        {labels[score]} password
      </p>
    </div>
  );
}

function friendlyError(err: { code?: string; message?: string }): string {
  const map: Record<string, string> = {
    NotAuthorizedException:    'Incorrect email or password.',
    UserNotFoundException:     'No account found with that email.',
    InvalidPasswordException:  'Password must be at least 8 characters and include a number.',
    CodeMismatchException:     'That verification code is incorrect.',
    ExpiredCodeException:      'That code has expired — request a new one.',
    LimitExceededException:    'Too many attempts. Please wait a moment.',
    InvalidParameterException: 'Please check your input and try again.',
  };
  return (err.code && map[err.code]) || err.message || 'Something went wrong. Please try again.';
}

// =============================================================================
// 1. LOGIN SUCCESS PAGE
// =============================================================================
/**
 * Full-screen confirmation shown immediately after a successful login.
 * Calls onLoginSuccess from AuthContext then auto-redirects after 2.4 s.
 * The parent (App.tsx / router) should watch cognitoUser and render the
 * dashboard once it's set — this page just provides the visual bridge.
 */
export function LoginSuccessPage() {
  const [progress, setProgress] = useState(0);
  const [tick,     setTick]     = useState(0);

  const DURATION = 2400; // ms before the parent re-renders to dashboard
  const start    = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - start.current;
      const pct     = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);
      setTick(t => t + 1);
      if (pct >= 100) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, []);

  // Staggered check marks
  const checks = [
    { label: 'Identity verified',     delay: 0    },
    { label: 'Workspace loaded',      delay: 500  },
    { label: 'Preparing dashboard',   delay: 1100 },
  ];

  return (
    <>
      <style>{`
        @keyframes nx-spin    { to { transform: rotate(360deg); } }
        @keyframes nx-fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes nx-pop     { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes nx-check   { from{stroke-dashoffset:24} to{stroke-dashoffset:0} }
        @keyframes nxOrb1     { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,30px) scale(1.05)} 66%{transform:translate(-20px,50px) scale(0.97)} }
        @keyframes nxOrb2     { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,-30px) scale(1.08)} 66%{transform:translate(30px,-50px) scale(0.95)} }
      `}</style>

      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#fafafe 0%,#f1f0ff 50%,#f8f7ff 100%)',
        padding: 20, position: 'relative', fontFamily: "'DM Sans', sans-serif",
      }}>

        {/* Orbs */}
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {[
            { w:600, h:600, top:'-10%', left:'-10%', color:'rgba(99,102,241,0.15)', anim:'nxOrb1 18s ease-in-out infinite' },
            { w:500, h:500, bottom:'-5%', right:'-5%', color:'rgba(139,92,246,0.12)', anim:'nxOrb2 22s ease-in-out infinite' },
          ].map((o, i) => (
            <div key={i} style={{
              position: 'absolute', width: o.w, height: o.h, borderRadius: '50%',
              background: `radial-gradient(circle, ${o.color} 0%, transparent 70%)`,
              top: (o as any).top, left: (o as any).left,
              bottom: (o as any).bottom, right: (o as any).right,
              animation: o.anim,
            }} />
          ))}
        </div>

        <div style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, textAlign: 'center',
          animation: 'nx-fadeUp .5s cubic-bezier(.22,1,.36,1) forwards',
        }}>

          {/* Success icon */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 28px',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            boxShadow: '0 16px 48px rgba(99,102,241,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'nx-pop .5s cubic-bezier(.22,1,.36,1) forwards',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline
                points="20 6 9 17 4 12"
                style={{
                  strokeDasharray: 24,
                  strokeDashoffset: 0,
                  animation: 'nx-check .4s .3s cubic-bezier(.22,1,.36,1) both',
                }}
              />
            </svg>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: 32, fontWeight: 600, letterSpacing: '-0.04em', margin: '0 0 8px',
            color: '#0f172a', fontFamily: "'Fraunces', serif", fontStyle: 'italic',
          }}>
            You're in.
          </h1>
          <p style={{ margin: '0 0 36px', fontSize: 15, color: '#64748b' }}>
            Welcome back to your Nexus workspace.
          </p>

          {/* Card */}
          <div style={{
            background: '#fff', borderRadius: 20,
            border: '1px solid rgba(99,102,241,0.1)',
            boxShadow: '0 20px 60px rgba(99,102,241,0.1), 0 4px 16px rgba(0,0,0,0.04)',
            padding: '28px 32px', position: 'relative', overflow: 'hidden',
          }}>
            {/* Top accent */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: 'linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa)',
              borderRadius: '20px 20px 0 0',
            }} />

            {/* Step checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
              {checks.map(({ label, delay }) => {
                const elapsed = Date.now() - start.current;
                const visible = elapsed >= delay;
                return (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    opacity: visible ? 1 : 0, transition: 'opacity .4s',
                    animation: visible ? `nx-fadeUp .4s cubic-bezier(.22,1,.36,1) both` : 'none',
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: visible
                        ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                        : '#e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background .4s',
                      boxShadow: visible ? '0 4px 10px rgba(99,102,241,0.3)' : 'none',
                    }}>
                      {visible
                        ? <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
                            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="10 3 5 9 2 6" />
                          </svg>
                        : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1' }} />
                      }
                    </div>
                    <span style={{
                      fontSize: 14, fontWeight: 600, color: visible ? '#1e293b' : '#94a3b8',
                      transition: 'color .4s',
                    }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div style={{
              height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                width: `${progress}%`,
                transition: 'width .05s linear',
                boxShadow: '0 0 8px rgba(99,102,241,0.5)',
              }} />
            </div>
            <p style={{
              margin: '10px 0 0', fontSize: 12, color: '#94a3b8', textAlign: 'right',
            }}>
              Redirecting…
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// 2. SET PASSWORD VIEW
// =============================================================================
/**
 * Handles two distinct flows with one form:
 *
 *  mode === 'forgot'    — user clicked "Forgot password", received an emailed
 *                         code, now sets a new password using confirmPassword()
 *
 *  mode === 'challenge' — Cognito's newPasswordRequired challenge fired during
 *                         sign-in (admin-created account). Uses the live
 *                         cognitoUser object via completeNewPasswordChallenge()
 *
 * Props:
 *   mode          — 'forgot' | 'challenge'
 *   email         — pre-filled email (from pendingEmail state in AuthPage)
 *   challengeUser — the mid-auth CognitoUser (only needed for 'challenge' mode)
 *   onSuccess     — called when password is set; parent routes to 'success'
 *   onSignIn      — back-to-sign-in escape hatch
 */
export function SetPasswordView({
  mode,
  email,
  challengeUser,
  onEmailChange,
  onSuccess,
  onSignIn,
}: {
  mode: 'forgot' | 'challenge';
  email: string;
  challengeUser?: CognitoUser | null;
  onEmailChange?: (email: string) => void;
  onSuccess: () => void;
  onSignIn: () => void;
}) {
  const { onLoginSuccess } = useAuth();

  // Forgot flow: step 1 = request code, step 2 = verify code, step 3 = set password
  const [step,       setStep]       = useState<'request' | 'verify' | 'set'>(
    mode === 'challenge' ? 'set' : 'request'
  );
  const [localEmail, setLocalEmail] = useState(email);
  const [code,       setCode]       = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  // Keep a stable CognitoUser reference across steps so confirmPassword works
  const cognitoUserRef = useRef<CognitoUser | null>(null);

  // ── Step 1 (forgot only): send reset code ─────────────────────────────────
  const handleRequestCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localEmail) { setError('Please enter your email.'); return; }
    setLoading(true); setError('');

    const user = new CognitoUser({ Username: localEmail.trim(), Pool: userPool });
    cognitoUserRef.current = user;
    user.forgotPassword({
      onSuccess: () => {
        setLoading(false);
        onEmailChange?.(localEmail.trim());
        setStep('verify');
      },
      onFailure: (err) => { setLoading(false); setError(friendlyError(err)); },
    });
  };

  // ── Step 2 (forgot only): verify the emailed code ─────────────────────────
  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('Please enter the code from your email.'); return; }
    // Cognito doesn't have a standalone "check code" endpoint; we store it and
    // validate implicitly in confirmPassword. We do a lightweight format check here.
    if (!/^\d{6}$/.test(code.trim())) { setError('Codes are 6 digits — please double-check.'); return; }
    setError('');
    setStep('set');
  };

  // ── Step 2: set the new password ──────────────────────────────────────────
  const handleSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirm) { setError('Please fill in all fields.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    if (password.length < 8)   { setError('Password must be at least 8 characters.'); return; }
    if (mode === 'forgot' && !code) { setError('Please enter the code from your email.'); return; }

    setLoading(true); setError('');

    if (mode === 'challenge') {
      // ── newPasswordRequired path ────────────────────────────────────────
      if (!challengeUser) { setError('Session expired. Please sign in again.'); setLoading(false); return; }
      challengeUser.completeNewPasswordChallenge(password, {}, {
        onSuccess: (session: CognitoUserSession) => {
          setLoading(false);
          onLoginSuccess(challengeUser, session);
          onSuccess();
        },
        onFailure: (err) => { setLoading(false); setError(friendlyError(err)); },
      });
    } else {
      // ── Forgot-password confirmPassword path ────────────────────────────
      const user = cognitoUserRef.current ?? new CognitoUser({ Username: localEmail.trim(), Pool: userPool });
      user.confirmPassword(code.trim(), password, {
        onSuccess: () => {
          setLoading(false);
          setSuccess('Password updated! Signing you in…');
          // Auto sign-in with the new password
          
          const authDetails = new AuthenticationDetails({ Username: localEmail.trim(), Password: password });
          user.authenticateUser(authDetails, {
            onSuccess: (session: CognitoUserSession) => {
              onLoginSuccess(user, session);
              onSuccess();
            },
            onFailure: () => {
              // Silent fallback — just send them to sign-in if auto-login fails
              setTimeout(onSignIn, 1500);
            },
          });
        },
        onFailure: (err) => {
          setLoading(false);
          // If the code was wrong, send them back to re-enter it
          if (err.code === 'CodeMismatchException' || err.code === 'ExpiredCodeException') {
            setCode('');
            setStep('verify');
          }
          setError(friendlyError(err));
        },
      });
    }
  };

  // ── Step 1 UI (forgot mode only) ──────────────────────────────────────────
  if (step === 'request') return (
    <form onSubmit={handleRequestCode}>
      <Alert message={error}   type="error" />
      <Alert message={success} type="success" />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, marginBottom: 20,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style={{ margin: 0, fontSize: 13, color: '#2563eb', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
          Enter your email and we'll send a 6-digit reset code.
        </p>
      </div>

      <Field label="Email address" type="email" value={localEmail}
        onChange={e => setLocalEmail(e.target.value)}
        placeholder="you@company.com" autoComplete="email" />

      <Btn type="submit" loading={loading}>Send reset code</Btn>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button type="button" onClick={onSignIn} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: '#94a3b8', fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif", padding: 0,
        }}>
          ← Back to sign in
        </button>
      </div>
    </form>
  );

  // ── Step 2 UI (forgot only): enter the emailed code ───────────────────────
  if (step === 'verify') return (
    <form onSubmit={handleVerifyCode}>
      <Alert message={error} type="error" />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 20,
      }}>
        <span style={{ fontSize: 18 }}>📬</span>
        <p style={{ margin: 0, fontSize: 13, color: '#15803d', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
          We sent a 6-digit code to <strong>{localEmail}</strong>. Check your inbox.
        </p>
      </div>

      <Field label="Reset code" value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="123456" autoComplete="one-time-code" />

      <Btn type="submit" loading={loading}>Verify code</Btn>

      <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button type="button" onClick={handleRequestCode as any} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: '#6366f1', fontWeight: 700,
          fontFamily: "'DM Sans', sans-serif", padding: 0,
        }}>
          Resend code
        </button>
        <span style={{ color: '#cbd5e1' }}>·</span>
        <button type="button" onClick={onSignIn} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: '#94a3b8', fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif", padding: 0,
        }}>
          ← Back to sign in
        </button>
      </div>
    </form>
  );

  // ── Step 3 UI (shared between both modes) ─────────────────────────────────
  const isForgot    = mode === 'forgot';
  const isChallenge = mode === 'challenge';

  return (
    <form onSubmit={handleSetPassword}>
      <Alert message={error}   type="error" />
      <Alert message={success} type="success" />

      {/* Context banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
        background: isChallenge ? '#fdf4ff' : '#f0fdf4',
        border: `1px solid ${isChallenge ? '#e9d5ff' : '#bbf7d0'}`,
        borderRadius: 10, marginBottom: 20,
      }}>
        <span style={{ fontSize: 16, marginTop: 1 }}>{isChallenge ? '🔐' : '📬'}</span>
        <p style={{
          margin: 0, fontSize: 13, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif",
          color: isChallenge ? '#7c3aed' : '#15803d',
        }}>
          {isChallenge
            ? <>Your account was created by an admin. Set a personal password to continue as <strong>{email}</strong>.</>
            : <>We sent a 6-digit code to <strong>{localEmail}</strong>. Enter it below along with your new password.</>
          }
        </p>
      </div>

      {/* Code field — removed: code is captured in the verify step */}

      <Field label="New password" type="password" value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Create a strong password" autoComplete="new-password" />
      <PasswordStrength password={password} />

      <Field label="Confirm new password" type="password" value={confirm}
        onChange={e => setConfirm(e.target.value)}
        placeholder="Repeat your password" autoComplete="new-password" />

      {/* Requirements hint */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px',
        marginBottom: 20, padding: '12px 14px',
        background: '#f8fafc', borderRadius: 10,
        border: '1px solid #e2e8f0',
      }}>
        {[
          { label: '8+ characters',   met: password.length >= 8 },
          { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
          { label: 'Number',          met: /[0-9]/.test(password) },
          { label: 'Special character',met: /[^A-Za-z0-9]/.test(password) },
        ].map(({ label, met }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              background: met ? '#10b981' : '#e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .25s',
            }}>
              {met && (
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none"
                  stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="8 2 4 8 2 5" />
                </svg>
              )}
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              color: met ? '#10b981' : '#94a3b8', transition: 'color .25s',
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <Btn type="submit" loading={loading}>
        {isChallenge ? 'Set password & sign in' : 'Reset password & sign in'}
      </Btn>

      <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16 }}>
        {isForgot && (
          <>
            <button type="button" onClick={() => { setCode(''); setStep('request'); }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: '#6366f1', fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif", padding: 0,
            }}>
              Resend code
            </button>
            <span style={{ color: '#cbd5e1' }}>·</span>
          </>
        )}
        <button type="button" onClick={onSignIn} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: '#94a3b8', fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif", padding: 0,
        }}>
          ← Back to sign in
        </button>
      </div>
    </form>
  );
}