// validation.js — Validasi Input Umum untuk Evora Donuts

const Validation = {
  // Validasi angka positif
  isPositiveNumber: (val) => {
    const num = Number(val);
    return !isNaN(num) && num > 0;
  },

  // Validasi angka >= 0
  isNonNegativeNumber: (val) => {
    const num = Number(val);
    return !isNaN(num) && num >= 0;
  },

  // Validasi tanggal (YYYY-MM-DD)
  isValidDate: (dateStr) => {
    if (!dateStr) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  },

  // Validasi email sederhana
  isValidEmail: (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(String(email).toLowerCase());
  },

  // Validasi jumlah stok / qty
  isValidQty: (qty) => {
    const num = Number(qty);
    return !isNaN(num) && num > 0 && num <= 100000; // batas wajar
  },

  // Validasi uang (maksimal 1 miliar)
  isValidAmount: (amount) => {
    const num = Number(amount);
    return !isNaN(num) && num > 0 && num <= 1000000000;
  },

  // Sanitasi string (hapus tag HTML)
  sanitizeString: (str) => {
    if (!str) return '';
    return String(str)
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim();
  },

  // Validasi password minimal
  isStrongPassword: (password) => {
    return password && password.length >= 6;
  }
};

// Export global
window.Validation = Validation;