globalThis.Buffer = Buffer;
globalThis.global = globalThis;
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from '@/App.tsx';
import './index.css';
import { ThemeProvider } from '@/contexts/ThemeSystem.tsx';
import { Buffer } from 'buffer';
import React from 'react';
import ReactDOM from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
