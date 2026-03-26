// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CognitoUserPool, CognitoUser, CognitoUserSession } from 'amazon-cognito-identity-js';

// ─── Exported so AuthPage imports from here — one shared instance ─────────────
export const COGNITO_CONFIG = {
  UserPoolId: 'eu-north-1_vh9oZXfBF',
  ClientId: '2t80et0jg9316q7plf69o1ghtn',
  hostedUiDomain: 'https://eu-north-1vh9ozxfbf.auth.eu-north-1.amazoncognito.com',
  redirectUri: window.location.origin,
};

export const userPool = new CognitoUserPool({
  UserPoolId: COGNITO_CONFIG.UserPoolId,
  ClientId: COGNITO_CONFIG.ClientId,
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthContextValue {
  cognitoUser: CognitoUser | null;
  isLoading: boolean;
  userEmail: string;
  signOut: () => void;
  onLoginSuccess: (user: CognitoUser, session: CognitoUserSession) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [userEmail,   setUserEmail]   = useState('');

  // Fetch email attribute helper
  const loadEmail = (user: CognitoUser) => {
    user.getUserAttributes((err, attrs) => {
      if (!err && attrs) {
        const email = attrs.find(a => a.getName() === 'email')?.getValue() ?? '';
        setUserEmail(email);
      }
    });
  };

  // Restore existing session on mount
  useEffect(() => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) { setIsLoading(false); return; }

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (!err && session?.isValid()) {
        setCognitoUser(currentUser);
        loadEmail(currentUser);
      }
      setIsLoading(false);
    });
  }, []);

  // Called by AuthPage after a successful authenticateUser()
  const onLoginSuccess = useCallback((user: CognitoUser, session: CognitoUserSession) => {
    setCognitoUser(user);
    loadEmail(user);
  }, []);

  const signOut = useCallback(() => {
    cognitoUser?.signOut();
    setCognitoUser(null);
    setUserEmail('');
  }, [cognitoUser]);

  return (
    <AuthContext.Provider value={{ cognitoUser, isLoading, userEmail, signOut, onLoginSuccess }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}