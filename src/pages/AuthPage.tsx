/**
 * AuthPage.tsx — Nexus · AWS Cognito Authentication
 *
 * Imports userPool from AuthContext (single shared instance).
 * Calls onLoginSuccess() so AuthContext state updates without a page reload.
 */

import React, { useState, useEffect } from 'react';
import {
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { userPool, COGNITO_CONFIG, useAuth } from '@/contexts/AuthContext';

// ─── Error mapper ─────────────────────────────────────────────────────────────
function friendlyError(err: { code?: string; message?: string }): string {
  const map: Record<string, string> = {
    NotAuthorizedException:    'Incorrect email or password.',
    UserNotFoundException:     'No account found with that email.',
    UsernameExistsException:   'An account with this email already exists.',
    InvalidPasswordException:  'Password must be at least 8 characters and include a number.',
    CodeMismatchException:     'That verification code is incorrect.',
    ExpiredCodeException:      'That code has expired — request a new one.',
    LimitExceededException:    'Too many attempts. Please wait a moment.',
    UserNotConfirmedException: 'Please verify your email before signing in.',
    InvalidParameterException: 'Please check your input and try again.',
  };
  return (err.code && map[err.code]) || err.message || 'Something went wrong. Please try again.';
}

// ─── UI primitives ────────────────────────────────────────────────────────────

function Field({
  label, type = 'text', value, onChange, placeholder, autoComplete, error,
}: {
  label: string; type?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; autoComplete?: string; error?: string;
}) {
  const [focused,  setFocused]  = useState(false);
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
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
            color: '#94a3b8', fontSize: 12, fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {showPass ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error && <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444', fontFamily: "'DM Sans', sans-serif" }}>{error}</p>}
    </div>
  );
}

function Btn({
  children, onClick, loading, disabled, type = 'button',
}: {
  children: React.ReactNode; onClick?: () => void;
  loading?: boolean; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type={type} onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '12px 20px', border: 'none', borderRadius: 10,
        fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
        color: '#fff', cursor: loading || disabled ? 'not-allowed' : 'pointer',
        background: loading || disabled ? '#a5b4fc'
          : hovered ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
          : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        boxShadow: hovered && !disabled ? '0 8px 25px rgba(99,102,241,0.4)' : '0 2px 8px rgba(99,102,241,0.2)',
        transform: hovered && !disabled ? 'translateY(-1px)' : 'none',
        transition: 'all .2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
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

function TextBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      color: '#6366f1', fontWeight: 700, fontSize: 13,
      fontFamily: "'DM Sans', sans-serif",
    }}>
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

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>or</span>
      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div style={{ marginTop: -8, marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? colors[score] : '#e2e8f0', transition: 'background .3s' }} />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: colors[score], fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>{labels[score]} password</p>
    </div>
  );
}

function GoogleBtn({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '11px 20px', borderRadius: 10, cursor: 'pointer',
        background: hovered ? '#f8fafc' : '#fff',
        border: `1.5px solid ${hovered ? '#6366f1' : '#e2e8f0'}`,
        fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", color: '#334155',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        transition: 'all .2s',
        boxShadow: hovered ? '0 4px 12px rgba(99,102,241,0.1)' : 'none',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
      </svg>
      Continue with Google
    </button>
  );
}

// ─── Orb background ───────────────────────────────────────────────────────────
function Orbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {[
        { w:600, h:600, top:'-10%', left:'-10%', color:'rgba(99,102,241,0.15)',  anim:'nxOrb1 18s ease-in-out infinite' },
        { w:500, h:500, bottom:'-5%', right:'-5%', color:'rgba(139,92,246,0.12)', anim:'nxOrb2 22s ease-in-out infinite' },
        { w:300, h:300, top:'40%',  right:'20%', color:'rgba(79,70,229,0.1)',   anim:'nxOrb3 15s ease-in-out infinite' },
      ].map((o, i) => (
        <div key={i} style={{
          position: 'absolute', width: o.w, height: o.h, borderRadius: '50%',
          background: `radial-gradient(circle, ${o.color} 0%, transparent 70%)`,
          top: (o as any).top, left: (o as any).left, bottom: (o as any).bottom, right: (o as any).right,
          animation: o.anim,
        }} />
      ))}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(99,102,241,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.03) 1px,transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
    </div>
  );
}

// ─── Sign-in view ─────────────────────────────────────────────────────────────
function SignInView({ onForgotPassword, onSignUp }: { onForgotPassword: () => void; onSignUp: () => void }) {
  const { onLoginSuccess } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError('');

    const cognitoUser = new CognitoUser({ Username: email.trim(), Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email.trim(), Password: password });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) => {
        setLoading(false);
        onLoginSuccess(cognitoUser, session); // ← updates AuthContext → AppInner re-renders
      },
      onFailure: (err) => {
        setLoading(false);
        setError(friendlyError(err));
      },
      newPasswordRequired: () => {
        setLoading(false);
        setError('A password reset is required for this account. Please contact support.');
      },
    });
  };

  const handleGoogle = () => {
    const url =
      `${COGNITO_CONFIG.hostedUiDomain}/oauth2/authorize` +
      `?response_type=code&client_id=${COGNITO_CONFIG.ClientId}` +
      `&redirect_uri=${encodeURIComponent(COGNITO_CONFIG.redirectUri)}` +
      `&identity_provider=Google&scope=email+openid+profile`;
    window.location.href = url;
  };

  return (
    <form onSubmit={handleSubmit}>
      <GoogleBtn onClick={handleGoogle} />
      <Divider />
      <Alert message={error} type="error" />
      <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="you@company.com" autoComplete="email" />
      <Field label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Your password" autoComplete="current-password" />
      <div style={{ textAlign: 'right', marginTop: -10, marginBottom: 18 }}>
        <TextBtn onClick={onForgotPassword}>Forgot password?</TextBtn>
      </div>
      <Btn type="submit" loading={loading}>Sign in to Nexus</Btn>
      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b', fontFamily: "'DM Sans', sans-serif" }}>
        No account?{' '}<TextBtn onClick={onSignUp}>Create one free</TextBtn>
      </p>
    </form>
  );
}

// ─── Sign-up view ─────────────────────────────────────────────────────────────
function SignUpView({ onVerify, onSignIn }: { onVerify: (email: string) => void; onSignIn: () => void }) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError('');

    const attrs = [
      new CognitoUserAttribute({ Name: 'email', Value: email.trim() }),
      new CognitoUserAttribute({ Name: 'name',  Value: name.trim() }),
    ];

    userPool.signUp(email.trim(), password, attrs, [], (err) => {
      setLoading(false);
      if (err) { setError(friendlyError(err)); return; }
      onVerify(email.trim());
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Alert message={error} type="error" />
      <Field label="Full name" value={name} onChange={e => setName(e.target.value)}
        placeholder="Jane Smith" autoComplete="name" />
      <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="you@company.com" autoComplete="email" />
      <Field label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Create a strong password" autoComplete="new-password" />
      <PasswordStrength password={password} />
      <Btn type="submit" loading={loading}>Create account</Btn>
      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b', fontFamily: "'DM Sans', sans-serif" }}>
        Already have an account?{' '}<TextBtn onClick={onSignIn}>Sign in</TextBtn>
      </p>
    </form>
  );
}

// ─── Verify email view ────────────────────────────────────────────────────────
function VerifyView({ email, onSuccess, onSignIn }: { email: string; onSuccess: () => void; onSignIn: () => void }) {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [resent,  setResent]  = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('Please enter the code.'); return; }
    setLoading(true); setError('');

    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    cognitoUser.confirmRegistration(code.trim(), true, (err) => {
      setLoading(false);
      if (err) { setError(friendlyError(err)); return; }
      onSuccess();
    });
  };

  const handleResend = () => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    cognitoUser.resendConfirmationCode((err) => {
      if (!err) { setResent(true); setTimeout(() => setResent(false), 4000); }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Alert message={error} type="error" />
      {resent && <Alert message="Code resent — check your inbox." type="success" />}
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
        We sent a 6-digit code to <strong style={{ color: '#334155' }}>{email}</strong>.
      </p>
      <Field label="Verification code" value={code} onChange={e => setCode(e.target.value)}
        placeholder="123456" autoComplete="one-time-code" />
      <Btn type="submit" loading={loading}>Verify email</Btn>
      <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16 }}>
        <TextBtn onClick={handleResend}>Resend code</TextBtn>
        <span style={{ color: '#cbd5e1' }}>·</span>
        <button type="button" onClick={onSignIn} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#94a3b8', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", padding: 0 }}>
          Back to sign in
        </button>
      </div>
    </form>
  );
}

// ─── Forgot password view ─────────────────────────────────────────────────────
function ForgotView({ onSignIn }: { onSignIn: () => void }) {
  const [step,     setStep]     = useState<'request' | 'reset'>('request');
  const [email,    setEmail]    = useState('');
  const [code,     setCode]     = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email.'); return; }
    setLoading(true); setError('');
    const cognitoUser = new CognitoUser({ Username: email.trim(), Pool: userPool });
    cognitoUser.forgotPassword({
      onSuccess: () => { setLoading(false); setStep('reset'); },
      onFailure: (err) => { setLoading(false); setError(friendlyError(err)); },
    });
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError('');
    const cognitoUser = new CognitoUser({ Username: email.trim(), Pool: userPool });
    cognitoUser.confirmPassword(code.trim(), password, {
      onSuccess: () => {
        setLoading(false);
        setSuccess('Password reset! Redirecting to sign in…');
        setTimeout(onSignIn, 2000);
      },
      onFailure: (err) => { setLoading(false); setError(friendlyError(err)); },
    });
  };

  if (step === 'request') return (
    <form onSubmit={handleRequest}>
      <Alert message={error} type="error" />
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
        Enter your email and we'll send a reset code.
      </p>
      <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="you@company.com" autoComplete="email" />
      <Btn type="submit" loading={loading}>Send reset code</Btn>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button type="button" onClick={onSignIn} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#94a3b8', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", padding: 0 }}>
          ← Back to sign in
        </button>
      </div>
    </form>
  );

  return (
    <form onSubmit={handleReset}>
      <Alert message={error} type="error" />
      <Alert message={success} type="success" />
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
        Enter the code sent to <strong style={{ color: '#334155' }}>{email}</strong> and your new password.
      </p>
      <Field label="Reset code" value={code} onChange={e => setCode(e.target.value)} placeholder="123456" />
      <Field label="New password" type="password" value={password} onChange={e => setPassword(e.target.value)}
        placeholder="New strong password" autoComplete="new-password" />
      <PasswordStrength password={password} />
      <Btn type="submit" loading={loading}>Reset password</Btn>
    </form>
  );
}

// ─── Root AuthPage ────────────────────────────────────────────────────────────
type View = 'signin' | 'signup' | 'verify' | 'forgot';

const META: Record<View, { title: string; subtitle: string }> = {
  signin: { title: 'Welcome back',      subtitle: 'Sign in to your Nexus workspace' },
  signup: { title: 'Create your space', subtitle: 'Get started with Nexus for free' },
  verify: { title: 'Verify your email', subtitle: 'Almost there — one quick step' },
  forgot: { title: 'Reset password',    subtitle: "We'll get you back in seconds" },
};

export default function AuthPage() {
  // No props needed — success is handled entirely via AuthContext
  const [view,         setView]         = useState<View>('signin');
  const [pendingEmail, setPendingEmail] = useState('');
  const [visible,      setVisible]      = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    // Handle OAuth redirect code
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) console.log('OAuth code received — exchange via backend:', code);
  }, []);

  const meta = META[view];

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes nx-spin { to { transform: rotate(360deg); } }
        @keyframes nx-fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes nxOrb1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,30px) scale(1.05)} 66%{transform:translate(-20px,50px) scale(0.97)} }
        @keyframes nxOrb2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,-30px) scale(1.08)} 66%{transform:translate(30px,-50px) scale(0.95)} }
        @keyframes nxOrb3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-40px) scale(1.1)} }
        input::placeholder { color:#94a3b8; }
        button:focus-visible { outline:2px solid #6366f1; outline-offset:2px; border-radius:8px; }
      `}</style>

      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#fafafe 0%,#f1f0ff 50%,#f8f7ff 100%)',
        padding: 20, position: 'relative', fontFamily: "'DM Sans', sans-serif",
      }}>
        <Orbs />

        <div style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 420,
          animation: visible ? 'nx-fadeUp .5s cubic-bezier(.22,1,.36,1) forwards' : 'none',
          opacity: visible ? undefined : 0,
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: '#fff', border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: 16, padding: '10px 18px',
              boxShadow: '0 4px 24px rgba(99,102,241,0.12)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.68 5.17a2 2 0 0 0 1.27 1.27L20.17 11l-5.22 1.56a2 2 0 0 0-1.27 1.27L12 19l-1.68-5.17a2 2 0 0 0-1.27-1.27L3.83 11l5.22-1.56a2 2 0 0 0 1.27-1.27z"/>
                </svg>
              </div>
              <span style={{
                fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                fontFamily: "'Fraunces', serif",
              }}>Nexus</span>
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: '#fff', borderRadius: 20,
            border: '1px solid rgba(99,102,241,0.1)',
            boxShadow: '0 20px 60px rgba(99,102,241,0.12),0 4px 16px rgba(0,0,0,0.04)',
            padding: '36px 36px 32px', overflow: 'hidden', position: 'relative',
          }}>
            {/* Top accent bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: 'linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa)',
              borderRadius: '20px 20px 0 0',
            }} />

            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <h1 style={{
                fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em',
                color: '#0f172a', marginBottom: 4, margin: '0 0 4px',
                fontFamily: "'Fraunces', serif",
                fontStyle: view === 'signin' ? 'italic' : 'normal',
              }}>{meta.title}</h1>
              <p style={{ margin: 0, fontSize: 14, color: '#64748b', fontFamily: "'DM Sans', sans-serif" }}>{meta.subtitle}</p>
            </div>

            {view === 'signin' && <SignInView onForgotPassword={() => setView('forgot')} onSignUp={() => setView('signup')} />}
            {view === 'signup' && <SignUpView onVerify={email => { setPendingEmail(email); setView('verify'); }} onSignIn={() => setView('signin')} />}
            {view === 'verify' && <VerifyView email={pendingEmail} onSuccess={() => setView('signin')} onSignIn={() => setView('signin')} />}
            {view === 'forgot' && <ForgotView onSignIn={() => setView('signin')} />}
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#94a3b8', fontFamily: "'DM Sans', sans-serif" }}>
            By continuing you agree to our{' '}
            <a href="#" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>Terms</a>{' '}and{' '}
            <a href="#" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>Privacy Policy</a>.
          </p>
        </div>
      </div>
    </>
  );
}