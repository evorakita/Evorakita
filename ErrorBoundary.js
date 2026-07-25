// ErrorBoundary.js — Global Error Boundary untuk Evora Donuts
// Mencegah seluruh aplikasi crash karena error di satu komponen

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("🔥 Evora Error Boundary:", error, errorInfo);
    
    // Kirim ke notifikasi jika ada fungsi pushNotif
    if (window.pushNotif) {
      window.pushNotif("Terjadi kesalahan. Aplikasi telah diamankan.", "warning");
    }

    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Optional: Kirim error ke server / logging service
    // fetch('/api/log-error', { method: 'POST', body: JSON.stringify({ error, errorInfo }) })
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return React.createElement("div", {
        style: {
          padding: "40px 20px",
          textAlign: "center",
          background: "#15131a",
          color: "#f3f1f7",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center"
        }
      },
        React.createElement("div", { style: { fontSize: "64px", marginBottom: "20px" } }, "⚠️"),
        React.createElement("h1", { 
          style: { fontSize: "24px", marginBottom: "12px", color: "#ff6b6b" } 
        }, "Terjadi Kesalahan"),
        
        React.createElement("p", { 
          style: { maxWidth: "420px", color: "#9d97ab", marginBottom: "30px", lineHeight: "1.5" } 
        }, 
          "Aplikasi Evora Donuts mengalami error tak terduga. Data kamu aman. Silakan muat ulang halaman."
        ),

        React.createElement("div", { style: { display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" } },
          React.createElement("button", {
            onClick: this.handleReload,
            style: {
              background: "#ff6b6b",
              color: "#1a0a0a",
              border: "none",
              padding: "14px 28px",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "15px",
              cursor: "pointer"
            }
          }, "Muat Ulang Halaman"),

          React.createElement("button", {
            onClick: this.handleReset,
            style: {
              background: "#322e3d",
              color: "#f3f1f7",
              border: "1px solid #36323f",
              padding: "14px 28px",
              borderRadius: "12px",
              fontWeight: "600",
              fontSize: "15px",
              cursor: "pointer"
            }
          }, "Coba Lagi")
        ),

        // Tampilkan detail error hanya di development
        process.env.NODE_ENV !== "production" && this.state.error && React.createElement("details", {
          style: { marginTop: "40px", maxWidth: "600px", textAlign: "left", fontSize: "13px" }
        },
          React.createElement("summary", { style: { cursor: "pointer", color: "#9d97ab" } }, "Detail Error (Developer)"),
          React.createElement("pre", { 
            style: { 
              background: "#1d1b24", 
              padding: "16px", 
              borderRadius: "8px", 
              overflow: "auto",
              fontSize: "12px",
              color: "#ff5d6c"
            } 
          }, this.state.error.toString())
        )
      );
    }

    return this.props.children;
  }
}

window.ErrorBoundary = ErrorBoundary;