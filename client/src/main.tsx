import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { BootstrapProvider } from './context/BootstrapContext';
import { MultiHubHomeAssistantProvider } from './context/MultiHubHomeAssistantProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <BootstrapProvider>
        <MultiHubHomeAssistantProvider>
          <App />
        </MultiHubHomeAssistantProvider>
      </BootstrapProvider>
    </AuthProvider>
  </React.StrictMode>
);
