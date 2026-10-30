import React from 'react';
import ReactDOM from 'react-dom/client';
// Fuentes incluidas en la app (sin cargar nada de internet).
import '@fontsource-variable/fraunces';
import '@fontsource-variable/manrope';
import './styles/app.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
