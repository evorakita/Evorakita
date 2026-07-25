// ErrorBoundary.js — Global Error Boundary untuk Evora Donuts
// Mencegah seluruh aplikasi crash karena error di satu komponen

// Fallback toast global. window.pushNotif dipanggil di sini dan di offline-sync.js,
// tapi notifikasi asli app (di dalam React tree) tidak pernah expose diri ke window,
// jadi tanpa ini panggilan pushNotif dari luar React selalu silent no-op.
if (!window.pushNotif) {
  window.pushNotif = function (msg, type) {
    var el = document.createElement("div");
    el.textContent = msg;
    var colors = { success: "#2ecc71", warning: "#f39c12", error: "#e74c3c", info: "#3498db" };
    el.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;" +
      "background:" + (colors[type] || colors.info) + ";color:#111;padding:12px 20px;" +
      "border-radius:10px;font:600 14px/1.4 sans-serif;max-width:90vw;text-align:center;" +
      "box-shadow:0 4px 16px rgba(0,0,0,.3);transition:opacity .3s;";
    document.body.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 300);
    }, 3500);
  };
}

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

        // Tampilkan detail error hanya di development.
        // Catatan: file ini dimuat sebagai plain <script> (bukan lewat bundler), jadi
        // `process` TIDAK ada di browser — memakai process.env langsung akan membuat
        // ErrorBoundary ini sendiri crash persis saat mencoba menampilkan error.
        // typeof check di bawah aman karena tidak mengakses `process` kalau belum ada.
        (typeof window.APP_CONFIG !== "undefined" && window.APP_CONFIG?.DEBUG) && this.state.error && React.createElement("details", {
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