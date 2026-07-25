// offline-sync.js — Penanganan Transaksi Kasir Secara Offline & Sync ke Supabase

const OfflineSync = {
  QUEUE_KEY: 'evora_offline_tx_queue',

  // 1. Fungsi untuk menyimpan transaksi ke antrean lokal jika offline
  saveTransactionOffline: function(transactionData) {
    let queue = [];
    try {
      const storedQueue = localStorage.getItem(this.QUEUE_KEY);
      if (storedQueue) {
        queue = JSON.parse(storedQueue);
      }
    } catch (e) {
      console.error("Gagal membaca antrean dari localStorage", e);
    }

    // Tambahkan timestamp dan penanda offline
    const newTx = {
      ...transactionData,
      _offline_id: 'off_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      _created_at_local: new Date().toISOString()
    };

    queue.push(newTx);
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    
    console.log(`[Offline Sync] Transaksi disimpan lokal. Total antrean: ${queue.length}`);
    
    // Tampilkan notifikasi jika pushNotif tersedia
    if (window.pushNotif) {
      window.pushNotif("Internet terputus. Transaksi disimpan lokal (Offline Mode).", "warning");
    }

    return newTx; // Kembalikan data agar UI bisa menganggap sukses
  },

  // 2. Fungsi untuk mengecek dan mensinkronisasikan data ke Supabase
  syncPendingTransactions: async function() {
    if (!navigator.onLine) {
      console.log("[Offline Sync] Masih offline, tidak bisa sync.");
      return;
    }

    const storedQueue = localStorage.getItem(this.QUEUE_KEY);
    if (!storedQueue) return; // Tidak ada antrean

    let queue = [];
    try {
      queue = JSON.parse(storedQueue);
    } catch (e) {
      console.error("Gagal parse antrean", e);
      return;
    }

    if (queue.length === 0) return;

    console.log(`[Offline Sync] Mencoba sync ${queue.length} transaksi...`);
    if (window.pushNotif) {
      window.pushNotif(`Mencoba sinkronisasi ${queue.length} transaksi tertunda...`, "info");
    }

    const failedQueue = [];
    let successCount = 0;

    for (let tx of queue) {
      try {
        // Hapus metadata lokal sebelum dikirim ke Supabase
        const { _offline_id, _created_at_local, ...dbData } = tx;
        
        // Asumsi: Anda menyimpan transaksi ke tabel 'transaksi_penjualan'
        // Sesuaikan nama tabel dengan struktur DB Supabase Anda
        const { data, error } = await window.sb
          .from('transaksi_penjualan')
          .insert([dbData]);

        if (error) {
          console.error(`[Offline Sync] Gagal sync tx ${_offline_id}:`, error.message);
          // Jika error karena validasi DB, mungkin mau dibuang. Tapi kita simpan dulu ke failedQueue untuk amannya
          failedQueue.push(tx); 
        } else {
          console.log(`[Offline Sync] Berhasil sync tx ${_offline_id}`);
          successCount++;
        }
      } catch (err) {
        console.error(`[Offline Sync] Network/Catastrophic error sync tx:`, err);
        failedQueue.push(tx); // Simpan kembali jika gagal karena jaringan
      }
    }

    // Perbarui localStorage dengan sisa antrean yang gagal
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(failedQueue));

    if (successCount > 0 && window.pushNotif) {
      window.pushNotif(`Berhasil sinkronisasi ${successCount} transaksi offline!`, "success");
    }
  },

  // 3. Inisialisasi Event Listener
  init: function() {
    // Jalankan sync saat aplikasi pertama kali dimuat (jika ada sisa antrean)
    setTimeout(() => this.syncPendingTransactions(), 2000);

    // Dengarkan event ketika koneksi internet kembali online
    window.addEventListener('online', () => {
      console.log("[Offline Sync] Koneksi terdeteksi KEMBALI ONLINE!");
      if (window.pushNotif) {
        window.pushNotif("Koneksi internet kembali. Memeriksa data tertunda...", "success");
      }
      this.syncPendingTransactions();
    });

    window.addEventListener('offline', () => {
      console.log("[Offline Sync] Koneksi TERPUTUS (OFFLINE).");
      if (window.pushNotif) {
        window.pushNotif("Koneksi terputus. Beralih ke Mode Offline.", "error");
      }
    });
  }
};

// Export Global
window.OfflineSync = OfflineSync;

// Inisialisasi otomatis
if (typeof window !== 'undefined') {
  window.OfflineSync.init();
}
