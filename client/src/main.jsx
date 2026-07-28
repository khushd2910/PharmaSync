import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// The browser's own automatic scroll restoration fires based on its own
// timing (before React has re-rendered the destination page), which is
// exactly what caused back navigation to sometimes land mid-page or at the
// footer. ScrollManager (in App.jsx) takes over that job explicitly, so we
// turn the native one off to avoid the two fighting each other.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
