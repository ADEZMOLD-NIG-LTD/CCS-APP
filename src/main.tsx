import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error("Root element '#root' not found in document.");
  
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (error: any) {
  console.error("FATAL: Failed to mount React application:", error);
  // Add to window so index.html diagnostic can pick it up
  (window as any).REACT_MOUNT_ERROR = error.message;
  
  // Re-throw so standard error handlers catch it
  throw error;
}
