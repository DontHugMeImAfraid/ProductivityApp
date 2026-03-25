import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeSystem.tsx';
import { hydrateStore } from './store/index.ts';

const root = createRoot(document.getElementById('root')!);

// Show a minimal spinner while we pull data from IndexedDB,
// then swap in the full app. IndexedDB reads are fast (<10 ms
// for typical data sizes) so the flash is imperceptible.
root.render(
  <div style={{
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f6f8fa',
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      border: '3px solid #e5e7eb',
      borderTopColor: '#6366f1',
      animation: 'spin 0.7s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

hydrateStore().finally(() => {
  root.render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>
  );
});