import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { AuthProvider } from './contexts/AuthContext';
import { LiquidationProvider } from './contexts/LiquidationContext';
import { ModalProvider } from './contexts/ModalContext';
import { LoaderProvider } from './contexts/LoaderContext';
import App from './App.tsx';
import './index.css';

console.log('=== GENCREST APP STARTING ===');
console.log('Environment:', import.meta.env);

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('FATAL: Root element not found!');
  document.body.innerHTML = '<div style="padding: 20px; background: white; color: red; font-size: 24px;">ERROR: Root element not found</div>';
  throw new Error('Root element not found');
}

console.log('Root element found, initializing React...');

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', background: '#fff', minHeight: '100vh' }}>
          <h1 style={{ color: '#dc2626', marginBottom: '20px' }}>Something went wrong</h1>
          <p style={{ marginBottom: '20px' }}>The application encountered an error. Please refresh the page.</p>
          <details style={{ background: '#fee', padding: '15px', borderRadius: '5px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Error Details</summary>
            <pre style={{ marginTop: '10px', overflow: 'auto' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#f97316',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

try {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate loading={<LoadingSpinner />} persistor={persistor}>
          <BrowserRouter basename={import.meta.env.BASE_URL || '/'}>
            <AuthProvider>
              <LoaderProvider>
                <ModalProvider>
                  <LiquidationProvider>
                    <App />
                  </LiquidationProvider>
                </ModalProvider>
              </LoaderProvider>
            </AuthProvider>
          </BrowserRouter>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
  console.log('✅ App rendered successfully');
} catch (error) {
  console.error('❌ Error rendering app:', error);
  if (rootElement) {
    rootElement.innerHTML = `<div style="padding: 40px; background: white; color: red; font-size: 18px; font-family: monospace;">
      <h1 style="color: #dc2626;">Error Loading Gencrest App</h1>
      <p style="margin: 20px 0; font-size: 16px;">The application failed to initialize. Check console for details.</p>
      <pre style="background: #fee; padding: 15px; border-radius: 5px; overflow: auto;">${error instanceof Error ? error.message : String(error)}</pre>
    </div>`;
  }
}