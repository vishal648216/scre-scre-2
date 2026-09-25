import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import i18n from "./i18n";
import { I18nextProvider } from "react-i18next";
import React from "react";

class PublicErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error caught by PublicErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#e11d48', fontSize: '24px', fontWeight: 'bold' }}>Oops!</h1>
          <p style={{ color: '#64748b', marginTop: '10px' }}>
            Something went wrong. Please try refreshing the page.
          </p>
          {this.state.error && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f1f5f9', borderRadius: '8px', textAlign: 'left', maxWidth: '800px', margin: '20px auto', overflow: 'auto' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#ef4444' }}>{this.state.error.toString()}</p>
              {this.state.error.stack && (
                <pre style={{ margin: '10px 0 0 0', fontSize: '11px', color: '#475569', whiteSpace: 'pre-wrap' }}>{this.state.error.stack}</pre>
              )}
            </div>
          )}
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '30px', padding: '12px 24px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

class PortalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const isChunkError = error.message.includes("Failed to fetch dynamically imported module") || 
                         error.message.includes("Loading chunk") ||
                         error.message.includes("Importing a module script failed");
    
    if (isChunkError) {
      const hasReloaded = sessionStorage.getItem("portal_reload_on_error");
      if (!hasReloaded) {
        sessionStorage.setItem("portal_reload_on_error", "true");
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message.includes("Failed to fetch dynamically imported module") || 
                           this.state.error?.message.includes("Loading chunk") ||
                           this.state.error?.message.includes("Importing a module script failed");

      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#e11d48', fontSize: '24px', fontWeight: 'bold' }}>Portal Crash Detected</h1>
          <p style={{ color: '#64748b', marginTop: '10px' }}>
            {isChunkError 
              ? "A new version of the portal is available. We're refreshing your page..." 
              : "Something went wrong while loading this page."}
          </p>
          <div style={{ marginTop: '20px', padding: '15px', background: '#f1f5f9', borderRadius: '8px', textAlign: 'left', overflow: 'auto', maxHeight: '300px' }}>
            <pre style={{ margin: 0, fontSize: '12px', color: '#ef4444' }}>{this.state.error?.message}</pre>
          </div>
          <button 
            onClick={() => {
              sessionStorage.removeItem("portal_reload_on_error");
              window.location.reload();
            }}
            style={{ marginTop: '30px', padding: '12px 24px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Refresh Portal
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <PublicErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </PublicErrorBoundary>
  );
}

export { PortalErrorBoundary };
