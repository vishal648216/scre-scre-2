import React from "react";

export class PortalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const errorMsg = error?.message || error?.toString() || "";
    const isTransientError =
      errorMsg.includes("Failed to fetch dynamically imported module") ||
      errorMsg.includes("Loading chunk") ||
      errorMsg.includes("Importing a module script failed") ||
      errorMsg.includes("useContext") ||
      errorMsg.includes("useState") ||
      errorMsg.includes("useEffect") ||
      errorMsg.includes("Invalid hook call") ||
      errorMsg.includes("ReactCurrentDispatcher") ||
      errorMsg.includes("null (reading");

    if (isTransientError) {
      const reloadCount = parseInt(sessionStorage.getItem("portal_reload_count") || "0", 10);
      if (reloadCount < 2) {
        sessionStorage.setItem("portal_reload_count", (reloadCount + 1).toString());
        window.location.reload();
        return;
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || this.state.error?.toString() || "";
      const isTransientError =
        errorMsg.includes("Failed to fetch dynamically imported module") ||
        errorMsg.includes("Loading chunk") ||
        errorMsg.includes("Importing a module script failed") ||
        errorMsg.includes("useContext") ||
        errorMsg.includes("useState") ||
        errorMsg.includes("useEffect") ||
        errorMsg.includes("Invalid hook call") ||
        errorMsg.includes("ReactCurrentDispatcher") ||
        errorMsg.includes("null (reading");

      return (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1
            style={{ color: "#e11d48", fontSize: "24px", fontWeight: "bold" }}
          >
            Portal Recovery Mode
          </h1>
          <p style={{ color: "#64748b", marginTop: "10px" }}>
            {isTransientError
              ? "Refreshing portal components..."
              : "Something went wrong while loading this page."}
          </p>
          <div
            style={{
              marginTop: "20px",
              padding: "15px",
              background: "#f1f5f9",
              borderRadius: "8px",
              textAlign: "left",
              overflow: "auto",
              maxHeight: "300px",
            }}
          >
            <pre style={{ margin: 0, fontSize: "12px", color: "#ef4444" }}>
              {errorMsg}
            </pre>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem("portal_reload_count");
              sessionStorage.removeItem("portal_reload_on_error");
              window.location.reload();
            }}
            style={{
              marginTop: "30px",
              padding: "12px 24px",
              background: "#0f172a",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Refresh Portal
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default PortalErrorBoundary;
