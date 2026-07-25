// pages/OwnerSetting.js — Lazy Loaded Component
// File ini hanya dimuat ketika user membuka tab Setting

const OwnerSetting = ({ stab, setStab, pushNotif, historyMode, onHistoryModeChange, hppFocus, setHppFocus }) => {
  // Konten Setting yang berat dipindah ke sini
  return React.createElement("div", { className: "card" },
    React.createElement("h3", null, "Pengaturan"),
    React.createElement("p", { className: "info-txt" }, 
      "Komponen ini dimuat secara lazy untuk mengurangi ukuran bundle awal."
    )
    // ... (konten lengkap bisa dipindah dari app.bundle.js)
  );
};

window.OwnerSetting = OwnerSetting;