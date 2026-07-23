var EvoraDonuts = (() => {
  var { useState, useEffect, useCallback, useMemo, useRef } = React;
  var sb = window.sb;
  var APP_BOOT_ERROR = String(window.__APP_BOOT_ERROR || "").trim();

  // ─── Owner nav: dipakai bersama oleh App (sidebar) & OwnerPage (konten) ───
  var OWNER_TABS = [
    { key: "dashboard",  label: "Beranda",      icon: "\uD83D\uDCCA" },
    { key: "performaPeriode", label: "Kinerja",  icon: "\uD83D\uDCC5" },
    { key: "analisaProduk", label: "Produk",   icon: "\uD83C\uDFC6" },
    { key: "kasir",      label: "Kasir",        icon: "\uD83D\uDED2" },
    { key: "setoran",    label: "Setoran",      icon: "\uD83D\uDCB0" },
    { key: "shift",      label: "Shift Kas",    icon: "\uD83D\uDD10" },
    { key: "laporan",    label: "Laporan",      icon: "\uD83D\uDCC8" },
    { key: "absensi",    label: "Absen",        icon: "\uD83D\uDD52" },
    { key: "pengeluaran",label: "Biaya",        icon: "\uD83E\uDDFE" },
    { key: "belanja",    label: "Belanja",      icon: "\uD83D\uDED2" },
    { key: "pesanan",    label: "Pesanan",      icon: "\uD83D\uDCCB" },
    { key: "produksiCK", label: "Dapur CK",     icon: "\uD83C\uDF69" },
    { key: "stokToping", label: "Toping",       icon: "\uD83E\uDD53" },
    { key: "tutupBuku",  label: "Tutup bulan",  icon: "\uD83D\uDCD5" },
    { key: "setting",    label: "Pengaturan",   icon: "\u2699\uFE0F" },
  ];

  // ─── Navigasi berkelompok (rapi): item tunggal + grup yang bisa dibuka ───
  // Konten OwnerPage tetap pakai key yang sama — ini HANYA menata sidebar.
  var OWNER_NAV = [
    { key: "dashboard", label: "Beranda", icon: "\uD83C\uDFE0" },
    { key: "kasir", label: "Kasir", icon: "\uD83D\uDED2" },
    { group: "laporan", label: "Laporan", icon: "\uD83D\uDCCA", children: [
      { key: "performaPeriode", label: "Kinerja", icon: "\uD83D\uDCC5" },
      { key: "analisaProduk", label: "Produk terlaris", icon: "\uD83C\uDFC6" },
      { key: "laporan", label: "Laporan harian", icon: "\uD83D\uDCC8" },
      { key: "tutupBuku", label: "Tutup buku", icon: "\uD83D\uDCD5" },
    ]},
    { group: "keuangan", label: "Keuangan", icon: "\uD83D\uDCB5", children: [
      { key: "setoran", label: "Setoran", icon: "\uD83D\uDCB0" },
      { key: "shift", label: "Shift kas", icon: "\uD83D\uDD10" },
      { key: "pengeluaran", label: "Biaya", icon: "\uD83E\uDDFE" },
      { key: "pesanan", label: "Pesanan & reseller", icon: "\uD83D\uDCCB" },
    ]},
    { group: "stok", label: "Stok & Dapur", icon: "\uD83D\uDCE6", children: [
      { key: "belanja", label: "Belanja bahan", icon: "\uD83D\uDED2" },
      { key: "stokToping", label: "Stok toping", icon: "\uD83E\uDD53" },
      { key: "produksiCK", label: "Dapur CK", icon: "\uD83C\uDF69" },
    ]},
    { key: "absensi", label: "Absen", icon: "\uD83D\uDD52" },
    { key: "setting", label: "Pengaturan", icon: "\u2699\uFE0F" },
  ];
  var MANAGER_NAV = [
    { key: "dashboard", label: "Beranda", icon: "\uD83C\uDFE0" },
    { key: "kasir", label: "Kasir", icon: "\uD83D\uDED2" },
    { group: "laporan", label: "Laporan", icon: "\uD83D\uDCCA", children: [
      { key: "performaPeriode", label: "Kinerja", icon: "\uD83D\uDCC5" },
      { key: "laporan", label: "Laporan harian", icon: "\uD83D\uDCC8" },
    ]},
    { group: "keuangan", label: "Keuangan", icon: "\uD83D\uDCB5", children: [
      { key: "setoran", label: "Setoran", icon: "\uD83D\uDCB0" },
      { key: "pengeluaran", label: "Biaya", icon: "\uD83E\uDDFE" },
    ]},
    { key: "produksiCK", label: "Dapur CK", icon: "\uD83C\uDF69" },
    { key: "absensi", label: "Absen", icon: "\uD83D\uDD52" },
  ];

  // ─── Patch rpc untuk delete-user via Vercel function ───────────────────────
  try {
    const __rpc = sb.rpc.bind(sb);
    sb.rpc = async (fn, args) => {
      if (fn === "hapus_akun_langsung") {
        try {
          const { data: sessData } = await sb.auth.getSession();
          const token = sessData?.session?.access_token;
          if (!token) throw new Error("Owner harus login dulu.");
          const resp = await fetch("/api/delete-user", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(args || {})
          });
          const text = await resp.text();
          let json = null;
          try { json = JSON.parse(text); } catch {}
          if (!resp.ok) throw new Error(json?.error || text || "Gagal hapus akun.");
          return { data: json, error: null };
        } catch (e) {
          return { data: null, error: { message: e?.message || String(e) } };
        }
      }
      return __rpc(fn, args);
    };
  } catch {}

  // ─── Helpers ───────────────────────────────────────────────────────────────
  var uid = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  };

  // ─── Store (Supabase + local cache) ────────────────────────────────────────
  var S = (() => {
    const TABLE_BY_KEY = {
      branches: "branches",
      bahanPokok: "bahanPokok",
      menuVarian: "menuVarian",
      topingTambahan: "topingTambahan",
      investors: "investors",
      profiles: "profiles",
      transactions: "transactions",
      setoranHarian: "setoranHarian",
      setoranBulanan: "setoranBulanan",
      absensi: "absensi",
      absensiBulanan: "absensiBulanan",
      editLog: "editLog",
      pengeluaranLapak: "pengeluaranLapak",
      pengeluaranOwner: "pengeluaranOwner",
      produksiCK: "produksiCK",
      distribusiCK: "distribusiCK",
      stokLapak: "stokLapak",
      danaPemeliharaan: "danaPemeliharaan",
      stokTidakTerjual: "stokTidakTerjual",
      pengambilanBelanja: "pengambilanBelanja",
      gajiPembayaran: "gajiPembayaran",
      materialStockLedger: "material_stock_ledger",
      materialPurchases: "material_purchases",
      productionBatches: "production_batches",
      productionMaterialLines: "production_material_lines",
      finishedStockLedger: "finished_stock_ledger",
      stockTransfers: "stock_transfers",
      stockTransferLines: "stock_transfer_lines",
      payrollPeriods: "payroll_periods",
      payrollLines: "payroll_lines"
    };
    const LOCAL_KEYS = new Set(["notified_ids", "jadwalLibur"]);
    let cache = {};
    let channels = [];
    const listeners = new Set();
    let onError = (msg) => console.warn(msg);
    const emit = () => listeners.forEach((fn) => fn());
    const deepEq = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; } };

    const get = (k, def = null) => {
      if (LOCAL_KEYS.has(k)) {
        try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
      }
      return k in cache ? cache[k] : def;
    };

    const setLocal = (k, v) => {
      if (LOCAL_KEYS.has(k)) {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
        emit(); return;
      }
      cache[k] = v; emit();
    };

    const setErrorHandler = (fn) => { onError = typeof fn === "function" ? fn : onError; };

    // SCALE 10+ cabang/kota: master full; transaksi berjendela (default 120 hari)
    const MASTER_KEYS = new Set([
      "branches", "bahanPokok", "menuVarian", "topingTambahan", "investors",
      "stokLapak", "danaPemeliharaan"
    ]);
    const DATE_SCOPED = {
      transactions: "date", setoranHarian: "date", absensi: "date",
      pengeluaranLapak: "date", pengeluaranOwner: "date", produksiCK: "date",
      materialStockLedger: "date", materialPurchases: "date", productionBatches: "date", finishedStockLedger: "date", stockTransfers: "date",
      distribusiCK: "date", stokTidakTerjual: "date", pengambilanBelanja: "date"
    };
    const MONTH_SCOPED = {
      setoranBulanan: "bulan", absensiBulanan: "bulan", gajiPembayaran: "bulan", payrollPeriods: "bulan"
    };
    let cacheMeta = { from: null, to: null, loadedAt: null };

    const daysAgoStr = (n) => {
      try {
        const base = today();
        const d = new Date(base + "T12:00:00");
        d.setDate(d.getDate() - n);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      } catch { return "2020-01-01"; }
    };

    const loadKey = async (key, opts = {}) => {
      const table = TABLE_BY_KEY[key];
      if (!table) return;
      let q = sb.from(table).select("*");
      const from = opts.from || cacheMeta.from;
      const to = opts.to || cacheMeta.to || today();
      if (DATE_SCOPED[key] && from) {
        q = q.gte(DATE_SCOPED[key], from);
        if (to) q = q.lte(DATE_SCOPED[key], to);
      } else if (MONTH_SCOPED[key] && from) {
        q = q.gte(MONTH_SCOPED[key], String(from).slice(0, 7)).lte(MONTH_SCOPED[key], String(to || today()).slice(0, 7));
      }
      const { data, error } = await q;
      if (error) throw error;
      if (opts.merge && Array.isArray(cache[key]) && Array.isArray(data)) {
        const map = new Map(cache[key].map((r) => [r.id, r]));
        data.forEach((r) => map.set(r.id, r));
        cache[key] = [...map.values()];
      } else {
        cache[key] = data || [];
      }
    };

    const loadAll = async (opts = {}) => {
      const from = opts.from || daysAgoStr(opts.windowDays != null ? opts.windowDays : 120);
      const to = opts.to || today();
      cacheMeta = { from, to, loadedAt: new Date().toISOString() };
      const keys = Object.keys(TABLE_BY_KEY).filter((k) => k !== "profiles");
      const master = keys.filter((k) => MASTER_KEYS.has(k));
      const rest = keys.filter((k) => !MASTER_KEYS.has(k));
      await Promise.all(master.map((k) => loadKey(k, { from, to })));
      await Promise.all(rest.map((k) => loadKey(k, { from, to })));
      emit();
      return { ...cacheMeta };
    };

    const ensureRange = async (from, to) => {
      if (!from) return { ...cacheMeta };
      const needFrom = from;
      const needTo = to || today();
      let nextFrom = cacheMeta.from;
      let nextTo = cacheMeta.to || today();
      let expanded = false;
      if (!nextFrom || needFrom < nextFrom) { nextFrom = needFrom; expanded = true; }
      if (!nextTo || needTo > nextTo) { nextTo = needTo; expanded = true; }
      if (!expanded) return { ...cacheMeta };
      cacheMeta = { from: nextFrom, to: nextTo, loadedAt: new Date().toISOString() };
      const scoped = Object.keys(TABLE_BY_KEY).filter((k) => k !== "profiles" && !MASTER_KEYS.has(k));
      await Promise.all(scoped.map((k) => loadKey(k, { from: nextFrom, to: nextTo, merge: true })));
      emit();
      return { ...cacheMeta };
    };

    const applyRealtime = (key, payload) => {
      const table = TABLE_BY_KEY[key];
      if (!table) return;
      const ev = payload.eventType;
      const rowNew = payload.new;
      const rowOld = payload.old;
      const id = (rowNew && rowNew.id) || (rowOld && rowOld.id);
      if (!id) return;
      const cur = cache[key] || [];
      if (ev === "DELETE") { cache[key] = cur.filter((x) => x.id !== id); emit(); return; }
      if (ev === "INSERT") { cache[key] = [...cur.filter((x) => x.id !== id), rowNew]; emit(); return; }
      if (ev === "UPDATE") { cache[key] = cur.map((x) => x.id === id ? rowNew : x); emit(); return; }
    };

    const startRealtime = () => {
      stopRealtime();
      Object.entries(TABLE_BY_KEY).forEach(([key, table]) => {
        if (LOCAL_KEYS.has(key)) return;
        const ch = sb.channel("rt:" + table)
          .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => applyRealtime(key, payload))
          .subscribe();
        channels.push(ch);
      });
    };

    const stopRealtime = () => {
      channels.forEach((ch) => { try { sb.removeChannel(ch); } catch {} });
      channels = [];
    };

    const persistDiff = async (key, beforeArr, afterArr) => {
      const table = TABLE_BY_KEY[key];
      if (!table) return;
      const before = Array.isArray(beforeArr) ? beforeArr : [];
      const after = Array.isArray(afterArr) ? afterArr : [];
      const bMap = new Map(before.map((r) => [r.id, r]));
      const aMap = new Map(after.map((r) => [r.id, r]));
      const toInsert = [], toUpdate = [], toDelete = [];
      for (const [id, row] of aMap.entries()) {
        const prev = bMap.get(id);
        if (!prev) { toInsert.push(row); continue; }
        if (!deepEq(prev, row)) toUpdate.push(row);
      }
      for (const [id] of bMap.entries()) { if (!aMap.has(id)) toDelete.push(id); }
      if (toInsert.length) { const { error } = await sb.from(table).insert(toInsert); if (error) throw error; }
      if (toUpdate.length) { for (const row of toUpdate) { const { id, ...payload } = row; const { error } = await sb.from(table).update(payload).eq("id", id); if (error) throw error; } }
      if (toDelete.length) { const { error } = await sb.from(table).delete().in("id", toDelete); if (error) throw error; }
    };

    const set = (key, value) => {
      if (LOCAL_KEYS.has(key)) { setLocal(key, value); return; }
      const before = cache[key];
      cache[key] = value; emit();
      persistDiff(key, before, value).catch((e) => onError(e?.message || String(e)));
    };

    const reset = () => { stopRealtime(); cache = {}; emit(); };
    const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
    return { get, set, setLocal, loadAll, loadKey, ensureRange, getCacheMeta: () => ({ ...cacheMeta }), startRealtime, stopRealtime, reset, subscribe, setErrorHandler };
  })();


  // Adapter sementara untuk memastikan layar legacy membaca ledger normalized.
  // Sumber kebenaran tetap tabel baru; projection hanya bentuk data UI lama.
  var syncNormalizedOperationalState = async () => {
    try {
      const branches = S.get("branches") || [];
      const [prodRes, trRes, lineRes, payRes, payLineRes] = await Promise.all([
        sb.from("production_batches").select("*"),
        sb.from("stock_transfers").select("*"),
        sb.from("stock_transfer_lines").select("*"),
        sb.from("payroll_periods").select("*"),
        sb.from("payroll_lines").select("*")
      ]);
      if (!prodRes.error && Array.isArray(prodRes.data)) {
        S.setLocal("produksiCK", prodRes.data.map((p) => ({
          id: p.id, date: p.date, ts: p.created_at, branchId: p.branch_id,
          branchName: branches.find((b) => b.id === p.branch_id)?.name || p.branch_id,
          menuId: p.menu_id, menuNama: p.menu_name || p.menu_id,
          jumlah: p.quantity, hppTotalProduksi: p.hpp_total,
          hppPerPcs: p.quantity ? Number(p.hpp_total || 0) / Number(p.quantity) : 0,
          createdBy: p.created_by
        })));
      }
      if (!trRes.error && !lineRes.error && Array.isArray(trRes.data) && Array.isArray(lineRes.data)) {
        const transfers = Object.fromEntries((trRes.data || []).map((t) => [t.id, t]));
        const mapped = lineRes.data.map((l) => {
          const t = transfers[l.transfer_id] || {};
          const status = t.status === "completed" || t.status === "partially_received" ? "diterima" : t.status === "in_transit" ? "perjalanan" : t.status === "cancelled" ? "dibatalkan" : "pending";
          return { id: t.id + ":" + l.id, transferId: t.id, lineId: l.id, date: t.date, ts: t.created_at, produksiId: null, menuId: l.menu_id, menuNama: l.menu_id, branchId: l.to_branch_id, branchName: branches.find((b) => b.id === l.to_branch_id)?.name || l.to_branch_id, jumlahKirim: l.quantity_sent, jumlahTerima: l.quantity_good, selisih: (l.quantity_missing || 0) + (l.quantity_damaged || 0), catatanSelisih: l.note, hppPerPcs: l.unit_cost, hppTotal: Number(l.quantity_sent || 0) * Number(l.unit_cost || 0), status };
        });
        S.setLocal("distribusiCK", mapped);
      }
      if (!payRes.error && !payLineRes.error && Array.isArray(payRes.data) && Array.isArray(payLineRes.data)) {
        const periods = Object.fromEntries((payRes.data || []).map((p) => [p.id, p]));
        S.setLocal("gajiPembayaran", payLineRes.data.map((l) => ({ ...l, id: l.id, user_id: l.user_id, bulan: periods[l.payroll_id]?.bulan, jumlah: l.jumlah, gajiHarian: l.gaji_harian, hadir: l.hadir, status: periods[l.payroll_id]?.status === "paid" ? "dikonfirmasi" : "dikirim" })));
      }
    } catch (e) { /* normalized adapter is best-effort; source tables remain authoritative */ }
  };

  // ─── Formatters ────────────────────────────────────────────────────────────
  var fmtRp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

  // ─── Helper styling Excel (xlsx-js-style). Hasil tetap file .xlsx. ───────────
  // Membuat header tebal + warna, border tipis semua sel, lebar kolom otomatis,
  // dan format Rupiah untuk kolom yang namanya mengandung kata uang.
  var XLSX_HEADER_FILL = "FF6B6B";   // coral (aksen Evora)
  var _xlsxMoneyRe = /(rp|omzet|laba|modal|hpp|harga|jumlah|total|biaya|gaji|nilai|belanja|bagian|dp|setoran|bayar|pengeluaran|saldo|dibawa|jatah)/i;
  var _colLetter = (n) => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  // styleSheet(ws, { headerRows: berapa baris header di atas (default 1), money: paksa semua angka jadi Rupiah })
  var styleSheet = (ws, opts) => {
    try {
      opts = opts || {};
      if (!ws || !ws["!ref"] || typeof XLSX === "undefined" || !XLSX.utils) return ws;
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const headerRows = opts.headerRows != null ? opts.headerRows : 1;
      const border = { style: "thin", color: { rgb: "D9D2C7" } };
      const allBorder = { top: border, bottom: border, left: border, right: border };
      // lebar kolom otomatis berdasar isi terpanjang
      const widths = [];
      // deteksi kolom uang dari baris header terakhir
      const moneyCols = {};
      for (let C = range.s.c; C <= range.e.c; C++) {
        const hCell = ws[XLSX.utils.encode_cell({ r: Math.max(0, headerRows - 1), c: C })];
        const hv = hCell && hCell.v != null ? String(hCell.v) : "";
        if (opts.money || _xlsxMoneyRe.test(hv)) moneyCols[C] = true;
      }
      for (let C = range.s.c; C <= range.e.c; C++) {
        let maxLen = 8;
        for (let R = range.s.r; R <= range.e.r; R++) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (!cell) continue;
          const isHeader = R < headerRows;
          const isMoney = moneyCols[C] && !isHeader && typeof cell.v === "number";
          // format angka uang
          if (isMoney) cell.z = '#,##0';
          // styling
          cell.s = {
            font: { bold: isHeader, color: { rgb: isHeader ? "FFFFFF" : "2B2118" }, sz: isHeader ? 11 : 10 },
            fill: isHeader ? { patternType: "solid", fgColor: { rgb: XLSX_HEADER_FILL } } : undefined,
            alignment: { horizontal: (typeof cell.v === "number") ? "right" : "left", vertical: "center", wrapText: false },
            border: allBorder
          };
          const len = String(cell.v != null ? cell.v : "").length + (isMoney ? 4 : 0);
          if (len > maxLen) maxLen = len;
        }
        widths.push({ wch: Math.min(maxLen + 2, 42) });
      }
      ws["!cols"] = widths;
      // bekukan baris header supaya tetap terlihat saat scroll
      if (headerRows > 0) ws["!freeze"] = { xSplit: 0, ySplit: headerRows };
    } catch (e) { /* styling gagal tidak boleh membatalkan export */ }
    return ws;
  };
  // Pembungkus praktis: json → sheet ber-style
  var styledJsonSheet = (rows) => styleSheet(XLSX.utils.json_to_sheet(rows || []), { headerRows: 1 });

  // Sheet ringkasan vertikal yang lebih rapi di Excel mobile/desktop.
  // Format angka uang ditulis sebagai angka dengan format Rupiah, bukan teks.
  var styledSummarySheet = (rows, moneyRows = []) => {
    const ws = XLSX.utils.aoa_to_sheet(rows || []);
    try {
      if (!ws || !ws["!ref"]) return ws;
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const money = new Set(moneyRows || []);
      ws["!cols"] = [{ wch: 48 }, { wch: 24 }];
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
      for (let R = range.s.r; R <= range.e.r; R++) {
        const a = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
        const b = ws[XLSX.utils.encode_cell({ r: R, c: 1 })];
        if (a) a.s = {
          font: { bold: R === 0 || R === 4 || R === 9, color: { rgb: R === 0 ? "FFFFFF" : "2B2118" }, sz: R === 0 ? 14 : 11 },
          fill: R === 0 ? { patternType: "solid", fgColor: { rgb: "FF6B6B" } } : undefined,
          alignment: { vertical: "center", wrapText: true },
          border: { bottom: { style: "thin", color: { rgb: "E5DED5" } } }
        };
        if (b) {
          b.s = {
            font: { bold: R === 0 || R === 4 || R === 9, color: { rgb: R === 0 ? "FFFFFF" : "2B2118" }, sz: R === 0 ? 14 : 11 },
            fill: R === 0 ? { patternType: "solid", fgColor: { rgb: "FF6B6B" } } : undefined,
            alignment: { horizontal: "right", vertical: "center" },
            border: { bottom: { style: "thin", color: { rgb: "E5DED5" } } }
          };
          if (money.has(R) && typeof b.v === "number") b.z = '"Rp" #,##0;[Red]("Rp" #,##0)';
        }
      }
      ws["!rows"] = [{ hpt: 26 }];
      ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    } catch (e) { /* export tetap berjalan jika styling tidak didukung */ }
    return ws;
  };
  var fmtSelisihKas = (n) => {
    const v = Number(n || 0);
    if (Math.abs(v) < 0.5) return { text: "Pas (0)", tone: "ok", value: 0 };
    if (v > 0) return { text: "Lebih " + fmtRp(v), tone: "lebih", value: v };
    return { text: "Kurang " + fmtRp(Math.abs(v)), tone: "kurang", value: v };
  };
  var hitungSetoranKas = ({ omzet, pengeluaran, tunaiFisik, nonTunai }) => {
    const omzetN = Number(omzet || 0);
    const pengN = Number(pengeluaran || 0);
    const bersihSistem = omzetN - pengN;
    const tunai = Number(tunaiFisik || 0);
    const non = Number(nonTunai || 0);
    const totalDiterima = tunai + non;
    const selisihKas = totalDiterima - bersihSistem;
    return { omzet: omzetN, pengeluaran: pengN, bersihSistem, tunaiFisik: tunai, nonTunai: non, totalDiterima, selisihKas };
  };

  // HISTORI GAJI (app_settings key gaji_histori)
  var GAJI_HISTORI_DB_KEY = "gaji_histori";
  var gajiHistoriCache = { map: {}, loaded: false };
  var normalizeGajiHistoriMap = (raw) => {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    Object.keys(raw).forEach((uidKey) => {
      const arr = Array.isArray(raw[uidKey]) ? raw[uidKey] : [];
      out[uidKey] = arr.map((e) => ({
        id: e.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)),
        dariTanggal: String(e.dariTanggal || "").slice(0, 10),
        gajiHarian: Number(e.gajiHarian) || 0,
        ts: e.ts || null,
        note: e.note || null,
        by: e.by || null
      })).filter((e) => e.dariTanggal && /^\d{4}-\d{2}-\d{2}$/.test(e.dariTanggal))
        .sort((a, b) => a.dariTanggal.localeCompare(b.dariTanggal) || String(a.ts || "").localeCompare(String(b.ts || "")));
    });
    return out;
  };
  var getGajiHistoriAll = () => normalizeGajiHistoriMap(gajiHistoriCache.map);
  var setGajiHistoriAllLocal = (map) => {
    gajiHistoriCache.map = normalizeGajiHistoriMap(map);
    gajiHistoriCache.loaded = true;
    try { S.setLocal("notified_ids", S.get("notified_ids") || []); } catch {}
    return gajiHistoriCache.map;
  };
  var loadGajiHistoriFromDb = async () => {
    try {
      const { data, error } = await sb.from("app_settings").select("value").eq("key", GAJI_HISTORI_DB_KEY).maybeSingle();
      if (error) throw error;
      return setGajiHistoriAllLocal(data?.value || {});
    } catch {
      return getGajiHistoriAll();
    }
  };
  var saveGajiHistoriToDb = async (map) => {
    const n = normalizeGajiHistoriMap(map);
    const { error } = await sb.from("app_settings").upsert({ key: GAJI_HISTORI_DB_KEY, value: n });
    if (error) throw error;
    return setGajiHistoriAllLocal(n);
  };
  var getGajiHarianPadaTanggal = (userId, dateStr, fallbackProfil) => {
    const d = String(dateStr || today()).slice(0, 10);
    const list = (getGajiHistoriAll()[userId] || []).filter((e) => e.dariTanggal <= d);
    if (list.length) return Number(list[list.length - 1].gajiHarian) || 0;
    if (fallbackProfil != null && fallbackProfil !== "") return Number(fallbackProfil) || 0;
    const prof = (S.get("profiles") || []).find((p) => p.user_id === userId);
    return parseFloat(prof?.gajiHarian || 0) || 0;
  };
  var hitungGajiDariAbsensi = (userId, absensiRows, monthPrefix, fallbackProfil) => {
    const rows = (absensiRows || []).filter((a) => a.user_id === userId && String(a.date || "").startsWith(monthPrefix) && a.checkin_ts);
    let total = 0;
    const detail = [];
    rows.forEach((a) => {
      const rate = getGajiHarianPadaTanggal(userId, a.date, fallbackProfil);
      total += rate;
      detail.push({ date: a.date, gajiHarian: rate });
    });
    const hadir = rows.length;
    const gajiHarianTerakhir = hadir ? detail[detail.length - 1].gajiHarian : getGajiHarianPadaTanggal(userId, today(), fallbackProfil);
    return { hadir, total, gajiHarianAvg: hadir ? total / hadir : gajiHarianTerakhir, gajiHarianTerakhir, detail };
  };
  var appendGajiHistori = async (userId, { dariTanggal, gajiHarian, note, by }) => {
    const map = { ...getGajiHistoriAll() };
    const list = [...(map[userId] || [])];
    const d = String(dariTanggal || today()).slice(0, 10);
    const rate = Number(gajiHarian) || 0;
    const exIdx = list.findIndex((e) => e.dariTanggal === d);
    const entry = { id: uid(), dariTanggal: d, gajiHarian: rate, ts: nowIso(), note: note || null, by: by || null };
    if (exIdx >= 0) list[exIdx] = { ...list[exIdx], ...entry, id: list[exIdx].id };
    else list.push(entry);
    map[userId] = list;
    return saveGajiHistoriToDb(map);
  };

  var today = () => {
    // Asia/Jakarta (WIB, UTC+7) — jangan andalkan offset device user.
    try {
      return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }); // YYYY-MM-DD
    } catch {
      const d = new Date();
      d.setHours(d.getHours() + 7);
      return d.toISOString().slice(0, 10);
    }
  };
  var lastDayOfMonthStr = (bulanStr) => {
    // bulanStr: "YYYY-MM" → "YYYY-MM-DD" hari terakhir bulan itu
    const [y, m] = String(bulanStr || "").split("-").map(Number);
    if (!y || !m) return today();
    const last = new Date(y, m, 0); // day 0 of next month = last day of m
    const dd = String(last.getDate()).padStart(2, "0");
    return `${y}-${String(m).padStart(2, "0")}-${dd}`;
  };
  var monthRange = (bulanStr) => {
    const bulan = String(bulanStr || today()).slice(0, 7);
    return { from: bulan + "-01", to: lastDayOfMonthStr(bulan), bulan };
  };
  var yearRange = (tahunStr) => {
    const tahun = String(tahunStr || today()).slice(0, 4);
    return { from: tahun + "-01-01", to: tahun + "-12-31", tahun };
  };
  var startOfMonth = (dateStr) => {
    const base = dateStr || today();
    return String(base).slice(0, 7) + "-01";
  };
  var nowTs = () => new Date().toLocaleString("id-ID");
  var nowIso = () => new Date().toISOString();

  // Format tanggal modern dengan nama hari, contoh: "Senin, 25 Juni 2026"
  // Input: string "YYYY-MM-DD". Tahan terhadap input kosong/invalid.
  var formatTanggalIndo = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr + "T00:00:00");
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } catch { return dateStr; }
  };
  // Versi pendek untuk ruang sempit, contoh: "Sen, 25 Jun 2026"
  var formatTanggalIndoPendek = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr + "T00:00:00");
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    } catch { return dateStr; }
  };
  // Format bulan "YYYY-MM" jadi nama bulan, contoh: "Juni 2026"
  var formatBulanIndo = (bulanStr) => {
    if (!bulanStr) return "-";
    try {
      const d = new Date(bulanStr + "-01T00:00:00");
      if (isNaN(d.getTime())) return bulanStr;
      return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    } catch { return bulanStr; }
  };
  // Rentang minggu (Senin-Minggu) yang memuat tanggal "dateStr" (default: hari ini). Return {start, end} "YYYY-MM-DD".
  var getWeekRange = (dateStr) => {
    const base = dateStr ? new Date(dateStr + "T00:00:00") : new Date(today() + "T00:00:00");
    const dow = base.getDay(); // 0=Minggu ... 6=Sabtu
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(base); monday.setDate(base.getDate() + diffToMonday);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
    return { start: fmt(monday), end: fmt(sunday) };
  };
  // Hitung jumlah hari hadir (checkin_ts terisi) seorang user dalam rentang tanggal [start, end] inklusif.
  var hitungHadirRange = (absensiArr, userId, start, end) => {
    return (absensiArr || []).filter((a) => a.user_id === userId && a.checkin_ts && a.date >= start && a.date <= end).length;
  };

  // ─── Helper: upsert stokLapak, toleran terhadap kolom lastUpdate yang mungkin belum ada ───
  // ═══════════════════════════════════════════════════════════════════════
  // hitungBiayaCkPerCabang — pembagi gaji/biaya Central Kitchen ke cabang
  // penerima, PROPORSIONAL ke pcs yang diterima cabang itu pada tanggal yang
  // sama (bukan rata). Cabang yang libur/tidak menerima distribusi hari itu
  // otomatis dapat porsi 0 untuk hari tsb — sesuai keputusan owner.
  // Kalau ada biaya CK di suatu tanggal tapi TIDAK ada distribusi tercatat
  // hari itu (edge case), fallback ke bagi rata semua cabang non-CK supaya
  // biayanya tidak hilang begitu saja dari laporan.
  //
  // "Biaya CK" didefinisikan sebagai entri pengeluaranOwner yang branchId-nya
  // mengarah ke cabang bertipe central_kitchen — BUKAN berdasar teks kategori,
  // karena kategori "gaji_kitchen" tetap bisa dialokasikan manual ke cabang lain.
  //
  // Dipakai oleh hitungPerformaPeriode, OwnerDashboard, dan TutupBuku — SATU
  // tempat ini saja, supaya konsisten di semua laporan (lihat catatan di bawah).
  // ═══════════════════════════════════════════════════════════════════════
  function hitungBiayaCkPerCabang({ po, distribAll, branches }) {
    const cabangNonCK = (branches || []).filter((b) => b.type !== "central_kitchen");
    const ckBranchIds = new Set((branches || []).filter((b) => b.type === "central_kitchen").map((b) => b.id));
    const perBranch = {};
    cabangNonCK.forEach((b) => { perBranch[b.id] = 0; });
    const poCk = (po || []).filter((p) => p.branchId && ckBranchIds.has(p.branchId));
    const totalCk = poCk.reduce((a, p) => a + (p.jumlah || 0), 0);
    if (totalCk <= 0 || cabangNonCK.length === 0) return { totalCk: 0, perBranch, ckBranchIds };

    const ckByDate = {};
    poCk.forEach((p) => { ckByDate[p.date] = (ckByDate[p.date] || 0) + (p.jumlah || 0); });

    // Distribusi yang sudah "dibatalkan" (fitur Retur — lihat OwnerProduksiCK)
    // DIBUANG dari perhitungan proporsi: pcs itu sudah ditarik balik & tidak lagi
    // mewakili ongkos CK yang sungguhan menopang cabang tsb.
    const distribAktif = (distribAll || []).filter((d) => d.status !== "dibatalkan");
    const pcsByDateBranch = {};
    distribAktif.forEach((d) => {
      if (!perBranch.hasOwnProperty(d.branchId)) return;
      pcsByDateBranch[d.date] = pcsByDateBranch[d.date] || {};
      pcsByDateBranch[d.date][d.branchId] = (pcsByDateBranch[d.date][d.branchId] || 0) + (d.jumlahKirim || 0);
    });

    Object.entries(ckByDate).forEach(([date, ckAmount]) => {
      const pcsHariItu = pcsByDateBranch[date] || {};
      const totalPcsHariItu = Object.values(pcsHariItu).reduce((a, v) => a + v, 0);
      if (totalPcsHariItu > 0) {
        Object.entries(pcsHariItu).forEach(([bId, pcs]) => { perBranch[bId] += ckAmount * (pcs / totalPcsHariItu); });
      } else {
        const n = cabangNonCK.length;
        cabangNonCK.forEach((b) => { perBranch[b.id] += ckAmount / n; });
      }
    });

    return { totalCk, perBranch, ckBranchIds };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // hitungPerformaPeriode — SATU-SATUNYA rumus laba/rugi di seluruh app.
  // Dipakai oleh OwnerDashboard (harian), PerformaPeriode (mingguan/bulanan),
  // dan TutupBuku. JANGAN buat rumus laba kedua di tempat lain — itu persis
  // penyebab bug "laba Dashboard vs TutupBuku beda sendiri" yang sudah pernah
  // kejadian. Kalau rumus perlu berubah, ubah SATU tempat ini saja.
  //
  // Gaji Central Kitchen SUDAH ikut dibagi ke cabang di sini, lewat
  // hitungBiayaCkPerCabang() di atas — proporsional ke pcs distribusi harian.
  // ═══════════════════════════════════════════════════════════════════════
  function hitungPerformaPeriode({ txs, pL, pO, distribAll, stokTidakTerjualAll, gajiPembayaranAll, branches, investorsAll, dateFrom, dateTo, branchId, tipe }) {
    const branchesNonCK = branches.filter((b) => b.type !== "central_kitchen");
    const matchBranch = (bId) => {
      if (branchId && branchId !== "all") return bId === branchId;
      if (tipe && tipe !== "all") {
        const b = branchesNonCK.find((x) => x.id === bId);
        return b && (tipe === "investasi" ? b.type === "investasi" : b.type !== "investasi");
      }
      return true;
    };
    const branchesInScope = branchesNonCK.filter((b) => matchBranch(b.id));
    const nBranchForSplit = Math.max(branchesNonCK.length, 1);

    // Distribusi berstatus "dibatalkan" (fitur Retur) dibuang SEKALI di sini —
    // supaya tidak perlu diingat-ingat lagi di setiap turunan (fDistrib,
    // fDistribCk) di bawah. Distribusi yang diretur sudah ditarik balik
    // stoknya, jadi tidak boleh lagi dihitung sbg HPP/ongkos di laporan manapun.
    const distribAllAktif = (distribAll || []).filter((d) => d.status !== "dibatalkan");

    const fTxs = (txs || []).filter((t) => t.date >= dateFrom && t.date <= dateTo && matchBranch(t.branchId));
    const fPL = (pL || []).filter((p) => p.date >= dateFrom && p.date <= dateTo && matchBranch(p.branchId));
    const fPO = (pO || []).filter((p) => p.date >= dateFrom && p.date <= dateTo && (!p.branchId || matchBranch(p.branchId)));
    const fDistrib = distribAllAktif.filter((d) => d.date >= dateFrom && d.date <= dateTo && matchBranch(d.branchId));
    const fStokTidakTerjual = (stokTidakTerjualAll || []).filter((s) => s.date >= dateFrom && s.date <= dateTo && matchBranch(s.branchId));

    const omzet = fTxs.reduce((a, t) => a + (t.total || 0), 0);
    const hppTerjual = fTxs.reduce((a, t) => a + (t.totalHPP || 0), 0);
    const hppDistribusi = fDistrib.reduce((a, d) => a + (d.hppTotal || 0), 0);
    const hppTidakLaku = Math.max(hppDistribusi - hppTerjual, 0);
    const donatTidakTerjual = fStokTidakTerjual.reduce((a, s) => a + (s.qtyTidakTerjual || 0), 0);

    // CK split dihitung dari po/distribusi SATU BULAN PENUH tanpa filter cabang/tipe
    // dulu (fPOCk/fDistribCk), supaya proporsi pcs per cabang selalu benar walau
    // yang sedang dilihat cuma 1 cabang atau 1 tipe — baru diambil porsi yang
    // relevan untuk scope saat ini.
    const fPOCk = (pO || []).filter((p) => p.date >= dateFrom && p.date <= dateTo);
    const fDistribCk = distribAllAktif.filter((d) => d.date >= dateFrom && d.date <= dateTo);
    // BUG AUDIT (ditemukan saat verifikasi refactor #1.4): sebelumnya baris
    // ini mengirim "branchesNonCK" (cabang CK sudah dibuang duluan) ke
    // hitungBiayaCkPerCabang — padahal fungsi itu PERLU tahu cabang mana yang
    // bertipe central_kitchen (ckBranchIds) untuk bisa mendeteksi biaya CK
    // sama sekali. Efeknya: hitungPerformaPeriode (dipakai PerformaPeriode,
    // dan sekarang juga OwnerDashboard & TutupBuku) selalu menghitung gaji
    // CK = 0, membatalkan diam-diam perbaikan #1.4. Kirim "branches" APA
    // ADANYA (termasuk cabang CK) — sama seperti OwnerDashboard/TutupBuku
    // sebelum refactor, dan sama seperti hitungBiayaCkPerCabang sendiri
    // butuhkan (ia yang menyaring cabangNonCK secara internal).
    const ckSplit = hitungBiayaCkPerCabang({ po: fPOCk, distribAll: fDistribCk, branches });
    const ckShareInScope = branchesInScope.reduce((a, b) => a + (ckSplit.perBranch[b.id] || 0), 0);

    const pOGlobalTotal = fPO.filter((p) => !p.branchId).reduce((a, p) => a + (p.jumlah || 0), 0);
    const pOGlobalPerBranch = pOGlobalTotal / nBranchForSplit;
    const pOLangsungTotal = fPO.filter((p) => p.branchId && !ckSplit.ckBranchIds.has(p.branchId)).reduce((a, p) => a + (p.jumlah || 0), 0);
    const pengLangsung = fPL.reduce((a, p) => a + (p.jumlah || 0), 0) + pOLangsungTotal;
    // "Semua"/lebih dari 1 cabang dalam scope -> global dihitung penuh sekali.
    // 1 cabang spesifik -> cuma porsi bagi ratanya. Ini yang bikin kartu KPI
    // atas & tabel per-cabang selalu konsisten, tidak pernah beda sendiri.
    const isSingleBranch = branchesInScope.length === 1 && !!branchId && branchId !== "all";
    const peng = pengLangsung + (isSingleBranch ? pOGlobalPerBranch : pOGlobalTotal * (branchesInScope.length / nBranchForSplit)) + ckShareInScope;
    const laba = omzet - hppDistribusi - peng;

    const branchStats = branchesInScope.map((b) => {
      const bTx = fTxs.filter((t) => t.branchId === b.id);
      const bPLList = fPL.filter((p) => p.branchId === b.id);
      const bPL = bPLList.reduce((a, p) => a + (p.jumlah || 0), 0);
      const bPOList = fPO.filter((p) => p.branchId === b.id);
      const bPOdirect = bPOList.reduce((a, p) => a + (p.jumlah || 0), 0);
      const bGajiCk = ckSplit.perBranch[b.id] || 0;
      const bPengOwner = bPOdirect + pOGlobalPerBranch + bGajiCk;
      const bPeng = bPL + bPengOwner;
      const bO = bTx.reduce((a, t) => a + (t.total || 0), 0);
      const bHppTerjual = bTx.reduce((a, t) => a + (t.totalHPP || 0), 0);
      const bDistrib = fDistrib.filter((d) => d.branchId === b.id);
      const bHppDistrib = bDistrib.reduce((a, d) => a + (d.hppTotal || 0), 0);
      const bHppTidakLaku = Math.max(bHppDistrib - bHppTerjual, 0);
      const inv = b.type === "investasi" ? (investorsAll || []).find((i) => i.id === b.investorId) : null;
      const bLaba = bO - bHppDistrib - bPeng;
      return {
        ...b, omzet: bO, modal: bHppDistrib, hppTerjual: bHppTerjual, hppTidakLaku: bHppTidakLaku,
        peng: bPeng, pengLapak: bPL, pengLapakCount: bPLList.length,
        pengOwner: bPengOwner, pengOwnerCount: bPOList.length, pengGlobalShare: pOGlobalPerBranch, pengGajiCk: bGajiCk,
        laba: bLaba, txCount: bTx.length, distribCount: bDistrib.length,
        investorId: inv?.id || null, investorNama: inv?.nama || null, persenBagi: inv?.persenBagi || 0,
        bagianInvestor: inv ? bLaba * ((inv.persenBagi || 0) / 100) : null,
      };
    });

    const sumTipe = (t) => {
      const rows = branchStats.filter((b) => (t === "investasi" ? b.type === "investasi" : b.type !== "investasi"));
      return {
        omzet: rows.reduce((a, b) => a + b.omzet, 0), modal: rows.reduce((a, b) => a + b.modal, 0),
        peng: rows.reduce((a, b) => a + b.peng, 0), laba: rows.reduce((a, b) => a + b.laba, 0),
        txCount: rows.reduce((a, b) => a + b.txCount, 0),
      };
    };
    const totalMandiri = sumTipe("mandiri");
    const totalInvestasi = sumTipe("investasi");
    const perInvestor = (investorsAll || []).map((inv) => {
      const rows = branchStats.filter((b) => b.type === "investasi" && b.investorId === inv.id);
      return {
        investorId: inv.id, investorNama: inv.nama, persenBagi: inv.persenBagi || 0,
        cabang: rows.map((r) => r.name),
        omzet: rows.reduce((a, b) => a + b.omzet, 0), modal: rows.reduce((a, b) => a + b.modal, 0),
        pengeluaran: rows.reduce((a, b) => a + b.peng, 0),
        labaCabang: rows.reduce((a, b) => a + b.laba, 0),
        bagianInvestor: rows.reduce((a, b) => a + (b.bagianInvestor || 0), 0),
      };
    }).filter((i) => i.cabang.length > 0);

    return {
      omzet, hppTerjual, hpp: hppDistribusi, hppDistribusi, hppTidakLaku, donatTidakTerjual,
      peng, laba, labaBersih: laba, txCount: fTxs.length,
      branchStats, totalMandiri, totalInvestasi, perInvestor,
      // Ditambahkan (bukan mengubah yang sudah ada) supaya pemanggil lain
      // (OwnerDashboard, TutupBuku) bisa pakai fungsi ini APA ADANYA untuk
      // breakdown detail (kartu KPI, rincian per-kategori) tanpa perlu
      // menghitung ulang split CK/global sendiri — itu yang dulu bikin
      // rumus laba ke-copy-paste jadi 3 salinan terpisah di file ini.
      ckSplit, pOGlobalPerBranch, pOGlobalTotal, nBranchForSplit, branchesInScope,
      detail: { transaksi: fTxs, pengeluaranLapak: fPL, pengeluaranOwner: fPO, distribusiCK: fDistrib, stokTidakTerjual: fStokTidakTerjual },
    };
  }

  // ─── PerformaPeriode — viewer performa Mingguan/Bulanan/Tahunan (READ-ONLY) ─
  // Beda dari TutupBuku: ini murni untuk MELIHAT-LIHAT, tidak mengunci
  // apapun. Bisa lihat minggu/bulan/tahun manapun, termasuk yang masih berjalan.
  // Kalau periode yang dilihat kebetulan sudah pernah ditutup lewat TutupBuku
  // (Bulanan/Tahunan), angkanya seharusnya SAMA (keduanya pakai
  // hitungPerformaPeriode yang sama) — bedanya TutupBuku itu snapshot beku,
  // ini selalu hitung ulang dari data terbaru (jadi kalau periode itu masih
  // "terbuka"/belum ditutup dan datanya masih berubah, angka di sini ikut
  // berubah real-time). Catatan untuk mode Tahunan: ini menghitung LANGSUNG
  // dari data transaksi/pengeluaran mentah sepanjang tahun (live) — beda
  // sumber dari TutupBukuTahunan yang mengagregasi dari snapshot BULANAN yang
  // sudah resmi ditutup. Keduanya boleh beda sedikit kalau ada bulan yang
  // belum ditutup atau datanya berubah setelah bulan itu ditutup.
  // ─── Analisa Produk: menu terlaris & paling tidak laku (dari data transaksi) ───
  function AnalisaProduk({ pushNotif }) {
    const tick = useStoreTick ? useStoreTick() : null;
    const [granularitas, setGranularitas] = useState("bulan"); // "minggu" | "bulan" | "tahun"
    const [anchor, setAnchor] = useState(() => today());
    const [selBranch, setSelBranch] = useState("all");
    const [urut, setUrut] = useState("omzet"); // "omzet" | "qty" | "laba"

    const branches = S.get("branches") || [];

    const range = useMemo(() => {
      if (granularitas === "tahun") {
        const tahun = anchor.slice(0, 4);
        return { from: tahun + "-01-01", to: tahun + "-12-31", label: "Tahun " + tahun };
      }
      if (granularitas === "bulan") {
        const bulan = anchor.slice(0, 7);
        const from = bulan + "-01";
        const [y, m] = bulan.split("-").map(Number);
        const to = new Date(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 0).toISOString().slice(0, 10);
        return { from, to, label: "Bulan " + bulan };
      }
      const d = new Date(anchor + "T00:00:00");
      const dow = d.getDay();
      const diffToMonday = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(d); mon.setDate(d.getDate() + diffToMonday);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const from = mon.toISOString().slice(0, 10);
      const to = sun.toISOString().slice(0, 10);
      return { from, to, label: from + " – " + to };
    }, [granularitas, anchor]);

    const geser = (arah) => {
      const d = new Date(anchor + "T00:00:00");
      if (granularitas === "tahun") d.setFullYear(d.getFullYear() + arah);
      else if (granularitas === "bulan") d.setMonth(d.getMonth() + arah);
      else d.setDate(d.getDate() + arah * 7);
      setAnchor(d.toISOString().slice(0, 10));
    };

    // Agregasi penjualan per menu dari items tiap transaksi
    const analisa = useMemo(() => {
      const txs = (S.get("transactions") || []).filter((t) =>
        t.date >= range.from && t.date <= range.to &&
        (selBranch === "all" || t.branchId === selBranch)
      );
      const map = {}; // key -> { nama, qty, omzet, hpp }
      for (const t of txs) {
        for (const it of (t.items || [])) {
          const key = it.menuId || it.topingId || it.nama;
          if (!key) continue;
          if (!map[key]) map[key] = { nama: it.nama || "(tanpa nama)", qty: 0, omzet: 0, hpp: 0, tipe: it.tipe || "satuan" };
          const q = Number(it.qty) || 0;
          map[key].qty += q;
          map[key].omzet += (Number(it.hargaJual) || 0) * q;
          map[key].hpp += (Number(it.hpp) || 0) * q;
        }
      }
      let list = Object.values(map).map((r) => ({ ...r, laba: r.omzet - r.hpp }));
      // Donat tidak terjual (waste) per menu di periode ini
      const wasteAll = (S.get("stokTidakTerjual") || []).filter((s) =>
        s.date >= range.from && s.date <= range.to &&
        (selBranch === "all" || s.branchId === selBranch)
      );
      const wasteMap = {};
      for (const w of wasteAll) {
        const key = w.menuId || w.menuNama;
        if (!key) continue;
        wasteMap[key] = (wasteMap[key] || 0) + (Number(w.qtyTidakTerjual) || 0);
      }
      list.forEach((r) => { /* attach waste jika ada match by nama/menuId */ });
      list.sort((a, b) => (b[urut] || 0) - (a[urut] || 0));
      const totalOmzet = list.reduce((a, r) => a + r.omzet, 0);
      const totalQty = list.reduce((a, r) => a + r.qty, 0);
      const totalLaba = list.reduce((a, r) => a + r.laba, 0);
      const totalWaste = Object.values(wasteMap).reduce((a, n) => a + n, 0);

      // ── Glaze terlaris + estimasi pemakaian & biaya (dari penjualan) ──
      const topingDefs = S.get("topingTambahan") || [];
      const glazeDefById = {};
      topingDefs.filter((t) => t.jenis === "glaze").forEach((g) => { glazeDefById[g.id] = g; });
      const glazeMap = {}; // glazeId -> { nama, qty, gram, biaya }
      for (const t of txs) {
        for (const it of (t.items || [])) {
          if (!it.glazeId) continue;
          const g = glazeDefById[it.glazeId];
          const nama = it.glazeNama || (g ? g.nama : "Glaze");
          if (!glazeMap[it.glazeId]) glazeMap[it.glazeId] = { nama, qty: 0, gram: 0, biaya: 0 };
          const q = Number(it.qty) || 0;
          glazeMap[it.glazeId].qty += q;
          if (g && g.porsiPerPcs) {
            const gr = q * g.porsiPerPcs;
            glazeMap[it.glazeId].gram += gr;
            if (g.hargaPerSatuan != null) glazeMap[it.glazeId].biaya += gr * g.hargaPerSatuan;
          }
        }
      }
      const glazeList2 = Object.values(glazeMap).map((g) => ({ ...g, biaya: Math.round(g.biaya) })).sort((a, b) => b.qty - a.qty);
      const totalGlazeQty = glazeList2.reduce((a, g) => a + g.qty, 0);
      const totalGlazeBiaya = glazeList2.reduce((a, g) => a + g.biaya, 0);

      return { list, totalOmzet, totalQty, totalLaba, totalWaste, wasteMap, glazeList: glazeList2, totalGlazeQty, totalGlazeBiaya };
    }, [range.from, range.to, selBranch, urut, tick]);

    const maxVal = analisa.list.length ? Math.max(...analisa.list.map((r) => r[urut] || 0), 1) : 1;
    const top = analisa.list.slice(0, 10);
    const bottom = analisa.list.length > 3 ? analisa.list.slice().sort((a, b) => (a.qty || 0) - (b.qty || 0)).slice(0, 5) : [];

    const exportExcel = () => {
      try {
        if (typeof XLSX === "undefined") { pushNotif("Library Excel belum termuat.", "warning"); return; }
        const rows = analisa.list.map((r, i) => ({
          Peringkat: i + 1, Menu: r.nama, "Qty Terjual": r.qty,
          Omzet: r.omzet, "Modal (HPP)": r.hpp, "Laba Kotor": r.laba,
          "Margin %": r.omzet ? Math.round((r.laba / r.omzet) * 100) : 0,
        }));
        const ws = styledJsonSheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Analisa Produk");
        XLSX.writeFile(wb, "EvoraDonuts-AnalisaProduk-" + range.from + "_" + range.to + ".xlsx");
        pushNotif("Excel diunduh.", "success");
      } catch (e) { pushNotif("Gagal export: " + (e?.message || e), "warning"); }
    };

    const labelUrut = { omzet: "Omzet", qty: "Qty terjual", laba: "Laba kotor" };

    return React.createElement("div", { className: "card" },
      React.createElement("h3", null, "\uD83C\uDFC6 Analisa Produk"),
      React.createElement("p", { className: "info-txt", style: { marginTop: -4 } },
        "Lihat menu mana yang paling laku & paling menguntungkan, dan mana yang perlu dievaluasi."),
      React.createElement("div", { className: "tabs mb8" },
        React.createElement("button", { className: "tab" + (granularitas === "minggu" ? " active" : ""), onClick: () => setGranularitas("minggu") }, "Mingguan"),
        React.createElement("button", { className: "tab" + (granularitas === "bulan" ? " active" : ""), onClick: () => setGranularitas("bulan") }, "Bulanan"),
        React.createElement("button", { className: "tab" + (granularitas === "tahun" ? " active" : ""), onClick: () => setGranularitas("tahun") }, "Tahunan")
      ),
      React.createElement("div", { className: "filter-bar mb8", style: { alignItems: "center", flexWrap: "wrap", gap: 8 } },
        React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => geser(-1) }, "\u25C0"),
        React.createElement("strong", null, range.label),
        React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => geser(1) }, "\u25B6"),
        React.createElement("select", { className: "inp inp-sm", value: selBranch, onChange: (e) => setSelBranch(e.target.value) },
          React.createElement("option", { value: "all" }, "Semua cabang"),
          branches.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name))
        ),
        React.createElement("select", { className: "inp inp-sm", value: urut, onChange: (e) => setUrut(e.target.value) },
          React.createElement("option", { value: "omzet" }, "Urut: Omzet"),
          React.createElement("option", { value: "qty" }, "Urut: Qty terjual"),
          React.createElement("option", { value: "laba" }, "Urut: Laba")
        ),
        React.createElement("button", { className: "btn-secondary btn-sm", onClick: exportExcel }, "\u2B07 Excel")
      ),
      React.createElement("div", { className: "kpi-grid" },
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Total omzet"), React.createElement("div", { className: "kpi-val" }, fmtRp(analisa.totalOmzet))),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Total terjual"), React.createElement("div", { className: "kpi-val" }, analisa.totalQty, " pcs/box")),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Laba kotor"), React.createElement("div", { className: "kpi-val", style: { color: "var(--green)" } }, fmtRp(analisa.totalLaba))),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Tidak terjual"), React.createElement("div", { className: "kpi-val", style: { color: analisa.totalWaste > 0 ? "var(--red)" : "var(--text)" } }, analisa.totalWaste, " pcs"))
      ),
      analisa.list.length === 0
        ? React.createElement("p", { className: "info-txt", style: { marginTop: 12 } }, "Belum ada transaksi pada periode ini.")
        : React.createElement("div", { className: "mt8" },
            React.createElement("h4", null, "\uD83D\uDD1D Menu Terlaris (Top 10 \u2014 " + labelUrut[urut] + ")"),
            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 6 } },
              top.map((r, i) => {
                const val = r[urut] || 0;
                const pct = Math.max(2, Math.round((val / maxVal) * 100));
                const teks = urut === "qty" ? (r.qty + " pcs/box") : fmtRp(val);
                return React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10 } },
                  React.createElement("div", { style: { width: 20, textAlign: "right", fontWeight: 800, color: i < 3 ? "var(--accent)" : "var(--text2)" } }, (i + 1)),
                  React.createElement("div", { style: { flex: 1 } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 } },
                      React.createElement("span", { style: { fontWeight: 600 } }, r.nama),
                      React.createElement("span", { style: { color: "var(--text2)" } }, teks)
                    ),
                    React.createElement("div", { style: { height: 8, background: "var(--bg3)", borderRadius: 6, overflow: "hidden" } },
                      React.createElement("div", { style: { width: pct + "%", height: "100%", background: i < 3 ? "var(--accent)" : "var(--blue)", borderRadius: 6 } })
                    )
                  )
                );
              })
            ),
            React.createElement("div", { style: { overflowX: "auto", marginTop: 14 } },
              React.createElement("table", { className: "tbl", style: { width: "100%", fontSize: 13 } },
                React.createElement("thead", null, React.createElement("tr", null,
                  React.createElement("th", { style: { textAlign: "left" } }, "#"),
                  React.createElement("th", { style: { textAlign: "left" } }, "Menu"),
                  React.createElement("th", { style: { textAlign: "right" } }, "Qty"),
                  React.createElement("th", { style: { textAlign: "right" } }, "Omzet"),
                  React.createElement("th", { style: { textAlign: "right" } }, "Laba"),
                  React.createElement("th", { style: { textAlign: "right" } }, "Margin")
                )),
                React.createElement("tbody", null,
                  analisa.list.map((r, i) => React.createElement("tr", { key: i },
                    React.createElement("td", null, i + 1),
                    React.createElement("td", null, r.nama),
                    React.createElement("td", { style: { textAlign: "right" } }, r.qty),
                    React.createElement("td", { style: { textAlign: "right" } }, fmtRp(r.omzet)),
                    React.createElement("td", { style: { textAlign: "right", color: r.laba >= 0 ? "var(--green)" : "var(--red)" } }, fmtRp(r.laba)),
                    React.createElement("td", { style: { textAlign: "right" } }, (r.omzet ? Math.round((r.laba / r.omzet) * 100) : 0) + "%")
                  ))
                )
              )
            ),
            bottom.length > 0 && React.createElement("div", { className: "mt8", style: { border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginTop: 14 } },
              React.createElement("h4", { style: { marginTop: 0 } }, "\u26A0\uFE0F Perlu Dievaluasi (paling sedikit terjual)"),
              React.createElement("p", { className: "info-txt", style: { marginTop: -4 } }, "Menu ini paling jarang laku \u2014 pertimbangkan kurangi produksi, ganti resep, atau promo."),
              bottom.map((r, i) => React.createElement("div", { key: i, style: { display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13 } },
                React.createElement("span", null, r.nama),
                React.createElement("span", { style: { color: "var(--text2)" } }, r.qty + " terjual \u00B7 " + fmtRp(r.omzet))
              ))
            ),
            analisa.glazeList && analisa.glazeList.length > 0 && React.createElement("div", { className: "mt8", style: { borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 14 } },
              React.createElement("h4", null, "\uD83E\uDED4 Glaze Terlaris"),
              React.createElement("p", { className: "info-txt", style: { marginTop: -4 } }, "Dari pilihan glaze di kasir. Pemakaian & biaya dihitung otomatis dari porsi standar."),
              React.createElement("div", { style: { overflowX: "auto" } },
                React.createElement("table", { className: "tbl", style: { width: "100%", fontSize: 13 } },
                  React.createElement("thead", null, React.createElement("tr", null,
                    React.createElement("th", { style: { textAlign: "left" } }, "Glaze"),
                    React.createElement("th", { style: { textAlign: "right" } }, "Terjual"),
                    React.createElement("th", { style: { textAlign: "right" } }, "Pemakaian"),
                    React.createElement("th", { style: { textAlign: "right" } }, "Est. biaya")
                  )),
                  React.createElement("tbody", null,
                    analisa.glazeList.map((g, i) => React.createElement("tr", { key: i },
                      React.createElement("td", null, g.nama),
                      React.createElement("td", { style: { textAlign: "right", fontWeight: i === 0 ? 800 : 400, color: i === 0 ? "var(--accent)" : "var(--text)" } }, g.qty + " pcs"),
                      React.createElement("td", { style: { textAlign: "right" } }, g.gram > 0 ? Math.round(g.gram) : "-"),
                      React.createElement("td", { style: { textAlign: "right", color: "var(--accent)" } }, g.biaya > 0 ? fmtRp(g.biaya) : "-")
                    )).concat([
                      React.createElement("tr", { key: "tg", style: { borderTop: "2px solid var(--border)", fontWeight: 800 } },
                        React.createElement("td", null, "TOTAL"),
                        React.createElement("td", { style: { textAlign: "right" } }, analisa.totalGlazeQty + " pcs"),
                        React.createElement("td", null, ""),
                        React.createElement("td", { style: { textAlign: "right", color: "var(--green)" } }, analisa.totalGlazeBiaya > 0 ? fmtRp(analisa.totalGlazeBiaya) : "-")
                      )
                    ])
                  )
                )
              )
            )
          )
    );
  }

   function PerformaPeriode({ pushNotif }) {
     const [granularitas, setGranularitas] = useState("bulan"); // "minggu" | "bulan" | "tahun"
    const [anchor, setAnchor] = useState(() => today());
    const [tipe, setTipe] = useState("all"); // "all" | "mandiri" | "investasi"

    const branches = S.get("branches") || [];
    const investorsAll = S.get("investors") || [];

    const range = useMemo(() => {
      if (granularitas === "tahun") {
        const tahun = anchor.slice(0, 4);
        return { from: tahun + "-01-01", to: tahun + "-12-31", label: "Tahun " + tahun };
      }
      if (granularitas === "bulan") {
        const bulan = anchor.slice(0, 7);
        const from = bulan + "-01";
        const [y, m] = bulan.split("-").map(Number);
        const to = new Date(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 0).toISOString().slice(0, 10);
        return { from, to, label: "Bulan " + bulan };
      }
      // Minggu: Senin s/d Minggu dari tanggal anchor
      const d = new Date(anchor + "T00:00:00");
      const dow = d.getDay(); // 0=Minggu
      const diffToMonday = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(d); mon.setDate(d.getDate() + diffToMonday);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const from = mon.toISOString().slice(0, 10);
      const to = sun.toISOString().slice(0, 10);
      return { from, to, label: formatTanggalIndoPendek(from) + " – " + formatTanggalIndoPendek(to) };
    }, [granularitas, anchor]);

    const geser = (arah) => {
      const d = new Date(anchor + "T00:00:00");
      if (granularitas === "tahun") d.setFullYear(d.getFullYear() + arah);
      else if (granularitas === "bulan") d.setMonth(d.getMonth() + arah);
      else d.setDate(d.getDate() + arah * 7);
      setAnchor(d.toISOString().slice(0, 10));
    };

    const hasil = useMemo(() => hitungPerformaPeriode({
      txs: S.get("transactions") || [],
      pL: S.get("pengeluaranLapak") || [],
      pO: S.get("pengeluaranOwner") || [],
      distribAll: S.get("distribusiCK") || [],
      stokTidakTerjualAll: S.get("stokTidakTerjual") || [],
      branches, investorsAll,
      dateFrom: range.from, dateTo: range.to, branchId: "all", tipe,
    }), [range.from, range.to, tipe, branches.length, investorsAll.length]);

    return React.createElement("div", { className: "card" },
      React.createElement("h3", null, "Performa " + (granularitas === "tahun" ? "Tahunan" : granularitas === "bulan" ? "Bulanan" : "Mingguan")),
      React.createElement("div", { className: "tabs mb8" },
        React.createElement("button", { className: "tab" + (granularitas === "minggu" ? " active" : ""), onClick: () => setGranularitas("minggu") }, "Mingguan"),
        React.createElement("button", { className: "tab" + (granularitas === "bulan" ? " active" : ""), onClick: () => setGranularitas("bulan") }, "Bulanan"),
        React.createElement("button", { className: "tab" + (granularitas === "tahun" ? " active" : ""), onClick: () => setGranularitas("tahun") }, "Tahunan")
      ),
      React.createElement("div", { className: "filter-bar mb8", style: { alignItems: "center" } },
        React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => geser(-1) }, "◀"),
        React.createElement("strong", null, range.label),
        React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => geser(1) }, "▶"),
        React.createElement("select", { className: "inp inp-sm", value: tipe, onChange: (e) => setTipe(e.target.value) },
          React.createElement("option", { value: "all" }, "Semua cabang"),
          React.createElement("option", { value: "mandiri" }, "Cabang Mandiri"),
          React.createElement("option", { value: "investasi" }, "Cabang Investasi")
        )
      ),
      React.createElement("div", { className: "kpi-grid" },
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Penjualan"), React.createElement("div", { className: "kpi-val" }, fmtRp(hasil.omzet))),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Modal bahan"), React.createElement("div", { className: "kpi-val" }, fmtRp(hasil.hpp))),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Biaya"), React.createElement("div", { className: "kpi-val" }, fmtRp(hasil.peng))),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Laba Bersih"), React.createElement("div", { className: "kpi-val", style: { color: hasil.laba >= 0 ? "var(--green)" : "var(--red)" } }, fmtRp(hasil.laba))),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Donat dibuang (rugi)"), React.createElement("div", { className: "kpi-val" }, hasil.donatTidakTerjual, " pcs"))
      ),
      tipe === "all" && React.createElement("div", { className: "mt8", style: { border: "1px solid var(--border)", borderRadius: 8, padding: 10 } },
        React.createElement("p", null, "Laba Cabang Mandiri: ", React.createElement("strong", null, fmtRp(hasil.totalMandiri.laba))),
        React.createElement("p", null, "Laba Cabang Investasi (sebelum bagi hasil): ", React.createElement("strong", null, fmtRp(hasil.totalInvestasi.laba)))
      ),
      hasil.perInvestor.length > 0 && React.createElement("div", { className: "mt8" },
        React.createElement("h4", null, "Bagian per Investor"),
        hasil.perInvestor.map((inv) => React.createElement("div", { key: inv.investorId, style: { display: "flex", justifyContent: "space-between", padding: "4px 0" } },
          React.createElement("span", null, inv.investorNama, " (", inv.persenBagi, "%)"),
          React.createElement("strong", null, fmtRp(inv.bagianInvestor))
        ))
      ),
      React.createElement("div", { className: "mt8" },
        React.createElement("h4", null, "Per Cabang"),
        hasil.branchStats.map((b) => React.createElement("div", { key: b.id, style: { display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" } },
          React.createElement("span", null, b.name, " ", b.type === "investasi" ? "(Investasi)" : "(Mandiri)"),
          React.createElement("span", null, "Omzet ", fmtRp(b.omzet), " · Laba ", fmtRp(b.laba))
        ))
      )
    );
  }

  var upsertStokLapak = async (branchId, menuId, newStok, existingRow) => {
    const payloadFull = { stok: newStok, lastUpdate: nowIso() };
    const payloadBasic = { stok: newStok };
    let res;
    if (existingRow) {
      res = await sb.from("stokLapak").update(payloadFull).eq("id", existingRow.id);
      if (res.error && /lastUpdate|column/i.test(res.error.message || "")) {
        res = await sb.from("stokLapak").update(payloadBasic).eq("id", existingRow.id);
      }
    } else {
      res = await sb.from("stokLapak").insert([{ id: uid(), branchId, menuId, ...payloadFull }]);
      if (res.error && /lastUpdate|column/i.test(res.error.message || "")) {
        res = await sb.from("stokLapak").insert([{ id: uid(), branchId, menuId, ...payloadBasic }]);
      }
    }
    if (res.error) throw res.error;
    return res;
  };
  // tsForDate / isoForDate: pakai TANGGAL dari date yang dipilih + JAM sekarang
  // Supaya input data tanggal lalu tetap tercatat di tanggal yang benar
  var tsForDate = (date) => {
    if (!date) return nowTs();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    // Bangun string tampilan langsung: "dd/mm/yyyy, HH.MM.SS"
    const parts = date.split("-"); // ["yyyy", "mm", "dd"]
    if (parts.length !== 3) return nowTs();
    const dd = parts[2], mm = parts[1], yyyy = parts[0];
    const HH = pad(now.getHours());
    const MM = pad(now.getMinutes());
    const SS = pad(now.getSeconds());
    return `${dd}/${mm}/${yyyy}, ${HH}.${MM}.${SS}`;
  };
  var isoForDate = (date) => {
    if (!date) return nowIso();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const HH = pad(now.getHours());
    const MM = pad(now.getMinutes());
    const SS = pad(now.getSeconds());
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    // Offset WIB +07:00
    return `${date}T${HH}:${MM}:${SS}.${ms}+07:00`;
  };
  var fmtTs = (v) => { if (!v) return "-"; try { return new Date(v).toLocaleString("id-ID"); } catch { return String(v); } };
  // fmtTxTs: tampilkan timestamp struk dengan TANGGAL dari tx.date (selalu benar)
  // + JAM dari tx.ts. Ini fix untuk data lama yang tersimpan dengan tanggal salah.
  var fmtTxTs = (tx) => {
    if (!tx) return "-";
    const date = tx.date; // "yyyy-mm-dd" — selalu benar
    const ts = tx.ts || "";  // "dd/mm/yyyy, HH.MM.SS" atau format lain
    if (!date) return ts || "-";
    // Ekstrak jam dari ts — cari pola HH.MM.SS atau HH:MM:SS
    const jamMatch = ts.match(/(\d{1,2})[.:](\d{2})[.:](\d{2})/);
    const jam = jamMatch ? `${jamMatch[1]}.${jamMatch[2]}.${jamMatch[3]}` : "";
    // Format tanggal dari date "yyyy-mm-dd" → "dd/mm/yyyy"
    const parts = date.split("-");
    if (parts.length !== 3) return ts || date;
    const tglStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
    return jam ? `${tglStr}, ${jam}` : tglStr;
  };

  // ─── Branding / Assets ─────────────────────────────────────────────────────
  var getAssetBucket = () => String(window.APP_CONFIG?.SUPABASE_ASSET_BUCKET || "").trim();
  var getBrandLogo = () => { try { return localStorage.getItem("branding_logo_url") || "./logo.jpg"; } catch { return "./logo.jpg"; } };
  var setBrandLogoLocal = (url) => { try { if (url) localStorage.setItem("branding_logo_url", url); } catch {} };
  var HISTORY_MODE_STORAGE_KEY = "history_mode_config";
  var HISTORY_MODE_DB_KEY = "history_mode";
  var JADWAL_LIBUR_DB_KEY = "jadwal_libur";
  var JADWAL_LIBUR_ALLOWED_DAYS = new Set(["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]);
  var isActiveProfile = (profile) => !!profile && profile.role !== "none" && profile.status !== "deleted" && profile.aktif !== false && !profile.deleted_at && !profile.deletedAt;
  // ─── Area Manager (multi-kota scale) ─────────────────────────────────────
  // profile.role === "manager"
  // profile.cities = ["Karawang","Bandung"]  (atau profile.city string tunggal)
  var normalizeCities = (v) => {
    if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
    if (typeof v === "string" && v.trim()) {
      return v.split(",").map((x) => x.trim()).filter(Boolean);
    }
    return [];
  };
  var getProfileCities = (profile) => {
    if (!profile) return [];
    const fromArr = normalizeCities(profile.cities);
    if (fromArr.length) return fromArr;
    if (profile.city) return normalizeCities(profile.city);
    return [];
  };
  var isAreaManager = (profile) => !!profile && (profile.role === "manager" || profile.role === "area_manager");
  var isOwnerRole = (profile) => !!profile && profile.role === "owner";
  var isStaffAdmin = (profile) => isOwnerRole(profile) || isAreaManager(profile);
  var branchInCities = (branch, cities) => {
    if (!cities || !cities.length) return false;
    const bc = String(branch?.city || "").trim();
    if (!bc) return false;
    return cities.some((c) => c.toLowerCase() === bc.toLowerCase());
  };
  var filterBranchesForProfile = (branches, profile) => {
    const list = Array.isArray(branches) ? branches : [];
    if (isOwnerRole(profile)) return list;
    if (isAreaManager(profile)) {
      const cities = getProfileCities(profile);
      // CK global tetap terlihat agar distribusi/rumus CK tidak putus; cabang non-CK difilter kota
      return list.filter((b) => b.type === "central_kitchen" || branchInCities(b, cities));
    }
    if (profile?.role === "worker" && profile.branchId) {
      return list.filter((b) => b.id === profile.branchId || b.type === "central_kitchen");
    }
    return list;
  };
  var canAccessBranchId = (branchId, profile, branches) => {
    if (!branchId) return isOwnerRole(profile);
    if (isOwnerRole(profile)) return true;
    const b = (branches || S.get("branches") || []).find((x) => x.id === branchId);
    if (!b) return false;
    if (isAreaManager(profile)) return b.type === "central_kitchen" || branchInCities(b, getProfileCities(profile));
    if (profile?.role === "worker") return profile.branchId === branchId;
    return false;
  };
  // Tab yang boleh dibuka Area Manager (bukan full owner)
  var MANAGER_TABS = [
    { key: "dashboard", label: "Beranda", icon: "📊" },
    { key: "performaPeriode", label: "Kinerja", icon: "📅" },
    { key: "kasir", label: "Kasir", icon: "🛒" },
    { key: "setoran", label: "Setoran", icon: "💰" },
    { key: "laporan", label: "Laporan", icon: "📈" },
    { key: "absensi", label: "Absen", icon: "🕒" },
    { key: "pengeluaran", label: "Biaya", icon: "🧾" },
    { key: "produksiCK", label: "Dapur CK", icon: "🍩" },
  ];
  // Cek apakah setoran harian cabang+tanggal tertentu sudah dikonfirmasi & dikunci
  // owner. Dipakai untuk menahan tombol "Edit Transaksi" supaya laporan yang
  // sudah dikunci tidak diam-diam berubah tanpa proses buka-kunci eksplisit.
  var isSetoranLocked = (branchId, date) => (S.get("setoranHarian") || []).some((s) => s.branchId === branchId && s.date === date && s.locked);
  var getHistoryModeDefault = () => ({ enabled: false, scope: "global", branchIds: [] });
  var getJadwalLiburDefault = () => ({});
  var normalizeJadwalLibur = (value) => {
    const raw = value && typeof value === "object" ? value : {};
    return Object.fromEntries(
      Object.entries(raw)
        .map(([userId, hari]) => [String(userId || "").trim(), String(hari || "").trim()])
        .filter(([userId, hari]) => userId && (!hari || JADWAL_LIBUR_ALLOWED_DAYS.has(hari)))
    );
  };
  var getJadwalLiburLocal = () => {
    try { return normalizeJadwalLibur(JSON.parse(localStorage.getItem("jadwalLibur") || "null")); }
    catch { return getJadwalLiburDefault(); }
  };
  var setJadwalLiburLocal = (value) => {
    const cfg = normalizeJadwalLibur(value);
    try { localStorage.setItem("jadwalLibur", JSON.stringify(cfg)); } catch {}
    return cfg;
  };
  var normalizeHistoryMode = (value) => {
    const raw = value && typeof value === "object" ? value : {};
    const scope = raw.scope === "selected" ? "selected" : "global";
    const branchIds = Array.from(new Set((Array.isArray(raw.branchIds) ? raw.branchIds : []).map((x) => String(x || "").trim()).filter(Boolean)));
    return { enabled: !!raw.enabled, scope, branchIds };
  };
  var getHistoryModeLocal = () => {
    try { return normalizeHistoryMode(JSON.parse(localStorage.getItem(HISTORY_MODE_STORAGE_KEY) || "null")); }
    catch { return getHistoryModeDefault(); }
  };
  var setHistoryModeLocal = (value) => {
    const cfg = normalizeHistoryMode(value);
    try { localStorage.setItem(HISTORY_MODE_STORAGE_KEY, JSON.stringify(cfg)); } catch {}
    return cfg;
  };
  var syncHistoryModeFromDb = async () => {
    try {
      const { data, error } = await sb.from("app_settings").select("value").eq("key", HISTORY_MODE_DB_KEY).maybeSingle();
      if (error) throw error;
      return setHistoryModeLocal(data?.value || getHistoryModeDefault());
    } catch {
      return getHistoryModeLocal();
    }
  };
  var saveHistoryModeToDb = async (value) => {
    const cfg = normalizeHistoryMode(value);
    const { error } = await sb.from("app_settings").upsert({ key: HISTORY_MODE_DB_KEY, value: cfg });
    if (error) throw error;
    return setHistoryModeLocal(cfg);
  };
  var syncJadwalLiburFromDb = async () => {
    try {
      const { data, error } = await sb.from("app_settings").select("value").eq("key", JADWAL_LIBUR_DB_KEY).maybeSingle();
      if (error) throw error;
      return setJadwalLiburLocal(data?.value || getJadwalLiburDefault());
    } catch {
      return getJadwalLiburLocal();
    }
  };
  var saveJadwalLiburToDb = async (value) => {
    const cfg = normalizeJadwalLibur(value);
    const { error } = await sb.from("app_settings").upsert({ key: JADWAL_LIBUR_DB_KEY, value: cfg });
    if (error) throw error;
    return setJadwalLiburLocal(cfg);
  };
  var isHistoryModeAllowedForBranch = (value, branchId) => {
    const cfg = normalizeHistoryMode(value);
    if (!cfg.enabled) return false;
    if (cfg.scope === "global") return true;
    return !!branchId && cfg.branchIds.includes(branchId);
  };
  var syncBrandingFromDb = async () => {
    try {
      const { data, error } = await sb.from("app_settings").select("value").eq("key", "branding").maybeSingle();
      if (error) throw error;
      const logoUrl = data?.value?.logoUrl;
      if (logoUrl) setBrandLogoLocal(logoUrl);
      return logoUrl || null;
    } catch { return null; }
  };
  // ─── Kompres gambar sebelum upload Supabase (hemat storage) ─────────────
  // Target default ~400KB, max sisi 1600px, output JPEG. Non-gambar dilewati.
  var isImageFile = (file) => {
    if (!file) return false;
    const t = String(file.type || "").toLowerCase();
    if (t.startsWith("image/")) return t !== "image/svg+xml" && t !== "image/gif"; // gif animasi: jangan re-encode
    const n = String(file.name || "").toLowerCase();
    return /\.(jpe?g|png|webp|bmp|heic|heif)$/i.test(n);
  };

  var loadImageElement = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gagal membaca gambar. Coba format JPG/PNG.")); };
    img.src = url;
  });

  var canvasToBlob = (canvas, type, quality) => new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });

  /**
   * compressImageFile(file, opts?)
   * opts: maxEdge (px), maxBytes, minQuality, startQuality
   * return: { file, blob, compressed, originalBytes, finalBytes, width, height, quality }
   */
  var compressImageFile = async (file, opts = {}) => {
    const maxEdge = opts.maxEdge != null ? opts.maxEdge : 1600;
    const maxBytes = opts.maxBytes != null ? opts.maxBytes : 400 * 1024; // 400KB
    const minQuality = opts.minQuality != null ? opts.minQuality : 0.45;
    let quality = opts.startQuality != null ? opts.startQuality : 0.78;
    const originalBytes = file.size || 0;

    // File kecil & sudah jpeg: biarkan (tetap resize kalau terlalu besar dimensi)
    try {
      const img = await loadImageElement(file);
      let w = img.naturalWidth || img.width || 1;
      let h = img.naturalHeight || img.height || 1;
      const scale = Math.min(1, maxEdge / Math.max(w, h));
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement("canvas");
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Canvas tidak tersedia di browser ini.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tw, th);
      ctx.drawImage(img, 0, 0, tw, th);

      let blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (!blob) throw new Error("Gagal kompres gambar.");

      // Turunkan quality bertahap sampai di bawah maxBytes (atau minQuality)
      let guard = 0;
      while (blob.size > maxBytes && quality > minQuality && guard < 10) {
        quality = Math.max(minQuality, quality - 0.08);
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
        guard++;
      }
      // Kalau masih terlalu besar, perkecil dimensi sekali lagi
      if (blob.size > maxBytes && Math.max(tw, th) > 900) {
        const scale2 = 900 / Math.max(tw, th);
        const tw2 = Math.max(1, Math.round(tw * scale2));
        const th2 = Math.max(1, Math.round(th * scale2));
        canvas.width = tw2;
        canvas.height = th2;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tw2, th2);
        ctx.drawImage(img, 0, 0, tw2, th2);
        quality = Math.min(quality, 0.7);
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
        w = tw2; h = th2;
        while (blob.size > maxBytes && quality > minQuality && guard < 16) {
          quality = Math.max(minQuality, quality - 0.07);
          blob = await canvasToBlob(canvas, "image/jpeg", quality);
          guard++;
        }
      } else {
        w = tw; h = th;
      }

      // Jangan gembungkan file kecil: pakai yang lebih hemat
      if (blob.size >= originalBytes && scale >= 1 && (file.type || "").includes("jpeg")) {
        return {
          file,
          blob: file,
          compressed: false,
          originalBytes,
          finalBytes: originalBytes,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          quality: null,
          keptOriginal: true
        };
      }

      const base = String(file.name || "foto").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "-") || "foto";
      const outName = base + ".jpg";
      let outFile;
      try {
        outFile = new File([blob], outName, { type: "image/jpeg", lastModified: Date.now() });
      } catch {
        // WebView lama tanpa constructor File
        outFile = blob;
        try { outFile.name = outName; } catch {}
        try { outFile.lastModified = Date.now(); } catch {}
      }
      // Jika hasil kompres malah lebih besar, unggah asli
      if ((outFile.size || blob.size) >= originalBytes && originalBytes > 0) {
        return {
          file,
          blob: file,
          compressed: false,
          originalBytes,
          finalBytes: originalBytes,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          quality: null,
          keptOriginal: true
        };
      }
      return {
        file: outFile,
        blob,
        compressed: true,
        originalBytes,
        finalBytes: outFile.size || blob.size,
        width: w,
        height: h,
        quality
      };
    } catch (e) {
      // Fallback: upload file asli jika browser gagal decode (mis. HEIC di desktop)
      return {
        file,
        blob: file,
        compressed: false,
        originalBytes,
        finalBytes: originalBytes,
        width: null,
        height: null,
        quality: null,
        error: e?.message || String(e)
      };
    }
  };

  var formatBytes = (n) => {
    const x = Number(n) || 0;
    if (x < 1024) return x + " B";
    if (x < 1024 * 1024) return (x / 1024).toFixed(0) + " KB";
    return (x / (1024 * 1024)).toFixed(2) + " MB";
  };


  // ─── Kasir pintar: offline queue + struk + label bayar ─────────────────
  var TX_OFFLINE_KEY = "donatboss_tx_offline_queue";
  var getOfflineTxQueue = () => {
    try { const arr = JSON.parse(localStorage.getItem(TX_OFFLINE_KEY) || "[]"); return Array.isArray(arr) ? arr : []; }
    catch { return []; }
  };
  var setOfflineTxQueue = (arr) => {
    try { localStorage.setItem(TX_OFFLINE_KEY, JSON.stringify(arr || [])); } catch {}
    try { S.setLocal("notified_ids", S.get("notified_ids") || []); } catch {}
  };
  var enqueueOfflineTx = (payload) => {
    const q = getOfflineTxQueue();
    q.push({ ...payload, queuedAt: new Date().toISOString(), status: "pending" });
    setOfflineTxQueue(q);
    return q.length;
  };
  var isProbablyOffline = () => {
    try { return typeof navigator !== "undefined" && navigator.onLine === false; } catch { return false; }
  };
  var bayarLabel = (m) => ({ tunai: "Tunai", qris: "QRIS", transfer: "Transfer", campuran: "Campuran" }[m] || m || "Tunai");
  var escapeHtml = (s) => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  var fmtRpPlain = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
  var buildReceiptText = (tx, branchName) => {
    const items = tx.items || [];
    const lines = [];
    lines.push("EVORA DONUTS");
    if (branchName) lines.push(String(branchName));
    lines.push((tx.date || "") + " " + String(tx.ts || "").slice(11, 19));
    lines.push("------------------------------");
    items.forEach((it) => {
      lines.push(String(it.nama || "") + " x" + it.qty);
      lines.push("  " + fmtRpPlain((it.hargaJual || 0) * (it.qty || 0)));
    });
    lines.push("------------------------------");
    if (tx.diskon > 0) {
      lines.push("Subtotal  " + fmtRpPlain(tx.subtotal != null ? tx.subtotal : (tx.total + tx.diskon)));
      lines.push("Diskon  -" + fmtRpPlain(tx.diskon));
    }
    lines.push("TOTAL  " + fmtRpPlain(tx.total));
    lines.push("Bayar  " + bayarLabel(tx.metodeBayar));
    if (tx.metodeBayar === "campuran") {
      lines.push("Tunai  " + fmtRpPlain(tx.jumlahBayar));
      lines.push("Non-tunai " + fmtRpPlain(tx.nonTunaiBayar));
    }
    if (tx.metodeBayar === "tunai" || tx.metodeBayar === "campuran") {
      lines.push("Diterima " + fmtRpPlain(tx.jumlahBayar));
      lines.push("Kembali " + fmtRpPlain(tx.kembalian));
    }
    lines.push("No " + String(tx.id || "").slice(0, 8).toUpperCase());
    if (tx.offlineQueued) lines.push("(antrian offline)");
    lines.push("Terima kasih");
    return lines.join("\n");
  };
  var buildReceiptHtml = (tx, branchName, opts = {}) => {
    const auto = opts.autoPrint !== false;
    const items = tx.items || [];
    const rows = items.map((it) =>
      "<tr><td class=\"item\">" + escapeHtml(it.nama) + " x" + it.qty + "</td>"
      + "<td class=\"price\">" + Number((it.hargaJual || 0) * (it.qty || 0)).toLocaleString("id-ID") + "</td></tr>"
    ).join("");
    const metode = bayarLabel(tx.metodeBayar);
    const bayar = Number(tx.jumlahBayar || 0);
    const kembali = Number(tx.kembalian || 0);
    const nonTunai = Number(tx.nonTunaiBayar || 0);
    const jam = String(tx.ts || "").slice(11, 19);
    return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>"
      + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>"
      + "<title>Struk " + escapeHtml(String(tx.id || "").slice(0, 8)) + "</title><style>"
      + "*{box-sizing:border-box}body{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;"
      + "width:280px;max-width:100%;margin:0 auto;padding:12px 10px 16px;color:#000;background:#fff}"
      + "h1{font-size:15px;margin:0 0 2px;text-align:center;letter-spacing:.04em}"
      + ".sub{text-align:center;font-size:11px;margin:0 0 8px;line-height:1.35}"
      + "table{width:100%;border-collapse:collapse}td.item{padding:3px 4px 3px 0;vertical-align:top}"
      + "td.price{padding:3px 0;text-align:right;white-space:nowrap;vertical-align:top}"
      + ".total{font-weight:800;font-size:14px;margin-top:6px}"
      + ".line{border-top:1px dashed #111;margin:8px 0}.row{margin:2px 0;display:flex;justify-content:space-between;gap:8px}"
      + ".muted{font-size:10px;color:#222}.center{text-align:center}"
      + ".actions{display:flex;gap:8px;justify-content:center;margin:14px 0 6px;flex-wrap:wrap}"
      + ".actions button{font:inherit;font-size:12px;font-weight:700;padding:8px 12px;border-radius:8px;border:1px solid #111;background:#111;color:#fff;cursor:pointer}"
      + ".actions button.secondary{background:#fff;color:#111}"
      + "@media print{body{width:58mm;padding:0}.actions{display:none!important}a{display:none}}"
      + "</style></head><body>"
      + "<h1>EVORA DONUTS</h1>"
      + "<div class=\"sub\">" + escapeHtml(branchName || "") + "<br/>"
      + escapeHtml(tx.date || "") + (jam ? (" " + escapeHtml(jam)) : "") + "</div>"
      + "<div class=\"line\"></div><table>" + rows + "</table><div class=\"line\"></div>"
      + (tx.diskon > 0 ? (
          "<div class=\"row\"><span>Subtotal</span><span>Rp " + Number(tx.subtotal != null ? tx.subtotal : (tx.total + tx.diskon)).toLocaleString("id-ID") + "</span></div>"
          + "<div class=\"row\"><span>Diskon</span><span>-Rp " + Number(tx.diskon).toLocaleString("id-ID") + "</span></div>"
        ) : "")
      + "<div class=\"total row\"><span>TOTAL</span><span>Rp " + Number(tx.total || 0).toLocaleString("id-ID") + "</span></div>"
      + "<div class=\"row\"><span>Bayar</span><span>" + escapeHtml(metode) + "</span></div>"
      + (tx.metodeBayar === "campuran" ? (
          "<div class=\"row\"><span>Tunai</span><span>Rp " + bayar.toLocaleString("id-ID") + "</span></div>"
          + "<div class=\"row\"><span>Non-tunai</span><span>Rp " + nonTunai.toLocaleString("id-ID") + "</span></div>"
        ) : "")
      + ((tx.metodeBayar === "tunai" || tx.metodeBayar === "campuran") ? (
          "<div class=\"row\"><span>Diterima</span><span>Rp " + bayar.toLocaleString("id-ID") + "</span></div>"
          + "<div class=\"row\"><span>Kembalian</span><span>Rp " + kembali.toLocaleString("id-ID") + "</span></div>"
        ) : "")
      + "<div class=\"line\"></div>"
      + "<div class=\"muted\">No: " + escapeHtml(String(tx.id || "").slice(0, 8).toUpperCase()) + "</div>"
      + (tx.offlineQueued ? "<div class=\"muted\">(antrian offline)</div>" : "")
      + "<div class=\"muted center\" style=\"margin-top:10px\">Terima kasih</div>"
      + "<div class=\"actions\">"
      + "<button onclick=\"window.print()\">Cetak</button>"
      + "<button class=\"secondary\" onclick=\"window.close()\">Tutup</button>"
      + "</div>"
      + (auto ? "<script>window.onload=function(){setTimeout(function(){try{window.print()}catch(e){}},300)}<\\/script>" : "")
      + "</body></html>";
  };
  var printReceipt = (tx, branchName, opts = {}) => {
    try {
      const html = buildReceiptHtml(tx, branchName, opts);
      // Coba window baru dulu (paling umum)
      let w = null;
      try { w = window.open("", "_blank", "noopener,noreferrer,width=380,height=720"); } catch {}
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
        try { w.focus(); } catch {}
        return { ok: true, mode: "window" };
      }
      // Fallback iframe tersembunyi (beberapa HP blok pop-up)
      try {
        let frame = document.getElementById("donatboss-print-frame");
        if (!frame) {
          frame = document.createElement("iframe");
          frame.id = "donatboss-print-frame";
          frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
          document.body.appendChild(frame);
        }
        const doc = frame.contentWindow || frame.contentDocument;
        const d = doc.document || doc;
        d.open();
        d.write(html);
        d.close();
        setTimeout(() => {
          try { (frame.contentWindow || frame).focus(); (frame.contentWindow || frame).print(); } catch {}
        }, 350);
        return { ok: true, mode: "iframe" };
      } catch (e2) {
        return { ok: false, reason: "popup-blocked", detail: e2?.message || String(e2) };
      }
    } catch (e) {
      return { ok: false, reason: e?.message || String(e) };
    }
  };
  var copyReceiptText = async (tx, branchName) => {
    const text = buildReceiptText(tx, branchName);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return { ok: true, text };
      }
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
      return { ok: true, text };
    } catch (e) {
      return { ok: false, reason: e?.message || String(e), text };
    }
  };

  var flushOfflineTxQueue = async (pushNotif) => {
    if (isProbablyOffline()) return { flushed: 0, remain: getOfflineTxQueue().length };
    const q = getOfflineTxQueue();
    if (!q.length) return { flushed: 0, remain: 0 };
    let flushed = 0;
    const remain = [];
    for (const item of q) {
      try {
        const { error } = await sb.rpc("submit_transaksi_lapak", {
          p_id: item.txId,
          p_branch_id: item.branchId,
          p_date: item.date,
          p_ts: item.ts,
          p_items: item.items,
          p_total: item.total,
          p_total_hpp: item.totalHPP,
          p_pcs_konsumsi: item.pcsKonsumsi
        });
        if (error) throw error;
        try {
          await sb.from("transactions").update({
            metodeBayar: item.metodeBayar || "tunai",
            jumlahBayar: item.jumlahBayar != null ? item.jumlahBayar : null,
            nonTunaiBayar: item.nonTunaiBayar != null ? item.nonTunaiBayar : null,
            kembalian: item.kembalian != null ? item.kembalian : null,
            offlineQueued: true
          }).eq("id", item.txId);
        } catch {}
        flushed++;
      } catch {
        remain.push(item);
      }
    }
    setOfflineTxQueue(remain);
    if (flushed) {
      try { await Promise.all([S.loadKey("transactions"), S.loadKey("stokLapak")]); } catch {}
      if (pushNotif) pushNotif(flushed + " transaksi offline berhasil dikirim.", "success");
    }
    return { flushed, remain: remain.length };
  };

  var uploadAsset = async (file, folder = "menu", opts = {}) => {
    if (!file) throw new Error("File belum dipilih.");
    const bucket = getAssetBucket();
    if (!bucket || bucket === "ganti_dengan_nama_bucket_kamu") throw new Error("Isi SUPABASE_ASSET_BUCKET di config.js dulu.");

    let uploadFile = file;
    let compressMeta = null;
    const skipCompress = opts.skipCompress === true;
    if (!skipCompress && isImageFile(file)) {
      compressMeta = await compressImageFile(file, {
        maxEdge: opts.maxEdge,
        maxBytes: opts.maxBytes,
        minQuality: opts.minQuality,
        startQuality: opts.startQuality
      });
      uploadFile = compressMeta.file;
    }

    let uploadName = uploadFile.name || file.name || "asset.jpg";
    // Blob hasil kompres kadang tanpa .name
    if (!uploadFile.name && uploadFile.type === "image/jpeg") uploadName = String(file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg";
    const ext = String(uploadName).split(".").pop()?.toLowerCase() || "jpg";
    const safeName = String(uploadName).replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${folder}/${Date.now()}-${uid()}-${safeName}`;
    const contentType = uploadFile.type || ((ext === "jpg" || ext === "jpeg") ? "image/jpeg" : (file.type || undefined));
    const { error } = await sb.storage.from(bucket).upload(path, uploadFile, {
      upsert: true,
      contentType: contentType || undefined,
      cacheControl: "3600"
    });
    if (error) throw error;
    const pub = sb.storage.from(bucket).getPublicUrl(path);
    return {
      path,
      url: pub?.data?.publicUrl || null,
      bytes: uploadFile.size || null,
      originalBytes: compressMeta ? compressMeta.originalBytes : (file.size || null),
      compressed: !!(compressMeta && compressMeta.compressed),
      compress: compressMeta
    };
  };

  function useStoreTick() {
    const [tick, setTick] = useState(0);
    useEffect(() => S.subscribe(() => setTick((t) => t + 1)), []);
    return tick;
  }

  // ─── REVISI #1: HPP BARU — Harga Beli Total ÷ Kapasitas Yield ─────────────
  // Struktur bahanPokok baru: { id, nama, hargaBeli, kapasitas, satuanBeli }
  // Rumus: hppPerPcs = hargaBeli / kapasitas
  //
  // Struktur resepBahanPokok di menu: [{ bahanId, jumlahPakai }]
  //   → hppAdonan = sum(bahanPokok[bahanId].hppPerPcs * jumlahPakai)
  //   (jumlahPakai default 1 = 1 pcs adonan dasar)
  //
  // Struktur resepToping di menu (varian/topping per menu):
  //   [{ nama, hargaBeli, kapasitas }]
  //   → hppToping = sum(hargaBeli / kapasitas)
  //
  // HPP satuan  = hppAdonan + hppToping
  // HPP paket   = (hppSatuan × isiBox) + boxCost

  // ─── HPP rounding (REVISI 2026-07) ───────────────────────────────────────
  // Dulu: Math.ceil di banyak langkah → HPP selalu "gembung", margin understated.
  // Sekarang: hitung pecahan dulu, BULATKAN 1x di akhir ke rupiah terdekat.
  // roundHppRp: nilai uang HPP/margin final untuk disimpan & ditampilkan.
  // raw tetap dipakai internal breakdown biar audit bisa lihat pecahan.
  var roundHppRp = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x); // ke rupiah terdekat (bukan selalu ke atas)
  };

  var getBahanHppPerPcs = (bahan, { rounded } = {}) => {
    const hargaBeli = parseFloat(bahan?.hargaBeli || 0) || 0;
    const isiBeli = Number(bahan?.isiBeli || 0) || 0;
    const takaran = Number(bahan?.takaranPerPcs || 0) || 0;
    const kapasitas = Math.max(parseInt(bahan?.kapasitas || 1) || 1, 1);
    // Jika takaran fisik tersedia, gunakan harga per satuan x takaran.
    // Fallback ke harga beli/yield untuk data lama.
    const raw = isiBeli > 0 && takaran > 0
      ? (hargaBeli / isiBeli) * takaran
      : hargaBeli / kapasitas;
    return rounded ? roundHppRp(raw) : raw;
  };

  var getMenuHPPBreakdown = (menu) => {
    const bahanList = S.get("bahanPokok") || [];

    // HPP adonan: jumlah semua bahan pokok yang dipakai, dihitung per pcs (RAW)
    const hppAdonanRaw = (menu.resepBahanPokok || []).reduce((acc, r) => {
      const b = bahanList.find((x) => x.id === r.bahanId);
      if (!b) return acc;
      return acc + getBahanHppPerPcs(b) * (parseFloat(r.jumlahPakai || 1) || 1);
    }, 0);

    // HPP toping/varian per menu: masing-masing punya hargaBeli + kapasitas sendiri (RAW)
    // Model bisnis final: glaze/topping dipilih per slot kasir, bukan resep tetap menu.
    // `resepToping` lama diabaikan untuk transaksi baru agar HPP tidak dobel.
    const hppTopingRaw = 0;

    // Satu pembulatan di hasil satuan (bukan ceil berlapis per komponen)
    const hppSatuanPerPcs = roundHppRp(hppAdonanRaw + hppTopingRaw);
    const hargaJual = parseFloat(menu.hargaJual || 0) || 0;
    const omzetKotorPerPcs = Math.max(hargaJual - hppSatuanPerPcs, 0);

    // Paket/Box — boxCost dibulatkan sendiri (input uang), lalu total paket 1x round
    const isiBox = Math.max(parseInt(menu.isiBox || 1) || 1, 1);
    const boxCost = roundHppRp(parseFloat(menu.boxCost || 0) || 0);
    // Pakai raw satuan * isi + box agar tidak double-round berlebihan
    const hppPaket = roundHppRp((hppAdonanRaw + hppTopingRaw) * isiBox + boxCost);
    const marginSatuan = roundHppRp(hargaJual - hppSatuanPerPcs);
    const marginPaket = roundHppRp(hargaJual - hppPaket);

    return {
      // Breakdown komponen: dibulatkan untuk tampilan; penjumlahan final sudah di round di atas
      hppAdonanPerPcs: roundHppRp(hppAdonanRaw),
      hppTopingPerPcs: roundHppRp(hppTopingRaw),
      hppAdonanRaw,
      hppTopingRaw,
      hppSatuanPerPcs,
      omzetKotorPerPcs,
      isiBox,
      boxCost,
      hppPaket,
      marginSatuan,
      marginPaket,
      rounding: "round@final-2026-07"
    };
  };

  var hitungHPP = (menu) => {
    const info = getMenuHPPBreakdown(menu);
    return menu?.tipe === "paket" ? info.hppPaket : info.hppSatuanPerPcs;
  };

  // HPP komponen yang disimpan di setiap item transaksi.
  // Donat polos tetap dipecah ke bahan dasar (kentang/gandum/dll),
  // sementara glaze/topping dihitung sesuai takaran yang benar-benar dipilih.
  var addHppComponent = (map, key, nama, qty, unitHpp, jenis) => {
    if (!key || !qty) return;
    const q = Number(qty) || 0;
    const h = Number(unitHpp) || 0;
    if (!map[key]) map[key] = { key, nama: nama || key, jenis: jenis || "bahan", qty: 0, hpp: 0 };
    map[key].qty += q;
    map[key].hpp += q * h;
  };

  var getHppComponentsForItem = (item) => {
    const out = {};
    const bahanList = S.get("bahanPokok") || [];
    const topings = S.get("topingTambahan") || [];
    const menus = S.get("menuVarian") || [];
    const qtyItem = Number(item?.qty) || 0;
    const baseMenuId = item?.basePolosId || item?.baseMenuId || item?.menuId;
    const baseMenu = menus.find((m) => m.id === baseMenuId);

    const addBase = (n) => {
      if (!baseMenu || n <= 0) return;
      (baseMenu.resepBahanPokok || []).forEach((r) => {
        const b = bahanList.find((x) => x.id === r.bahanId);
        if (!b) return;
        const per = Number(r.jumlahPakai || 1) || 1;
        addHppComponent(out, "bahan:" + b.id, b.nama, per * n, getBahanHppPerPcs(b), "bahan_dasar");
      });
    };
    const addGlaze = (glazeId, n) => {
      const g = topings.find((x) => x.id === glazeId && x.jenis === "glaze");
      if (!g || n <= 0) return;
      const per = Number(g.porsiPerPcs || 1) || 1;
      const unit = g.hargaPerSatuan != null
        ? Number(g.hargaPerSatuan) * per
        : (Number(g.hargaBeli || 0) / Math.max(Number(g.kapasitas || 1), 1));
      addHppComponent(out, "glaze:" + g.id, g.nama, n, unit, "glaze");
    };
    const addToping = (topingId, n, jenis = "topping") => {
      const t = topings.find((x) => x.id === topingId && x.jenis !== "glaze");
      if (!t || n <= 0) return;
      const unit = t.hargaPerSatuan != null && t.porsiPerPcs
        ? Number(t.hargaPerSatuan) * Number(t.porsiPerPcs)
        : (Number(t.hargaBeli || 0) / Math.max(Number(t.kapasitas || 1), 1));
      addHppComponent(out, "topping:" + t.id, t.nama, n, unit, jenis);
    };

    if (Array.isArray(item?.slotIsi) && item.slotIsi.length) {
      item.slotIsi.forEach((slot) => {
        addBase(qtyItem);
        addGlaze(slot.glaze, qtyItem);
        (slot.toping || []).forEach((tid) => addToping(tid, qtyItem));
      });
      const box = Number(item.boxCost || 0) || 0;
      if (box > 0) addHppComponent(out, "box:" + (item.menuId || "box"), item.nama || "Box", qtyItem, box, "box");
    } else {
      addBase(qtyItem);
      addGlaze(item.glazeId, qtyItem);
      if (item.topingId) addToping(item.topingId, qtyItem);
      (item.topingIds || []).forEach((tid) => addToping(tid, qtyItem, "topping_tambahan"));
      if (item.tipe === "paket") {
        const box = Number(item.boxCost || (menus.find((m) => m.id === item.menuId)?.boxCost) || 0) || 0;
        if (box > 0) addHppComponent(out, "box:" + item.menuId, item.nama || "Box", qtyItem, box, "box");
      }
    }
    const components = Object.values(out).map((x) => ({ ...x, hpp: roundHppRp(x.hpp) }));
    return { components, total: components.reduce((a, x) => a + x.hpp, 0) };
  };

  var aggregateHppComponents = (transactions, from, to) => {
    const map = {};
    (transactions || []).filter((t) => (!from || t.date >= from) && (!to || t.date <= to)).forEach((t) => {
      (t.items || []).forEach((item) => {
        const saved = item.hppComponents || getHppComponentsForItem(item).components;
        (saved || []).forEach((c) => {
          if (!map[c.key]) map[c.key] = { ...c, qty: 0, hpp: 0 };
          map[c.key].qty += Number(c.qty) || 0;
          map[c.key].hpp += Number(c.hpp) || 0;
        });
      });
    });
    return Object.values(map).map((x) => ({ ...x, hpp: roundHppRp(x.hpp) })).sort((a, b) => b.hpp - a.hpp);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // STOK BAHAN BAKU GUDANG (yield-pcs)
  // Satuan stok = ekuivalen "pcs hasil/yield" sama seperti field kapasitas bahan
  // & jumlahPakai di resep. Contoh: Tepung kapasitas 10 → beli 1 batch = +10.
  // Produksi menu pakai jumlahPakai * qty menu → stok berkurang.
  // Ledger: app_settings key "stok_bahan_ledger"
  // ═══════════════════════════════════════════════════════════════════════
  var STOK_BAHAN_DB_KEY = "stok_bahan_ledger";
  var stokBahanCache = { ledger: [], loaded: false };
  var normalizeStokBahanLedger = (raw) => {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((e) => ({
      id: e.id || uid(),
      bahanId: e.bahanId || null,
      bahanNama: e.bahanNama || null,
      tipe: e.tipe || "koreksi", // masuk | keluar | produksi | retur_produksi | koreksi
      qty: Math.abs(Number(e.qty) || 0),
      qtySign: e.qtySign != null ? Number(e.qtySign) : (e.tipe === "koreksi" ? Number(e.qty) || 0 : undefined),
      date: String(e.date || today()).slice(0, 10),
      ts: e.ts || nowIso(),
      note: e.note || null,
      refType: e.refType || null, // produksiCK | manual
      refId: e.refId || null,
      menuId: e.menuId || null,
      menuNama: e.menuNama || null,
      qtyMenu: e.qtyMenu != null ? Number(e.qtyMenu) : null
    })).filter((e) => e.bahanId && (e.tipe === "koreksi" ? Math.abs(Number(e.qtySign != null ? e.qtySign : e.qty) || 0) > 0 : (Number(e.qty) || 0) > 0));
  };
  var getStokBahanLedger = () => normalizeStokBahanLedger(stokBahanCache.ledger);
  var setStokBahanLedgerLocal = (ledger) => {
    stokBahanCache.ledger = normalizeStokBahanLedger(ledger);
    stokBahanCache.loaded = true;
    try { S.setLocal("notified_ids", S.get("notified_ids") || []); } catch {}
    return stokBahanCache.ledger;
  };
  var loadStokBahanFromDb = async () => {
    try {
      const { data, error } = await sb.from("material_stock_ledger").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      const bahanListNow = S.get("bahanPokok") || [];
      const mapped = (data || []).map((r) => ({
        id: r.legacy_id || r.id,
        bahanId: r.bahan_id,
        bahanNama: bahanListNow.find((b) => b.id === r.bahan_id)?.nama || r.bahan_id,
        tipe: r.source_type === "production" ? "produksi" : (r.direction === "in" ? "masuk" : r.direction === "out" ? "keluar" : "koreksi"),
        qty: Math.abs(Number(r.quantity) || 0),
        qtySign: r.direction === "out" ? -(Number(r.quantity) || 0) : Number(r.quantity) || 0,
        date: String(r.date || today()).slice(0, 10),
        ts: r.created_at || nowIso(),
        note: r.note || null,
        refType: r.source_type || null,
        refId: r.source_id || null,
        menuId: null, menuNama: null, qtyMenu: null
      }));
      return setStokBahanLedgerLocal(mapped);
    } catch (e) {
      return getStokBahanLedger();
    }
  };
  var saveStokBahanToDb = async (rows) => {
    const branches = S.get("branches") || [];
    const ck = branches.find((b) => b.type === "central_kitchen") || branches[0];
    const payload = (rows || []).map((r) => {
      const isCorrection = r.tipe === "koreksi";
      const signed = isCorrection ? Number(r.qtySign != null ? r.qtySign : r.qty) || 0 : 0;
      const direction = isCorrection ? (signed >= 0 ? "in" : "out") : ((r.tipe === "masuk" || r.tipe === "retur_produksi") ? "in" : "out");
      const qty = isCorrection ? Math.abs(signed) : Math.abs(Number(r.qty) || 0);
      const bahan = (S.get("bahanPokok") || []).find((b) => b.id === r.bahanId);
      return {
        area_id: ck?.areaId || null, branch_id: r.branchId || ck?.id,
        bahan_id: r.bahanId, date: r.date || today(), direction, quantity: qty,
        unit_cost: bahan ? getBahanHppPerPcs(bahan) : 0,
        source_type: r.refType || r.tipe || "manual", source_id: r.refId || r.id || uid(), note: r.note || null, created_by: null
      };
    }).filter((r) => r.branch_id && r.bahan_id && r.quantity > 0);
    if (!payload.length) return loadStokBahanFromDb();
    const { error } = await sb.from("material_stock_ledger").insert(payload);
    if (error) throw error;
    return loadStokBahanFromDb();
  };
  var signedQtyStok = (e) => {
    if (!e) return 0;
    const q = Number(e.qty) || 0;
    if (e.tipe === "masuk" || e.tipe === "retur_produksi") return q;
    if (e.tipe === "keluar" || e.tipe === "produksi") return -q;
    // koreksi: qty disimpan bertanda di note? kita pakai field signed di qtySign
    if (e.tipe === "koreksi") return Number(e.qtySign != null ? e.qtySign : e.qty) || 0;
    return 0;
  };
  // re-normalize to allow koreksi signed
  var getStokBahanSaldo = (bahanId) => {
    return getStokBahanLedger()
      .filter((e) => e.bahanId === bahanId)
      .reduce((a, e) => {
        if (e.tipe === "masuk" || e.tipe === "retur_produksi") return a + (Number(e.qty) || 0);
        if (e.tipe === "keluar" || e.tipe === "produksi") return a - (Number(e.qty) || 0);
        if (e.tipe === "koreksi") return a + (Number(e.qtySign != null ? e.qtySign : 0) || 0);
        return a;
      }, 0);
  };
  var getAllStokBahanSaldoMap = () => {
    const map = {};
    getStokBahanLedger().forEach((e) => {
      if (!e.bahanId) return;
      if (!map[e.bahanId]) map[e.bahanId] = 0;
      if (e.tipe === "masuk" || e.tipe === "retur_produksi") map[e.bahanId] += Number(e.qty) || 0;
      else if (e.tipe === "keluar" || e.tipe === "produksi") map[e.bahanId] -= Number(e.qty) || 0;
      else if (e.tipe === "koreksi") map[e.bahanId] += Number(e.qtySign != null ? e.qtySign : 0) || 0;
    });
    return map;
  };
  /** Pemakaian bahan untuk N pcs menu (dari resep). qty dalam yield-pcs. */
  var hitungPemakaianBahanMenu = (menu, jumlahMenu) => {
    const jml = Math.max(parseInt(jumlahMenu || 0) || 0, 0);
    if (!menu || jml <= 0) return [];
    const bahanList = S.get("bahanPokok") || [];
    const out = [];
    (menu.resepBahanPokok || []).forEach((r) => {
      const b = bahanList.find((x) => x.id === r.bahanId);
      if (!b) return;
      const pakaiPerPcs = parseFloat(r.jumlahPakai || 1) || 1;
      const qty = pakaiPerPcs * jml;
      if (qty > 0) out.push({ bahanId: b.id, bahanNama: b.nama, qty, pakaiPerPcs });
    });
    return out;
  };
  var catatStokBahanRows = async (rows) => {
    if (!rows || !rows.length) return getStokBahanLedger();
    return saveStokBahanToDb(rows);
  };
  var cekStokBahanCukupUntukProduksi = (menu, jumlah) => {
    const pakai = hitungPemakaianBahanMenu(menu, jumlah);
    const kurang = [];
    pakai.forEach((p) => {
      const saldo = getStokBahanSaldo(p.bahanId);
      if (saldo + 1e-9 < p.qty) {
        kurang.push({ ...p, saldo, butuh: p.qty, defisit: p.qty - saldo });
      }
    });
    return { ok: kurang.length === 0, pakai, kurang };
  };

  // ═══════════════════════════════════════════════════════════════════════
  // STOK TOPING PER LAPAK (bahan curah: gram / wadah / botol) — ledger opname
  // Disimpan di app_settings key "stok_toping_ledger".
  // Entri: { id, branchId, topingId, topingNama, tipe, qty, date, ts, note }
  //   tipe: "kirim" (owner distribusi +), "opname" (set sisa fisik → sistem hitung terpakai)
  // Saldo = jumlah kirim − jumlah terpakai(opname). Opname mencatat "terpakai" = saldoSebelum − sisaFisik.
  // ═══════════════════════════════════════════════════════════════════════
  var STOK_TOPING_DB_KEY = "stok_toping_ledger";
  var stokTopingCache = { ledger: [], loaded: false };
  var normalizeStokTopingLedger = (raw) => {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((e) => ({
      id: e.id || uid(),
      branchId: e.branchId || null,
      topingId: e.topingId || null,
      topingNama: e.topingNama || null,
      tipe: e.tipe || "kirim", // kirim | terpakai
      qty: Number(e.qty) || 0,   // untuk "kirim": jumlah masuk (+). untuk "terpakai": jumlah keluar (+, dikurangi dari saldo)
      sisaFisik: e.sisaFisik != null ? Number(e.sisaFisik) : null,
      nilaiRp: e.nilaiRp != null ? Number(e.nilaiRp) : null,
      date: String(e.date || today()).slice(0, 10),
      ts: e.ts || nowIso(),
      note: e.note || null
    })).filter((e) => e.branchId && e.topingId);
  };
  var getStokTopingLedger = () => normalizeStokTopingLedger(stokTopingCache.ledger);
  var setStokTopingLedgerLocal = (ledger) => {
    stokTopingCache.ledger = normalizeStokTopingLedger(ledger);
    stokTopingCache.loaded = true;
    return stokTopingCache.ledger;
  };
  var loadStokTopingFromDb = async () => {
    try {
      const { data, error } = await sb.from("app_settings").select("value").eq("key", STOK_TOPING_DB_KEY).maybeSingle();
      if (error) throw error;
      return setStokTopingLedgerLocal(data?.value || []);
    } catch {
      return getStokTopingLedger();
    }
  };
  var saveStokTopingToDb = async (ledger) => {
    const n = normalizeStokTopingLedger(ledger);
    const { error } = await sb.from("app_settings").upsert({ key: STOK_TOPING_DB_KEY, value: n });
    if (error) throw error;
    return setStokTopingLedgerLocal(n);
  };
  // Saldo toping tertentu di cabang tertentu
  var getStokTopingSaldo = (branchId, topingId) => {
    return getStokTopingLedger()
      .filter((e) => e.branchId === branchId && e.topingId === topingId)
      .reduce((a, e) => {
        if (e.tipe === "kirim") return a + (Number(e.qty) || 0);
        if (e.tipe === "terpakai") return a - (Number(e.qty) || 0);
        return a;
      }, 0);
  };
  var catatStokTopingRows = async (rows) => {
    if (!rows || !rows.length) return getStokTopingLedger();
    const tambahan = rows.map((r) => ({ ...r, id: r.id || uid(), ts: r.ts || nowIso() }));
    // reload-fresh sebelum append agar entri kurir/owner lain tidak tertimpa
    return mutateLedger(loadStokTopingFromDb, (list) => [...list, ...tambahan], saveStokTopingToDb);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // CARRY-OVER DONAT: batch donat polos sisa yang dibawa ke besok (umur maks 1 hari)
  // Disimpan di app_settings key "donat_carry_ledger".
  // Entri batch aktif: { id, branchId, menuId, menuNama, batchDate, qty }
  //   batchDate = tanggal donat itu jadi sisa (mulai "hari ke-0"). Besoknya jadi
  //   "hari ke-1" → masih boleh jual. Saat checkout berikutnya kalau masih ada →
  //   wajib buang (sudah lewat 1 hari).
  // ═══════════════════════════════════════════════════════════════════════
  var DONAT_CARRY_DB_KEY = "donat_carry_ledger";
  var donatCarryCache = { batches: [], loaded: false };
  var normalizeDonatCarry = (raw) => {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((e) => ({
      id: e.id || uid(),
      branchId: e.branchId || null,
      menuId: e.menuId || null,
      menuNama: e.menuNama || null,
      batchDate: String(e.batchDate || today()).slice(0, 10),
      qty: Math.max(0, Number(e.qty) || 0),
      ts: e.ts || nowIso()
    })).filter((e) => e.branchId && e.menuId && e.qty > 0);
  };
  var getDonatCarry = () => normalizeDonatCarry(donatCarryCache.batches);
  var setDonatCarryLocal = (b) => { donatCarryCache.batches = normalizeDonatCarry(b); donatCarryCache.loaded = true; return donatCarryCache.batches; };
  var loadDonatCarryFromDb = async () => {
    try {
      const { data, error } = await sb.from("app_settings").select("value").eq("key", DONAT_CARRY_DB_KEY).maybeSingle();
      if (error) throw error;
      return setDonatCarryLocal(data?.value || []);
    } catch { return getDonatCarry(); }
  };
  var saveDonatCarryToDb = async (b) => {
    const n = normalizeDonatCarry(b);
    const { error } = await sb.from("app_settings").upsert({ key: DONAT_CARRY_DB_KEY, value: n });
    if (error) throw error;
    return setDonatCarryLocal(n);
  };
  // Total carry (batch dari sebelum hari T) untuk 1 cabang+menu = "donat lama/kemarin"
  var getCarryLamaQty = (branchId, menuId, dateT) => getDonatCarry()
    .filter((e) => e.branchId === branchId && e.menuId === menuId && e.batchDate < dateT)
    .reduce((a, e) => a + e.qty, 0);
  var getCarryTotalQty = (branchId, menuId) => getDonatCarry()
    .filter((e) => e.branchId === branchId && e.menuId === menuId)
    .reduce((a, e) => a + e.qty, 0);

  // ═══════════════════════════════════════════════════════════════════════
  // PESANAN & RESELLER (gabungan) + DAFTAR RESELLER
  // Disimpan di app_settings: "pesanan_ledger" & "reseller_list".
  //   Pesanan entri: { id, kategori("pesanan"|"reseller"), nama, resellerId, isi,
  //     total, bayar("lunas"|"dp"|"utang"), dp, ambil("sudah"|"belum"),
  //     tglAmbil, date, ts, catatan }
  //   Reseller entri: { id, nama, hp, hargaGrosirNote }
  // ═══════════════════════════════════════════════════════════════════════
  var PESANAN_DB_KEY = "pesanan_ledger";
  var RESELLER_DB_KEY = "reseller_list";
  var pesananCache = { list: [], loaded: false };
  var resellerCache = { list: [], loaded: false };
  var normalizePesanan = (raw) => (Array.isArray(raw) ? raw : []).map((e) => ({
    id: e.id || uid(),
    kategori: e.kategori === "reseller" ? "reseller" : "pesanan",
    nama: e.nama || "-",
    resellerId: e.resellerId || null,
    isi: e.isi || "",
    total: Math.max(0, Number(e.total) || 0),
    bayar: ["lunas", "dp", "utang"].includes(e.bayar) ? e.bayar : "lunas",
    dp: Math.max(0, Number(e.dp) || 0),
    ambil: e.ambil === "belum" ? "belum" : "sudah",
    tglAmbil: e.tglAmbil || null,
    date: String(e.date || today()).slice(0, 10),
    ts: e.ts || nowIso(),
    catatan: e.catatan || null
  })).filter((e) => e.nama);
  var normalizeReseller = (raw) => (Array.isArray(raw) ? raw : []).map((e) => ({
    id: e.id || uid(), nama: e.nama || "-", hp: e.hp || "", hargaGrosirNote: e.hargaGrosirNote || ""
  })).filter((e) => e.nama && e.nama !== "-");
  var getPesananList = () => normalizePesanan(pesananCache.list);
  var getResellerList = () => normalizeReseller(resellerCache.list);
  var setPesananLocal = (l) => { pesananCache.list = normalizePesanan(l); pesananCache.loaded = true; return pesananCache.list; };
  var setResellerLocal = (l) => { resellerCache.list = normalizeReseller(l); resellerCache.loaded = true; return resellerCache.list; };
  var loadPesananFromDb = async () => {
    try { const { data, error } = await sb.from("app_settings").select("value").eq("key", PESANAN_DB_KEY).maybeSingle(); if (error) throw error; return setPesananLocal(data?.value || []); }
    catch { return getPesananList(); }
  };
  var loadResellerFromDb = async () => {
    try { const { data, error } = await sb.from("app_settings").select("value").eq("key", RESELLER_DB_KEY).maybeSingle(); if (error) throw error; return setResellerLocal(data?.value || []); }
    catch { return getResellerList(); }
  };
  var savePesananToDb = async (l) => { const n = normalizePesanan(l); const { error } = await sb.from("app_settings").upsert({ key: PESANAN_DB_KEY, value: n }); if (error) throw error; return setPesananLocal(n); };
  var saveResellerToDb = async (l) => { const n = normalizeReseller(l); const { error } = await sb.from("app_settings").upsert({ key: RESELLER_DB_KEY, value: n }); if (error) throw error; return setResellerLocal(n); };
  // Sisa utang 1 pesanan = total − (dp jika dp) − (0 kalau lunas) ; utang penuh kalau bayar=utang
  var sisaUtangPesanan = (p) => {
    if (p.bayar === "lunas") return 0;
    if (p.bayar === "dp") return Math.max(0, p.total - (p.dp || 0));
    return p.total; // utang penuh
  };

  // ═══════════════════════════════════════════════════════════════════════
  // SHIFT KAS — buka/tutup kas laci per pekerja per shift (app_settings "shift_kas_ledger")
  //   Entri: { id, branchId, tanggal, pekerja, userId, modalAwal, tunaiFisik,
  //     status("buka"|"tutup"), bukaTs, tutupTs, catatan }
  //   Penjualan tunai & pengeluaran shift dihitung dari transaksi/pengeluaran
  //   antara bukaTs..tutupTs saat menutup.
  // ═══════════════════════════════════════════════════════════════════════
  var SHIFT_DB_KEY = "shift_kas_ledger";
  var shiftCache = { list: [], loaded: false };
  var normalizeShift = (raw) => (Array.isArray(raw) ? raw : []).map((e) => ({
    id: e.id || uid(),
    branchId: e.branchId || null,
    tanggal: String(e.tanggal || today()).slice(0, 10),
    pekerja: e.pekerja || "-",
    userId: e.userId || null,
    modalAwal: Math.max(0, Number(e.modalAwal) || 0),
    penjualanTunai: Number(e.penjualanTunai) || 0,
    pengeluaranTunai: Number(e.pengeluaranTunai) || 0,
    tunaiFisik: e.tunaiFisik != null ? Number(e.tunaiFisik) : null,
    seharusnya: e.seharusnya != null ? Number(e.seharusnya) : null,
    selisih: e.selisih != null ? Number(e.selisih) : null,
    status: e.status === "tutup" ? "tutup" : "buka",
    bukaTs: e.bukaTs || null,
    tutupTs: e.tutupTs || null,
    catatan: e.catatan || null
  })).filter((e) => e.branchId);
  var getShiftList = () => normalizeShift(shiftCache.list);
  var setShiftLocal = (l) => { shiftCache.list = normalizeShift(l); shiftCache.loaded = true; return shiftCache.list; };
  var loadShiftFromDb = async () => {
    try { const { data, error } = await sb.from("app_settings").select("value").eq("key", SHIFT_DB_KEY).maybeSingle(); if (error) throw error; return setShiftLocal(data?.value || []); }
    catch { return getShiftList(); }
  };
  var saveShiftToDb = async (l) => { const n = normalizeShift(l); const { error } = await sb.from("app_settings").upsert({ key: SHIFT_DB_KEY, value: n }); if (error) throw error; return setShiftLocal(n); };
  // Shift yang sedang terbuka untuk cabang tertentu
  var getShiftBuka = (branchId) => getShiftList().find((s) => s.branchId === branchId && s.status === "buka") || null;

  // ═══════════════════════════════════════════════════════════════════════
  // KURIR / DISTRIBUSI — catatan setoran uang lapak yang dibawa kurir (app_settings "kurir_ledger")
  //   Entri: { id, tanggal, branchId, branchNama, kurir, uangDibawa, disetorOwner, ts, catatan }
  // ═══════════════════════════════════════════════════════════════════════
  var KURIR_DB_KEY = "kurir_ledger";
  var kurirCache = { list: [], loaded: false };
  var normalizeKurir = (raw) => (Array.isArray(raw) ? raw : []).map((e) => ({
    id: e.id || uid(),
    tanggal: String(e.tanggal || today()).slice(0, 10),
    branchId: e.branchId || null,
    branchNama: e.branchNama || null,
    kurir: e.kurir || "-",
    uangDibawa: Math.max(0, Number(e.uangDibawa) || 0),
    // statusUang: "dibawa" (kurir pegang) → "perjalanan" (menuju owner) → "dikonfirmasi" (owner terima)
    statusUang: ["dibawa", "perjalanan", "dikonfirmasi"].includes(e.statusUang) ? e.statusUang : (e.disetorOwner ? "dikonfirmasi" : "dibawa"),
    disetorOwner: !!e.disetorOwner || e.statusUang === "dikonfirmasi",
    ts: e.ts || nowIso(),
    konfirmasiTs: e.konfirmasiTs || null,
    catatan: e.catatan || null
  })).filter((e) => e.branchId);
  var getKurirList = () => normalizeKurir(kurirCache.list);
  var setKurirLocal = (l) => { kurirCache.list = normalizeKurir(l); kurirCache.loaded = true; return kurirCache.list; };
  var loadKurirFromDb = async () => {
    try { const { data, error } = await sb.from("app_settings").select("value").eq("key", KURIR_DB_KEY).maybeSingle(); if (error) throw error; return setKurirLocal(data?.value || []); }
    catch { return getKurirList(); }
  };
  var saveKurirToDb = async (l) => { const n = normalizeKurir(l); const { error } = await sb.from("app_settings").upsert({ key: KURIR_DB_KEY, value: n }); if (error) throw error; return setKurirLocal(n); };

  // ═══════════════════════════════════════════════════════════════════════
  // ANTI-TABRAKAN (concurrency guard) untuk ledger berbasis app_settings.
  // Masalah: save = "baca list → ubah → tulis ulang SEMUA". Kalau 2 orang simpan
  // hampir bersamaan, yang belakangan menimpa yang duluan → data hilang.
  // Solusi: SEBELUM menulis, MUAT ULANG data terbaru dari DB, lalu terapkan
  // perubahan (mutator) di atas data segar itu. Ini mempersempit jendela bahaya
  // dari "menit (user mikir)" jadi "milidetik (antara reload & upsert)".
  //   mutateLedger(loadFn, mutatorFn, saveFn):
  //     - loadFn(): async, ambil data TERBARU dari DB
  //     - mutatorFn(freshList): kembalikan list baru hasil perubahan
  //     - saveFn(newList): async, simpan
  var mutateLedger = async (loadFn, mutatorFn, saveFn) => {
    let fresh;
    try { fresh = await loadFn(); } catch { fresh = null; }
    const base = Array.isArray(fresh) ? fresh : [];
    const next = mutatorFn(base);
    return saveFn(next);
  };

  /** Estimasi berapa pcs menu masih bisa diproduksi dari stok gudang saat ini. */
  var estimasiMaxProduksiDariStok = (menu) => {
    const pakai1 = hitungPemakaianBahanMenu(menu, 1);
    if (!pakai1.length) return { maxPcs: null, unlimited: true, bottleneck: null, lines: [] };
    let maxPcs = Infinity;
    let bottleneck = null;
    const lines = pakai1.map((p) => {
      const saldo = getStokBahanSaldo(p.bahanId);
      const per = p.pakaiPerPcs || p.qty || 1;
      const can = per > 0 ? Math.floor((saldo + 1e-9) / per) : 0;
      if (can < maxPcs) { maxPcs = can; bottleneck = p.bahanNama; }
      return { bahanId: p.bahanId, bahanNama: p.bahanNama, saldo, perPcs: per, canPcs: can };
    });
    if (!Number.isFinite(maxPcs)) maxPcs = 0;
    return { maxPcs: Math.max(0, maxPcs), unlimited: false, bottleneck, lines };
  };

  /** Arus kas operasional sederhana (bukan PSAK penuh) untuk periode. */
  var hitungArusKasOperasional = ({ dateFrom, dateTo, branchId }) => {
    const inRange = (d) => d && d >= dateFrom && d <= dateTo;
    const matchB = (bId) => !branchId || branchId === "all" || bId === branchId;
    const txs = (S.get("transactions") || []).filter((t) => inRange(t.date) && matchB(t.branchId));
    const pl = (S.get("pengeluaranLapak") || []).filter((p) => inRange(p.date) && matchB(p.branchId));
    const po = (S.get("pengeluaranOwner") || []).filter((p) => inRange(p.date) && (!p.branchId || matchB(p.branchId)));
    const ambil = (S.get("pengambilanBelanja") || []).filter((p) => inRange(p.date));
    const setoran = (S.get("setoranHarian") || []).filter((s) => inRange(s.date) && matchB(s.branchId) && s.status === "selesai");
    const omzet = txs.reduce((a, t) => a + (t.total || 0), 0);
    const kasMasukSetoran = setoran.reduce((a, s) => a + (s.totalDiterima != null ? Number(s.totalDiterima) : Math.max(0, (s.omzet || 0) - (s.pengeluaran || 0))), 0);
    const keluarLapak = pl.reduce((a, p) => a + (p.jumlah || 0), 0);
    const keluarOwner = po.reduce((a, p) => a + (p.jumlah || 0), 0);
    const keluarBelanja = ambil.reduce((a, p) => a + (p.jumlah || 0), 0);
    // Catatan: penjualan di app vs kas masuk setoran bisa beda (timing/selisih)
    return {
      dateFrom, dateTo, branchId: branchId || "all",
      omzetSistem: omzet,
      kasMasukSetoran,
      keluarLapak, keluarOwner, keluarBelanja,
      totalKeluar: keluarLapak + keluarOwner + keluarBelanja,
      netoSetoranVsKeluar: kasMasukSetoran - (keluarLapak + keluarOwner + keluarBelanja),
      txCount: txs.length,
      setoranCount: setoran.length
    };
  };

  var exportGudangBelanjaExcel = (bulanStr, pushNotif) => {
    if (typeof XLSX === "undefined") {
      pushNotif && pushNotif("Library Excel belum termuat. Pastikan xlsx.full.min.js ada di index.html.", "warning");
      return false;
    }
    const bulan = String(bulanStr || today()).slice(0, 7);
    const bahan = S.get("bahanPokok") || [];
    const saldoMap = getAllStokBahanSaldoMap();
    const ambilAll = (S.get("pengambilanBelanja") || []).filter((p) => String(p.date || "").startsWith(bulan));
    const ledger = getStokBahanLedger().filter((e) => String(e.date || "").startsWith(bulan));
    const pakaiBy = {};
    ledger.filter((e) => e.tipe === "produksi").forEach((e) => {
      if (!pakaiBy[e.bahanId]) pakaiBy[e.bahanId] = 0;
      pakaiBy[e.bahanId] += Number(e.qty) || 0;
    });
    const belanjaBy = {};
    ambilAll.forEach((p) => {
      const key = p.bahanId || "__umum__";
      if (!belanjaBy[key]) belanjaBy[key] = { rp: 0, qty: 0 };
      belanjaBy[key].rp += Number(p.jumlah) || 0;
      belanjaBy[key].qty += Number(p.qtyYield) || 0;
    });
    const distribAktif = (S.get("distribusiCK") || []).filter((d) => d.status !== "dibatalkan" && String(d.date || "").startsWith(bulan));
    const jatah = distribAktif.reduce((a, d) => a + (d.hppTotal || 0), 0);
    const belanjaTotal = ambilAll.reduce((a, p) => a + (p.jumlah || 0), 0);

    const wb = XLSX.utils.book_new();
    const ringkas = [
      ["Laporan Gudang & Belanja Bahan"],
      ["Bulan", bulan],
      ["Diekspor", nowTs()],
      [],
      ["Jatah HPP distribusi (Rp)", jatah],
      ["Belanja aktual (Rp)", belanjaTotal],
      ["Sisa jatah (Rp)", jatah - belanjaTotal],
      []
    ];
    XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(ringkas)), "Ringkasan");

    const perBahan = [["Bahan", "Saldo stok (yield)", "Pakai produksi", "Nilai HPP pakai", "Belanja Rp", "Belanja qty yield", "HPP batch master"]];
    bahan.forEach((b) => {
      const pakaiQty = pakaiBy[b.id] || 0;
      const bel = belanjaBy[b.id] || { rp: 0, qty: 0 };
      const nilai = roundHppRp(pakaiQty * getBahanHppPerPcs(b));
      if (pakaiQty || bel.rp || Math.abs(saldoMap[b.id] || 0) > 0.001) {
        perBahan.push([b.nama, saldoMap[b.id] || 0, pakaiQty, nilai, bel.rp, bel.qty, b.hargaBeli || 0]);
      }
    });
    if (belanjaBy["__umum__"]) perBahan.push(["(Belanja tanpa tag bahan)", "", "", "", belanjaBy["__umum__"].rp, "", ""]);
    XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(perBahan)), "Per Bahan");

    const detBelanja = [["Tanggal", "Bahan", "Jumlah Rp", "Qty yield", "Keterangan", "Ada foto"]];
    ambilAll.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((p) => {
      detBelanja.push([p.date, p.bahanNama || "", p.jumlah || 0, p.qtyYield || "", p.keterangan || "", p.fotoUrl ? "ya" : ""]);
    });
    XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(detBelanja)), "Detail Belanja");

    const detMutasi = [["Tanggal", "Bahan", "Tipe", "Qty", "Menu", "Catatan"]];
    ledger.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((e) => {
      detMutasi.push([e.date, e.bahanNama || "", e.tipe, e.tipe === "koreksi" ? e.qtySign : e.qty, e.menuNama || "", e.note || ""]);
    });
    XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(detMutasi)), "Mutasi Stok");

    XLSX.writeFile(wb, "gudang-belanja-" + bulan + ".xlsx");
    pushNotif && pushNotif("Excel gudang-belanja-" + bulan + ".xlsx diunduh.", "success");
    return true;
  };

  var catatPemakaianProduksi = async ({ produksiId, menu, jumlah, date, note, force = false }) => {
    const pakai = hitungPemakaianBahanMenu(menu, jumlah);
    if (!pakai.length) return { ok: true, rows: [], warning: "Menu tanpa resep bahan — stok gudang tidak dipotong." };
    const cek = cekStokBahanCukupUntukProduksi(menu, jumlah);
    if (!cek.ok && !force) {
      return { ok: false, blocked: true, rows: pakai, kurang: cek.kurang };
    }
    const rows = pakai.map((p) => ({
      bahanId: p.bahanId,
      bahanNama: p.bahanNama,
      tipe: "produksi",
      qty: p.qty,
      date: date || today(),
      note: note || ("Produksi " + (menu?.nama || "") + " x" + jumlah),
      refType: "produksiCK",
      refId: produksiId,
      menuId: menu?.id || null,
      menuNama: menu?.nama || null,
      qtyMenu: jumlah
    }));
    await catatStokBahanRows(rows);
    const minus = pakai.filter((p) => getStokBahanSaldo(p.bahanId) < 0);
    return { ok: true, rows: pakai, minus, forced: !cek.ok && force, kurang: cek.kurang };
  };

  /** Catat selisih kas KURANG sebagai pengeluaran owner kategori selisih_kas (masuk laba/rugi). */
  var catatRugiSelisihKasSetoran = async (setoranRow) => {
    if (!setoranRow) return { ok: false, reason: "no-row" };
    const sel = Number(setoranRow.selisihKas);
    if (!Number.isFinite(sel) || sel >= -0.5) return { ok: false, reason: "bukan-kurang" };
    const existing = (S.get("pengeluaranOwner") || []).find((p) => p.setoranId === setoranRow.id && p.kategori === "selisih_kas");
    if (existing) return { ok: true, already: true, id: existing.id };
    const jumlah = Math.abs(sel);
    const row = {
      id: uid(),
      date: setoranRow.date || today(),
      ts: nowIso(),
      keterangan: "Selisih kas (kurang) — " + (setoranRow.branchName || setoranRow.branchId || "cabang") +
        (setoranRow.catatanKas ? " — " + setoranRow.catatanKas : ""),
      jumlah,
      kategori: "selisih_kas",
      branchId: setoranRow.branchId || null,
      branchName: setoranRow.branchName || null,
      setoranId: setoranRow.id,
      autoFromSetoran: true,
      version: "rugi-kas@2026-07"
    };
    let { error } = await sb.from("pengeluaranOwner").insert([row]);
    if (error && /column|schema|setoranId|autoFromSetoran|version/i.test(String(error.message || error))) {
      const slim = {
        id: row.id, date: row.date, ts: row.ts,
        keterangan: row.keterangan, jumlah: row.jumlah,
        kategori: "lainnya",
        branchId: row.branchId, branchName: row.branchName
      };
      const r2 = await sb.from("pengeluaranOwner").insert([slim]);
      error = r2.error;
    }
    if (error) throw error;
    await S.loadKey("pengeluaranOwner");
    return { ok: true, id: row.id, jumlah };
  };
  var batalkanPemakaianProduksi = async (produksiId) => {
    if (!produksiId) return;
    const ledger = getStokBahanLedger();
    const related = ledger.filter((e) => e.refType === "produksiCK" && e.refId === produksiId && e.tipe === "produksi");
    if (!related.length) return { ok: true, reversed: 0 };
    // jangan dobel retur
    const already = new Set(ledger.filter((e) => e.tipe === "retur_produksi" && e.refId === produksiId).map((e) => e.bahanId + ":" + e.qty));
    const rows = related.filter((e) => !already.has(e.bahanId + ":" + e.qty)).map((e) => ({
      bahanId: e.bahanId,
      bahanNama: e.bahanNama,
      tipe: "retur_produksi",
      qty: e.qty,
      date: today(),
      note: "Retur stok karena hapus produksi",
      refType: "produksiCK",
      refId: produksiId,
      menuId: e.menuId,
      menuNama: e.menuNama,
      qtyMenu: e.qtyMenu
    }));
    if (rows.length) await catatStokBahanRows(rows);
    return { ok: true, reversed: rows.length };
  };

  // ─── Owner Expense helper (dipakai di beberapa tempat) ─────────────────────
  var getOwnerExpenseSummary = (entries, branchId, activeBranchIds = []) => {
    const rows = Array.isArray(entries) ? entries : [];
    if (branchId === "all") {
      const total = rows.reduce((a, p) => a + (parseFloat(p.jumlah || 0) || 0), 0);
      return { total, direct: total, shared: 0, relevantRows: rows };
    }
    const directRows = rows.filter((p) => p.branchId === branchId);
    const globalRows = rows.filter((p) => !p.branchId);
    const count = Math.max(activeBranchIds.length || 0, 1);
    const direct = directRows.reduce((a, p) => a + (parseFloat(p.jumlah || 0) || 0), 0);
    const sharedBase = globalRows.reduce((a, p) => a + (parseFloat(p.jumlah || 0) || 0), 0);
    const shared = sharedBase / count;
    return { total: direct + shared, direct, shared, relevantRows: [...directRows, ...globalRows] };
  };

  // ─── UI Primitives ─────────────────────────────────────────────────────────
  function Modal({ title, onClose, children }) {
    return React.createElement("div", { className: "modal-backdrop", onClick: onClose },
      React.createElement("div", { className: "modal-box", onClick: (e) => e.stopPropagation() },
        React.createElement("div", { className: "modal-header" },
          React.createElement("span", null, title),
          React.createElement("button", { className: "btn-icon", "aria-label": "Tutup", onClick: onClose }, "X")
        ),
        React.createElement("div", { className: "modal-body" }, children)
      )
    );
  }

  function Notif({ msg, type, onClose }) {
    useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
    return React.createElement("div", { className: "notif notif-" + type },
      React.createElement("span", { style: { flex: 1 } }, msg),
      React.createElement("button", { onClick: onClose }, "X")
    );
  }

  // ─── RowMenu — dropdown "⋮" reusable untuk aksi per-baris (Edit/Hapus/dll) ──
  // actions: [{ label, onClick, danger? }]
  function RowMenu({ actions }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return;
      const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);
    return React.createElement("div", { className: "row-menu", ref },
      React.createElement("button", { className: "row-menu-btn", onClick: () => setOpen((o) => !o), "aria-label": "Menu aksi" }, "\u22EE"),
      open && React.createElement("div", { className: "row-menu-dropdown" },
        actions.map((a, i) => React.createElement("button", {
          key: i,
          className: "row-menu-item" + (a.danger ? " row-menu-item-danger" : ""),
          onClick: () => { setOpen(false); a.onClick(); }
        }, a.label))
      )
    );
  }

  // ─── ConfirmModal — dialog konfirmasi generik (terutama untuk Hapus) ───────
function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, danger, confirmBusy, requireText, textLabel, textPlaceholder, initialText, textHelp }) {
  const [text, setText] = useState(initialText || "");
  useEffect(() => { setText(initialText || ""); }, [initialText, title, message]);
  const mustFillText = !!requireText;
  const isConfirmDisabled = !!confirmBusy || (mustFillText && !String(text || "").trim());
  return React.createElement("div", { className: "modal-backdrop", onClick: () => !confirmBusy && onCancel && onCancel() },
    React.createElement("div", { className: "modal-box modal-box-sm", onClick: (e) => e.stopPropagation() },
      React.createElement("div", { className: "modal-header" }, title || "Konfirmasi"),
      React.createElement("div", { className: "modal-body" },
        React.createElement("p", { style: { whiteSpace: "pre-line" } }, message || "Apakah Anda yakin?"),
        mustFillText && React.createElement("div", { className: "field-group", style: { marginTop: 10 } },
          React.createElement("label", null, textLabel || "Alasan"),
          React.createElement("textarea", {
            className: "inp",
            rows: 3,
            value: text,
            placeholder: textPlaceholder || "Tulis alasan singkat...",
            onChange: (e) => setText(e.target.value),
            disabled: !!confirmBusy,
            style: { resize: "vertical", minHeight: 88 }
          }),
          textHelp && React.createElement("div", { className: "info-txt mt8" }, textHelp)
        ),
        React.createElement("div", { className: "row-wrap", style: { justifyContent: "flex-end", marginTop: 8 } },
          React.createElement("button", { className: "btn-secondary", onClick: onCancel, disabled: !!confirmBusy }, "Batal"),
          React.createElement("button", {
            className: danger === false ? "btn-primary" : "btn-danger-confirm",
            onClick: () => onConfirm && onConfirm(text),
            disabled: isConfirmDisabled
          }, confirmBusy ? "Memproses..." : (confirmLabel || "Ya, Hapus"))
        )
      )
    )
  );
}

// ─── DateField — kotak custom menampilkan "Jum, 26 Jun 2026" langsung di
// dalamnya. Input <input type="date"> native ditumpuk transparan di atas
// supaya tap di kotak ini membuka date-picker bawaan device, tanpa perlu
// bikin calendar widget sendiri (lebih aman & familiar untuk user).
function DateField({ value, onChange, className }) {
  return React.createElement("div", { className: "date-field" },
    React.createElement("input", { type: "date", className: "date-field-input", value: value, onChange }),
    React.createElement("div", { className: className ? className + " date-field-display" : "inp inp-sm date-field-display" },
      React.createElement("span", { className: "date-field-icon" }, "\uD83D\uDCC5"),
      React.createElement("span", null, formatTanggalIndoPendek(value))
    )
  );
}

// ─── useConfirm — hook kecil untuk memunculkan ConfirmModal dengan mudah ───
// Pakai: const confirm = useConfirm(); confirm({ message, onConfirm });
// EmptyState — empty screen yang mengajak aksi (UX polish 2026-07)
function EmptyState({ icon, title, desc, actionLabel, onAction }) {
  return React.createElement("div", { className: "empty-state" },
    icon ? React.createElement("div", { className: "empty-state-icon" }, icon) : null,
    React.createElement("div", { className: "empty-state-title" }, title || "Belum ada data"),
    desc ? React.createElement("div", { className: "empty-state-desc" }, desc) : null,
    actionLabel && onAction
      ? React.createElement("button", { type: "button", className: "btn-primary", onClick: onAction }, actionLabel)
      : null
  );
}

function useConfirm() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const ask = useCallback((opts) => {
    setBusy(false);
    setState(opts);
  }, []);
  const handleCancel = useCallback(() => {
    if (busy) return;
    setState(null);
  }, [busy]);
  const handleConfirm = useCallback(async (textValue) => {
    if (!state?.onConfirm) { setState(null); return; }
    let shouldClose = true;
    try {
      const result = state.onConfirm(textValue);
      if (result && typeof result.then === "function") {
        setBusy(true);
        await result;
      }
    } catch (err) {
      shouldClose = false;
    } finally {
      setBusy(false);
      if (shouldClose) setState(null);
    }
  }, [state]);
  const modal = state && React.createElement(ConfirmModal, {
    title: state.title,
    message: state.message,
    confirmLabel: state.confirmLabel,
    danger: state.danger,
    requireText: state.requireText,
    textLabel: state.textLabel,
    textPlaceholder: state.textPlaceholder,
    initialText: state.initialText,
    textHelp: state.textHelp,
    confirmBusy: busy,
    onCancel: handleCancel,
    onConfirm: handleConfirm
  });
  return [ask, modal];
}

  function BarChart({ data, height }) {
    const max = Math.max(...data.map((d) => Math.max(d.v1 || 0, d.v2 || 0)), 1);
    return React.createElement("div", { className: "bar-chart", style: { height: (height || 100) + 24 } },
      data.map((d, i) =>
        React.createElement("div", { key: i, className: "bar-col" },
          React.createElement("div", { className: "bar-wrap", style: { height: height || 100 } },
            React.createElement("div", { className: "bar-fill bar-a", style: { height: (d.v1 || 0) / max * 100 + "%" } }),
            React.createElement("div", { className: "bar-fill bar-b", style: { height: (d.v2 || 0) / max * 100 + "%" } })
          ),
          React.createElement("div", { className: "bar-label" }, d.label)
        )
      )
    );
  }

  // ─── LoginPage ─────────────────────────────────────────────────────────────
  function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const doLogin = async () => {
      setErr("");
      const u = String(username || "").trim();
      if (!u || !password) { setErr("Masukkan nama user/email dan password."); return; }
      try {
        setBusy(true);
        const emailFormat = u.includes("@") ? u : `${u.toLowerCase()}@evoradonuts.local`;
        const { error } = await sb.auth.signInWithPassword({ email: emailFormat, password });
        if (error) throw error;
      } catch (ex) {
        setErr(ex?.message || String(ex));
      } finally {
        setBusy(false);
      }
    };

    return React.createElement("div", { className: "login-wrap" },
      React.createElement("div", { className: "login-card" },
        React.createElement("div", { style: { fontSize: 52, textAlign: "center" } }, "EVORA DONUTS"),
        React.createElement("h1", { className: "login-title" }, "EVORA DONUTS"),
        React.createElement("p", { className: "login-sub" }, "Masuk dengan nama user dan kata sandi."),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Nama User / Email"),
          React.createElement("input", { className: "inp", value: username, onChange: (e) => setUsername(e.target.value), onKeyDown: (e) => e.key === "Enter" && doLogin(), placeholder: "Ketik nama user atau email..." })
        ),
        React.createElement("div", { className: "field-group", style: { marginTop: 8 } },
          React.createElement("label", null, "Kata Sandi"),
          React.createElement("div", { style: { position: "relative", display: "flex", alignItems: "center" } },
            React.createElement("input", { className: "inp", type: showPassword ? "text" : "password", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: (e) => e.key === "Enter" && doLogin(), placeholder: "Masukkan kata sandi..." }),
            React.createElement("button", { type: "button", style: { position: "absolute", right: 10, background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 11, fontWeight: "700" }, onClick: () => setShowPassword(!showPassword) }, showPassword ? "SEMBUNYIKAN" : "LIHAT")
          )
        ),
        err && React.createElement("p", { style: { color: "var(--red)", fontSize: 13, marginTop: 4 } }, err),
        React.createElement("button", { className: "btn-primary btn-full", onClick: doLogin, disabled: busy, style: { marginTop: 12 } }, busy ? "Memverifikasi..." : "Masuk"),
        React.createElement("p", { className: "login-hint" }, "Kasir cukup ketik nama pendek (tanpa email).")
      )
    );
  }

  // ─── PengeluaranLapak (Kasir input pengeluaran harian) ─────────────────────
  function PengeluaranLapak({ branchId, branchName, date, pushNotif }) {
    const getList = () => (S.get("pengeluaranLapak") || []).filter((p) => p.branchId === branchId && p.date === date);
    const [list, setList] = useState(getList);
    const [form, setForm] = useState({ keterangan: "", jumlah: "" });
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState({ keterangan: "", jumlah: "" });
    const [confirmAsk, confirmModal] = useConfirm();
    const refresh = () => setList(getList());
    const CHIPS = ["Kantong Plastik", "Ongkos kirim", "Transportasi", "Tisu", "Kemasan", "Lain-lain"];

    const tambah = () => {
      if (!form.keterangan || !form.jumlah) { pushNotif("Isi semua kolom!", "warning"); return; }
      const all = S.get("pengeluaranLapak") || [];
      S.set("pengeluaranLapak", [...all, { id: uid(), branchId, branchName, date, ts: tsForDate(date), keterangan: form.keterangan, jumlah: parseFloat(form.jumlah) }]);
      setForm({ keterangan: "", jumlah: "" });
      refresh();
      pushNotif("Pengeluaran dicatat!", "success");
    };

    const mulaiEdit = (p) => { setEditId(p.id); setEditForm({ keterangan: p.keterangan, jumlah: String(p.jumlah) }); };
    const simpanEdit = () => {
      const jml = parseFloat(editForm.jumlah);
      if (!editForm.keterangan || !jml || jml <= 0) { pushNotif("Isi keterangan & jumlah valid.", "warning"); return; }
      S.set("pengeluaranLapak", (S.get("pengeluaranLapak") || []).map((x) => x.id === editId ? { ...x, keterangan: editForm.keterangan, jumlah: jml } : x));
      setEditId(null); refresh(); pushNotif("Pengeluaran diperbarui.", "success");
    };
    const doHapus = (id) => { S.set("pengeluaranLapak", (S.get("pengeluaranLapak") || []).filter((x) => x.id !== id)); refresh(); pushNotif("Pengeluaran dihapus.", "warning"); };
    const hapus = (p) => confirmAsk({ title: "Hapus Pengeluaran", message: `Hapus "${p.keterangan}" (${fmtRp(p.jumlah)})?`, danger: true, confirmLabel: "Hapus", onConfirm: () => doHapus(p.id) });
    const total = list.reduce((a, p) => a + p.jumlah, 0);

    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title" }, "Pengeluaran Lapak - ", formatTanggalIndo(date)),
      React.createElement("p", { className: "info-txt" }, "Catat pengeluaran harian di lapak. Dilaporkan ke Owner."),
      React.createElement("div", { className: "chips mt8" }, CHIPS.map((s) => React.createElement("button", { key: s, className: "chip", onClick: () => setForm((f) => ({ ...f, keterangan: s })) }, s))),
      React.createElement("div", { className: "form-card mt8" },
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Keterangan"),
          React.createElement("input", { className: "inp", value: form.keterangan, onChange: (e) => setForm((f) => ({ ...f, keterangan: e.target.value })), placeholder: "Contoh: Beli kantong plastik" })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Jumlah (Rp)"),
          React.createElement("input", { className: "inp", type: "number", value: form.jumlah, onChange: (e) => setForm((f) => ({ ...f, jumlah: e.target.value })), placeholder: "5000" })
        ),
        React.createElement("button", { className: "btn-primary", onClick: tambah }, "+ Tambah")
      ),
      list.length === 0 && React.createElement("p", { className: "empty-txt mt8" }, "Belum ada pengeluaran hari ini"),
      list.length > 0 && React.createElement("div", { className: "mt8" },
        list.map((p) =>
          editId === p.id
            ? React.createElement("div", { key: p.id, className: "peng-row", style: { flexWrap: "wrap", gap: 6 } },
                React.createElement("input", { className: "inp inp-sm", style: { flex: 2, minWidth: 120 }, value: editForm.keterangan, onChange: (e) => setEditForm((f) => ({ ...f, keterangan: e.target.value })) }),
                React.createElement("input", { className: "inp inp-sm", type: "number", style: { flex: 1, minWidth: 90 }, value: editForm.jumlah, onChange: (e) => setEditForm((f) => ({ ...f, jumlah: e.target.value })) }),
                React.createElement("button", { className: "btn-primary btn-sm", onClick: simpanEdit }, "Simpan"),
                React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => setEditId(null) }, "Batal")
              )
            : React.createElement("div", { key: p.id, className: "peng-row" },
                React.createElement("div", { className: "peng-info" },
                  React.createElement("span", { className: "peng-ket" }, p.keterangan),
                  React.createElement("span", { className: "peng-ts" }, p.ts)
                ),
                React.createElement("div", { className: "peng-right" },
                  React.createElement("span", { className: "peng-jml" }, fmtRp(p.jumlah)),
                  React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => mulaiEdit(p), "aria-label": "Edit" }, "\u270F\uFE0F"),
                  React.createElement("button", { className: "btn-danger-sm", onClick: () => hapus(p), "aria-label": "Hapus" }, "X")
                )
              )
        ),
        React.createElement("div", { className: "peng-total" }, "Total: ", React.createElement("strong", null, fmtRp(total)))
      ),
      confirmModal
    );
  }

  // ─── EditTxModal (dipakai HANYA dari OwnerLaporan, bukan WorkerPage kasir) ─
  function EditTxModal({ tx, onClose, onSave }) {
    const [items, setItems] = useState(tx.items.map((x) => ({ ...x })));
    const [alasan, setAlasan] = useState("");
    const changeQty = (id, qty) => {
      if (qty <= 0) { setItems((i) => i.filter((x) => x.id !== id)); return; }
      setItems((i) => i.map((x) => x.id === id ? { ...x, qty } : x));
    };
    return React.createElement(Modal, { title: "Edit Transaksi", onClose },
      React.createElement("p", { className: "info-txt" }, "Perubahan ini dicatat dan dilaporkan ke log."),
      items.map((it) =>
        React.createElement("div", { key: it.id, className: "cart-item" },
          React.createElement("span", { style: { flex: 1 } }, it.nama),
          React.createElement("input", { type: "number", min: "0", className: "inp inp-sm", style: { width: 60 }, value: it.qty, onChange: (e) => changeQty(it.id, parseInt(e.target.value) || 0) }),
          React.createElement("span", { style: { minWidth: 80, textAlign: "right" } }, fmtRp(it.hargaJual * it.qty))
        )
      ),
      React.createElement("div", { className: "field-group mt8" },
        React.createElement("label", null, "Alasan Edit (wajib)"),
        React.createElement("input", { className: "inp", value: alasan, onChange: (e) => setAlasan(e.target.value), placeholder: "Contoh: salah input qty..." })
      ),
      React.createElement("div", { className: "row-wrap mt8" },
        React.createElement("button", { className: "btn-secondary", onClick: onClose }, "Batal"),
        React.createElement("button", { className: "btn-primary", onClick: () => { if (!alasan.trim()) { pushNotif("Wajib isi alasan!", "warning"); return; } onSave(tx.id, items, alasan); } }, "Simpan")
      )
    );
  }

  // ─── DistribusiKonfirmCard — helper untuk konfirmasi distribusi di WorkerPage
  function DistribusiKonfirmCard({ d, pushNotif }) {
    const [jumlahTerima, setJumlahTerima] = useState(String(d.jumlahKirim || ""));
    const [catatan, setCatatan] = useState("");
    const [busy, setBusy] = useState(false);
    const konfirmasi = async () => {
      const jml = parseInt(jumlahTerima);
      if (isNaN(jml) || jml < 0) { pushNotif("Jumlah tidak valid.", "warning"); return; }
      const selisih = jml - (d.jumlahKirim || 0);
      setBusy(true);
      try {
        // Jika distribusi baru memakai transfer normalized, konfirmasi line secara atomic.
        if (d.transferId) {
          const { data: line, error: lineError } = await sb.from("stock_transfer_lines").select("id").eq("transfer_id", d.transferId).eq("to_branch_id", d.branchId).eq("menu_id", d.menuId).maybeSingle();
          if (lineError) throw lineError;
          if (line?.id) {
            const { error: receiveError } = await sb.rpc("confirm_stock_transfer_line", { p_line_id: line.id, p_quantity_good: jml, p_quantity_damaged: 0, p_quantity_missing: Math.max(0, (d.jumlahKirim || 0) - jml), p_note: catatan.trim() || null });
            if (receiveError) throw receiveError;
          }
        }
        const { error } = await sb.from("distribusiCK").update({ jumlahTerima: jml, selisih, catatanSelisih: catatan.trim(), status: "diterima", confirmedAt: nowIso() }).eq("id", d.id);
        if (error) throw error;
        await S.loadKey("distribusiCK");
        // ─── Tambah stok lapak sebesar jumlah yang BENAR-BENAR diterima ───
        if (jml > 0) {
          const stoks = S.get("stokLapak") || [];
          const existing = stoks.find((s) => s.branchId === d.branchId && s.menuId === d.menuId);
          await upsertStokLapak(d.branchId, d.menuId, (existing?.stok || 0) + jml, existing);
          await S.loadKey("stokLapak");
        }
        pushNotif("Distribusi dikonfirmasi! Stok lapak diperbarui.", "success");
      } catch(e) { pushNotif(e?.message || String(e), "warning"); }
      finally { setBusy(false); }
    };
    return React.createElement("div", { className: "form-card", style: { borderColor: "var(--yellow)", background: "color-mix(in srgb, var(--yellow) 10%, var(--bg2))", marginBottom: 8 } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 8 } },
        React.createElement("div", null,
          React.createElement("strong", null, d.menuNama),
          React.createElement("div", { style: { fontSize: 12, color: "var(--text2)" } }, formatTanggalIndoPendek(d.date), " | Dikirim: ", React.createElement("strong", { style: { color: "var(--green)" } }, d.jumlahKirim, " pcs"))
        ),
        d.status === "perjalanan"
          ? React.createElement("span", { style: { fontSize: 11, color: "var(--blue)", fontWeight: 700 } }, "\uD83D\uDEF5 KURIR DATANG")
          : React.createElement("span", { style: { fontSize: 11, color: "var(--yellow)", fontWeight: 700 } }, "\u23F3 BELUM DIAMBIL")
      ),
      React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Jumlah yang benar-benar diterima (pcs)"),
        React.createElement("input", { type: "number", className: "inp", value: jumlahTerima, onChange: (e) => setJumlahTerima(e.target.value), min: 0 })
      ),
      parseInt(jumlahTerima) !== d.jumlahKirim && React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Catatan selisih (wajib jika beda)"),
        React.createElement("input", { type: "text", className: "inp", placeholder: "Contoh: 5 pcs rusak saat pengiriman...", value: catatan, onChange: (e) => setCatatan(e.target.value) })
      ),
      React.createElement("button", { className: "btn-primary", disabled: busy, onClick: konfirmasi }, busy ? "Menyimpan..." : "Konfirmasi Terima")
    );
  }

  
  // ─── REVISI #2: WorkerPage — Tombol Edit HANYA tampil di mode="owner" ──────
  function WorkerPage({ pushNotif, me, mode = "worker", historyMode }) {
    const tick = useStoreTick();
    const [tab, setTab] = useState("kasir");
    const [kasirKat, setKasirKat] = useState("semua");
    const [kasirSimple, setKasirSimple] = useState(() => {
      try { return localStorage.getItem("donatboss_kasir_simple") === "1"; } catch { return false; }
    });
    const toggleKasirSimple = () => {
      setKasirSimple((v) => {
        const next = !v;
        try { localStorage.setItem("donatboss_kasir_simple", next ? "1" : "0"); } catch {}
        return next;
      });
    };
    const [cartOpen, setCartOpen] = useState(false);
    const [payMetode, setPayMetode] = useState("tunai");
    const [payTunai, setPayTunai] = useState("");
    const [payNonTunai, setPayNonTunai] = useState("");
    const [diskonTipe, setDiskonTipe] = useState("none"); // "none" | "persen" | "nominal"
    const [diskonInput, setDiskonInput] = useState("");
    const [mixBox, setMixBox] = useState(null); // { menu, isian: [menuId,...], toping: [{id,nama,hpp,hargaJual}] } saat memilih rasa box campur
    const [glazePick, setGlazePick] = useState(null); // { menu } saat memilih glaze untuk donat satuan
    const [slotBox, setSlotBox] = useState(null); // { menu, slots:[{glaze, toping:[]}] } box per-slot polos
    const [slotOpenIdx, setSlotOpenIdx] = useState(0); // accordion: donat yang sedang dibuka
    const [checkoutSisa, setCheckoutSisa] = useState(null); // { rows:[{menuId,menuNama,qtyLama,qtyBaru,aksiBaru}] } modal tutup toko
    const [checkoutBusy, setCheckoutBusy] = useState(false);
    const [autoPrint, setAutoPrint] = useState(() => {
      try { return localStorage.getItem("donatboss_auto_print") !== "0"; } catch { return true; }
    });
    const [offlineCount, setOfflineCount] = useState(() => (typeof getOfflineTxQueue === "function" ? getOfflineTxQueue().length : 0));
    const [payBusy, setPayBusy] = useState(false);
    const [lastReceiptTx, setLastReceiptTx] = useState(null);
    const [presetRasa, setPresetRasa] = useState([]);
    useEffect(() => {
      sb.from("app_settings").select("value").eq("key", "preset_rasa").maybeSingle()
        .then(({ data }) => setPresetRasa(Array.isArray(data?.value) ? data.value : []))
        .catch(() => setPresetRasa([]));
    }, [tick]);
    useEffect(() => {
      const sync = () => {
        try { setOfflineCount(getOfflineTxQueue().length); } catch {}
        flushOfflineTxQueue(pushNotif).then(() => {
          try { setOfflineCount(getOfflineTxQueue().length); } catch {}
        }).catch(() => {});
      };
      sync();
      const onOnline = () => sync();
      try { window.addEventListener("online", onOnline); } catch {}
      const iv = setInterval(sync, 20000);
      return () => { try { window.removeEventListener("online", onOnline); } catch {} clearInterval(iv); };
    }, [pushNotif]);
    const [branches, setBranches] = useState(() => S.get("branches") || []);
    const [branchId, setBranchId] = useState(() => me?.branchId || (S.get("branches") || [{}])[0]?.id || "");
    const [menus, setMenus] = useState(() => S.get("menuVarian") || []);
    const [topings, setTopings] = useState(() => S.get("topingTambahan") || []);
    const [cart, setCart] = useState([]);
    // Worker: txDate dikunci ke hari ini, tidak bisa diubah (anti manipulasi)
    // Owner (mode="owner"): bebas pilih tanggal
    const [txDate, setTxDate] = useState(today());
    const historyModeActive = mode !== "owner" && isHistoryModeAllowedForBranch(historyMode, me?.branchId || branchId);
    const canChangeDate = mode === "owner" || historyModeActive;
    // Kalau worker, selalu paksa ke today() setiap render
    const safeTxDate = canChangeDate ? txDate : today();
    // REVISI #2: editModal hanya dipakai kalau mode === "owner"
    const [editModal, setEditModal] = useState(null);
    const userId = me?.user_id;
    const profiles = mode === "owner" ? (S.get("profiles") || []).filter(isActiveProfile) : [];

    useEffect(() => {
      setBranches(S.get("branches") || []);
      setMenus(S.get("menuVarian") || []);
      setTopings(S.get("topingTambahan") || []);
      if (me?.branchId) setBranchId(me.branchId);
    }, [tick, me?.branchId]);
    useEffect(() => {
      if (!canChangeDate) {
        const td = today();
        if (txDate !== td) setTxDate(td);
      }
    }, [canChangeDate, txDate]);

    const curBranch = branches.find((b) => b.id === branchId);
    const transactions = (S.get("transactions") || []).filter((t) => t.branchId === branchId && t.date === safeTxDate);
    const branchOmzet = transactions.reduce((a, t) => a + t.total, 0);
    const branchPeng = (S.get("pengeluaranLapak") || []).filter((p) => p.branchId === branchId && p.date === safeTxDate).reduce((a, p) => a + p.jumlah, 0);

    // ─── Stok Lapak real-time ───
    const stokAll = S.get("stokLapak") || [];
    const getStok = (menuId) => stokAll.find((s) => s.branchId === branchId && s.menuId === menuId)?.stok || 0;
    // Untuk paket: stok yang relevan adalah stok menu satuan dasarnya (baseMenuId)
    const getStokUntukMenu = (menu) => {
      if (menu.tipe === "paket") {
        if (!menu.baseMenuId) return null; // belum dikonfigurasi, tidak divalidasi
        const isi = menu.isiBox || 1;
        return Math.floor(getStok(menu.baseMenuId) / isi);
      }
      return getStok(menu.id);
    };

    // ─── Validasi stok real-time terhadap isi keranjang (belum tersimpan ke DB) ─
    // Qty toping tidak dibatasi stok (toping bukan barang fisik bersaldo).
    // Untuk paket, beberapa box berbeda bisa berbagi baseMenuId yang sama (misal
    // Box isi 3 & Box isi 4 dari menu satuan "Original") - jadi qty yang sudah
    // terpakai di cart harus dihitung sebagai total PCS (qty x isiBox), bukan per-box.
    const getPcsTerpakaiDiCart = (baseMenuId) => {
      let total = 0;
      for (const item of cart) {
        const menuDef = menus.find((mm) => mm.id === item.menuId);
        if (!menuDef) continue;
        if (menuDef.tipe === "paket") {
          if (menuDef.baseMenuId === baseMenuId) total += item.qty * (menuDef.isiBox || 1);
        } else if (menuDef.id === baseMenuId) {
          total += item.qty;
        }
      }
      return total;
    };
    const getSisaStokSetelahCart = (menu) => {
      if (menu.tipe === "paket") {
        if (!menu.baseMenuId) return null;
        const stokPcsAwal = getStok(menu.baseMenuId);
        const pcsTerpakai = getPcsTerpakaiDiCart(menu.baseMenuId);
        return Math.floor((stokPcsAwal - pcsTerpakai) / (menu.isiBox || 1));
      }
      const stokAwal = getStok(menu.id);
      const pcsTerpakai = getPcsTerpakaiDiCart(menu.id);
      return stokAwal - pcsTerpakai;
    };

    // ─── Ringkasan Terjual & Sisa per menu (untuk hari yang sedang dilihat) ───
    const ringkasanPenjualan = useMemo(() => {
      const terjualMap = {}; // { menuId: { nama, tipe, qtyTerjual (unit asli: pcs utk satuan, box utk paket) } }
      for (const tx of transactions) {
        for (const it of tx.items || []) {
          if (it.tipe === "toping") continue;
          if (!terjualMap[it.menuId]) terjualMap[it.menuId] = { nama: it.nama, tipe: it.tipe, qtyTerjual: 0 };
          terjualMap[it.menuId].qtyTerjual += it.qty;
        }
      }
      const result = [];
      for (const m of menus) {
        if (m.tipe === "toping") continue;
        const sold = terjualMap[m.id]?.qtyTerjual || 0;
        const sisa = getStokUntukMenu(m); // null jika baseMenuId paket belum diset
        if (sold === 0 && (sisa === null || sisa === 0)) continue; // skip menu yang tidak relevan hari ini
        result.push({ menuId: m.id, nama: m.nama, tipe: m.tipe, satuan: m.tipe === "paket" ? "box" : "pcs", terjual: sold, sisa });
      }
      return result;
    }, [tick, transactions, menus, stokAll, branchId]);

    // Daftar glaze (dari topingTambahan berjenis "glaze")
    const glazeList = (topings || []).filter((t) => t.jenis === "glaze");
    // Toping tambahan = semua toping yang BUKAN glaze (dulu: semua). Backward-compatible:
    // toping lama tanpa field "jenis" dianggap toping tambahan.
    const topingTambahanList = (topings || []).filter((t) => t.jenis !== "glaze");

    const addToCart = (menu) => {
      // Box per-slot (donat polos + glaze/toping per donat)
      if (menu.tipe === "paket" && menu.boxMode === "slot") {
        const isi = menu.isiBox || 1;
        setSlotBox({ menu, slots: Array.from({ length: isi }, () => ({ glaze: null, toping: [] })) });
        setSlotOpenIdx(0);
        return;
      }
      // Box campur (mix & match): buka pemilih rasa dulu, jangan langsung masuk keranjang
      if (menu.tipe === "paket" && menu.mixMode) {
        setMixBox({ menu, isian: [], toping: [] });
        return;
      }
      // Donat satuan & ada pilihan glaze → buka pemilih glaze (harga tetap flat)
      if (menu.tipe !== "paket" && glazeList.length > 0) {
        setGlazePick({ menu });
        return;
      }
      const sisa = getSisaStokSetelahCart(menu);
      if (sisa !== null && sisa <= 0) { pushNotif("Stok " + menu.nama + " sudah mencapai batas.", "warning"); return; }
      setCart((c) => {
        const ex = c.find((x) => x.menuId === menu.id);
        if (ex) return c.map((x) => x.menuId === menu.id ? { ...x, qty: x.qty + 1 } : x);
        return [...c, { id: uid(), menuId: menu.id, topingId: null, nama: menu.nama, tipe: menu.tipe || "satuan", isiBox: menu.isiBox || null, hargaJual: menu.hargaJual, hpp: hitungHPP(menu), qty: 1 }];
      });
    };

    // Selesaikan pemilihan glaze → masuk keranjang (harga flat, glaze tercatat)
    const confirmGlaze = (glazeId) => {
      if (!glazePick) return;
      const menu = glazePick.menu;
      const glaze = glazeList.find((g) => g.id === glazeId) || null;
      const sisa = getSisaStokSetelahCart(menu);
      if (sisa !== null && sisa <= 0) { pushNotif("Stok " + menu.nama + " sudah mencapai batas.", "warning"); setGlazePick(null); return; }
      setCart((c) => {
        // gabung kalau menu+glaze sama persis
        const ex = c.find((x) => x.menuId === menu.id && x.glazeId === (glaze ? glaze.id : null));
        if (ex) return c.map((x) => x === ex ? { ...x, qty: x.qty + 1 } : x);
        return [...c, {
          id: uid(), menuId: menu.id, topingId: null,
          nama: menu.nama + (glaze ? " (" + glaze.nama + ")" : ""),
          tipe: menu.tipe || "satuan", isiBox: null,
          glazeId: glaze ? glaze.id : null, glazeNama: glaze ? glaze.nama : null,
          hargaJual: menu.hargaJual, hpp: hitungHPP(menu), qty: 1
        }];
      });
      setGlazePick(null);
    };

    // Selesaikan box per-slot (polos + glaze + toping) → 1 item keranjang
    const confirmSlotBox = () => {
      if (!slotBox) return;
      const { menu, slots } = slotBox;
      const isi = menu.isiBox || 1;
      // wajib tiap slot punya glaze (kalau ada daftar glaze)
      if (glazeList.length > 0 && slots.some((s) => !s.glaze)) {
        pushNotif("Tiap donat pilih glaze dulu.", "warning");
        return;
      }
      const baseId = menu.baseMenuId;
      const baseMenu = menus.find((m) => m.id === baseId);
      const hppPolos = baseMenu ? hitungHPP(baseMenu) : 0;
      const boxCost = roundHppRp(parseFloat(menu.boxCost || 0) || 0);
      // Hitung glaze porsi cost + toping. Toping ke-2 dst per slot = berbayar.
      let hppTotal = boxCost;
      let hargaTambahan = 0;
      const slotDesc = [];
      const glazeUsage = {}; // glazeId -> qty (untuk laporan)
      const topingBayarList = [];
      slots.forEach((s, i) => {
        hppTotal += hppPolos;
        let desc = "Donat " + (i + 1) + ": ";
        if (s.glaze) {
          const g = glazeList.find((x) => x.id === s.glaze);
          desc += (g ? g.nama : "glaze");
          glazeUsage[s.glaze] = (glazeUsage[s.glaze] || 0) + 1;
          if (g && g.hargaPerSatuan != null && g.porsiPerPcs) hppTotal += g.porsiPerPcs * g.hargaPerSatuan;
        }
        // toping: pertama gratis, sisanya berbayar
        (s.toping || []).forEach((tid, idx) => {
          const tp = topingTambahanList.find((t) => t.id === tid);
          if (!tp) return;
          desc += " +" + tp.nama;
          const hppTp = tp.hargaBahan != null ? tp.hargaBahan : roundHppRp((tp.hargaBeli || 0) / Math.max(tp.kapasitas || 1, 1));
          hppTotal += hppTp;
          if (idx >= 1) { // toping ke-2 dst → berbayar
            hargaTambahan += (tp.hargaJual || 0);
            topingBayarList.push(tp.nama);
          }
        });
        slotDesc.push(desc);
      });
      setCart((c) => [...c, {
        id: uid(), menuId: menu.id, topingId: null,
        nama: menu.nama + " (" + slots.map((s) => {
          const g = glazeList.find((x) => x.id === s.glaze);
          const tnama = (s.toping || []).map((tid) => (topingTambahanList.find((t) => t.id === tid) || {}).nama).filter(Boolean);
          return (g ? g.nama : "polos") + (tnama.length ? "+" + tnama.join("+") : "");
        }).join(", ") + ")",
        tipe: "paket", isiBox: isi, boxMode: "slot",
        slotIsi: slots.map((s) => ({ glaze: s.glaze, toping: (s.toping || []).slice() })),
        basePolosId: baseId, glazeUsage,
        hargaJual: (menu.hargaJual || 0) + hargaTambahan, hpp: roundHppRp(hppTotal), qty: 1
      }]);
      setSlotBox(null);
      pushNotif("Box ditambahkan." + (hargaTambahan > 0 ? " (+ toping tambahan " + fmtRp(hargaTambahan) + ")" : ""), "success");
    };

    // Selesaikan pemilihan box campur → jadikan 1 item keranjang
    const confirmMixBox = () => {
      if (!mixBox) return;
      const { menu, isian, toping } = mixBox;
      const isi = menu.isiBox || 1;
      if (isian.length !== isi) {
        pushNotif("Isi box harus " + isi + " pcs. Baru terpilih " + isian.length + ".", "warning");
        return;
      }
      // HPP box campur = jumlah HPP rasa yang dipilih + boxCost + HPP toping tambahan
      const boxCost = roundHppRp(parseFloat(menu.boxCost || 0) || 0);
      let hppIsi = 0;
      const rasaNama = [];
      for (const mid of isian) {
        const md = menus.find((m) => m.id === mid);
        if (md) { hppIsi += hitungHPP(md); rasaNama.push(md.nama); }
      }
      const hppToping = toping.reduce((a, t) => a + (t.hpp || 0), 0);
      const hargaToping = toping.reduce((a, t) => a + (t.hargaJual || 0), 0);
      const hppTotal = roundHppRp(hppIsi + boxCost + hppToping);
      // Ringkas nama rasa: "2 Coklat, 1 Keju"
      const hitung = {};
      rasaNama.forEach((n) => { hitung[n] = (hitung[n] || 0) + 1; });
      const ringkas = Object.entries(hitung).map(([n, q]) => q + " " + n).join(", ");
      const namaToping = toping.length ? " + " + toping.map((t) => t.nama).join(", ") : "";
      setCart((c) => [...c, {
        id: uid(), menuId: menu.id, topingId: null,
        nama: menu.nama + " (" + ringkas + ")" + namaToping,
        tipe: "paket", isiBox: isi, mixIsian: isian.slice(), mixToping: toping.slice(),
        hargaJual: (menu.hargaJual || 0) + hargaToping, hpp: hppTotal, qty: 1
      }]);
      setMixBox(null);
      pushNotif("Box ditambahkan ke keranjang.", "success");
    };

    const addToping = (tp) => setCart((c) => {
      const ex = c.find((x) => x.topingId === tp.id);
      if (ex) return c.map((x) => x.topingId === tp.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { id: uid(), menuId: null, topingId: tp.id, nama: tp.nama + " (Toping)", tipe: "toping", hargaJual: tp.hargaJual, hpp: tp.hargaBahan || 0, qty: 1 }];
    });

    const removeCart = (id) => setCart((c) => c.filter((x) => x.id !== id));

    // ─── Tambah/kurangi qty item yang sudah ada di keranjang, tanpa perlu hapus & input ulang ───
    const incCart = (id) => {
      setCart((c) => {
        const item = c.find((x) => x.id === id);
        if (!item) return c;
        if (item.menuId) {
          const menu = menus.find((m) => m.id === item.menuId);
          if (menu) {
            const sisa = getSisaStokSetelahCart(menu);
            if (sisa !== null && sisa <= 0) { pushNotif("Stok " + menu.nama + " sudah mencapai batas.", "warning"); return c; }
          }
        }
        return c.map((x) => x.id === id ? { ...x, qty: x.qty + 1 } : x);
      });
    };
    const decCart = (id) => {
      setCart((c) => c.map((x) => x.id === id ? { ...x, qty: x.qty - 1 } : x).filter((x) => x.qty > 0));
    };

    const subtotal = cart.reduce((a, x) => a + x.hargaJual * x.qty, 0);
    // Hitung diskon (dibatasi agar tidak melebihi subtotal & tidak negatif)
    const diskonRp = (() => {
      const v = parseFloat(diskonInput) || 0;
      if (v <= 0 || diskonTipe === "none") return 0;
      let d = diskonTipe === "persen" ? Math.round(subtotal * (Math.min(v, 100) / 100)) : v;
      return Math.max(0, Math.min(d, subtotal));
    })();
    const totalBayar = Math.max(0, subtotal - diskonRp);

    const submitTx = async (onSuccess) => {
      if (!cart.length) return;
      // REVISI #6: kasir wajib checkin KECUALI mode owner
      if (mode === "worker") {
        const abs = (S.get("absensi") || []).find((a) => a.user_id === userId && a.date === safeTxDate);
        if (!abs?.checkin_ts) { pushNotif("Silakan check-in absensi dulu sebelum input transaksi.", "warning"); return; }
        // Kalau sudah checkout, tidak bisa input transaksi
        if (abs?.checkout_ts) { pushNotif("Anda sudah Check-out hari ini. Tidak bisa input transaksi lagi.", "warning"); return; }
      }

      // ─── Hitung pengurangan stok per menu satuan (pcs) ───
      const pcsKonsumsi = {}; // { menuId: totalPcsBerkurang }
      const paketTanpaBase = [];
      for (const item of cart) {
        if (item.tipe === "toping") continue;
        const menuDef = menus.find((m) => m.id === item.menuId);
        if (!menuDef) continue;
        if (menuDef.tipe === "paket") {
          // Box per-slot polos: potong stok donat polos sebanyak isi box
          if (menuDef.boxMode === "slot" || (item.slotIsi && item.slotIsi.length)) {
            const baseId = item.basePolosId || menuDef.baseMenuId;
            const isi = item.slotIsi ? item.slotIsi.length : (menuDef.isiBox || 1);
            if (baseId) pcsKonsumsi[baseId] = (pcsKonsumsi[baseId] || 0) + (isi * item.qty);
            continue;
          }
          // Box campur: potong stok tiap rasa yang dipilih (tersimpan di item.mixIsian)
          if (menuDef.mixMode || (item.mixIsian && item.mixIsian.length)) {
            const isian = item.mixIsian || [];
            for (const mid of isian) {
              pcsKonsumsi[mid] = (pcsKonsumsi[mid] || 0) + item.qty; // item.qty box × 1 pcs rasa
            }
            continue;
          }
          if (!menuDef.baseMenuId) { paketTanpaBase.push(menuDef.nama); continue; }
          const pcs = item.qty * (menuDef.isiBox || 1);
          pcsKonsumsi[menuDef.baseMenuId] = (pcsKonsumsi[menuDef.baseMenuId] || 0) + pcs;
        } else {
          pcsKonsumsi[item.menuId] = (pcsKonsumsi[item.menuId] || 0) + item.qty;
        }
      }
      if (paketTanpaBase.length > 0) {
        pushNotif(`Box "${paketTanpaBase.join(", ")}" belum diatur "Menu Satuan Dasar"-nya. Lengkapi dulu di Seting > Menu & HPP > Box, sebelum bisa dijual.`, "warning");
        return;
      }

      // ─── Validasi ringan di client dulu — cuma supaya kasir cepat dapat
      // feedback kalau memang jelas kurang. Keputusan FINAL yang aman dari
      // race condition tetap ada di database lewat RPC di bawah (checklist #3.1):
      // kalau di antara validasi ini dan RPC dijalankan ada transaksi lain
      // yang lebih dulu menghabiskan stok, RPC akan menolak & transaksi ini
      // dibatalkan — bukan menimpa/mengurangi dari angka stok yang sudah basi.
      const stoksNow = S.get("stokLapak") || [];
      for (const [menuId, pcs] of Object.entries(pcsKonsumsi)) {
        const cur = stoksNow.find((s) => s.branchId === branchId && s.menuId === menuId);
        const sisa = cur?.stok || 0;
        if (sisa < pcs) {
          const menuNama = menus.find((m) => m.id === menuId)?.nama || menuId;
          pushNotif(`Stok "${menuNama}" hanya tersisa ${sisa} pcs, transaksi ini butuh ${pcs} pcs. Transaksi dibatalkan.`, "warning");
          return;
        }
      }

      const txId = uid();
      const itemsPayload = cart.map((x) => {
        const comp = getHppComponentsForItem(x);
        return { ...x, hppComponents: comp.components, hppComponentsTotal: comp.total };
      });
      const totalHPP = cart.reduce((a, x) => a + x.hpp * x.qty, 0);

      // ─── Data bayar (kasir pintar) ───
      const metode = payMetode || "tunai";
      let jumlahBayar = 0;
      let nonTunaiBayar = 0;
      let kembalian = 0;
      if (metode === "tunai") {
        jumlahBayar = parseFloat(payTunai);
        if (!Number.isFinite(jumlahBayar) || jumlahBayar < totalBayar) {
          pushNotif("Isi uang diterima (minimal total belanja " + fmtRp(totalBayar) + ").", "warning");
          return;
        }
        kembalian = Math.max(0, jumlahBayar - totalBayar);
        nonTunaiBayar = 0;
      } else if (metode === "qris" || metode === "transfer") {
        jumlahBayar = 0;
        nonTunaiBayar = totalBayar;
        kembalian = 0;
      } else if (metode === "campuran") {
        jumlahBayar = parseFloat(payTunai) || 0;
        nonTunaiBayar = parseFloat(payNonTunai) || 0;
        if (jumlahBayar < 0 || nonTunaiBayar < 0) {
          pushNotif("Nominal bayar tidak valid.", "warning");
          return;
        }
        if (jumlahBayar + nonTunaiBayar + 0.001 < totalBayar) {
          pushNotif("Tunai + non-tunai harus menutup total " + fmtRp(totalBayar) + ".", "warning");
          return;
        }
        // kembalian hanya dari kelebihan tunai di atas (total - nonTunai)
        const perluTunai = Math.max(0, totalBayar - nonTunaiBayar);
        kembalian = Math.max(0, jumlahBayar - perluTunai);
      }

      const payMeta = { metodeBayar: metode, jumlahBayar, nonTunaiBayar, kembalian, subtotal, diskon: diskonRp, diskonTipe: diskonRp > 0 ? diskonTipe : null };
      const receiptTx = {
        id: txId, date: safeTxDate, ts: tsForDate(safeTxDate),
        items: itemsPayload, total: totalBayar, totalHPP,
        ...payMeta
      };
      const branchName = (S.get("branches") || []).find((b) => b.id === branchId)?.name || branchId;

      const finishLocal = (msg, printed) => {
        setCart([]);
        setPayTunai("");
        setPayNonTunai("");
        setPayMetode("tunai");
        setDiskonTipe("none");
        setDiskonInput("");
        setLastReceiptTx({ ...receiptTx, branchName });
        pushNotif(msg, "success");
        if (autoPrint && !printed) {
          const pr = printReceipt(receiptTx, branchName, { autoPrint: true });
          if (!pr.ok) {
            pushNotif("Transaksi OK. Pop-up diblokir — buka Riwayat → Cetak ulang, atau izinkan pop-up.", "warning");
          }
        }
        onSuccess?.();
      };

      // ─── OFFLINE: antrekan, stok lokal dikurangi optimistik ───
      if (isProbablyOffline()) {
        enqueueOfflineTx({
          txId, branchId, date: safeTxDate, ts: tsForDate(safeTxDate),
          items: itemsPayload, total: totalBayar, totalHPP, pcsKonsumsi,
          ...payMeta
        });
        // kurangi stok lokal biar kasir tidak oversell kasar
        try {
          const stoks = S.get("stokLapak") || [];
          const next = stoks.map((s) => {
            if (s.branchId !== branchId) return s;
            const need = pcsKonsumsi[s.menuId] || 0;
            if (!need) return s;
            return { ...s, stok: Math.max(0, (s.stok || 0) - need) };
          });
          // update cache only (jangan persistDiff penuh saat offline)
          try { S.setLocal && null; } catch {}
          // pakai set tanpa menunggu server: override cache via loadKey skip — direct
          // S.set akan coba persist; untuk offline gunakan internal cache hack
          const before = S.get("stokLapak");
          // fallback: still try S.set - may fail silently via onError
          S.set("stokLapak", next);
        } catch {}
        setOfflineCount(getOfflineTxQueue().length);
        finishLocal("Offline: transaksi masuk antrian (" + getOfflineTxQueue().length + "). Akan terkirim saat online.", false);
        return;
      }

      // ─── ONLINE: RPC atomik ───
      setPayBusy(true);
      try {
        const { error } = await sb.rpc("submit_transaksi_lapak", {
          p_id: txId,
          p_branch_id: branchId,
          p_date: safeTxDate,
          p_ts: tsForDate(safeTxDate),
          p_items: itemsPayload,
          p_total: totalBayar,
          p_total_hpp: totalHPP,
          p_pcs_konsumsi: pcsKonsumsi,
        });

        if (error) {
          // Jika gagal jaringan, antrekan offline
          const msg = (error.message || String(error)).toLowerCase();
          if (/fetch|network|failed|timeout|offline/.test(msg)) {
            enqueueOfflineTx({
              txId, branchId, date: safeTxDate, ts: tsForDate(safeTxDate),
              items: itemsPayload, total: totalBayar, totalHPP, pcsKonsumsi, ...payMeta
            });
            setOfflineCount(getOfflineTxQueue().length);
            finishLocal("Jaringan bermasalah: transaksi diantrikan offline.", false);
            return;
          }
          const m = /STOK_KURANG:(.+)/.exec(error.message || "");
          if (m) {
            try {
              const info = JSON.parse(m[1]);
              const menuNama = menus.find((mm) => mm.id === info.menuId)?.nama || info.menuId;
              pushNotif(`Stok "${menuNama}" tinggal ${info.sisa} pcs saat transaksi diproses (kemungkinan baru saja terjual di kasir lain). Transaksi dibatalkan, cek ulang keranjang.`, "warning");
            } catch {
              pushNotif("Stok tidak cukup saat transaksi diproses. Transaksi dibatalkan, cek ulang keranjang.", "warning");
            }
          } else {
            pushNotif("Gagal menyimpan transaksi: " + (error.message || String(error)), "warning");
          }
          return;
        }

        // best-effort simpan metode bayar (jika kolom ada)
        try {
          await sb.from("transactions").update({
            metodeBayar: metode,
            jumlahBayar,
            nonTunaiBayar,
            kembalian
          }).eq("id", txId);
        } catch (e) { /* detail bayar gagal tersimpan; transaksi inti sudah aman */ pushNotif("Catatan detail bayar gagal tersimpan (transaksi tetap tercatat).", "warning"); }

        await Promise.all([S.loadKey("transactions"), S.loadKey("stokLapak")]);
        let printed = false;
        if (autoPrint) {
          const pr = printReceipt(receiptTx, branchName);
          printed = !!(pr && pr.ok);
          if (pr && !pr.ok && pr.reason === "popup-blocked") {
            pushNotif("Transaksi OK. Izinkan pop-up untuk cetak struk.", "warning");
          }
        }
        finishLocal("Transaksi disimpan! " + bayarLabel(metode) + (kembalian > 0 ? " · Kembalian " + fmtRp(kembalian) : ""), printed);
      } finally {
        setPayBusy(false);
      }
    };

    // REVISI #2: saveEdit hanya dipanggil dari owner, tetap ada di sini supaya mode="owner" bisa pakai
    const saveEdit = (txId, newItems, alasan) => {
      const txs = S.get("transactions") || [];
      const old = txs.find((x) => x.id === txId);
      if (!old) { pushNotif("Transaksi tidak ditemukan.", "warning"); setEditModal(null); return; }
      if (isSetoranLocked(old.branchId, old.date)) {
        pushNotif("Setoran hari itu sudah dikunci. Buka kunci dulu di menu Setoran sebelum mengedit transaksi.", "warning");
        setEditModal(null);
        return;
      }
      S.set("transactions", txs.map((t) => t.id === txId ? { ...t, items: newItems, total: newItems.reduce((a, x) => a + x.hargaJual * x.qty, 0), totalHPP: newItems.reduce((a, x) => a + x.hpp * x.qty, 0), edited: true } : t));
      const logs = S.get("editLog") || [];
      S.set("editLog", [...logs, { id: uid(), ts: tsForDate(safeTxDate), txId, branchId, branchName: curBranch?.name || branchId, alasan, before: old?.items || [], after: newItems }]);
      setEditModal(null);
      pushNotif("Transaksi diperbarui.", "warning");
    };

    const getSetoran = useCallback(() => {
      const s = S.get("setoranHarian") || [];
      return s.find((x) => x.branchId === branchId && x.date === safeTxDate) || { status: "belum" };
    }, [branchId, safeTxDate]);
    const [setoran, setSetoran] = useState(getSetoran);
    useEffect(() => setSetoran(getSetoran()), [getSetoran]);

    // REVISI 2026-07: rekonsiliasi kas fisik vs bersih sistem (omzet - pengeluaran lapak)
    const [kasForm, setKasForm] = useState({ tunaiFisik: "", nonTunai: "", catatan: "" });
    useEffect(() => {
      // reset form saat ganti cabang/tanggal; prefill dari setoran existing jika ada
      const s = getSetoran();
      if (s && s.status && s.status !== "belum") {
        setKasForm({
          tunaiFisik: s.tunaiFisik != null ? String(s.tunaiFisik) : "",
          nonTunai: s.nonTunai != null ? String(s.nonTunai) : "",
          catatan: s.catatanKas || ""
        });
      } else {
        setKasForm({ tunaiFisik: "", nonTunai: "", catatan: "" });
      }
    }, [branchId, safeTxDate, getSetoran]);

    const doSetoran = () => {
      const tunaiRaw = String(kasForm.tunaiFisik ?? "").trim();
      if (tunaiRaw === "") {
        pushNotif("Isi dulu uang tunai fisik di laci (boleh 0 jika semua non-tunai).", "warning");
        return;
      }
      const tunaiFisik = parseFloat(tunaiRaw);
      const nonTunai = parseFloat(kasForm.nonTunai || "0");
      if (!Number.isFinite(tunaiFisik) || tunaiFisik < 0) {
        pushNotif("Nominal tunai fisik tidak valid.", "warning");
        return;
      }
      if (!Number.isFinite(nonTunai) || nonTunai < 0) {
        pushNotif("Nominal non-tunai (QRIS/transfer) tidak valid.", "warning");
        return;
      }
      const kas = hitungSetoranKas({ omzet: branchOmzet, pengeluaran: branchPeng, tunaiFisik, nonTunai });
      const catatanKas = String(kasForm.catatan || "").trim();
      if (Math.abs(kas.selisihKas) >= 1 && !catatanKas) {
        pushNotif("Ada selisih kas. Wajib isi catatan (mis. kurang kembalian / tip / salah input).", "warning");
        return;
      }
      const s = S.get("setoranHarian") || [];
      const existing = s.find((x) => x.branchId === branchId && x.date === safeTxDate);
      if (existing && existing.status === "selesai" && existing.locked) {
        pushNotif("Setoran hari ini sudah dikonfirmasi & dikunci owner. Tidak bisa kirim ulang.", "warning");
        return;
      }
      const entry = {
        id: existing?.id || uid(),
        branchId,
        branchName: curBranch?.name || branchId,
        date: safeTxDate,
        ts: tsForDate(safeTxDate),
        status: "menunggu",
        omzet: kas.omzet,
        pengeluaran: kas.pengeluaran,
        bersihSistem: kas.bersihSistem,
        tunaiFisik: kas.tunaiFisik,
        nonTunai: kas.nonTunai,
        totalDiterima: kas.totalDiterima,
        selisihKas: kas.selisihKas,
        catatanKas: catatanKas || null,
        locked: existing?.locked || false,
        kasVersion: "2026-07"
      };
      S.set("setoranHarian", existing ? s.map((x) => x.id === entry.id ? { ...x, ...entry, locked: x.locked || false } : x) : [...s, entry]);
      setSetoran(entry);
      const info = fmtSelisihKas(kas.selisihKas);
      pushNotif(
        Math.abs(kas.selisihKas) < 1
          ? "Setoran dikirim. Kas PAS dengan sistem."
          : "Setoran dikirim. " + info.text + " — owner akan verifikasi.",
        Math.abs(kas.selisihKas) < 1 ? "success" : "warning"
      );
    };

    const allowSetoran = true;
    const TABS = allowSetoran ? ["kasir", "riwayat", "pengeluaran", "setoran", "shift", "absensi", "distribusi", "gaji"] : ["kasir", "riwayat", "pengeluaran", "shift", "absensi", "distribusi"];
    const TAB_LABELS = { kasir: "Kasir", riwayat: "Riwayat", pengeluaran: "Biaya toko", setoran: "Setoran", shift: "Kas", absensi: "Absen", distribusi: "Terima barang", gaji: "Gaji" };

    // ─── Absensi ───
    const [absMonth, setAbsMonth] = useState(today().slice(0, 7));
    const selectedAbs = useMemo(() => {
      const all = S.get("absensi") || [];
      return all.find((a) => a.user_id === userId && a.date === safeTxDate) || null;
    }, [tick, userId, safeTxDate]);

    // REVISI #6: blokir checkin jika hari libur atau sudah checkout
    const doCheckin = async () => {
      if (!userId) return;
      const targetDate = safeTxDate || today();
      const namaHari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][new Date(`${targetDate}T00:00:00`).getDay()];
      const jadwalLibur = S.get("jadwalLibur") || {};
      if (jadwalLibur[userId] && jadwalLibur[userId] === namaHari) {
        pushNotif(`Akses ditolak: tanggal ${targetDate} (${namaHari}) adalah jadwal libur Anda.`, "warning");
        return;
      }
      const all = S.get("absensi") || [];
      const ex = all.find((a) => a.user_id === userId && a.date === targetDate);
      if (ex?.checkin_ts) { pushNotif("Check-in untuk tanggal ini sudah ada.", "warning"); return; }
      const row = ex
        ? { ...ex, checkin_ts: isoForDate(targetDate), branchId: me?.branchId || branchId }
        : { id: uid(), user_id: userId, branchId: me?.branchId || branchId, date: targetDate, checkin_ts: isoForDate(targetDate), checkout_ts: null };
      S.set("absensi", ex ? all.map((a) => a.id === row.id ? row : a) : [...all, row]);

      // Check-in hanya membentuk kehadiran/gaji terutang; pembayaran payroll dilakukan terpisah.
      pushNotif("Check-in berhasil.", "success");
    };

    // REVISI #6: setelah checkout, form absensi dinonaktifkan (handled di render)
    // Saat checkout: sisa stok lapak hari itu dicatat sebagai "tidak terjual" (untuk laporan),
    // lalu stok di-reset ke 0 (donat sisa dianggap tidak bisa dijual lagi besok).
    // Hanya berlaku untuk lapak biasa (mode=worker, bukan Central Kitchen - CK tidak punya tab kasir).
    // Buka modal tutup toko: kumpulkan sisa stok per menu + pisahkan mana "lama" (wajib buang)
    const doCheckout = async () => {
      if (!userId) return;
      const all = S.get("absensi") || [];
      const ex = all.find((a) => a.user_id === userId && a.date === safeTxDate);
      if (!ex?.checkin_ts) { pushNotif("Belum ada check-in untuk tanggal ini.", "warning"); return; }
      if (ex?.checkout_ts) { pushNotif("Check-out sudah tercatat.", "warning"); return; }

      const stoksNow = (S.get("stokLapak") || []).filter((s) => s.branchId === branchId && (s.stok || 0) > 0);
      if (stoksNow.length === 0) {
        // tidak ada sisa → langsung checkout
        await finalizeCheckout([], ex);
        return;
      }
      // Donat "masuk" hari ini per menu (distribusi diterima hari ini) → dipakai hitung FIFO
      const distribHariIni = (S.get("distribusiCK") || []).filter((d) => d.branchId === branchId && d.date === safeTxDate && d.status !== "dibatalkan");
      const masukHariIniMap = {};
      distribHariIni.forEach((d) => { masukHariIniMap[d.menuId] = (masukHariIniMap[d.menuId] || 0) + (d.jumlahTerima != null ? d.jumlahTerima : (d.jumlahKirim || 0)); });
      const rows = stoksNow.map((s) => {
        const menuDef = menus.find((m) => m.id === s.menuId);
        const total = Number(s.stok) || 0;
        // FIFO: donat lama laku duluan. Sisa lama = max(0, total − donat masuk hari ini).
        // Dibatasi juga oleh carry lama yang memang tercatat (jaga-jaga).
        const carryLamaTercatat = getCarryLamaQty(branchId, s.menuId, safeTxDate);
        const qtyLama = Math.min(carryLamaTercatat, Math.max(0, total - (masukHariIniMap[s.menuId] || 0)));
        const qtyBaru = Math.max(0, total - qtyLama);
        return {
          menuId: s.menuId, menuNama: menuDef?.nama || s.menuId,
          hpp: menuDef ? hitungHPP(menuDef) : 0,
          qtyLama, qtyBaru, aksiBaru: "bawa", stokRow: s
        };
      });
      setCheckoutSisa({ rows, absId: ex.id });
    };

    // Proses pilihan checkout: buang(rugi) / bawa(carry ke besok)
    const finalizeCheckout = async (rows, exAbs) => {
      setCheckoutBusy(true);
      try {
        const all = S.get("absensi") || [];
        const ex = exAbs || all.find((a) => a.id === (checkoutSisa && checkoutSisa.absId));
        const catatanBuang = [];   // stokTidakTerjual (rugi) — hanya yang dibuang
        const carryBaru = [];      // batch baru dibawa ke besok
        for (const r of (rows || [])) {
          const buangBaru = r.aksiBaru === "buang" ? r.qtyBaru : 0;
          const bawaBaru = r.aksiBaru === "buang" ? 0 : r.qtyBaru;
          const totalBuang = (r.qtyLama || 0) + buangBaru; // lama SELALU dibuang
          if (totalBuang > 0) {
            catatanBuang.push({ id: uid(), branchId, date: safeTxDate, menuId: r.menuId, menuNama: r.menuNama, qtyTidakTerjual: totalBuang, ts: tsForDate(safeTxDate) });
          }
          if (bawaBaru > 0) {
            carryBaru.push({ id: uid(), branchId, menuId: r.menuId, menuNama: r.menuNama, batchDate: safeTxDate, qty: bawaBaru, ts: nowIso() });
          }
        }
        // 1) catat donat dibuang (rugi) ke stokTidakTerjual
        if (catatanBuang.length > 0) {
          const { error } = await sb.from("stokTidakTerjual").insert(catatanBuang);
          if (error) throw error;
        }
        // 2) update carry ledger: buang semua batch LAMA cabang ini (sudah dibuang di atas),
        //    lalu tambahkan batch baru yang dibawa. Pakai reload-fresh agar tidak menimpa
        //    perubahan cabang lain yang checkout bersamaan.
        await mutateLedger(
          loadDonatCarryFromDb,
          (list) => [...list.filter((e) => !(e.branchId === branchId && e.batchDate < safeTxDate)), ...carryBaru],
          saveDonatCarryToDb
        );
        // 3) set stok lapak = jumlah yang dibawa (carry), sisanya 0
        const bawaMap = {};
        carryBaru.forEach((c) => { bawaMap[c.menuId] = (bawaMap[c.menuId] || 0) + c.qty; });
        for (const r of (rows || [])) {
          const target = bawaMap[r.menuId] || 0;
          await upsertStokLapak(branchId, r.menuId, target, r.stokRow);
        }
        await Promise.all([S.loadKey("stokTidakTerjual"), S.loadKey("stokLapak")]);
        // 4) tandai checkout
        S.set("absensi", all.map((a) => a.id === (ex && ex.id) ? { ...a, checkout_ts: isoForDate(safeTxDate) } : a));
        const totalBawa = carryBaru.reduce((a, c) => a + c.qty, 0);
        const totalBuang = catatanBuang.reduce((a, c) => a + c.qtyTidakTerjual, 0);
        setCheckoutSisa(null);
        pushNotif("Check-out berhasil." + (totalBawa ? " " + totalBawa + " donat dibawa ke besok." : "") + (totalBuang ? " " + totalBuang + " dibuang (rugi)." : ""), "success");
      } catch (e) {
        pushNotif("Gagal proses tutup toko: " + (e?.message || String(e)), "warning");
      } finally {
        setCheckoutBusy(false);
      }
    };

    const myMonthRows = useMemo(() => {
      const all = S.get("absensi") || [];
      return all.filter((a) => a.user_id === userId && String(a.date || "").startsWith(absMonth));
    }, [tick, userId, absMonth]);

    const monthSnap = useMemo(() => {
      const snaps = S.get("absensiBulanan") || [];
      return snaps.find((s) => s.user_id === userId && s.bulan === absMonth && s.locked) || null;
    }, [tick, userId, absMonth]);

    const calcMonth = useMemo(() => {
      let hadir = 0, menit = 0;
      for (const r of myMonthRows) {
        if (r.checkin_ts) hadir += 1;
        if (r.checkin_ts && r.checkout_ts) {
          const a = Date.parse(r.checkin_ts), b = Date.parse(r.checkout_ts);
          if (!isNaN(a) && !isNaN(b) && b > a) menit += Math.floor((b - a) / 60000);
        }
      }
      return { hadir, menit };
    }, [myMonthRows]);

    // Hadir minggu ini (Senin-Minggu pekan berjalan), terpisah dari filter absMonth
    const myWeekHadir = useMemo(() => {
      const all = S.get("absensi") || [];
      const week = getWeekRange(today());
      return hitungHadirRange(all, userId, week.start, week.end);
    }, [tick, userId]);
    const myMonthHadirNow = useMemo(() => {
      const all = S.get("absensi") || [];
      const m = today().slice(0, 7);
      return all.filter((a) => a.user_id === userId && String(a.date || "").startsWith(m) && a.checkin_ts).length;
    }, [tick, userId]);

    const gajiMonth = String(safeTxDate || today()).slice(0, 7);
    const absensiAll = S.get("absensi") || [];
    const gajiPembayaranAll = S.get("gajiPembayaran") || [];
    const ownerBranchWorkers = useMemo(() => {
      if (mode !== "owner") return [];
      return profiles.filter((p) => p.role === "worker" && p.branchId === branchId);
    }, [profiles, mode, branchId]);
    const ownerGajiRows = useMemo(() => {
      if (mode !== "owner") return [];
      return ownerBranchWorkers.map((w) => {
        const h = hitungGajiDariAbsensi(w.user_id, absensiAll, gajiMonth, w.gajiHarian);
        const payment = gajiPembayaranAll.find((g) => g.user_id === w.user_id && g.bulan === gajiMonth) || null;
        return {
          userId: w.user_id,
          nama: w.display_name || w.displayName || w.email || w.user_id?.slice(0, 8) || "Pekerja",
          hadir: h.hadir,
          gajiHarian: h.gajiHarianTerakhir,
          jumlah: h.total,
          payment
        };
      }).sort((a, b) => (b.jumlah || 0) - (a.jumlah || 0));
    }, [mode, ownerBranchWorkers, absensiAll, gajiMonth, gajiPembayaranAll, tick]);
    const ownerGajiPendingCount = ownerGajiRows.filter((r) => r.payment?.status === "dikirim").length;
    const ownerGajiConfirmedCount = ownerGajiRows.filter((r) => r.payment?.status === "dikonfirmasi").length;
    const ownerGajiTotal = ownerGajiRows.reduce((a, r) => a + (r.jumlah || 0), 0);

    const sudahCheckout = !!selectedAbs?.checkout_ts;

    return React.createElement("div", { className: "page" },
      // ── Modal Tutup Toko: pilih donat sisa dibawa/dibuang ──
      checkoutSisa && React.createElement("div", { className: "modal-backdrop", onClick: () => !checkoutBusy && setCheckoutSisa(null) },
        React.createElement("div", { className: "cart-drawer", onClick: (e) => e.stopPropagation() },
          React.createElement("div", { className: "cart-drawer-handle" }),
          React.createElement("div", { className: "modal-header" },
            "\uD83C\uDF69 Tutup Toko \u2014 sisa donat",
            React.createElement("button", { className: "btn-icon", "aria-label": "Tutup", onClick: () => !checkoutBusy && setCheckoutSisa(null) }, "\u2715")
          ),
          React.createElement("div", { className: "cart-drawer-body" },
            React.createElement("p", { className: "info-txt", style: { marginTop: 0 } }, "Donat polos sisa masih bisa dijual besok. Pilih: bawa (masih bagus) atau buang (rusak). Donat kemarin yang belum laku wajib dibuang."),
            checkoutSisa.rows.map((r, i) => React.createElement("div", { key: r.menuId, className: "checkout-row" },
              React.createElement("div", { className: "checkout-row-name" },
                React.createElement("strong", null, r.menuNama),
                React.createElement("div", { className: "checkout-row-info" },
                  "Sisa " + (r.qtyLama + r.qtyBaru) + " pcs",
                  r.qtyLama > 0 ? React.createElement("span", { className: "checkout-badge-lama" }, " \u2022 " + r.qtyLama + " kemarin (wajib buang)") : null
                )
              ),
              r.qtyBaru > 0 && React.createElement("div", { className: "checkout-actions" },
                React.createElement("button", {
                  type: "button", className: "checkout-btn" + (r.aksiBaru === "bawa" ? " on-bawa" : ""),
                  onClick: () => setCheckoutSisa((s) => ({ ...s, rows: s.rows.map((x, j) => j === i ? { ...x, aksiBaru: "bawa" } : x) }))
                }, "Bawa " + r.qtyBaru + " \u2192 besok"),
                React.createElement("button", {
                  type: "button", className: "checkout-btn" + (r.aksiBaru === "buang" ? " on-buang" : ""),
                  onClick: () => setCheckoutSisa((s) => ({ ...s, rows: s.rows.map((x, j) => j === i ? { ...x, aksiBaru: "buang" } : x) }))
                }, "Buang " + r.qtyBaru)
              )
            )),
            (() => {
              const totalBuang = checkoutSisa.rows.reduce((a, r) => a + r.qtyLama + (r.aksiBaru === "buang" ? r.qtyBaru : 0), 0);
              const totalBawa = checkoutSisa.rows.reduce((a, r) => a + (r.aksiBaru === "buang" ? 0 : r.qtyBaru), 0);
              const rugiRp = checkoutSisa.rows.reduce((a, r) => a + (r.hpp || 0) * (r.qtyLama + (r.aksiBaru === "buang" ? r.qtyBaru : 0)), 0);
              return React.createElement("div", { className: "checkout-summary" },
                React.createElement("div", null, "Dibawa ke besok: ", React.createElement("strong", { style: { color: "var(--green)" } }, totalBawa + " pcs")),
                React.createElement("div", null, "Dibuang (rugi): ", React.createElement("strong", { style: { color: "var(--red)" } }, totalBuang + " pcs \u00B7 " + fmtRp(rugiRp)))
              );
            })(),
            React.createElement("div", { className: "row-wrap mt8" },
              React.createElement("button", { className: "btn-secondary", disabled: checkoutBusy, onClick: () => setCheckoutSisa(null) }, "Batal"),
              React.createElement("button", { className: "btn-primary", disabled: checkoutBusy, onClick: () => finalizeCheckout(checkoutSisa.rows, null) }, checkoutBusy ? "Memproses..." : "\u2705 Selesai Tutup Toko")
            )
          )
        )
      ),
      // Header
      React.createElement("div", { className: "page-header" },
        React.createElement("img", { className: "page-icon", src: getBrandLogo(), style: { width: 45, height: 45, objectFit: "cover", borderRadius: 10 } }),
        React.createElement("div", null,
          React.createElement("h2", null, "Halaman Kasir"),
          React.createElement("p", { className: "page-sub" }, curBranch?.name || "\u2014", curBranch?.workers?.length ? " - " + curBranch.workers.join(", ") : "")
        )
      ),
      // Filter tanggal & cabang
      React.createElement("div", { className: "row-wrap mb8" },
        React.createElement("select", { className: "inp inp-sm", value: branchId, onChange: (e) => setBranchId(e.target.value), disabled: !!me?.branchId },
          branches.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name))
        ),
        // Owner: bisa pilih tanggal bebas | Worker: tampil hari ini saja (tidak bisa diubah)
        canChangeDate
          ? React.createElement(DateField, { value: txDate, onChange: (e) => { const nd = e.target.value; setTxDate(nd); setAbsMonth(String(nd || today()).slice(0, 7)); } })
          : React.createElement("div", { className: "date-locked-badge" }, "\uD83D\uDCC5 ", formatTanggalIndoPendek(safeTxDate))
      ),
      mode === "worker" && React.createElement("p", { className: "info-txt mb8" },
        historyModeActive
          ? "Mode histori aktif untuk cabang ini. Kasir bisa pilih tanggal lain sesuai kebutuhan input owner."
          : "Tanggal pekerja dikunci ke hari ini. Owner bisa menyalakan mode histori bila perlu input tanggal lampau atau tanggal lain."
      ),
      // Tabs
      React.createElement("div", { className: "tabs" },
        TABS.map((t) => React.createElement("button", { key: t, className: "tab" + (tab === t ? " active" : ""), onClick: () => setTab(t) }, TAB_LABELS[t]))
      ),

      // ── Tab: Kasir ──
      tab === "kasir" && (() => {
        const menuSatuan = menus.filter((m) => m.tipe !== "paket" && m.tipe !== "toping");
        const menuPaket = menus.filter((m) => m.tipe === "paket");
        const showSatuan = kasirKat === "semua" || kasirKat === "satuan";
        const showPaket = kasirKat === "semua" || kasirKat === "paket";
        const showToping = kasirKat === "semua" || kasirKat === "toping";
        const cartCount = cart.reduce((a, x) => a + x.qty, 0);

        const renderCard = (m, isPaket, isToping) => {
          const stokSisa = isToping ? null : getSisaStokSetelahCart(m);
          const habis = stokSisa !== null && stokSisa <= 0;
          return React.createElement("button", {
            key: m.id,
            className: "menu-card2" + (kasirSimple ? " menu-card2-simple" : "") + (isPaket ? " menu-card2-paket" : "") + (isToping ? " menu-card2-toping" : "") + (habis ? " menu-card2-habis" : ""),
            onClick: () => isToping ? addToping(m) : addToCart(m),
            disabled: habis
          },
            stokSisa !== null && React.createElement("span", {
              className: "menu-card2-stok" + (habis ? " menu-card2-stok-habis" : stokSisa <= 5 ? " menu-card2-stok-low" : "")
            }, habis ? "HABIS" : (kasirSimple ? ("Sisa " + stokSisa) : stokSisa)),
            habis && React.createElement("div", { className: "menu-card2-habis-ribbon" }, "Stok habis"),
            m.imageUrl
              ? React.createElement("img", { src: m.imageUrl, alt: m.nama, className: "menu-card2-thumb" })
              : React.createElement("div", { className: "menu-card2-thumb menu-card2-thumb-placeholder" }, isPaket ? "\uD83D\uDCE6" : isToping ? "\u2728" : "\uD83C\uDF69"),
            React.createElement("div", { className: "menu-card2-body" },
              React.createElement("div", { className: "menu-card2-name" }, m.nama),
              isPaket && React.createElement("div", { className: "menu-card2-sub" }, "Isi ", m.isiBox, " pcs", m.boxMode === "slot" ? " \uD83E\uDED4 glaze/toping" : m.mixMode ? " \uD83C\uDF6A pilih rasa" : ""),
              React.createElement("div", { className: "menu-card2-price" }, fmtRp(m.hargaJual))
            )
          );
        };

        return React.createElement(React.Fragment, null,
          React.createElement("div", { className: "kasir-kat-chips" },
            React.createElement("button", {
              type: "button",
              className: "chip" + (kasirSimple ? " chip-active" : ""),
              onClick: toggleKasirSimple,
              title: "Tombol menu lebih besar untuk HP"
            }, kasirSimple ? "Tampilan besar: ON" : "Tampilan besar"),
            React.createElement("button", { className: "chip" + (kasirKat === "semua" ? " chip-active" : ""), onClick: () => setKasirKat("semua") }, "Semua"),
            React.createElement("button", { className: "chip" + (kasirKat === "satuan" ? " chip-active" : ""), onClick: () => setKasirKat("satuan") }, "\uD83C\uDF69 Satuan"),
            React.createElement("button", { className: "chip" + (kasirKat === "paket" ? " chip-active" : ""), onClick: () => setKasirKat("paket") }, "\uD83D\uDCE6 Box"),
            React.createElement("button", { className: "chip" + (kasirKat === "toping" ? " chip-active" : ""), onClick: () => setKasirKat("toping") }, "\u2728 Toping")
          ),
          React.createElement("div", { className: "kasir-menu-area" },
            showSatuan && menuSatuan.length > 0 && React.createElement(React.Fragment, null,
              React.createElement("h3", { className: "section-title mt8" }, "Menu Satuan"),
              React.createElement("div", { className: "menu-grid2" + (kasirSimple ? " menu-grid2-simple" : "") }, menuSatuan.map((m) => renderCard(m, false, false)))
            ),
            showPaket && menuPaket.length > 0 && React.createElement(React.Fragment, null,
              React.createElement("h3", { className: "section-title mt8" }, "Isi box"),
              React.createElement("div", { className: "menu-grid2" + (kasirSimple ? " menu-grid2-simple" : "") }, menuPaket.map((m) => renderCard(m, true, false)))
            ),
            showToping && topingTambahanList.length > 0 && React.createElement(React.Fragment, null,
              React.createElement("h3", { className: "section-title mt8" }, "Topping"),
              React.createElement("div", { className: "menu-grid2" + (kasirSimple ? " menu-grid2-simple" : "") }, topingTambahanList.map((t) => renderCard(t, false, true)))
            )
          ),
          // Modal box per-slot (donat polos + glaze + toping per donat)
          slotBox && (() => {
            const isi = slotBox.menu.isiBox || 1;
            const terisi = slotBox.slots.filter((s) => s.glaze || glazeList.length === 0).length;
            const penuh = glazeList.length === 0 ? true : slotBox.slots.every((s) => s.glaze);
            const setSlotGlaze = (i, gid) => setSlotBox((s) => { if (!s) return s; const sl = s.slots.slice(); sl[i] = { ...sl[i], glaze: gid }; return { ...s, slots: sl }; });
            const toggleSlotToping = (i, tid) => setSlotBox((s) => {
              if (!s) return s; const sl = s.slots.slice(); const cur = sl[i].toping || [];
              sl[i] = { ...sl[i], toping: cur.includes(tid) ? cur.filter((x) => x !== tid) : [...cur, tid] };
              return { ...s, slots: sl };
            });
            // set glaze lalu auto-buka donat berikutnya (accordion)
            const setSlotGlazeAuto = (i, gid) => { setSlotGlaze(i, gid); if (i < isi - 1) setSlotOpenIdx(i + 1); };
            const setSlotPreset = (i, preset) => {
              setSlotBox((s) => {
                if (!s) return s;
                const sl = s.slots.slice();
                sl[i] = { ...sl[i], glaze: preset.glazeId, toping: preset.toppingId ? [preset.toppingId] : [] };
                return { ...s, slots: sl };
              });
              if (i < isi - 1) setSlotOpenIdx(i + 1);
            };
            // hitung harga tambahan toping ke-2 dst
            let hargaTambahan = 0;
            slotBox.slots.forEach((s) => (s.toping || []).forEach((tid, idx) => { if (idx >= 1) { const tp = topingTambahanList.find((t) => t.id === tid); if (tp) hargaTambahan += (tp.hargaJual || 0); } }));
            const ringkasSlot = (s) => {
              if (!s.glaze && (!s.toping || !s.toping.length)) return "Belum dipilih";
              const g = glazeList.find((x) => x.id === s.glaze);
              const tnama = (s.toping || []).map((tid) => (topingTambahanList.find((t) => t.id === tid) || {}).nama).filter(Boolean);
              return (g ? g.nama : "polos") + (tnama.length ? " + " + tnama.join(", ") : "");
            };
            return React.createElement("div", { className: "modal-backdrop", onClick: () => setSlotBox(null) },
              React.createElement("div", { className: "cart-drawer", onClick: (e) => e.stopPropagation() },
                React.createElement("div", { className: "cart-drawer-handle" }),
                React.createElement("div", { className: "modal-header" },
                  slotBox.menu.nama + " (isi " + isi + ")",
                  React.createElement("button", { className: "btn-icon", "aria-label": "Tutup", onClick: () => setSlotBox(null) }, "\u2715")
                ),
                React.createElement("div", { className: "cart-drawer-body" },
                  React.createElement("div", { className: "slotbox-counter" + (penuh ? " slotbox-counter-full" : "") },
                    "Sudah dipilih ", React.createElement("strong", null, terisi + " / " + isi), " donat", penuh ? " \u2705" : ""
                  ),
                  React.createElement("p", { className: "info-txt", style: { margin: "8px 0 10px" } }, "Setiap donat: pilih 1 glaze + 1 topping dasar termasuk harga. Topping ke-2 dan seterusnya dihitung sebagai tambahan berbayar."),
                  slotBox.slots.map((s, i) => {
                    const open = slotOpenIdx === i;
                    const done = !!s.glaze || glazeList.length === 0;
                    return React.createElement("div", { key: i, className: "acc-slot" + (open ? " open" : "") },
                      React.createElement("div", { className: "acc-slot-head" + (done ? " done" : ""), onClick: () => setSlotOpenIdx(open ? -1 : i) },
                        React.createElement("span", { className: "acc-slot-num" }, done && !open ? "\u2713" : (i + 1)),
                        React.createElement("div", { className: "acc-slot-sum" },
                          React.createElement("div", { className: "acc-slot-title" }, "Donat " + (i + 1)),
                          React.createElement("div", { className: "acc-slot-desc" }, ringkasSlot(s))
                        ),
                        React.createElement("span", { className: "acc-slot-chev" }, open ? "\u25B2" : "\u25BC")
                      ),
                      open && React.createElement("div", { className: "acc-slot-body" },
                        glazeList.length > 0 && React.createElement(React.Fragment, null,
                          React.createElement("div", { className: "slot-lbl" }, "Glaze (pilih 1)"),
                          React.createElement("div", { className: "slot-opts" },
                            glazeList.map((g) => React.createElement("button", {
                              key: g.id, type: "button", className: "slot-opt" + (s.glaze === g.id ? " on" : ""),
                              onClick: () => setSlotGlazeAuto(i, g.id)
                            }, g.nama))
                          )
                        ),
                        topingTambahanList.length > 0 && React.createElement(React.Fragment, null,
                          React.createElement("div", { className: "slot-lbl" }, "Topping (pilih 1 termasuk harga; pilihan ke-2+ berbayar)"),
                          React.createElement("div", { className: "slot-opts" },
                            topingTambahanList.map((t) => {
                              const cur = s.toping || [];
                              const pos = cur.indexOf(t.id);
                              const bayar = pos >= 1;
                              return React.createElement("button", {
                                key: t.id, type: "button", className: "slot-opt slot-opt-top" + (pos >= 0 ? " on" : ""),
                                onClick: () => toggleSlotToping(i, t.id)
                              }, t.nama + (pos >= 0 && bayar ? " (+" + fmtRp(t.hargaJual || 0) + ")" : ""));
                            })
                          )
                        )
                      )
                    );
                  }),
                  React.createElement("div", { className: "row-wrap mt8" },
                    React.createElement("button", { className: "btn-secondary", onClick: () => setSlotBox(null) }, "Batal"),
                    React.createElement("button", { className: "btn-primary", disabled: !penuh, onClick: confirmSlotBox },
                      penuh ? ("Masukkan \u2022 " + fmtRp((slotBox.menu.hargaJual || 0) + hargaTambahan)) : "Lengkapi glaze tiap donat")
                  )
                )
              )
            );
          })(),
          // Modal pemilih glaze untuk donat satuan
          glazePick && React.createElement("div", { className: "modal-backdrop", onClick: () => setGlazePick(null) },
            React.createElement("div", { className: "cart-drawer", onClick: (e) => e.stopPropagation() },
              React.createElement("div", { className: "cart-drawer-handle" }),
              React.createElement("div", { className: "modal-header" },
                glazePick.menu.nama + " \u2014 pilih glaze",
                React.createElement("button", { className: "btn-icon", "aria-label": "Tutup", onClick: () => setGlazePick(null) }, "\u2715")
              ),
              React.createElement("div", { className: "cart-drawer-body" },
                React.createElement("p", { className: "info-txt", style: { marginTop: 0 } }, "Harga tetap " + fmtRp(glazePick.menu.hargaJual) + ". Ketuk 1 glaze."),
                React.createElement("div", { className: "mixbox-grid" },
                  glazeList.map((g) => React.createElement("button", {
                    key: g.id, type: "button", className: "mixbox-item",
                    onClick: () => confirmGlaze(g.id)
                  },
                    React.createElement("span", { className: "mixbox-item-name" }, g.nama)
                  ))
                ),
                React.createElement("button", { className: "btn-secondary mt8", style: { width: "100%" }, onClick: () => confirmGlaze(null) }, "Tanpa glaze")
              )
            )
          ),
          // Modal pemilih rasa untuk Box Campur (mix & match)
          mixBox && (() => {
            const isi = mixBox.menu.isiBox || 1;
            const terisi = mixBox.isian.length;
            const penuh = terisi >= isi;
            const rasaList = menus.filter((m) => m.tipe !== "paket" && m.tipe !== "toping");
            const tambahRasa = (mid) => setMixBox((s) => {
              if (!s || s.isian.length >= (s.menu.isiBox || 1)) return s;
              return { ...s, isian: [...s.isian, mid] };
            });
            const hapusRasa = (idx) => setMixBox((s) => s ? { ...s, isian: s.isian.filter((_, i) => i !== idx) } : s);
            // Stepper: kurangi 1 rasa berdasarkan menuId (bukan index)
            const kurangRasa = (mid) => setMixBox((s) => {
              if (!s) return s;
              const i = s.isian.lastIndexOf(mid);
              if (i < 0) return s;
              const next = s.isian.slice(); next.splice(i, 1);
              return { ...s, isian: next };
            });
            // Isi cepat: penuhi box dengan 1 rasa
            const isiCepat = (mid) => setMixBox((s) => {
              if (!s) return s;
              const kap = s.menu.isiBox || 1;
              return { ...s, isian: Array(kap).fill(mid) };
            });
            const toggleToping = (tp) => setMixBox((s) => {
              if (!s) return s;
              const ada = s.toping.find((t) => t.id === tp.id);
              if (ada) return { ...s, toping: s.toping.filter((t) => t.id !== tp.id) };
              return { ...s, toping: [...s.toping, { id: tp.id, nama: tp.nama, hpp: tp.hargaBahan || 0, hargaJual: tp.hargaJual || 0 }] };
            });
            return React.createElement("div", { className: "modal-backdrop", onClick: () => setMixBox(null) },
              React.createElement("div", { className: "cart-drawer", onClick: (e) => e.stopPropagation() },
                React.createElement("div", { className: "cart-drawer-handle" }),
                React.createElement("div", { className: "modal-header" },
                  mixBox.menu.nama + " \u2014 pilih rasa",
                  React.createElement("button", { className: "btn-icon", "aria-label": "Tutup", onClick: () => setMixBox(null) }, "\u2715")
                ),
                React.createElement("div", { className: "cart-drawer-body" },
                  React.createElement("div", { className: "mixbox-counter" + (penuh ? " mixbox-counter-full" : "") },
                    "Isi box: ", React.createElement("strong", null, terisi + " / " + isi), penuh ? " \u2705 penuh" : " \u2014 pilih " + (isi - terisi) + " lagi"
                  ),
                  // Chip rasa terpilih (ketuk untuk hapus)
                  mixBox.isian.length > 0 && React.createElement("div", { className: "mixbox-chosen" },
                    mixBox.isian.map((mid, idx) => {
                      const md = menus.find((m) => m.id === mid);
                      return React.createElement("button", { key: idx, className: "mixbox-chip", onClick: () => hapusRasa(idx) },
                        (md ? md.nama : "?"), " \u2715");
                    })
                  ),
                  // Isi cepat: penuhi box dgn 1 rasa (untuk box 1 rasa) — hanya rasa yg stok cukup
                  React.createElement("div", { className: "mixbox-quick-label" }, "\u26A1 Isi cepat 1 rasa"),
                  React.createElement("div", { className: "mixbox-quick-row" },
                    rasaList.filter((m) => { const s = getSisaStokSetelahCart(m); return s === null || s >= isi; }).map((m) =>
                      React.createElement("button", { key: m.id, type: "button", className: "mixbox-quick-chip", onClick: () => isiCepat(m.id) }, "Semua " + m.nama)
                    )
                  ),
                  React.createElement("h4", { className: "sub-title" }, "Atur jumlah tiap rasa"),
                  React.createElement("div", null,
                    rasaList.map((m) => {
                      const stok = getSisaStokSetelahCart(m);
                      const dipakai = mixBox.isian.filter((x) => x === m.id).length;
                      const habis = stok !== null && (stok - dipakai) <= 0;
                      return React.createElement("div", { key: m.id, className: "mixbox-stepper-row" + (habis && dipakai === 0 ? " mixbox-stepper-dim" : "") },
                        React.createElement("div", null,
                          React.createElement("div", { className: "mixbox-stepper-name" }, m.nama),
                          React.createElement("div", { className: "mixbox-stepper-stok" }, stok === null ? "" : (habis ? "habis" : ("sisa " + (stok - dipakai))))
                        ),
                        React.createElement("div", { className: "mixbox-stepper-ctrl" },
                          React.createElement("button", { type: "button", className: "mixbox-step-btn", disabled: dipakai <= 0, onClick: () => kurangRasa(m.id) }, "\u2212"),
                          React.createElement("span", { className: "mixbox-step-cnt" }, dipakai),
                          React.createElement("button", { type: "button", className: "mixbox-step-btn", disabled: penuh || habis, onClick: () => tambahRasa(m.id) }, "+")
                        )
                      );
                    })
                  ),
                  topingTambahanList.length > 0 && React.createElement(React.Fragment, null,
                    React.createElement("h4", { className: "sub-title mt8" }, "Tambah toping (opsional)"),
                    React.createElement("div", { className: "mixbox-toping-row" },
                      topingTambahanList.map((tp) => {
                        const aktif = !!mixBox.toping.find((t) => t.id === tp.id);
                        return React.createElement("button", {
                          key: tp.id, type: "button",
                          className: "chip" + (aktif ? " chip-active" : ""),
                          onClick: () => toggleToping(tp)
                        }, tp.nama + " +" + fmtRp(tp.hargaJual || 0));
                      })
                    )
                  ),
                  React.createElement("div", { className: "row-wrap mt8" },
                    React.createElement("button", { className: "btn-secondary", onClick: () => setMixBox(null) }, "Batal"),
                    React.createElement("button", {
                      className: "btn-primary", disabled: !penuh, onClick: confirmMixBox
                    }, penuh ? ("Masukkan ke keranjang \u2022 " + fmtRp((mixBox.menu.hargaJual || 0) + mixBox.toping.reduce((a, t) => a + (t.hargaJual || 0), 0))) : ("Pilih " + (isi - terisi) + " rasa lagi"))
                  )
                )
              )
            );
          })(),
          // Floating cart bar — selalu terlihat di atas konten saat ada item, ketuk untuk buka drawer
          cartCount > 0 && React.createElement("button", { className: "cart-float-bar", onClick: () => setCartOpen(true) },
            React.createElement("span", { className: "cart-float-badge" }, cartCount),
            React.createElement("span", { className: "cart-float-label" }, "Lihat keranjang"),
            React.createElement("span", { className: "cart-float-total" }, fmtRp(totalBayar))
          ),
          // Drawer keranjang (bottom sheet)
          cartOpen && React.createElement("div", { className: "modal-backdrop cart-drawer-backdrop", onClick: () => setCartOpen(false) },
            React.createElement("div", { className: "cart-drawer", onClick: (e) => e.stopPropagation() },
              React.createElement("div", { className: "cart-drawer-handle" }),
              React.createElement("div", { className: "modal-header" },
                "Keranjang",
                React.createElement("button", { className: "btn-icon", "aria-label": "Tutup", onClick: () => setCartOpen(false) }, "\u2715")
              ),
              React.createElement("div", { className: "cart-drawer-body" },
                cart.length === 0 && React.createElement(EmptyState, {
                  icon: "🛒",
                  title: "Keranjang masih kosong",
                  desc: "Tutup keranjang, ketuk menu di kasir (bisa aktifkan Mode besar biar gampang), lalu buka lagi di sini.",
                  actionLabel: "Pilih menu",
                  onAction: () => setCartOpen(false)
                }),
                cart.map((item) =>
                  React.createElement("div", { key: item.id, className: "cart-item cart-item-lg" },
                    React.createElement("div", { className: "cart-item-info" },
                      React.createElement("span", { className: "cart-item-name" }, item.nama),
                      React.createElement("span", { className: "cart-item-unit" }, fmtRp(item.hargaJual), " / pcs")
                    ),
                    React.createElement("div", { className: "cart-item-right" },
                      React.createElement("div", { className: "cart-qty-stepper" },
                        React.createElement("button", { type: "button", className: "qty-btn", onClick: () => decCart(item.id), "aria-label": "Kurangi" }, "−"),
                        React.createElement("span", { className: "cart-qty" }, item.qty),
                        React.createElement("button", { type: "button", className: "qty-btn", onClick: () => incCart(item.id), "aria-label": "Tambah" }, "+")
                      ),
                      React.createElement("span", { className: "cart-item-subtotal" }, fmtRp(item.hargaJual * item.qty)),
                      React.createElement("button", { className: "cart-item-remove", onClick: () => removeCart(item.id), "aria-label": "Hapus" }, "✕")
                    )
                  )
                ),
                cart.length > 0 && React.createElement(React.Fragment, null,
                  React.createElement("div", { className: "pay-panel" },
                  React.createElement("div", { className: "field-group" },
                    React.createElement("label", null, "Diskon / Promo"),
                    React.createElement("div", { className: "diskon-methods" },
                      [
                        { id: "none", label: "Tanpa diskon" },
                        { id: "persen", label: "Persen (%)" },
                        { id: "nominal", label: "Nominal (Rp)" }
                      ].map((d) =>
                        React.createElement("button", {
                          key: d.id, type: "button",
                          className: "diskon-method" + (diskonTipe === d.id ? " active" : ""),
                          onClick: () => { setDiskonTipe(d.id); if (d.id === "none") setDiskonInput(""); }
                        }, d.label)
                      )
                    ),
                    diskonTipe !== "none" && React.createElement(React.Fragment, null,
                      React.createElement("input", {
                        className: "inp mt4", type: "number", min: "0", inputMode: "numeric",
                        value: diskonInput,
                        onChange: (e) => setDiskonInput(e.target.value),
                        placeholder: diskonTipe === "persen" ? "contoh: 20 (=20%)" : "contoh: 5000"
                      }),
                      diskonTipe === "persen" && React.createElement("div", { className: "row-wrap mt4" },
                        [10, 20, 30, 50].map((p) =>
                          React.createElement("button", {
                            key: p, type: "button", className: "chip",
                            onClick: () => setDiskonInput(String(p))
                          }, p + "%")
                        )
                      )
                    )
                  ),
                  diskonRp > 0 && React.createElement("div", { className: "pay-sub-row" },
                    React.createElement("span", null, "Subtotal"),
                    React.createElement("span", null, fmtRp(subtotal))
                  ),
                  diskonRp > 0 && React.createElement("div", { className: "pay-sub-row", style: { color: "var(--red)" } },
                    React.createElement("span", null, "Diskon" + (diskonTipe === "persen" ? " (" + (Math.min(parseFloat(diskonInput) || 0, 100)) + "%)" : "")),
                    React.createElement("span", null, "− " + fmtRp(diskonRp))
                  ),
                  React.createElement("div", { className: "pay-total-row" },
                    React.createElement("span", { className: "pay-total-label" }, "Total bayar"),
                    React.createElement("strong", { className: "pay-total-value" }, fmtRp(totalBayar))
                  ),
                  React.createElement("div", { className: "field-group mt8" },
                    React.createElement("label", null, "Cara bayar"),
                    React.createElement("div", { className: "pay-methods" },
                      [
                        { id: "tunai", label: "Tunai", icon: "💵" },
                        { id: "qris", label: "QRIS", icon: "📱" },
                        { id: "transfer", label: "Transfer", icon: "🏦" },
                        { id: "campuran", label: "Campur", icon: "🔀" }
                      ].map((m) =>
                        React.createElement("button", {
                          key: m.id, type: "button",
                          className: "pay-method" + (payMetode === m.id ? " active" : ""),
                          onClick: () => {
                            setPayMetode(m.id);
                            if (m.id === "tunai") setPayNonTunai("");
                            if (m.id === "qris" || m.id === "transfer") { setPayTunai(""); setPayNonTunai(""); }
                          }
                        },
                          React.createElement("span", { className: "pay-method-icon" }, m.icon),
                          React.createElement("span", null, m.label)
                        )
                      )
                    )
                  ),
                  (payMetode === "tunai" || payMetode === "campuran") && React.createElement("div", { className: "field-group" },
                    React.createElement("label", null, payMetode === "campuran" ? "Uang tunai dari pelanggan" : "Uang dari pelanggan"),
                    React.createElement("input", {
                      className: "inp", type: "number", min: "0", inputMode: "numeric",
                      value: payTunai,
                      onChange: (e) => setPayTunai(e.target.value),
                      placeholder: String(totalBayar)
                    }),
                    React.createElement("div", { className: "row-wrap mt4" },
                      [totalBayar, Math.ceil(totalBayar / 1000) * 1000, Math.ceil(totalBayar / 5000) * 5000, Math.ceil(totalBayar / 10000) * 10000].filter((v, i, a) => a.indexOf(v) === i && v >= totalBayar).slice(0, 4).map((v) =>
                        React.createElement("button", {
                          key: v, type: "button", className: "chip",
                          onClick: () => setPayTunai(String(v))
                        }, fmtRp(v))
                      )
                    )
                  ),
                  payMetode === "campuran" && React.createElement("div", { className: "field-group" },
                    React.createElement("label", null, "Bayar QRIS / transfer (Rp)"),
                    React.createElement("input", {
                      className: "inp", type: "number", min: "0", inputMode: "numeric",
                      value: payNonTunai,
                      onChange: (e) => setPayNonTunai(e.target.value),
                      placeholder: "0"
                    })
                  ),
                  (() => {
                    const tunaiN = parseFloat(payTunai) || 0;
                    const nonN = parseFloat(payNonTunai) || 0;
                    let kembalian = 0;
                    if (payMetode === "tunai") kembalian = Math.max(0, tunaiN - totalBayar);
                    else if (payMetode === "campuran") {
                      const perluTunai = Math.max(0, totalBayar - nonN);
                      kembalian = Math.max(0, tunaiN - perluTunai);
                    }
                    if (payMetode === "qris" || payMetode === "transfer") {
                      return React.createElement("div", { className: "pay-change pay-change-info" },
                        React.createElement("span", null, "Pelanggan bayar non-tunai"),
                        React.createElement("strong", null, fmtRp(totalBayar))
                      );
                    }
                    return React.createElement("div", {
                      className: "pay-change" + (kembalian > 0 ? " pay-change-ok" : "")
                    },
                      React.createElement("span", null, "Kembalian"),
                      React.createElement("strong", null, fmtRp(kembalian))
                    );
                  })(),
                  React.createElement("label", { className: "pay-check" },
                    React.createElement("input", {
                      type: "checkbox",
                      checked: !!autoPrint,
                      onChange: (e) => {
                        const v = e.target.checked;
                        setAutoPrint(v);
                        try { localStorage.setItem("donatboss_auto_print", v ? "1" : "0"); } catch {}
                      }
                    }),
                    React.createElement("span", null, "Cetak struk otomatis")
                  ),
                  offlineCount > 0 && React.createElement("div", { className: "alert-banner alert-banner-warn" },
                    React.createElement("div", { className: "alert-banner-item" },
                      "📡 ", offlineCount, " transaksi belum terkirim (mode offline).",
                      React.createElement("button", {
                        type: "button", className: "btn-secondary btn-sm", style: { marginLeft: 8 },
                        onClick: () => flushOfflineTxQueue(pushNotif).then(() => setOfflineCount(getOfflineTxQueue().length))
                      }, "Kirim sekarang")
                    )
                  ),
                  React.createElement("div", { className: "pay-actions" },
                    React.createElement("button", { className: "btn-secondary btn-pay-cancel", onClick: () => { setCart([]); setPayTunai(""); setPayNonTunai(""); setDiskonTipe("none"); setDiskonInput(""); } }, "Batal"),
                    React.createElement("button", {
                      className: "btn-primary btn-pay-go",
                      disabled: payBusy,
                      onClick: () => submitTx(() => setCartOpen(false))
                    }, payBusy ? "Memproses..." : (isProbablyOffline() ? "Simpan offline" : "Bayar sekarang"))
                  ),
                  ),
                  lastReceiptTx && React.createElement("div", { className: "row-wrap mt8" },
                    React.createElement("button", {
                      type: "button", className: "btn-secondary btn-sm",
                      onClick: () => {
                        const pr = printReceipt(lastReceiptTx, lastReceiptTx.branchName || curBranch?.name, { autoPrint: true });
                        if (!pr.ok) pushNotif("Gagal cetak: izinkan pop-up / coba Salin struk di Riwayat.", "warning");
                      }
                    }, "Cetak struk terakhir"),
                    React.createElement("button", {
                      type: "button", className: "btn-secondary btn-sm",
                      onClick: async () => {
                        const r = await copyReceiptText(lastReceiptTx, lastReceiptTx.branchName || curBranch?.name);
                        if (r.ok) pushNotif("Struk terakhir disalin.", "success");
                        else pushNotif("Gagal salin struk.", "warning");
                      }
                    }, "Salin struk terakhir")
                  )
                ),
                React.createElement("div", { className: "omzet-box mt12" },
                  React.createElement("span", null, "Omzet Hari Ini"),
                  React.createElement("strong", null, fmtRp(branchOmzet))
                ),
                React.createElement("div", { className: "omzet-box", style: { borderColor: "color-mix(in srgb, var(--red) 35%, var(--border))" } },
                  React.createElement("span", null, "Biaya"),
                  React.createElement("strong", { style: { color: "var(--red)" } }, fmtRp(branchPeng))
                ),
                ringkasanPenjualan.length > 0 && React.createElement("div", { className: "form-card mt8", style: { padding: 10 } },
                  React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 } }, "Terjual & Sisa Hari Ini"),
                  ringkasanPenjualan.map((r) =>
                    React.createElement("div", { key: r.menuId, style: { display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid var(--border)" } },
                      React.createElement("span", null, r.nama),
                      React.createElement("span", null,
                        "Terjual: ", React.createElement("strong", { style: { color: "var(--green)" } }, r.terjual, " ", r.satuan),
                        "  |  Sisa: ", React.createElement("strong", { style: { color: r.sisa === 0 ? "var(--red)" : "var(--yellow)" } }, r.sisa === null ? "-" : r.sisa, " ", r.satuan)
                      )
                    )
                  )
                )
              )
            )
          )
        );
      })(),

      // ── Tab: Riwayat — REVISI #2: tombol Edit hanya tampil kalau mode="owner" ──
      tab === "riwayat" && React.createElement("div", null,
        React.createElement("h3", { className: "section-title" }, "Riwayat - ", formatTanggalIndo(safeTxDate)),
        transactions.length === 0 && React.createElement(EmptyState, { icon: "🛒", title: "Belum ada transaksi", desc: "Jual lewat tab Kasir. Pastikan stok lapak sudah diisi dari distribusi CK." }),
        [...transactions].reverse().map((tx) =>
          React.createElement("div", { key: tx.id, className: "tx-card" + (tx.edited ? " tx-edited" : "") },
            React.createElement("div", { className: "tx-header" },
              React.createElement("span", { className: "tx-id" }, "STRUK-", tx.id.slice(0, 6).toUpperCase()),
              React.createElement("span", { className: "tx-ts" }, fmtTxTs(tx)),
              tx.metodeBayar && React.createElement("span", { className: "badge-branch" }, bayarLabel(tx.metodeBayar)),
              tx.edited && React.createElement("span", { className: "badge-edit" }, "Diedit"),
              isSetoranLocked(tx.branchId, tx.date) && React.createElement("span", { className: "badge-ok" }, "🔒 Terkunci")
            ),
            tx.items.map((it, i) => React.createElement("div", { key: i, className: "tx-item" }, it.nama, " x", it.qty, " - ", fmtRp(it.hargaJual * it.qty))),
            React.createElement("div", { className: "tx-total" }, "Total: ", fmtRp(tx.total),
              (tx.kembalian != null && Number(tx.kembalian) > 0) ? React.createElement("span", { style: { fontSize: 12, color: "var(--text2)", fontWeight: 600 } }, " · Kembali ", fmtRp(tx.kembalian)) : null
            ),
            React.createElement("div", { className: "row-wrap mt8" },
              React.createElement("button", {
                type: "button", className: "btn-secondary btn-sm",
                onClick: () => {
                  const bname = curBranch?.name || branchId;
                  const pr = printReceipt(tx, bname, { autoPrint: true });
                  if (!pr.ok) pushNotif("Gagal buka struk: izinkan pop-up browser, atau pakai Salin struk.", "warning");
                  else pushNotif("Struk dibuka — pilih printer di dialog cetak.", "success");
                }
              }, "Cetak ulang"),
              React.createElement("button", {
                type: "button", className: "btn-secondary btn-sm",
                onClick: async () => {
                  const bname = curBranch?.name || branchId;
                  const r = await copyReceiptText(tx, bname);
                  if (r.ok) pushNotif("Teks struk disalin. Bisa ditempel ke WA.", "success");
                  else pushNotif("Gagal salin struk: " + (r.reason || ""), "warning");
                }
              }, "Salin struk"),
              mode === "owner" && (
                isSetoranLocked(tx.branchId, tx.date)
                  ? React.createElement("span", { className: "info-txt", style: { fontSize: 11 } }, "Buka kunci setoran dulu untuk edit")
                  : React.createElement("button", { className: "btn-edit-sm", onClick: () => setEditModal(tx) }, "Edit")
              )
            )
          )
        )
      ),

      // ── Tab: Pengeluaran ──
      tab === "pengeluaran" && React.createElement(PengeluaranLapak, { branchId, branchName: curBranch?.name || "", date: safeTxDate, pushNotif }),

      // ── Tab: Setoran (hanya worker) ──
      allowSetoran && tab === "setoran" && (() => {
        const previewKas = hitungSetoranKas({
          omzet: branchOmzet,
          pengeluaran: branchPeng,
          tunaiFisik: kasForm.tunaiFisik === "" ? 0 : kasForm.tunaiFisik,
          nonTunai: kasForm.nonTunai === "" ? 0 : kasForm.nonTunai
        });
        const previewInfo = fmtSelisihKas(previewKas.selisihKas);
        const savedInfo = fmtSelisihKas(setoran.selisihKas);
        const canEditKas = setoran.status === "belum" || (setoran.status === "menunggu" && !setoran.locked);
        return React.createElement("div", { className: "setoran-box-worker" },
          React.createElement("div", { className: "setoran-status setoran-" + setoran.status },
            setoran.status === "belum" && React.createElement("span", null, "Belum setor"),
            setoran.status === "menunggu" && React.createElement("span", null, "Menunggu dicek Owner"),
            setoran.status === "selesai" && React.createElement("span", null, "Sudah disetor & OK")
          ),
          React.createElement("p", { className: "info-txt" },
            mode === "owner"
              ? "Cek penjualan app vs uang di toko. Kalau beda, wajib isi alasan."
              : "Hitung uang di laci + QRIS/transfer, lalu bandingkan dengan angka penjualan di app."
          ),
          React.createElement("div", { className: "setoran-omzet" }, "Penjualan di app: ", React.createElement("strong", null, fmtRp(branchOmzet))),
          React.createElement("div", { className: "setoran-omzet" }, "Pengeluaran toko: ", React.createElement("strong", { style: { color: "var(--red)" } }, fmtRp(branchPeng))),
          React.createElement("div", { className: "setoran-omzet" }, "Seharusnya ada uang: ", React.createElement("strong", { style: { color: "var(--green)" } }, fmtRp(branchOmzet - branchPeng))),
          ringkasanPenjualan.length > 0 && React.createElement("div", { className: "form-card mt8", style: { padding: 10 } },
            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 } }, "Rincian Terjual & Sisa per Box/Item"),
            ringkasanPenjualan.map((r) =>
              React.createElement("div", { key: r.menuId, style: { display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid #2a2a2e" } },
                React.createElement("span", null, r.nama),
                React.createElement("span", null,
                  "Terjual: ", React.createElement("strong", { style: { color: "var(--green)" } }, r.terjual, " ", r.satuan),
                  "  |  Sisa: ", React.createElement("strong", { style: { color: r.sisa === 0 ? "var(--red)" : "var(--yellow)" } }, r.sisa === null ? "-" : r.sisa, " ", r.satuan)
                )
              )
            )
          ),
          // Form kas fisik
          canEditKas && React.createElement("div", { className: "form-card mt8" },
            React.createElement("h4", null, "Hitung uang di toko"),
            React.createElement("div", { className: "field-group" },
              React.createElement("label", null, "Uang tunai di laci"),
              React.createElement("input", {
                className: "inp", type: "number", min: "0", step: "1",
                value: kasForm.tunaiFisik,
                onChange: (e) => setKasForm((f) => ({ ...f, tunaiFisik: e.target.value })),
                placeholder: "Hitung lembaran di laci..."
              })
            ),
            React.createElement("div", { className: "field-group" },
              React.createElement("label", null, "Total QRIS / transfer (cek HP)"),
              React.createElement("input", {
                className: "inp", type: "number", min: "0", step: "1",
                value: kasForm.nonTunai,
                onChange: (e) => setKasForm((f) => ({ ...f, nonTunai: e.target.value })),
                placeholder: "0 jika semua tunai"
              })
            ),
            React.createElement("div", { className: "setoran-omzet" }, "Uang dihitung: ", React.createElement("strong", null, fmtRp(previewKas.totalDiterima))),
            React.createElement("div", { className: "setoran-omzet" }, "Selisih (app vs uang): ",
              React.createElement("strong", {
                style: { color: previewInfo.tone === "ok" ? "var(--green)" : previewInfo.tone === "lebih" ? "var(--accent)" : "var(--red)" }
              }, previewInfo.text)
            ),
            React.createElement("div", { className: "field-group" },
              React.createElement("label", null, Math.abs(previewKas.selisihKas) >= 1 ? "Catatan selisih (wajib)" : "Catatan (opsional)"),
              React.createElement("input", {
                className: "inp",
                value: kasForm.catatan,
                onChange: (e) => setKasForm((f) => ({ ...f, catatan: e.target.value })),
                placeholder: "Contoh: kurang kembalian 10rb / tip / salah input omzet"
              })
            ),
            React.createElement("button", {
              className: "btn-primary btn-full",
              onClick: doSetoran
            }, setoran.status === "menunggu" ? "Update & setor lagi" : "Setor sekarang")
          ),
          // Ringkasan tersimpan
          setoran.status !== "belum" && setoran.tunaiFisik != null && React.createElement("div", { className: "form-card mt8", style: { padding: 10 } },
            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 } }, "Ringkasan Kas Tersimpan"),
            React.createElement("div", { style: { fontSize: 13 } }, "Tunai: ", React.createElement("strong", null, fmtRp(setoran.tunaiFisik))),
            React.createElement("div", { style: { fontSize: 13 } }, "Non-tunai: ", React.createElement("strong", null, fmtRp(setoran.nonTunai || 0))),
            React.createElement("div", { style: { fontSize: 13 } }, "Uang dihitung: ", React.createElement("strong", null, fmtRp(setoran.totalDiterima != null ? setoran.totalDiterima : (Number(setoran.tunaiFisik || 0) + Number(setoran.nonTunai || 0))))),
            React.createElement("div", { style: { fontSize: 13 } }, "Selisih: ",
              React.createElement("strong", {
                style: { color: savedInfo.tone === "ok" ? "var(--green)" : savedInfo.tone === "lebih" ? "var(--accent)" : "var(--red)" }
              }, savedInfo.text)
            ),
            setoran.catatanKas && React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginTop: 4 } }, "Catatan: ", setoran.catatanKas)
          ),
          setoran.status === "menunggu" && React.createElement("p", { className: "info-txt" },
            mode === "owner"
              ? "Setoran menunggu. Cek selisih di menu Setoran owner, lalu konfirmasi."
              : "Menunggu Owner memverifikasi setoran (termasuk selisih kas bila ada)."
          ),
          setoran.status === "selesai" && React.createElement("p", { className: "info-txt" }, "Setoran sudah dikonfirmasi owner", setoran.konfirmasiTs ? (" — " + setoran.konfirmasiTs) : "", ".")
        );
      })(),

      // ── Tab: Absensi — REVISI #6: nonaktif setelah checkout ──
      tab === "absensi" && React.createElement("div", null,
        React.createElement("h3", { className: "section-title mt8" }, "Absensi"),
        sudahCheckout && React.createElement("div", { className: "form-card", style: { background: "color-mix(in srgb, var(--red) 12%, var(--bg2))", borderColor: "var(--red)" } },
          React.createElement("p", { style: { color: "var(--red)", fontWeight: 700, textAlign: "center" } }, "Anda sudah Check-out hari ini. Form absensi dikunci.")
        ),
        !sudahCheckout && React.createElement("div", { className: "form-card" },
          React.createElement("div", { className: "row-wrap", style: { justifyContent: "space-between" } },
            React.createElement("div", null,
              React.createElement("div", { style: { fontWeight: 700 } }, formatTanggalIndo(safeTxDate)),
              React.createElement("div", { style: { fontSize: 12, color: "var(--text2)" } }, "Check-in: ", fmtTs(selectedAbs?.checkin_ts), " | Check-out: ", fmtTs(selectedAbs?.checkout_ts))
            ),
            React.createElement("div", { className: "row-wrap" },
              React.createElement("button", { className: "btn-primary btn-sm", onClick: doCheckin }, "Check-in"),
              React.createElement("button", { className: "btn-secondary btn-sm", onClick: doCheckout }, "Check-out")
            )
          )
        ),
        React.createElement("p", { className: "info-txt mt8" },
          canChangeDate
            ? (mode === "owner"
                ? "Owner bisa input atau koreksi absensi untuk tanggal mana pun dari tampilan kasir ini."
                : "Mode histori aktif. Kamu bisa pilih tanggal lain untuk input absensi yang diminta owner.")
            : "Absensi pekerja hanya bisa diinput untuk hari ini. Minta owner aktifkan mode histori jika perlu input tanggal lain."
        ),
        React.createElement("div", { className: "field-group mt8" },
          React.createElement("label", null, "Rekap Bulan"),
          React.createElement("input", { type: "month", className: "inp inp-sm", value: absMonth, onChange: (e) => setAbsMonth(e.target.value) })
        ),
        React.createElement("div", { className: "kpi-grid" },
          React.createElement("div", { className: "kpi-card kpi-omzet" },
            React.createElement("div", { className: "kpi-label" }, "Total Hadir"),
            React.createElement("div", { className: "kpi-val" }, (monthSnap ? monthSnap.total_hadir : calcMonth.hadir), " hari")
          ),
          React.createElement("div", { className: "kpi-card kpi-profit" },
            React.createElement("div", { className: "kpi-label" }, "Total Jam"),
            React.createElement("div", { className: "kpi-val" }, Math.round(((monthSnap ? monthSnap.total_menit : calcMonth.menit) || 0) / 60 * 10) / 10, " jam")
          )
        ),
        monthSnap && React.createElement("p", { className: "info-txt mt8" }, "Rekap bulan ini sudah dikunci oleh Owner."),
        React.createElement("h3", { className: "section-title mt12" }, "Riwayat Absensi (", formatBulanIndo(absMonth), ")"),
        myMonthRows.length === 0 && React.createElement(EmptyState, { icon: "⏰", title: "Belum ada absen", desc: "Muncul setelah pekerja check-in. Set gaji harian di Akun & Pekerja." }),
        [...myMonthRows].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((r) =>
          React.createElement("div", { key: r.id, className: "peng-row" },
            React.createElement("div", { className: "peng-info" },
              React.createElement("span", { className: "peng-ket" }, formatTanggalIndoPendek(r.date)),
              React.createElement("span", { className: "peng-ts" }, "In: ", fmtTs(r.checkin_ts), " | Out: ", fmtTs(r.checkout_ts))
            )
          )
        )
      ),

      // ── Tab: Distribusi dari CK ──
      tab === "shift" && React.createElement(ShiftKasPanel, { pushNotif, me, fixedBranchId: (me?.branchId || branchId) }),
      tab === "distribusi" && (() => {
        const distList = (S.get("distribusiCK") || [])
          .filter((d) => d.branchId === (me?.branchId || branchId))
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        const pending = distList.filter((d) => d.status === "pending" || d.status === "perjalanan");
        const confirmed = distList.filter((d) => d.status !== "pending" && d.status !== "perjalanan");
        return React.createElement("div", null,
          React.createElement("h3", { className: "section-title mt8" }, "Distribusi dari Central Kitchen"),
          React.createElement("p", { className: "info-txt" }, "Daftar kiriman produk dari Central Kitchen ke lapak kamu. Cek jumlah & kondisi, lalu konfirmasi \u2014 stok otomatis masuk kasir."),
          distList.length === 0 && React.createElement("p", { className: "empty-txt mt8" }, "Belum ada distribusi masuk."),
          pending.length > 0 && React.createElement("div", null,
            React.createElement("h4", { className: "sub-title", style: { color: "var(--yellow)" } }, "\u23F3 Perlu Dicek & Konfirmasi (", pending.length, ")"),
            pending.map((d) =>
              React.createElement(DistribusiKonfirmCard, { key: d.id, d, pushNotif })
            )
          ),
          confirmed.length > 0 && React.createElement("div", { className: "mt12" },
            React.createElement("h4", { className: "sub-title" }, "Riwayat Distribusi"),
            React.createElement("div", { className: "tbl-wrap" },
              React.createElement("table", { className: "tbl" },
                React.createElement("thead", null, React.createElement("tr", null,
                  React.createElement("th", null, "Tanggal"), React.createElement("th", null, "Produk"),
                  React.createElement("th", null, "Dikirim"), React.createElement("th", null, "Sudah diterima"), React.createElement("th", null, "Selisih")
                )),
                React.createElement("tbody", null, confirmed.map((d) =>
                  React.createElement("tr", { key: d.id },
                    React.createElement("td", { style: { fontSize: 12 } }, formatTanggalIndoPendek(d.date)),
                    React.createElement("td", null, React.createElement("strong", null, d.menuNama)),
                    React.createElement("td", { style: { color: "var(--green)" } }, d.jumlahKirim, " pcs"),
                    React.createElement("td", null, d.jumlahTerima, " pcs"),
                    React.createElement("td", { style: { color: d.selisih < 0 ? "var(--red)" : d.selisih > 0 ? "var(--yellow)" : "var(--green)", fontWeight: 700 } },
                      d.selisih === 0 ? "Sesuai" : (d.selisih > 0 ? "+" : "") + d.selisih,
                      d.catatanSelisih ? React.createElement("div", { style: { fontSize: 11, color: "var(--text2)", fontWeight: 400 } }, d.catatanSelisih) : null
                    )
                  )
                ))
              )
            )
          )
        );
      })(),

      // ── Tab: Gaji ──
      allowSetoran && tab === "gaji" && (() => {
        if (mode === "owner") {
          return React.createElement("div", null,
            React.createElement("h3", { className: "section-title mt8" }, "Info Gaji Cabang"),
            React.createElement("p", { className: "info-txt" }, "Ringkasan gaji ini mengikuti cabang yang dipilih di atas dan bulan dari tanggal aktif: ", React.createElement("strong", null, formatBulanIndo(gajiMonth)), "."),
            React.createElement("div", { className: "kpi-grid" },
              React.createElement("div", { className: "kpi-card kpi-cab" }, React.createElement("div", { className: "kpi-label" }, "Pekerja Cabang"), React.createElement("div", { className: "kpi-val" }, ownerBranchWorkers.length)),
              React.createElement("div", { className: "kpi-card kpi-omzet" }, React.createElement("div", { className: "kpi-label" }, "Total Gaji Bulan Ini"), React.createElement("div", { className: "kpi-val" }, fmtRp(ownerGajiTotal))),
              React.createElement("div", { className: "kpi-card kpi-modal" }, React.createElement("div", { className: "kpi-label" }, "Menunggu Konfirmasi"), React.createElement("div", { className: "kpi-val" }, ownerGajiPendingCount)),
              React.createElement("div", { className: "kpi-card kpi-profit" }, React.createElement("div", { className: "kpi-label" }, "Sudah Dikonfirmasi"), React.createElement("div", { className: "kpi-val" }, ownerGajiConfirmedCount))
            ),
            ownerGajiRows.length === 0 && React.createElement("p", { className: "empty-txt mt8" }, "Belum ada pekerja atau data gaji untuk cabang ini."),
            ownerGajiRows.length > 0 && React.createElement("div", { className: "mt12" },
              ownerGajiRows.map((r) =>
                React.createElement("div", { key: r.userId, className: "peng-row" },
                  React.createElement("div", { className: "peng-info" },
                    React.createElement("span", { className: "peng-ket" }, r.nama),
                    React.createElement("span", { className: "peng-ts" },
                      fmtRp(r.gajiHarian), "/hari (akhir) · hadir ", r.hadir, " · total histori",
                      r.payment
                        ? (r.payment.status === "dikonfirmasi"
                            ? " · Sudah dikonfirmasi pekerja"
                            : " · Menunggu konfirmasi pekerja")
                        : " · Belum dikirim dari menu Absensi owner"
                    )
                  ),
                  React.createElement("div", { className: "peng-right" },
                    React.createElement("span", { className: "peng-jml", style: { color: r.payment?.status === "dikonfirmasi" ? "var(--green)" : "var(--accent)" } }, fmtRp(r.jumlah || 0))
                  )
                )
              )
            )
          );
        }
        const gajiList = (S.get("gajiPembayaran") || [])
          .filter((g) => g.user_id === userId)
          .sort((a, b) => (b.bulan || "").localeCompare(a.bulan || ""));
        const gajiMenunggu = gajiList.filter((g) => g.status === "dikirim");
        const doKonfirmGaji = async (gId) => {
          try {
            const { error } = await sb.from("gajiPembayaran").update({ status: "dikonfirmasi", confirmedAt: nowIso() }).eq("id", gId);
            if (error) throw error;
            await S.loadKey("gajiPembayaran");
            pushNotif("Gaji dikonfirmasi. Terima kasih!", "success");
          } catch (e) { pushNotif(e?.message || String(e), "warning"); }
        };
        return React.createElement("div", null,
          React.createElement("h3", { className: "section-title mt8" }, "Info Gaji"),
          React.createElement("div", { className: "kpi-grid" },
            React.createElement("div", { className: "kpi-card kpi-omzet" }, React.createElement("div", { className: "kpi-label" }, "Hadir Minggu Ini"), React.createElement("div", { className: "kpi-val" }, myWeekHadir, " / 7 hari")),
            React.createElement("div", { className: "kpi-card kpi-profit" }, React.createElement("div", { className: "kpi-label" }, "Hadir Bulan Ini"), React.createElement("div", { className: "kpi-val" }, myMonthHadirNow, " hari"))
          ),
          React.createElement("p", { className: "info-txt" }, "Daftar pembayaran gaji dari Owner. Konfirmasi setelah kamu menerima gaji."),
          gajiMenunggu.length > 0 && React.createElement("div", { className: "form-card mt8", style: { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, var(--bg2))" } },
            React.createElement("div", { style: { fontWeight: 700, color: "var(--accent)", marginBottom: 6 } }, "💸 Kamu punya gaji yang belum dikonfirmasi!"),
            gajiMenunggu.map((g) =>
              React.createElement("div", { key: g.id, style: { marginBottom: 10 } },
                React.createElement("div", { style: { fontSize: 14, fontWeight: 700 } }, fmtRp(g.jumlah)),
                React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginBottom: 6 } }, "Bulan ", g.bulan, " · ", fmtRp(g.gajiHarian), "/hari × ", g.hadir, " hari"),
                React.createElement("button", { className: "btn-primary btn-full", onClick: () => doKonfirmGaji(g.id) }, "✅ Konfirmasi Sudah Terima Gaji")
              )
            )
          ),
          gajiList.length === 0 && React.createElement("p", { className: "empty-txt mt8" }, "Belum ada riwayat pembayaran gaji."),
          gajiList.filter((g) => g.status === "dikonfirmasi").length > 0 && React.createElement("div", { className: "mt12" },
            React.createElement("h4", { className: "sub-title" }, "Riwayat Gaji Diterima"),
            gajiList.filter((g) => g.status === "dikonfirmasi").map((g) =>
              React.createElement("div", { key: g.id, className: "peng-row" },
                React.createElement("div", { className: "peng-info" },
                  React.createElement("span", { className: "peng-ket" }, "Gaji Bulan ", g.bulan),
                  React.createElement("span", { className: "peng-ts" }, fmtRp(g.gajiHarian), "/hari × ", g.hadir, " hari")
                ),
                React.createElement("div", { className: "peng-right" },
                  React.createElement("span", { className: "peng-jml", style: { color: "var(--green)" } }, fmtRp(g.jumlah)),
                  React.createElement("span", { style: { fontSize: 11, color: "var(--green)", marginLeft: 6 } }, "✅")
                )
              )
            )
          )
        );
      })(),

            // Modal edit transaksi — hanya owner
      editModal && mode === "owner" && React.createElement(EditTxModal, { tx: editModal, onClose: () => setEditModal(null), onSave: saveEdit })
    );
  }

  // ─── OwnerProduksiCK — Rekap + Distribusi CK ────────────────────────────────
  function OwnerProduksiCK({ pushNotif }) {
    const tick = useStoreTick();
    const [confirmAsk, confirmModal] = useConfirm();
    const [dr, setDr] = useState({ from: today(), to: today() });
    const [subtab, setSubtab] = useState("produksi");
    const [distribForm, setDistribForm] = useState({});
    const [distribBusy, setDistribBusy] = useState({});
    const [openDay, setOpenDay] = useState({});
    const [returBusy, setReturBusy] = useState({});
    const branches = (S.get("branches") || []).filter((b) => b.type !== "central_kitchen");
    const menus = S.get("menuVarian") || [];
    const produksiAll = S.get("produksiCK") || [];
    const distribAll = S.get("distribusiCK") || [];

    // ─── Form input produksi langsung dari Owner ───
    const ckBranchOwner = (S.get("branches") || []).find((b) => b.type === "central_kitchen");
    const [inputForm, setInputForm] = useState({ menuId: "", jumlah: "", keterangan: "", forceStok: false });
    const [inputBusy, setInputBusy] = useState(false);
    const inputProduksi = async () => {
      if (!inputForm.menuId) { pushNotif("Pilih menu dulu.", "warning"); return; }
      const jml = parseInt(inputForm.jumlah);
      if (!jml || jml <= 0) { pushNotif("Jumlah harus lebih dari 0.", "warning"); return; }
      setInputBusy(true);
      try {
        const menu = menus.find((m) => m.id === inputForm.menuId);
        const hppPerPcsProduksi = roundHppRp(getMenuHPPBreakdown(menu)?.hppSatuanPerPcs || 0);
        const tglProduksi = dr.from; // ikut tanggal filter yang sudah ditentukan Owner
        const cekStok = cekStokBahanCukupUntukProduksi(menu, jml);
        const force = !!inputForm.forceStok;
        if (cekStok.pakai.length && !cekStok.ok && !force) {
          const msg = cekStok.kurang.map((k) => k.bahanNama + " (ada " + Number(k.saldo).toLocaleString("id-ID") + ", butuh " + Number(k.butuh).toLocaleString("id-ID") + ")").join("; ");
          pushNotif("Stok gudang kurang: " + msg + ". Restok dulu, atau centang Paksa (Owner) untuk tetap produksi.", "warning");
          return;
        }
        const entry = {
          id: uid(), date: tglProduksi, ts: tsForDate(tglProduksi),
          branchId: ckBranchOwner?.id || null, branchName: ckBranchOwner?.name || "Dapur pusat (CK)",
          menuId: inputForm.menuId, menuNama: menu?.nama || inputForm.menuId,
          jumlah: jml, hppPerPcs: hppPerPcsProduksi, hppTotalProduksi: hppPerPcsProduksi * jml,
          keterangan: (inputForm.keterangan.trim() || "") + (force && cekStok.pakai.length && !cekStok.ok ? " [FORCE STOK]" : ""),
          createdBy: null,
          forceStok: force && cekStok.pakai.length && !cekStok.ok
        };
        const { error } = await sb.from("produksiCK").insert([entry]);
        if (error) throw error;
        await S.loadKey("produksiCK");
        try {
          const stokRes = await catatPemakaianProduksi({
            produksiId: entry.id, menu, jumlah: jml, date: tglProduksi,
            note: entry.keterangan || undefined,
            force: force
          });
          if (stokRes.forced || (stokRes.minus && stokRes.minus.length)) {
            pushNotif("Produksi tersimpan dengan stok minus/paksa. Segera restok & koreksi gudang.", "warning");
          }
        } catch (stokErr) {
          pushNotif("Produksi tersimpan, tapi stok gudang gagal dipotong: " + (stokErr?.message || stokErr), "warning");
        }
        setInputForm({ menuId: "", jumlah: "", keterangan: "", forceStok: false });
        pushNotif("Produksi tercatat untuk tanggal " + tglProduksi + "!", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
      finally { setInputBusy(false); }
    };

    const filtered = produksiAll.filter((p) => p.date >= dr.from && p.date <= dr.to);
    const totalPcs = filtered.reduce((a, p) => a + (p.jumlah || 0), 0);
    const totalHppProduksi = filtered.reduce((a, p) => a + (p.hppTotalProduksi || (p.hppPerPcs || 0) * (p.jumlah || 0)), 0);
    const byMenu = {};
    filtered.forEach((p) => { const key = p.menuNama || p.menuId || "?"; byMenu[key] = (byMenu[key] || 0) + (p.jumlah || 0); });
    const byMenuArr = Object.entries(byMenu).sort((a, b) => b[1] - a[1]);
    const byDate = {};
    filtered.forEach((p) => { if (!byDate[p.date]) byDate[p.date] = []; byDate[p.date].push(p); });
    const byDateArr = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));

    // "dibatalkan" (lihat batalkanDistribusi di bawah) SENGAJA tidak dihitung sbg
    // distribusi aktif — begitu dibatalkan, jatah pcs-nya kembali tersedia utk
    // didistribusikan ulang, dan badge "Sudah didistribusikan" ikut hilang kalau
    // semuanya sudah dibatalkan.
    const sudahDistrib = (prodId) => distribAll.some((d) => d.produksiId === prodId && d.status !== "dibatalkan");
    // Total pcs yang SUDAH dikirim untuk 1 produksi (bisa dari beberapa kali kirim bertahap).
    const getTotalTerdistribusi = (prodId) => distribAll.filter((d) => d.produksiId === prodId && d.status !== "dibatalkan").reduce((a, d) => a + (d.jumlahKirim || 0), 0);
    const getSisaBelumDistribusi = (p) => Math.max((p.jumlah || 0) - getTotalTerdistribusi(p.id), 0);
    const getDistribForm = (prodId) => distribForm[prodId] || {};
    const setDistribEntry = (prodId, branchId, val) => setDistribForm((f) => ({ ...f, [prodId]: { ...(f[prodId] || {}), [branchId]: val } }));

    const kirimDistribusi = async (p) => {
      const form = getDistribForm(p.id);
      const entries = branches.map((b) => ({ branchId: b.id, jumlah: parseInt(form[b.id] || "0") || 0 })).filter((e) => e.jumlah > 0);
      if (entries.length === 0) { pushNotif("Isi minimal 1 cabang dulu.", "warning"); return; }
      const totalKirim = entries.reduce((a, e) => a + e.jumlah, 0);
      // REVISI #1.3: validasi dihitung KUMULATIF terhadap distribusi yang SUDAH
      // pernah dikirim untuk produksi ini sebelumnya (distribusi bertahap) —
      // bukan cuma terhadap isian form saat ini. Sebelumnya bug ini bisa bikin
      // over-alokasi di atas kertas kalau owner kirim distribusi 2x terpisah
      // untuk produksi yang sama.
      const sudahTerkirim = getTotalTerdistribusi(p.id);
      const sisa = p.jumlah - sudahTerkirim;
      if (totalKirim > sisa) {
        pushNotif(`Total distribusi (${totalKirim}) melebihi sisa yang belum didistribusikan (${sisa} pcs — dari total produksi ${p.jumlah} pcs, sudah terkirim ${sudahTerkirim} pcs sebelumnya).`, "warning");
        return;
      }
      setDistribBusy((b) => ({ ...b, [p.id]: true }));
      try {
        const hppPerPcsDistrib = roundHppRp(p.hppPerPcs || getMenuHPPBreakdown(menus.find((m) => m.id === p.menuId))?.hppSatuanPerPcs || 0);
        const areaId = p.areaId || branches.find((b) => b.id === p.branchId)?.areaId || null;
        const lineMap = {};
        entries.forEach((e) => { lineMap[e.branchId] = { menuId: p.menuId, quantity: e.jumlah, unitCost: hppPerPcsDistrib }; });
        const transferId = "tr-" + p.id + "-" + entries.map((e) => e.branchId + "-" + e.jumlah).sort().join("_");
        const { error: transferError } = await sb.rpc("dispatch_stock_transfer", {
          p_id: transferId,
          p_area_id: areaId,
          p_from_branch_id: p.branchId,
          p_date: p.date,
          p_lines: lineMap,
          p_courier_id: null,
          p_note: "Distribusi dari produksi " + p.id
        });
        if (transferError) throw transferError;
        // Legacy projection sementara untuk tampilan lama; sumber stok resmi adalah stock_transfers.
        const rows = entries.map((e) => {
          const branch = branches.find((b) => b.id === e.branchId);
          return { id: uid(), date: p.date, ts: tsForDate(p.date), produksiId: p.id, transferId, menuId: p.menuId, menuNama: p.menuNama, totalProduksi: p.jumlah, branchId: e.branchId, branchName: branch?.name || e.branchId, jumlahKirim: e.jumlah, hppPerPcs: hppPerPcsDistrib, hppTotal: hppPerPcsDistrib * e.jumlah, status: "pending" };
        });
        const { error } = await sb.from("distribusiCK").insert(rows);
        if (error) throw error;
        await S.loadKey("distribusiCK");
        setDistribForm((f) => { const c = { ...f }; delete c[p.id]; return c; });
        pushNotif("Distribusi berhasil dikirim ke " + entries.length + " cabang!", "success");
      } catch(e) { pushNotif(e?.message || String(e), "warning"); }
      finally { setDistribBusy((b) => { const c = { ...b }; delete c[p.id]; return c; }); }
    };

    const distribPending = distribAll.filter((d) => d.status === "pending");
    const distribDiterima = distribAll.filter((d) => d.status === "diterima");
    const distribDibatalkan = distribAll.filter((d) => d.status === "dibatalkan");
    const distribSelisih = distribAll.filter((d) => d.status === "diterima" && d.selisih !== 0);
    const distribFiltered = distribAll.filter((d) => d.date >= dr.from && d.date <= dr.to);

    // ─── Hapus Produksi — DIPERBAIKI (lihat checklist audit "Hapus Produksi tidak
    // cascade ke Distribusi"). Sebelumnya tombol ini langsung hapus tanpa cek
    // apa-apa, padahal distribusiCK adalah tabel TERPISAH yang tidak pernah ikut
    // terhapus otomatis, dan kalau distribusinya sudah "diterima", stok lapak
    // sudah benar-benar bertambah nyata di database. 3 skenario:
    //   1. Belum pernah didistribusikan sama sekali        -> aman hapus langsung.
    //   2. Sudah didistribusikan tapi SEMUA masih Pending   -> aman, hapus produksi
    //      SEKALIGUS semua baris distribusi pending-nya (belum ada stok yg berubah).
    //   3. Ada distribusi yang SUDAH Diterima (stok sudah nambah) -> BLOKIR hapus
    //      langsung, arahkan ke tombol "Batalkan/Retur" di tab Distribusi supaya
    //      stok ditarik balik dengan benar dulu, baru produksi boleh dihapus.
    const hapusProduksi = (p) => {
      const related = distribAll.filter((d) => d.produksiId === p.id && d.status !== "dibatalkan");

      if (related.length === 0) {
        confirmAsk({
          title: "Hapus Produksi",
          message: `Hapus catatan produksi "${p.menuNama}" (${p.jumlah} pcs, ${formatTanggalIndo(p.date)})? Belum pernah didistribusikan, aman dihapus.`,
          danger: true,
          confirmLabel: "Hapus",
          onConfirm: async () => {
            try { await batalkanPemakaianProduksi(p.id); } catch (e) { pushNotif("Stok gudang gagal diretur: " + (e?.message || e), "warning"); }
            S.set("produksiCK", (S.get("produksiCK") || []).filter((x) => x.id !== p.id));
            pushNotif("Produksi dihapus.", "warning");
          },
        });
        return;
      }

      const diterima = related.filter((d) => d.status === "diterima");
      const pending = related.filter((d) => d.status === "pending");

      if (diterima.length === 0) {
        const rincian = pending.map((d) => `${d.branchName} (${d.jumlahKirim} pcs, belum dikonfirmasi)`).join(", ");
        confirmAsk({
          title: "Hapus Produksi + Distribusinya",
          message: `Produksi ini sudah didistribusikan ke: ${rincian} — tapi SEMUA masih Pending, jadi belum ada stok yang berubah. Menghapus produksi ini akan IKUT MENGHAPUS ${pending.length} catatan distribusi tsb sekaligus. Lanjutkan?`,
          danger: true,
          confirmLabel: "Hapus Semua",
          onConfirm: async () => {
            const idsToDelete = new Set(pending.map((d) => d.id));
            S.set("distribusiCK", (S.get("distribusiCK") || []).filter((x) => !idsToDelete.has(x.id)));
            try { await batalkanPemakaianProduksi(p.id); } catch (e) { pushNotif("Stok gudang gagal diretur: " + (e?.message || e), "warning"); }
            S.set("produksiCK", (S.get("produksiCK") || []).filter((x) => x.id !== p.id));
            pushNotif(`Produksi & ${pending.length} distribusi pending-nya berhasil dihapus.`, "warning");
          },
        });
        return;
      }

      const rincianDiterima = diterima.map((d) => `${d.branchName}: ${d.jumlahTerima ?? d.jumlahKirim} pcs (SUDAH menambah stok)`).join(", ");
      const rincianPending = pending.length > 0 ? ` Selain itu masih Pending: ${pending.map((d) => `${d.branchName} (${d.jumlahKirim} pcs)`).join(", ")}.` : "";
      confirmAsk({
        title: "⚠️ Tidak Bisa Dihapus Langsung",
        message: `Produksi ini sudah didistribusikan dan SUDAH DIKONFIRMASI DITERIMA di: ${rincianDiterima}.${rincianPending}\n\nMenghapus produksi di sini TIDAK akan menarik balik stok yang sudah bertambah itu — datanya akan tidak sinkron dengan stok fisik. Buka tab kiriman ke toko, cari baris yang sudah diterima, lalu pakai tombol "Batalkan/Retur" untuk menarik balik stoknya dengan benar. Setelah semua baris distribusi produksi ini beres (dihapus/dibatalkan), baru produksi ini bisa dihapus.`,
        confirmLabel: "Mengerti",
        onConfirm: async () => {},
      });
    };

    // ─── Batalkan/Retur Distribusi yang sudah Diterima ──────────────────────
    // Menandai distribusiCK jadi "dibatalkan" (BUKAN dihapus — supaya jejak
    // auditnya tetap ada) + menarik balik stok lapak sejumlah yang tadinya
    // ditambahkan. Kalau stok saat ini sudah kurang dari itu (sebagian sudah
    // kejual/kepakai), stok disetel ke 0 (tidak sampai minus) dan ownernya
    // diberi tahu jelas berapa pcs yang "hilang" (kemungkinan sudah terjual).
    const batalkanDistribusi = (d) => {
      const jmlTarik = d.jumlahTerima != null ? d.jumlahTerima : d.jumlahKirim;
      confirmAsk({
        title: "Batalkan / Retur Distribusi",
        message: `Ini akan menandai distribusi "${d.menuNama}" ke ${d.branchName} (${jmlTarik} pcs) sebagai DIBATALKAN, dan MENGURANGI stok ${d.branchName} sebesar ${jmlTarik} pcs. Kalau stok yang tersisa di sana sekarang lebih sedikit dari ${jmlTarik} pcs (misal sudah kejual), stok akan disetel ke 0 dan kamu akan diberi tahu selisihnya — bukan dibuat minus. Tulis alasan pembatalan (wajib, tersimpan permanen):`,
        requireText: true,
        textLabel: "Alasan pembatalan",
        textPlaceholder: "Contoh: salah input produksi, distribusi keliru...",
        confirmLabel: "Batalkan & Tarik Stok",
        danger: true,
        onConfirm: async (alasan) => {
          if (!alasan || !alasan.trim()) {
            pushNotif("Alasan wajib diisi.", "warning");
            throw new Error("Alasan kosong");
          }
          setReturBusy((b) => ({ ...b, [d.id]: true }));
          try {
            const stoks = S.get("stokLapak") || [];
            const existing = stoks.find((s) => s.branchId === d.branchId && s.menuId === d.menuId);
            const stokSaatIni = existing?.stok || 0;
            const stokBaru = Math.max(stokSaatIni - jmlTarik, 0);
            const kekurangan = jmlTarik - stokSaatIni; // > 0 = sebagian sudah kejual/hilang sebelum retur
            await upsertStokLapak(d.branchId, d.menuId, stokBaru, existing);
            await S.loadKey("stokLapak");

            const { data: sess } = await sb.auth.getSession();
            const uid = sess?.session?.user?.id || null;
            const { error } = await sb.from("distribusiCK")
              .update({ status: "dibatalkan", catatanBatal: alasan.trim(), batalAt: nowIso(), batalBy: uid })
              .eq("id", d.id);
            if (error) throw error;
            await S.loadKey("distribusiCK");

            pushNotif(
              kekurangan > 0
                ? `Distribusi dibatalkan. Stok ${d.branchName} cuma tersisa ${stokSaatIni} pcs (sudah ditarik jadi 0) — ${kekurangan} pcs dari distribusi ini sepertinya sudah terjual/terpakai sebelum dibatalkan, cek manual kalau perlu.`
                : `Distribusi dibatalkan & ${jmlTarik} pcs stok ${d.branchName} sudah ditarik balik.`,
              "warning"
            );
          } catch (e) {
            pushNotif(e?.message || String(e), "warning");
            throw e;
          } finally {
            setReturBusy((b) => { const c = { ...b }; delete c[d.id]; return c; });
          }
        },
      });
    };

    // ─── Hapus Distribusi yang MASIH Pending (belum Diterima) ───────────────
    // Beda dari batalkanDistribusi() di atas: baris berstatus "pending" BELUM
    // PERNAH menyentuh stokLapak sama sekali (stok baru bertambah nyata saat
    // dikonfirmasi Diterima), jadi tidak perlu tarik-stok & tidak wajib isi
    // alasan seperti Retur. Cukup tandai "dibatalkan" (bukan hapus baris fisik,
    // supaya tetap ada jejaknya) — dan karena hitungBiayaCkPerCabang() &
    // hitungPerformaPeriode() SUDAH memfilter `status !== "dibatalkan"`, baris
    // ini otomatis ke-exclude dari semua laporan tanpa perlu ubah rumus lain.
    // Ini menutup gap: sebelumnya baris Pending yang salah input hanya bisa
    // dibereskan lewat tombol "X" di Produksi (yang ikut menghapus SEMUA
    // distribusi pending produksi itu, dan diblokir total kalau ada
    // saudara-nya yang sudah Diterima) — sekarang bisa langsung per-baris.
    const hapusDistribusiPending = (d) => {
      confirmAsk({
        title: "Hapus Distribusi (Pending)",
        message: `Hapus distribusi "${d.menuNama}" ke ${d.branchName} (${d.jumlahKirim} pcs)? Statusnya masih Pending — belum ada stok yang berubah, jadi aman dihapus langsung tanpa perlu menunggu dikonfirmasi cabang.`,
        danger: true,
        confirmLabel: "Hapus",
        onConfirm: async () => {
          setReturBusy((b) => ({ ...b, [d.id]: true }));
          try {
            const { data: sess } = await sb.auth.getSession();
            const uid = sess?.session?.user?.id || null;
            const { error } = await sb.from("distribusiCK")
              .update({ status: "dibatalkan", catatanBatal: "Dihapus saat masih Pending (input keliru, belum dikonfirmasi cabang).", batalAt: nowIso(), batalBy: uid })
              .eq("id", d.id);
            if (error) throw error;
            await S.loadKey("distribusiCK");
            pushNotif("Distribusi pending berhasil dihapus.", "warning");
          } catch (e) {
            pushNotif(e?.message || String(e), "warning");
            throw e;
          } finally {
            setReturBusy((b) => { const c = { ...b }; delete c[d.id]; return c; });
          }
        },
      });
    };

    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Produksi & Distribusi Central Kitchen"),
      React.createElement("div", { className: "tabs mb8" },
        React.createElement("button", { className: "tab" + (subtab === "produksi" ? " active" : ""), onClick: () => setSubtab("produksi") }, "Produksi"),
        React.createElement("button", { className: "tab" + (subtab === "distribusi" ? " active" : ""), onClick: () => setSubtab("distribusi") },
          "Kirim ke toko",
          distribPending.length > 0 ? React.createElement("span", { style: { marginLeft: 4, background: "var(--yellow)", color: "#000", borderRadius: 8, padding: "1px 6px", fontSize: 10, fontWeight: 700 } }, distribPending.length) : null
        )
      ),
      React.createElement("div", { className: "filter-bar mb8" },
        React.createElement("input", { type: "date", className: "inp inp-sm", value: dr.from, onChange: (e) => setDr((r) => ({ ...r, from: e.target.value })) }),
        React.createElement("span", null, "s/d"),
        React.createElement("input", { type: "date", className: "inp inp-sm", value: dr.to, onChange: (e) => setDr((r) => ({ ...r, to: e.target.value })) })
      ),
      subtab === "produksi" && React.createElement("div", null,
        React.createElement("div", { className: "form-card mb8", style: { borderColor: "var(--accent)" } },
          React.createElement("h4", null, "Catat produksi baru"),
          React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Tanggal otomatis mengikuti tanggal \"Dari\" pada filter di bawah: ", React.createElement("strong", null, dr.from)),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Menu"),
            React.createElement("select", { className: "inp", value: inputForm.menuId, onChange: (e) => setInputForm((f) => ({ ...f, menuId: e.target.value })) },
              React.createElement("option", { value: "" }, "-- Pilih menu --"),
              menus.filter((m) => m.tipe !== "paket" && m.tipe !== "toping").map((m) => React.createElement("option", { key: m.id, value: m.id }, m.nama))
            )
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Jumlah (pcs)"),
            React.createElement("input", { type: "number", className: "inp", value: inputForm.jumlah, onChange: (e) => setInputForm((f) => ({ ...f, jumlah: e.target.value })) })
          ),
          // Preview stok gudang untuk menu terpilih
          !!inputForm.menuId && (() => {
            const menuPrev = menus.find((m) => m.id === inputForm.menuId);
            const est = estimasiMaxProduksiDariStok(menuPrev);
            const jmlPrev = parseInt(inputForm.jumlah) || 0;
            const cekPrev = jmlPrev > 0 ? cekStokBahanCukupUntukProduksi(menuPrev, jmlPrev) : null;
            return React.createElement("div", {
              className: "stok-preview" + (cekPrev && cekPrev.pakai.length && !cekPrev.ok ? " stok-preview-warn" : "") + " mb8"
            },
              est.unlimited
                ? React.createElement("div", { style: { fontSize: 12 } }, "Menu tanpa resep bahan — stok gudang tidak dipotong.")
                : React.createElement("div", { style: { fontSize: 12 } },
                    "Stok cukup untuk maks ",
                    React.createElement("strong", { style: { color: est.maxPcs > 0 ? "var(--green)" : "var(--red)" } }, est.maxPcs),
                    " pcs",
                    est.bottleneck ? " (bottleneck: " + est.bottleneck + ")" : "",
                    "."
                  ),
              cekPrev && cekPrev.pakai.length > 0 && React.createElement("div", { style: { fontSize: 11, color: "var(--text2)", marginTop: 4 } },
                cekPrev.ok
                  ? "Qty " + jmlPrev + ": bahan cukup."
                  : ("Qty " + jmlPrev + " kurang: " + cekPrev.kurang.map((k) => k.bahanNama).join(", "))
              )
            );
          })(),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Keterangan (opsional)"),
            React.createElement("input", { className: "inp", value: inputForm.keterangan, onChange: (e) => setInputForm((f) => ({ ...f, keterangan: e.target.value })) })
          ),
          React.createElement("label", { className: "peng-row", style: { cursor: "pointer", gap: 8, alignItems: "center", marginBottom: 8 } },
            React.createElement("input", {
              type: "checkbox",
              checked: !!inputForm.forceStok,
              onChange: (e) => setInputForm((f) => ({ ...f, forceStok: e.target.checked }))
            }),
            React.createElement("span", { style: { fontSize: 12 } }, "Tetap produksi walau stok kurang (khusus Owner — wajib restok setelahnya)")
          ),
          React.createElement("button", { className: "btn-primary btn-full", disabled: inputBusy, onClick: inputProduksi }, inputBusy ? "Menyimpan..." : "Simpan produksi")
        ),
        React.createElement("div", { className: "kpi-grid" },
          React.createElement("div", { className: "kpi-card kpi-omzet" }, React.createElement("div", { className: "kpi-label" }, "Total Produksi"), React.createElement("div", { className: "kpi-val" }, totalPcs, " pcs")),
          React.createElement("div", { className: "kpi-card kpi-modal" }, React.createElement("div", { className: "kpi-label" }, "Jenis Produk"), React.createElement("div", { className: "kpi-val" }, byMenuArr.length, " item")),
          React.createElement("div", { className: "kpi-card kpi-cab" }, React.createElement("div", { className: "kpi-label" }, "Entri Catatan"), React.createElement("div", { className: "kpi-val" }, filtered.length, "x")),
          React.createElement("div", { className: "kpi-card kpi-modal" }, React.createElement("div", { className: "kpi-label" }, "Total HPP Produksi"), React.createElement("div", { className: "kpi-val" }, fmtRp(totalHppProduksi)))
        ),
        byMenuArr.length > 0 && React.createElement("div", { className: "mt12" },
          React.createElement("h4", { className: "sub-title" }, "Rekap Per Produk"),
          React.createElement("div", { className: "tbl-wrap" },
            React.createElement("table", { className: "tbl" },
              React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Produk"), React.createElement("th", null, "Total Pcs"), React.createElement("th", null, "%"))),
              React.createElement("tbody", null,
                byMenuArr.map(([nama, jml]) => React.createElement("tr", { key: nama },
                  React.createElement("td", null, React.createElement("strong", null, nama)),
                  React.createElement("td", { style: { color: "var(--green)", fontWeight: 700 } }, jml, " pcs"),
                  React.createElement("td", { style: { color: "var(--text2)" } }, totalPcs > 0 ? Math.round(jml / totalPcs * 100) : 0, "%")
                )),
                React.createElement("tr", { style: { borderTop: "2px solid var(--border)", fontWeight: 700 } }, React.createElement("td", null, "TOTAL"), React.createElement("td", { style: { color: "var(--green)" } }, totalPcs, " pcs"), React.createElement("td", null, "100%"))
              )
            )
          )
        ),
        byDateArr.length > 0 && React.createElement("div", { className: "mt12" },
          React.createElement("h4", { className: "sub-title" }, "Riwayat Harian + Distribusi"),
          byDateArr.map(([date, rows]) => {
            const dayTotal = rows.reduce((a, p) => a + (p.jumlah || 0), 0);
            return React.createElement("div", { key: date, className: "accordion-card" },
              React.createElement("div", { className: "accordion-header", onClick: () => setOpenDay((o) => ({ ...o, [date]: !o[date] })) },
                React.createElement("div", { className: "accordion-title" },
                  React.createElement("span", { style: { fontWeight: 700 } }, formatTanggalIndo(date)),
                  React.createElement("span", { className: "accordion-omzet" }, dayTotal, " pcs total")
                ),
                React.createElement("span", { className: "accordion-arrow" }, openDay[date] ? "▲" : "▼")
              ),
              openDay[date] && React.createElement("div", { className: "accordion-body" },
                rows.map((p) =>
                  React.createElement("div", { key: p.id, style: { marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border)" } },
                    React.createElement("div", { className: "peng-row" },
                      React.createElement("div", { className: "peng-info" },
                        React.createElement("span", { className: "peng-ket" }, p.menuNama),
                        React.createElement("span", { className: "peng-ts" }, p.keterangan || "-", " | ", p.ts)
                      ),
                      React.createElement("div", { className: "peng-right" },
                        React.createElement("span", { style: { color: "var(--green)", fontWeight: 700 } }, p.jumlah, " pcs"),
                        React.createElement("button", { className: "btn-danger-sm", style: { marginLeft: 8 }, onClick: () => hapusProduksi(p) }, "X")
                      )
                    ),
                    sudahDistrib(p.id) && React.createElement("div", { style: { marginTop: 6, padding: "6px 10px", background: "color-mix(in srgb, var(--green) 12%, var(--bg2))", borderRadius: 6, fontSize: 12, color: "var(--green)" } },
                      "✅ Sudah didistribusikan — ",
                      distribAll.filter((d) => d.produksiId === p.id && d.status !== "dibatalkan").map((d) => d.branchName + ": " + d.jumlahKirim + " pcs" + (d.status === "diterima" ? " (diterima)" : " (pending)")).join(", ")
                    ),
                    distribAll.some((d) => d.produksiId === p.id && d.status === "dibatalkan") && React.createElement("div", { style: { marginTop: 6, padding: "6px 10px", background: "color-mix(in srgb, var(--text2) 12%, var(--bg2))", borderRadius: 6, fontSize: 11, color: "var(--text2)" } },
                      "🚫 Ada distribusi dari produksi ini yang sudah dibatalkan/diretur — ",
                      distribAll.filter((d) => d.produksiId === p.id && d.status === "dibatalkan").map((d) => d.branchName + ": " + (d.jumlahTerima ?? d.jumlahKirim) + " pcs").join(", ")
                    ),
                    getSisaBelumDistribusi(p) <= 0
                      ? (sudahDistrib(p.id) && React.createElement("div", { style: { marginTop: 4, fontSize: 11, color: "var(--text2)" } }, "Seluruh hasil produksi ini sudah terdistribusi habis."))
                      : React.createElement("div", { style: { marginTop: 8, padding: "8px 10px", background: "var(--bg3)", borderRadius: 8, border: "1px solid var(--border)" } },
                          React.createElement("div", { style: { fontSize: 12, color: "var(--accent)", fontWeight: 700, marginBottom: 6 } },
                            "🚚 ", sudahDistrib(p.id) ? "Lanjutkan Distribusi (Bertahap)" : "Distribusi ke Cabang",
                            " — sisa ", getSisaBelumDistribusi(p), " pcs belum didistribusikan"
                          ),
                          branches.length === 0 && React.createElement("p", { style: { fontSize: 12, color: "var(--text2)" } }, "Belum ada cabang lapak."),
                          branches.map((b) =>
                            React.createElement("div", { key: b.id, className: "row-wrap", style: { marginBottom: 4, gap: 8, alignItems: "center" } },
                              React.createElement("span", { style: { fontSize: 12, minWidth: 90 } }, b.name),
                              React.createElement("input", { type: "number", className: "inp inp-sm", style: { width: 80 }, placeholder: "0 pcs", min: 0, value: getDistribForm(p.id)[b.id] || "", onChange: (e) => setDistribEntry(p.id, b.id, e.target.value) }),
                              React.createElement("span", { style: { fontSize: 11, color: "var(--text2)" } }, "pcs")
                            )
                          ),
                          React.createElement("div", { style: { marginTop: 6, fontSize: 11, color: "var(--text2)" } },
                            "Total diisi: ",
                            React.createElement("strong", { style: { color: Object.values(getDistribForm(p.id)).reduce((a, v) => a + (parseInt(v) || 0), 0) > getSisaBelumDistribusi(p) ? "var(--red)" : "var(--green)" } },
                              Object.values(getDistribForm(p.id)).reduce((a, v) => a + (parseInt(v) || 0), 0), " / ", getSisaBelumDistribusi(p), " pcs sisa"
                            )
                          ),
                          React.createElement("button", { className: "btn-primary btn-sm", style: { marginTop: 8 }, disabled: !!distribBusy[p.id], onClick: () => kirimDistribusi(p) }, distribBusy[p.id] ? "Mengirim..." : "🚚 Kirim Distribusi")
                        )
                  )
                )
              )
            );
          })
        ),
        filtered.length === 0 && React.createElement("p", { className: "empty-txt mt8" }, "Belum ada data produksi untuk rentang tanggal ini.")
      ),
      subtab === "distribusi" && React.createElement("div", null,
        React.createElement("div", { className: "kpi-grid" },
          React.createElement("div", { className: "kpi-card kpi-omzet" }, React.createElement("div", { className: "kpi-label" }, "Total Dikirim"), React.createElement("div", { className: "kpi-val" }, distribFiltered.reduce((a, d) => a + (d.jumlahKirim || 0), 0), " pcs")),
          React.createElement("div", { className: "kpi-card", style: { background: "color-mix(in srgb, var(--yellow) 10%, var(--bg2))", border: "1px solid #f59e0b" } }, React.createElement("div", { className: "kpi-label" }, "Menunggu Konfirmasi"), React.createElement("div", { className: "kpi-val", style: { color: "var(--yellow)" } }, distribPending.length, "x")),
          React.createElement("div", { className: "kpi-card kpi-profit" }, React.createElement("div", { className: "kpi-label" }, "Sudah Diterima"), React.createElement("div", { className: "kpi-val", style: { color: "var(--green)" } }, distribDiterima.length, "x")),
          distribSelisih.length > 0 && React.createElement("div", { className: "kpi-card kpi-peng" }, React.createElement("div", { className: "kpi-label" }, "Ada selisih uang"), React.createElement("div", { className: "kpi-val", style: { color: "var(--red)" } }, distribSelisih.length, "x")),
          distribDibatalkan.length > 0 && React.createElement("div", { className: "kpi-card", style: { background: "color-mix(in srgb, var(--text2) 10%, var(--bg2))" } }, React.createElement("div", { className: "kpi-label" }, "Dibatalkan"), React.createElement("div", { className: "kpi-val", style: { color: "var(--text2)" } }, distribDibatalkan.length, "x")),
          React.createElement("div", { className: "kpi-card kpi-modal" }, React.createElement("div", { className: "kpi-label" }, "Total HPP Distribusi"), React.createElement("div", { className: "kpi-val" }, fmtRp(distribFiltered.reduce((a, d) => a + (d.hppTotal || 0), 0))))
        ),
        React.createElement("div", { className: "tbl-wrap mt12" },
          React.createElement("table", { className: "tbl" },
            React.createElement("thead", null, React.createElement("tr", null,
              React.createElement("th", null, "Tanggal"), React.createElement("th", null, "Produk"), React.createElement("th", null, "Cabang"),
              React.createElement("th", null, "Kirim"), React.createElement("th", null, "Terima"), React.createElement("th", null, "Selisih"), React.createElement("th", null, "HPP"), React.createElement("th", null, "Status"), React.createElement("th", null, "Aksi")
            )),
            React.createElement("tbody", null,
              distribFiltered.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((d) =>
                React.createElement("tr", { key: d.id, style: d.status === "dibatalkan" ? { opacity: 0.6 } : null },
                  React.createElement("td", { style: { fontSize: 11 } }, formatTanggalIndoPendek(d.date)),
                  React.createElement("td", null, React.createElement("strong", null, d.menuNama)),
                  React.createElement("td", null, d.branchName),
                  React.createElement("td", { style: { color: "var(--green)" } }, d.jumlahKirim, " pcs"),
                  React.createElement("td", null, d.jumlahTerima != null ? d.jumlahTerima + " pcs" : "-"),
                  React.createElement("td", { style: { color: d.selisih < 0 ? "var(--red)" : d.selisih > 0 ? "var(--yellow)" : "var(--green)", fontWeight: 700 } },
                    d.status === "diterima" ? (d.selisih === 0 ? "Sesuai" : (d.selisih > 0 ? "+" : "") + d.selisih) : "-",
                    d.catatanSelisih ? React.createElement("div", { style: { fontSize: 10, color: "var(--text2)", fontWeight: 400 } }, d.catatanSelisih) : null
                  ),
                  React.createElement("td", { style: { fontSize: 11, color: "var(--text2)" } }, fmtRp(d.hppTotal || 0)),
                  React.createElement("td", null,
                    d.status === "pending" ? React.createElement("span", { style: { color: "var(--yellow)", fontSize: 11, fontWeight: 700 } }, "Menunggu")
                    : d.status === "dibatalkan" ? React.createElement("span", { style: { color: "var(--text2)", fontSize: 11, fontWeight: 700 } }, "Dibatalkan")
                    : React.createElement("span", { style: { color: "var(--green)", fontSize: 11, fontWeight: 700 } }, "Sudah diterima"),
                    d.status === "dibatalkan" && d.catatanBatal ? React.createElement("div", { style: { fontSize: 10, color: "var(--text2)", marginTop: 2 } }, d.catatanBatal) : null
                  ),
                  React.createElement("td", null,
                    d.status === "diterima" ? React.createElement("button", {
                      className: "btn-danger-sm", style: { fontSize: 10 }, disabled: !!returBusy[d.id],
                      onClick: () => batalkanDistribusi(d),
                    }, returBusy[d.id] ? "..." : "Batalkan")
                    : d.status === "pending" ? React.createElement("button", {
                      className: "btn-danger-sm", style: { fontSize: 10 }, disabled: !!returBusy[d.id],
                      onClick: () => hapusDistribusiPending(d),
                    }, returBusy[d.id] ? "..." : "Hapus")
                    : "-"
                  )
                )
              ),
              distribFiltered.length === 0 && React.createElement("tr", null, React.createElement("td", { colSpan: 9, style: { textAlign: "center", color: "var(--text2)", padding: 16 } }, "Belum ada distribusi di rentang ini."))
            )
          )
        )
      ),
      confirmModal
    );
  }
  // ─── OwnerDashboard ────────────────────────────────────────────────────────
  function OwnerDashboard({ setTab, setStab, setHppFocus, pushNotif, me, managerMode, managerCities }) {
    const [dr, setDr] = useState({ from: startOfMonth(), to: today() });
    const [selBranch, setSelBranch] = useState("all");
    const [expandedBranch, setExpandedBranch] = useState(null);
    const [kpiDetail, setKpiDetail] = useState(null);
    const [statusDay, setStatusDay] = useState("today"); // today | yesterday
    const lockedCities = (managerMode && managerCities && managerCities.length) ? managerCities : null;
    const [cityFilter, setCityFilter] = useState(() => (lockedCities && lockedCities.length === 1 ? lockedCities[0] : "all"));
    useEffect(() => {
      // Area Manager: paksa filter kota ke jatahnya
      if (lockedCities && lockedCities.length) {
        if (cityFilter === "all" && lockedCities.length === 1) setCityFilter(lockedCities[0]);
        else if (cityFilter !== "all" && !lockedCities.some((c) => c.toLowerCase() === String(cityFilter).toLowerCase())) {
          setCityFilter(lockedCities.length === 1 ? lockedCities[0] : "all");
        }
      }
    }, [lockedCities && lockedCities.join("|"), cityFilter]);
    useEffect(() => {
      if (S.ensureRange && dr && dr.from) {
        S.ensureRange(dr.from, dr.to || today()).catch(() => {});
      }
    }, [dr.from, dr.to]);
    const branchesAllRaw = S.get("branches") || [];
    const branches = filterBranchesForProfile(branchesAllRaw, me || { role: managerMode ? "manager" : "owner", cities: managerCities });
    // branchesNonCK dipakai buat isi PILIHAN dropdown — sengaja daftar SEMUA
    // cabang non-CK apa adanya, terlepas dari filter yang sedang aktif.
    const branchesNonCK = branches.filter((b) => b.type !== "central_kitchen");
    const txs = S.get("transactions") || [];
    const pL = S.get("pengeluaranLapak") || [];
    const pO = S.get("pengeluaranOwner") || [];
    const profilesAll = S.get("profiles") || [];
    const investorsAll = S.get("investors") || [];
    const distribAll = S.get("distribusiCK") || [];
    const stokTidakTerjualAll = S.get("stokTidakTerjual") || [];
    const menusAll = S.get("menuVarian") || [];

    // ─── REVISI AUDIT: dulu di sini ada salinan rumus laba/rugi sendiri,
    // terpisah dari hitungPerformaPeriode — persis pola yang pernah bikin
    // bug "laba Dashboard vs TutupBuku beda sendiri". Sekarang Dashboard
    // memanggil hitungPerformaPeriode yang SAMA dipakai PerformaPeriode &
    // TutupBuku, jadi kalau rumusnya perlu berubah lagi cukup diubah SATU
    // tempat. Dropdown "Semua cabang sendiri"/"Semua cabang investor"
    // dipetakan ke param {branchId, tipe} yang fungsi ini sudah pahami.
    const scopeParams = selBranch === "__mandiri__" ? { branchId: "all", tipe: "mandiri" }
      : selBranch === "__investasi__" ? { branchId: "all", tipe: "investasi" }
      : { branchId: selBranch, tipe: "all" };
    // Filter cabang by kota (scale multi-kota)
    const branchesForCalc = (() => {
      let list = branches;
      if (lockedCities && lockedCities.length) {
        list = list.filter((b) => b.type === "central_kitchen" || branchInCities(b, lockedCities));
      }
      if (cityFilter !== "all") {
        list = list.filter((b) => b.type === "central_kitchen" || String(b.city || "") === cityFilter);
      }
      return list;
    })();
    const hasil = hitungPerformaPeriode({
      txs, pL, pO, distribAll, stokTidakTerjualAll, branches: branchesForCalc, investorsAll,
      dateFrom: dr.from, dateTo: dr.to, ...scopeParams,
    });
    const { omzet, hppTidakLaku, donatTidakTerjual, peng, laba, ckSplit, nBranchForSplit, branchesInScope } = hasil;
    const modal = hasil.hppDistribusi; // HPP yang dipakai untuk Laba Bersih = HPP seluruh barang yang didistribusikan
    const fTxs = hasil.detail.transaksi;
    const fPL = hasil.detail.pengeluaranLapak;
    const fPO = hasil.detail.pengeluaranOwner;
    const fDistrib = hasil.detail.distribusiCK;
    const fStokTidakTerjual = hasil.detail.stokTidakTerjual;

    const danaPemList = S.get("danaPemeliharaan") || [];
    const saldoDanaPemeliharaan = danaPemList.reduce((a, d) => a + (d.tipe === "setor" ? d.jumlah : -d.jumlah), 0);

    // Alert operasional harian (stok gudang + setoran selisih/menunggu)
    const gudangSaldoMap = getAllStokBahanSaldoMap();
    const bahanAllDash = S.get("bahanPokok") || [];
    const gudangHabis = bahanAllDash.filter((b) => (gudangSaldoMap[b.id] != null ? gudangSaldoMap[b.id] : 0) <= 0);
    const gudangMenipis = bahanAllDash.filter((b) => {
      const s = gudangSaldoMap[b.id] != null ? gudangSaldoMap[b.id] : 0;
      return s > 0 && s < Math.max((Number(b.kapasitas) || 0) * 0.2, 5);
    });
    const setoranAllDash = S.get("setoranHarian") || [];
    const setoranMenunggu = setoranAllDash.filter((s) => s.status === "menunggu");
    const setoranSelisih = setoranAllDash.filter((s) => s.selisihKas != null && Math.abs(Number(s.selisihKas)) >= 1 && s.status !== "selesai");
    const hasOpsAlert = gudangHabis.length || gudangMenipis.length || setoranMenunggu.length || setoranSelisih.length;
    // Uang dari kurir yang sedang dalam perjalanan → owner konfirmasi terima
    const uangKurirPerjalanan = getKurirList().filter((k) => k.statusUang === "perjalanan");
    const totalUangKurir = uangKurirPerjalanan.reduce((a, k) => a + k.uangDibawa, 0);
    const [kurirBusy, setKurirBusy] = useState(false);
    const konfirmasiUangKurir = async () => {
      if (uangKurirPerjalanan.length === 0) return;
      setKurirBusy(true);
      try {
        const ids = new Set(uangKurirPerjalanan.map((k) => k.id));
        await mutateLedger(loadKurirFromDb, (list) => list.map((k) => ids.has(k.id) ? { ...k, statusUang: "dikonfirmasi", disetorOwner: true, konfirmasiTs: nowIso() } : k), saveKurirToDb);
        pushNotif && pushNotif("Uang kurir dikonfirmasi diterima: " + fmtRp(totalUangKurir) + ". Semua laporan hijau \u2705", "success");
      } catch (e) { pushNotif && pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setKurirBusy(false); }
    };

    const [hideSetup, setHideSetup] = useState(() => {
      try { return localStorage.getItem("donatboss_hide_setup_wizard") === "1"; } catch { return false; }
    });
    const [hideResepBanner, setHideResepBanner] = useState(() => {
      try { return localStorage.getItem("donatboss_resep_banner_hide_" + today()) === "1"; } catch { return false; }
    });
    const [hideStokBanner, setHideStokBanner] = useState(() => {
      try { return localStorage.getItem("donatboss_stok_banner_hide_" + today()) === "1"; } catch { return false; }
    });
    const [hideSetoranBanner, setHideSetoranBanner] = useState(() => {
      try { return localStorage.getItem("donatboss_setoran_banner_hide_" + today()) === "1"; } catch { return false; }
    });
    const menusSatuan = (S.get("menuVarian") || []).filter((m) => m.tipe !== "paket" && m.tipe !== "toping");
    const menusDenganResep = menusSatuan.filter((m) => m.resepBahanPokok && m.resepBahanPokok.length);
    const workersAktif = (S.get("profiles") || []).filter((p) => isActiveProfile(p) && p.role === "worker");
    const adaStokGudang = Object.values(gudangSaldoMap || {}).some((v) => Number(v) > 0);
    const adaCabangCK = (S.get("branches") || []).some((b) => b.type === "central_kitchen");
    const setupSteps = [
      { key: "cabang", label: "Cabang & Central Kitchen", done: (S.get("branches") || []).length > 0 && adaCabangCK, go: () => { setTab && setTab("setting"); setStab && setStab("cabang"); }, hint: "Tambah cabang lapak + 1 central kitchen" },
      { key: "bahan", label: "Bahan pokok + HPP", done: (S.get("bahanPokok") || []).length > 0, go: () => { setHppFocus && setHppFocus("bahan"); setTab && setTab("setting"); setStab && setStab("hpp"); }, hint: "Kentang, gandum, minyak… harga & kapasitas" },
      { key: "resep", label: "Resep semua menu", done: menusSatuan.length > 0 && menusDenganResep.length === menusSatuan.length, go: () => { setHppFocus && setHppFocus("menu"); setTab && setTab("setting"); setStab && setStab("hpp"); }, hint: "Buka daftar menu — isi yang masih tanpa resep" },
      { key: "stok", label: "Stok gudang awal", done: adaStokGudang, go: () => { setTab && setTab("setting"); setStab && setStab("gudang"); }, hint: "Restok / koreksi di Gudang Bahan" },
      { key: "pekerja", label: "Akun pekerja + gaji", done: workersAktif.length > 0, go: () => { setTab && setTab("setting"); setStab && setStab("akun"); }, hint: "Kasir & CK: cabang + gaji harian" }
    ];
    const setupDone = setupSteps.filter((s) => s.done).length;
    const setupTotal = setupSteps.length;
    const setupComplete = setupDone === setupTotal;
    const showSetupWizard = !hideSetup && !setupComplete;
    // Pengingat tutup buku: 3 hari terakhir bulan + 5 hari awal bulan berikutnya (untuk bulan lalu)
    const [hideTutupBanner, setHideTutupBanner] = useState(() => {
      try { return localStorage.getItem("donatboss_tutup_banner_hide_" + today()) === "1"; } catch { return false; }
    });
    const [tutupBukuStatus, setTutupBukuStatus] = useState({ loading: true, prevClosed: null, checkedBulan: null });
    const tutupReminder = (() => {
      const t = today(); // YYYY-MM-DD
      const y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)), d = Number(t.slice(8, 10));
      const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month
      const daysLeft = lastDay - d;
      const diAkhirBulan = daysLeft <= 2; // H-2, H-1, H
      const diAwalBulan = d <= 5;
      let targetBulan = null;
      let mode = null;
      if (diAkhirBulan) {
        targetBulan = t.slice(0, 7); // tutup bulan berjalan
        mode = "akhir";
      } else if (diAwalBulan) {
        // bulan lalu
        const prev = m === 1 ? (y - 1) + "-12" : y + "-" + String(m - 1).padStart(2, "0");
        targetBulan = prev;
        mode = "awal";
      }
      return { active: !!(targetBulan && !hideTutupBanner), targetBulan, mode, daysLeft, day: d, lastDay };
    })();
    useEffect(() => {
      if (!tutupReminder.targetBulan) {
        setTutupBukuStatus({ loading: false, prevClosed: null, checkedBulan: null });
        return;
      }
      let dead = false;
      (async () => {
        try {
          const { data, error } = await sb.from("tutupBuku").select("bulan,is_current,closed_at").eq("bulan", tutupReminder.targetBulan).eq("is_current", true).maybeSingle();
          if (dead) return;
          if (error) throw error;
          setTutupBukuStatus({ loading: false, prevClosed: data || null, checkedBulan: tutupReminder.targetBulan });
        } catch {
          if (!dead) setTutupBukuStatus({ loading: false, prevClosed: null, checkedBulan: tutupReminder.targetBulan, error: true });
        }
      })();
      return () => { dead = true; };
    }, [tutupReminder.targetBulan]);
    const tutupBelum = tutupReminder.active && !tutupBukuStatus.loading && !tutupBukuStatus.prevClosed && !tutupBukuStatus.error;
    const menusTanpaResepDash = menusSatuan.filter((m) => !(m.resepBahanPokok && m.resepBahanPokok.length));
    const hasResepAlert = menusTanpaResepDash.length > 0 && !hideResepBanner;
    const gudangAlertItems = !hideStokBanner && (gudangHabis.length > 0 || gudangMenipis.length > 0);
    const setoranAlertItems = !hideSetoranBanner && (setoranMenunggu.length > 0 || setoranSelisih.length > 0);
    const hasOpsAlertFull = !!(
      (gudangAlertItems) ||
      setoranAlertItems ||
      hasResepAlert ||
      tutupBelum
    );

    // ─── Tambahan KHUSUS tampilan Dashboard (box/pcs terjual, daftar pekerja
    // per cabang) — ditempel di atas branchStats yang sudah final dihitung
    // hitungPerformaPeriode. Tidak ada angka uang (omzet/HPP/pengeluaran/laba)
    // yang dihitung ulang di sini. ─────────────────────────────────────────
    const branchStats = hasil.branchStats.map((b) => {
      let boxTerjual = 0, pcsTerjual = 0;
      fTxs.filter((t) => t.branchId === b.id).forEach((t) => (t.items || []).forEach((it) => {
        if (it.tipe === "toping") return;
        const md = menusAll.find((m) => m.id === it.menuId);
        if (md?.tipe === "paket") boxTerjual += it.qty; else pcsTerjual += it.qty;
      }));
      // Pekerja SUNGGUHAN yang akunnya terhubung ke cabang ini (dari tabel
      // profiles) — menimpa field "workers" lama yang cuma teks manual di
      // form Tambah Cabang dan bisa nyasar/telat sinkron dari akun asli.
      const workerProfiles = profilesAll.filter((p) => p.role === "worker" && p.branchId === b.id);
      return { ...b, workers: workerProfiles, boxTerjual, pcsTerjual };
    });
    const mc = {};
    fTxs.forEach((t) => t.items.forEach((it) => { mc[it.nama] = (mc[it.nama] || 0) + it.qty; }));
    const bs = Object.entries(mc).sort((a, b) => b[1] - a[1]).slice(0, 5);
    // Chart 7-hari cuma pakai cabang yang sedang match filter (bukan matchBranch
    // lama — logic itu sekarang sudah pindah ke dalam hitungPerformaPeriode).
    const scopeIds = new Set(branchesInScope.map((b) => b.id));
    const chart7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const dTxs = txs.filter((t) => t.date === ds && scopeIds.has(t.branchId));
      const dO = dTxs.reduce((a, t) => a + t.total, 0);
      const dM = dTxs.reduce((a, t) => a + t.totalHPP, 0);
      const dPLangsung = pL.filter((p) => p.date === ds && scopeIds.has(p.branchId)).reduce((a, p) => a + p.jumlah, 0)
        + pO.filter((p) => p.date === ds && p.branchId && scopeIds.has(p.branchId)).reduce((a, p) => a + p.jumlah, 0);
      const dPGlobalTotal = pO.filter((p) => p.date === ds && !p.branchId).reduce((a, p) => a + p.jumlah, 0);
      const dP = dPLangsung + dPGlobalTotal * (branchesInScope.length / nBranchForSplit);
      chart7.push({ label: ds.slice(5), v1: dO, v2: dM + dP });
    }
    const branchChart = branchStats.map((b) => ({ label: b.name.slice(0, 8), v1: b.omzet, v2: b.laba }));

    // ─── Breakdown per-KPI untuk modal detail (klik card) ────────────────────
    // REVISI: rincian sekarang per-item/per-transaksi (bukan cuma total per cabang)
    const bName = (id) => (id ? (branches.find((b) => b.id === id)?.name || id) : "Pusat/Global");
    const byTsDesc = (a, b) => (b.ts || b.date || "").localeCompare(a.ts || a.date || "");
    const KATEGORI_LABEL = { gaji_pekerja: "Gaji Pekerja Lapak", gaji_kitchen: "Gaji Central Kitchen", bahan_baku: "Bahan Baku", operasional: "Operasional", sewa: "Sewa Tempat", lainnya: "Lainnya", selisih_kas: "Selisih Kas" };

    const kpiBreakdowns = {
      omzet: {
        title: "Rincian Omzet", total: omzet, totalLabel: "Total Omzet",
        note: fTxs.length + " transaksi pada periode & cabang terpilih.",
        rows: fTxs.slice().sort(byTsDesc).map((t) => ({
          label: bName(t.branchId) + " — " + (t.items || []).map((it) => it.nama + " x" + it.qty).join(", "),
          sub: formatTanggalIndoPendek(t.date) + (t.ts ? " " + t.ts.slice(11, 16) : ""),
          value: t.total
        }))
      },
      modal: {
        title: "Rincian modal bahan", total: modal, totalLabel: "Total modal bahan terkirim",
        note: "HPP dihitung dari tiap distribusi CK yang dikirim ke cabang pada periode ini.",
        rows: fDistrib.slice().sort(byTsDesc).map((d) => ({
          label: (d.branchName || bName(d.branchId)) + " — " + d.menuNama,
          sub: formatTanggalIndoPendek(d.date) + " • kirim " + d.jumlahKirim + " pcs" + (d.status === "pending" ? " • Pending" : ""),
          value: d.hppTotal || 0
        }))
      },
      donatTidakTerjual: {
        title: "Rincian Donat Dibuang (Rugi)", total: donatTidakTerjual, totalLabel: "Total Donat Dibuang", isCount: true,
        note: "Donat yang benar-benar dibuang saat tutup toko (rusak atau sudah lewat 1 hari). Donat sisa yang masih bagus dibawa ke besok, TIDAK dihitung di sini.",
        rows: fStokTidakTerjual.slice().sort(byTsDesc).map((s) => ({
          label: bName(s.branchId) + " — " + s.menuNama,
          sub: formatTanggalIndoPendek(s.date),
          value: s.qtyTidakTerjual || 0, isCount: true
        }))
      },
      peng: {
        title: "Rincian Pengeluaran", total: peng, totalLabel: "Total Pengeluaran",
        note: (branchesInScope.length > 1
          ? "Setiap entri pengeluaran lapak & owner pada periode ini."
          : "Setiap entri pengeluaran lapak & owner pada periode ini. Biaya global/pusat (tanpa cabang) ditampilkan sebagai porsi bagi rata cabang ini, sama seperti di panel Performa Cabang.")
          + " Gaji Central Kitchen ditampilkan terpisah, dibagi proporsional ke pcs distribusi yang diterima tiap cabang (bukan bagi rata).",
        rows: [
          ...fPL.map((p) => ({ label: "[Lapak] " + p.keterangan, sub: formatTanggalIndoPendek(p.date) + " • " + (p.branchName || bName(p.branchId)), value: p.jumlah, ts: p.ts, date: p.date })),
          ...fPO.filter((p) => !(p.branchId && ckSplit.ckBranchIds.has(p.branchId))).map((p) => {
            const isGlobalShare = selBranch !== "all" && !p.branchId;
            const shareRatio = branchesInScope.length / nBranchForSplit;
            const value = isGlobalShare ? p.jumlah * shareRatio : p.jumlah;
            return {
              label: "[Owner] " + p.keterangan,
              sub: formatTanggalIndoPendek(p.date) + " • " + (p.branchName || bName(p.branchId)) + (p.kategori ? " • " + (KATEGORI_LABEL[p.kategori] || p.kategori) : "") + (isGlobalShare ? " • porsi " + branchesInScope.length + "/" + nBranchForSplit + " biaya global" : ""),
              value, ts: p.ts, date: p.date
            };
          }),
          ...branchesInScope.filter((b) => (ckSplit.perBranch[b.id] || 0) > 0).map((b) => ({
            label: "[CK] Gaji Central Kitchen — porsi " + b.name,
            sub: "Dibagi proporsional ke pcs distribusi yang diterima cabang ini pada periode ini",
            value: ckSplit.perBranch[b.id] || 0, ts: dr.to, date: dr.to
          }))
        ].sort(byTsDesc)
      },
      laba: {
        title: "Rincian Laba Bersih", total: laba, totalLabel: "Laba Bersih",
        note: "Laba = Omzet − HPP Bahan − Pengeluaran Lapak − Pengeluaran Owner (termasuk bagian rata biaya global/pusat, dan bagian proporsional gaji Central Kitchen berdasar pcs distribusi yang diterima).",
        rows: branchStats.map((b) => ({
          label: b.name,
          sub: "Omzet " + fmtRp(b.omzet) + " (" + b.txCount + "x transaksi) − HPP " + fmtRp(b.modal) + " (" + b.distribCount + "x distribusi) − Peng Lapak " + fmtRp(b.pengLapak) + " (" + b.pengLapakCount + " entri) − Peng Owner " + fmtRp(b.pengOwner) + " (" + b.pengOwnerCount + " entri" + (b.pengGlobalShare > 0 ? " + bagi rata global " + fmtRp(b.pengGlobalShare) : "") + (b.pengGajiCk > 0 ? " + porsi gaji CK " + fmtRp(b.pengGajiCk) : "") + ")",
          value: b.laba
        }))
      },
      tx: {
        title: "Rincian Transaksi", total: fTxs.length, totalLabel: "Total Transaksi", isCount: true,
        rows: fTxs.slice().sort(byTsDesc).map((t) => ({
          label: bName(t.branchId) + " — " + (t.items || []).map((it) => it.nama + " x" + it.qty).join(", "),
          sub: formatTanggalIndoPendek(t.date) + (t.ts ? " " + t.ts.slice(11, 16) : "") + (t.edited ? " • Diedit" : ""),
          value: fmtRp(t.total), isText: true
        }))
      },
      dana: {
        title: "Riwayat Dana Cadangan", total: saldoDanaPemeliharaan, totalLabel: "Saldo Saat Ini",
        rows: danaPemList.slice().sort(byTsDesc).map((d) => ({
          label: d.keterangan, sub: formatTanggalIndoPendek(d.date) + " • " + (d.tipe === "setor" ? "Setor" : "Tarik"),
          value: d.tipe === "setor" ? d.jumlah : -d.jumlah
        }))
      },
      cabang: {
        title: "Daftar Cabang", total: branchStats.length, totalLabel: "Total Cabang", isCount: true,
        note: "Pekerja di sini diambil dari akun login yang benar-benar terhubung ke cabang (bukan cuma catatan nama di halaman Cabang).",
        rows: branchStats.map((b) => {
          const workers = b.workers || [];
          const tipeLabel = b.type === "investasi" ? "Investasi" : b.type === "central_kitchen" ? "Dapur pusat (CK)" : "Mandiri";
          const investorNama = b.type === "investasi" ? (investorsAll.find((i) => i.id === b.investorId)?.nama || "-") : null;
          const subParts = [
            tipeLabel,
            workers.length + " pekerja" + (workers.length ? ": " + workers.map((w) => w.display_name || w.displayName || w.email || "-").join(", ") : "")
          ];
          if (investorNama) subParts.push("Investor: " + investorNama);
          subParts.push(b.txCount + "x transaksi periode ini");
          return { label: b.name, sub: subParts.join(" • "), value: b.omzet };
        })
      }
    };

    return React.createElement("div", null,
      React.createElement("div", { className: "filter-bar mb8" },
        React.createElement(DateField, { value: dr.from, onChange: (e) => setDr((r) => ({ ...r, from: e.target.value })) }),
        React.createElement("span", null, "s/d"),
        React.createElement(DateField, { value: dr.to, onChange: (e) => setDr((r) => ({ ...r, to: e.target.value })) }),
        React.createElement("select", { className: "inp inp-sm", value: selBranch, onChange: (e) => setSelBranch(e.target.value) },
          React.createElement("option", { value: "all" }, "Semua cabang"),
          React.createElement("option", { value: "__mandiri__" }, "Semua cabang sendiri"),
          React.createElement("option", { value: "__investasi__" }, "Semua cabang investor"),
          branchesNonCK.filter((b) => cityFilter === "all" || (b.city || "") === cityFilter).map((b) => React.createElement("option", { key: b.id, value: b.id }, b.city ? (b.name + " · " + b.city) : b.name))
        ),
        React.createElement("select", {
          className: "inp inp-sm",
          value: cityFilter,
          onChange: (e) => {
            setCityFilter(e.target.value);
            // reset cabang spesifik jika di luar kota
            setSelBranch("all");
          }
        },
          React.createElement("option", { value: "all" }, lockedCities && lockedCities.length ? "Semua kota saya" : "Semua kota"),
          (lockedCities && lockedCities.length
            ? lockedCities.slice().sort()
            : [...new Set(branchesNonCK.map((b) => b.city).filter(Boolean))].sort()
          ).map((city) =>
            React.createElement("option", { key: city, value: city }, city)
          )
        )
      ),
      uangKurirPerjalanan.length > 0 && React.createElement("div", { className: "alert-banner alert-banner-warn mb8" },
        React.createElement("div", { className: "alert-banner-title" }, "\uD83D\uDEF5 Uang dari kurir menuju kamu"),
        uangKurirPerjalanan.map((k) => React.createElement("div", { key: k.id, className: "alert-banner-item" },
          k.branchNama, " \u00B7 ", k.tanggal, " \u00B7 ", React.createElement("strong", null, fmtRp(k.uangDibawa)), " (kurir: ", k.kurir, ")"
        )),
        React.createElement("div", { className: "mt8" },
          React.createElement("button", { type: "button", className: "btn-primary btn-sm", disabled: kurirBusy, onClick: konfirmasiUangKurir }, kurirBusy ? "..." : "\u2705 Konfirmasi Terima " + fmtRp(totalUangKurir))
        )
      ),
      hasOpsAlertFull && React.createElement("div", {
        className: "alert-banner mb8 " + ((gudangHabis.length || setoranSelisih.length) ? "alert-banner-danger" : "alert-banner-warn")
      },
        React.createElement("div", {
          className: "alert-banner-title",
          style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }
        },
          React.createElement("span", null, "Yang perlu dicek"),
          React.createElement("button", {
            type: "button",
            className: "btn-secondary btn-sm",
            onClick: () => {
              const day = today();
              try {
                localStorage.setItem("donatboss_resep_nudge_" + day, "1");
                localStorage.setItem("donatboss_resep_banner_hide_" + day, "1");
                localStorage.setItem("donatboss_stok_nudge_" + day, "1");
                localStorage.setItem("donatboss_stok_banner_hide_" + day, "1");
                localStorage.setItem("donatboss_setoran_nudge_" + day, "1");
                localStorage.setItem("donatboss_setoran_banner_hide_" + day, "1");
                localStorage.setItem("donatboss_tutup_banner_hide_" + day, "1");
                localStorage.setItem("donatboss_tutup_nudge_" + day, "1");
              } catch {}
              setHideResepBanner(true);
              setHideStokBanner(true);
              setHideSetoranBanner(true);
              setHideTutupBanner(true);
              pushNotif && pushNotif("Semua pengingat disembunyikan untuk hari ini. Bisa ditampilkan lagi satu per satu di bawah.", "success");
            }
          }, "Sembunyikan semua hari ini")
        ),
        !hideStokBanner && gudangHabis.length > 0 && React.createElement("div", { className: "alert-banner-item" },
          React.createElement("strong", null, "Bahan habis: "), gudangHabis.slice(0, 4).map((b) => b.nama).join(", "), gudangHabis.length > 4 ? (" +" + (gudangHabis.length - 4) + " lagi") : "",
          " — buka menu Gudang."
        ),
        !hideStokBanner && gudangMenipis.length > 0 && React.createElement("div", { className: "alert-banner-item" },
          React.createElement("strong", null, "Bahan menipis: "), gudangMenipis.slice(0, 4).map((b) => b.nama).join(", "), gudangMenipis.length > 4 ? (" +" + (gudangMenipis.length - 4) + " lagi") : ""
        ),
        !hideStokBanner && (gudangHabis.length > 0 || gudangMenipis.length > 0) && React.createElement("div", { className: "mt8 row-wrap" },
          React.createElement("button", {
            type: "button", className: "btn-primary btn-sm",
            onClick: () => { setTab && setTab("setting"); setStab && setStab("gudang"); }
          }, "Buka gudang"),
          React.createElement("button", {
            type: "button", className: "btn-secondary btn-sm",
            onClick: () => {
              try {
                const day = today();
                localStorage.setItem("donatboss_stok_nudge_" + day, "1");
                localStorage.setItem("donatboss_stok_banner_hide_" + day, "1");
              } catch {}
              setHideStokBanner(true);
              pushNotif && pushNotif("Pengingat stok gudang disembunyikan untuk hari ini.", "success");
            }
          }, "Sembunyikan stok hari ini")
        ),
        !hideSetoranBanner && setoranMenunggu.length > 0 && React.createElement("div", { className: "alert-banner-item" },
          React.createElement("strong", null, setoranMenunggu.length, " setoran"), " menunggu konfirmasi.",
          React.createElement("div", { className: "mt8 row-wrap" },
            React.createElement("button", {
              type: "button", className: "btn-primary btn-sm",
              onClick: () => setTab && setTab("setoran")
            }, "Buka setoran"),
            React.createElement("button", {
              type: "button", className: "btn-secondary btn-sm",
              onClick: () => {
                try {
                  localStorage.setItem("donatboss_setoran_banner_hide_" + today(), "1");
                  localStorage.setItem("donatboss_setoran_nudge_" + today(), "1");
                } catch {}
                setHideSetoranBanner(true);
                pushNotif && pushNotif("Pengingat setoran menunggu disembunyikan untuk hari ini.", "success");
              }
            }, "Sembunyikan hari ini")
          )
        ),
        !hideSetoranBanner && setoranSelisih.length > 0 && React.createElement("div", { className: "alert-banner-item" },
          React.createElement("strong", null, setoranSelisih.length, " setoran"), " ada selisih kas belum selesai.",
          React.createElement("div", { className: "mt8 row-wrap" },
            React.createElement("button", {
              type: "button", className: "btn-primary btn-sm",
              onClick: () => setTab && setTab("setoran")
            }, "Cek selisih uang")
          )
        ),
        hasResepAlert && React.createElement("div", { className: "alert-banner-item" },
          React.createElement("strong", null, menusTanpaResepDash.length, " menu"),
          " belum punya resep bahan (produksi tidak potong stok gudang).",
          React.createElement("div", { className: "mt8 row-wrap" },
            React.createElement("button", {
              type: "button",
              className: "btn-primary btn-sm",
              onClick: () => {
                setHppFocus && setHppFocus("menu");
                setTab && setTab("setting");
                setStab && setStab("hpp");
              }
            }, "Isi resep sekarang (", menusTanpaResepDash.length, " menu)"),
            React.createElement("button", {
              type: "button",
              className: "btn-secondary btn-sm",
              onClick: () => {
                try {
                  const day = today();
                  localStorage.setItem("donatboss_resep_nudge_" + day, "1");
                  localStorage.setItem("donatboss_resep_banner_hide_" + day, "1");
                } catch {}
                setHideResepBanner(true);
                pushNotif && pushNotif("Pengingat resep disembunyikan untuk hari ini.", "success");
              }
            }, "Sembunyikan hari ini")
          )
        ),
        tutupBelum && React.createElement("div", { className: "alert-banner-item" },
          React.createElement("strong", null, "Tutup bulan belum dikunci"),
          tutupReminder.mode === "akhir"
            ? (" — bulan " + tutupReminder.targetBulan + " tinggal " + tutupReminder.daysLeft + " hari. Amankan angka sebelum bulan berganti.")
            : (" — bulan " + tutupReminder.targetBulan + " belum ditutup. Sebaiknya dikunci agar laporan investor/Excel final."),
          React.createElement("div", { className: "mt8 row-wrap" },
            React.createElement("button", {
              type: "button", className: "btn-primary btn-sm",
              onClick: () => setTab && setTab("tutupBuku")
            }, "Buka tutup bulan"),
            React.createElement("button", {
              type: "button", className: "btn-secondary btn-sm",
              onClick: () => {
                try { localStorage.setItem("donatboss_tutup_banner_hide_" + today(), "1"); } catch {}
                setHideTutupBanner(true);
                pushNotif && pushNotif("Pengingat tutup buku disembunyikan untuk hari ini.", "success");
              }
            }, "Sembunyikan hari ini")
          )
        )
      ),

      // Aksi cepat hari ini — biar Owner tidak "cari-cari menu"
      React.createElement("div", { className: "section-label-row" },
        React.createElement("div", { className: "section-title" }, "Menu cepat")
      ),
      React.createElement("div", { className: "quick-actions mb8" },
        React.createElement("button", {
          type: "button",
          className: "quick-action" + (setoranMenunggu.length || setoranSelisih.length ? " quick-action-hot" : ""),
          onClick: () => setTab && setTab("setoran")
        },
          React.createElement("span", { className: "quick-action-icon" }, "💰"),
          React.createElement("span", { className: "quick-action-label" }, "Setoran",
            (setoranMenunggu.length > 0) && React.createElement("span", { className: "quick-action-badge", style: { marginLeft: 8 } }, setoranMenunggu.length)
          ),
          React.createElement("span", { className: "quick-action-sub" },
            setoranMenunggu.length ? (setoranMenunggu.length + " menunggu konfirmasi") : "Cek & kunci setoran cabang"
          )
        ),
        React.createElement("button", {
          type: "button",
          className: "quick-action" + (gudangHabis.length || gudangMenipis.length ? " quick-action-hot" : " quick-action-accent"),
          onClick: () => { setTab && setTab("setting"); setStab && setStab("gudang"); }
        },
          React.createElement("span", { className: "quick-action-icon" }, "🏭"),
          React.createElement("span", { className: "quick-action-label" }, "Gudang",
            (gudangHabis.length > 0) && React.createElement("span", { className: "quick-action-badge", style: { marginLeft: 8 } }, gudangHabis.length)
          ),
          React.createElement("span", { className: "quick-action-sub" },
            gudangHabis.length ? "Ada bahan habis — restok dulu" : "Beli / restok bahan"
          )
        ),
        React.createElement("button", {
          type: "button",
          className: "quick-action",
          onClick: () => setTab && setTab("produksiCK")
        },
          React.createElement("span", { className: "quick-action-icon" }, "🍩"),
          React.createElement("span", { className: "quick-action-label" }, "Dapur & kirim"),
          React.createElement("span", { className: "quick-action-sub" }, "Catat produksi & kirim ke toko")
        ),
        React.createElement("button", {
          type: "button",
          className: "quick-action",
          onClick: () => setTab && setTab("pengeluaran")
        },
          React.createElement("span", { className: "quick-action-icon" }, "🧾"),
          React.createElement("span", { className: "quick-action-label" }, "Biaya"),
          React.createElement("span", { className: "quick-action-sub" }, "Catat biaya toko & biaya tetap")
        ),
        hasResepAlert && React.createElement("button", {
          type: "button",
          className: "quick-action quick-action-hot",
          onClick: () => {
            setHppFocus && setHppFocus("menu");
            setTab && setTab("setting");
            setStab && setStab("hpp");
          }
        },
          React.createElement("span", { className: "quick-action-icon" }, "📝"),
          React.createElement("span", { className: "quick-action-label" }, "Isi resep menu",
            React.createElement("span", { className: "quick-action-badge", style: { marginLeft: 8 } }, menusTanpaResepDash.length)
          ),
          React.createElement("span", { className: "quick-action-sub" },
            menusTanpaResepDash.length, " menu belum ber-resep — ketuk untuk isi"
          )
        )
      ),

      React.createElement("div", { className: "form-card mb8" },
        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 } },
          React.createElement("div", { style: { flex: "1 1 200px" } },
            React.createElement("div", { style: { fontWeight: 800, fontSize: 14 } }, "Kirim laporan"),
            React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginTop: 2 } },
              "Periode aktif: ", dr.from, " s/d ", dr.to, " · ",
              selBranch === "all" ? "Semua cabang" : selBranch === "__mandiri__" ? "Mandiri" : selBranch === "__investasi__" ? "Investasi" : (branchesNonCK.find((b) => b.id === selBranch)?.name || selBranch)
            )
          ),
          React.createElement("div", { className: "row-wrap" },
            React.createElement("button", {
              type: "button", className: "btn-secondary btn-sm",
              onClick: () => {
                const t = today();
                setDr({ from: t, to: t });
                pushNotif && pushNotif("Filter: hari ini (" + t + ")", "success");
              }
            }, "Hari ini"),
            React.createElement("button", {
              type: "button", className: "btn-secondary btn-sm",
              onClick: () => {
                // Senin–Minggu minggu berjalan (WIB date string)
                const t = today();
                const d = new Date(t + "T12:00:00");
                const day = d.getDay(); // 0 Minggu
                const diffToMon = day === 0 ? -6 : 1 - day;
                const mon = new Date(d); mon.setDate(d.getDate() + diffToMon);
                const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                const fmt = (x) => {
                  const y = x.getFullYear();
                  const m = String(x.getMonth() + 1).padStart(2, "0");
                  const dd = String(x.getDate()).padStart(2, "0");
                  return y + "-" + m + "-" + dd;
                };
                setDr({ from: fmt(mon), to: fmt(sun) });
                pushNotif && pushNotif("Filter: minggu ini (" + fmt(mon) + " s/d " + fmt(sun) + ")", "success");
              }
            }, "Minggu ini"),
            React.createElement("button", {
              type: "button", className: "btn-secondary btn-sm",
              onClick: () => {
                setDr({ from: startOfMonth(), to: today() });
                pushNotif && pushNotif("Filter: bulan berjalan s/d hari ini", "success");
              }
            }, "Bulan ini")
          )
        ),
        React.createElement("div", { className: "row-wrap mt8" },
          React.createElement("button", {
            type: "button",
            className: "btn-primary btn-sm",
            onClick: () => {
              if (typeof XLSX === "undefined") {
                pushNotif && pushNotif("Library Excel belum termuat (xlsx.full.min.js).", "warning");
                return;
              }
              try {
                const wb = XLSX.utils.book_new();
                const ring = [
                  ["Laporan Operasional — Donat Boss"],
                  ["Dari", dr.from],
                  ["Sampai", dr.to],
                  ["Cabang filter", selBranch],
                  ["Diekspor", nowTs()],
                  [],
                  ["Penjualan", omzet],
                  ["HPP distribusi", modal],
                  ["Biaya", peng],
                  ["Laba", laba],
                  ["Donat tidak terjual (pcs)", donatTidakTerjual],
                  ["Transaksi", hasil.txCount || fTxs.length],
                  []
                ];
                XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(ring)), "Ringkasan");
                const cab = [["Cabang", "Tipe", "Penjualan", "HPP", "Biaya", "Laba", "Tx"]];
                (hasil.branchStats || []).forEach((b) => {
                  cab.push([b.name, b.type || "", b.omzet || 0, b.modal || 0, b.peng || 0, b.laba || 0, b.txCount || 0]);
                });
                XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(cab)), "PerCabang");
                const txRows = [["Tanggal", "Cabang", "Total", "HPP", "Item"]];
                (fTxs || []).forEach((t) => {
                  const bname = (S.get("branches") || []).find((b) => b.id === t.branchId)?.name || t.branchId;
                  const items = (t.items || []).map((it) => it.nama + " x" + it.qty).join("; ");
                  txRows.push([t.date, bname, t.total || 0, t.totalHPP || 0, items]);
                });
                XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(txRows)), "Transaksi");
                const pengRows = [["Tanggal", "Sumber", "Cabang", "Keterangan", "Jumlah", "Kategori"]];
                (fPL || []).forEach((p) => {
                  const bname = (S.get("branches") || []).find((b) => b.id === p.branchId)?.name || p.branchId;
                  pengRows.push([p.date, "Lapak", bname, p.keterangan || "", p.jumlah || 0, ""]);
                });
                (fPO || []).forEach((p) => {
                  const bname = p.branchId ? ((S.get("branches") || []).find((b) => b.id === p.branchId)?.name || p.branchId) : "Global";
                  pengRows.push([p.date, "Owner", bname, p.keterangan || "", p.jumlah || 0, p.kategori || ""]);
                });
                XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(pengRows)), "Biaya");
                const setRows = [["Tanggal", "Cabang", "Penjualan", "Biaya", "Tunai", "Non-tunai", "Selisih", "Status", "Catatan"]];
                (S.get("setoranHarian") || []).filter((s) => s.date >= dr.from && s.date <= dr.to).forEach((s) => {
                  setRows.push([
                    s.date, s.branchName || s.branchId, s.omzet || 0, s.pengeluaran || 0,
                    s.tunaiFisik != null ? s.tunaiFisik : "", s.nonTunai != null ? s.nonTunai : "",
                    s.selisihKas != null ? s.selisihKas : "", s.status || "", s.catatanKas || ""
                  ]);
                });
                XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(setRows)), "Setoran");
                const alertRows = [
                  ["Snapshot perhatian"],
                  ["Gudang habis", gudangHabis.map((b) => b.nama).join(", ") || "-"],
                  ["Gudang menipis", gudangMenipis.map((b) => b.nama).join(", ") || "-"],
                  ["Menu tanpa resep", menusTanpaResepDash.map((m) => m.nama).join(", ") || "-"],
                  ["Setoran menunggu", setoranMenunggu.length],
                  ["Setoran selisih aktif", setoranSelisih.length]
                ];
                XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(alertRows)), "Perhatian");
                const fname = "laporan-" + dr.from + "_sd_" + dr.to + ".xlsx";
                XLSX.writeFile(wb, fname);
                pushNotif && pushNotif("Excel " + fname + " diunduh.", "success");
              } catch (e) {
                pushNotif && pushNotif("Gagal export: " + (e?.message || e), "warning");
              }
            }
          }, "Unduh Excel"),
          React.createElement("button", {
            type: "button",
            className: "btn-secondary btn-sm",
            onClick: async () => {
              const cabLabel = selBranch === "all" ? "Semua cabang" : selBranch === "__mandiri__" ? "Mandiri" : selBranch === "__investasi__" ? "Investasi" : (branchesNonCK.find((b) => b.id === selBranch)?.name || selBranch);
              const lines = [
                "EVORA DONUTS — Ringkasan",
                "Periode: " + dr.from + " s/d " + dr.to,
                "Cabang: " + cabLabel,
                "",
                "Penjualan: " + fmtRp(omzet),
                "HPP: " + fmtRp(modal),
                "Pengeluaran: " + fmtRp(peng),
                "Laba: " + fmtRp(laba),
                "Transaksi: " + (hasil.txCount || fTxs.length),
                "Donat tidak terjual: " + donatTidakTerjual + " pcs",
                "",
                "Perhatian:",
                "- Gudang habis: " + (gudangHabis.length ? gudangHabis.map((b) => b.nama).join(", ") : "-"),
                "- Menu tanpa resep: " + (menusTanpaResepDash.length ? menusTanpaResepDash.length + " menu" : "-"),
                "- Setoran menunggu: " + setoranMenunggu.length,
                "",
                "Diekspor: " + nowTs()
              ];
              const text = lines.join("\\n");
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(text);
                  pushNotif && pushNotif("Ringkasan disalin ke clipboard. Tinggal tempel di WA/Notes.", "success");
                } else {
                  // Fallback textarea
                  const ta = document.createElement("textarea");
                  ta.value = text;
                  ta.style.position = "fixed";
                  ta.style.left = "-9999px";
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand("copy");
                  document.body.removeChild(ta);
                  pushNotif && pushNotif("Ringkasan disalin ke clipboard.", "success");
                }
              } catch (e) {
                pushNotif && pushNotif("Gagal salin: " + (e?.message || e) + " — coba Download Excel.", "warning");
              }
            }
          }, "Salin ringkasan"),
          React.createElement("button", {
            type: "button",
            className: "btn-secondary btn-sm",
            onClick: () => {
              // Salin + buka panduan singkat (ikut filter cabang di dropdown)
              const cabLabel = selBranch === "all" ? "Semua cabang" : selBranch === "__mandiri__" ? "Semua mandiri" : selBranch === "__investasi__" ? "Semua investasi" : (branchesNonCK.find((b) => b.id === selBranch)?.name || selBranch);
              const short = "Evora Donuts " + dr.from + " s/d " + dr.to + " | " + cabLabel + " | Omzet " + fmtRp(omzet) + " | Laba " + fmtRp(laba) + " | Tx " + (hasil.txCount || fTxs.length);
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(short).then(() => {
                    pushNotif && pushNotif("Versi singkat disalin (siap tempel WA).", "success");
                  }).catch(() => pushNotif && pushNotif(short, "info"));
                } else {
                  pushNotif && pushNotif(short, "info");
                }
              } catch {
                pushNotif && pushNotif(short, "info");
              }
            }
          }, "Salin singkat (WA)"),
          React.createElement("button", {
            type: "button",
            className: "btn-secondary btn-sm",
            onClick: async () => {
              const stats = hasil.branchStats || [];
              if (!stats.length) {
                pushNotif && pushNotif("Tidak ada data cabang di periode ini.", "warning");
                return;
              }
              const cabFilterLabel = selBranch === "all" ? "Semua cabang" : selBranch === "__mandiri__" ? "Filter: mandiri" : selBranch === "__investasi__" ? "Filter: investasi" : ("Filter: " + (branchesNonCK.find((b) => b.id === selBranch)?.name || selBranch));
              const lines = [
                "EVORA DONUTS — Per cabang",
                "Periode: " + dr.from + " s/d " + dr.to,
                cabFilterLabel,
                ""
              ];
              stats.forEach((b) => {
                lines.push(
                  (b.name || b.id) +
                  " | Omzet " + fmtRp(b.omzet || 0) +
                  " | HPP " + fmtRp(b.modal || 0) +
                  " | Peng " + fmtRp(b.peng || 0) +
                  " | Laba " + fmtRp(b.laba || 0) +
                  " | Tx " + (b.txCount || 0)
                );
              });
              lines.push("");
              lines.push("TOTAL Omzet " + fmtRp(omzet) + " | Laba " + fmtRp(laba));
              lines.push("Diekspor: " + nowTs());
              const text = lines.join("\n");
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(text);
                  pushNotif && pushNotif("Ringkasan " + stats.length + " cabang disalin ke clipboard.", "success");
                } else {
                  const ta = document.createElement("textarea");
                  ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
                  document.body.appendChild(ta); ta.select(); document.execCommand("copy");
                  document.body.removeChild(ta);
                  pushNotif && pushNotif("Ringkasan per cabang disalin.", "success");
                }
              } catch (e) {
                pushNotif && pushNotif("Gagal salin: " + (e?.message || e), "warning");
              }
            }
          }, "Salin per cabang")
        )
      ),

      // ── Status operasional (Hari ini / Kemarin) ──
      (() => {
        const shiftDate = (iso, delta) => {
          const d = new Date(iso + "T12:00:00");
          d.setDate(d.getDate() + delta);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return y + "-" + m + "-" + dd;
        };
        const t = statusDay === "yesterday" ? shiftDate(today(), -1) : today();
        const dayLabel = statusDay === "yesterday" ? "Kemarin (" + t + ")" : "Hari ini (" + t + ")";
        const branchesAll = S.get("branches") || [];
        const branchesNonCkList = branchesAll.filter((b) => b.type !== "central_kitchen");
        const absensiDay = (S.get("absensi") || []).filter((a) => a.date === t && a.checkin_ts);
        const workers = (S.get("profiles") || []).filter((p) => isActiveProfile(p) && p.role === "worker");
        const checkedInIds = new Set(absensiDay.map((a) => a.user_id));
        const stillOpen = absensiDay.filter((a) => a.checkin_ts && !a.checkout_ts);
        const notIn = workers.filter((w) => !checkedInIds.has(w.user_id));
        const setoranDay = (S.get("setoranHarian") || []).filter((s) => s.date === t);
        const setoranPendingDay = setoranDay.filter((s) => s.status === "menunggu");
        const setoranDoneDay = setoranDay.filter((s) => s.status === "selesai");
        const setoranSelisihDay = setoranDay.filter((s) => s.selisihKas != null && Math.abs(Number(s.selisihKas)) >= 1);
        const txDay = (S.get("transactions") || []).filter((x) => x.date === t);
        const omzetDay = txDay.reduce((a, x) => a + (x.total || 0), 0);
        const branchesWithAbsensi = [...new Set(absensiDay.map((a) => a.branchId).filter(Boolean))];
        const branchesWithTx = [...new Set(txDay.map((x) => x.branchId).filter(Boolean))];
        const branchesWithSetoran = new Set(setoranDay.map((s) => s.branchId).filter(Boolean));
        const hidupIds = [...new Set([...branchesWithAbsensi, ...branchesWithTx])];
        const cabangBelumSetor = hidupIds.filter((id) => !branchesWithSetoran.has(id)).map((id) => {
          const b = branchesAll.find((x) => x.id === id);
          const omzetCab = txDay.filter((x) => x.branchId === id).reduce((a, x) => a + (x.total || 0), 0);
          return { id, name: b?.name || id, omzet: omzetCab };
        });

        // Kartu per cabang non-CK
        const perCabangStatus = branchesNonCkList.map((b) => {
          const absB = absensiDay.filter((a) => a.branchId === b.id);
          const ci = absB.length;
          const coOpen = absB.filter((a) => !a.checkout_ts).length;
          const txB = txDay.filter((x) => x.branchId === b.id);
          const omzetB = txB.reduce((a, x) => a + (x.total || 0), 0);
          const setB = setoranDay.filter((s) => s.branchId === b.id);
          const setPending = setB.some((s) => s.status === "menunggu");
          const setDone = setB.some((s) => s.status === "selesai");
          const setSelisih = setB.some((s) => s.selisihKas != null && Math.abs(Number(s.selisihKas)) >= 1);
          const hidup = ci > 0 || txB.length > 0;
          let badge = "libur/off";
          let tone = "muted";
          if (setDone && !setPending) { badge = setSelisih ? "setor ✓ (selisih)" : "setor ✓"; tone = setSelisih ? "warn" : "ok"; }
          else if (setPending) { badge = "setor menunggu"; tone = "hot"; }
          else if (hidup) { badge = "belum setor"; tone = "hot"; }
          else if (ci > 0) { badge = "check-in"; tone = "warn"; }
          return {
            id: b.id, name: b.name, type: b.type, ci, coOpen, omzet: omzetB, tx: txB.length,
            badge, tone, setPending, setDone, setSelisih, hidup
          };
        }).sort((a, b) => {
          const rank = { hot: 0, warn: 1, ok: 2, muted: 3 };
          return (rank[a.tone] - rank[b.tone]) || (b.omzet - a.omzet);
        });

        const isuCount = setoranPendingDay.length + stillOpen.length + gudangHabis.length + menusTanpaResepDash.length + setoranSelisihDay.length + cabangBelumSetor.length;
        const statusOk = isuCount === 0;

        const buildLines = (mode) => {
          if (mode === "short") {
            return [
              "Evora Donuts " + dayLabel,
              "Omzet " + fmtRp(omzetDay) + " | Tx " + txDay.length,
              "CI " + absensiDay.length + "/" + workers.length + " · belum CO " + stillOpen.length,
              "Setor tunggu " + setoranPendingDay.length + " · belum setor " + cabangBelumSetor.length + " cabang",
              "Gudang habis " + gudangHabis.length + " · tanpa resep " + menusTanpaResepDash.length,
              statusOk ? "Status: AMAN" : ("Status: " + isuCount + " isu")
            ].join("\\n");
          }
          const lines = [
            "STATUS OPERASIONAL — Donat Boss",
            dayLabel,
            "Jam cek: " + nowTs(),
            "",
            "Penjualan: " + fmtRp(omzetDay) + " (" + txDay.length + " transaksi)",
            "Pekerja check-in: " + absensiDay.length + " / " + workers.length,
            "Belum check-out: " + stillOpen.length,
            "Belum check-in: " + notIn.length,
            "Setoran: " + setoranDoneDay.length + " selesai, " + setoranPendingDay.length + " menunggu",
            "Setoran ada selisih: " + setoranSelisihDay.length,
            "Cabang hidup belum setor: " + cabangBelumSetor.length,
            "Gudang habis/minus: " + (gudangHabis.length ? gudangHabis.map((b) => b.nama).join(", ") : "-"),
            "Gudang menipis: " + (gudangMenipis.length ? gudangMenipis.map((b) => b.nama).join(", ") : "-"),
            "Menu tanpa resep: " + (menusTanpaResepDash.length ? menusTanpaResepDash.length + " (" + menusTanpaResepDash.map((m) => m.nama).join(", ") + ")" : "-"),
            "",
            "Per cabang:"
          ];
          perCabangStatus.forEach((b) => {
            lines.push("- " + b.name + " | " + b.badge + " | omzet " + fmtRp(b.omzet) + " | CI " + b.ci + (b.coOpen ? " | belum CO " + b.coOpen : ""));
          });
          lines.push("");
          if (cabangBelumSetor.length) {
            lines.push("Belum setor: " + cabangBelumSetor.map((b) => b.name).join(", "));
          }
          if (setoranPendingDay.length) {
            lines.push("Menunggu konfirmasi: " + setoranPendingDay.map((s) => s.branchName || s.branchId).join(", "));
          }
          if (stillOpen.length) {
            lines.push("Belum check-out:");
            stillOpen.forEach((a) => {
              const w = workers.find((p) => p.user_id === a.user_id);
              const bname = branchesAll.find((b) => b.id === a.branchId)?.name || a.branchId;
              lines.push("  · " + (w?.display_name || w?.displayName || w?.email || a.user_id?.slice(0, 8)) + " @ " + bname);
            });
          }
          lines.push("");
          lines.push(statusOk ? "Kesimpulan: terlihat aman." : ("Kesimpulan: " + isuCount + " poin perlu dicek."));
          return lines.join("\\n");
        };

        const copyStatus = async (mode) => {
          const text = buildLines(mode);
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(text);
              pushNotif && pushNotif(mode === "short" ? "Status singkat disalin." : "Status operasional disalin.", "success");
            } else {
              const ta = document.createElement("textarea");
              ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
              document.body.appendChild(ta); ta.select(); document.execCommand("copy");
              document.body.removeChild(ta);
              pushNotif && pushNotif("Status disalin.", "success");
            }
          } catch (e) {
            pushNotif && pushNotif("Gagal salin: " + (e?.message || e), "warning");
          }
        };

        const refreshStatus = () => {
          Promise.all([
            S.loadKey("absensi").catch(() => {}),
            S.loadKey("setoranHarian").catch(() => {}),
            S.loadKey("transactions").catch(() => {}),
            loadStokBahanFromDb().catch(() => {})
          ]).then(() => pushNotif && pushNotif("Status diperbarui.", "success"));
        };

        const toneBorder = (tone) => {
          if (tone === "ok") return "color-mix(in srgb, var(--green) 40%, var(--border))";
          if (tone === "hot") return "color-mix(in srgb, var(--red) 45%, var(--border))";
          if (tone === "warn") return "color-mix(in srgb, var(--yellow) 45%, var(--border))";
          return "var(--border)";
        };
        const toneBg = (tone) => {
          if (tone === "ok") return "color-mix(in srgb, var(--green) 8%, var(--bg2))";
          if (tone === "hot") return "color-mix(in srgb, var(--red) 8%, var(--bg2))";
          if (tone === "warn") return "color-mix(in srgb, var(--yellow) 8%, var(--bg2))";
          return "var(--bg2)";
        };

        return React.createElement("div", {
          className: "form-card mb8",
          style: statusOk
            ? { borderColor: "color-mix(in srgb, var(--green) 35%, var(--border))" }
            : { borderColor: "color-mix(in srgb, var(--yellow) 40%, var(--border))" }
        },
          React.createElement("div", { style: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, alignItems: "flex-start" } },
            React.createElement("div", null,
              React.createElement("div", { style: { fontWeight: 800, fontSize: 14 } }, "Cek cabang hari ini"),
              React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginTop: 2 } },
                dayLabel, " · ", statusOk ? "terlihat aman" : (isuCount + " isu")
              )
            ),
            React.createElement("div", { className: "row-wrap" },
              React.createElement("button", {
                type: "button",
                className: "chip" + (statusDay === "today" ? " chip-active" : ""),
                onClick: () => setStatusDay("today")
              }, "Hari ini"),
              React.createElement("button", {
                type: "button",
                className: "chip" + (statusDay === "yesterday" ? " chip-active" : ""),
                onClick: () => setStatusDay("yesterday")
              }, "Kemarin"),
              React.createElement("button", { type: "button", className: "btn-secondary btn-sm", onClick: refreshStatus }, "Muat ulang"),
              React.createElement("button", { type: "button", className: "btn-primary btn-sm", onClick: () => copyStatus("full") }, "Salin status"),
              React.createElement("button", { type: "button", className: "btn-secondary btn-sm", onClick: () => copyStatus("short") }, "Salin singkat"),
              (setoranPendingDay.length > 0 || cabangBelumSetor.length > 0) && React.createElement("button", {
                type: "button", className: "btn-secondary btn-sm",
                onClick: () => setTab && setTab("setoran")
              }, "Ke setoran"),
              gudangHabis.length > 0 && React.createElement("button", {
                type: "button", className: "btn-secondary btn-sm",
                onClick: () => { setTab && setTab("setting"); setStab && setStab("gudang"); }
              }, "Ke gudang")
            )
          ),
          React.createElement("div", { className: "kpi-grid mt8" },
            React.createElement("div", { className: "kpi-card kpi-omzet" },
              React.createElement("div", { className: "kpi-label" }, "Penjualan"),
              React.createElement("div", { className: "kpi-val" }, fmtRp(omzetDay))
            ),
            React.createElement("div", { className: "kpi-card" },
              React.createElement("div", { className: "kpi-label" }, "Check-in"),
              React.createElement("div", { className: "kpi-val" }, absensiDay.length, React.createElement("span", { style: { fontSize: 13, color: "var(--text2)" } }, " / ", workers.length))
            ),
            React.createElement("div", { className: "kpi-card " + (stillOpen.length ? "kpi-peng" : "kpi-profit") },
              React.createElement("div", { className: "kpi-label" }, "Belum check-out"),
              React.createElement("div", { className: "kpi-val" }, stillOpen.length)
            ),
            React.createElement("div", { className: "kpi-card " + ((setoranPendingDay.length || cabangBelumSetor.length) ? "kpi-peng" : "kpi-profit") },
              React.createElement("div", { className: "kpi-label" }, "Belum / tunggu setor"),
              React.createElement("div", { className: "kpi-val" }, setoranPendingDay.length + cabangBelumSetor.length)
            )
          ),
          React.createElement("div", { className: "section-title mt12" }, "Status tiap cabang"),
          perCabangStatus.length === 0 && React.createElement("p", { className: "info-txt" }, "Belum ada cabang non-CK."),
          React.createElement("div", { className: "branch-status-grid mt8" },
            perCabangStatus.map((b) =>
              React.createElement("button", {
                key: b.id,
                type: "button",
                className: "branch-status-card",
                style: { borderColor: toneBorder(b.tone), background: toneBg(b.tone) },
                onClick: () => {
                  if (b.setPending || b.badge === "belum setor") setTab && setTab("setoran");
                  else setTab && setTab("kasir");
                }
              },
                React.createElement("div", { className: "branch-status-name" }, b.name),
                React.createElement("div", { className: "branch-status-badge tone-" + b.tone }, b.badge),
                React.createElement("div", { className: "branch-status-meta" },
                  "Omzet ", fmtRp(b.omzet), " · CI ", b.ci, b.coOpen ? (" · CO open " + b.coOpen) : ""
                )
              )
            )
          ),
          (setoranPendingDay.length > 0 || stillOpen.length > 0 || gudangHabis.length > 0 || menusTanpaResepDash.length > 0 || cabangBelumSetor.length > 0) && React.createElement("div", { className: "info-txt mt8", style: { whiteSpace: "pre-line", fontSize: 12 } },
            [
              cabangBelumSetor.length ? ("• Cabang belum setor: " + cabangBelumSetor.map((b) => b.name).join(", ")) : null,
              setoranPendingDay.length ? ("• Setoran menunggu: " + setoranPendingDay.map((s) => s.branchName || s.branchId).join(", ")) : null,
              stillOpen.length ? ("• Belum check-out: " + stillOpen.length + " pekerja") : null,
              gudangHabis.length ? ("• Gudang habis: " + gudangHabis.map((b) => b.nama).join(", ")) : null,
              menusTanpaResepDash.length ? ("• Menu tanpa resep: " + menusTanpaResepDash.length) : null
            ].filter(Boolean).join("\\n")
          )
        );
      })(),

      showSetupWizard && React.createElement("div", { className: "setup-wizard mb8" },
        React.createElement("div", { className: "setup-wizard-header" },
          React.createElement("div", null,
            React.createElement("div", { className: "setup-wizard-title" }, "Persiapan toko — ", setupDone, "/", setupTotal, " selesai"),
            React.createElement("div", { className: "setup-wizard-sub" },
              "Data yang sudah diinput tetap aman. Selesaikan langkah yang belum — bisa dilanjut kapan saja tanpa mengulang dari nol."
            )
          ),
          React.createElement("button", {
            type: "button", className: "btn-secondary btn-sm",
            onClick: () => {
              try { localStorage.setItem("donatboss_hide_setup_wizard", "1"); } catch {}
              setHideSetup(true);
            }
          }, "Sembunyikan")
        ),
        React.createElement("div", { className: "setup-wizard-progress" },
          React.createElement("div", {
            className: "setup-wizard-progress-bar",
            style: { width: (setupTotal ? Math.round((setupDone / setupTotal) * 100) : 0) + "%" }
          })
        ),
        React.createElement("div", { className: "setup-wizard-steps" },
          setupSteps.map((s, i) =>
            React.createElement("button", {
              key: s.key, type: "button",
              className: "setup-step" + (s.done ? " setup-step-done" : ""),
              onClick: s.go
            },
              React.createElement("span", { className: "setup-step-check" }, s.done ? "✅" : String(i + 1)),
              React.createElement("span", { className: "setup-step-body" },
                React.createElement("span", { className: "setup-step-label" }, s.label),
                React.createElement("span", { className: "setup-step-hint" }, s.done ? "Selesai" : s.hint)
              ),
              React.createElement("span", { className: "setup-step-go" }, s.done ? "" : "Buka →")
            )
          )
        )
      ),

      !showSetupWizard && !setupComplete && React.createElement("button", {
        type: "button", className: "btn-secondary btn-sm mb8",
        onClick: () => {
          try { localStorage.removeItem("donatboss_hide_setup_wizard"); } catch {}
          setHideSetup(false);
        }
      }, "Tampilkan panduan setup (", setupDone, "/", setupTotal, ")"),

      hideResepBanner && menusTanpaResepDash.length > 0 && React.createElement("button", {
        type: "button", className: "btn-secondary btn-sm mb8",
        onClick: () => {
          try { localStorage.removeItem("donatboss_resep_banner_hide_" + today()); } catch {}
          setHideResepBanner(false);
        }
      }, "Tampilkan lagi pengingat resep (", menusTanpaResepDash.length, " menu)"),

      hideStokBanner && (gudangHabis.length > 0 || gudangMenipis.length > 0) && React.createElement("button", {
        type: "button", className: "btn-secondary btn-sm mb8",
        onClick: () => {
          try { localStorage.removeItem("donatboss_stok_banner_hide_" + today()); } catch {}
          setHideStokBanner(false);
        }
      }, "Tampilkan lagi pengingat stok gudang"),

      hideTutupBanner && tutupReminder.targetBulan && !tutupBukuStatus.prevClosed && React.createElement("button", {
        type: "button", className: "btn-secondary btn-sm mb8",
        onClick: () => {
          try { localStorage.removeItem("donatboss_tutup_banner_hide_" + today()); } catch {}
          setHideTutupBanner(false);
        }
      }, "Tampilkan lagi pengingat tutup buku"),

      hideSetoranBanner && (setoranMenunggu.length > 0 || setoranSelisih.length > 0) && React.createElement("button", {
        type: "button", className: "btn-secondary btn-sm mb8",
        onClick: () => {
          try { localStorage.removeItem("donatboss_setoran_banner_hide_" + today()); } catch {}
          setHideSetoranBanner(false);
        }
      }, "Tampilkan lagi pengingat setoran (", setoranMenunggu.length + setoranSelisih.length, ")"),

      (hideResepBanner || hideStokBanner || hideSetoranBanner || hideTutupBanner) && React.createElement("button", {
        type: "button", className: "btn-secondary btn-sm mb8",
        onClick: () => {
          const day = today();
          try {
            localStorage.removeItem("donatboss_resep_banner_hide_" + day);
            localStorage.removeItem("donatboss_stok_banner_hide_" + day);
            localStorage.removeItem("donatboss_setoran_banner_hide_" + day);
            localStorage.removeItem("donatboss_tutup_banner_hide_" + day);
          } catch {}
          setHideResepBanner(false);
          setHideStokBanner(false);
          setHideSetoranBanner(false);
          setHideTutupBanner(false);
          pushNotif && pushNotif("Semua pengingat ditampilkan lagi.", "success");
        }
      }, "Tampilkan semua pengingat lagi"),

      setupComplete && React.createElement("div", { className: "alert-banner alert-banner-ok mb8" },
        React.createElement("div", { className: "alert-banner-title" }, "Persiapan dasar lengkap"),
        React.createElement("div", { className: "alert-banner-item" }, "Cabang, bahan, resep, stok gudang, dan pekerja sudah siap. Lanjut operasional dari aksi cepat di atas.")
      ),

      React.createElement("div", { className: "section-label-row" },
        React.createElement("div", { className: "section-title" }, "Angka periode ini")
      ),
      React.createElement("div", { className: "kpi-grid" },
        React.createElement("div", { className: "kpi-card kpi-omzet kpi-clickable", onClick: () => setKpiDetail(kpiBreakdowns.omzet) }, React.createElement("div", { className: "kpi-label" }, "Penjualan"), React.createElement("div", { className: "kpi-val" }, fmtRp(omzet))),
        React.createElement("div", { className: "kpi-card kpi-modal kpi-clickable", onClick: () => setKpiDetail(kpiBreakdowns.modal) }, React.createElement("div", { className: "kpi-label" }, "Modal bahan"), React.createElement("div", { className: "kpi-val" }, fmtRp(modal))),
        React.createElement("div", { className: "kpi-card kpi-clickable", style: { background: "color-mix(in srgb, var(--yellow) 10%, var(--bg2))", borderColor: "color-mix(in srgb, var(--yellow) 30%, var(--border))" }, onClick: () => setKpiDetail(kpiBreakdowns.donatTidakTerjual) }, React.createElement("div", { className: "kpi-label" }, "Donat dibuang (rugi)"), React.createElement("div", { className: "kpi-val", style: { color: "var(--yellow)" } }, donatTidakTerjual, " pcs")),
        React.createElement("div", { className: "kpi-card kpi-peng kpi-clickable", onClick: () => setKpiDetail(kpiBreakdowns.peng) }, React.createElement("div", { className: "kpi-label" }, "Biaya"), React.createElement("div", { className: "kpi-val" }, fmtRp(peng))),
        React.createElement("div", { className: "kpi-card kpi-profit kpi-clickable", onClick: () => setKpiDetail(kpiBreakdowns.laba) }, React.createElement("div", { className: "kpi-label" }, "Laba Bersih"), React.createElement("div", { className: "kpi-val", style: { color: laba >= 0 ? "var(--green)" : "var(--red)" } }, fmtRp(laba))),
        React.createElement("div", { className: "kpi-card kpi-tx kpi-clickable", onClick: () => setKpiDetail(kpiBreakdowns.tx) }, React.createElement("div", { className: "kpi-label" }, "Transaksi"), React.createElement("div", { className: "kpi-val" }, fTxs.length, "x")),
        React.createElement("div", { className: "kpi-card kpi-clickable", style: { background: "color-mix(in srgb, var(--green) 10%, var(--bg2))", borderColor: "color-mix(in srgb, var(--green) 30%, var(--border))" }, onClick: () => setKpiDetail(kpiBreakdowns.dana) }, React.createElement("div", { className: "kpi-label" }, "Saldo Dana Cadangan"), React.createElement("div", { className: "kpi-val", style: { color: "var(--green)" } }, fmtRp(saldoDanaPemeliharaan))),
        React.createElement("div", { className: "kpi-card kpi-cab kpi-clickable", onClick: () => setKpiDetail(kpiBreakdowns.cabang) }, React.createElement("div", { className: "kpi-label" }, "Cabang"), React.createElement("div", { className: "kpi-val" }, branches.filter((b) => b.type !== "central_kitchen").length))
      ),
      React.createElement("div", { className: "two-col mt12" },
        React.createElement("div", { className: "chart-box" },
          React.createElement("h3", { className: "section-title" }, "Omzet vs Pengeluaran - 7 Hari"),
          React.createElement(BarChart, { data: chart7, height: 100 }),
          React.createElement("div", { className: "chart-legend mt8" }, React.createElement("span", { className: "leg-dot leg-a" }), React.createElement("span", null, "Penjualan"), React.createElement("span", { className: "leg-dot leg-b", style: { marginLeft: 12 } }), React.createElement("span", null, "HPP+Peng"))
        ),
        React.createElement("div", { className: "chart-box" },
          React.createElement("h3", { className: "section-title" }, "Omzet Per Cabang"),
          React.createElement(BarChart, { data: branchChart, height: 100 }),
          React.createElement("div", { className: "chart-legend mt8" }, React.createElement("span", { className: "leg-dot leg-a" }), React.createElement("span", null, "Penjualan"), React.createElement("span", { className: "leg-dot leg-b", style: { marginLeft: 12 } }), React.createElement("span", null, "Laba"))
        )
      ),
      React.createElement("div", { className: "two-col mt12" },
        React.createElement("div", null,
          React.createElement("h3", { className: "section-title" }, "Performa Cabang"),
          branchStats.map((b) => {
            const isOpen = expandedBranch === b.id;
            return React.createElement("div", { key: b.id, className: "branch-stat-card" + (isOpen ? " expanded" : "") },
              React.createElement("div", { className: "branch-stat-name", onClick: () => setExpandedBranch(isOpen ? null : b.id) },
                React.createElement("span", null,
                  b.name, " ",
                  React.createElement("span", { className: "badge-type " + b.type }, b.type)
                ),
                React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 10 } },
                  React.createElement("strong", { style: { color: "var(--accent)" } }, fmtRp(b.omzet)),
                  React.createElement("span", { className: "branch-stat-arrow" }, "\u25BC")
                )
              ),
              b.workers?.length > 0 && React.createElement("div", { className: "branch-workers" }, b.workers.map((w) => w.display_name || w.displayName || w.email || "-").join(", ")),
              React.createElement("div", { className: "branch-stat-body" },
                React.createElement("div", { className: "branch-stat-row" }, React.createElement("span", null, "Penjualan"), React.createElement("strong", null, fmtRp(b.omzet))),
                React.createElement("div", { className: "branch-stat-row" }, React.createElement("span", null, "HPP"), React.createElement("strong", null, fmtRp(b.modal))),
                React.createElement("div", { className: "branch-stat-row" }, React.createElement("span", { style: { color: "var(--yellow)" } }, "HPP Tidak Laku"), React.createElement("strong", { style: { color: "var(--yellow)" } }, fmtRp(b.hppTidakLaku))),
                React.createElement("div", { className: "branch-stat-row" }, React.createElement("span", null, "Terjual"), React.createElement("strong", null, b.boxTerjual, " box, ", b.pcsTerjual, " pcs satuan")),
                React.createElement("div", { className: "branch-stat-row" }, React.createElement("span", null, "Biaya"), React.createElement("strong", { style: { color: "var(--red)" } }, fmtRp(b.peng))),
                React.createElement("div", { className: "branch-stat-row" }, React.createElement("span", null, "Laba"), React.createElement("strong", { style: { color: "var(--green)" } }, fmtRp(b.laba))),
                React.createElement("div", { className: "branch-stat-row" }, React.createElement("span", null, "Transaksi"), React.createElement("strong", null, b.txCount, "x"))
              )
            );
          })
        ),
        React.createElement("div", null,
          React.createElement("h3", { className: "section-title" }, "Best Seller"),
          bs.length === 0 && React.createElement(EmptyState, { icon: "📭", title: "Belum ada data", desc: "Data untuk tampilan ini masih kosong." }),
          bs.map(([nama, qty], i) =>
            React.createElement("div", { key: i, className: "bestseller-row" },
              React.createElement("span", { className: "bs-rank" }, "#", i + 1),
              React.createElement("span", { className: "bs-nama" }, nama),
              React.createElement("span", { className: "bs-qty" }, qty, " pcs")
            )
          )
        )
      ),
      kpiDetail && React.createElement(KPIDetailModal, { data: kpiDetail, onClose: () => setKpiDetail(null) })
    );
  }

  // ─── KPIDetailModal — breakdown saat KPI card di Dashboard diklik ──────────
  function KPIDetailModal({ data, onClose }) {
    const fmt = (v, row) => {
      if (row?.isText) return v;
      if (row?.isCount || data.isCount) return v + "x";
      return (v < 0 ? "-" : "") + fmtRp(Math.abs(v));
    };
    return React.createElement("div", { className: "modal-backdrop", onClick: onClose },
      React.createElement("div", { className: "modal-box modal-box-sm", onClick: (e) => e.stopPropagation() },
        React.createElement("div", { className: "modal-header" },
          data.title,
          React.createElement("button", { className: "btn-icon", "aria-label": "Tutup", onClick: onClose }, "\u2715")
        ),
        React.createElement("div", { className: "modal-body" },
          React.createElement("div", { className: "kpi-detail-total" },
            React.createElement("div", { className: "kpi-label" }, data.totalLabel),
            React.createElement("div", { className: "kpi-val", style: { fontSize: 24 } }, fmt(data.total))
          ),
          data.note && React.createElement("p", { className: "info-txt" }, data.note),
          data.rows && data.rows.length > 0 && React.createElement("div", { className: "kpi-detail-rows" },
            data.rows.map((r, i) => React.createElement("div", { key: i, className: "kpi-detail-row" },
              React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 13, fontWeight: 600 } }, r.label),
                r.sub && React.createElement("div", { style: { fontSize: 11, color: "var(--text2)" } }, r.sub)
              ),
              React.createElement("strong", { style: { color: r.isText ? "var(--text2)" : (r.value < 0 ? "var(--red)" : "var(--text)") } }, fmt(r.value, r))
            ))
          ),
          (!data.rows || data.rows.length === 0) && React.createElement(EmptyState, { icon: "📊", title: "Belum ada data periode ini", desc: "Ubah rentang tanggal atau pastikan sudah ada transaksi." })
        )
      )
    );
  }

  // ─── REVISI #4: PengeluaranOwner — Filter Cabang ───────────────────────────
  // ─── PengeluaranOwner — Harian + Rekap Bulanan/Tahunan + Biaya tetap ─────
  // REVISI 2026-07:
  // 1) Input harian (seperti sebelumnya)
  // 2) Rekap pengeluaran owner+lapak per BULAN / TAHUN
  // 3) Template biaya rutin (sewa, listrik, dll) disimpan di app_settings,
  //    bisa digenerate jadi pengeluaranOwner untuk bulan terpilih (anti-dobel)
  function PengeluaranOwner({ pushNotif }) {
    const tick = useStoreTick();
    const [view, setView] = useState("harian"); // harian | bulanan | tahunan | rutin
    const [date, setDate] = useState(today());
    const [bulan, setBulan] = useState(today().slice(0, 7));
    const [tahun, setTahun] = useState(today().slice(0, 4));
    const getList = () => S.get("pengeluaranOwner") || [];
    const [list, setList] = useState(getList);
    const [selBranch, setSelBranch] = useState("");
    const [form, setForm] = useState({ keterangan: "", jumlah: "", kategori: "operasional" });
    const [rutin, setRutin] = useState([]); // templates
    const [rutinForm, setRutinForm] = useState({ nama: "", jumlah: "", kategori: "sewa", branchId: "", frekuensi: "bulanan", aktif: true });
    const [busyRutin, setBusyRutin] = useState(false);
    const [confirmAsk, confirmModal] = useConfirm();
    const refresh = () => setList(getList());
    const branchesData = S.get("branches") || [];

    const KATEGORI = [
      { value: "gaji_pekerja", label: "Gaji Pekerja Lapak" },
      { value: "gaji_kitchen", label: "Gaji Central Kitchen" },
      { value: "bahan_baku", label: "Bahan Baku" },
      { value: "operasional", label: "Operasional" },
      { value: "sewa", label: "Sewa Tempat" },
      { value: "lainnya", label: "Lainnya" },
      { value: "selisih_kas", label: "Selisih Kas" }
    ];
    const CHIPS = {
      gaji_pekerja: ["Gaji Kasir Pagi", "Gaji Kasir Siang", "Bonus Pekerja"],
      gaji_kitchen: ["Gaji Chef", "Gaji Helper", "Lembur Kitchen"],
      bahan_baku: ["Restok Tepung", "Restok Kentang", "Restok Minyak", "Restok Gas"],
      operasional: ["Listrik", "Air", "Internet"],
      sewa: ["Sewa Lapak", "Sewa Dapur"],
      lainnya: ["Lain-lain"]
    };
    const katLabel = (k) => KATEGORI.find((x) => x.value === k)?.label || k || "—";

    // ── Load template biaya rutin dari app_settings ──
    useEffect(() => {
      let dead = false;
      (async () => {
        try {
          const { data, error } = await sb.from("app_settings").select("value").eq("key", "biaya_rutin").maybeSingle();
          if (error) throw error;
          if (!dead) setRutin(Array.isArray(data?.value) ? data.value : []);
        } catch {
          if (!dead) setRutin([]);
        }
      })();
      return () => { dead = true; };
    }, [tick]);

    const saveRutinTemplates = async (next) => {
      setBusyRutin(true);
      try {
        const { error } = await sb.from("app_settings").upsert({ key: "biaya_rutin", value: next });
        if (error) throw error;
        setRutin(next);
        pushNotif("Template biaya rutin disimpan.", "success");
      } catch (e) {
        pushNotif(e?.message || String(e), "warning");
      } finally {
        setBusyRutin(false);
      }
    };

    const tambahRutinTemplate = async () => {
      const jml = parseFloat(rutinForm.jumlah);
      if (!rutinForm.nama || !jml || jml <= 0) {
        pushNotif("Isi nama & jumlah template rutin yang valid.", "warning");
        return;
      }
      const row = {
        id: uid(),
        nama: String(rutinForm.nama).trim(),
        jumlah: jml,
        kategori: rutinForm.kategori || "sewa",
        branchId: rutinForm.branchId || null,
        frekuensi: rutinForm.frekuensi === "tahunan" ? "tahunan" : "bulanan",
        aktif: true,
        createdAt: nowIso()
      };
      await saveRutinTemplates([...(rutin || []), row]);
      setRutinForm({ nama: "", jumlah: "", kategori: "sewa", branchId: "", frekuensi: "bulanan", aktif: true });
    };

    const hapusRutinTemplate = (id) => {
      confirmAsk({
        title: "Hapus Template",
        message: "Hapus template biaya rutin ini? Pengeluaran yang sudah digenerate tidak ikut terhapus.",
        onConfirm: () => saveRutinTemplates((rutin || []).filter((r) => r.id !== id))
      });
    };

    const toggleRutinAktif = (id) => {
      saveRutinTemplates((rutin || []).map((r) => r.id === id ? { ...r, aktif: !r.aktif } : r));
    };

    // Generate template → baris pengeluaranOwner (tanggal = hari-1 bulan / 01-01 tahun)
    const generateRutinKePeriode = async (mode) => {
      // mode: "bulanan" | "tahunan"
      const aktifList = (rutin || []).filter((r) => r.aktif && (mode === "tahunan" ? r.frekuensi === "tahunan" : r.frekuensi === "bulanan"));
      if (!aktifList.length) {
        pushNotif("Tidak ada template rutin aktif untuk frekuensi ini.", "warning");
        return;
      }
      const targetDate = mode === "tahunan" ? (tahun + "-01-01") : (bulan + "-01");
      const existing = S.get("pengeluaranOwner") || [];
      const toInsert = [];
      let skipped = 0;
      aktifList.forEach((tpl) => {
        const already = existing.find((p) => p.rutinTemplateId === tpl.id && p.date === targetDate);
        if (already) { skipped++; return; }
        const bName = tpl.branchId
          ? (branchesData.find((b) => b.id === tpl.branchId)?.name || tpl.branchId)
          : "Pusat (Global)";
        toInsert.push({
          id: uid(),
          date: targetDate,
          ts: tsForDate(targetDate),
          keterangan: (mode === "tahunan" ? "[Rutin Tahunan] " : "[Rutin Bulanan] ") + tpl.nama,
          jumlah: Number(tpl.jumlah) || 0,
          kategori: tpl.kategori || "lainnya",
          branchId: tpl.branchId || null,
          branchName: bName,
          rutinTemplateId: tpl.id,
          rutinFrekuensi: tpl.frekuensi,
          generatedAt: nowIso()
        });
      });
      if (!toInsert.length) {
        pushNotif(skipped ? `Semua template sudah digenerate untuk ${targetDate} (${skipped} dilewati).` : "Tidak ada yang digenerate.", "warning");
        return;
      }
      confirmAsk({
        title: "Generate Biaya tetap",
        message: `Catat ${toInsert.length} pengeluaran rutin ke tanggal ${formatTanggalIndo(targetDate)}?${skipped ? ` (${skipped} template dilewati karena sudah ada)` : ""}`,
        confirmLabel: "Generate",
        onConfirm: () => {
          S.set("pengeluaranOwner", [...existing, ...toInsert]);
          refresh();
          pushNotif(`${toInsert.length} biaya rutin dicatat ke ${targetDate}.`, "success");
        }
      });
    };

    const tambah = () => {
      if (!form.keterangan || !form.jumlah) { pushNotif("Isi keterangan dan jumlah!", "warning"); return; }
      const jml = parseFloat(form.jumlah);
      if (!jml || jml <= 0) { pushNotif("Jumlah harus lebih dari 0.", "warning"); return; }
      S.set("pengeluaranOwner", [...(S.get("pengeluaranOwner") || []), {
        id: uid(),
        date,
        ts: tsForDate(date),
        keterangan: form.keterangan,
        jumlah: jml,
        kategori: form.kategori,
        branchId: selBranch || null,
        branchName: selBranch ? (branchesData.find((b) => b.id === selBranch)?.name || "") : "Pusat (Global)"
      }]);
      setForm((f) => ({ ...f, keterangan: "", jumlah: "" }));
      refresh();
      pushNotif("Pengeluaran dicatat!", "success");
    };

    const hapus = (id) => {
      confirmAsk({
        title: "Hapus Pengeluaran",
        message: "Yakin hapus pengeluaran owner ini?",
        onConfirm: () => {
          S.set("pengeluaranOwner", (S.get("pengeluaranOwner") || []).filter((x) => x.id !== id));
          refresh();
          pushNotif("Pengeluaran dihapus.", "warning");
        }
      });
    };

    // ── Filter data per view ──
    const allOwner = list;
    const allLapak = S.get("pengeluaranLapak") || [];
    const filteredHarian = allOwner.filter((p) => p.date === date);
    const lapakHarian = allLapak.filter((p) => p.date === date);
    const ownerBulan = allOwner.filter((p) => p.date && p.date.startsWith(bulan));
    const lapakBulan = allLapak.filter((p) => p.date && p.date.startsWith(bulan));
    const ownerTahun = allOwner.filter((p) => p.date && p.date.startsWith(tahun));
    const lapakTahun = allLapak.filter((p) => p.date && p.date.startsWith(tahun));

    const sumByKat = (rows) => KATEGORI.map((k) => ({
      ...k,
      total: rows.filter((p) => p.kategori === k.value).reduce((a, p) => a + (p.jumlah || 0), 0)
    })).filter((k) => k.total > 0);

    const totalOf = (rows) => rows.reduce((a, p) => a + (p.jumlah || 0), 0);

    // Rekap per cabang (owner alokasi + lapak)
    const rekapPerCabang = (ownerRows, lapakRows) => {
      const map = {};
      const bump = (key, name, field, val) => {
        if (!map[key]) map[key] = { key, name, owner: 0, lapak: 0 };
        map[key][field] += val || 0;
      };
      ownerRows.forEach((p) => {
        if (!p.branchId) bump("__global__", "Pusat / Global", "owner", p.jumlah);
        else bump(p.branchId, branchesData.find((b) => b.id === p.branchId)?.name || p.branchName || p.branchId, "owner", p.jumlah);
      });
      lapakRows.forEach((p) => {
        bump(p.branchId || "__unknown__", branchesData.find((b) => b.id === p.branchId)?.name || p.branchName || p.branchId || "—", "lapak", p.jumlah);
      });
      return Object.values(map).map((r) => ({ ...r, total: r.owner + r.lapak })).sort((a, b) => b.total - a.total);
    };

    // Tren 12 bulan dalam tahun (untuk tab tahunan)
    const trenBulananTahun = () => {
      return Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, "0");
        const key = `${tahun}-${m}`;
        const o = allOwner.filter((p) => p.date && p.date.startsWith(key));
        const l = allLapak.filter((p) => p.date && p.date.startsWith(key));
        return {
          key,
          label: ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][i],
          owner: totalOf(o),
          lapak: totalOf(l),
          total: totalOf(o) + totalOf(l)
        };
      });
    };

    const renderRow = (p, { showDate } = {}) => React.createElement("div", { key: p.id, className: "peng-row" },
      React.createElement("div", { className: "peng-info" },
        React.createElement("span", { className: "peng-ket" }, p.keterangan),
        React.createElement("span", { className: "peng-ts" },
          katLabel(p.kategori),
          " | ",
          p.branchId ? (branchesData.find((b) => b.id === p.branchId)?.name || p.branchName) : "Pusat/Global",
          showDate ? " | " + formatTanggalIndoPendek(p.date) : "",
          p.ts ? " - " + p.ts : "",
          p.rutinTemplateId ? " · rutin" : ""
        )
      ),
      React.createElement("div", { className: "peng-right" },
        React.createElement("span", { className: "peng-jml" }, fmtRp(p.jumlah)),
        React.createElement("button", { className: "btn-danger-sm", onClick: () => hapus(p.id) }, "X")
      )
    );

    const renderLapakRow = (p, { showDate } = {}) => React.createElement("div", { key: p.id, className: "peng-row" },
      React.createElement("div", { className: "peng-info" },
        React.createElement("span", { className: "peng-ket" }, p.keterangan),
        React.createElement("span", { className: "peng-ts" },
          branchesData.find((b) => b.id === p.branchId)?.name || p.branchName,
          showDate ? " | " + formatTanggalIndoPendek(p.date) : "",
          " - ", p.ts || ""
        )
      ),
      React.createElement("div", { className: "peng-right" }, React.createElement("span", { className: "peng-jml" }, fmtRp(p.jumlah)))
    );

    const renderKpiKat = (rows) => {
      const byKat = sumByKat(rows);
      if (!byKat.length) return null;
      return React.createElement("div", { className: "kpi-grid mt8" },
        byKat.map((k) =>
          React.createElement("div", { key: k.value, className: "kpi-card kpi-peng" },
            React.createElement("div", { className: "kpi-label" }, k.label),
            React.createElement("div", { className: "kpi-val" }, fmtRp(k.total))
          )
        )
      );
    };

    const renderCabangTable = (ownerRows, lapakRows) => {
      const rows = rekapPerCabang(ownerRows, lapakRows);
      if (!rows.length) return React.createElement(EmptyState, { icon: "📭", title: "Belum ada data", desc: "Data untuk tampilan ini masih kosong." });
      return React.createElement("table", { className: "tbl mt8" },
        React.createElement("thead", null,
          React.createElement("tr", null,
            React.createElement("th", null, "Cabang / Alokasi"),
            React.createElement("th", null, "Owner"),
            React.createElement("th", null, "Lapak"),
            React.createElement("th", null, "Total")
          )
        ),
        React.createElement("tbody", null,
          rows.map((r) =>
            React.createElement("tr", { key: r.key },
              React.createElement("td", null, r.name),
              React.createElement("td", null, fmtRp(r.owner)),
              React.createElement("td", null, fmtRp(r.lapak)),
              React.createElement("td", null, React.createElement("strong", null, fmtRp(r.total)))
            )
          )
        )
      );
    };

    return React.createElement("div", null,
      confirmModal,
      // Tabs view
      React.createElement("div", { className: "row-wrap mb8" },
        [
          { k: "harian", l: "Harian" },
          { k: "bulanan", l: "Bulanan" },
          { k: "tahunan", l: "Tahunan" },
          { k: "rutin", l: "Biaya tetap" }
        ].map((t) =>
          React.createElement("button", {
            key: t.k,
            className: "tab" + (view === t.k ? " active" : ""),
            onClick: () => setView(t.k)
          }, t.l)
        )
      ),

      // ═══════ TAB HARIAN ═══════
      view === "harian" && React.createElement("div", null,
        React.createElement("div", { className: "filter-bar mb8" },
          React.createElement("input", { type: "date", className: "inp inp-sm", value: date, onChange: (e) => setDate(e.target.value) })
        ),
        React.createElement("div", { className: "form-card" },
          React.createElement("h4", null, "Catat biaya owner"),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Alokasi ke Cabang (Opsional)"),
            React.createElement("select", { className: "inp", value: selBranch, onChange: (e) => setSelBranch(e.target.value) },
              React.createElement("option", { value: "" }, "-- Pusat / Global (dibagi rata semua cabang) --"),
              branchesData.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name))
            )
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Kategori"),
            React.createElement("select", { className: "inp", value: form.kategori, onChange: (e) => setForm((f) => ({ ...f, kategori: e.target.value })) },
              KATEGORI.map((k) => React.createElement("option", { key: k.value, value: k.value }, k.label))
            )
          ),
          React.createElement("div", { className: "chips" },
            (CHIPS[form.kategori] || []).map((s) => React.createElement("button", { key: s, className: "chip", onClick: () => setForm((f) => ({ ...f, keterangan: s })) }, s))
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Keterangan"),
            React.createElement("input", { className: "inp", value: form.keterangan, onChange: (e) => setForm((f) => ({ ...f, keterangan: e.target.value })), placeholder: "Detail pengeluaran..." })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Jumlah (Rp)"),
            React.createElement("input", { className: "inp", type: "number", value: form.jumlah, onChange: (e) => setForm((f) => ({ ...f, jumlah: e.target.value })) })
          ),
          React.createElement("button", { className: "btn-primary", onClick: tambah }, "+ Tambah")
        ),
        renderKpiKat(filteredHarian),
        React.createElement("h3", { className: "section-title mt8" }, "Biaya owner — ", formatTanggalIndo(date)),
        filteredHarian.length === 0 && React.createElement(EmptyState, { icon: "🧾", title: "Belum ada pengeluaran owner hari ini", desc: "Catat di form atas, atau generate biaya rutin dari tab Bulanan / Rutin.", actionLabel: "Ke Biaya tetap", onAction: () => setView("rutin") }),
        filteredHarian.map((p) => renderRow(p)),
        filteredHarian.length > 0 && React.createElement("div", { className: "peng-total" }, "Total: ", React.createElement("strong", null, fmtRp(totalOf(filteredHarian)))),
        React.createElement("h3", { className: "section-title mt12" }, "Biaya toko dari kasir — ", formatTanggalIndo(date)),
        lapakHarian.length === 0 && React.createElement(EmptyState, { icon: "🏪", title: "Tidak ada pengeluaran lapak", desc: "Pengeluaran kasir (plastik, transport, dll) akan tampil di sini." }),
        lapakHarian.map((p) => renderLapakRow(p)),
        lapakHarian.length > 0 && React.createElement("div", { className: "peng-total" }, "Total Lapak: ", React.createElement("strong", null, fmtRp(totalOf(lapakHarian))))
      ),

      // ═══════ TAB BULANAN ═══════
      view === "bulanan" && React.createElement("div", null,
        React.createElement("div", { className: "filter-bar mb8 row-wrap" },
          React.createElement("input", { type: "month", className: "inp inp-sm", value: bulan, onChange: (e) => setBulan(e.target.value) }),
          React.createElement("button", { className: "btn-secondary", onClick: () => generateRutinKePeriode("bulanan"), disabled: busyRutin }, "Generate Biaya tetap Bulanan")
        ),
        React.createElement("p", { className: "info-txt" }, "Rekap semua pengeluaran owner + lapak sepanjang bulan. Biaya rutin bulanan (sewa/listrik) digenerate ke tanggal 1 bulan ini (anti-dobel per template)."),
        React.createElement("div", { className: "kpi-grid mt8" },
          React.createElement("div", { className: "kpi-card kpi-peng" },
            React.createElement("div", { className: "kpi-label" }, "Total Owner"),
            React.createElement("div", { className: "kpi-val" }, fmtRp(totalOf(ownerBulan)))
          ),
          React.createElement("div", { className: "kpi-card kpi-peng" },
            React.createElement("div", { className: "kpi-label" }, "Total Lapak"),
            React.createElement("div", { className: "kpi-val" }, fmtRp(totalOf(lapakBulan)))
          ),
          React.createElement("div", { className: "kpi-card" },
            React.createElement("div", { className: "kpi-label" }, "Total Gabungan"),
            React.createElement("div", { className: "kpi-val" }, fmtRp(totalOf(ownerBulan) + totalOf(lapakBulan)))
          )
        ),
        renderKpiKat(ownerBulan),
        React.createElement("h3", { className: "section-title mt8" }, "Per Cabang / Alokasi"),
        renderCabangTable(ownerBulan, lapakBulan),
        React.createElement("h3", { className: "section-title mt12" }, "Rincian Owner (", ownerBulan.length, ")"),
        ownerBulan.length === 0 && React.createElement(EmptyState, { icon: "📅", title: "Belum ada pengeluaran owner bulan ini", desc: "Catat manual di tab Harian atau generate biaya rutin." }),
        ownerBulan.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((p) => renderRow(p, { showDate: true })),
        React.createElement("h3", { className: "section-title mt12" }, "Rincian Lapak (", lapakBulan.length, ")"),
        lapakBulan.length === 0 && React.createElement(EmptyState, { icon: "📅", title: "Belum ada pengeluaran lapak bulan ini", desc: "Pengeluaran dari kasir sepanjang bulan terakumulasi di sini." }),
        lapakBulan.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((p) => renderLapakRow(p, { showDate: true }))
      ),

      // ═══════ TAB TAHUNAN ═══════
      view === "tahunan" && React.createElement("div", null,
        React.createElement("div", { className: "filter-bar mb8 row-wrap" },
          React.createElement("input", { type: "number", className: "inp inp-sm", style: { width: 100 }, value: tahun, min: 2020, max: 2100, onChange: (e) => setTahun(e.target.value) }),
          React.createElement("button", { className: "btn-secondary", onClick: () => generateRutinKePeriode("tahunan"), disabled: busyRutin }, "Generate Biaya tetap Tahunan")
        ),
        React.createElement("p", { className: "info-txt" }, "Rekap pengeluaran sepanjang tahun + tren per bulan. Biaya rutin tahunan digenerate ke 1 Januari tahun terpilih."),
        React.createElement("div", { className: "kpi-grid mt8" },
          React.createElement("div", { className: "kpi-card kpi-peng" },
            React.createElement("div", { className: "kpi-label" }, "Owner ", tahun),
            React.createElement("div", { className: "kpi-val" }, fmtRp(totalOf(ownerTahun)))
          ),
          React.createElement("div", { className: "kpi-card kpi-peng" },
            React.createElement("div", { className: "kpi-label" }, "Lapak ", tahun),
            React.createElement("div", { className: "kpi-val" }, fmtRp(totalOf(lapakTahun)))
          ),
          React.createElement("div", { className: "kpi-card" },
            React.createElement("div", { className: "kpi-label" }, "Total ", tahun),
            React.createElement("div", { className: "kpi-val" }, fmtRp(totalOf(ownerTahun) + totalOf(lapakTahun)))
          )
        ),
        renderKpiKat(ownerTahun),
        React.createElement("h3", { className: "section-title mt8" }, "Tren per Bulan"),
        React.createElement("table", { className: "tbl mt8" },
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", null, "Bulan"),
              React.createElement("th", null, "Owner"),
              React.createElement("th", null, "Lapak"),
              React.createElement("th", null, "Total")
            )
          ),
          React.createElement("tbody", null,
            trenBulananTahun().map((r) =>
              React.createElement("tr", { key: r.key },
                React.createElement("td", null, r.label, " ", tahun),
                React.createElement("td", null, fmtRp(r.owner)),
                React.createElement("td", null, fmtRp(r.lapak)),
                React.createElement("td", null, React.createElement("strong", null, fmtRp(r.total)))
              )
            )
          )
        ),
        React.createElement("h3", { className: "section-title mt12" }, "Per Cabang / Alokasi"),
        renderCabangTable(ownerTahun, lapakTahun)
      ),

      // ═══════ TAB BIAYA RUTIN ═══════
      view === "rutin" && React.createElement("div", null,
        React.createElement("p", { className: "info-txt" },
          "Simpan template biaya berulang (sewa, listrik, internet, THR, dll). ",
          "Lalu generate ke bulan/tahun dari tab Bulanan atau Tahunan. ",
          "Generate anti-dobel: template yang sama tidak dicatat 2× di tanggal target yang sama."
        ),
        React.createElement("div", { className: "form-card mt8" },
          React.createElement("h4", null, "Tambah Template Biaya tetap"),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Nama / Keterangan"),
            React.createElement("input", { className: "inp", value: rutinForm.nama, onChange: (e) => setRutinForm((f) => ({ ...f, nama: e.target.value })), placeholder: "Contoh: Sewa Lapak Depok" })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Jumlah (Rp)"),
            React.createElement("input", { className: "inp", type: "number", value: rutinForm.jumlah, onChange: (e) => setRutinForm((f) => ({ ...f, jumlah: e.target.value })) })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Kategori"),
            React.createElement("select", { className: "inp", value: rutinForm.kategori, onChange: (e) => setRutinForm((f) => ({ ...f, kategori: e.target.value })) },
              KATEGORI.map((k) => React.createElement("option", { key: k.value, value: k.value }, k.label))
            )
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Frekuensi"),
            React.createElement("select", { className: "inp", value: rutinForm.frekuensi, onChange: (e) => setRutinForm((f) => ({ ...f, frekuensi: e.target.value })) },
              React.createElement("option", { value: "bulanan" }, "Bulanan"),
              React.createElement("option", { value: "tahunan" }, "Tahunan")
            )
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Alokasi Cabang"),
            React.createElement("select", { className: "inp", value: rutinForm.branchId, onChange: (e) => setRutinForm((f) => ({ ...f, branchId: e.target.value })) },
              React.createElement("option", { value: "" }, "-- Pusat / Global --"),
              branchesData.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name))
            )
          ),
          React.createElement("button", { className: "btn-primary", onClick: tambahRutinTemplate, disabled: busyRutin }, busyRutin ? "Menyimpan..." : "+ Simpan Template")
        ),
        React.createElement("h3", { className: "section-title mt12" }, "Daftar Template (", (rutin || []).length, ")"),
        (!(rutin || []).length) && React.createElement(EmptyState, {
          icon: "🔁",
          title: "Belum ada biaya rutin",
          desc: "Contoh: sewa 2jt/bulan, internet 300rb/bulan, THR 5jt/tahun. Simpan template, lalu generate tiap awal bulan."
        }),
        (rutin || []).map((r) =>
          React.createElement("div", { key: r.id, className: "peng-row" },
            React.createElement("div", { className: "peng-info" },
              React.createElement("span", { className: "peng-ket" }, r.aktif ? r.nama : ("(nonaktif) " + r.nama)),
              React.createElement("span", { className: "peng-ts" },
                katLabel(r.kategori), " · ", r.frekuensi,
                " · ", r.branchId ? (branchesData.find((b) => b.id === r.branchId)?.name || r.branchId) : "Global"
              )
            ),
            React.createElement("div", { className: "peng-right", style: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" } },
              React.createElement("span", { className: "peng-jml" }, fmtRp(r.jumlah)),
              React.createElement("button", { className: "btn-secondary", style: { fontSize: 11, padding: "2px 8px" }, onClick: () => toggleRutinAktif(r.id) }, r.aktif ? "Nonaktifkan" : "Aktifkan"),
              React.createElement("button", { className: "btn-danger-sm", onClick: () => hapusRutinTemplate(r.id) }, "X")
            )
          )
        ),
        React.createElement("div", { className: "form-card mt12" },
          React.createElement("h4", null, "Generate cepat"),
          React.createElement("p", { className: "info-txt" }, "Bulan aktif UI: ", bulan, " · Tahun: ", tahun),
          React.createElement("div", { className: "row-wrap" },
            React.createElement("button", { className: "btn-primary", onClick: () => generateRutinKePeriode("bulanan"), disabled: busyRutin }, "Generate → Bulan ", bulan),
            React.createElement("button", { className: "btn-secondary", onClick: () => generateRutinKePeriode("tahunan"), disabled: busyRutin }, "Generate → Tahun ", tahun)
          )
        )
      )
    );
  }

  // ─── OwnerSetoran ──────────────────────────────────────────────────────────
  function OwnerSetoran({ pushNotif }) {
    const [tab, setTab] = useState("harian");
    const [sH, setSH] = useState(() => S.get("setoranHarian") || []);
    const [sB, setSB] = useState(() => S.get("setoranBulanan") || []);
    const [bulan, setBulan] = useState(today().slice(0, 7));
    const [filterKas, setFilterKas] = useState("semua"); // semua | menunggu | selisih | pas
    const branches = S.get("branches") || [];
    const investors = S.get("investors") || [];
    const [confirmAsk, confirmModal] = useConfirm();
    const refresh = () => { setSH(S.get("setoranHarian") || []); setSB(S.get("setoranBulanan") || []); };

    const konfirmasi = async (id, opts = {}) => {
      const row = (S.get("setoranHarian") || []).find((s) => s.id === id);
      if (!row) return;
      if (row.status === "selesai" && row.locked) {
        pushNotif("Setoran ini sudah dikonfirmasi & dikunci.", "warning");
        return;
      }
      if (row.selisihKas != null && Math.abs(Number(row.selisihKas)) >= 1 && !String(row.catatanKas || "").trim()) {
        pushNotif("Setoran ini ada selisih kas tapi tanpa catatan. Minta pekerja isi catatan dulu sebelum konfirmasi.", "warning");
        return;
      }
      try {
        if (opts.catatRugi) {
          await catatRugiSelisihKasSetoran(row);
        }
        S.set("setoranHarian", (S.get("setoranHarian") || []).map((s) => s.id === id ? {
          ...s,
          status: "selesai",
          konfirmasiTs: nowTs(),
          locked: true,
          confirmedBy: "owner",
          bersihSistem: s.bersihSistem != null ? s.bersihSistem : (Number(s.omzet || 0) - Number(s.pengeluaran || 0)),
          selisihKas: s.selisihKas != null ? s.selisihKas : null,
          rugiKasDicatat: !!opts.catatRugi,
          rugiKasJumlah: opts.catatRugi ? Math.abs(Number(row.selisihKas) || 0) : (s.rugiKasJumlah || null)
        } : s));
        refresh();
        const info = fmtSelisihKas(row.selisihKas);
        pushNotif(
          opts.catatRugi
            ? ("Setoran dikunci + rugi kas " + fmtRp(Math.abs(Number(row.selisihKas))) + " dicatat ke pengeluaran.")
            : (info && Math.abs(info.value) >= 1 ? ("Setoran dikunci. " + info.text) : "Setoran dikonfirmasi & dikunci!"),
          "success"
        );
      } catch (e) {
        pushNotif("Gagal konfirmasi: " + (e?.message || e), "warning");
      }
    };

    // Buka kunci setoran harian yang sudah dikonfirmasi, supaya bisa dikoreksi.
    // Tidak mengubah status "selesai" - cuma buka gembok proteksi hapus massal.
    const bukaKunciSetoran = (id) => {
      S.set("setoranHarian", (S.get("setoranHarian") || []).map((s) => s.id === id ? { ...s, locked: false } : s));
      refresh(); pushNotif("Kunci setoran dibuka. Data ini sekarang bisa ikut terhapus oleh Bersihkan Data.", "warning");
    };

    const kunciUlangSetoran = (id) => {
      S.set("setoranHarian", (S.get("setoranHarian") || []).map((s) => s.id === id ? { ...s, locked: true } : s));
      refresh(); pushNotif("Setoran dikunci kembali.", "success");
    };

    // Hapus permanen — sengaja TIDAK lewat S.set (yang menghapus dari tampilan
    // duluan sebelum tahu hasil sebenarnya). Di sini delete ke Supabase dulu,
    // baru percaya tampilan kalau baris yang kehapus di database memang > 0 —
    // supaya tidak ada kejadian "kelihatan terhapus" tapi sebenarnya masih ada
    // (misalnya kalau ternyata masih locked=true dan ditolak RLS diam-diam).
    const hapusSetoranHarian = async (id) => {
      try {
        const { data, error } = await sb.from("setoranHarian").delete().eq("id", id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          pushNotif("Tidak ada yang terhapus — kemungkinan data ini masih terkunci di database. Muat ulang halaman lalu coba lagi.", "warning");
          return;
        }
        await S.loadKey("setoranHarian");
        refresh();
        pushNotif("Setoran berhasil dihapus permanen.", "success");
      } catch (e) {
        pushNotif(e?.message || String(e), "warning");
      }
    };

    const askHapusSetoran = (s) => confirmAsk({
      title: "Hapus Setoran",
      message: `Yakin hapus setoran ${s.branchName || branches.find((x) => x.id === s.branchId)?.name || s.branchId} tanggal ${formatTanggalIndoPendek(s.date)} secara permanen? Data yang sudah dihapus tidak bisa dikembalikan.`,
      onConfirm: () => hapusSetoranHarian(s.id)
    });

    const kirimBulanan = (branchId, investorId) => {
      // REVISI AUDIT 2026-07: JANGAN hitung rumus laba salinan di sini.
      // Pakai hitungPerformaPeriode (SATU-SATUNYA rumus laba di app) supaya
      // angka setoran bulanan investor = Dashboard / Performa / Tutup Buku.
      const range = monthRange(bulan);
      const allBranchesForSplit = S.get("branches") || [];
      const hasil = hitungPerformaPeriode({
        txs: S.get("transactions") || [],
        pL: S.get("pengeluaranLapak") || [],
        pO: S.get("pengeluaranOwner") || [],
        distribAll: S.get("distribusiCK") || [],
        stokTidakTerjualAll: S.get("stokTidakTerjual") || [],
        branches: allBranchesForSplit,
        investorsAll: investors,
        dateFrom: range.from,
        dateTo: range.to,
        branchId,
        tipe: "all",
      });
      const b = (hasil.branchStats || []).find((x) => x.id === branchId);
      const omzet = b?.omzet || 0;
      const modal = b?.modal || 0;
      const pLapak = b?.pengLapak || 0;
      const pOwner = b?.pengOwner || 0;
      const laba = b?.laba || 0;
      const inv = investors.find((i) => i.id === investorId);
      const bagian = laba * ((inv?.persenBagi || 0) / 100);
      const all = S.get("setoranBulanan") || [];
      const ex = all.find((s) => s.branchId === branchId && s.bulan === bulan && s.investorId === investorId);
      // Jaring pengaman: kalau ternyata sudah ada laporan yang berstatus "selesai" (dikonfirmasi
      // investor), jangan overwrite diam-diam walau tombolnya sempat ke-klik lewat state basi.
      if (ex && ex.status === "selesai") {
        pushNotif("Laporan bulan ini sudah dikonfirmasi investor dan terkunci. Tidak bisa dikirim ulang.", "warning");
        refresh();
        return;
      }
      const entry = { id: ex?.id || uid(), branchId, investorId, bulan, omzet, modal, pLapak, pOwner, laba, bagianInvestor: bagian, persen: inv?.persenBagi || 0, status: "menunggu", ts: nowTs(), formulaVersion: "hitungPerformaPeriode@2026-07" };
      S.set("setoranBulanan", ex ? all.map((s) => s.id === entry.id ? entry : s) : [...all, entry]);
      refresh(); pushNotif("Laporan bulanan dikirim!", "success");
    };

    const konfirmBulanan = (id) => {
      S.set("setoranBulanan", (S.get("setoranBulanan") || []).map((s) => s.id === id ? { ...s, status: "selesai", konfirmasiTs: nowTs(), confirmedBy: "owner", locked: true } : s));
      refresh(); pushNotif("Laporan bulanan dikonfirmasi & dikunci!", "success");
    };

    // Buka kunci laporan bulanan yang sudah dikonfirmasi, supaya bisa dihapus/dikoreksi.
    // Tidak mengubah status "selesai" - cuma buka gembok proteksi hapus (sama pola
    // dengan bukaKunciSetoran di tab harian).
    const bukaKunciBulanan = (id) => {
      S.set("setoranBulanan", (S.get("setoranBulanan") || []).map((s) => s.id === id ? { ...s, locked: false } : s));
      refresh(); pushNotif("Kunci laporan bulanan dibuka. Sekarang laporan ini bisa dihapus.", "warning");
    };

    const kunciUlangBulanan = (id) => {
      S.set("setoranBulanan", (S.get("setoranBulanan") || []).map((s) => s.id === id ? { ...s, locked: true } : s));
      refresh(); pushNotif("Laporan bulanan dikunci kembali.", "success");
    };

    // Hapus permanen — sama pola dengan hapusSetoranHarian: delete ke Supabase
    // dulu, baru percaya tampilan kalau baris yang kehapus di database memang > 0.
    const hapusSetoranBulananPermanen = async (id) => {
      try {
        const { data, error } = await sb.from("setoranBulanan").delete().eq("id", id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          pushNotif("Tidak ada yang terhapus — kemungkinan data ini masih terkunci di database. Muat ulang halaman lalu coba lagi.", "warning");
          return;
        }
        await S.loadKey("setoranBulanan");
        refresh();
        pushNotif("Laporan bulanan berhasil dihapus permanen.", "success");
      } catch (e) {
        pushNotif(e?.message || String(e), "warning");
      }
    };

    const askHapusBulanan = (s) => {
      const b = branches.find((x) => x.id === s.branchId);
      const inv = investors.find((i) => i.id === s.investorId);
      confirmAsk({
        title: "Hapus Laporan Bulanan",
        message: `Yakin hapus laporan bulanan ${b?.name || s.branchId} untuk investor ${inv?.nama || "-"} bulan ${s.bulan} secara permanen? Data yang sudah dihapus tidak bisa dikembalikan.`,
        onConfirm: () => hapusSetoranBulananPermanen(s.id)
      });
    };


    return React.createElement("div", null,
      React.createElement("div", { className: "tabs" },
        React.createElement("button", { className: "tab" + (tab === "harian" ? " active" : ""), onClick: () => setTab("harian") }, "Harian (Pekerja ke Owner)"),
        React.createElement("button", { className: "tab" + (tab === "bulanan" ? " active" : ""), onClick: () => setTab("bulanan") }, "Bulanan (Owner ke Investor)")
      ),
      tab === "harian" && (() => {
        const rows = [...sH].reverse().filter((s) => {
          const sel = s.selisihKas != null ? Number(s.selisihKas) : null;
          if (filterKas === "menunggu") return s.status === "menunggu";
          if (filterKas === "selisih") return sel != null && Math.abs(sel) >= 1;
          if (filterKas === "pas") return sel != null && Math.abs(sel) < 1;
          return true;
        });
        const totalSelisih = sH.reduce((a, s) => a + (Number(s.selisihKas) || 0), 0);
        const jmlSelisih = sH.filter((s) => s.selisihKas != null && Math.abs(Number(s.selisihKas)) >= 1).length;
        const jmlMenunggu = sH.filter((s) => s.status === "menunggu").length;
        return React.createElement("div", null,
          React.createElement("h3", { className: "section-title mt8" }, "Setoran cabang + cek uang"),
          React.createElement("div", { className: "kpi-grid mt8" },
            React.createElement("div", { className: "kpi-card" },
              React.createElement("div", { className: "kpi-label" }, "Belum dicek"),
              React.createElement("div", { className: "kpi-val" }, jmlMenunggu)
            ),
            React.createElement("div", { className: "kpi-card kpi-peng" },
              React.createElement("div", { className: "kpi-label" }, "Ada selisih uang"),
              React.createElement("div", { className: "kpi-val" }, jmlSelisih)
            ),
            React.createElement("div", { className: "kpi-card" },
              React.createElement("div", { className: "kpi-label" }, "Σ Selisih (semua)"),
              React.createElement("div", { className: "kpi-val", style: { color: totalSelisih < 0 ? "var(--red)" : totalSelisih > 0 ? "var(--accent)" : "var(--green)" } }, fmtSelisihKas(totalSelisih).text)
            )
          ),
          React.createElement("div", { className: "row-wrap mb8 mt8" },
            [
              { k: "semua", l: "Semua" },
              { k: "menunggu", l: "Belum dicek" },
              { k: "selisih", l: "Ada selisih uang" },
              { k: "pas", l: "Uang pas" }
            ].map((t) => React.createElement("button", {
              key: t.k, className: "tab" + (filterKas === t.k ? " active" : ""), onClick: () => setFilterKas(t.k)
            }, t.l))
          ),
          React.createElement("p", { className: "info-txt" },
            "Bersih sistem = omzet − pengeluaran lapak. Selisih = (tunai + non-tunai) − bersih sistem. Kurang = uang fisik lebih kecil dari sistem (perlu ditelusuri)."
          ),
          rows.length === 0 && React.createElement(EmptyState, {
            icon: "💰",
            title: sH.length === 0 ? "Belum ada setoran masuk" : "Tidak ada di filter ini",
            desc: sH.length === 0
              ? "Kalau cabang sudah jualan, minta kasir buka tab Setoran, isi uang fisik, lalu kirim. Kamu konfirmasi di sini."
              : "Coba ubah filter: Semua / Menunggu / Ada Selisih / Kas Pas.",
            actionLabel: sH.length === 0 ? null : "Tampilkan semua",
            onAction: sH.length === 0 ? null : () => setFilterKas("semua")
          }),
          rows.map((s) => {
            const b = branches.find((x) => x.id === s.branchId);
            const bersih = s.bersihSistem != null ? s.bersihSistem : (Number(s.omzet || 0) - Number(s.pengeluaran || 0));
            const info = fmtSelisihKas(s.selisihKas);
            const hasKas = s.tunaiFisik != null || s.totalDiterima != null || s.selisihKas != null;
            return React.createElement("div", {
              key: s.id,
              className: "setoran-card" + (s.status === "menunggu" ? " setoran-card-menunggu" : s.status === "selesai" ? " setoran-card-selesai" : ""),
              style: (s.selisihKas != null && Math.abs(Number(s.selisihKas)) >= 1)
                ? { borderColor: "color-mix(in srgb, var(--red) 45%, transparent)" }
                : undefined
            },
              React.createElement("div", { className: "setoran-card-header" },
                React.createElement("span", null, b?.name || s.branchName || s.branchId),
                React.createElement("span", { className: "setoran-date" }, formatTanggalIndoPendek(s.date))
              ),
              React.createElement("div", { style: { fontSize: 13, color: "var(--text2)" } },
                "Penjualan: ", fmtRp(s.omzet), " | Peng: ", fmtRp(s.pengeluaran || 0), " | Bersih sistem: ", fmtRp(bersih)
              ),
              hasKas
                ? React.createElement("div", { style: { fontSize: 13, marginTop: 4 } },
                    "Tunai: ", React.createElement("strong", null, fmtRp(s.tunaiFisik || 0)),
                    " · Non-tunai: ", React.createElement("strong", null, fmtRp(s.nonTunai || 0)),
                    " · Total: ", React.createElement("strong", null, fmtRp(s.totalDiterima != null ? s.totalDiterima : (Number(s.tunaiFisik || 0) + Number(s.nonTunai || 0)))),
                    " · ",
                    React.createElement("strong", {
                      style: { color: info.tone === "ok" ? "var(--green)" : info.tone === "lebih" ? "var(--accent)" : "var(--red)" }
                    }, info.text)
                  )
                : React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginTop: 4, fontStyle: "italic" } },
                    "Data lama: belum ada hitungan kas fisik (sebelum fitur selisih kas)."
                  ),
              s.catatanKas && React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginTop: 4 } }, "📝 ", s.catatanKas),
              React.createElement("div", { className: "setoran-card-status" },
                s.status === "menunggu" && React.createElement(React.Fragment, null,
                  React.createElement("span", { className: "badge-warn" }, "Belum dicek"),
                  (Number(s.selisihKas) < -0.5)
                    ? React.createElement(React.Fragment, null,
                        React.createElement("button", {
                          className: "btn-primary btn-sm",
                          onClick: () => konfirmasi(s.id, { catatRugi: true })
                        }, "Konfirmasi + catat rugi uang"),
                        React.createElement("button", {
                          className: "btn-secondary btn-sm",
                          style: { marginLeft: 6 },
                          onClick: () => konfirmasi(s.id, { catatRugi: false })
                        }, "Konfirmasi saja")
                      )
                    : React.createElement("button", {
                        className: "btn-primary btn-sm",
                        onClick: () => konfirmasi(s.id)
                      }, (s.selisihKas != null && Math.abs(Number(s.selisihKas)) >= 1) ? "Konfirmasi (ada selisih)" : "Konfirmasi")
                ),
                s.status === "selesai" && React.createElement(React.Fragment, null,
                  React.createElement("span", { className: "badge-ok" }, s.locked ? "🔒 " : "🔓 ", "Dikonfirmasi - ", s.konfirmasiTs),
                  s.locked
                    ? React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => bukaKunciSetoran(s.id) }, "Buka Kunci")
                    : React.createElement(React.Fragment, null,
                        React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => kunciUlangSetoran(s.id) }, "Kunci Lagi"),
                        React.createElement("button", { className: "btn-danger-sm", style: { marginLeft: 6 }, onClick: () => askHapusSetoran(s) }, "Hapus")
                      )
                )
              )
            );
          })
        );
      })(),
      tab === "bulanan" && React.createElement("div", null,
        React.createElement("div", { className: "field-group mt8" },
          React.createElement("label", null, "Pilih Bulan"),
          React.createElement("input", { type: "month", className: "inp inp-sm", value: bulan, onChange: (e) => setBulan(e.target.value) })
        ),
        React.createElement("h3", { className: "section-title mt8" }, "Cabang Investasi"),
        branches.filter((b) => b.type === "investasi").length === 0 && React.createElement(EmptyState, {
          icon: "🤝",
          title: "Belum ada cabang investasi",
          desc: "Tambah cabang bertipe investasi di Setting → Cabang, lalu hubungkan investor."
        }),
        branches.filter((b) => b.type === "investasi").map((b) => {
          const inv = investors.find((i) => i.id === b.investorId);
          const ex = sB.find((s) => s.branchId === b.id && s.bulan === bulan && s.investorId === b.investorId);
          return React.createElement("div", { key: b.id, className: "setoran-card" },
            React.createElement("div", { className: "setoran-card-header" },
              React.createElement("span", null, b.name),
              React.createElement("span", null, "Investor: ", inv?.nama || "-", " (", inv?.persenBagi || 0, "%)")
            ),
            ex && React.createElement("div", { style: { fontSize: 13, color: "var(--text2)" } }, "Penjualan: ", fmtRp(ex.omzet), " | HPP: ", fmtRp(ex.modal), " | Laba: ", fmtRp(ex.laba), " | ", React.createElement("strong", { style: { color: "var(--accent)" } }, "Bagian Investor: ", fmtRp(ex.bagianInvestor))),
            React.createElement("div", { className: "setoran-card-status" },
              !ex && React.createElement("button", { className: "btn-primary btn-sm", onClick: () => kirimBulanan(b.id, b.investorId) }, "Kirim Laporan"),
              ex?.status === "menunggu" && React.createElement(React.Fragment, null,
                React.createElement("span", { className: "badge-warn" }, "Menunggu Investor"),
                React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => konfirmBulanan(ex.id) }, "Tandai Selesai (Manual)")
              ),
              ex?.status === "selesai" && React.createElement(React.Fragment, null,
                React.createElement("span", { className: "badge-ok" }, ex.locked ? "🔒 " : "🔓 ", "Dikonfirmasi", ex.confirmedBy ? ` (${ex.confirmedBy})` : "", " - ", ex.konfirmasiTs),
                ex.locked
                  ? React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => bukaKunciBulanan(ex.id) }, "Buka Kunci")
                  : React.createElement(React.Fragment, null,
                      React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => kunciUlangBulanan(ex.id) }, "Kunci Lagi"),
                      React.createElement("button", { className: "btn-danger-sm", style: { marginLeft: 6 }, onClick: () => askHapusBulanan(ex) }, "Hapus")
                    )
              )
            )
          );
        })
      ),
      confirmModal
    );
  }

  // ─── REVISI #3: OwnerLaporan — Accordion per Cabang + tombol Edit ──────────
  function OwnerLaporan({ pushNotif }) {
    const tick = useStoreTick();
    const [date, setDate] = useState(today());
    const [selBranch, setSelBranch] = useState("all");
    // State accordion: { [branchId]: bool }
    const [openBranches, setOpenBranches] = useState({});
    const [editModal, setEditModal] = useState(null);
    const branches = S.get("branches") || [];

    const txsAll = (S.get("transactions") || []).filter((t) => t.date === date && (selBranch === "all" || t.branchId === selBranch));
    const pL = (S.get("pengeluaranLapak") || []).filter((p) => p.date === date && (selBranch === "all" || p.branchId === selBranch));
    const pO = (S.get("pengeluaranOwner") || []).filter((p) => p.date === date && (selBranch === "all" || !p.branchId || p.branchId === selBranch));
    const distribAllRpt = (S.get("distribusiCK") || []).filter((d) => d.date === date && (selBranch === "all" || d.branchId === selBranch));
    const editLogs = (S.get("editLog") || []).filter((l) => selBranch === "all" || l.branchId === selBranch);
    const omzet = txsAll.reduce((a, t) => a + t.total, 0);
    const hppTerjualRpt = txsAll.reduce((a, t) => a + t.totalHPP, 0);
    const modal = distribAllRpt.reduce((a, d) => a + (d.hppTotal || 0), 0);
    const hppTidakLakuRpt = Math.max(modal - hppTerjualRpt, 0);
    // Gaji Central Kitchen dibagi PROPORSIONAL ke pcs distribusi yang diterima
    // tiap cabang hari ini — dihitung dari po/distribusi hari ini TANPA filter
    // cabang dulu (poCkRpt/distribCkRpt), supaya proporsinya benar walau
    // laporan sedang difilter ke 1 cabang saja.
    const poCkRpt = (S.get("pengeluaranOwner") || []).filter((p) => p.date === date);
    const distribCkRpt = (S.get("distribusiCK") || []).filter((d) => d.date === date);
    const ckSplitRpt = hitungBiayaCkPerCabang({ po: poCkRpt, distribAll: distribCkRpt, branches });
    const pOExclCk = pO.filter((p) => !(p.branchId && ckSplitRpt.ckBranchIds.has(p.branchId)));
    const tPL = pL.reduce((a, p) => a + p.jumlah, 0);
    const tPO = pOExclCk.reduce((a, p) => a + p.jumlah, 0) + (selBranch === "all" ? ckSplitRpt.totalCk : (ckSplitRpt.perBranch[selBranch] || 0));
    const laba = omzet - modal - tPL - tPO;

    const saveEdit = (txId, newItems, alasan) => {
      const txs = S.get("transactions") || [];
      const old = txs.find((x) => x.id === txId);
      if (!old) { pushNotif?.("Transaksi tidak ditemukan.", "warning"); setEditModal(null); return; }
      if (isSetoranLocked(old.branchId, old.date)) {
        pushNotif?.("Setoran hari itu sudah dikunci. Buka kunci dulu di menu Setoran sebelum mengedit transaksi.", "warning");
        setEditModal(null);
        return;
      }
      const branchId = old?.branchId;
      const branchName = branches.find((b) => b.id === branchId)?.name || branchId;
      S.set("transactions", txs.map((t) => t.id === txId ? { ...t, items: newItems, total: newItems.reduce((a, x) => a + x.hargaJual * x.qty, 0), totalHPP: newItems.reduce((a, x) => a + x.hpp * x.qty, 0), edited: true } : t));
      const logs = S.get("editLog") || [];
      S.set("editLog", [...logs, { id: uid(), ts: tsForDate(date), txId, branchId, branchName, alasan, before: old?.items || [], after: newItems }]);
      setEditModal(null);
      pushNotif?.("Transaksi diperbarui.", "warning");
    };

    const toggleBranch = (id) => setOpenBranches((o) => ({ ...o, [id]: !o[id] }));

    // KPI per cabang untuk accordion (Central Kitchen dikeluarkan - bukan lapak penjualan)
    const nBranchAll = Math.max(branches.filter((b) => b.type !== "central_kitchen").length, 1);
    const pOGlobalTotal = pO.filter((p) => !p.branchId).reduce((a, p) => a + p.jumlah, 0);
    const branchSummaries = branches
      .filter((b) => b.type !== "central_kitchen")
      .filter((b) => selBranch === "all" || b.id === selBranch)
      .map((b) => {
        const bTxs = txsAll.filter((t) => t.branchId === b.id);
        const bPL = pL.filter((p) => p.branchId === b.id).reduce((a, p) => a + p.jumlah, 0);
        const bPODirect = pO.filter((p) => p.branchId === b.id).reduce((a, p) => a + p.jumlah, 0);
        const bPOGlobal = pOGlobalTotal / nBranchAll;
        const bPO = bPODirect + bPOGlobal + (ckSplitRpt.perBranch[b.id] || 0);
        const bO = bTxs.reduce((a, t) => a + t.total, 0);
        const bHppTerjual = bTxs.reduce((a, t) => a + t.totalHPP, 0);
        const bM = distribAllRpt.filter((d) => d.branchId === b.id).reduce((a, d) => a + (d.hppTotal || 0), 0);
        const bHppTidakLaku = Math.max(bM - bHppTerjual, 0);
        return { ...b, txs: bTxs, omzet: bO, modal: bM, hppTerjual: bHppTerjual, hppTidakLaku: bHppTidakLaku, pLapak: bPL, pOwner: bPO, laba: bO - bM - bPL - bPO };
      });

    return React.createElement("div", null,
      React.createElement("div", { className: "filter-bar mb8" },
        React.createElement(DateField, { value: date, onChange: (e) => setDate(e.target.value) }),
        React.createElement("select", { className: "inp inp-sm", value: selBranch, onChange: (e) => setSelBranch(e.target.value) },
          React.createElement("option", { value: "all" }, "Semua cabang"),
          branches.filter((b) => b.type !== "central_kitchen").map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name))
        )
      ),
      // KPI ringkasan total
      React.createElement("div", { className: "kpi-grid" },
        React.createElement("div", { className: "kpi-card kpi-omzet" }, React.createElement("div", { className: "kpi-label" }, "Penjualan"), React.createElement("div", { className: "kpi-val" }, fmtRp(omzet))),
        React.createElement("div", { className: "kpi-card kpi-modal" }, React.createElement("div", { className: "kpi-label" }, "Modal bahan"), React.createElement("div", { className: "kpi-val" }, fmtRp(modal))),
        React.createElement("div", { className: "kpi-card", style: { background: "color-mix(in srgb, var(--yellow) 10%, var(--bg2))", border: "1px solid #f59e0b" } }, React.createElement("div", { className: "kpi-label" }, "HPP Tidak Laku"), React.createElement("div", { className: "kpi-val", style: { color: "var(--yellow)" } }, fmtRp(hppTidakLakuRpt))),
        React.createElement("div", { className: "kpi-card kpi-peng" }, React.createElement("div", { className: "kpi-label" }, "Peng. Lapak"), React.createElement("div", { className: "kpi-val" }, fmtRp(tPL))),
        React.createElement("div", { className: "kpi-card kpi-peng" }, React.createElement("div", { className: "kpi-label" }, "Peng. Operasional"), React.createElement("div", { className: "kpi-val" }, fmtRp(tPO))),
        React.createElement("div", { className: "kpi-card kpi-profit" }, React.createElement("div", { className: "kpi-label" }, "Laba Bersih"), React.createElement("div", { className: "kpi-val" }, fmtRp(laba)))
      ),
      // Log edit
      editLogs.length > 0 && React.createElement("div", { className: "mt8" },
        React.createElement("h3", { className: "section-title" }, "Log Perubahan Kasir"),
        editLogs.map((log) =>
          React.createElement("div", { key: log.id, className: "log-card" },
            React.createElement("div", { className: "log-header" },
              React.createElement("span", null, log.ts),
              React.createElement("span", { className: "badge-warn" }, "Diedit"),
              React.createElement("span", { className: "badge-branch" }, log.branchName || log.branchId)
            ),
            React.createElement("div", { className: "log-detail" }, "STRUK-", log.txId.slice(0, 6).toUpperCase(), ' - Alasan: "', log.alasan, '"'),
            React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginTop: 4 } },
              "Sebelum: ", (log.before || []).map((x) => x.nama + " x" + x.qty).join(", "),
              " - Sesudah: ", (log.after || []).map((x) => x.nama + " x" + x.qty).join(", ")
            )
          )
        )
      ),
      // REVISI #3: Accordion per Cabang
      React.createElement("h3", { className: "section-title mt8" }, "Detail Transaksi per Cabang"),
      branchSummaries.length === 0 && React.createElement(EmptyState, { icon: "📭", title: "Belum ada data", desc: "Data untuk tampilan ini masih kosong." }),
      branchSummaries.map((b) =>
        React.createElement("div", { key: b.id, className: "accordion-card" },
          // Header accordion — klik untuk buka/tutup
          React.createElement("div", { className: "accordion-header", onClick: () => toggleBranch(b.id) },
            React.createElement("div", { className: "accordion-title" },
              React.createElement("span", { className: "badge-branch" }, b.name),
              React.createElement("span", { className: "accordion-omzet" }, "Penjualan: ", fmtRp(b.omzet), " | HPP Tidak Laku: ", fmtRp(b.hppTidakLaku), " | Laba: ", fmtRp(b.laba))
            ),
            React.createElement("span", { className: "accordion-arrow" }, openBranches[b.id] ? "▲" : "▼")
          ),
          // Body accordion — hanya tampil kalau open
          openBranches[b.id] && React.createElement("div", { className: "accordion-body" },
            b.txs.length === 0 && React.createElement(EmptyState, { icon: "🛒", title: "Belum ada transaksi", desc: "Jual lewat tab Kasir. Pastikan stok lapak sudah diisi dari distribusi CK." }),
            b.txs.map((tx) =>
              React.createElement("div", { key: tx.id, className: "tx-card" + (tx.edited ? " tx-edited" : "") },
                React.createElement("div", { className: "tx-header" },
                  React.createElement("span", { className: "tx-id" }, "STRUK-", tx.id.slice(0, 6).toUpperCase()),
                  React.createElement("span", { className: "tx-ts" }, fmtTxTs(tx)),
                  tx.edited && React.createElement("span", { className: "badge-warn" }, "Diedit"),
                  isSetoranLocked(tx.branchId, tx.date) && React.createElement("span", { className: "badge-ok" }, "🔒 Terkunci")
                ),
                tx.items.map((it, i) => React.createElement("div", { key: i, className: "tx-item" }, it.nama, " x", it.qty, " = ", fmtRp(it.hargaJual * it.qty), " (HPP: ", fmtRp(it.hpp * it.qty), ")")),
                React.createElement("div", { className: "tx-total" }, "Penjualan: ", fmtRp(tx.total), " | HPP: ", fmtRp(tx.totalHPP), " | Laba: ", fmtRp(tx.total - tx.totalHPP)),
                // Tombol Edit ada di sini (OwnerLaporan) - dikunci kalau setoran hari itu
                // sudah dikonfirmasi, supaya laporan yang sudah dikunci tidak diam-diam
                // berubah tanpa buka-kunci eksplisit dulu di menu Setoran.
                isSetoranLocked(tx.branchId, tx.date)
                  ? React.createElement("span", { className: "info-txt mt4", style: { fontSize: 11 } }, "Terkunci — buka kunci di menu Setoran Harian untuk edit")
                  : React.createElement("button", { className: "btn-edit-sm mt4", onClick: () => setEditModal(tx) }, "Edit Transaksi")
              )
            ),
            // Pengeluaran lapak cabang ini
            pL.filter((p) => p.branchId === b.id).length > 0 && React.createElement("div", { className: "mt8" },
              React.createElement("h4", { className: "sub-title" }, "Pengeluaran Lapak"),
              pL.filter((p) => p.branchId === b.id).map((p) =>
                React.createElement("div", { key: p.id, className: "peng-row" },
                  React.createElement("div", { className: "peng-info" },
                    React.createElement("span", { className: "peng-ket" }, p.keterangan),
                    React.createElement("span", { className: "peng-ts" }, p.ts)
                  ),
                  React.createElement("div", { className: "peng-right" },
                    React.createElement("span", { className: "peng-jml" }, fmtRp(p.jumlah)),
                    // Owner bisa edit pengeluaran lapak
                    React.createElement("button", { className: "btn-edit-sm", style: { marginLeft: 6 }, onClick: () => {
                      const ket = prompt("Edit keterangan:", p.keterangan);
                      if (ket === null) return;
                      const jml = parseFloat(prompt("Edit jumlah (Rp):", p.jumlah));
                      if (isNaN(jml)) return;
                      S.set("pengeluaranLapak", (S.get("pengeluaranLapak") || []).map((x) => x.id === p.id ? { ...x, keterangan: ket, jumlah: jml } : x));
                    } }, "Edit")
                  )
                )
              )
            ),
            // Pengeluaran Operasional owner yang dialokasikan ke cabang ini
            (() => {
              const pOCabang = pO.filter((p) => p.branchId === b.id);
              const pOGlobal = pO.filter((p) => !p.branchId);
              const nBranch = nBranchAll;
              if (pOCabang.length === 0 && pOGlobal.length === 0) return null;
              return React.createElement("div", { className: "mt8" },
                React.createElement("h4", { className: "sub-title" }, "Pengeluaran Operasional"),
                pOCabang.map((p) =>
                  React.createElement("div", { key: p.id, className: "peng-row" },
                    React.createElement("div", { className: "peng-info" },
                      React.createElement("span", { className: "peng-ket" }, p.keterangan),
                      React.createElement("span", { className: "peng-ts" },
                        (["gaji_pekerja","gaji_kitchen","bahan_baku","operasional","sewa","lainnya"].find(k => k === p.kategori) ? {gaji_pekerja:"Gaji Pekerja",gaji_kitchen:"Gaji Kitchen",bahan_baku:"Bahan Baku",operasional:"Operasional",sewa:"Sewa",lainnya:"Lainnya"}[p.kategori] : p.kategori || "-"),
                        " | Langsung - ", p.ts
                      )
                    ),
                    React.createElement("div", { className: "peng-right" }, React.createElement("span", { className: "peng-jml" }, fmtRp(p.jumlah)))
                  )
                ),
                pOGlobal.map((p) =>
                  React.createElement("div", { key: p.id, className: "peng-row" },
                    React.createElement("div", { className: "peng-info" },
                      React.createElement("span", { className: "peng-ket" }, p.keterangan),
                      React.createElement("span", { className: "peng-ts" },
                        (["gaji_pekerja","gaji_kitchen","bahan_baku","operasional","sewa","lainnya"].find(k => k === p.kategori) ? {gaji_pekerja:"Gaji Pekerja",gaji_kitchen:"Gaji Kitchen",bahan_baku:"Bahan Baku",operasional:"Operasional",sewa:"Sewa",lainnya:"Lainnya"}[p.kategori] : p.kategori || "-"),
                        " | Global ÷ ", nBranch, " cabang = ", fmtRp(p.jumlah / nBranch), " - ", p.ts
                      )
                    ),
                    React.createElement("div", { className: "peng-right" }, React.createElement("span", { className: "peng-jml" }, fmtRp(p.jumlah / nBranch)))
                  )
                )
              );
            })()
          )
        )
      ),
      // ── Section Produksi Central Kitchen ──
      (() => {
        const ckBranch = branches.find((b) => b.type === "central_kitchen");
        if (!ckBranch) return null;
        const ckList = (S.get("produksiCK") || []).filter((p) => p.date === date);
        const totalCK = ckList.reduce((a, p) => a + (p.jumlah || 0), 0);
        // Rekap per menu
        const byMenu = {};
        ckList.forEach((p) => {
          if (!byMenu[p.menuId]) byMenu[p.menuId] = { nama: p.menuNama, total: 0 };
          byMenu[p.menuId].total += p.jumlah || 0;
        });
        return React.createElement("div", { className: "mt12" },
          React.createElement("h3", { className: "section-title" }, "\uD83C\uDF73 Produksi Central Kitchen"),
          React.createElement("div", { className: "kpi-grid" },
            React.createElement("div", { className: "kpi-card kpi-omzet" },
              React.createElement("div", { className: "kpi-label" }, "Total Produksi"),
              React.createElement("div", { className: "kpi-val", style: { color: "var(--green)" } }, totalCK, " pcs")
            ),
            React.createElement("div", { className: "kpi-card kpi-modal" },
              React.createElement("div", { className: "kpi-label" }, "Jenis Produk"),
              React.createElement("div", { className: "kpi-val" }, Object.keys(byMenu).length, " item")
            )
          ),
          ckList.length === 0
            ? React.createElement("p", { className: "empty-txt mt8" }, "Belum ada catatan produksi CK hari ini.")
            : React.createElement("div", null,
                React.createElement("div", { className: "tbl-wrap mt8" },
                  React.createElement("table", { className: "tbl" },
                    React.createElement("thead", null,
                      React.createElement("tr", null,
                        React.createElement("th", null, "Produk"),
                        React.createElement("th", null, "Jumlah"),
                        React.createElement("th", null, "Keterangan"),
                        React.createElement("th", null, "Jam")
                      )
                    ),
                    React.createElement("tbody", null,
                      ckList.map((p) =>
                        React.createElement("tr", { key: p.id },
                          React.createElement("td", null, React.createElement("strong", null, p.menuNama)),
                          React.createElement("td", { style: { color: "var(--green)", fontWeight: 700 } }, p.jumlah, " pcs"),
                          React.createElement("td", { style: { color: "var(--text2)" } }, p.keterangan || "-"),
                          React.createElement("td", { style: { color: "var(--text2)", fontSize: 12 } }, p.ts || "-")
                        )
                      ),
                      React.createElement("tr", { style: { borderTop: "2px solid var(--border)", fontWeight: 700 } },
                        React.createElement("td", null, "TOTAL"),
                        React.createElement("td", { style: { color: "var(--green)" } }, totalCK, " pcs"),
                        React.createElement("td", { colSpan: 2 })
                      )
                    )
                  )
                ),
                Object.keys(byMenu).length > 1 && React.createElement("div", { className: "mt8" },
                  React.createElement("h4", { className: "sub-title" }, "Rekap per Produk"),
                  Object.values(byMenu).map((m, i) =>
                    React.createElement("div", { key: i, className: "branch-stat-row" },
                      React.createElement("span", null, m.nama),
                      React.createElement("strong", { style: { color: "var(--green)" } }, m.total, " pcs")
                    )
                  )
                )
            )
        );
      })(),
      // Modal edit transaksi (Owner Laporan)
      editModal && React.createElement(EditTxModal, { tx: editModal, onClose: () => setEditModal(null), onSave: saveEdit })
    );
  }

  // ─── OwnerAbsensi ──────────────────────────────────────────────────────────
  function OwnerAbsensi({ pushNotif }) {
    const tick = useStoreTick();
    const [month, setMonth] = useState(today().slice(0, 7));
    const [selBranch, setSelBranch] = useState("all");
    const [busyGaji, setBusyGaji] = useState({});
    const [busyHapusAbs, setBusyHapusAbs] = useState({});
    const [confirmAsk, confirmModal] = useConfirm();
    const branches = S.get("branches") || [];
    const profiles = (S.get("profiles") || []).filter(isActiveProfile);
    const absensi = S.get("absensi") || [];
    const snaps = S.get("absensiBulanan") || [];
    const gajiPembayaran = S.get("gajiPembayaran") || [];
    const workers = profiles.filter((p) => p.role === "worker").filter((p) => selBranch === "all" || p.branchId === selBranch);

    const gajiMap = useMemo(() => {
      // REVISI 2026-07: total = jumlah tarif histori per hari hadir (bukan hadir x gaji profil sekarang)
      const map = {};
      workers.forEach((w) => {
        const h = hitungGajiDariAbsensi(w.user_id, absensi, month, w.gajiHarian);
        map[w.user_id] = { gajiHarian: h.gajiHarianTerakhir, hadir: h.hadir, total: h.total, detail: h.detail, gajiHarianAvg: h.gajiHarianAvg };
      });
      return map;
    }, [workers, absensi, month, tick]);

    const totalGaji = Object.values(gajiMap).reduce((a, v) => a + v.total, 0);

    const calcUserMonth = useCallback((userId) => {
      const rows2 = absensi.filter((a) => a.user_id === userId && String(a.date || "").startsWith(month));
      let hadir = 0, menit = 0;
      for (const r of rows2) {
        if (r.checkin_ts) hadir += 1;
        if (r.checkin_ts && r.checkout_ts) {
          const a = Date.parse(r.checkin_ts), b = Date.parse(r.checkout_ts);
          if (!isNaN(a) && !isNaN(b) && b > a) menit += Math.floor((b - a) / 60000);
        }
      }
      rows2.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      return { hadir, menit, history: rows2 };
    }, [absensi, month]);

    const rows = useMemo(() => {
      const todayStr = today();
      const week = getWeekRange(todayStr);
      return workers.map((w) => {
        const snap = snaps.find((s) => s.user_id === w.user_id && s.bulan === month && s.locked) || null;
        const calc = calcUserMonth(w.user_id);
        const hadirHariIni = !!absensi.find((a) => a.user_id === w.user_id && a.date === todayStr && a.checkin_ts);
        const hadirMinggu = hitungHadirRange(absensi, w.user_id, week.start, week.end);
        return { w, locked: !!snap, hadir: snap ? snap.total_hadir : calc.hadir, menit: snap ? snap.total_menit : calc.menit, history: calc.history, hadirHariIni, hadirMinggu };
      });
    }, [workers, snaps, month, calcUserMonth, absensi, tick]);

    const lockMonth = async () => {
      try {
        if (rows.length === 0) { pushNotif("Tidak ada pekerja untuk direkap.", "warning"); return; }
        const entries = rows.map((r) => ({ user_id: r.w.user_id, branchId: r.w.branchId, bulan: month, total_hadir: r.hadir, total_menit: r.menit, locked: true, generated_at: nowIso() }));
        const { error } = await sb.from("absensiBulanan").upsert(entries, { onConflict: "user_id,bulan" });
        if (error) throw error;
        await S.loadKey("absensiBulanan");
        pushNotif("Rekap absensi bulan ini dikunci.", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
    };

    const unlockMonth = async () => {
      try {
        for (const r of rows) {
          const { error } = await sb.from("absensiBulanan").update({ locked: false, generated_at: nowIso() }).eq("user_id", r.w.user_id).eq("bulan", month);
          if (error) throw error;
        }
        await S.loadKey("absensiBulanan");
        pushNotif("Kunci rekap dibuka.", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
    };

    // ─── Bayar gaji ke satu pekerja ───
    const bayarGaji = async (r) => {
      const userId = r.w.user_id;
      const totalBayar = gajiMap[userId]?.total || 0;
      if (totalBayar <= 0) { pushNotif("Gaji belum diset atau hadir 0 hari.", "warning"); return; }
      // Cek apakah bulan ini sudah ada pembayaran
      const sudahBayar = gajiPembayaran.find((g) => g.user_id === userId && g.bulan === month);
      if (sudahBayar) { pushNotif("Gaji bulan ini sudah dikirim ke " + (r.w.display_name || r.w.displayName || r.w.email) + ".", "warning"); return; }
      setBusyGaji((b) => ({ ...b, [userId]: true }));
      try {
        const nama = r.w.display_name || r.w.displayName || r.w.email || userId;
        const branchNama = branches.find((b) => b.id === r.w.branchId)?.name || "-";
        const entry = {
          id: uid(), user_id: userId, bulan: month, jumlah: totalBayar,
          gajiHarian: gajiMap[userId]?.gajiHarian || 0, hadir: r.hadir,
          gajiHarianAvg: gajiMap[userId]?.gajiHarianAvg || gajiMap[userId]?.gajiHarian || 0,
          gajiDetail: gajiMap[userId]?.detail || [],
          branchId: r.w.branchId, branchName: branchNama, namaPekerja: nama,
          status: "dikirim", createdAt: nowIso(), confirmedAt: null,
          formulaVersion: "historiGaji@2026-07"
        };
        const { error } = await sb.from("gajiPembayaran").insert([entry]);
        if (error) throw error;
        await S.loadKey("gajiPembayaran");
        pushNotif("Gaji " + fmtRp(totalBayar) + " berhasil dikirim ke " + nama + "!", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
      finally { setBusyGaji((b) => { const c = { ...b }; delete c[userId]; return c; }); }
    };

    // Hapus 1 catatan absensi (misal: salah check-in di hari yang seharusnya
    // libur). Sengaja per-baris, BUKAN lewat "Bersihkan Data" yang hapus 1
    // cabang+1 hari PENUH (semua pekerja) — supaya koreksi 1 orang tidak
    // menyeret absensi pekerja lain yang benar. Verifikasi ke database dulu
    // (bukan optimis) seperti pola hapusSetoranHarian, dan otomatis membatalkan
    // gaji harian otomatis yang ikut ter-generate dari check-in ini supaya
    // tidak ada pengeluaran "hantu" yang nyangkut walau absensinya sudah hilang.
    const hapusAbsensi = async (row, worker) => {
      const bulanRow = String(row.date || "").slice(0, 7);
      const monthLocked = snaps.some((s) => s.user_id === worker.user_id && s.bulan === bulanRow && s.locked);
      if (monthLocked) {
        pushNotif("Rekap bulan ini sudah dikunci. Klik \"Buka Kunci\" dulu sebelum menghapus absensi.", "warning");
        return;
      }
      setBusyHapusAbs((b) => ({ ...b, [row.id]: true }));
      try {
        const { data, error } = await sb.from("absensi").delete().eq("id", row.id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          pushNotif("Tidak ada yang terhapus — kemungkinan data ini masih terkunci di database. Muat ulang halaman lalu coba lagi.", "warning");
          return;
        }
        await S.loadKey("absensi");

        // Batalkan gaji harian otomatis (kalau ada) yang ikut ter-generate saat check-in ini.
        const pOwnerAll = S.get("pengeluaranOwner") || [];
        const gajiOtomatis = pOwnerAll.find((p) => p.autoGajiUserId === worker.user_id && p.date === row.date);
        if (gajiOtomatis) {
          const { error: delGajiErr } = await sb.from("pengeluaranOwner").delete().eq("id", gajiOtomatis.id);
          if (!delGajiErr) await S.loadKey("pengeluaranOwner");
        }

        pushNotif(
          "Absensi tanggal " + formatTanggalIndoPendek(row.date) + " berhasil dihapus" +
          (gajiOtomatis ? ", gaji harian otomatis untuk hari itu juga ikut dibatalkan." : "."),
          "success"
        );
      } catch (e) {
        pushNotif(e?.message || String(e), "warning");
      } finally {
        setBusyHapusAbs((b) => { const c = { ...b }; delete c[row.id]; return c; });
      }
    };

    const askHapusAbsensi = (row, worker) => confirmAsk({
      title: "Hapus Absensi",
      message: `Yakin hapus catatan absensi ${worker.display_name || worker.displayName || worker.email || "pekerja ini"} tanggal ${formatTanggalIndoPendek(row.date)}? Check-in${row.checkout_ts ? "/check-out" : ""} hari itu akan dihapus PERMANEN dan tidak bisa dikembalikan. Gaji harian otomatis untuk hari itu (kalau ada) akan ikut dibatalkan.`,
      confirmLabel: "Ya, Hapus",
      onConfirm: () => hapusAbsensi(row, worker)
    });

    const totalHadir = rows.reduce((a, r) => a + (r.hadir || 0), 0);
    const totalMenit = rows.reduce((a, r) => a + (r.menit || 0), 0);
    const hadirHariIniCount = rows.filter((r) => r.hadirHariIni).length;
    const totalHadirMinggu = rows.reduce((a, r) => a + (r.hadirMinggu || 0), 0);
    const getJam = (ts) => ts ? (ts.split(" ")[1] || ts.split("T")[1]?.slice(0, 5) || ts) : "-";

    return React.createElement("div", null,
      React.createElement("div", { className: "filter-bar mb8" },
        React.createElement("input", { type: "month", className: "inp inp-sm", value: month, onChange: (e) => setMonth(e.target.value) }),
        React.createElement("select", { className: "inp inp-sm", value: selBranch, onChange: (e) => setSelBranch(e.target.value) },
          React.createElement("option", { value: "all" }, "Semua cabang"),
          branches.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name))
        ),
        React.createElement("button", { className: "btn-primary btn-sm", onClick: lockMonth }, "Kunci Rekap"),
        React.createElement("button", { className: "btn-secondary btn-sm", onClick: unlockMonth }, "Buka Kunci")
      ),
      React.createElement("h3", { className: "section-title" }, "Ringkasan Absensi"),
      React.createElement("div", { className: "kpi-grid" },
        React.createElement("div", { className: "kpi-card kpi-cab" }, React.createElement("div", { className: "kpi-label" }, "Hadir Hari Ini"), React.createElement("div", { className: "kpi-val" }, hadirHariIniCount, " / ", rows.length, " pekerja")),
        React.createElement("div", { className: "kpi-card kpi-omzet" }, React.createElement("div", { className: "kpi-label" }, "Total Hadir Minggu Ini"), React.createElement("div", { className: "kpi-val" }, totalHadirMinggu, " hari-orang")),
        React.createElement("div", { className: "kpi-card kpi-omzet" }, React.createElement("div", { className: "kpi-label" }, "Total Hadir Bulan Ini"), React.createElement("div", { className: "kpi-val" }, totalHadir, " hari")),
        React.createElement("div", { className: "kpi-card kpi-profit" }, React.createElement("div", { className: "kpi-label" }, "Total Jam Bulan Ini"), React.createElement("div", { className: "kpi-val" }, Math.round(totalMenit / 60 * 10) / 10, " jam")),
        React.createElement("div", { className: "kpi-card kpi-cab" }, React.createElement("div", { className: "kpi-label" }, "Pekerja"), React.createElement("div", { className: "kpi-val" }, rows.length)),
        React.createElement("div", { className: "kpi-card kpi-peng" }, React.createElement("div", { className: "kpi-label" }, "Total Gaji Bulan Ini"), React.createElement("div", { className: "kpi-val" }, fmtRp(totalGaji)))
      ),
      React.createElement("p", { className: "info-txt mt4" }, "Hadir Minggu Ini dihitung Senin–Minggu (pekan berjalan). Gaji dihitung otomatis: Gaji Harian × Hadir Bulan Ini. Set gaji harian per pekerja di tab Seting → Akun."),
      React.createElement("h3", { className: "section-title mt12" }, "Detail Absensi & Bayar Gaji"),
      rows.length === 0 && React.createElement(EmptyState, { icon: "👷", title: "Belum ada data pekerja", desc: "Tambah akun di Setting → Akun & Pekerja, set cabang & gaji." }),
      rows.map((r) => {
        const userId = r.w.user_id;
        const gajiInfo = gajiMap[userId];
        const sudahBayar = gajiPembayaran.find((g) => g.user_id === userId && g.bulan === month);
        return React.createElement("div", { key: userId, className: "form-card mt8", style: { padding: 12 } },
          // ── Header pekerja + tombol bayar ──
          React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 } },
            React.createElement("div", null,
              React.createElement("div", { style: { fontWeight: 700, fontSize: 14 } }, r.w.display_name || r.w.displayName || r.w.email || userId.slice(0, 8)),
              React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginTop: 2 } },
                branches.find((b) => b.id === r.w.branchId)?.name || "-",
                r.locked ? React.createElement("span", { style: { marginLeft: 6, color: "var(--yellow)", fontSize: 11 } }, "🔒 Terkunci") : null
              )
            ),
            React.createElement("div", { style: { textAlign: "right" } },
              gajiInfo && gajiInfo.gajiHarian > 0
                ? React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 13, color: "var(--accent)", fontWeight: 700 } }, fmtRp(gajiInfo.total)),
                    React.createElement("div", { style: { fontSize: 11, color: "var(--text2)" } }, fmtRp(gajiInfo.gajiHarian), "/hari × ", r.hadir, " hari")
                  )
                : React.createElement("div", { style: { fontSize: 12, color: "var(--text2)" } }, "Gaji belum diset")
            )
          ),
          // ── Ringkasan hadir: Harian / Mingguan / Bulanan ──
          React.createElement("div", { style: { display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--text2)", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" } },
            React.createElement("span", null, "Hari ini: ", r.hadirHariIni
              ? React.createElement("strong", { style: { color: "var(--green)" } }, "✅ Hadir")
              : React.createElement("strong", { style: { color: "var(--yellow)" } }, "⛔ Belum")
            ),
            React.createElement("span", null, "Minggu ini: ", React.createElement("strong", { style: { color: "var(--accent)" } }, r.hadirMinggu, " / 7 hari")),
            React.createElement("span", null, "Bulan ini: ", React.createElement("strong", { style: { color: "var(--green)" } }, r.hadir, " hari")),
            React.createElement("span", null, "Jam: ", React.createElement("strong", null, Math.round(r.menit / 60 * 10) / 10, " jam"))
          ),
          // ── Riwayat per hari dengan nama hari ──
          r.history.length === 0
            ? React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginBottom: 8 } }, "Belum ada riwayat absen bulan ini.")
            : React.createElement("div", { style: { marginBottom: 8 } },
                r.history.map((h) =>
                  React.createElement("div", { key: h.id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "3px 0", borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)", gap: 8 } },
                    React.createElement("span", { style: { color: "var(--text)", fontWeight: 500 } }, formatTanggalIndoPendek(h.date)),
                    React.createElement("span", { style: { color: "var(--text2)" } },
                      "Masuk ", React.createElement("strong", null, getJam(h.checkin_ts)),
                      " — Keluar ", React.createElement("strong", { style: { color: h.checkout_ts ? "var(--green)" : "var(--yellow)" } }, h.checkout_ts ? getJam(h.checkout_ts) : "Belum")
                    ),
                    r.locked
                      ? React.createElement("span", { style: { fontSize: 10, color: "var(--yellow)" } }, "🔒")
                      : React.createElement("button", {
                          className: "btn-danger-sm",
                          disabled: !!busyHapusAbs[h.id],
                          title: "Hapus catatan absensi ini",
                          onClick: () => askHapusAbsensi(h, r.w)
                        }, busyHapusAbs[h.id] ? "..." : "🗑️")
                  )
                )
              ),
          // ── Tombol bayar gaji / status ──
          gajiInfo && gajiInfo.gajiHarian > 0 && gajiInfo.total > 0
            ? sudahBayar
              ? React.createElement("div", { style: { padding: "8px 12px", borderRadius: 8, background: "color-mix(in srgb, var(--green) 12%, var(--bg2))", border: "1px solid color-mix(in srgb, var(--green) 30%, var(--border))", fontSize: 13 } },
                  sudahBayar.status === "dikonfirmasi"
                    ? React.createElement("span", { style: { color: "var(--green)", fontWeight: 700 } }, "✅ Gaji sudah diterima & dikonfirmasi pekerja")
                    : React.createElement("span", { style: { color: "var(--accent)" } }, "📤 Gaji ", React.createElement("strong", null, fmtRp(sudahBayar.jumlah)), " sudah dikirim — menunggu konfirmasi pekerja")
                )
              : React.createElement("button", {
                  className: "btn-primary btn-full",
                  disabled: !!busyGaji[userId],
                  onClick: () => bayarGaji(r)
                }, busyGaji[userId] ? "Mengirim..." : "💸 Bayarkan Gaji " + fmtRp(gajiInfo.total))
            : null
        );
      }),
      confirmModal
    );
  }


  // ─── REVISI #1: EditMenuModal baru — resep pakai jumlahPakai (berapa pcs dari bahan ini) ──
  function EditMenuModal({ menu, bahan, isPaket, menuSatuanList, onSave, onClose }) {
    const [m, setM] = useState({
      ...menu,
      tipe: isPaket ? "paket" : "satuan",
      resepBahanPokok: menu.resepBahanPokok || [],
      resepToping: menu.resepToping || [],
      imageUrl: menu.imageUrl || "",
      imagePath: menu.imagePath || "",
      boxCost: parseFloat(menu.boxCost || 0) || 0,
      isiBox: parseInt(menu.isiBox || 3) || 3
    });
    // Bahan pokok baru: pilih bahan + jumlahPakai (berapa pcs adonan dasar yang dipakai, default 1)
    const [nRB, setNRB] = useState({ bahanId: bahan[0]?.id || "", jumlahPakai: "1" });
    // Toping menu: nama, hargaBeli, kapasitas (per menu varian)
    const [nRT, setNRT] = useState({ nama: "", hargaBeli: "", kapasitas: "" });
    const [uploading, setUploading] = useState(false);

    const addRB = () => {
      if (!nRB.bahanId || !nRB.jumlahPakai) return;
      setM((p) => ({ ...p, resepBahanPokok: [...p.resepBahanPokok, { bahanId: nRB.bahanId, jumlahPakai: parseFloat(nRB.jumlahPakai) || 1 }] }));
      setNRB((x) => ({ ...x, jumlahPakai: "1" }));
    };
    const delRB = (i) => setM((p) => ({ ...p, resepBahanPokok: p.resepBahanPokok.filter((_, idx) => idx !== i) }));

    const addRT = () => {
      if (!nRT.nama || !nRT.hargaBeli || !nRT.kapasitas) return;
      setM((p) => ({ ...p, resepToping: [...p.resepToping, { nama: nRT.nama, hargaBeli: parseFloat(nRT.hargaBeli), kapasitas: parseInt(nRT.kapasitas) }] }));
      setNRT({ nama: "", hargaBeli: "", kapasitas: "" });
    };
    const delRT = (i) => setM((p) => ({ ...p, resepToping: p.resepToping.filter((_, idx) => idx !== i) }));

    const doUploadImage = async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      try {
        setUploading(true);
        const uploaded = await uploadAsset(file, "menu", { maxBytes: 300 * 1024, maxEdge: 1400 });
        setM((prev) => ({ ...prev, imageUrl: uploaded.url || prev.imageUrl, imagePath: uploaded.path || prev.imagePath }));
      } catch (err) { pushNotif(err?.message || String(err), "warning"); } finally { setUploading(false); }
    };

    const info = getMenuHPPBreakdown(m);

    return React.createElement(Modal, { title: (isPaket ? "Box - " : "Menu - ") + (m.id ? "Edit" : "Tambah"), onClose },
      // Nama
      React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Nama"),
        React.createElement("input", { className: "inp", value: m.nama, onChange: (e) => setM((x) => ({ ...x, nama: e.target.value })) })
      ),
      // Upload gambar
      React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Gambar Menu"),
        m.imageUrl && React.createElement("img", { src: m.imageUrl, alt: m.nama || "Menu", className: "brand-preview", style: { width: 120, height: 120, margin: "0 auto" } }),
        React.createElement("input", { className: "inp", type: "file", accept: "image/*", onChange: doUploadImage, disabled: uploading }),
        React.createElement("input", { className: "inp", value: m.imageUrl || "", onChange: (e) => setM((x) => ({ ...x, imageUrl: e.target.value })), placeholder: "Atau tempel URL gambar" })
      ),
      // Isi box (paket)
      isPaket && React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Isi Box (pcs)"),
        React.createElement("input", { className: "inp", type: "number", value: m.isiBox || 3, onChange: (e) => setM((x) => ({ ...x, isiBox: parseInt(e.target.value) || 3 })) })
      ),
      // Semua box memakai model universal per-slot.
      isPaket && React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Jenis Box"),
        React.createElement("div", { className: "diskon-methods", style: { gridTemplateColumns: "1fr" } },
          React.createElement("button", { type: "button", className: "diskon-method active", disabled: true }, "🍩 Paket Universal — pilih rasa per donat")
        ),
        React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Setiap donat dalam box memilih 1 glaze + 1 topping dasar yang sudah termasuk harga. Topping ke-2 dan seterusnya berbayar.")
      ),
      // Menu donat polos (untuk mode slot) — potong stok polos
      isPaket && (m.boxMode === "slot") && React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Menu Donat Polos (untuk potong stok)"),
        React.createElement("select", { className: "inp", value: m.baseMenuId || "", onChange: (e) => setM((x) => ({ ...x, baseMenuId: e.target.value || null })) },
          React.createElement("option", { value: "" }, "— Pilih donat polos —"),
          (menuSatuanList || []).map((ms) => React.createElement("option", { key: ms.id, value: ms.id }, ms.nama))
        ),
        React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Tiap slot memotong 1 pcs donat polos ini. Glaze & toping dipotong dari stoknya sendiri.")
      ),
      // Menu satuan dasar (untuk pengurangan stok otomatis) — hanya box satu rasa
      isPaket && !m.mixMode && (m.boxMode || "satu") === "satu" && React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Menu Satuan Dasar (untuk potong stok)"),
        React.createElement("select", { className: "inp", value: m.baseMenuId || "", onChange: (e) => setM((x) => ({ ...x, baseMenuId: e.target.value || null })) },
          React.createElement("option", { value: "" }, "— Pilih menu satuan —"),
          (menuSatuanList || []).map((ms) => React.createElement("option", { key: ms.id, value: ms.id }, ms.nama))
        ),
        React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Saat paket ini terjual, stok menu satuan dasar akan otomatis berkurang sebanyak Isi Box.")
      ),
      // Harga kardus (paket)
      isPaket && React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Harga Kardus/Box (Rp)"),
        React.createElement("input", { className: "inp", type: "number", value: m.boxCost || 0, onChange: (e) => setM((x) => ({ ...x, boxCost: parseFloat(e.target.value) || 0 })) })
      ),
      // Harga jual
      React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Harga Jual (Rp)"),
        React.createElement("input", { className: "inp", type: "number", value: m.hargaJual, onChange: (e) => setM((x) => ({ ...x, hargaJual: parseFloat(e.target.value) || 0 })) })
      ),
      // Resep Bahan Pokok
      React.createElement("h4", { className: "sub-title" }, "Bahan Baku Adonan", isPaket ? " (untuk " + (m.isiBox || 1) + " pcs box)" : ""),
      React.createElement("p", { className: "info-txt" }, "Pilih bahan dari daftar bahan baku. HPP dihitung otomatis dari harga beli ÷ kapasitas."),
      m.resepBahanPokok.map((r, i) => {
        const b = bahan.find((x) => x.id === r.bahanId);
        const hpp = b ? getBahanHppPerPcs(b) * (r.jumlahPakai || 1) : 0;
        return React.createElement("div", { key: i, className: "resep-row" },
          b?.nama || "?",
          " × ", r.jumlahPakai || 1, " takaran", 
          " → HPP: ", fmtRp(roundHppRp(hpp)),
          " ",
          React.createElement("button", { className: "btn-danger-sm", onClick: () => delRB(i) }, "X")
        );
      }),
      React.createElement("div", { className: "add-row" },
        React.createElement("select", { className: "inp inp-sm", value: nRB.bahanId, onChange: (e) => setNRB((x) => ({ ...x, bahanId: e.target.value })) },
          bahan.length === 0 && React.createElement("option", null, "-- Tambah bahan dulu --"),
          bahan.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.nama, " (HPP: ", fmtRp(getBahanHppPerPcs(b, { rounded: true })), "/pcs)"))
        ),
        React.createElement("input", { className: "inp inp-sm", type: "number", placeholder: "Takaran per donat", value: nRB.jumlahPakai, onChange: (e) => setNRB((x) => ({ ...x, jumlahPakai: e.target.value })), style: { width: 80 } }),
        React.createElement("button", { className: "btn-primary btn-sm", onClick: addRB }, "+")
      ),
      // Glaze dan topping tidak menjadi resep tetap menu.
      // Pilihan glaze/topping dilakukan per slot di kasir.
      // Preview HPP
      React.createElement("div", { className: "hpp-preview" },
        "HPP Adonan/pcs: ", React.createElement("strong", null, fmtRp(info.hppAdonanPerPcs)),
        " | HPP Toping/pcs: ", React.createElement("strong", null, fmtRp(info.hppTopingPerPcs)),
        " | HPP Produk/pcs: ", React.createElement("strong", { style: { color: "var(--accent)" } }, fmtRp(info.hppSatuanPerPcs)),
        isPaket
          ? React.createElement(React.Fragment, null, " | HPP Paket: ", React.createElement("strong", { style: { color: "var(--accent)" } }, fmtRp(info.hppPaket)), " | Margin Paket: ", React.createElement("strong", { style: { color: "var(--green)" } }, fmtRp(info.marginPaket)))
          : React.createElement(React.Fragment, null, " | Omzet Kotor/pcs: ", React.createElement("strong", { style: { color: "var(--green)" } }, fmtRp(info.omzetKotorPerPcs)))
      ),
      isPaket && !m.mixMode && !m.baseMenuId && React.createElement("p", { className: "field-warning" }, "\u26A0\uFE0F Wajib dipilih agar stok box bisa terkontrol otomatis."),
      React.createElement("div", { className: "row-wrap mt8" },
        React.createElement("button", { className: "btn-secondary", onClick: onClose }, "Batal"),
        React.createElement("button", {
          className: "btn-primary",
          onClick: () => {
            if (!m.nama) { pushNotif("Isi nama menu dulu!", "warning"); return; }
            if (isPaket && !m.mixMode && !m.baseMenuId) { pushNotif("Pilih \"Menu Satuan Dasar\" dulu agar stok box terkontrol otomatis.", "warning"); return; }
            onSave(m);
          },
          disabled: uploading
        }, uploading ? "Upload..." : "Simpan")
      )
    );
  }

  // ─── REVISI #1: SettingHPP baru — input Harga Beli + Kapasitas ─────────────
  function SettingHPP({ pushNotif, initialSub, onConsumedFocus }) {
    const tick = useStoreTick();
    const [sub, setSub] = useState(() => (initialSub === "menu" || initialSub === "bahan" || initialSub === "toping" || initialSub === "preset") ? initialSub : "bahan");
    useEffect(() => {
      if (initialSub === "menu" || initialSub === "bahan" || initialSub === "toping" || initialSub === "preset") {
        setSub(initialSub);
        if (onConsumedFocus) onConsumedFocus();
      }
    }, [initialSub]);
    const [bahan, setBahan] = useState(() => S.get("bahanPokok") || []);
    const [menus, setMenus] = useState(() => (S.get("menuVarian") || []).filter((m) => m.tipe !== "paket"));
    const [topings, setTopings] = useState(() => S.get("topingTambahan") || []);
    const [editMenu, setEditMenu] = useState(null);
    const [confirmAsk, confirmModal] = useConfirm();
    // Bahan Pokok baru: nama, hargaBeli (total), kapasitas (yield pcs), satuanBeli (opsional keterangan)
    const [nB, setNB] = useState({ nama: "", hargaBeli: "", isiBeli: "", satuanStok: "gram", takaranPerPcs: "", kapasitas: "", satuanBeli: "" });
    // Toping tambahan tetap: nama, hargaJual, plus untuk HPP: hargaBeli, kapasitas
    const [nT, setNT] = useState({ nama: "", hargaBeli: "", kapasitas: "", hargaJual: "", satuanStok: "gram", isiPerBeli: "", jenis: "topping", porsiPerPcs: "" });
    const [presets, setPresets] = useState([]);
    const [presetForm, setPresetForm] = useState({ id: null, nama: "", glazeId: "", toppingId: "" });

    useEffect(() => {
      setBahan(S.get("bahanPokok") || []);
      setMenus((S.get("menuVarian") || []).filter((m) => m.tipe !== "paket"));
      setTopings(S.get("topingTambahan") || []);
      sb.from("app_settings").select("value").eq("key", "preset_rasa").maybeSingle()
        .then(({ data }) => setPresets(Array.isArray(data?.value) ? data.value : []))
        .catch(() => setPresets([]));
    }, [tick]);

    useEffect(() => {
      if (sub !== "menu") return;
      try {
        const el = document.getElementById("resep-missing-panel");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch {}
    }, [sub, menus]);

    const saveB = () => {
      if (!nB.nama || !nB.hargaBeli) { pushNotif("Isi nama dan harga beli!", "warning"); return; }
      const hargaBeli = parseFloat(nB.hargaBeli) || 0;
      const isiBeli = Number(nB.isiBeli) || 0;
      // Cara warung: isi "jadi berapa pcs donat" (kapasitas). Takaran gram dihitung otomatis.
      let yieldPcs = Number(nB.kapasitas) || 0;
      let takaranPerPcs = Number(nB.takaranPerPcs) || 0;
      if (yieldPcs <= 0 && isiBeli > 0 && takaranPerPcs > 0) yieldPcs = isiBeli / takaranPerPcs;
      if (yieldPcs <= 0) { pushNotif("Isi: dari 1 kemasan ini jadi berapa pcs donat?", "warning"); return; }
      if (isiBeli > 0 && yieldPcs > 0) takaranPerPcs = isiBeli / yieldPcs;
      const hppPerPcs = getBahanHppPerPcs({ hargaBeli, isiBeli, takaranPerPcs, kapasitas: yieldPcs });
      const row = {
        nama: nB.nama,
        hargaBeli,
        isiBeli: isiBeli || null,
        satuanStok: nB.satuanStok || "gram",
        takaranPerPcs: takaranPerPcs || null,
        kapasitas: yieldPcs,
        satuanBeli: nB.satuanBeli || "",
        satuan: nB.satuanBeli || nB.satuanStok || "gram",
        hppPerPcs: roundHppRp(hppPerPcs)
      };
      if (nB.editId) {
        const u = bahan.map((x) => x.id === nB.editId ? { ...x, ...row } : x);
        S.set("bahanPokok", u); setBahan(u);
        setNB({ nama: "", hargaBeli: "", isiBeli: "", satuanStok: "gram", takaranPerPcs: "", kapasitas: "", satuanBeli: "" });
        pushNotif("Bahan diperbarui! HPP/pcs = " + fmtRp(row.hppPerPcs), "success");
        return;
      }
      const u = [...bahan, { id: uid(), ...row }];
      S.set("bahanPokok", u); setBahan(u);
      setNB({ nama: "", hargaBeli: "", isiBeli: "", satuanStok: "gram", takaranPerPcs: "", kapasitas: "", satuanBeli: "" });
      pushNotif("Bahan ditambah! HPP/pcs = " + fmtRp(row.hppPerPcs), "success");
    };
    const editB = (b) => { setNB({ editId: b.id, nama: b.nama, hargaBeli: String(b.hargaBeli), isiBeli: b.isiBeli != null ? String(b.isiBeli) : "", satuanStok: b.satuanStok || "gram", takaranPerPcs: b.takaranPerPcs != null ? String(b.takaranPerPcs) : "", kapasitas: String(b.kapasitas || ""), satuanBeli: b.satuanBeli || "" }); };

    const delB = (id) => { const u = bahan.filter((x) => x.id !== id); S.set("bahanPokok", u); setBahan(u); pushNotif("Bahan dihapus.", "warning"); };
    const askDelB = (b) => confirmAsk({ title: "Hapus Bahan", message: `Yakin hapus "${b.nama}"?`, onConfirm: () => delB(b.id) });

    const saveMenu = (m) => {
      const all = S.get("menuVarian") || [];
      const savedId = m.id || uid();
      const row = { ...m, id: savedId, resepToping: [] };
      const u = all.find((x) => x.id === m.id) ? all.map((x) => x.id === m.id ? row : x) : [...all, row];
      S.set("menuVarian", u);
      const satuan = u.filter((x) => x.tipe !== "paket");
      setMenus(satuan);
      // Auto buka menu tanpa resep berikutnya (alur "isi satu per satu")
      const nextMissing = satuan.find((x) => x.id !== savedId && !(x.resepBahanPokok && x.resepBahanPokok.length));
      const selfStillMissing = !(row.resepBahanPokok && row.resepBahanPokok.length);
      if (!selfStillMissing && nextMissing) {
        setEditMenu({ ...nextMissing });
        pushNotif("Tersimpan! Lanjut isi resep: " + nextMissing.nama, "success");
      } else if (selfStillMissing) {
        setEditMenu(null);
        pushNotif("Menu disimpan, tapi resep masih kosong.", "warning");
      } else {
        setEditMenu(null);
        pushNotif(nextMissing ? "Menu disimpan!" : "Menu disimpan! Semua menu sudah ber-resep.", "success");
      }
    };

    const delMenu = (id) => { const u = (S.get("menuVarian") || []).filter((x) => x.id !== id); S.set("menuVarian", u); setMenus(u.filter((x) => x.tipe !== "paket")); pushNotif("Menu dihapus.", "warning"); };
    const askDelMenu = (m) => confirmAsk({ title: "Hapus Menu", message: `Yakin hapus menu "${m.nama}"?`, onConfirm: () => delMenu(m.id) });

    const saveT = () => {
      if (!nT.nama || !nT.hargaBeli) { pushNotif("Isi nama dan harga beli!", "warning"); return; }
      const hargaBeli = parseFloat(nT.hargaBeli) || 0;
      const isiPerBeli = parseFloat(nT.isiPerBeli) || 0;
      // Cara warung: "1 kemasan cukup untuk berapa donat?" (kapasitas pcs)
      let kapasitas = parseFloat(nT.kapasitas) || 0;
      let porsiPerPcs = parseFloat(nT.porsiPerPcs) || 0;
      if (kapasitas <= 0 && isiPerBeli > 0 && porsiPerPcs > 0) kapasitas = isiPerBeli / porsiPerPcs;
      if (kapasitas <= 0) { pushNotif("Isi: 1 kemasan ini cukup untuk berapa pcs donat?", "warning"); return; }
      if (isiPerBeli > 0 && kapasitas > 0) porsiPerPcs = isiPerBeli / kapasitas;
      const hargaPerSatuan = isiPerBeli > 0 ? (hargaBeli / isiPerBeli) : (kapasitas > 0 ? hargaBeli / kapasitas : null);
      const hargaJual = nT.jenis === "glaze" ? 0 : (parseFloat(nT.hargaJual) || 0);
      if (nT.jenis === "topping" && !nT.hargaJual && hargaJual === 0) {
        /* boleh 0 tapi ingatkan */
      }
      const fields = {
        nama: nT.nama,
        hargaBeli,
        kapasitas,
        hargaJual,
        satuanStok: nT.satuanStok || "gram",
        isiPerBeli: isiPerBeli || null,
        hargaPerSatuan,
        jenis: nT.jenis || "topping",
        porsiPerPcs: porsiPerPcs || null
      };
      const hppShow = roundHppRp(hargaBeli / kapasitas);
      if (nT.editId) {
        const u = topings.map((x) => x.id === nT.editId ? { ...x, ...fields } : x);
        S.set("topingTambahan", u); setTopings(u);
        setNT({ nama: "", hargaBeli: "", kapasitas: "", hargaJual: "", satuanStok: "gram", isiPerBeli: "", jenis: nT.jenis || "topping", porsiPerPcs: "" });
        pushNotif((fields.jenis === "glaze" ? "Glaze" : "Toping") + " diperbarui! HPP/pcs = " + fmtRp(hppShow), "success");
        return;
      }
      const u = [...topings, { id: uid(), ...fields }];
      S.set("topingTambahan", u); setTopings(u);
      setNT({ nama: "", hargaBeli: "", kapasitas: "", hargaJual: "", satuanStok: "gram", isiPerBeli: "", jenis: nT.jenis || "topping", porsiPerPcs: "" });
      pushNotif((fields.jenis === "glaze" ? "Glaze" : "Toping") + " ditambah! HPP/pcs = " + fmtRp(hppShow), "success");
    };

    const delT = (id) => { const u = topings.filter((x) => x.id !== id); S.set("topingTambahan", u); setTopings(u); pushNotif("Toping dihapus.", "warning"); };
    const askDelT = (t) => confirmAsk({ title: "Hapus Toping", message: `Yakin hapus "${t.nama}"? Cek dulu apakah masih dipakai.`, onConfirm: () => delT(t.id) });
    const editT = (t) => setNT({ editId: t.id, nama: t.nama, hargaBeli: String(t.hargaBeli), kapasitas: String(t.kapasitas), hargaJual: String(t.hargaJual), satuanStok: t.satuanStok || "gram", isiPerBeli: t.isiPerBeli != null ? String(t.isiPerBeli) : "", jenis: t.jenis || "topping", porsiPerPcs: t.porsiPerPcs != null ? String(t.porsiPerPcs) : "" });

    const savePreset = async () => {
      if (!presetForm.nama || !presetForm.glazeId || !presetForm.toppingId) {
        pushNotif("Isi nama preset, glaze, dan topping.", "warning"); return;
      }
      const row = { id: presetForm.id || uid(), nama: presetForm.nama.trim(), glazeId: presetForm.glazeId, toppingId: presetForm.toppingId, updatedAt: nowIso() };
      const next = presetForm.id ? presets.map((p) => p.id === row.id ? row : p) : [...presets, row];
      try {
        const { error } = await sb.from("app_settings").upsert({ key: "preset_rasa", value: next });
        if (error) throw error;
        setPresets(next);
        setPresetForm({ id: null, nama: "", glazeId: "", toppingId: "" });
        pushNotif("Preset rasa disimpan.", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
    };
    const editPreset = (p) => setPresetForm({ id: p.id, nama: p.nama, glazeId: p.glazeId, toppingId: p.toppingId });
    const deletePreset = async (p) => {
      const next = presets.filter((x) => x.id !== p.id);
      try {
        const { error } = await sb.from("app_settings").upsert({ key: "preset_rasa", value: next });
        if (error) throw error;
        setPresets(next); pushNotif("Preset rasa dihapus.", "warning");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
    };

    const SUB_TABS = ["bahan", "menu", "toping"];
    const SUB_LABEL = { bahan: "Bahan Dasar Donat", menu: "Menu & Box", preset: "Preset Rasa", toping: "Glaze & Topping" };

    return React.createElement("div", null,
      React.createElement("div", { className: "info-txt", style: { marginBottom: 8 } }, "Urutan setup: 1) Bahan Dasar Donat dan takaran fisik → 2) Glaze & Topping → 3) Menu & Box. Glaze/topping dipilih bebas di kasir, bukan resep tetap menu."),
      React.createElement("div", { className: "tabs tabs-sm" },
        SUB_TABS.map((t) => React.createElement("button", { key: t, className: "tab" + (sub === t ? " active" : ""), onClick: () => setSub(t) }, SUB_LABEL[t]))
      ),

      // ── Sub: Bahan Pokok ──
      sub === "bahan" && React.createElement("div", null,
        React.createElement("h3", { className: "section-title mt8" }, "Bahan Dasar Donat"),
        React.createElement("p", { className: "info-txt" }, "Cara isi gampang: harga beli kemasan + dari kemasan itu jadi berapa pcs donat. App hitung HPP/pcs (dan gram/pcs bila isi kemasan diisi)."),
        React.createElement("table", { className: "tbl mt8" },
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", null, "Nama Bahan"),
              React.createElement("th", null, "Harga Beli Total"),
              React.createElement("th", null, "Kapasitas (pcs)"),
              React.createElement("th", null, "HPP/pcs"),
              React.createElement("th", null)
            )
          ),
          React.createElement("tbody", null,
            bahan.map((b) =>
              React.createElement("tr", { key: b.id },
                React.createElement("td", null, b.nama, b.satuanBeli ? React.createElement("span", { style: { fontSize: 11, color: "var(--text2)", marginLeft: 4 } }, "(", b.satuanBeli, ")") : null),
                React.createElement("td", null, fmtRp(b.hargaBeli)),
                React.createElement("td", null, b.kapasitas, " pcs"),
                React.createElement("td", { style: { color: "var(--accent)", fontWeight: 700 } }, fmtRp(getBahanHppPerPcs(b, { rounded: true }))),
                React.createElement("td", { className: "row-actions-cell" }, React.createElement(RowMenu, { actions: [{ label: "Edit", onClick: () => editB(b) }, { label: "Hapus", danger: true, onClick: () => askDelB(b) }] }))
              )
            )
          )
        ),
        React.createElement("div", { className: "form-card mt8", style: nB.editId ? { borderColor: "var(--accent)" } : null },
          React.createElement("h4", null, nB.editId ? "\u270F\uFE0F Edit Bahan Baku" : "Tambah Bahan Baku"),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Nama Bahan & Ukuran Beli"),
            React.createElement("input", { className: "inp", placeholder: "Contoh: Tepung 1kg, Kentang 2kg", value: nB.nama, onChange: (e) => setNB((x) => ({ ...x, nama: e.target.value })) })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Harga Beli Total (Rp)"),
            React.createElement("input", { className: "inp", type: "number", placeholder: "Contoh: 10000", value: nB.hargaBeli, onChange: (e) => setNB((x) => ({ ...x, hargaBeli: e.target.value })) })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Dari 1 kemasan ini jadi berapa pcs donat?"),
            React.createElement("input", { className: "inp", type: "number", min: "1", step: "1", placeholder: "Contoh: 20 (1 kg tepung = 20 donat)", value: nB.kapasitas, onChange: (e) => setNB((x) => ({ ...x, kapasitas: e.target.value })) }),
            React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Ini yang paling penting. Contoh: beli tepung 1 kg, adonan jadi 20 donat → isi 20. App hitung HPP sendiri.")
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Isi kemasan (opsional — biar ketahuan gram/donat)"),
            React.createElement("div", { className: "row-wrap", style: { gap: 8 } },
              React.createElement("input", { className: "inp", type: "number", placeholder: "Contoh: 1000", value: nB.isiBeli, onChange: (e) => setNB((x) => ({ ...x, isiBeli: e.target.value })), style: { flex: 1 } }),
              React.createElement("select", { className: "inp inp-sm", value: nB.satuanStok, onChange: (e) => setNB((x) => ({ ...x, satuanStok: e.target.value })), style: { width: 110 } },
                React.createElement("option", { value: "gram" }, "Gram"),
                React.createElement("option", { value: "ml" }, "ml"),
                React.createElement("option", { value: "pcs" }, "Pcs")
              )
            ),
            React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Opsional. Tepung 1 kg → 1000 gram. Kalau diisi, app tampilkan gram per donat otomatis.")
          ),
          React.createElement("div", {
            className: "hpp-preview",
            style: {
              borderColor: (nB.hargaBeli && nB.kapasitas && Number(nB.kapasitas) > 0) ? "var(--accent)" : "var(--border)",
              background: (nB.hargaBeli && nB.kapasitas && Number(nB.kapasitas) > 0)
                ? "color-mix(in srgb, var(--accent) 14%, var(--bg2))"
                : "var(--bg3)"
            }
          },
            React.createElement("div", { style: { fontWeight: 800, color: "var(--text)", marginBottom: 6, fontSize: 13 } }, "Hasil hitung otomatis"),
            !(nB.hargaBeli && nB.kapasitas && Number(nB.kapasitas) > 0)
              ? React.createElement("div", { style: { fontSize: 12, lineHeight: 1.55 } },
                  "Isi ", React.createElement("strong", null, "harga beli"), " dan ",
                  React.createElement("strong", null, "jadi berapa pcs donat"),
                  ". HPP per donat muncul di sini."
                )
              : React.createElement("div", { style: { fontSize: 13, lineHeight: 1.75 } },
                  React.createElement("div", null, "HPP bahan ini / donat = ",
                    React.createElement("strong", { style: { fontSize: 18 } },
                      fmtRp(roundHppRp(Number(nB.hargaBeli) / Number(nB.kapasitas)))
                    )
                  ),
                  (nB.isiBeli && Number(nB.isiBeli) > 0)
                    ? React.createElement("div", null, "Setara ",
                        React.createElement("strong", null,
                          (Number(nB.isiBeli) / Number(nB.kapasitas)).toFixed(2), " ", (nB.satuanStok || "gram"), " per donat"
                        )
                      )
                    : React.createElement("div", { style: { fontSize: 11, opacity: 0.9 } }, "Isi kemasan (opsional) untuk lihat gram/ml per donat."),
                  React.createElement("div", { style: { fontSize: 11, opacity: 0.85 } }, "Rumus HPP: harga beli ÷ jumlah pcs donat. Ini BIAYA bahan, bukan harga jual.")
                )
          ),
          React.createElement("div", { className: "row-wrap mt8" },
            React.createElement("button", { className: "btn-primary", onClick: saveB }, nB.editId ? "Simpan Perubahan" : "+ Tambah Bahan"),
            nB.editId && React.createElement("button", { className: "btn-secondary", onClick: () => setNB({ nama: "", hargaBeli: "", isiBeli: "", satuanStok: "gram", takaranPerPcs: "", kapasitas: "", satuanBeli: "" }) }, "Batal")
          )
        )
      ),

      // ── Sub: Varian Menu ──
      sub === "menu" && (() => {
        const tanpaResep = menus.filter((m) => !(m.resepBahanPokok && m.resepBahanPokok.length));
        return React.createElement("div", null,
          React.createElement("h3", { className: "section-title mt8" }, "Daftar menu"),
          tanpaResep.length > 0 && React.createElement("div", { id: "resep-missing-panel", className: "alert-banner alert-banner-warn mb8" },
            React.createElement("div", { className: "alert-banner-title" }, "Menu belum ada resep (", tanpaResep.length, ")"),
            React.createElement("div", { className: "alert-banner-item" },
              "Tanpa resep, produksi tidak memotong stok gudang & HPP adonan bisa 0. Isi satu per satu dari tombol di bawah."
            ),
            React.createElement("button", {
              type: "button",
              className: "btn-primary mt8",
              style: { alignSelf: "flex-start" },
              onClick: () => setEditMenu({ ...tanpaResep[0] })
            }, "Isi resep berikutnya: ", tanpaResep[0].nama, " (", tanpaResep.length, " tersisa)"),
            React.createElement("div", { className: "resep-missing-list mt8" },
              tanpaResep.map((m, idx) =>
                React.createElement("div", { key: m.id, className: "resep-missing-row" },
                  React.createElement("span", { className: "resep-missing-name" }, (idx + 1), ". ", m.nama),
                  React.createElement("span", { className: "resep-missing-meta" }, "Jual ", fmtRp(m.hargaJual)),
                  React.createElement("button", {
                    type: "button", className: "btn-primary btn-sm",
                    onClick: () => setEditMenu({ ...m })
                  }, idx === 0 ? "Isi sekarang" : "Edit Resep")
                )
              )
            )
          ),
          menus.length === 0 && React.createElement(EmptyState, {
            icon: "🍩",
            title: "Belum ada menu satuan",
            desc: "Tambah menu dulu, lalu isi resep bahan supaya gudang & HPP jalan otomatis.",
            actionLabel: "+ Tambah Menu",
            onAction: () => setEditMenu({ id: null, nama: "", tipe: "satuan", hargaJual: "", resepBahanPokok: [], resepToping: [] })
          }),
          menus.map((m) => {
            const info = getMenuHPPBreakdown(m);
            const noResep = !(m.resepBahanPokok && m.resepBahanPokok.length);
            return React.createElement("div", {
              key: m.id,
              className: "menu-setting-card" + (noResep ? " menu-setting-card-warn" : "")
            },
              React.createElement("div", { className: "menu-setting-row" },
                React.createElement("strong", null, m.nama,
                  noResep && React.createElement("span", { className: "badge-warn", style: { marginLeft: 8 } }, "Tanpa resep")
                ),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                  React.createElement("span", null, "Jual: ", fmtRp(m.hargaJual)),
                  noResep && React.createElement("button", {
                    type: "button", className: "btn-primary btn-sm",
                    onClick: () => setEditMenu({ ...m })
                  }, "Isi Resep"),
                  React.createElement(RowMenu, { actions: [
                    { label: "Edit", onClick: () => setEditMenu({ ...m }) },
                    { label: "Hapus", danger: true, onClick: () => askDelMenu(m) }
                  ] })
                )
              ),
              React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginTop: 2 } },
                noResep
                  ? "Resep bahan masih kosong — stok gudang tidak terpotong saat produksi."
                  : React.createElement(React.Fragment, null,
                      "HPP Adonan: ", fmtRp(info.hppAdonanPerPcs),
                      " + Toping: ", fmtRp(info.hppTopingPerPcs),
                      " = HPP: ", React.createElement("strong", { style: { color: "var(--accent)" } }, fmtRp(info.hppSatuanPerPcs)),
                      " | Omzet Kotor: ", React.createElement("strong", { style: { color: "var(--green)" } }, fmtRp(info.omzetKotorPerPcs))
                    )
              )
            );
          }),
          React.createElement("button", { className: "btn-primary mt8", onClick: () => setEditMenu({ id: null, nama: "", tipe: "satuan", hargaJual: "", resepBahanPokok: [], resepToping: [] }) }, "+ Tambah Menu"),
          editMenu && React.createElement(EditMenuModal, { menu: editMenu, bahan, onSave: saveMenu, onClose: () => setEditMenu(null) })
        );
      })(),

      // ── Sub: Preset Rasa ──
      sub === "preset" && React.createElement("div", null,
        React.createElement("h3", { className: "section-title mt8" }, "Preset Rasa"),
        React.createElement("p", { className: "info-txt" }, "Preset rasa adalah kombinasi 1 glaze + 1 topping dasar. Preset bukan stok dan bukan produk baru; ini hanya mempercepat pilihan pekerja di kasir."),
        React.createElement("div", { className: "form-card mt8" },
          React.createElement("h4", null, presetForm.id ? "Edit Preset Rasa" : "Tambah Preset Rasa"),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Nama preset"),
            React.createElement("input", { className: "inp", value: presetForm.nama, placeholder: "Contoh: Cokelat Kacang", onChange: (e) => setPresetForm((x) => ({ ...x, nama: e.target.value })) })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Glaze"),
            React.createElement("select", { className: "inp", value: presetForm.glazeId, onChange: (e) => setPresetForm((x) => ({ ...x, glazeId: e.target.value })) },
              React.createElement("option", { value: "" }, "-- Pilih glaze --"),
              topings.filter((t) => t.jenis === "glaze").map((t) => React.createElement("option", { key: t.id, value: t.id }, t.nama))
            )
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Topping dasar"),
            React.createElement("select", { className: "inp", value: presetForm.toppingId, onChange: (e) => setPresetForm((x) => ({ ...x, toppingId: e.target.value })) },
              React.createElement("option", { value: "" }, "-- Pilih topping --"),
              topings.filter((t) => t.jenis !== "glaze").map((t) => React.createElement("option", { key: t.id, value: t.id }, t.nama))
            )
          ),
          React.createElement("div", { className: "row-wrap" },
            React.createElement("button", { className: "btn-primary", onClick: savePreset }, presetForm.id ? "Simpan Perubahan" : "Simpan Preset"),
            presetForm.id && React.createElement("button", { className: "btn-secondary", onClick: () => setPresetForm({ id: null, nama: "", glazeId: "", toppingId: "" }) }, "Batal")
          )
        ),
        presets.length === 0
          ? React.createElement(EmptyState, { icon: "✨", title: "Belum ada preset rasa", desc: "Buat preset seperti Cokelat Kacang agar kasir bisa memilih rasa dengan cepat." })
          : presets.map((p) => {
              const g = topings.find((t) => t.id === p.glazeId);
              const t = topings.find((x) => x.id === p.toppingId);
              return React.createElement("div", { key: p.id, className: "menu-setting-card" },
                React.createElement("div", { className: "menu-setting-row" },
                  React.createElement("strong", null, p.nama),
                  React.createElement(RowMenu, { actions: [{ label: "Edit", onClick: () => editPreset(p) }, { label: "Hapus", danger: true, onClick: () => deletePreset(p) }] })
                ),
                React.createElement("div", { className: "info-txt mt8" }, "Glaze: ", g?.nama || "-", " · Topping: ", t?.nama || "-")
              );
            })
      ),

      // ── Sub: Glaze & Topping ──
      sub === "toping" && React.createElement("div", null,
        React.createElement("h3", { className: "section-title mt8" }, "Topping"),
        React.createElement("p", { className: "info-txt" }, "Cara gampang: harga beli kemasan + kemasan itu cukup untuk berapa donat. App hitung HPP/pcs. Isi gram opsional."),
        React.createElement("table", { className: "tbl mt8" },
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", null, "Nama"),
              React.createElement("th", null, "Harga Beli"),
              React.createElement("th", null, "Kapasitas"),
              React.createElement("th", null, "HPP/pcs"),
              React.createElement("th", null, "Harga Jual"),
              React.createElement("th", null)
            )
          ),
          React.createElement("tbody", null,
            topings.map((t) =>
              React.createElement("tr", { key: t.id },
                React.createElement("td", null, t.nama),
                React.createElement("td", null, fmtRp(t.hargaBeli)),
                React.createElement("td", null, t.kapasitas, " pcs"),
                React.createElement("td", { style: { color: "var(--accent)", fontWeight: 700 } }, fmtRp(roundHppRp(t.hargaPerSatuan != null && t.porsiPerPcs ? Number(t.hargaPerSatuan) * Number(t.porsiPerPcs) : (Number(t.hargaBeli || 0) / Math.max(Number(t.kapasitas || 1), 1))))),
                React.createElement("td", null, fmtRp(t.hargaJual)),
                React.createElement("td", { className: "row-actions-cell" }, React.createElement(RowMenu, { actions: [{ label: "Edit", onClick: () => editT(t) }, { label: "Hapus", danger: true, onClick: () => askDelT(t) }] }))
              )
            )
          )
        ),
        React.createElement("div", { className: "form-card mt8", style: nT.editId ? { borderColor: "var(--accent)" } : null },
          React.createElement("h4", null, nT.editId ? "\u270F\uFE0F Edit Toping / Glaze" : "Tambah Toping / Glaze"),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Jenis"),
            React.createElement("div", { className: "diskon-methods" },
              [
                { id: "glaze", label: "\uD83E\uDED4 Glaze (dipilih kasir)" },
                { id: "topping", label: "\u2728 Toping tambahan" }
              ].map((j) => React.createElement("button", {
                key: j.id, type: "button",
                className: "diskon-method" + (nT.jenis === j.id ? " active" : ""),
                onClick: () => setNT((x) => ({ ...x, jenis: j.id }))
              }, j.label))
            ),
            React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, nT.jenis === "glaze"
              ? "Glaze = lapisan dasar yang pelanggan pilih di kasir (coklat/greentea/dll). Harga donat tetap flat."
              : "Toping tambahan = ekstra opsional yang pelanggan minta (kena biaya tambahan).")
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, nT.jenis === "glaze" ? "Nama glaze" : "Nama toping"),
            React.createElement("input", { className: "inp", placeholder: nT.jenis === "glaze" ? "Contoh: Coklat" : "Contoh: Meses / Keju", value: nT.nama, onChange: (e) => setNT((x) => ({ ...x, nama: e.target.value })) })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Harga beli 1 kemasan (Rp)"),
            React.createElement("input", { className: "inp", type: "number", placeholder: "Contoh: 40000", value: nT.hargaBeli, onChange: (e) => setNT((x) => ({ ...x, hargaBeli: e.target.value })) })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "1 kemasan ini cukup untuk berapa pcs donat?"),
            React.createElement("input", { className: "inp", type: "number", min: "1", step: "1", placeholder: "Contoh: 100 (1 kg glaze ≈ 100 donat)", value: nT.kapasitas, onChange: (e) => setNT((x) => ({ ...x, kapasitas: e.target.value })) }),
            React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Perkiraan dapur saja. App hitung HPP per donat = harga beli ÷ angka ini.")
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Isi kemasan (opsional)"),
            React.createElement("div", { className: "row-wrap", style: { gap: 8 } },
              React.createElement("input", { className: "inp", type: "number", placeholder: "Contoh: 1000", value: nT.isiPerBeli, onChange: (e) => setNT((x) => ({ ...x, isiPerBeli: e.target.value })), style: { flex: 1 } }),
              React.createElement("select", { className: "inp inp-sm", value: nT.satuanStok, onChange: (e) => setNT((x) => ({ ...x, satuanStok: e.target.value })), style: { width: 120 } },
                React.createElement("option", { value: "gram" }, "Gram"),
                React.createElement("option", { value: "ml" }, "ml"),
                React.createElement("option", { value: "pcs" }, "Pcs")
              )
            ),
            React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Opsional. 1 kg → 1000 gram. Supaya app bisa tampilkan gram per donat.")
          ),
          nT.jenis === "topping" && React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Harga jual ke pembeli (Rp) — hanya toping tambahan"),
            React.createElement("input", { className: "inp", type: "number", placeholder: "Contoh: 2000 (biaya ekstra di kasir)", value: nT.hargaJual, onChange: (e) => setNT((x) => ({ ...x, hargaJual: e.target.value })) }),
            React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Glaze biasanya gratis (harga donat sudah flat). Toping ekstra bisa dikenai biaya.")
          ),
          React.createElement("div", {
            className: "hpp-preview",
            style: {
              borderColor: (nT.hargaBeli && nT.kapasitas && Number(nT.kapasitas) > 0) ? "var(--accent)" : "var(--border)",
              background: (nT.hargaBeli && nT.kapasitas && Number(nT.kapasitas) > 0)
                ? "color-mix(in srgb, var(--accent) 14%, var(--bg2))"
                : "var(--bg3)"
            }
          },
            React.createElement("div", { style: { fontWeight: 800, color: "var(--text)", marginBottom: 6, fontSize: 13 } }, "Hasil hitung otomatis"),
            !(nT.hargaBeli && nT.kapasitas && Number(nT.kapasitas) > 0)
              ? React.createElement("div", { style: { fontSize: 12, lineHeight: 1.55 } },
                  "Isi harga beli + berapa pcs donat per kemasan. HPP muncul di sini."
                )
              : React.createElement("div", { style: { fontSize: 13, lineHeight: 1.75 } },
                  React.createElement("div", null, "HPP / donat = ",
                    React.createElement("strong", { style: { fontSize: 18 } },
                      fmtRp(roundHppRp(Number(nT.hargaBeli) / Number(nT.kapasitas)))
                    )
                  ),
                  (nT.isiPerBeli && Number(nT.isiPerBeli) > 0)
                    ? React.createElement("div", null, "Setara ",
                        React.createElement("strong", null,
                          (Number(nT.isiPerBeli) / Number(nT.kapasitas)).toFixed(2), " ", (nT.satuanStok || "gram"), " per donat"
                        )
                      )
                    : null,
                  React.createElement("div", { style: { fontSize: 11, opacity: 0.85 } },
                    nT.jenis === "glaze"
                      ? "Glaze: biaya modal saja (biasanya tidak ditambah di kasir)."
                      : "Toping: HPP = modal; harga jual = yang dibayar pembeli kalau pilih ekstra."
                  )
                )
          ),
          React.createElement("div", { className: "row-wrap mt8" },
            React.createElement("button", { className: "btn-primary", onClick: saveT }, nT.editId ? "Simpan Perubahan" : (nT.jenis === "glaze" ? "+ Tambah Glaze" : "+ Tambah Toping")),
            nT.editId && React.createElement("button", { className: "btn-secondary", onClick: () => setNT({ nama: "", hargaBeli: "", kapasitas: "", hargaJual: "", satuanStok: "gram", isiPerBeli: "", jenis: "topping", porsiPerPcs: "" }) }, "Batal")
          )
        )
      ),
      confirmModal
    );
  }

  // ─── SettingPaket ──────────────────────────────────────────────────────────
  function SettingPaket({ pushNotif }) {
    const tick = useStoreTick();
    const [pakets, setPakets] = useState(() => (S.get("menuVarian") || []).filter((m) => m.tipe === "paket"));
    const [bahan] = useState(() => S.get("bahanPokok") || []);
    const [editP, setEditP] = useState(null);
    const [confirmAsk, confirmModal] = useConfirm();

    useEffect(() => { setPakets((S.get("menuVarian") || []).filter((m) => m.tipe === "paket")); }, [tick]);

    const save = (m) => {
      const all = S.get("menuVarian") || [];
      const u = all.find((x) => x.id === m.id) ? all.map((x) => x.id === m.id ? m : x) : [...all, { ...m, id: uid() }];
      S.set("menuVarian", u); setPakets(u.filter((x) => x.tipe === "paket"));
      setEditP(null); pushNotif("Box disimpan!", "success");
    };

    const del = (id) => { const u = (S.get("menuVarian") || []).filter((x) => x.id !== id); S.set("menuVarian", u); setPakets(u.filter((x) => x.tipe === "paket")); pushNotif("Box dihapus.", "warning"); };
    const askDel = (p) => confirmAsk({ title: "Hapus Box", message: `Yakin hapus box "${p.nama}"?`, onConfirm: () => del(p.id) });

    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Isi box"),
      React.createElement("p", { className: "info-txt" }, "HPP Paket = (HPP menu satuan × isi box) + harga kardus."),
      pakets.map((p) => {
        const info = getMenuHPPBreakdown(p);
        return React.createElement("div", { key: p.id, className: "menu-setting-card" },
          React.createElement("div", { className: "menu-setting-row" },
            React.createElement("strong", null, p.nama),
            React.createElement("span", { className: "badge-paket" }, "Isi ", p.isiBox, " pcs"),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
              React.createElement("span", null, "Jual: ", fmtRp(p.hargaJual)),
              React.createElement(RowMenu, { actions: [
                { label: "Edit", onClick: () => setEditP({ ...p }) },
                { label: "Hapus", danger: true, onClick: () => askDel(p) }
              ] })
            )
          ),
          React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginTop: 2 } },
            "HPP satuan: ", fmtRp(info.hppSatuanPerPcs),
            " × ", p.isiBox, " + Kardus: ", fmtRp(info.boxCost),
            " = HPP Paket: ", React.createElement("strong", { style: { color: "var(--accent)" } }, fmtRp(info.hppPaket)),
            " | Margin: ", React.createElement("strong", { style: { color: "var(--green)" } }, fmtRp(info.marginPaket))
          )
        );
      }),
      React.createElement("button", { className: "btn-primary mt8", onClick: () => setEditP({ id: null, nama: "", tipe: "paket", isiBox: 3, hargaJual: "", boxCost: 0, resepBahanPokok: [], resepToping: [] }) }, "+ Tambah Box"),
      editP && React.createElement(EditMenuModal, { menu: editP, bahan, isPaket: true, menuSatuanList: (S.get("menuVarian") || []).filter((m) => m.tipe !== "paket"), onSave: save, onClose: () => setEditP(null) }),
      confirmModal
    );
  }

  // ─── SettingCabang ─────────────────────────────────────────────────────────
  function SettingCabang({ pushNotif }) {
    const [branches, setBranches] = useState(() => S.get("branches") || []);
    const investors = S.get("investors") || [];
    const [form, setForm] = useState({ nama: "", type: "mandiri", investorId: "", workers: "", city: "" });
    const [editB, setEditB] = useState(null);
    const [confirmAsk, confirmModal] = useConfirm();

    const add = () => {
      if (!form.nama) return;
      const wArr = form.workers.split(",").map((s) => s.trim()).filter(Boolean);
      const u = [...branches, { id: uid(), name: form.nama, type: form.type, investorId: form.type === "investasi" ? form.investorId : null, workers: wArr, city: (form.city || "").trim() || null }];
      S.set("branches", u); setBranches(u);
      setForm({ nama: "", type: "mandiri", investorId: "", workers: "", city: "" });
      pushNotif("Cabang ditambahkan!", "success");
    };

    const saveEdit = () => {
      const wArr = editB.ws.split(",").map((s) => s.trim()).filter(Boolean);
      const u = branches.map((b) => b.id === editB.id ? { ...b, name: editB.name, workers: wArr, type: editB.type, investorId: editB.type === "investasi" ? editB.investorId : null, city: (editB.city || "").trim() || null } : b);
      S.set("branches", u); setBranches(u); setEditB(null);
      pushNotif("Cabang diperbarui!", "success");
    };

    const del = (id) => { const u = branches.filter((x) => x.id !== id); S.set("branches", u); setBranches(u); pushNotif("Cabang dihapus.", "warning"); };
    const askDel = (b) => confirmAsk({ title: "Hapus Cabang", message: `Yakin hapus cabang "${b.name}"? Data terkait cabang ini tidak ikut terhapus.`, onConfirm: () => del(b.id) });

    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Kelola Cabang"),
      branches.map((b) =>
        React.createElement("div", { key: b.id, className: "branch-row" },
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("strong", null, b.name), " ",
            React.createElement("span", { className: "badge-type " + b.type }, b.type),
            b.city ? React.createElement("span", { className: "badge-branch", style: { marginLeft: 6 } }, "📍 ", b.city) : null,
            b.workers?.length > 0 && React.createElement("div", { className: "branch-workers" }, b.workers.join(", ")),
            b.type === "investasi" && React.createElement("div", { style: { fontSize: 12, color: "var(--text2)" } }, "Investor: ", investors.find((i) => i.id === b.investorId)?.nama || "-")
          ),
          React.createElement(RowMenu, { actions: [
            { label: "Edit", onClick: () => setEditB({ ...b, ws: (b.workers || []).join(", "), city: b.city || "" }) },
            { label: "Hapus", danger: true, onClick: () => askDel(b) }
          ] })
        )
      ),
      editB && React.createElement(Modal, { title: "Edit Cabang", onClose: () => setEditB(null) },
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Nama Cabang"), React.createElement("input", { className: "inp", value: editB.name, onChange: (e) => setEditB((x) => ({ ...x, name: e.target.value })) })),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Kota / Area"), React.createElement("input", { className: "inp", value: editB.city || "", onChange: (e) => setEditB((x) => ({ ...x, city: e.target.value })), placeholder: "Contoh: Karawang, Bandung, Jakarta" })),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Nama Pekerja (pisah koma)"), React.createElement("input", { className: "inp", value: editB.ws, onChange: (e) => setEditB((x) => ({ ...x, ws: e.target.value })), placeholder: "Andi, Sari, Budi" })),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Tipe"),
          React.createElement("div", { className: "role-tabs" },
            React.createElement("button", { className: "role-tab" + (editB.type === "mandiri" ? " active" : ""), onClick: () => setEditB((x) => ({ ...x, type: "mandiri" })) }, "Mandiri"),
            React.createElement("button", { className: "role-tab" + (editB.type === "investasi" ? " active" : ""), onClick: () => setEditB((x) => ({ ...x, type: "investasi" })) }, "Investasi"),
            React.createElement("button", { className: "role-tab" + (editB.type === "central_kitchen" ? " active" : ""), onClick: () => setEditB((x) => ({ ...x, type: "central_kitchen" })) }, "Dapur pusat (CK)")
          )
        ),
        editB.type === "investasi" && React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Investor"),
          React.createElement("select", { className: "inp", value: editB.investorId, onChange: (e) => setEditB((x) => ({ ...x, investorId: e.target.value })) },
            React.createElement("option", { value: "" }, "-- Pilih --"),
            investors.map((i) => React.createElement("option", { key: i.id, value: i.id }, i.nama, " (", i.persenBagi, "%)"))
          )
        ),
        React.createElement("div", { className: "row-wrap mt8" },
          React.createElement("button", { className: "btn-secondary", onClick: () => setEditB(null) }, "Batal"),
          React.createElement("button", { className: "btn-primary", onClick: saveEdit }, "Simpan")
        )
      ),
      React.createElement("div", { className: "form-card mt12" },
        React.createElement("h4", null, "Tambah Cabang Baru"),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Nama Cabang"), React.createElement("input", { className: "inp", value: form.nama, onChange: (e) => setForm((x) => ({ ...x, nama: e.target.value })) })),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Kota / Area"), React.createElement("input", { className: "inp", value: form.city, onChange: (e) => setForm((x) => ({ ...x, city: e.target.value })), placeholder: "Contoh: Karawang, Bandung, Jakarta" })),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Nama Pekerja (pisah koma)"), React.createElement("input", { className: "inp", value: form.workers, onChange: (e) => setForm((x) => ({ ...x, workers: e.target.value })), placeholder: "Andi, Sari" })),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Tipe"),
          React.createElement("div", { className: "role-tabs" },
            React.createElement("button", { className: "role-tab" + (form.type === "mandiri" ? " active" : ""), onClick: () => setForm((x) => ({ ...x, type: "mandiri" })) }, "Mandiri"),
            React.createElement("button", { className: "role-tab" + (form.type === "investasi" ? " active" : ""), onClick: () => setForm((x) => ({ ...x, type: "investasi" })) }, "Investasi"),
            React.createElement("button", { className: "role-tab" + (form.type === "central_kitchen" ? " active" : ""), onClick: () => setForm((x) => ({ ...x, type: "central_kitchen" })) }, "Dapur pusat (CK)")
          )
        ),
        form.type === "investasi" && React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Investor"),
          React.createElement("select", { className: "inp", value: form.investorId, onChange: (e) => setForm((x) => ({ ...x, investorId: e.target.value })) },
            React.createElement("option", { value: "" }, "-- Pilih --"),
            investors.map((i) => React.createElement("option", { key: i.id, value: i.id }, i.nama, " (", i.persenBagi, "%)"))
          )
        ),
        React.createElement("button", { className: "btn-primary", onClick: add }, "+ Tambah Cabang")
      ),
      confirmModal
    );
  }

  // ─── GajiHistoriEditor — naik/turun gaji dengan tanggal berlaku ───────────
  function GajiHistoriEditor({ profile, pushNotif, actionBusy }) {
    const tick = useStoreTick();
    const userId = profile.user_id;
    const hist = (getGajiHistoriAll()[userId] || []).slice().reverse();
    const aktif = getGajiHarianPadaTanggal(userId, today(), profile.gajiHarian);
    const [rate, setRate] = useState(String(profile.gajiHarian || aktif || ""));
    const [dari, setDari] = useState(today());
    const [note, setNote] = useState("");
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirmAskGH, confirmModalGH] = useConfirm();

    useEffect(() => {
      setRate(String(getGajiHarianPadaTanggal(userId, today(), profile.gajiHarian) || profile.gajiHarian || ""));
    }, [userId, profile.gajiHarian, tick]);

    const simpan = async () => {
      const val = parseFloat(rate);
      if (!Number.isFinite(val) || val < 0) {
        pushNotif("Gaji harian harus angka 0 atau lebih.", "warning");
        return;
      }
      if (!dari || !/^\d{4}-\d{2}-\d{2}$/.test(dari)) {
        pushNotif("Tanggal berlaku tidak valid.", "warning");
        return;
      }
      setBusy(true);
      try {
        const existing = getGajiHistoriAll()[userId] || [];
        const oldProfil = Number(profile.gajiHarian) || 0;
        // Seed tarif lama supaya hari SEBELUM tanggal berlaku tidak ikut tarif baru
        // lewat fallback profil (yang akan di-update ke val).
        if (!existing.length && oldProfil > 0 && dari > "2000-01-01") {
          await appendGajiHistori(userId, {
            dariTanggal: "2000-01-01",
            gajiHarian: oldProfil,
            note: "Tarif awal (seed otomatis dari profil)",
            by: "system"
          });
        } else if (existing.length && dari > existing[0].dariTanggal) {
          // pastikan ada entri yang cover sebelum 'dari'
          const coverBefore = existing.filter((e) => e.dariTanggal < dari);
          if (!coverBefore.length && oldProfil > 0) {
            await appendGajiHistori(userId, {
              dariTanggal: "2000-01-01",
              gajiHarian: oldProfil,
              note: "Tarif awal (seed otomatis)",
              by: "system"
            });
          }
        }
        await appendGajiHistori(userId, {
          dariTanggal: dari,
          gajiHarian: val,
          note: note || (val > oldProfil ? "Kenaikan gaji" : "Perubahan gaji"),
          by: "owner"
        });
        if (dari <= today()) {
          const { error } = await sb.from("profiles").update({ gajiHarian: val }).eq("user_id", userId);
          if (error) throw error;
          await S.loadKey("profiles");
        }
        setNote("");
        pushNotif("Histori gaji disimpan: " + fmtRp(val) + "/hari berlaku " + formatTanggalIndoPendek(dari), "success");
      } catch (e) {
        pushNotif(e?.message || String(e), "warning");
      } finally {
        setBusy(false);
      }
    };

    const doHapusEntri = async (entryId) => {
      try {
        const map = { ...getGajiHistoriAll() };
        map[userId] = (map[userId] || []).filter((e) => e.id !== entryId);
        await saveGajiHistoriToDb(map);
        const aktifBaru = getGajiHarianPadaTanggal(userId, today(), 0);
        await sb.from("profiles").update({ gajiHarian: aktifBaru }).eq("user_id", userId);
        await S.loadKey("profiles");
        pushNotif("Entri histori dihapus.", "warning");
      } catch (e) {
        pushNotif(e?.message || String(e), "warning");
      }
    };
    const hapusEntri = (entry) => confirmAskGH({ title: "Hapus Histori Gaji", message: "Hapus entri gaji " + fmtRp(entry.gajiHarian || 0) + " (mulai " + (entry.dariTanggal || "?") + ")? Gaji aktif akan dihitung ulang.", danger: true, confirmLabel: "Hapus", onConfirm: () => doHapusEntri(entry.id) });

    return React.createElement("div", { style: { marginTop: 8, width: "100%" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
        React.createElement("span", { style: { fontSize: 12 } }, "Gaji aktif:"),
        React.createElement("strong", { style: { color: "var(--accent)" } }, fmtRp(aktif), "/hari"),
        React.createElement("button", {
          type: "button",
          className: "btn-secondary btn-sm",
          disabled: !!actionBusy || busy,
          onClick: () => setOpen((o) => !o)
        }, open ? "Tutup" : "Ubah / Histori")
      ),
      open && React.createElement("div", { className: "form-card mt8", style: { padding: 10 } },
        React.createElement("p", { className: "info-txt", style: { marginTop: 0 } },
          "Contoh: 50rb sampai 31 Mei, naik 60rb mulai 1 Juni → isi 60000 & tanggal 1 Juni. Hari sebelum 1 Juni tetap 50rb."
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Gaji harian baru (Rp)"),
          React.createElement("input", {
            type: "number", className: "inp inp-sm", min: "0",
            value: rate, onChange: (e) => setRate(e.target.value)
          })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Berlaku mulai tanggal"),
          React.createElement("input", {
            type: "date", className: "inp inp-sm",
            value: dari, onChange: (e) => setDari(e.target.value)
          })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Catatan (opsional)"),
          React.createElement("input", {
            className: "inp inp-sm",
            value: note, onChange: (e) => setNote(e.target.value),
            placeholder: "Kenaikan rutin / penyesuaian..."
          })
        ),
        React.createElement("button", {
          className: "btn-primary btn-sm",
          disabled: busy,
          onClick: simpan
        }, busy ? "Menyimpan..." : "Simpan Histori Gaji"),
        React.createElement("h4", { style: { margin: "12px 0 6px", fontSize: 13 } }, "Riwayat tarif"),
        hist.length === 0 && React.createElement(EmptyState, {
          icon: "💸",
          title: "Belum ada histori gaji",
          desc: "Sekarang memakai gaji profil: " + fmtRp(profile.gajiHarian || 0) + ". Simpan histori untuk catat tarif per tanggal (mis. naik 50rb→60rb)."
        }),
        hist.map((e) =>
          React.createElement("div", {
            key: e.id,
            style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "4px 0", borderBottom: "1px solid #2a2a2e", alignItems: "center" }
          },
            React.createElement("span", null,
              "Mulai ", formatTanggalIndoPendek(e.dariTanggal), ": ",
              React.createElement("strong", null, fmtRp(e.gajiHarian), "/hari"),
              e.note ? React.createElement("span", { style: { color: "var(--text2)" } }, " — ", e.note) : null
            ),
            React.createElement("button", {
              className: "btn-danger-sm",
              onClick: () => hapusEntri(e)
            }, "X")
          )
        )
      ),
      confirmModalGH
    );
  }

  // ─── SettingAkun ───────────────────────────────────────────────────────────
function SettingAkun({ pushNotif }) {
  const tick = useStoreTick();
  const branches = S.get("branches") || [];
  const investors = S.get("investors") || [];
  const profiles = useMemo(
    () => ((S.get("profiles") || []).filter(isActiveProfile)).slice().sort((a, b) => {
      const aName = String(a.display_name || a.displayName || a.email || "").toLowerCase();
      const bName = String(b.display_name || b.displayName || b.email || "").toLowerCase();
      return aName.localeCompare(bName, "id");
    }),
    [tick]
  );
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [actionBusy, setActionBusy] = useState("");
  const [jadwalLibur, setJadwalLibur] = useState(() => S.get("jadwalLibur") || {});
  const [areaOptions, setAreaOptions] = useState([]);
  const [form, setForm] = useState({ role: "worker", email: "", password: "", displayName: "", branchId: branches[0]?.id || "", investorId: investors[0]?.id || "", gajiHarian: "", cities: "", areaId: "" });
  const cityOptions = useMemo(() => [...new Set((branches || []).map((b) => b.city).filter(Boolean))].sort(), [branches]);
  const [confirmAsk, confirmModal] = useConfirm();

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      branchId: branches.some((b) => b.id === prev.branchId) ? prev.branchId : (branches[0]?.id || ""),
      investorId: investors.some((i) => i.id === prev.investorId) ? prev.investorId : (investors[0]?.id || ""),
    }));
    setJadwalLibur(S.get("jadwalLibur") || {});
  }, [tick, branches, investors]);

  useEffect(() => {
    sb.from("operational_areas").select("id,name").eq("active", true).order("name")
      .then(({ data }) => setAreaOptions(data || [])).catch(() => setAreaOptions([]));
  }, [tick]);

  const refreshInvites = async () => {
    setLoading(true);
    try {
      const { data, error } = await sb.from("invites").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setInvites((data || []).slice().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))));
    } catch (e) {
      pushNotif(e?.message || String(e), "warning");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshInvites(); }, []);

  const reloadAccountData = async () => {
    await Promise.all([
      refreshInvites(),
      S.loadKey("profiles").catch((e) => pushNotif(e?.message || String(e), "warning"))
    ]);
  };

  const setRoleForm = (role) => {
    setForm((prev) => ({
      ...prev,
      role,
      branchId: role === "worker" ? (prev.branchId || branches[0]?.id || "") : "",
      investorId: role === "investor" ? (prev.investorId || investors[0]?.id || "") : "",
      gajiHarian: role === "worker" ? prev.gajiHarian : "",
      cities: role === "manager" ? prev.cities : "",
      areaId: role === "manager" ? prev.areaId : ""
    }));
    setFormErrors((prev) => ({ ...prev, role: "", branchId: "", investorId: "", gajiHarian: "", cities: "", areaId: "" }));
  };

  const validateForm = useCallback(() => {
    const errors = {};
    const rawEmail = String(form.email || "").trim();
    const rawPassword = String(form.password || "").trim();
    const rawDisplayName = String(form.displayName || "").trim();
    const normalizedEmail = rawEmail.includes("@") ? rawEmail.toLowerCase() : `${rawEmail.toLowerCase()}@evoradonuts.local`;

    if (!rawEmail) errors.email = "Username / email wajib diisi.";
    else if (/\s/.test(rawEmail)) errors.email = "Username / email tidak boleh mengandung spasi.";
    else if (!rawEmail.includes("@") && rawEmail.length < 3) errors.email = "Username minimal 3 karakter.";
    else if (profiles.some((p) => String(p.email || "").toLowerCase() === normalizedEmail)) errors.email = "Email / username ini sudah terdaftar.";

    if (!rawPassword) errors.password = "Kata sandi wajib diisi.";
    else if (rawPassword.length < 8) errors.password = "Minimal 8 karakter agar lebih aman.";

    if (rawDisplayName.length > 80) errors.displayName = "Nama tampilan terlalu panjang.";

    if (!["worker", "investor", "owner", "manager", "distribusi"].includes(form.role)) errors.role = "Role akun tidak valid.";

    if (form.role === "manager") {
      // areaId manager opsional saat buat akun — bisa di-assign lewat Area Operasional nanti.
      // if (!form.areaId) errors.areaId = "Pilih Area Operasional untuk Manager.";
    }

    if (form.role === "worker") {
      if (!form.branchId) errors.branchId = "Cabang wajib dipilih untuk pekerja.";
      else if (!branches.some((b) => b.id === form.branchId)) errors.branchId = "Cabang yang dipilih tidak ditemukan.";
      if (form.gajiHarian !== "" && form.gajiHarian !== null) {
        const gaji = Number(form.gajiHarian);
        if (!Number.isFinite(gaji) || gaji < 0) errors.gajiHarian = "Gaji harian harus angka 0 atau lebih.";
      }
    }

    if (form.role === "investor") {
      if (!form.investorId) errors.investorId = "Investor wajib dipilih.";
      else if (!investors.some((i) => i.id === form.investorId)) errors.investorId = "Investor yang dipilih tidak ditemukan.";
    }

    return {
      errors,
      normalizedEmail,
      displayName: rawDisplayName,
    };
  }, [form, branches, investors, profiles]);

  const updateLibur = async (userId, hari) => {
    const baru = { ...jadwalLibur };
    if (hari) baru[userId] = hari;
    else delete baru[userId];
    try {
      const saved = await saveJadwalLiburToDb(baru);
      S.set("jadwalLibur", saved);
      setJadwalLibur(saved);
      pushNotif("Jadwal libur diset ke " + (hari || "Tidak Ada"), "success");
    } catch (e) {
      pushNotif(e?.message || String(e), "warning");
    }
  };

  const createInvite = async () => {
    const validation = validateForm();
    setFormErrors(validation.errors);
    if (Object.keys(validation.errors).length > 0) {
      pushNotif("Periksa lagi data akun yang masih belum valid.", "warning");
      return;
    }

    const branchLabel = form.role === "worker"
      ? (branches.find((b) => b.id === form.branchId)?.name || form.branchId)
      : "";
    const investorLabel = form.role === "investor"
      ? (investors.find((i) => i.id === form.investorId)?.nama || form.investorId)
      : "";
    const managerAreaLabel = form.role === "manager" ? (areaOptions.find((a) => a.id === form.areaId)?.name || form.areaId) : "";
    const summary = [
      `Role: ${form.role === "worker" ? "Pekerja" : form.role === "distribusi" ? "Kurir/Distribusi" : form.role === "investor" ? "Investor" : form.role === "manager" ? "Area Manager (opsional)" : "Owner"}`,
      `Login: ${validation.normalizedEmail}`,
      validation.displayName ? `Nama tampilan: ${validation.displayName}` : null,
      branchLabel ? `Cabang: ${branchLabel}` : null,
      investorLabel ? `Investor: ${investorLabel}` : null,
      managerAreaLabel ? `Area: ${managerAreaLabel}` : null,
      form.role === "worker" && form.gajiHarian !== "" ? `Gaji harian: ${fmtRp(Number(form.gajiHarian) || 0)}` : null,
      "Akun akan langsung aktif setelah berhasil dibuat."
    ].filter(Boolean).join("\n");

    confirmAsk({
      title: "Buat Akun Baru",
      message: summary,
      confirmLabel: "Ya, Buat Akun",
      danger: false,
      onConfirm: async () => {
        setActionBusy("create");
        try {
          const { data: sessData } = await sb.auth.getSession();
          const token = sessData?.session?.access_token;
          if (!token) throw new Error("Owner harus login dulu.");
          const resp = await fetch("/api/create-user", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              emailOrUsername: validation.normalizedEmail,
              password: String(form.password || "").trim(),
              role: form.role === "manager" ? "manager" : form.role,
              displayName: validation.displayName || null,
              branchId: form.role === "worker" ? form.branchId : null,
              investorId: form.role === "investor" ? form.investorId : null,
              gajiHarian: form.role === "worker" && form.gajiHarian !== "" ? Number(form.gajiHarian) : null,
              areaId: form.role === "manager" ? form.areaId : null,
              cities: form.role === "manager" ? normalizeCities(form.cities) : null,
              city: form.role === "manager" ? (normalizeCities(form.cities)[0] || null) : null
            })
          });
          const text = await resp.text();
          let json = null;
          try { json = JSON.parse(text); } catch {}
          if (!resp.ok) throw new Error(json?.error || text || "Gagal membuat user.");
          pushNotif("Akun berhasil dibuat dan siap dipakai.", "success");
          setForm({
            role: form.role,
            email: "",
            password: "",
            displayName: "",
            branchId: branches[0]?.id || "",
            investorId: investors[0]?.id || "",
            gajiHarian: "",
            cities: "",
            areaId: ""
          });
          setFormErrors({});
          await reloadAccountData();
        } catch (e) {
          pushNotif(e?.message || String(e), "warning");
          throw e;
        } finally {
          setActionBusy("");
        }
      }
    });
  };

  const deleteInvite = async (id) => {
    try {
      const { error } = await sb.from("invites").delete().eq("id", id);
      if (error) throw error;
      await refreshInvites();
    } catch (e) {
      pushNotif(e?.message || String(e), "warning");
    }
  };

  const askDeleteInvite = (iv) => confirmAsk({
    title: "Hapus Antrean",
    message: `Hapus antrean akun "${iv.email}"?`,
    onConfirm: () => deleteInvite(iv.id)
  });

  // Edit nama tampilan akun (tidak mengubah login/role)
  const editNamaAkun = (p) => confirmAsk({
    title: "Edit Nama Akun",
    message: "Ubah nama tampilan untuk " + (p.email || p.user_id) + ":",
    requireText: true,
    textLabel: "Nama baru",
    textPlaceholder: p.display_name || p.displayName || "",
    confirmLabel: "Simpan",
    onConfirm: async (nm) => {
      const nama = String(nm || "").trim();
      if (!nama) { pushNotif("Nama tidak boleh kosong.", "warning"); return; }
      setActionBusy(p.user_id);
      try {
        const { error } = await sb.from("profiles").update({ display_name: nama }).eq("user_id", p.user_id);
        if (error) throw error;
        await S.loadKey("profiles");
        pushNotif("Nama akun diperbarui.", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); } finally { setActionBusy(null); }
    }
  });

  // Reset password akun (owner) — via serverless /api/reset-password
  const resetPasswordAkun = (p) => confirmAsk({
    title: "Reset Password",
    message: "Buat password baru untuk " + (p.display_name || p.email || p.user_id) + " (min. 6 karakter). Berikan password ini ke pekerja.",
    requireText: true,
    textLabel: "Password baru",
    textPlaceholder: "min. 6 karakter",
    confirmLabel: "Reset",
    danger: false,
    onConfirm: async (pw) => {
      const pass = String(pw || "").trim();
      if (pass.length < 6) { pushNotif("Password minimal 6 karakter.", "warning"); return; }
      setActionBusy(p.user_id);
      try {
        const { data: sessData } = await sb.auth.getSession();
        const token = sessData?.session?.access_token;
        if (!token) throw new Error("Owner harus login dulu.");
        const resp = await fetch("/api/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ userId: p.user_id, password: pass })
        });
        const text = await resp.text();
        let json = null; try { json = JSON.parse(text); } catch {}
        if (!resp.ok) throw new Error(json?.error || text || "Gagal reset password.");
        pushNotif("Password berhasil direset. Beri tahu pekerja password barunya.", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); } finally { setActionBusy(null); }
    }
  });

  const askArchiveAccount = (p) => confirmAsk({
    title: "Nonaktifkan Akun",
    message: [
      `Akun: ${p.display_name || p.displayName || p.email || p.user_id}`,
      `Role: ${p.role}`,
      p.branchId ? `Cabang: ${branches.find((b) => b.id === p.branchId)?.name || p.branchId}` : null,
      "Akun akan dinonaktifkan: akses login dicabut dan status ditandai nonaktif. Histori transaksi bisnis tetap tersimpan. Akun ini bisa diaktifkan kembali lewat database bila diperlukan."
    ].filter(Boolean).join("\n"),
    confirmLabel: "Ya, Nonaktifkan",
    danger: true,
    requireText: true,
    textLabel: "Alasan penonaktifan",
    textPlaceholder: "Contoh: pegawai resign, akun duplikat, investor tidak aktif",
    textHelp: "Alasan ini dikirim ke backend agar jejak perubahan lebih rapi.",
    onConfirm: async (reasonText) => {
      setActionBusy(p.user_id);
      try {
        const { error } = await sb.rpc("hapus_akun_langsung", {
          target_user_id: p.user_id,
          target_email: p.email,
          reason: String(reasonText || "").trim()
        });
        if (error) throw error;
        pushNotif("Akun berhasil dinonaktifkan.", "success");
        await reloadAccountData();
      } catch (err) {
        pushNotif(err?.message || String(err), "warning");
        throw err;
      } finally {
        setActionBusy("");
      }
    }
  });

  return React.createElement("div", null,
    React.createElement("h3", { className: "section-title mt8" }, "Akun & Invite"),
    React.createElement("p", { className: "info-txt" }, "Kelola akun pekerja, investor, dan owner dengan validasi yang lebih aman agar tidak mudah salah input."),
    React.createElement("div", { className: "form-card mt8" },
      React.createElement("h4", null, "Buat Akun Baru"),
      React.createElement("p", { className: "info-txt", style: { marginTop: 0 } }, "Gunakan username singkat tanpa spasi. Sistem akan mengubahnya otomatis menjadi email login internal jika belum memakai @."),
      React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Role"),
        React.createElement("div", { className: "role-tabs" },
          React.createElement("button", { type: "button", disabled: !!actionBusy, className: "role-tab" + (form.role === "worker" ? " active" : ""), onClick: () => setRoleForm("worker") }, "Pekerja"),
          React.createElement("button", { type: "button", disabled: !!actionBusy, className: "role-tab" + (form.role === "distribusi" ? " active" : ""), onClick: () => setRoleForm("distribusi") }, "Kurir/Distribusi"),
          React.createElement("button", { type: "button", disabled: !!actionBusy, className: "role-tab" + (form.role === "manager" ? " active" : ""), onClick: () => setRoleForm("manager") }, "Area Manager (opsional)"),
          React.createElement("button", { type: "button", disabled: !!actionBusy, className: "role-tab" + (form.role === "investor" ? " active" : ""), onClick: () => setRoleForm("investor") }, "Investor"),
          React.createElement("button", { type: "button", disabled: !!actionBusy, className: "role-tab" + (form.role === "owner" ? " active" : ""), onClick: () => setRoleForm("owner") }, "Owner")
        ),
        formErrors.role && React.createElement("p", { className: "field-warning" }, formErrors.role),
        form.role === "manager" && React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Area Operasional"),
          React.createElement("select", { className: "inp", value: form.areaId, onChange: (e) => setForm((f) => ({ ...f, areaId: e.target.value })) },
            React.createElement("option", { value: "" }, "-- pilih area --"),
            areaOptions.map((a) => React.createElement("option", { key: a.id, value: a.id }, a.name))
          ),
          React.createElement("p", { className: "info-txt" }, "Manager mengakses Central Kitchen dan seluruh lapak yang terhubung ke area ini."),
          formErrors.areaId && React.createElement("p", { className: "field-warning" }, formErrors.areaId)
        )
      ),
      React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Username / Email"),
        React.createElement("input", {
          className: "inp",
          value: form.email,
          disabled: !!actionBusy,
          onChange: (e) => {
            const value = e.target.value;
            setForm((f) => ({ ...f, email: value }));
            if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: "" }));
          },
          placeholder: "Contoh: satria atau satria@bisnis.com"
        }),
        formErrors.email && React.createElement("p", { className: "field-warning" }, formErrors.email)
      ),
      React.createElement("div", { className: "field-group", style: { marginTop: 4 } },
        React.createElement("label", null, "Kata Sandi"),
        React.createElement("div", { style: { position: "relative", display: "flex", alignItems: "center" } },
          React.createElement("input", {
            className: "inp",
            type: showPassword ? "text" : "password",
            value: form.password,
            disabled: !!actionBusy,
            onChange: (e) => {
              const value = e.target.value;
              setForm((f) => ({ ...f, password: value }));
              if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: "" }));
            },
            placeholder: "Minimal 8 karakter..."
          }),
          React.createElement("button", { type: "button", disabled: !!actionBusy, style: { position: "absolute", right: 10, background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 11, fontWeight: "700" }, onClick: () => setShowPassword(!showPassword) }, showPassword ? "SEMBUNYIKAN" : "LIHAT")
        ),
        formErrors.password && React.createElement("p", { className: "field-warning" }, formErrors.password)
      ),
      React.createElement("div", { className: "field-group", style: { marginTop: 4 } },
        React.createElement("label", null, "Nama Tampilan (opsional)"),
        React.createElement("input", {
          className: "inp",
          value: form.displayName,
          disabled: !!actionBusy,
          onChange: (e) => {
            const value = e.target.value;
            setForm((f) => ({ ...f, displayName: value }));
            if (formErrors.displayName) setFormErrors((prev) => ({ ...prev, displayName: "" }));
          },
          placeholder: "Nama asli kasir / investor..."
        }),
        formErrors.displayName && React.createElement("p", { className: "field-warning" }, formErrors.displayName)
      ),
      form.role === "worker" && React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Cabang"),
        React.createElement("select", {
          className: "inp",
          value: form.branchId,
          disabled: !!actionBusy,
          onChange: (e) => {
            setForm((f) => ({ ...f, branchId: e.target.value }));
            if (formErrors.branchId) setFormErrors((prev) => ({ ...prev, branchId: "" }));
          }
        },
          React.createElement("option", { value: "" }, "-- Pilih --"),
          branches.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name))
        ),
        formErrors.branchId && React.createElement("p", { className: "field-warning" }, formErrors.branchId)
      ),
      form.role === "worker" && React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Gaji Harian (Rp) — opsional"),
        React.createElement("input", {
          className: "inp",
          type: "number",
          value: form.gajiHarian,
          disabled: !!actionBusy,
          onChange: (e) => {
            setForm((f) => ({ ...f, gajiHarian: e.target.value }));
            if (formErrors.gajiHarian) setFormErrors((prev) => ({ ...prev, gajiHarian: "" }));
          },
          placeholder: "Contoh: 50000"
        }),
        formErrors.gajiHarian && React.createElement("p", { className: "field-warning" }, formErrors.gajiHarian)
      ),
      form.role === "investor" && React.createElement("div", { className: "field-group" },
        React.createElement("label", null, "Pilih Investor"),
        React.createElement("select", {
          className: "inp",
          value: form.investorId,
          disabled: !!actionBusy,
          onChange: (e) => {
            setForm((f) => ({ ...f, investorId: e.target.value }));
            if (formErrors.investorId) setFormErrors((prev) => ({ ...prev, investorId: "" }));
          }
        },
          React.createElement("option", { value: "" }, "-- Pilih --"),
          investors.map((i) => React.createElement("option", { key: i.id, value: i.id }, i.nama, " (", i.persenBagi, "%)"))
        ),
        investors.length === 0 && React.createElement("p", { className: "info-txt mt8" }, "Belum ada investor. Buat dulu di tab Investor."),
        formErrors.investorId && React.createElement("p", { className: "field-warning" }, formErrors.investorId)
      ),
      React.createElement("button", { className: "btn-primary", onClick: createInvite, disabled: actionBusy === "create" }, actionBusy === "create" ? "Membuat Akun..." : "+ Buat Akun Langsung")
    ),
    React.createElement("h3", { className: "section-title mt12" }, "Daftar Antrean Akun"),
    loading && React.createElement("p", { className: "info-txt" }, "Memuat..."),
    !loading && invites.length === 0 && React.createElement(EmptyState, { icon: "✅", title: "Antrean kosong", desc: "Tidak ada antrean yang perlu diproses sekarang." }),
    !loading && invites.map((iv) =>
      React.createElement("div", { key: iv.id, className: "investor-row" },
        React.createElement("div", { style: { flex: 1 } },
          React.createElement("strong", null, iv.displayName || iv.email),
          React.createElement("div", { style: { fontSize: 12, color: "var(--text2)" } }, "Login: ", iv.email),
          React.createElement("div", { style: { fontSize: 12, color: "var(--text2)" } }, "Role: ", iv.role, iv.branchId ? ` | Cabang: ${branches.find((b) => b.id === iv.branchId)?.name || iv.branchId}` : "", iv.investorId ? ` | Investor: ${investors.find((i) => i.id === iv.investorId)?.nama || iv.investorId}` : "")
        ),
        React.createElement(RowMenu, { actions: [{ label: "Hapus", danger: true, onClick: () => askDeleteInvite(iv) }] })
      )
    ),
    React.createElement("h3", { className: "section-title mt12" }, "Akun Aktif Terdaftar"),
    profiles.length === 0 && React.createElement(EmptyState, { icon: "👤", title: "Belum ada profil", desc: "Data akun/pekerja belum termuat atau masih kosong." }),
    profiles.map((p) =>
      React.createElement("div", { key: p.user_id, className: "branch-row", style: { alignItems: "flex-start" } },
        React.createElement("div", { style: { flex: 1 } },
          React.createElement("strong", null, p.display_name || p.displayName || p.email || p.user_id.slice(0, 8)),
          React.createElement("div", { style: { fontSize: 12, color: "var(--text2)" } }, "Login: ", p.email || "-"),
          React.createElement("div", { style: { fontSize: 12, color: "var(--text2)" } },
            "Role: ", p.role === "manager" || p.role === "area_manager" ? "Area Manager (opsional)" : p.role,
            p.branchId ? ` | Cabang: ${branches.find((b) => b.id === p.branchId)?.name || p.branchId}` : "",
            (p.role === "manager" || p.role === "area_manager") ? (` | Kota: ${(getProfileCities(p).join(", ") || "—")}`) : "",
            p.investorId ? ` | Investor: ${investors.find((i) => i.id === p.investorId)?.nama || p.investorId}` : "",
            p.gajiHarian ? ` | Gaji: ${fmtRp(p.gajiHarian)}/hari` : ""
          ),
          (p.role === "manager" || p.role === "area_manager") && React.createElement("div", { className: "field-group mt8" },
            React.createElement("label", null, "Ubah kota manager (pisah koma)"),
            React.createElement("input", {
              className: "inp inp-sm",
              defaultValue: getProfileCities(p).join(", "),
              key: "cities-" + p.user_id + "-" + getProfileCities(p).join("|"),
              onBlur: async (e) => {
                const cities = normalizeCities(e.target.value);
                try {
                  const { error } = await sb.from("profiles").update({ cities, city: cities[0] || null }).eq("user_id", p.user_id);
                  if (error) throw error;
                  await S.loadKey("profiles");
                  pushNotif("Kota manager diperbarui: " + (cities.join(", ") || "—"), "success");
                } catch (err) {
                  pushNotif(err?.message || String(err), "warning");
                }
              }
            }),
            React.createElement("p", { className: "info-txt" }, "Contoh: Karawang, Bandung. Harus sama dengan field Kota di cabang.")
          ),
          p.role === "worker" && React.createElement(GajiHistoriEditor, {
            key: "gaji-" + p.user_id,
            profile: p,
            pushNotif,
            actionBusy
          }),
          p.role === "worker" && React.createElement("div", { style: { marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
            React.createElement("span", { style: { fontSize: 12, marginLeft: 0 } }, "Libur:"),
            React.createElement("select", {
              className: "inp inp-sm",
              style: { width: "auto", display: "inline-block", padding: "2px 6px", fontSize: 12 },
              value: jadwalLibur[p.user_id] || "",
              disabled: !!actionBusy,
              onChange: (e) => updateLibur(p.user_id, e.target.value)
            },
              React.createElement("option", { value: "" }, "-- Tidak Libur --"),
              ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"].map((h) => React.createElement("option", { key: h, value: h }, h))
            )
          )
        ),
        p.role !== "owner" && React.createElement(RowMenu, {
          actions: [
            { label: "Edit Nama", onClick: () => !actionBusy && editNamaAkun(p) },
            { label: "Reset Password", onClick: () => !actionBusy && resetPasswordAkun(p) },
            { label: actionBusy === p.user_id ? "Memproses..." : "Nonaktifkan Akun", danger: true, onClick: () => !actionBusy && askArchiveAccount(p) }
          ]
        })
      )
    ),
    confirmModal
  );
}

  // ─── SettingInvestor ───────────────────────────────────────────────────────
  function SettingInvestor({ pushNotif }) {
    const [investors, setInvestors] = useState(() => S.get("investors") || []);
    const [form, setForm] = useState({ nama: "", persenBagi: "" });
    const [confirmAsk, confirmModal] = useConfirm();
    const add = () => {
      if (!form.nama || !form.persenBagi) return;
      const u = [...investors, { id: uid(), nama: form.nama, persenBagi: parseFloat(form.persenBagi) }];
      S.set("investors", u); setInvestors(u); setForm({ nama: "", persenBagi: "" });
      pushNotif("Investor ditambahkan!", "success");
    };
    const del = (id) => { const u = investors.filter((x) => x.id !== id); S.set("investors", u); setInvestors(u); pushNotif("Investor dihapus.", "warning"); };
    const askDel = (inv) => confirmAsk({ title: "Hapus Investor", message: `Yakin hapus investor "${inv.nama}"?`, onConfirm: () => del(inv.id) });
    const upP = (id, p) => { const u = investors.map((x) => x.id === id ? { ...x, persenBagi: parseFloat(p) || 0 } : x); S.set("investors", u); setInvestors(u); };
    const upNama = (id, nm) => { const u = investors.map((x) => x.id === id ? { ...x, nama: nm } : x); S.set("investors", u); setInvestors(u); };

    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Kelola Investor"),
      investors.map((inv) =>
        React.createElement("div", { key: inv.id, className: "investor-row" },
          React.createElement("input", { className: "inp inp-sm", value: inv.nama, onChange: (e) => upNama(inv.id, e.target.value), style: { flex: 1, minWidth: 100, fontWeight: 700 }, "aria-label": "Nama investor" }),
          React.createElement("div", { className: "row-wrap" },
            React.createElement("input", { className: "inp inp-sm", type: "number", value: inv.persenBagi, onChange: (e) => upP(inv.id, e.target.value), style: { width: 70 } }),
            React.createElement("span", null, "%"),
            React.createElement(RowMenu, { actions: [{ label: "Hapus", danger: true, onClick: () => askDel(inv) }] })
          )
        )
      ),
      React.createElement("div", { className: "form-card mt12" },
        React.createElement("h4", null, "Tambah Investor"),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Nama"), React.createElement("input", { className: "inp", value: form.nama, onChange: (e) => setForm((x) => ({ ...x, nama: e.target.value })) })),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "% Bagi Hasil"), React.createElement("input", { className: "inp", type: "number", value: form.persenBagi, onChange: (e) => setForm((x) => ({ ...x, persenBagi: e.target.value })) })),
        React.createElement("button", { className: "btn-primary", onClick: add }, "+ Tambah")
      ),
      confirmModal
    );
  }

  // ─── BrandingSetting ────────────────────────────────────────────────────────
  function BrandingSetting({ pushNotif }) {
    const [logoUrl, setLogoUrl] = useState(getBrandLogo());
    const [busy, setBusy] = useState(false);
    const saveToDb = async (nextUrl) => {
      const value = { logoUrl: nextUrl, updatedAt: nowIso() };
      const { error } = await sb.from("app_settings").upsert({ key: "branding", value });
      if (error) throw error;
      setBrandLogoLocal(nextUrl);
    };
    const doUpload = async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      try {
        setBusy(true);
        const uploaded = await uploadAsset(file, "branding", { maxBytes: 250 * 1024, maxEdge: 1200 });
        const nextUrl = uploaded.url || logoUrl;
        setLogoUrl(nextUrl);
        await saveToDb(nextUrl);
        pushNotif("Logo berhasil diperbarui.", "success");
      } catch (err) { pushNotif(err?.message || String(err), "warning"); } finally { setBusy(false); }
    };
    const saveManual = async () => {
      if (!logoUrl) { pushNotif("Isi URL logo dulu.", "warning"); return; }
      try { setBusy(true); await saveToDb(logoUrl); pushNotif("Logo berhasil disimpan.", "success"); }
      catch (err) { pushNotif(err?.message || String(err), "warning"); } finally { setBusy(false); }
    };
    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Branding Logo"),
      React.createElement("p", { className: "info-txt" }, "Upload logo ke Supabase Storage, atau isi URL manual."),
      React.createElement("div", { className: "form-card mt8" },
        React.createElement("div", { style: { display: "flex", justifyContent: "center" } },
          React.createElement("img", { src: logoUrl || getBrandLogo(), alt: "Logo bisnis", className: "brand-preview" })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Upload Logo"),
          React.createElement("input", { className: "inp", type: "file", accept: "image/*", onChange: doUpload, disabled: busy })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "URL Logo"),
          React.createElement("input", { className: "inp", value: logoUrl, onChange: (e) => setLogoUrl(e.target.value), placeholder: "https://... atau public URL Supabase" })
        ),
        React.createElement("button", { className: "btn-primary", onClick: saveManual, disabled: busy }, busy ? "Menyimpan..." : "Simpan Logo")
      )
    );
  }

  function SettingStokLapak({ pushNotif }) {
    const tick = useStoreTick();
    const branches = (S.get("branches") || []).filter((b) => b.type !== "central_kitchen");
    const menus = S.get("menuVarian") || [];
    const stoks = S.get("stokLapak") || [];
    const [editVal, setEditVal] = useState({});
    const [busy, setBusy] = useState({});
    const [confirmAsk, confirmModal] = useConfirm();

    const getMenuNama = (id) => menus.find((m) => m.id === id)?.nama || id;
    const getBranchNama = (id) => branches.find((b) => b.id === id)?.name || id;

    const saveEdit = async (row) => {
      const val = parseFloat(editVal[row.id]);
      if (isNaN(val) || val < 0) { pushNotif("Nilai stok tidak valid.", "warning"); return; }
      setBusy((b) => ({ ...b, [row.id]: true }));
      try {
        await upsertStokLapak(row.branchId, row.menuId, val, row);
        await S.loadKey("stokLapak");
        setEditVal((e) => { const c = { ...e }; delete c[row.id]; return c; });
        pushNotif("Stok diperbarui.", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
      finally { setBusy((b) => { const c = { ...b }; delete c[row.id]; return c; }); }
    };

    const hapusRow = async (row) => {
      setBusy((b) => ({ ...b, [row.id]: true }));
      try {
        const { error } = await sb.from("stokLapak").delete().eq("id", row.id);
        if (error) throw error;
        await S.loadKey("stokLapak");
        pushNotif("Data stok dihapus.", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
      finally { setBusy((b) => { const c = { ...b }; delete c[row.id]; return c; }); }
    };
    const askHapusRow = (row) => confirmAsk({ title: "Hapus Data Stok", message: `Hapus data stok "${getMenuNama(row.menuId)}" di "${getBranchNama(row.branchId)}"?`, onConfirm: () => hapusRow(row) });

    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Stok Lapak (Real-time)"),
      React.createElement("p", { className: "info-txt" }, "Stok ini otomatis bertambah saat kasir konfirmasi terima distribusi, dan berkurang saat ada penjualan. Bisa dikoreksi manual di sini bila perlu."),
      stoks.length === 0 && React.createElement("p", { className: "empty-txt mt8" }, "Belum ada data stok lapak."),
      branches.map((b) => {
        const rows = stoks.filter((s) => s.branchId === b.id);
        if (rows.length === 0) return null;
        return React.createElement("div", { key: b.id, className: "mt12" },
          React.createElement("h4", { className: "sub-title" }, b.name),
          rows.map((row) =>
            React.createElement("div", { key: row.id, className: "row-wrap", style: { gap: 8, alignItems: "center", marginBottom: 6 } },
              React.createElement("span", { style: { flex: 1 } }, getMenuNama(row.menuId)),
              React.createElement("input", {
                type: "number", className: "inp inp-sm", style: { width: 80 }, min: 0,
                value: editVal[row.id] !== undefined ? editVal[row.id] : row.stok,
                onChange: (e) => setEditVal((v) => ({ ...v, [row.id]: e.target.value }))
              }),
              React.createElement("span", { style: { fontSize: 12, color: "var(--text2)" } }, "pcs"),
              React.createElement("button", { className: "btn-secondary btn-sm", disabled: !!busy[row.id], onClick: () => saveEdit(row) }, "Simpan"),
              React.createElement(RowMenu, { actions: [{ label: "Hapus", danger: true, onClick: () => askHapusRow(row) }] })
            )
          )
        );
      }),
      confirmModal
    );
  }

  // ─── SettingKasBelanja — saldo kas belanja terakumulasi dari HPP distribusi,
  // dikurangi total yang sudah diambil untuk belanja bahan baku. ─────────────
  function SettingKasBelanja({ pushNotif, goSetting }) {
    const tick = useStoreTick();
    // Distribusi berstatus "dibatalkan" (retur) tidak boleh menggelembungkan kas belanja.
    const distribAll = (S.get("distribusiCK") || []).filter((d) => d.status !== "dibatalkan");
    const list = (S.get("pengambilanBelanja") || []).slice().sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    const totalHppMasuk = distribAll.reduce((a, d) => a + (d.hppTotal || 0), 0);
    const totalDiambil = list.filter((p) => p.status !== "dibatalkan").reduce((a, p) => {
      const diambil = Number(p.jumlah) || 0;
      const kembali = p.status === "diterima" && p.jumlahTerpakai != null
        ? Math.max(0, diambil - Number(p.jumlahTerpakai))
        : 0;
      return a + (diambil - kembali);
    }, 0);

    const [form, setForm] = useState({ jumlah: "", keterangan: "", fotoUrl: "", fotoPath: "" });
    const [showForm, setShowForm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [confirmAsk, confirmModal] = useConfirm();
    const [modalAwal, setModalAwal] = useState(0);
    const [modalAwalInput, setModalAwalInput] = useState("");
    const saldo = modalAwal + totalHppMasuk - totalDiambil;

    useEffect(() => {
      sb.from("app_settings").select("value").eq("key", "kas_belanja_modal_awal").maybeSingle()
        .then(({ data }) => {
          const n = Number(data?.value?.jumlah || 0) || 0;
          setModalAwal(n);
          setModalAwalInput(String(n || ""));
        }).catch(() => {});
    }, [tick]);

    const saveModalAwal = async () => {
      const jumlah = Number(modalAwalInput) || 0;
      if (jumlah < 0) { pushNotif("Modal awal tidak boleh negatif.", "warning"); return; }
      setBusy(true);
      try {
        const { error } = await sb.from("app_settings").upsert({
          key: "kas_belanja_modal_awal",
          value: { jumlah, updatedAt: nowIso() }
        });
        if (error) throw error;
        setModalAwal(jumlah);
        pushNotif("Modal awal bahan disimpan.", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
      finally { setBusy(false); }
    };

    const doUploadNota = async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      try {
        setUploading(true);
        const uploaded = await uploadAsset(file, "nota-belanja", { maxBytes: 350 * 1024, maxEdge: 1600 });
        setForm((f) => ({ ...f, fotoUrl: uploaded.url || f.fotoUrl, fotoPath: uploaded.path || f.fotoPath }));
      } catch (err) { pushNotif(err?.message || String(err), "warning"); } finally { setUploading(false); }
    };

    const doAmbil = async () => {
      const jml = parseFloat(form.jumlah);
      if (!jml || jml <= 0) { pushNotif("Isi jumlah yang valid.", "warning"); return; }
      const ambil = () => doAmbilConfirmed(jml);
      if (jml > saldo) {
        confirmAsk({
          title: "Saldo Tidak Cukup",
          message: `Saldo kas belanja hanya ${fmtRp(saldo)}, tapi mau ambil ${fmtRp(jml)}. Tetap lanjut? (saldo akan minus)`,
          confirmLabel: "Tetap Lanjut",
          danger: false,
          onConfirm: ambil
        });
        return;
      }
      ambil();
    };

    const doAmbilConfirmed = async (jml) => {
      setBusy(true);
      try {
        const { error } = await sb.from("pengambilanBelanja").insert([{
          id: uid(), date: today(), ts: nowIso(), jumlah: jml,
          keterangan: form.keterangan || "Belanja bahan baku",
          fotoUrl: form.fotoUrl || null, fotoPath: form.fotoPath || null
        }]);
        if (error) throw error;
        await S.loadKey("pengambilanBelanja");
        setForm({ jumlah: "", keterangan: "", fotoUrl: "", fotoPath: "" });
        setShowForm(false);
        pushNotif("Pengambilan tercatat!", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); } finally { setBusy(false); }
    };

    const hapus = async (id) => {
      const { error } = await sb.from("pengambilanBelanja").delete().eq("id", id);
      if (!error) { await S.loadKey("pengambilanBelanja"); pushNotif("Riwayat dihapus.", "warning"); }
    };
    const askHapus = (p) => confirmAsk({ title: "Hapus Riwayat", message: `Hapus catatan pengambilan "${fmtRp(p.jumlah)}" ini?`, onConfirm: () => hapus(p.id) });
    const hppKomponenHariIni = aggregateHppComponents(S.get("transactions") || [], today(), today());

    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Uang bahan & modal kerja"),
      React.createElement("p", { className: "info-txt" }, "Restok pertama dicatat sebagai modal kerja bahan. Jatah HPP dari distribusi dicatat terpisah dari belanja aktual, sehingga tidak otomatis terlihat minus hanya karena belum ada penjualan."),
      React.createElement("div", { className: "form-card mt8" },
        React.createElement("h4", null, "Modal Awal Dana Bahan"),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Modal awal / dana yang disiapkan (Rp)"),
          React.createElement("input", { className: "inp", type: "number", min: 0, value: modalAwalInput, onChange: (e) => setModalAwalInput(e.target.value), placeholder: "Contoh: 500000" })
        ),
        React.createElement("button", { className: "btn-secondary btn-sm", onClick: saveModalAwal, disabled: busy }, busy ? "Menyimpan..." : "Simpan modal awal"),
        React.createElement("p", { className: "info-txt" }, "Saldo dana bahan = modal awal + jatah HPP distribusi − belanja aktual.")
      ),
      React.createElement("div", { className: "kpi-card kpi-modal mt8", style: { maxWidth: 280 } },
        React.createElement("div", { className: "kpi-label" }, "Saldo Kas Belanja Tersedia"),
        React.createElement("div", { className: "kpi-val", style: { color: saldo >= 0 ? "var(--accent)" : "var(--red)", fontSize: 22 } }, fmtRp(saldo))
      ),
      React.createElement("div", { className: "row-wrap mt4", style: { fontSize: 12, color: "var(--text2)" } },
        React.createElement("span", null, "Total HPP Masuk: ", React.createElement("strong", { style: { color: "var(--text)" } }, fmtRp(totalHppMasuk))),
        React.createElement("span", null, "Total Sudah Diambil: ", React.createElement("strong", { style: { color: "var(--text)" } }, fmtRp(totalDiambil)))
      ),
      React.createElement("div", { className: "card mt8" },
        React.createElement("h4", null, "Alokasi HPP Terjual Hari Ini"),
        React.createElement("p", { className: "info-txt" }, "HPP donat polos sudah dipecah per bahan dasar; glaze dan topping dihitung sesuai rasa yang dipilih pembeli."),
        hppKomponenHariIni.length === 0
          ? React.createElement("p", { className: "empty-txt" }, "Belum ada penjualan hari ini.")
          : React.createElement("div", { className: "tbl-wrap" },
              React.createElement("table", { className: "tbl" },
                React.createElement("thead", null, React.createElement("tr", null,
                  React.createElement("th", null, "Komponen"),
                  React.createElement("th", null, "Jenis"),
                  React.createElement("th", null, "Qty"),
                  React.createElement("th", null, "Alokasi HPP")
                )),
                React.createElement("tbody", null,
                  hppKomponenHariIni.map((c) => React.createElement("tr", { key: c.key },
                    React.createElement("td", null, c.nama),
                    React.createElement("td", null, c.jenis),
                    React.createElement("td", null, Number(c.qty).toLocaleString("id-ID", { maximumFractionDigits: 3 })),
                    React.createElement("td", null, fmtRp(c.hpp))
                  )),
                  React.createElement("tr", { style: { fontWeight: 800, borderTop: "2px solid var(--border)" } },
                    React.createElement("td", { colSpan: 3 }, "TOTAL HPP TERJUAL"),
                    React.createElement("td", null, fmtRp(hppKomponenHariIni.reduce((a, c) => a + c.hpp, 0)))
                  )
                )
              )
            )
      ),
      !showForm && React.createElement("button", { className: "btn-primary mt8", onClick: () => setShowForm(true) }, "\uD83D\uDED2 Ambil Uang untuk Belanja"),
      showForm && React.createElement("div", { className: "form-card mt8" },
        React.createElement("h4", null, "Ambil Uang Belanja"),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Jumlah (Rp)"),
          React.createElement("input", { type: "number", className: "inp", value: form.jumlah, onChange: (e) => setForm((f) => ({ ...f, jumlah: e.target.value })), placeholder: "Contoh: 150000" })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Keterangan"),
          React.createElement("input", { className: "inp", value: form.keterangan, onChange: (e) => setForm((f) => ({ ...f, keterangan: e.target.value })), placeholder: "Contoh: Belanja tepung & gula minggu ini" })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Foto Nota (opsional)"),
          form.fotoUrl && React.createElement("img", { src: form.fotoUrl, alt: "Nota", className: "brand-preview", style: { width: 120, height: 120 } }),
          React.createElement("input", { className: "inp", type: "file", accept: "image/*", onChange: doUploadNota, disabled: uploading })
        ),
        React.createElement("div", { className: "row-wrap" },
          React.createElement("button", { className: "btn-secondary", onClick: () => { setShowForm(false); setForm({ jumlah: "", keterangan: "", fotoUrl: "", fotoPath: "" }); } }, "Batal"),
          React.createElement("button", { className: "btn-primary", disabled: busy || uploading, onClick: doAmbil }, busy ? "Menyimpan..." : "Konfirmasi Ambil")
        )
      ),
      React.createElement("h4", { className: "sub-title mt12" }, "Riwayat Pengambilan"),
      list.length === 0 && React.createElement(EmptyState, { icon: "🛒", title: "Belum ada pengambilan kas belanja", desc: "Ambil di sini, atau lewat Gudang → Beli bahan agar ter-tag per bahan.", actionLabel: "Ke Gudang Bahan", onAction: () => goSetting && goSetting("gudang") }),
      list.map((p) =>
        React.createElement("div", { key: p.id, className: "row-wrap", style: { justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" } },
          p.fotoUrl && React.createElement("img", { src: p.fotoUrl, alt: "Nota", style: { width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" } }),
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("div", { style: { fontSize: 13, fontWeight: 600 } }, p.keterangan),
            React.createElement("div", { style: { fontSize: 11, color: "var(--text2)" } }, formatTanggalIndo(p.date))
          ),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
            React.createElement("strong", { style: { color: "var(--red)" } }, "-", fmtRp(p.jumlah)),
            React.createElement(RowMenu, { actions: [{ label: "Hapus", danger: true, onClick: () => askHapus(p) }] })
          )
        )
      ),
      confirmModal
    );
  }

  // ─── TutupBuku ───────────────────────────────────────────────────────────
  function TutupBuku({ pushNotif }) {
    const [confirmAsk, confirmModal] = useConfirm();
    const [bulan, setBulan] = useState(() => new Date().toISOString().slice(0, 7)); // "YYYY-MM"
    const [busy, setBusy] = useState(false);
    const [checklist, setChecklist] = useState(null);
    const [current, setCurrent] = useState(null); // baris tutupBuku is_current untuk bulan ini, kalau ada
    const [loadingCurrent, setLoadingCurrent] = useState(false);

    const branches = S.get("branches") || [];

    // ─── Ambil status penutupan bulan yang sedang dipilih ───────────────────
    const loadCurrent = useCallback(async () => {
      setLoadingCurrent(true);
      try {
        const { data, error } = await sb
          .from("tutupBuku")
          .select("*")
          .eq("bulan", bulan)
          .eq("is_current", true)
          .maybeSingle();
        if (error) throw error;
        setCurrent(data || null);
      } catch (e) {
        pushNotif("Gagal cek status tutup buku: " + (e?.message || e), "warning");
      } finally {
        setLoadingCurrent(false);
      }
    }, [bulan]);

    useEffect(() => { loadCurrent(); setChecklist(null); }, [loadCurrent]);

    // ─── Checklist validasi sebelum boleh tutup buku ────────────────────────
    const runChecklist = async () => {
      setBusy(true);
      try {
        const warnings = [];

        const { data: setoran, error: e1 } = await sb
          .from("setoranHarian")
          .select("branchId, date, status")
          .gte("date", bulan + "-01")
          .lt("date", nextMonthStr(bulan));
        if (e1) throw e1;

        const belumSelesai = (setoran || []).filter((s) => s.status !== "selesai");
        if (belumSelesai.length > 0) {
          warnings.push(`${belumSelesai.length} Setoran Harian bulan ini belum dikonfirmasi (status masih "menunggu").`);
        }
        const adaSelisih = (setoran || []).filter((s) => s.selisihKas != null && Math.abs(Number(s.selisihKas)) >= 1);
        if (adaSelisih.length > 0) {
          const sumSel = adaSelisih.reduce((a, s) => a + Number(s.selisihKas || 0), 0);
          warnings.push(`${adaSelisih.length} setoran ada SELISIH KAS (total ${fmtSelisihKas(sumSel).text}). Pastikan sudah ditelusuri & beralasan sebelum tutup buku.`);
        }

        const { data: distrib, error: e2 } = await sb
          .from("distribusiCK")
          .select("id, status")
          .gte("date", bulan + "-01")
          .lt("date", nextMonthStr(bulan))
          .eq("status", "pending");
        if (e2) throw e2;
        if ((distrib || []).length > 0) {
          warnings.push(`${distrib.length} Distribusi CK bulan ini masih berstatus "Menunggu".`);
        }

        const { data: gaji, error: e3 } = await sb
          .from("gajiPembayaran")
          .select("id, status")
          .eq("bulan", bulan)
          .neq("status", "dikonfirmasi");
        if (e3) throw e3;
        if ((gaji || []).length > 0) {
          warnings.push(`${gaji.length} pembayaran gaji bulan ini belum berstatus "Dikonfirmasi".`);
        }

        setChecklist({ warnings, checkedAt: nowTs() });
        return warnings;
      } catch (e) {
        pushNotif("Gagal jalankan checklist: " + (e?.message || e), "warning");
        return null;
      } finally {
        setBusy(false);
      }
    };

    // ─── Hitung snapshot angka final bulan ini ──────────────────────────────
    const hitungSnapshot = async () => {
      const from = bulan + "-01";
      const to = nextMonthStr(bulan);

      // Audit snapshot mengambil data mentah lebih lengkap, bukan hanya KPI.
      const [txRes, plRes, poRes, distRes, gajiRes, setoranRes, produksiRes, wasteRes, absensiRes, belanjaRes] = await Promise.all([
        sb.from("transactions").select("*").gte("date", from).lt("date", to),
        sb.from("pengeluaranLapak").select("*").gte("date", from).lt("date", to),
        sb.from("pengeluaranOwner").select("*").gte("date", from).lt("date", to),
        sb.from("distribusiCK").select("*").gte("date", from).lt("date", to),
        sb.from("gajiPembayaran").select("*").eq("bulan", bulan),
        sb.from("setoranHarian").select("*").gte("date", from).lt("date", to),
        sb.from("produksiCK").select("*").gte("date", from).lt("date", to),
        sb.from("stokTidakTerjual").select("*").gte("date", from).lt("date", to),
        sb.from("absensi").select("*").gte("date", from).lt("date", to),
        sb.from("pengambilanBelanja").select("*").gte("date", from).lt("date", to),
      ]);
      for (const r of [txRes, plRes, poRes, distRes, gajiRes, setoranRes, produksiRes, wasteRes, absensiRes, belanjaRes]) if (r.error) throw r.error;

      const txs = txRes.data || [];
      const pl = plRes.data || [];
      const po = poRes.data || [];
      const dist = distRes.data || [];
      const gaji = gajiRes.data || [];
      const setoran = setoranRes.data || [];
      const produksi = produksiRes.data || [];
      const waste = wasteRes.data || [];
      const absensi = absensiRes.data || [];
      const belanja = belanjaRes.data || [];
      const gajiTotal = gaji.reduce((a, g) => a + (g.jumlah || 0), 0); // info status bayar saja, bukan komponen laba

      const investorsAll = S.get("investors") || [];

      // ─── REVISI AUDIT: laba/rugi bulan ini dulu dihitung ulang manual di
      // sini (salinan ke-3 dari rumus yang sama persis dengan OwnerDashboard
      // & PerformaPeriode) — sekarang panggil hitungPerformaPeriode yang
      // SAMA, supaya cuma ada SATU rumus laba di seluruh app. Data tetap
      // diambil FRESH dari server di atas (bukan cache client S), supaya
      // snapshot yang bakal dikunci ini akurat per saat ditutup — cuma cara
      // MENGHITUNGnya yang sekarang dipusatkan.
      const hasil = hitungPerformaPeriode({
        txs, pL: pl, pO: po, distribAll: dist, stokTidakTerjualAll: [], branches, investorsAll,
        dateFrom: from, dateTo: to, branchId: "all", tipe: "all",
      });

      // ─── Petakan ke skema kolom "tutupBuku" yang SUDAH ADA — nama field
      // sengaja dipertahankan persis seperti sebelumnya, supaya
      // TutupBukuTahunan (yang membaca detail.perCabang) dan export Excel
      // yang sudah bergantung ke nama-nama ini tidak ikut berubah. ────────
      const perCabang = hasil.branchStats.map((b) => ({
        branchId: b.id,
        nama: b.name,
        tipe: b.type === "investasi" ? "investasi" : "mandiri",
        investorId: b.investorId,
        investorNama: b.investorNama,
        omzet: b.omzet,
        hpp: b.modal,
        hppTerjual: b.hppTerjual,
        hppTidakLaku: b.hppTidakLaku,
        pengeluaranLapak: b.pengLapak,
        pengeluaranOwner: b.pengOwner,
        pengeluaranGajiCk: b.pengGajiCk,
        laba: b.laba,
        txCount: b.txCount,
      }));

      // ─── Pisah total mandiri vs investasi — JANGAN digabung jadi satu angka.
      // Owner butuh tahu berapa laba dari cabang MILIKNYA SENDIRI, terpisah dari
      // bagian yang secara bisnis "milik"/harus dibagi ke investor.
      const sumTipe = (tipe) => {
        const rows = perCabang.filter((b) => b.tipe === tipe);
        return {
          omzet: rows.reduce((a, b) => a + b.omzet, 0),
          hpp: rows.reduce((a, b) => a + b.hpp, 0),
          pengeluaran: rows.reduce((a, b) => a + b.pengeluaranLapak + b.pengeluaranOwner, 0),
          laba: rows.reduce((a, b) => a + b.laba, 0),
          txCount: rows.reduce((a, b) => a + b.txCount, 0),
        };
      };
      const totalMandiri = sumTipe("mandiri");
      const totalInvestasi = sumTipe("investasi");

      // Per investor (kalau owner punya lebih dari 1 investor, jangan campur juga)
      const perInvestor = investorsAll.map((inv) => {
        const rows = perCabang.filter((b) => b.tipe === "investasi" && b.investorId === inv.id);
        return {
          investorId: inv.id,
          investorNama: inv.nama,
          cabang: rows.map((r) => r.nama),
          omzet: rows.reduce((a, b) => a + b.omzet, 0),
          hpp: rows.reduce((a, b) => a + b.hpp, 0),
          pengeluaran: rows.reduce((a, b) => a + b.pengeluaranLapak + b.pengeluaranOwner, 0),
          laba: rows.reduce((a, b) => a + b.laba, 0),
        };
      }).filter((i) => i.cabang.length > 0);

      return {
        omzet: hasil.omzet, hpp: hasil.hppDistribusi, hppTerjual: hasil.hppTerjual, hppTidakLaku: hasil.hppTidakLaku,
        // Dijumlahkan dari perCabang (partisi persis dari pl/po mentah di atas,
        // lihat catatan di hitungPerformaPeriode) — bukan hitung ulang terpisah.
        pengeluaranLapak: perCabang.reduce((a, b) => a + b.pengeluaranLapak, 0),
        pengeluaranOwner: perCabang.reduce((a, b) => a + b.pengeluaranOwner, 0),
        gajiTotal, labaBersih: hasil.laba,
        txCount: txs.length,
        totalMandiri, totalInvestasi,
        detail: {
          perCabang,
          perInvestor,
          // FIX: totalMandiri/totalInvestasi dulu dihitung tapi cuma ditaruh di
          // level atas snap (di luar detail) — sedangkan yang disimpan ke kolom
          // "detail" tabel tutupBuku cuma object ini. Efeknya, breakdown "Laba
          // Cabang Mandiri/Investasi" di bawah CACAT untuk SEMUA bulan yang
          // sudah ditutup sebelumnya (current.detail.totalMandiri selalu
          // undefined). Sekarang diikutkan ke sini juga supaya benar-benar
          // tersimpan. Dipakai juga oleh agregasi TutupBukuTahunan di bawah.
          totalMandiri,
          totalInvestasi,
          transaksi: txs,
          pengeluaranLapak: pl,
          pengeluaranOwner: po,
          distribusiCK: dist,
          gajiPembayaran: gaji,
          setoranHarian: setoran,
          produksiCK: produksi,
          stokTidakTerjual: waste,
          absensi,
          pengambilanBelanja: belanja,
          masterCabang: branches,
          masterMenu: S.get("menuVarian") || [],
          masterBahan: S.get("bahanPokok") || [],
          masterToping: S.get("topingTambahan") || [],
          hppKomponen: aggregateHppComponents(txs, from, to),
        },
      };
    };

    // ─── Kunci semua data bulan ini di database ─────────────────────────────
    const kunciDataBulan = async () => {
      const from = bulan + "-01";
      const to = nextMonthStr(bulan);
      const r1 = await sb.from("setoranHarian").update({ locked: true }).gte("date", from).lt("date", to);
      if (r1.error) throw r1.error;
      const r2 = await sb.from("absensiBulanan").update({ locked: true }).eq("bulan", bulan);
      if (r2.error) throw r2.error;
    };

    const bukaKunciDataBulan = async () => {
      const from = bulan + "-01";
      const to = nextMonthStr(bulan);
      const r1 = await sb.from("setoranHarian").update({ locked: false }).gte("date", from).lt("date", to);
      if (r1.error) throw r1.error;
      const r2 = await sb.from("absensiBulanan").update({ locked: false }).eq("bulan", bulan);
      if (r2.error) throw r2.error;
    };

    // ─── Aksi: Tutup Buku ────────────────────────────────────────────────────
    const doClose = async (forcedWarnings) => {
      setBusy(true);
      try {
        const snap = await hitungSnapshot();
        const { data: sess } = await sb.auth.getSession();
        const uid = sess?.session?.user?.id || null;

        const { error } = await sb.from("tutupBuku").insert({
          bulan,
          versi: (current?.versi || 0) + 1,
          is_current: true,
          omzet: snap.omzet,
          hpp: snap.hpp,
          pengeluaran_lapak: snap.pengeluaranLapak,
          pengeluaran_owner: snap.pengeluaranOwner,
          gaji_total: snap.gajiTotal,
          laba_bersih: snap.labaBersih,
          tx_count: snap.txCount,
          detail: snap.detail,
          checklist_warnings: forcedWarnings || [],
          closed_by: uid,
        });
        if (error) throw error;

        await kunciDataBulan();
        await loadCurrent();
        setChecklist(null);
        pushNotif(`Buku bulan ${bulan} berhasil ditutup.`, "success");
      } catch (e) {
        pushNotif("Gagal tutup buku: " + (e?.message || e), "warning");
      } finally {
        setBusy(false);
      }
    };

    const askClose = async () => {
      const warnings = await runChecklist();
      if (warnings === null) return;

      if (warnings.length === 0) {
        confirmAsk({
          title: "Tutup Buku " + bulan,
          message: "Semua checklist aman. Setelah ditutup, data bulan ini akan dikunci dan tidak bisa dihapus/diubah kecuali dibuka lagi secara manual. Lanjutkan?",
          onConfirm: () => doClose([]),
        });
      } else {
        confirmAsk({
          title: "⚠️ Ada yang belum beres — tetap tutup buku?",
          message: warnings.join("\n") + "\n\nKamu tetap bisa memaksa tutup buku, tapi angka di atas akan ikut tercatat sebagai peringatan di riwayat. Lanjutkan?",
          onConfirm: () => doClose(warnings),
        });
      }
    };

    // ─── Aksi: Buka Kunci (Reopen) ───────────────────────────────────────────
    const askReopen = () => {
      confirmAsk({
        title: "Buka Kunci Buku " + bulan,
        message: "Ketik alasan buka kunci (wajib diisi, akan tersimpan permanen di riwayat):",
        requireText: true,
        textLabel: "Alasan buka kunci",
        textPlaceholder: "Contoh: ada koreksi setoran yang terlewat...",
        confirmLabel: "Buka Kunci",
        onConfirm: async (reasonInput) => {
          if (!reasonInput || !reasonInput.trim()) {
            pushNotif("Alasan wajib diisi untuk buka kunci buku.", "warning");
            throw new Error("Alasan kosong");
          }
          setBusy(true);
          try {
            const { data: sess } = await sb.auth.getSession();
            const uid = sess?.session?.user?.id || null;
            const { error } = await sb
              .from("tutupBuku")
              .update({ is_current: false, reopened_by: uid, reopened_at: new Date().toISOString(), reopen_reason: reasonInput.trim() })
              .eq("id", current.id);
            if (error) throw error;
            await bukaKunciDataBulan();
            await loadCurrent();
            pushNotif("Buku dibuka. Data bulan ini bisa diedit lagi — jangan lupa tutup ulang setelah selesai.", "warning");
          } catch (e) {
            pushNotif("Gagal buka kunci: " + (e?.message || e), "warning");
            throw e;
          } finally {
            setBusy(false);
          }
        },
      });
    };

    // ─── Export Excel — baca dari snapshot beku, BUKAN hitung ulang ─────────
    const exportExcel = () => {
      if (!current) { pushNotif("Belum ada buku yang ditutup untuk bulan ini.", "warning"); return; }
      if (typeof XLSX === "undefined") {
        pushNotif("Library Excel belum termuat. Pastikan xlsx.full.min.js sudah ditambahkan di index.html.", "warning");
        return;
      }
      const d = current.detail || {};
      const wb = XLSX.utils.book_new();

      const ringkasan = [
        ["EVORA DONUTS — TUTUP BUKU", null],
        ["Bulan", current.bulan],
        ["Versi", current.versi],
        ["Ditutup pada", current.closed_at],
        ["", null],
        ["Penjualan", current.omzet],
        ["HPP", current.hpp],
        ["Pengeluaran Lapak", current.pengeluaran_lapak],
        ["Pengeluaran Owner", current.pengeluaran_owner],
        ["Gaji (informasi pembayaran)", current.gaji_total],
        ["Laba Bersih", current.laba_bersih],
        ["Jumlah Transaksi", current.tx_count],
      ];
      XLSX.utils.book_append_sheet(wb, styledSummarySheet(ringkasan, [5, 6, 7, 8, 9, 10]), "Ringkasan");

      if (d.perCabang) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.perCabang), "Per Cabang");
      if (d.transaksi) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.transaksi.map((t) => ({
        tanggal: t.date, branchId: t.branchId, total: t.total, totalHPP: t.totalHPP,
        items: (t.items || []).map((i) => i.nama + " x" + i.qty).join(", "),
      }))), "Transaksi");
      if (d.hppKomponen) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.hppKomponen.map((c) => ({
        Komponen: c.nama, Jenis: c.jenis, "Qty Terpakai": c.qty, "Alokasi HPP": c.hpp
      }))), "HPP per Komponen");
      if (d.pengeluaranLapak) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.pengeluaranLapak), "Pengeluaran Lapak");
      if (d.pengeluaranOwner) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.pengeluaranOwner), "Pengeluaran Owner");
      if (d.gajiPembayaran) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.gajiPembayaran), "Gaji");
      if (d.setoranHarian) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.setoranHarian), "Setoran Harian");
      if (d.produksiCK) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.produksiCK), "Produksi CK");
      if (d.distribusiCK) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.distribusiCK), "Distribusi CK");
      if (d.stokTidakTerjual) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.stokTidakTerjual), "Waste");
      if (d.absensi) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.absensi), "Absensi");
      if (d.pengambilanBelanja) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.pengambilanBelanja), "Belanja Bahan");
      if (d.masterCabang) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.masterCabang), "Master Cabang");
      if (d.masterMenu) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.masterMenu), "Master Menu");
      if (d.masterBahan) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.masterBahan), "Master Bahan");
      if (d.masterToping) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.masterToping), "Master Toping");

      XLSX.writeFile(wb, `TutupBuku_${current.bulan}_v${current.versi}.xlsx`);
    };

    // ─── Export Excel KHUSUS 1 investor — sengaja file terpisah, sengaja TIDAK
    // reuse exportExcel() di atas, supaya tidak ada risiko investor kebagian
    // sheet cabang lain/data owner kalau suatu saat kode di atas berubah.
    const exportExcelInvestor = (investorId) => {
      if (!current) { pushNotif("Belum ada buku yang ditutup untuk bulan ini.", "warning"); return; }
      if (typeof XLSX === "undefined") { pushNotif("Library Excel belum termuat.", "warning"); return; }

      const d = current.detail || {};
      const infoInvestor = (d.perInvestor || []).find((i) => i.investorId === investorId);
      if (!infoInvestor) { pushNotif("Data investor ini tidak ditemukan di snapshot bulan ini.", "warning"); return; }

      const cabangIds = (d.perCabang || [])
        .filter((c) => c.tipe === "investasi" && c.investorId === investorId)
        .map((c) => c.branchId);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet([
        ["Investor", infoInvestor.investorNama],
        ["Bulan", current.bulan],
        ["Cabang", infoInvestor.cabang.join(", ")],
        [],
        ["Penjualan", infoInvestor.omzet],
        ["HPP", infoInvestor.hpp],
        ["Biaya", infoInvestor.pengeluaran],
        ["Laba", infoInvestor.laba],
      ])), "Ringkasan");

      const txMilikInvestor = (d.transaksi || []).filter((t) => cabangIds.includes(t.branchId));
      XLSX.utils.book_append_sheet(wb, styledJsonSheet(txMilikInvestor.map((t) => ({
        tanggal: t.date, total: t.total, totalHPP: t.totalHPP,
        items: (t.items || []).map((i) => i.nama + " x" + i.qty).join(", "),
      }))), "Transaksi");

      XLSX.writeFile(wb, `Laporan_${infoInvestor.investorNama}_${current.bulan}.xlsx`);
    };

    // ─── UI ──────────────────────────────────────────────────────────────────
    return React.createElement("div", { className: "card" },
      React.createElement("h3", null, "Tutup Buku Bulanan"),
      React.createElement("input", {
        type: "month", value: bulan, onChange: (e) => setBulan(e.target.value), disabled: busy,
      }),

      loadingCurrent && React.createElement("p", null, "Memuat status..."),

      !loadingCurrent && current && React.createElement("div", { className: "info-box" },
        React.createElement("p", null, `✅ Bulan ${bulan} SUDAH DITUTUP (versi ${current.versi}) pada ${current.closed_at}.`),
        current.checklist_warnings?.length > 0 && React.createElement("p", { style: { color: "var(--red)" } },
          "Ditutup dengan peringatan: " + current.checklist_warnings.join("; ")
        ),
        current.detail?.totalMandiri && React.createElement("p", null,
          `Laba Cabang Mandiri (punya sendiri): Rp${current.detail.totalMandiri.laba?.toLocaleString?.("id-ID") ?? current.detail.totalMandiri.laba}`
        ),
        current.detail?.totalInvestasi && React.createElement("p", null,
          `Laba Cabang Investasi (harus dibagi ke investor): Rp${current.detail.totalInvestasi.laba?.toLocaleString?.("id-ID") ?? current.detail.totalInvestasi.laba}`
        ),
        React.createElement("button", { className: "btn-secondary", onClick: exportExcel, disabled: busy }, "📥 Download Excel Lengkap (Owner)"),
        (current.detail?.perInvestor || []).map((inv) =>
          React.createElement("button", {
            key: inv.investorId, className: "btn-secondary", disabled: busy,
            onClick: () => exportExcelInvestor(inv.investorId),
          }, `📥 Excel untuk ${inv.investorNama}`)
        ),
        React.createElement("button", { className: "btn-danger-sm", onClick: askReopen, disabled: busy }, "Buka Kunci")
      ),

      !loadingCurrent && !current && React.createElement("div", null,
        React.createElement("p", null, `Bulan ${bulan} belum ditutup.`),
        React.createElement("button", { className: "btn-primary", onClick: askClose, disabled: busy }, busy ? "Memproses..." : "Tutup Buku Bulan Ini")
      ),

      confirmModal
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TutupBukuTahunan — penutupan resmi TAHUNAN (checklist #5.4 / #4.6).
  //
  // BEDA PENTING dari TutupBuku bulanan: komponen ini TIDAK menghitung ulang
  // dari tabel transaksi/pengeluaran mentah. Ia mengAGREGASI dari 12 snapshot
  // TutupBuku BULANAN yang sudah resmi ditutup (tabel "tutupBuku", is_current).
  // Alasannya: begitu suatu bulan resmi ditutup, angka bulan itu adalah angka
  // FINAL yang berlaku secara bisnis — Tahunan harus mencerminkan angka resmi
  // itu, bukan hitung ulang terpisah yang bisa saja beda kalau ada data lama
  // yang berubah setelah bulan itu ditutup (tanggal terkunci lewat
  // isSetoranLocked/DAY_LOCK_LINKED_TABLES, tapi tetap bisa diedit lagi kalau
  // ownernya sengaja buka kunci bulan itu).
  //
  // Konsekuensinya: bulan yang BELUM ditutup buku bulanan otomatis tercatat 0
  // di agregat tahunan ini (bukan diam-diam dihitung dari data mentahnya) dan
  // muncul sebagai peringatan checklist — supaya tidak ada sumber angka yang
  // bercampur di 1 laporan yang sama. Kalau butuh lihat estimasi LIVE tahun
  // ini sebelum semua bulan ditutup, pakai tab "Performa" > Tahunan (itu yang
  // hitung langsung dari data mentah, real-time).
  // ═══════════════════════════════════════════════════════════════════════
  function TutupBukuTahunan({ pushNotif }) {
    const [confirmAsk, confirmModal] = useConfirm();
    const [tahun, setTahun] = useState(() => new Date().toISOString().slice(0, 4)); // "YYYY"
    const [busy, setBusy] = useState(false);
    const [current, setCurrent] = useState(null); // baris tutupBukuTahunan is_current untuk tahun ini, kalau ada
    const [loadingCurrent, setLoadingCurrent] = useState(false);

    const bulanList = useMemo(() => Array.from({ length: 12 }, (_, i) => `${tahun}-${String(i + 1).padStart(2, "0")}`), [tahun]);

    // ─── Ambil status penutupan tahun yang sedang dipilih ───────────────────
    const loadCurrent = useCallback(async () => {
      setLoadingCurrent(true);
      try {
        const { data, error } = await sb
          .from("tutupBukuTahunan")
          .select("*")
          .eq("tahun", tahun)
          .eq("is_current", true)
          .maybeSingle();
        if (error) throw error;
        setCurrent(data || null);
      } catch (e) {
        pushNotif("Gagal cek status tutup buku tahunan: " + (e?.message || e), "warning");
      } finally {
        setLoadingCurrent(false);
      }
    }, [tahun]);

    useEffect(() => { loadCurrent(); }, [loadCurrent]);

    // ─── Ambil 12 snapshot bulanan yang sudah resmi tertutup untuk tahun ini ─
    const ambilSnapshotBulanan = async () => {
      const { data, error } = await sb
        .from("tutupBuku")
        .select("*")
        .gte("bulan", tahun + "-01")
        .lte("bulan", tahun + "-12")
        .eq("is_current", true);
      if (error) throw error;
      return data || [];
    };

    // ─── Checklist: pastikan semua bulan (yang sudah lewat) di tahun ini
    // sudah ditutup buku bulanan dulu, sebelum boleh tutup tahunan ──────────
    const runChecklist = async () => {
      setBusy(true);
      try {
        const warnings = [];
        const rows = await ambilSnapshotBulanan();
        const bulanSudahTutup = new Set(rows.map((r) => r.bulan));
        // Cuma bulan yang sudah lewat/berjalan yang wajib dicek — bulan masa
        // depan di tahun yang sama jelas belum bisa ditutup, bukan masalah.
        const bulanIni = today().slice(0, 7);
        const belumTutup = bulanList.filter((b) => b <= bulanIni && !bulanSudahTutup.has(b));
        if (belumTutup.length > 0) {
          warnings.push(`${belumTutup.length} bulan belum ditutup buku bulanan: ${belumTutup.join(", ")}. Bulan-bulan ini TIDAK ikut terhitung di Tutup Buku Tahunan sampai ditutup dulu lewat menu Bulanan.`);
        }
        const ditutupDenganPeringatan = rows.filter((r) => (r.checklist_warnings || []).length > 0);
        if (ditutupDenganPeringatan.length > 0) {
          warnings.push(`${ditutupDenganPeringatan.length} bulan sebelumnya ditutup dengan peringatan yang dipaksa lewat: ${ditutupDenganPeringatan.map((r) => r.bulan).join(", ")}.`);
        }
        return warnings;
      } catch (e) {
        pushNotif("Gagal jalankan checklist: " + (e?.message || e), "warning");
        return null;
      } finally {
        setBusy(false);
      }
    };

    // ─── Hitung snapshot tahunan — AGREGASI dari 12 snapshot bulanan ────────
    const hitungSnapshot = async () => {
      const rows = await ambilSnapshotBulanan();
      const investorsAll = S.get("investors") || [];

      const omzet = rows.reduce((a, r) => a + (r.omzet || 0), 0);
      const hpp = rows.reduce((a, r) => a + (r.hpp || 0), 0);
      const pengeluaranLapak = rows.reduce((a, r) => a + (r.pengeluaran_lapak || 0), 0);
      const pengeluaranOwner = rows.reduce((a, r) => a + (r.pengeluaran_owner || 0), 0);
      const gajiTotal = rows.reduce((a, r) => a + (r.gaji_total || 0), 0);
      const labaBersih = rows.reduce((a, r) => a + (r.laba_bersih || 0), 0);
      const txCount = rows.reduce((a, r) => a + (r.tx_count || 0), 0);

      // ─── Ringkasan per bulan, buat tabel tren 12 bulan di laporan ─────────
      const perBulan = bulanList.map((b) => {
        const r = rows.find((x) => x.bulan === b);
        return {
          bulan: b, ditutup: !!r,
          omzet: r?.omzet || 0, hpp: r?.hpp || 0,
          pengeluaran: (r?.pengeluaran_lapak || 0) + (r?.pengeluaran_owner || 0),
          laba: r?.laba_bersih || 0, txCount: r?.tx_count || 0,
        };
      });

      // ─── Agregasi per cabang, dari detail.perCabang tiap snapshot bulanan ─
      const perCabangMap = {};
      rows.forEach((r) => {
        (r.detail?.perCabang || []).forEach((c) => {
          if (!perCabangMap[c.branchId]) {
            perCabangMap[c.branchId] = {
              branchId: c.branchId, nama: c.nama, tipe: c.tipe,
              investorId: c.investorId || null, investorNama: c.investorNama || null,
              omzet: 0, hpp: 0, pengeluaranLapak: 0, pengeluaranOwner: 0, laba: 0, txCount: 0,
            };
          }
          const acc = perCabangMap[c.branchId];
          acc.omzet += c.omzet || 0; acc.hpp += c.hpp || 0;
          acc.pengeluaranLapak += c.pengeluaranLapak || 0; acc.pengeluaranOwner += c.pengeluaranOwner || 0;
          acc.laba += c.laba || 0; acc.txCount += c.txCount || 0;
        });
      });
      const perCabang = Object.values(perCabangMap);

      // ─── Total mandiri vs investasi — dihitung dari perCabang agregat di
      // atas (BUKAN dari kolom totalMandiri/totalInvestasi tiap bulan),
      // supaya tetap benar walau ada snapshot bulan lama dari SEBELUM fix
      // bug totalMandiri/totalInvestasi di hitungSnapshot (TutupBuku) ───────
      const sumTipe = (tipe) => {
        const rowsT = perCabang.filter((c) => (tipe === "investasi" ? c.tipe === "investasi" : c.tipe !== "investasi"));
        return {
          omzet: rowsT.reduce((a, c) => a + c.omzet, 0),
          hpp: rowsT.reduce((a, c) => a + c.hpp, 0),
          pengeluaran: rowsT.reduce((a, c) => a + c.pengeluaranLapak + c.pengeluaranOwner, 0),
          laba: rowsT.reduce((a, c) => a + c.laba, 0),
          txCount: rowsT.reduce((a, c) => a + c.txCount, 0),
        };
      };
      const totalMandiri = sumTipe("mandiri");
      const totalInvestasi = sumTipe("investasi");

      const perInvestor = investorsAll.map((inv) => {
        const rowsT = perCabang.filter((c) => c.tipe === "investasi" && c.investorId === inv.id);
        return {
          investorId: inv.id, investorNama: inv.nama,
          cabang: rowsT.map((c) => c.nama),
          omzet: rowsT.reduce((a, c) => a + c.omzet, 0),
          hpp: rowsT.reduce((a, c) => a + c.hpp, 0),
          pengeluaran: rowsT.reduce((a, c) => a + c.pengeluaranLapak + c.pengeluaranOwner, 0),
          laba: rowsT.reduce((a, c) => a + c.laba, 0),
        };
      }).filter((i) => i.cabang.length > 0);

      return {
        omzet, hpp, pengeluaranLapak, pengeluaranOwner, gajiTotal, labaBersih, txCount,
        bulanTertutup: rows.length,
        detail: { perBulan, perCabang, perInvestor, totalMandiri, totalInvestasi },
      };
    };

    // ─── Aksi: Tutup Buku Tahunan ────────────────────────────────────────────
    const doClose = async (forcedWarnings) => {
      setBusy(true);
      try {
        const snap = await hitungSnapshot();
        const { data: sess } = await sb.auth.getSession();
        const uid = sess?.session?.user?.id || null;

        const { error } = await sb.from("tutupBukuTahunan").insert({
          tahun,
          versi: (current?.versi || 0) + 1,
          is_current: true,
          omzet: snap.omzet,
          hpp: snap.hpp,
          pengeluaran_lapak: snap.pengeluaranLapak,
          pengeluaran_owner: snap.pengeluaranOwner,
          gaji_total: snap.gajiTotal,
          laba_bersih: snap.labaBersih,
          tx_count: snap.txCount,
          bulan_tertutup: snap.bulanTertutup,
          detail: snap.detail,
          checklist_warnings: forcedWarnings || [],
          closed_by: uid,
        });
        if (error) throw error;

        await loadCurrent();
        pushNotif(`Buku tahun ${tahun} berhasil ditutup.`, "success");
      } catch (e) {
        pushNotif("Gagal tutup buku tahunan: " + (e?.message || e), "warning");
      } finally {
        setBusy(false);
      }
    };

    const askClose = async () => {
      const warnings = await runChecklist();
      if (warnings === null) return;

      if (warnings.length === 0) {
        confirmAsk({
          title: "Tutup Buku Tahunan " + tahun,
          message: "Semua bulan tahun ini sudah ditutup buku bulanan. Tutup Buku Tahunan akan mengagregasi 12 angka resmi bulanan itu jadi 1 laporan tahunan. Lanjutkan?",
          onConfirm: () => doClose([]),
        });
      } else {
        confirmAsk({
          title: "⚠️ Ada yang belum beres — tetap tutup buku tahunan?",
          message: warnings.join("\n") + "\n\nKamu tetap bisa memaksa tutup buku tahunan, tapi bulan yang belum ditutup TIDAK ikut terhitung sampai ditutup menyusul (butuh versi baru kalau mau update). Lanjutkan?",
          onConfirm: () => doClose(warnings),
        });
      }
    };

    // ─── Aksi: Buka Kunci (Reopen) ───────────────────────────────────────────
    const askReopen = () => {
      confirmAsk({
        title: "Buka Kunci Buku Tahunan " + tahun,
        message: "Ketik alasan buka kunci (wajib diisi, akan tersimpan permanen di riwayat):",
        requireText: true,
        textLabel: "Alasan buka kunci",
        textPlaceholder: "Contoh: ada bulan yang perlu ditutup ulang setelah koreksi...",
        confirmLabel: "Buka Kunci",
        onConfirm: async (reasonInput) => {
          if (!reasonInput || !reasonInput.trim()) {
            pushNotif("Alasan wajib diisi untuk buka kunci buku tahunan.", "warning");
            throw new Error("Alasan kosong");
          }
          setBusy(true);
          try {
            const { data: sess } = await sb.auth.getSession();
            const uid = sess?.session?.user?.id || null;
            const { error } = await sb
              .from("tutupBukuTahunan")
              .update({ is_current: false, reopened_by: uid, reopened_at: new Date().toISOString(), reopen_reason: reasonInput.trim() })
              .eq("id", current.id);
            if (error) throw error;
            await loadCurrent();
            pushNotif("Buku tahunan dibuka. Jangan lupa tutup ulang setelah selesai koreksi.", "warning");
          } catch (e) {
            pushNotif("Gagal buka kunci: " + (e?.message || e), "warning");
            throw e;
          } finally {
            setBusy(false);
          }
        },
      });
    };

    // ─── Export Excel — baca dari snapshot beku, BUKAN hitung ulang ─────────
    const exportExcel = () => {
      if (!current) { pushNotif("Belum ada buku tahunan yang ditutup untuk tahun ini.", "warning"); return; }
      if (typeof XLSX === "undefined") {
        pushNotif("Library Excel belum termuat. Pastikan xlsx.full.min.js sudah ditambahkan di index.html.", "warning");
        return;
      }
      const d = current.detail || {};
      const wb = XLSX.utils.book_new();

      const ringkasan = [
        ["Tahun", current.tahun],
        ["Versi", current.versi],
        ["Ditutup pada", current.closed_at],
        ["Bulan tertutup", (current.bulan_tertutup ?? 0) + " / 12"],
        [],
        ["Penjualan", current.omzet],
        ["HPP", current.hpp],
        ["Pengeluaran Lapak", current.pengeluaran_lapak],
        ["Pengeluaran Owner", current.pengeluaran_owner],
        ["Gaji (info status bayar — sudah termasuk di Pengeluaran Owner, bukan biaya tambahan)", current.gaji_total],
        ["Laba Bersih", current.laba_bersih],
        ["Jumlah Transaksi", current.tx_count],
      ];
      XLSX.utils.book_append_sheet(wb, styledSummarySheet(ringkasan, [5, 6, 7, 8, 9, 10]), "Ringkasan");

      if (d.perBulan) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.perBulan), "Per Bulan");
      if (d.perCabang) XLSX.utils.book_append_sheet(wb, styledJsonSheet(d.perCabang), "Per Cabang");
      if (d.perInvestor) XLSX.utils.book_append_sheet(wb, styledJsonSheet(
        d.perInvestor.map((i) => ({ ...i, cabang: (i.cabang || []).join(", ") }))
      ), "Per Investor");

      XLSX.writeFile(wb, `TutupBukuTahunan_${current.tahun}_v${current.versi}.xlsx`);
    };

    // ─── Export Excel KHUSUS 1 investor — file terpisah, sama alasannya
    // seperti versi bulanan (lihat exportExcelInvestor di TutupBuku) ────────
    const exportExcelInvestor = (investorId) => {
      if (!current) { pushNotif("Belum ada buku tahunan yang ditutup untuk tahun ini.", "warning"); return; }
      if (typeof XLSX === "undefined") { pushNotif("Library Excel belum termuat.", "warning"); return; }

      const d = current.detail || {};
      const info = (d.perInvestor || []).find((i) => i.investorId === investorId);
      if (!info) { pushNotif("Data investor ini tidak ditemukan di snapshot tahun ini.", "warning"); return; }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet([
        ["Investor", info.investorNama],
        ["Tahun", current.tahun],
        ["Cabang", info.cabang.join(", ")],
        [],
        ["Penjualan", info.omzet],
        ["HPP", info.hpp],
        ["Biaya", info.pengeluaran],
        ["Laba", info.laba],
      ])), "Ringkasan");

      XLSX.writeFile(wb, `Laporan_${info.investorNama}_Tahun${current.tahun}.xlsx`);
    };

    // ─── UI ──────────────────────────────────────────────────────────────────
    return React.createElement("div", { className: "card" },
      React.createElement("h3", null, "Tutup Buku Tahunan"),
      React.createElement("select", { className: "inp", value: tahun, onChange: (e) => setTahun(e.target.value), disabled: busy },
        Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i).map((y) =>
          React.createElement("option", { key: y, value: String(y) }, String(y))
        )
      ),

      loadingCurrent && React.createElement("p", null, "Memuat status..."),

      !loadingCurrent && current && React.createElement("div", { className: "info-box" },
        React.createElement("p", null, `✅ Tahun ${tahun} SUDAH DITUTUP (versi ${current.versi}) pada ${current.closed_at}. (${current.bulan_tertutup ?? 0}/12 bulan resmi tertutup ikut terhitung.)`),
        current.checklist_warnings?.length > 0 && React.createElement("p", { style: { color: "var(--red)" } },
          "Ditutup dengan peringatan: " + current.checklist_warnings.join("; ")
        ),
        current.detail?.totalMandiri && React.createElement("p", null,
          `Laba Cabang Mandiri (punya sendiri): Rp${current.detail.totalMandiri.laba?.toLocaleString?.("id-ID") ?? current.detail.totalMandiri.laba}`
        ),
        current.detail?.totalInvestasi && React.createElement("p", null,
          `Laba Cabang Investasi (harus dibagi ke investor): Rp${current.detail.totalInvestasi.laba?.toLocaleString?.("id-ID") ?? current.detail.totalInvestasi.laba}`
        ),
        React.createElement("div", { className: "mt8" },
          React.createElement("h4", null, "Ringkasan per Bulan"),
          (current.detail?.perBulan || []).map((b) =>
            React.createElement("div", {
              key: b.bulan, style: { display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)", opacity: b.ditutup ? 1 : 0.5 },
            },
              React.createElement("span", null, b.bulan, !b.ditutup && " (belum ditutup)"),
              React.createElement("span", null, "Omzet ", fmtRp(b.omzet), " · Laba ", fmtRp(b.laba))
            )
          )
        ),
        React.createElement("button", { className: "btn-secondary mt8", onClick: exportExcel, disabled: busy }, "📥 Download Excel Lengkap (Owner)"),
        (current.detail?.perInvestor || []).map((inv) =>
          React.createElement("button", {
            key: inv.investorId, className: "btn-secondary", disabled: busy,
            onClick: () => exportExcelInvestor(inv.investorId),
          }, `📥 Excel untuk ${inv.investorNama}`)
        ),
        React.createElement("button", { className: "btn-danger-sm", onClick: askReopen, disabled: busy }, "Buka Kunci")
      ),

      !loadingCurrent && !current && React.createElement("div", null,
        React.createElement("p", null, `Tahun ${tahun} belum ditutup buku tahunan.`),
        React.createElement("button", { className: "btn-primary", onClick: askClose, disabled: busy }, busy ? "Memproses..." : "Tutup Buku Tahun Ini")
      ),

      confirmModal
    );
  }

  // ─── TutupBukuPanel — toggle Bulanan/Tahunan di 1 tab menu yang sama
  // ("Tutup bulan"), supaya tidak perlu nambah item baru di sidebar. Pola
  // togglenya sama seperti Mingguan/Bulanan/Tahunan di PerformaPeriode. ─────
  // ─── BelanjaPanel — belanja 2 langkah: ambil uang → terima barang ────────
  // Data disimpan di tabel "pengambilanBelanja" (sudah ada), diperluas field:
  //   status: "menunggu" | "diterima" | "dibatalkan"
  //   bahanId/bahanNama (null = belanja umum/campur), qtyDatang, jumlahTerpakai,
  //   qtyOwner (klaim owner utk cek selisih), inputBy, terimaBy
  // ─── PesananPanel — Pesanan & Reseller (gabungan) + daftar reseller ───────
  // ─── ShiftKasPanel — buka/tutup kas laci per pekerja, deteksi selisih ─────
  function ShiftKasPanel({ pushNotif, me, fixedBranchId }) {
    const tick = useStoreTick();
    const [busy, setBusy] = useState(false);
    const [confirmAsk, confirmModal] = useConfirm();
    const branches = (S.get("branches") || []).filter((b) => b.type !== "central_kitchen");
    const [selBranchState, setSelBranch] = useState("");
    const selBranch = fixedBranchId || selBranchState;
    useEffect(() => { if (!fixedBranchId && !selBranchState && branches.length) setSelBranch(branches[0].id); }, [branches.length, fixedBranchId]);

    const shiftBuka = selBranch ? getShiftBuka(selBranch) : null;
    const namaSaya = me?.display_name || me?.displayName || me?.email || "Pekerja";

    const [modalAwal, setModalAwal] = useState("");
    const [tunaiFisik, setTunaiFisik] = useState("");
    const [catatan, setCatatan] = useState("");

    // Hitung penjualan tunai & pengeluaran sejak shift dibuka (untuk 'seharusnya')
    const hitungSejakBuka = () => {
      if (!shiftBuka) return { tunai: 0, peng: 0 };
      const sejak = shiftBuka.bukaTs || "";
      const txs = (S.get("transactions") || []).filter((t) => t.branchId === selBranch && (t.ts || "") >= sejak);
      let tunai = 0;
      txs.forEach((t) => {
        const m = t.metodeBayar || "tunai";
        if (m === "tunai") tunai += Number(t.total) || 0;
        else if (m === "campuran") tunai += Math.max(0, (Number(t.jumlahBayar) || 0) - (Number(t.kembalian) || 0));
      });
      const peng = (S.get("pengeluaranLapak") || []).filter((p) => p.branchId === selBranch && (p.ts || "") >= sejak).reduce((a, p) => a + (Number(p.jumlah) || 0), 0);
      return { tunai, peng };
    };
    const sejak = hitungSejakBuka();
    const seharusnya = shiftBuka ? (shiftBuka.modalAwal + sejak.tunai - sejak.peng) : 0;
    const fisikN = parseFloat(tunaiFisik) || 0;
    const selisihPreview = fisikN - seharusnya;

    const bukaKas = async () => {
      if (getShiftBuka(selBranch)) { pushNotif("Masih ada shift terbuka. Tutup dulu.", "warning"); return; }
      const m = parseFloat(modalAwal) || 0;
      setBusy(true);
      try {
        const _sh = { id: uid(), branchId: selBranch, tanggal: today(), pekerja: namaSaya, userId: me?.user_id || null, modalAwal: m, status: "buka", bukaTs: nowIso() }; await mutateLedger(loadShiftFromDb, (list) => { if (list.some((s) => s.branchId === selBranch && s.status === "buka")) throw new Error("Sudah ada shift terbuka di lapak ini (mungkin dibuka orang lain). Muat ulang."); return [...list, _sh]; }, saveShiftToDb);
        setModalAwal("");
        pushNotif("Kas dibuka. Selamat bekerja!", "success");
      } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
    };

    const tutupKas = async () => {
      if (!shiftBuka) return;
      if (tunaiFisik === "") { pushNotif("Isi uang fisik yang dihitung.", "warning"); return; }
      const proceed = async () => {
        setBusy(true);
        try {
          await mutateLedger(loadShiftFromDb, (list) => list.map((s) => s.id === shiftBuka.id ? {
            ...s, status: "tutup", tutupTs: nowIso(),
            penjualanTunai: sejak.tunai, pengeluaranTunai: sejak.peng,
            tunaiFisik: fisikN, seharusnya, selisih: selisihPreview, catatan: catatan || null
          } : s), saveShiftToDb);
          setTunaiFisik(""); setCatatan("");
          const info = Math.abs(selisihPreview) < 1 ? "Pas \u2705" : (selisihPreview < 0 ? ("Kurang " + fmtRp(Math.abs(selisihPreview))) : ("Lebih " + fmtRp(selisihPreview)));
          pushNotif("Kas ditutup. " + info, Math.abs(selisihPreview) < 1 ? "success" : "warning");
        } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
      };
      if (Math.abs(selisihPreview) >= 1) {
        confirmAsk({ title: "Ada Selisih Kas", message: (selisihPreview < 0 ? "KURANG " : "LEBIH ") + fmtRp(Math.abs(selisihPreview)) + ". Tetap tutup kas?", confirmLabel: "Tutup", onConfirm: proceed });
        return;
      }
      proceed();
    };

    // Batalkan shift yang sedang terbuka (mis. salah input modal awal)
    const batalShift = () => {
      if (!shiftBuka) return;
      confirmAsk({
        title: "Batalkan Shift", danger: true, confirmLabel: "Batalkan",
        message: "Batalkan shift yang sedang terbuka (modal awal " + fmtRp(shiftBuka.modalAwal) + ")? Catatan buka kas ini akan dihapus. Gunakan kalau modal awal salah input.",
        onConfirm: async () => {
          setBusy(true);
          try {
            await mutateLedger(loadShiftFromDb, (list) => list.filter((s) => s.id !== shiftBuka.id), saveShiftToDb);
            pushNotif("Shift dibatalkan. Silakan buka kas ulang dengan angka benar.", "success");
          } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
        }
      });
    };

    const riwayat = getShiftList().filter((s) => s.branchId === selBranch && s.status === "tutup").sort((a, b) => (b.tutupTs || "").localeCompare(a.tutupTs || "")).slice(0, 30);
    const branchNama = (branches.find((b) => b.id === selBranch) || {}).name || "-";

    return React.createElement("div", { className: "card" },
      confirmModal,
      React.createElement("h3", null, "\uD83D\uDD10 Shift Kas"),
      React.createElement("p", { className: "info-txt", style: { marginTop: -4 } }, "Buka kas (modal laci) di awal jaga, tutup kas di akhir. Sistem cek selisih uang otomatis \u2014 anti-bocor."),
      !fixedBranchId && React.createElement("div", { className: "filter-bar mb8", style: { alignItems: "center", gap: 8 } },
        React.createElement("label", { style: { fontSize: 12, color: "var(--text2)", fontWeight: 700 } }, "Lapak:"),
        React.createElement("select", { className: "inp inp-sm", value: selBranch, onChange: (e) => setSelBranch(e.target.value) },
          branches.length === 0 && React.createElement("option", null, "Belum ada cabang"),
          branches.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name))
        )
      ),

      !shiftBuka
        // ── Buka kas ──
        ? React.createElement("div", { className: "form-card" },
            React.createElement("h4", null, "Buka Kas \u2014 " + branchNama),
            React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Hitung uang kembalian yang ada di laci sekarang, lalu buka kas."),
            React.createElement("div", { className: "field-group" },
              React.createElement("label", null, "Modal awal di laci (Rp)"),
              React.createElement("input", { className: "inp", type: "number", inputMode: "numeric", value: modalAwal, onChange: (e) => setModalAwal(e.target.value), placeholder: "Contoh: 200000" })
            ),
            React.createElement("button", { className: "btn-primary mt8", disabled: busy, onClick: bukaKas }, busy ? "..." : "\uD83D\uDD13 Buka Kas & Mulai Shift")
          )
        // ── Tutup kas ──
        : React.createElement("div", { className: "form-card" },
            React.createElement("h4", null, "Tutup Kas \u2014 " + branchNama),
            React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Shift dibuka oleh " + shiftBuka.pekerja + " \u00B7 " + String(shiftBuka.bukaTs || "").slice(11, 16)),
            React.createElement("div", { className: "shiftkas-rows" },
              React.createElement("div", { className: "kpi" }, React.createElement("span", null, "Modal awal"), React.createElement("span", null, fmtRp(shiftBuka.modalAwal))),
              React.createElement("div", { className: "kpi" }, React.createElement("span", null, "Penjualan tunai shift ini"), React.createElement("span", null, fmtRp(sejak.tunai))),
              sejak.peng > 0 && React.createElement("div", { className: "kpi" }, React.createElement("span", null, "Pengeluaran dari laci"), React.createElement("span", null, "\u2212 " + fmtRp(sejak.peng))),
              React.createElement("div", { className: "kpi", style: { fontWeight: 800 } }, React.createElement("span", null, "Seharusnya di laci"), React.createElement("span", { style: { fontSize: 18 } }, fmtRp(seharusnya)))
            ),
            React.createElement("div", { className: "field-group mt8" },
              React.createElement("label", null, "Uang fisik dihitung sekarang (Rp)"),
              React.createElement("input", { className: "inp", type: "number", inputMode: "numeric", value: tunaiFisik, onChange: (e) => setTunaiFisik(e.target.value), placeholder: String(seharusnya) })
            ),
            tunaiFisik !== "" && React.createElement("div", {
              className: "shiftkas-selisih " + (Math.abs(selisihPreview) < 1 ? "sk-ok" : "sk-bad")
            }, Math.abs(selisihPreview) < 1 ? "\u2705 PAS \u2014 uang cocok" : (selisihPreview < 0 ? ("\u26A0\uFE0F KURANG " + fmtRp(Math.abs(selisihPreview))) : ("Lebih " + fmtRp(selisihPreview)))),
            Math.abs(selisihPreview) >= 1 && tunaiFisik !== "" && React.createElement("div", { className: "field-group mt8" },
              React.createElement("label", null, "Catatan selisih (opsional)"),
              React.createElement("input", { className: "inp", value: catatan, onChange: (e) => setCatatan(e.target.value), placeholder: "Contoh: kembalian kurang / salah hitung" })
            ),
            React.createElement("div", { className: "row-wrap mt8" },
              React.createElement("button", { className: "btn-primary", disabled: busy, onClick: tutupKas }, busy ? "..." : "\uD83D\uDD12 Tutup Kas & Akhiri Shift"),
              React.createElement("button", { className: "btn-secondary btn-sm", disabled: busy, onClick: batalShift }, "Batalkan (salah modal)")
            )
          ),

      // ── Riwayat ──
      React.createElement("h4", { className: "sub-title mt12" }, "Riwayat shift"),
      riwayat.length === 0
        ? React.createElement("p", { className: "info-txt" }, "Belum ada shift selesai.")
        : React.createElement("div", { style: { overflowX: "auto" } },
            React.createElement("table", { className: "tbl", style: { width: "100%", fontSize: 12.5 } },
              React.createElement("thead", null, React.createElement("tr", null,
                React.createElement("th", { style: { textAlign: "left" } }, "Tgl"),
                React.createElement("th", { style: { textAlign: "left" } }, "Pekerja"),
                React.createElement("th", { style: { textAlign: "right" } }, "Seharusnya"),
                React.createElement("th", { style: { textAlign: "right" } }, "Selisih")
              )),
              React.createElement("tbody", null,
                riwayat.map((s) => React.createElement("tr", { key: s.id },
                  React.createElement("td", null, s.tanggal),
                  React.createElement("td", null, s.pekerja),
                  React.createElement("td", { style: { textAlign: "right" } }, fmtRp(s.seharusnya || 0)),
                  React.createElement("td", { style: { textAlign: "right", color: Math.abs(s.selisih || 0) < 1 ? "var(--green)" : "var(--red)", fontWeight: 700 } }, Math.abs(s.selisih || 0) < 1 ? "Pas" : (s.selisih < 0 ? "\u2212" : "+") + fmtRp(Math.abs(s.selisih || 0)))
                ))
              )
            )
          )
    );
  }

  function PesananPanel({ pushNotif, me }) {
    const tick = useStoreTick();
    const [subtab, setSubtab] = useState("baru"); // baru | daftar | reseller
    const [busy, setBusy] = useState(false);
    const [confirmAsk, confirmModal] = useConfirm();
    const resellers = getResellerList();
    const pesananAll = getPesananList().slice().sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));

    // form pesanan baru
    const [f, setF] = useState({ kategori: "pesanan", nama: "", resellerId: "", isi: "", total: "", bayar: "lunas", dp: "", ambil: "sudah", tglAmbil: "", catatan: "" });
    const resetF = () => setF({ kategori: "pesanan", nama: "", resellerId: "", isi: "", total: "", bayar: "lunas", dp: "", ambil: "sudah", tglAmbil: "", catatan: "" });

    const simpan = async () => {
      const total = parseFloat(f.total) || 0;
      let nama = f.nama.trim();
      if (f.kategori === "reseller") {
        const r = resellers.find((x) => x.id === f.resellerId);
        if (!r) { pushNotif("Pilih reseller dulu (atau tambah di tab Reseller).", "warning"); return; }
        nama = r.nama;
      }
      if (!nama) { pushNotif("Isi nama pemesan.", "warning"); return; }
      if (total <= 0) { pushNotif("Isi total harga.", "warning"); return; }
      const row = {
        id: uid(), kategori: f.kategori, nama, resellerId: f.kategori === "reseller" ? f.resellerId : null,
        isi: f.isi, total, bayar: f.bayar, dp: f.bayar === "dp" ? (parseFloat(f.dp) || 0) : 0,
        ambil: f.ambil, tglAmbil: f.ambil === "belum" ? (f.tglAmbil || null) : null,
        date: today(), ts: nowIso(), catatan: f.catatan || null
      };
      setBusy(true);
      try {
        await mutateLedger(loadPesananFromDb, (list) => [...list, row], savePesananToDb);
        resetF();
        pushNotif("Pesanan tersimpan.", "success");
        setSubtab("daftar");
      } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); }
      finally { setBusy(false); }
    };

    // Bayar / lunasi
    const bayarPesanan = (p) => confirmAsk({
      title: "Tandai Lunas", message: "Tandai pesanan " + p.nama + " (" + fmtRp(sisaUtangPesanan(p)) + " sisa) sebagai LUNAS?",
      confirmLabel: "Lunas", onConfirm: async () => {
        setBusy(true);
        try {
          await mutateLedger(loadPesananFromDb, (list) => list.map((x) => x.id === p.id ? { ...x, bayar: "lunas", dp: 0 } : x), savePesananToDb);
          pushNotif("Pembayaran diterima. Lunas.", "success");
        } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
      }
    });
    const tandaiAmbil = async (p) => {
      setBusy(true);
      try { await mutateLedger(loadPesananFromDb, (list) => list.map((x) => x.id === p.id ? { ...x, ambil: "sudah" } : x), savePesananToDb); pushNotif("Ditandai sudah diambil.", "success"); }
      catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
    };
    const hapusPesanan = (p) => confirmAsk({ title: "Hapus", message: "Hapus catatan " + p.nama + "?", danger: true, confirmLabel: "Hapus", onConfirm: async () => {
      setBusy(true); try { await mutateLedger(loadPesananFromDb, (list) => list.filter((x) => x.id !== p.id), savePesananToDb); pushNotif("Dihapus.", "success"); } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
    } });

    // Edit pesanan (isi / total / DP)
    const [editId, setEditId] = useState(null);
    const [ef, setEf] = useState({ isi: "", total: "", bayar: "lunas", dp: "" });
    const mulaiEditPesanan = (p) => { setEditId(p.id); setEf({ isi: p.isi || "", total: String(p.total || ""), bayar: p.bayar || "lunas", dp: String(p.dp || "") }); };
    const simpanEditPesanan = async () => {
      const total = parseFloat(ef.total) || 0;
      if (total <= 0) { pushNotif("Total harus lebih dari 0.", "warning"); return; }
      const dp = ef.bayar === "dp" ? (parseFloat(ef.dp) || 0) : 0;
      setBusy(true);
      try {
        await mutateLedger(loadPesananFromDb, (list) => list.map((x) => x.id === editId ? { ...x, isi: ef.isi, total, bayar: ef.bayar, dp } : x), savePesananToDb);
        setEditId(null); pushNotif("Pesanan diperbarui.", "success");
      } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
    };

    // Reseller CRUD
    const [nr, setNr] = useState({ nama: "", hp: "", hargaGrosirNote: "" });
    const tambahReseller = async () => {
      if (!nr.nama.trim()) { pushNotif("Isi nama reseller.", "warning"); return; }
      setBusy(true);
      try {
        if (nr.editId) {
          const eid = nr.editId;
          await mutateLedger(loadResellerFromDb, (list) => list.map((x) => x.id === eid ? { ...x, nama: nr.nama.trim(), hp: nr.hp.trim(), hargaGrosirNote: nr.hargaGrosirNote.trim() } : x), saveResellerToDb);
          setNr({ nama: "", hp: "", hargaGrosirNote: "" }); pushNotif("Reseller diperbarui.", "success");
        } else {
          const _r = { id: uid(), nama: nr.nama.trim(), hp: nr.hp.trim(), hargaGrosirNote: nr.hargaGrosirNote.trim() };
          await mutateLedger(loadResellerFromDb, (list) => [...list, _r], saveResellerToDb);
          setNr({ nama: "", hp: "", hargaGrosirNote: "" }); pushNotif("Reseller ditambah.", "success");
        }
      }
      catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
    };
    const editReseller = (r) => setNr({ editId: r.id, nama: r.nama, hp: r.hp || "", hargaGrosirNote: r.hargaGrosirNote || "" });
    const hapusReseller = (r) => confirmAsk({ title: "Hapus Reseller", message: "Hapus " + r.nama + "?", danger: true, confirmLabel: "Hapus", onConfirm: async () => {
      setBusy(true); try { await mutateLedger(loadResellerFromDb, (list) => list.filter((x) => x.id !== r.id), saveResellerToDb); pushNotif("Dihapus.", "success"); } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
    } });

    // KPI
    const totalPiutang = pesananAll.reduce((a, p) => a + sisaUtangPesanan(p), 0);
    const belumAmbil = pesananAll.filter((p) => p.ambil === "belum").length;

    const bayarPill = (p) => {
      if (p.bayar === "lunas") return React.createElement("span", { className: "pill-badge", style: { color: "var(--green)", borderColor: "var(--green)" } }, "Lunas");
      if (p.bayar === "dp") return React.createElement("span", { className: "pill-badge", style: { color: "var(--yellow)", borderColor: "var(--yellow)" } }, "DP " + fmtRp(p.dp));
      return React.createElement("span", { className: "pill-badge", style: { color: "var(--red)", borderColor: "var(--red)" } }, "Utang");
    };

    return React.createElement("div", { className: "card" },
      confirmModal,
      React.createElement("h3", null, "\uD83D\uDCCB Pesanan & Reseller"),
      React.createElement("p", { className: "info-txt", style: { marginTop: -4 } }, "Catat pesanan (harga normal) & reseller (harga grosir). Yang belum bayar masuk piutang; yang belum diambil jadi pengingat produksi."),
      React.createElement("div", { className: "kpi-grid" },
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Total piutang"), React.createElement("div", { className: "kpi-val", style: { color: totalPiutang > 0 ? "var(--red)" : "var(--text)" } }, fmtRp(totalPiutang))),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Belum diambil"), React.createElement("div", { className: "kpi-val", style: { color: belumAmbil ? "var(--yellow)" : "var(--text)" } }, belumAmbil)),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Total catatan"), React.createElement("div", { className: "kpi-val" }, pesananAll.length))
      ),
      React.createElement("div", { className: "tabs mb8 mt8" },
        React.createElement("button", { className: "tab" + (subtab === "baru" ? " active" : ""), onClick: () => setSubtab("baru") }, "\u2795 Baru"),
        React.createElement("button", { className: "tab" + (subtab === "daftar" ? " active" : ""), onClick: () => setSubtab("daftar") }, "\uD83D\uDCCB Daftar" + (totalPiutang > 0 ? " (!)" : "")),
        React.createElement("button", { className: "tab" + (subtab === "reseller" ? " active" : ""), onClick: () => setSubtab("reseller") }, "\uD83E\uDD1D Reseller")
      ),

      // ── Form baru ──
      subtab === "baru" && React.createElement("div", { className: "form-card" },
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Kategori"),
          React.createElement("div", { className: "seg-row" },
            React.createElement("button", { type: "button", className: "seg-btn" + (f.kategori === "pesanan" ? " seg-on-blue" : ""), onClick: () => setF((x) => ({ ...x, kategori: "pesanan" })) }, "\uD83D\uDCE6 Pesanan (harga normal)"),
            React.createElement("button", { type: "button", className: "seg-btn" + (f.kategori === "reseller" ? " seg-on-accent" : ""), onClick: () => setF((x) => ({ ...x, kategori: "reseller" })) }, "\uD83E\uDD1D Reseller (grosir)")
          )
        ),
        f.kategori === "reseller"
          ? React.createElement("div", { className: "field-group" },
              React.createElement("label", null, "Pilih reseller"),
              resellers.length === 0
                ? React.createElement("p", { className: "field-warning" }, "Belum ada reseller. Tambah dulu di tab Reseller.")
                : React.createElement("select", { className: "inp", value: f.resellerId, onChange: (e) => setF((x) => ({ ...x, resellerId: e.target.value })) },
                    React.createElement("option", { value: "" }, "\u2014 Pilih \u2014"),
                    resellers.map((r) => React.createElement("option", { key: r.id, value: r.id }, r.nama + (r.hargaGrosirNote ? " (" + r.hargaGrosirNote + ")" : "")))
                  )
            )
          : React.createElement("div", { className: "field-group" },
              React.createElement("label", null, "Nama pemesan"),
              React.createElement("input", { className: "inp", value: f.nama, onChange: (e) => setF((x) => ({ ...x, nama: e.target.value })), placeholder: "Contoh: Bu Rina (acara ultah)" })
            ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Isi pesanan"),
          React.createElement("input", { className: "inp", value: f.isi, onChange: (e) => setF((x) => ({ ...x, isi: e.target.value })), placeholder: "Contoh: 3 Box isi 6 campur" })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Total harga (Rp)" + (f.kategori === "reseller" ? " \u2014 grosir" : "")),
          React.createElement("input", { className: "inp", type: "number", inputMode: "numeric", value: f.total, onChange: (e) => setF((x) => ({ ...x, total: e.target.value })), placeholder: "Contoh: 150000" })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Status bayar"),
          React.createElement("div", { className: "seg-row" },
            ["lunas", "dp", "utang"].map((b) => React.createElement("button", { key: b, type: "button", className: "seg-btn seg-sm" + (f.bayar === b ? " seg-on-accent" : ""), onClick: () => setF((x) => ({ ...x, bayar: b })) }, b === "lunas" ? "Lunas" : b === "dp" ? "DP" : "Belum bayar"))
          )
        ),
        f.bayar === "dp" && React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Jumlah DP (Rp)"),
          React.createElement("input", { className: "inp", type: "number", inputMode: "numeric", value: f.dp, onChange: (e) => setF((x) => ({ ...x, dp: e.target.value })), placeholder: "Contoh: 50000" })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Status ambil"),
          React.createElement("div", { className: "seg-row" },
            React.createElement("button", { type: "button", className: "seg-btn seg-sm" + (f.ambil === "sudah" ? " seg-on-accent" : ""), onClick: () => setF((x) => ({ ...x, ambil: "sudah" })) }, "Sudah diambil"),
            React.createElement("button", { type: "button", className: "seg-btn seg-sm" + (f.ambil === "belum" ? " seg-on-accent" : ""), onClick: () => setF((x) => ({ ...x, ambil: "belum" })) }, "Belum (pesanan)")
          )
        ),
        f.ambil === "belum" && React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Tanggal ambil"),
          React.createElement("input", { className: "inp", type: "date", value: f.tglAmbil, onChange: (e) => setF((x) => ({ ...x, tglAmbil: e.target.value })) })
        ),
        React.createElement("button", { className: "btn-primary mt8", disabled: busy, onClick: simpan }, busy ? "Menyimpan..." : "+ Simpan")
      ),

      // ── Daftar ──
      subtab === "daftar" && React.createElement("div", null,
        pesananAll.length === 0
          ? React.createElement("p", { className: "info-txt" }, "Belum ada pesanan.")
          : pesananAll.map((p) => editId === p.id
            ? React.createElement("div", { key: p.id, className: "form-card mt8", style: { borderColor: "var(--accent)" } },
                React.createElement("h4", { style: { marginTop: 0 } }, "Edit: " + p.nama),
                React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Isi pesanan"), React.createElement("input", { className: "inp", value: ef.isi, onChange: (e) => setEf((x) => ({ ...x, isi: e.target.value })) })),
                React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Total (Rp)"), React.createElement("input", { className: "inp", type: "number", value: ef.total, onChange: (e) => setEf((x) => ({ ...x, total: e.target.value })) })),
                React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Status bayar"),
                  React.createElement("div", { className: "seg-row" },
                    ["lunas", "dp", "utang"].map((b) => React.createElement("button", { key: b, type: "button", className: "seg-btn seg-sm" + (ef.bayar === b ? " seg-on-accent" : ""), onClick: () => setEf((x) => ({ ...x, bayar: b })) }, b === "lunas" ? "Lunas" : b === "dp" ? "DP" : "Belum bayar"))
                  )
                ),
                ef.bayar === "dp" && React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Jumlah DP (Rp)"), React.createElement("input", { className: "inp", type: "number", value: ef.dp, onChange: (e) => setEf((x) => ({ ...x, dp: e.target.value })) })),
                React.createElement("div", { className: "row-wrap mt8" },
                  React.createElement("button", { className: "btn-primary btn-sm", disabled: busy, onClick: simpanEditPesanan }, "Simpan"),
                  React.createElement("button", { className: "btn-secondary btn-sm", onClick: () => setEditId(null) }, "Batal")
                )
              )
            : React.createElement("div", { key: p.id, className: "form-card mt8" },
              React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" } },
                React.createElement("div", null,
                  React.createElement("strong", null, p.nama, " "),
                  React.createElement("span", { className: "pill-badge", style: { color: p.kategori === "reseller" ? "var(--accent)" : "var(--blue)", borderColor: p.kategori === "reseller" ? "var(--accent)" : "var(--blue)" } }, p.kategori === "reseller" ? "Reseller" : "Pesanan"),
                  React.createElement("div", { style: { fontSize: 11.5, color: "var(--text2)", marginTop: 2 } }, p.isi || "-", p.ambil === "belum" ? (" \u00B7 ambil " + (p.tglAmbil || "?")) : "")
                ),
                React.createElement("div", { style: { textAlign: "right" } },
                  React.createElement("div", { style: { fontWeight: 800 } }, fmtRp(p.total)),
                  bayarPill(p)
                )
              ),
              React.createElement("div", { className: "row-wrap mt8" },
                sisaUtangPesanan(p) > 0 && React.createElement("button", { className: "btn-primary btn-sm", disabled: busy, onClick: () => bayarPesanan(p) }, "Lunasi " + fmtRp(sisaUtangPesanan(p))),
                p.ambil === "belum" && React.createElement("button", { className: "btn-secondary btn-sm", disabled: busy, onClick: () => tandaiAmbil(p) }, "Tandai diambil"),
                React.createElement("button", { className: "btn-secondary btn-sm", disabled: busy, onClick: () => mulaiEditPesanan(p) }, "\u270F\uFE0F Edit"),
                React.createElement("button", { className: "btn-secondary btn-sm", disabled: busy, onClick: () => hapusPesanan(p) }, "Hapus")
              )
            ))
      ),

      // ── Reseller ──
      subtab === "reseller" && React.createElement("div", null,
        React.createElement("div", { className: "form-card", style: nr.editId ? { borderColor: "var(--accent)" } : null },
          React.createElement("h4", null, nr.editId ? "\u270F\uFE0F Edit Reseller" : "Tambah Reseller"),
          React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Nama"), React.createElement("input", { className: "inp", value: nr.nama, onChange: (e) => setNr((x) => ({ ...x, nama: e.target.value })), placeholder: "Contoh: Bu Ani" })),
          React.createElement("div", { className: "field-group" }, React.createElement("label", null, "No. HP (opsional)"), React.createElement("input", { className: "inp", value: nr.hp, onChange: (e) => setNr((x) => ({ ...x, hp: e.target.value })), placeholder: "08xxx" })),
          React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Catatan harga grosir (opsional)"), React.createElement("input", { className: "inp", value: nr.hargaGrosirNote, onChange: (e) => setNr((x) => ({ ...x, hargaGrosirNote: e.target.value })), placeholder: "Contoh: donat Rp 2.500/pcs" })),
          React.createElement("div", { className: "row-wrap mt8" },
            React.createElement("button", { className: "btn-primary", disabled: busy, onClick: tambahReseller }, nr.editId ? "Simpan Perubahan" : "+ Tambah Reseller"),
            nr.editId && React.createElement("button", { className: "btn-secondary", onClick: () => setNr({ nama: "", hp: "", hargaGrosirNote: "" }) }, "Batal")
          )
        ),
        resellers.length > 0 && React.createElement("div", { className: "mt8" },
          resellers.map((r) => React.createElement("div", { key: r.id, className: "row-wrap", style: { justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" } },
            React.createElement("div", null,
              React.createElement("div", { style: { fontWeight: 700 } }, r.nama),
              React.createElement("div", { style: { fontSize: 11, color: "var(--text2)" } }, [r.hp, r.hargaGrosirNote].filter(Boolean).join(" \u00B7 ") || "\u2014")
            ),
            React.createElement("div", { className: "row-wrap", style: { gap: 6 } },
              React.createElement("button", { className: "btn-secondary btn-sm", disabled: busy, onClick: () => editReseller(r) }, "\u270F\uFE0F Edit"),
              React.createElement("button", { className: "btn-secondary btn-sm", disabled: busy, onClick: () => hapusReseller(r) }, "Hapus")
            )
          ))
        )
      )
    );
  }

  function BelanjaPanel({ pushNotif, me }) {
    const tick = useStoreTick();
    const [modalAwalBelanja, setModalAwalBelanja] = useState(0);
    useEffect(() => {
      sb.from("app_settings").select("value").eq("key", "kas_belanja_modal_awal").maybeSingle()
        .then(({ data }) => setModalAwalBelanja(Number(data?.value?.jumlah || 0) || 0))
        .catch(() => {});
    }, [tick]);
    const [subtab, setSubtab] = useState("ambil"); // ambil | terima | riwayat
    const [busy, setBusy] = useState(false);
    const [confirmAsk, confirmModal] = useConfirm();
    const bahanList = S.get("bahanPokok") || [];
    const topingList = S.get("topingTambahan") || [];
    // Gabungan item yang bisa dibelanjakan: bahan pokok + toping (glaze dkk)
    const itemBelanja = [
      ...bahanList.map((b) => ({ id: b.id, nama: b.nama, jenis: "bahan" })),
      ...topingList.map((t) => ({ id: t.id, nama: t.nama + " (toping)", jenis: "toping" }))
    ];

    const semuaBelanja = (S.get("pengambilanBelanja") || []).slice().sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    const distribAktif = (S.get("distribusiCK") || []).filter((d) => d.status !== "dibatalkan");
    const totalJatah = distribAktif.reduce((a, d) => a + (d.hppTotal || 0), 0);
    // Uang keluar = jumlah diambil (yang belum dibatalkan), dikurangi sisa yang dikembalikan
    const totalAmbil = semuaBelanja.filter((p) => p.status !== "dibatalkan").reduce((a, p) => {
      const diambil = Number(p.jumlah) || 0;
      const kembali = p.status === "diterima" && p.jumlahTerpakai != null ? Math.max(0, diambil - Number(p.jumlahTerpakai)) : 0;
      return a + (diambil - kembali);
    }, 0);
    const saldoKas = modalAwalBelanja + totalJatah - totalAmbil;

    const namaSaya = me?.display_name || me?.displayName || me?.email || "Owner";

    // ── Form ambil uang ──
    const [form, setForm] = useState({ itemId: "", umum: false, jumlah: "", keterangan: "", qtyOwner: "" });
    const submitAmbil = async () => {
      const jml = parseFloat(form.jumlah);
      if (!jml || jml <= 0) { pushNotif("Isi jumlah uang yang valid.", "warning"); return; }
      if (!form.umum && !form.itemId) { pushNotif("Pilih bahan/toping, atau centang 'Belanja umum'.", "warning"); return; }
      const item = itemBelanja.find((x) => x.id === form.itemId);
      const row = {
        id: uid(), date: today(), ts: nowIso(), jumlah: jml,
        bahanId: form.umum ? null : form.itemId,
        bahanNama: form.umum ? null : (item ? item.nama : null),
        jenisItem: form.umum ? "umum" : (item ? item.jenis : null),
        qtyOwner: form.qtyOwner ? parseFloat(form.qtyOwner) : null,
        keterangan: form.keterangan || (form.umum ? "Belanja umum/campur" : ("Belanja " + (item ? item.nama : ""))),
        status: "menunggu", inputBy: namaSaya,
        version: "belanja-2langkah@2026-07"
      };
      setBusy(true);
      try {
        let { error } = await sb.from("pengambilanBelanja").insert([row]);
        if (error && /column|schema|status|bahanId|qtyOwner|jenisItem|version/i.test(String(error.message || error))) {
          // fallback skema lama
          const slim = { id: row.id, date: row.date, ts: row.ts, jumlah: jml, keterangan: row.keterangan };
          const r2 = await sb.from("pengambilanBelanja").insert([slim]); error = r2.error;
          if (!error) pushNotif("Tersimpan (mode kompatibel). Jalankan SQL update agar alur 2-langkah penuh.", "warning");
        }
        if (error) throw error;
        await S.loadKey("pengambilanBelanja");
        setForm({ itemId: "", umum: false, jumlah: "", keterangan: "", qtyOwner: "" });
        pushNotif("Uang belanja diambil. Status: menunggu barang.", "success");
        setSubtab("terima");
      } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); }
      finally { setBusy(false); }
    };

    // ── Terima barang ──
    const menunggu = semuaBelanja.filter((p) => (p.status || "menunggu") === "menunggu");
    const [terimaForm, setTerimaForm] = useState({}); // { id: { qty, terpakai, updateHpp } }
    const setTF = (id, patch) => setTerimaForm((s) => ({ ...s, [id]: { ...(s[id] || {}), ...patch } }));

    const doTerima = async (p) => {
      const tf = terimaForm[p.id] || {};
      const qtyDatang = parseFloat(tf.qty);
      const terpakai = tf.terpakai !== "" && tf.terpakai != null ? parseFloat(tf.terpakai) : (Number(p.jumlah) || 0);
      if (p.bahanId && (!qtyDatang || qtyDatang <= 0)) { pushNotif("Isi jumlah barang datang (qty).", "warning"); return; }
      // Deteksi selisih dgn klaim owner (kalau ada)
      const selisih = (p.qtyOwner != null && qtyDatang) ? (qtyDatang - Number(p.qtyOwner)) : 0;
      const lanjut = async () => {
        setBusy(true);
        try {
          // 1) update baris belanja → diterima
          let { error } = await sb.from("pengambilanBelanja").update({
            status: "diterima", qtyDatang: qtyDatang || null, qtyYield: qtyDatang || null,
            jumlahTerpakai: terpakai, terimaBy: namaSaya, tsTerima: nowIso()
          }).eq("id", p.id);
          if (error && /column|schema/i.test(String(error.message||error))) {
            // fallback: minimal update status via delete+insert tidak aman; cukup abaikan kolom ekstra
            const r2 = await sb.from("pengambilanBelanja").update({ jumlah: terpakai }).eq("id", p.id); error = r2.error;
          }
          if (error) throw error;
          // 2) stok bahan/toping baru bertambah SEKARANG
          if (p.bahanId && qtyDatang > 0) {
            if (p.jenisItem === "toping") {
              // toping: tambah ke ledger toping sebagai stok CK (branchId khusus "CK")
              await catatStokTopingRows([{ branchId: "CK", topingId: p.bahanId, topingNama: (p.bahanNama||"").replace(" (toping)",""), tipe: "kirim", qty: qtyDatang, date: today(), note: "Belanja diterima" }]);
            } else {
              await catatStokBahanRows([{ bahanId: p.bahanId, bahanNama: p.bahanNama, tipe: "masuk", qty: qtyDatang, date: today(), note: "Belanja diterima (" + fmtRp(terpakai) + ")", refType: "belanja", refId: p.id }]);
            }
          }
          // 3) update HPP master bila diminta & ini bahan pokok
          if (tf.updateHpp && p.bahanId && p.jenisItem !== "toping" && qtyDatang > 0) {
            const b = bahanList.find((x) => x.id === p.bahanId);
            const kap = Math.max(parseInt(b?.kapasitas || 1) || 1, 1);
            const hargaPerBatch = terpakai * (kap / qtyDatang);
            await sb.from("bahanPokok").update({ hargaBeli: roundHppRp(hargaPerBatch) }).eq("id", p.bahanId);
            await S.loadKey("bahanPokok");
          }
          await S.loadKey("pengambilanBelanja");
          setTerimaForm((s) => { const n = { ...s }; delete n[p.id]; return n; });
          const sisa = Math.max(0, (Number(p.jumlah)||0) - terpakai);
          pushNotif("Barang masuk. Stok bertambah." + (sisa>0 ? " Sisa " + fmtRp(sisa) + " balik ke kas." : ""), "success");
        } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); }
        finally { setBusy(false); }
      };
      if (Math.abs(selisih) > 0.001) {
        confirmAsk({
          title: "\u26A0\uFE0F Ada Selisih",
          message: "Owner catat " + p.qtyOwner + ", tapi barang datang " + qtyDatang + " (selisih " + (selisih>0?"+":"") + selisih + "). Tetap terima?",
          confirmLabel: "Ya, terima", onConfirm: lanjut
        });
        return;
      }
      lanjut();
    };

    const batal = (p) => confirmAsk({
      title: "Batalkan Pengambilan", message: "Batalkan pengambilan " + fmtRp(p.jumlah) + "? Uang dianggap kembali penuh ke kas.",
      danger: true, confirmLabel: "Batalkan",
      onConfirm: async () => {
        setBusy(true);
        try {
          const { error } = await sb.from("pengambilanBelanja").update({ status: "dibatalkan" }).eq("id", p.id);
          if (error) throw error;
          await S.loadKey("pengambilanBelanja");
          pushNotif("Pengambilan dibatalkan, uang balik ke kas.", "success");
        } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); }
        finally { setBusy(false); }
      }
    });

    // ── Laporan per bahan (bulan ini) ──
    const bulan = today().slice(0, 7);
    const laporanPerBahan = useMemo(() => {
      const map = {};
      semuaBelanja.filter((p) => p.status !== "dibatalkan" && String(p.date || "").startsWith(bulan)).forEach((p) => {
        const key = p.bahanId || "__umum__";
        const nama = p.bahanNama || "Belanja umum/campur";
        if (!map[key]) map[key] = { nama, total: 0 };
        const diambil = Number(p.jumlah) || 0;
        const terpakai = p.status === "diterima" && p.jumlahTerpakai != null ? Number(p.jumlahTerpakai) : diambil;
        map[key].total += terpakai;
      });
      return Object.values(map).sort((a, b) => b.total - a.total);
    }, [semuaBelanja.length, tick]);
    const totalLaporan = laporanPerBahan.reduce((a, r) => a + r.total, 0);

    const statusPill = (st) => {
      const s = st || "menunggu";
      if (s === "diterima") return React.createElement("span", { className: "pill-badge", style: { color: "var(--green)", borderColor: "var(--green)" } }, "\u2713 Barang masuk");
      if (s === "dibatalkan") return React.createElement("span", { className: "pill-badge", style: { color: "var(--text2)" } }, "Dibatalkan");
      return React.createElement("span", { className: "pill-badge", style: { color: "var(--yellow)", borderColor: "var(--yellow)" } }, "\u23F3 Menunggu");
    };

    return React.createElement("div", { className: "card" },
      confirmModal,
      React.createElement("h3", null, "\uD83D\uDED2 Belanja Bahan (2 langkah)"),
      React.createElement("p", { className: "info-txt", style: { marginTop: -4 } },
        "Langkah 1: ambil uang (stok belum nambah). Langkah 2: barang datang \u2192 stok baru bertambah. Uang tercatat per bahan."),

      React.createElement("div", { className: "kpi-grid" },
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Saldo kas belanja"), React.createElement("div", { className: "kpi-val", style: { color: saldoKas < 0 ? "var(--red)" : "var(--green)" } }, fmtRp(saldoKas))),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Menunggu barang"), React.createElement("div", { className: "kpi-val", style: { color: menunggu.length ? "var(--yellow)" : "var(--text)" } }, menunggu.length)),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Belanja bulan ini"), React.createElement("div", { className: "kpi-val" }, fmtRp(totalLaporan)))
      ),

      React.createElement("div", { className: "tabs mb8 mt8" },
        React.createElement("button", { className: "tab" + (subtab === "ambil" ? " active" : ""), onClick: () => setSubtab("ambil") }, "\uD83D\uDCB8 Ambil Uang"),
        React.createElement("button", { className: "tab" + (subtab === "terima" ? " active" : ""), onClick: () => setSubtab("terima") }, "\uD83D\uDCE6 Terima Barang" + (menunggu.length ? " (" + menunggu.length + ")" : "")),
        React.createElement("button", { className: "tab" + (subtab === "riwayat" ? " active" : ""), onClick: () => setSubtab("riwayat") }, "\uD83D\uDCCA Laporan")
      ),

      // ── Ambil uang ──
      subtab === "ambil" && React.createElement("div", { className: "form-card" },
        React.createElement("h4", null, "Ambil Uang untuk Belanja"),
        React.createElement("label", { className: "pay-check", style: { marginBottom: 8 } },
          React.createElement("input", { type: "checkbox", checked: form.umum, onChange: (e) => setForm((f) => ({ ...f, umum: e.target.checked, itemId: "" })) }),
          " Belanja umum / campur (tanpa tag bahan tertentu)"
        ),
        !form.umum && React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Untuk bahan / toping"),
          React.createElement("select", { className: "inp", value: form.itemId, onChange: (e) => setForm((f) => ({ ...f, itemId: e.target.value })) },
            React.createElement("option", { value: "" }, "\u2014 Pilih \u2014"),
            itemBelanja.map((x) => React.createElement("option", { key: x.id, value: x.id }, x.nama))
          )
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Jumlah uang diambil (Rp)"),
          React.createElement("input", { className: "inp", type: "number", inputMode: "numeric", value: form.jumlah, onChange: (e) => setForm((f) => ({ ...f, jumlah: e.target.value })), placeholder: "Contoh: 200000" })
        ),
        !form.umum && React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Perkiraan barang (qty) \u2014 opsional, untuk cek selisih"),
          React.createElement("input", { className: "inp", type: "number", inputMode: "numeric", value: form.qtyOwner, onChange: (e) => setForm((f) => ({ ...f, qtyOwner: e.target.value })), placeholder: "Contoh: 20" })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Keterangan (opsional)"),
          React.createElement("input", { className: "inp", value: form.keterangan, onChange: (e) => setForm((f) => ({ ...f, keterangan: e.target.value })), placeholder: "Contoh: Belanja kentang ke pasar" })
        ),
        React.createElement("button", { className: "btn-primary mt8", disabled: busy, onClick: submitAmbil }, busy ? "Menyimpan..." : "\uD83D\uDCB8 Ambil Uang (status: menunggu)")
      ),

      // ── Terima barang ──
      subtab === "terima" && React.createElement("div", null,
        menunggu.length === 0
          ? React.createElement("p", { className: "info-txt" }, "Tidak ada belanja yang menunggu barang. Semua sudah diterima \uD83C\uDF89")
          : menunggu.map((p) => {
              const tf = terimaForm[p.id] || {};
              const isToping = p.jenisItem === "toping";
              return React.createElement("div", { key: p.id, className: "form-card mt8" },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 } },
                  React.createElement("div", null,
                    React.createElement("strong", null, p.bahanNama || "Belanja umum/campur"),
                    React.createElement("div", { style: { fontSize: 11, color: "var(--text2)" } }, p.date, " \u00B7 diambil ", fmtRp(p.jumlah), p.qtyOwner != null ? (" \u00B7 perkiraan " + p.qtyOwner) : "")
                  ),
                  statusPill(p.status)
                ),
                p.bahanId && React.createElement("div", { className: "field-group mt8" },
                  React.createElement("label", null, "Barang datang berapa? (" + (isToping ? "satuan toping" : "pcs yield") + ")"),
                  React.createElement("input", { className: "inp", type: "number", inputMode: "decimal", value: tf.qty == null ? "" : tf.qty, onChange: (e) => setTF(p.id, { qty: e.target.value }), placeholder: "jumlah barang" })
                ),
                React.createElement("div", { className: "field-group" },
                  React.createElement("label", null, "Uang benar-benar terpakai (Rp)"),
                  React.createElement("input", { className: "inp", type: "number", inputMode: "numeric", value: tf.terpakai == null ? "" : tf.terpakai, onChange: (e) => setTF(p.id, { terpakai: e.target.value }), placeholder: String(p.jumlah) }),
                  React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Kosongkan = pakai semua (" + fmtRp(p.jumlah) + "). Sisa otomatis balik ke kas.")
                ),
                p.bahanId && !isToping && React.createElement("label", { className: "pay-check" },
                  React.createElement("input", { type: "checkbox", checked: !!tf.updateHpp, onChange: (e) => setTF(p.id, { updateHpp: e.target.checked }) }),
                  " Harga berubah? Update HPP master"
                ),
                React.createElement("div", { className: "row-wrap mt8" },
                  React.createElement("button", { className: "btn-secondary btn-sm", disabled: busy, onClick: () => batal(p) }, "Batalkan"),
                  React.createElement("button", { className: "btn-primary btn-sm", disabled: busy, onClick: () => doTerima(p) }, "\u2705 Terima & Tambah Stok")
                )
              );
            })
      ),

      // ── Laporan ──
      subtab === "riwayat" && React.createElement("div", null,
        React.createElement("h4", { className: "sub-title" }, "Belanja per bahan \u2014 " + bulan),
        laporanPerBahan.length === 0
          ? React.createElement("p", { className: "info-txt" }, "Belum ada belanja bulan ini.")
          : React.createElement("div", { style: { overflowX: "auto" } },
              React.createElement("table", { className: "tbl", style: { width: "100%", fontSize: 13 } },
                React.createElement("thead", null, React.createElement("tr", null,
                  React.createElement("th", { style: { textAlign: "left" } }, "Bahan"),
                  React.createElement("th", { style: { textAlign: "right" } }, "Total belanja")
                )),
                React.createElement("tbody", null,
                  laporanPerBahan.map((r, i) => React.createElement("tr", { key: i },
                    React.createElement("td", null, r.nama),
                    React.createElement("td", { style: { textAlign: "right", color: "var(--accent)" } }, fmtRp(r.total))
                  )).concat([
                    React.createElement("tr", { key: "tot", style: { borderTop: "2px solid var(--border)", fontWeight: 800 } },
                      React.createElement("td", null, "TOTAL"),
                      React.createElement("td", { style: { textAlign: "right", color: "var(--green)" } }, fmtRp(totalLaporan))
                    )
                  ])
                )
              )
            ),
        React.createElement("h4", { className: "sub-title mt8" }, "Riwayat pengambilan"),
        React.createElement("div", { style: { overflowX: "auto" } },
          React.createElement("table", { className: "tbl", style: { width: "100%", fontSize: 12.5 } },
            React.createElement("thead", null, React.createElement("tr", null,
              React.createElement("th", { style: { textAlign: "left" } }, "Tgl"),
              React.createElement("th", { style: { textAlign: "left" } }, "Bahan"),
              React.createElement("th", { style: { textAlign: "right" } }, "Diambil"),
              React.createElement("th", { style: { textAlign: "right" } }, "Terpakai"),
              React.createElement("th", { style: { textAlign: "left" } }, "Status")
            )),
            React.createElement("tbody", null,
              semuaBelanja.slice(0, 40).map((p) => React.createElement("tr", { key: p.id },
                React.createElement("td", null, p.date),
                React.createElement("td", null, p.bahanNama || "Umum"),
                React.createElement("td", { style: { textAlign: "right" } }, fmtRp(p.jumlah)),
                React.createElement("td", { style: { textAlign: "right" } }, p.status === "diterima" && p.jumlahTerpakai != null ? fmtRp(p.jumlahTerpakai) : "-"),
                React.createElement("td", null, statusPill(p.status))
              ))
            )
          )
        )
      )
    );
  }

  // ─── StokTopingPanel — kirim toping ke lapak + opname harian (owner) ──────
  function StokTopingPanel({ pushNotif }) {
    const tick = useStoreTick();
    const [subtab, setSubtab] = useState("opname"); // "opname" | "kirim" | "riwayat"
    const [selBranch, setSelBranch] = useState("");
    const [busy, setBusy] = useState(false);
    const [confirmAskT, confirmModalT] = useConfirm();
    const branches = (S.get("branches") || []).filter((b) => b.tipe !== "central_kitchen");
    const topings = S.get("topingTambahan") || [];

    // Batalkan 1 entri toping (kirim/opname keliru) — reload-fresh biar aman
    const hapusEntriToping = (e) => confirmAskT({
      title: "Batalkan Entri",
      danger: true, confirmLabel: "Batalkan",
      message: "Batalkan " + (e.tipe === "kirim" ? "kiriman" : "pemakaian") + " " + (e.topingNama || "toping") + " (" + e.qty + ")? Saldo akan menyesuaikan.",
      onConfirm: async () => {
        setBusy(true);
        try {
          await mutateLedger(loadStokTopingFromDb, (list) => list.filter((x) => x.id !== e.id), saveStokTopingToDb);
          pushNotif("Entri dibatalkan. Saldo diperbarui.", "success");
        } catch (err) { pushNotif("Gagal: " + (err?.message || err), "warning"); } finally { setBusy(false); }
      }
    });

    // default cabang pertama
    useEffect(() => { if (!selBranch && branches.length) setSelBranch(branches[0].id); }, [branches.length]);

    // Form kirim: { topingId: qty }
    const [kirimQty, setKirimQty] = useState({});
    // Form opname: { topingId: sisaFisik }
    const [opnameSisa, setOpnameSisa] = useState({});

    const branchName = (branches.find((b) => b.id === selBranch) || {}).name || "-";

    // Kirim toping ke lapak
    const submitKirim = async () => {
      const rows = [];
      for (const t of topings) {
        const q = parseFloat(kirimQty[t.id]);
        if (Number.isFinite(q) && q > 0) {
          rows.push({ branchId: selBranch, topingId: t.id, topingNama: t.nama, tipe: "kirim", qty: q, date: today() });
        }
      }
      if (!rows.length) { pushNotif("Isi minimal 1 jumlah kiriman toping.", "warning"); return; }
      setBusy(true);
      try {
        await catatStokTopingRows(rows);
        setKirimQty({});
        pushNotif("Kiriman toping tercatat untuk " + branchName + ".", "success");
      } catch (e) { pushNotif("Gagal simpan: " + (e?.message || e), "warning"); }
      finally { setBusy(false); }
    };

    // Opname: set sisa fisik → sistem catat "terpakai"
    const submitOpname = async () => {
      const rows = [];
      let totalNilai = 0;
      for (const t of topings) {
        const raw = opnameSisa[t.id];
        if (raw === "" || raw == null) continue; // toping yang tidak diopname dilewati
        const sisaFisik = Math.max(0, parseFloat(raw) || 0);
        const saldo = getStokTopingSaldo(selBranch, t.id);
        const terpakai = saldo - sisaFisik; // bisa 0, positif (terpakai) — kalau negatif berarti input keliru (sisa > saldo)
        if (terpakai < 0) {
          pushNotif('Sisa "' + t.nama + '" (' + sisaFisik + ') lebih besar dari stok tercatat (' + saldo + '). Cek lagi atau kirim toping dulu.', "warning");
          return;
        }
        const hargaSatuan = t.hargaPerSatuan != null ? t.hargaPerSatuan : null;
        const nilaiRp = hargaSatuan != null ? roundHppRp(terpakai * hargaSatuan) : null;
        if (nilaiRp) totalNilai += nilaiRp;
        rows.push({ branchId: selBranch, topingId: t.id, topingNama: t.nama, tipe: "terpakai", qty: terpakai, sisaFisik, nilaiRp, date: today(), note: "opname" });
      }
      if (!rows.length) { pushNotif("Isi minimal 1 sisa fisik toping untuk opname.", "warning"); return; }
      setBusy(true);
      try {
        await catatStokTopingRows(rows);
        setOpnameSisa({});
        pushNotif("Opname toping " + branchName + " tersimpan. Total biaya toping terpakai: " + fmtRp(totalNilai), "success");
      } catch (e) { pushNotif("Gagal simpan: " + (e?.message || e), "warning"); }
      finally { setBusy(false); }
    };

    // Riwayat opname & kirim untuk cabang terpilih
    const riwayat = useMemo(() => {
      return getStokTopingLedger()
        .filter((e) => e.branchId === selBranch)
        .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""))
        .slice(0, 60);
    }, [selBranch, tick]);

    const satuanLabel = (t) => t.satuanStok || "gram";

    return React.createElement("div", { className: "card" },
      React.createElement("h3", null, "\uD83E\uDD53 Stok Toping per Lapak"),
      React.createElement("p", { className: "info-txt", style: { marginTop: -4 } },
        "Toping dikirim ke lapak, dipakai saat topping donat di tempat. Karena curah (sejumput per donat), kontrolnya lewat OPNAME: timbang sisa, sistem hitung terpakai & biayanya."),

      // Pilih cabang
      React.createElement("div", { className: "filter-bar mb8", style: { alignItems: "center", flexWrap: "wrap", gap: 8 } },
        React.createElement("label", { style: { fontSize: 12, color: "var(--text2)", fontWeight: 700 } }, "Lapak:"),
        React.createElement("select", { className: "inp inp-sm", value: selBranch, onChange: (e) => setSelBranch(e.target.value) },
          branches.length === 0 && React.createElement("option", null, "Belum ada cabang"),
          branches.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name))
        )
      ),

      React.createElement("div", { className: "tabs mb8" },
        React.createElement("button", { className: "tab" + (subtab === "opname" ? " active" : ""), onClick: () => setSubtab("opname") }, "\uD83D\uDCCF Opname Harian"),
        React.createElement("button", { className: "tab" + (subtab === "kirim" ? " active" : ""), onClick: () => setSubtab("kirim") }, "\uD83D\uDE9A Kirim ke Lapak"),
        React.createElement("button", { className: "tab" + (subtab === "riwayat" ? " active" : ""), onClick: () => setSubtab("riwayat") }, "\uD83D\uDCDC Riwayat")
      ),

      topings.length === 0 && React.createElement("p", { className: "field-warning" }, "\u26A0\uFE0F Belum ada toping. Tambah dulu di Pengaturan \u2192 Menu & HPP \u2192 Topping (isi juga Satuan Stok & Isi per Beli)."),

      // ── Opname ──
      subtab === "opname" && topings.length > 0 && React.createElement("div", null,
        React.createElement("p", { className: "info-txt" }, "Isi SISA fisik tiap toping sekarang (timbang/hitung). Kolom terpakai & biaya dihitung otomatis. Kosongkan toping yang tidak diopname."),
        React.createElement("div", { style: { overflowX: "auto" } },
          React.createElement("table", { className: "tbl", style: { width: "100%", fontSize: 13 } },
            React.createElement("thead", null, React.createElement("tr", null,
              React.createElement("th", { style: { textAlign: "left" } }, "Toping"),
              React.createElement("th", { style: { textAlign: "right" } }, "Stok tercatat"),
              React.createElement("th", { style: { textAlign: "right" } }, "Sisa fisik"),
              React.createElement("th", { style: { textAlign: "right" } }, "Terpakai"),
              React.createElement("th", { style: { textAlign: "right" } }, "Biaya")
            )),
            React.createElement("tbody", null,
              topings.map((t) => {
                const saldo = getStokTopingSaldo(selBranch, t.id);
                const raw = opnameSisa[t.id];
                const sisaFisik = raw === "" || raw == null ? null : Math.max(0, parseFloat(raw) || 0);
                const terpakai = sisaFisik == null ? null : Math.max(0, saldo - sisaFisik);
                const nilai = (terpakai != null && t.hargaPerSatuan != null) ? roundHppRp(terpakai * t.hargaPerSatuan) : null;
                const boros = terpakai != null && saldo > 0 && (terpakai / saldo) > 0.9 && sisaFisik === 0;
                return React.createElement("tr", { key: t.id },
                  React.createElement("td", null, t.nama, React.createElement("span", { style: { color: "var(--text2)", fontSize: 11 } }, " (", satuanLabel(t), ")")),
                  React.createElement("td", { style: { textAlign: "right", color: saldo <= 0 ? "var(--red)" : "var(--text)" } }, saldo),
                  React.createElement("td", { style: { textAlign: "right" } },
                    React.createElement("input", {
                      className: "inp inp-sm", type: "number", min: "0", inputMode: "decimal",
                      style: { width: 90, textAlign: "right" },
                      value: raw == null ? "" : raw,
                      placeholder: "sisa",
                      onChange: (e) => setOpnameSisa((s) => ({ ...s, [t.id]: e.target.value }))
                    })
                  ),
                  React.createElement("td", { style: { textAlign: "right", fontWeight: 700, color: boros ? "var(--red)" : "var(--text)" } }, terpakai == null ? "-" : terpakai),
                  React.createElement("td", { style: { textAlign: "right", color: "var(--accent)" } }, nilai == null ? "-" : fmtRp(nilai))
                );
              })
            )
          )
        ),
        (() => {
          const totalBiaya = topings.reduce((a, t) => {
            const raw = opnameSisa[t.id];
            if (raw === "" || raw == null) return a;
            const saldo = getStokTopingSaldo(selBranch, t.id);
            const terpakai = Math.max(0, saldo - Math.max(0, parseFloat(raw) || 0));
            return a + (t.hargaPerSatuan != null ? roundHppRp(terpakai * t.hargaPerSatuan) : 0);
          }, 0);
          return React.createElement("div", { className: "pay-total-row mt8" },
            React.createElement("span", { className: "pay-total-label" }, "Total biaya toping terpakai"),
            React.createElement("strong", { className: "pay-total-value" }, fmtRp(totalBiaya))
          );
        })(),
        React.createElement("button", { className: "btn-primary mt8", disabled: busy, onClick: submitOpname }, busy ? "Menyimpan..." : "\u2705 Simpan Opname Hari Ini")
      ),

      // ── Kirim ──
      subtab === "kirim" && topings.length > 0 && React.createElement("div", null,
        React.createElement("p", { className: "info-txt" }, "Catat toping yang dikirim ke " + branchName + ". Menambah stok tercatat toping di lapak."),
        topings.map((t) => {
          const saldo = getStokTopingSaldo(selBranch, t.id);
          return React.createElement("div", { key: t.id, className: "field-group", style: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "space-between" } },
            React.createElement("div", null,
              React.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, t.nama),
              React.createElement("div", { style: { fontSize: 11, color: "var(--text2)" } }, "Stok kini: ", saldo, " ", satuanLabel(t))
            ),
            React.createElement("input", {
              className: "inp inp-sm", type: "number", min: "0", inputMode: "decimal",
              style: { width: 130 },
              value: kirimQty[t.id] == null ? "" : kirimQty[t.id],
              placeholder: "+ " + satuanLabel(t),
              onChange: (e) => setKirimQty((s) => ({ ...s, [t.id]: e.target.value }))
            })
          );
        }),
        React.createElement("button", { className: "btn-primary mt8", disabled: busy, onClick: submitKirim }, busy ? "Menyimpan..." : "\uD83D\uDE9A Simpan Kiriman")
      ),

      // ── Riwayat ──
      subtab === "riwayat" && React.createElement("div", null,
        riwayat.length === 0
          ? React.createElement("p", { className: "info-txt" }, "Belum ada aktivitas toping di lapak ini.")
          : React.createElement("div", { style: { overflowX: "auto" } },
              React.createElement("table", { className: "tbl", style: { width: "100%", fontSize: 12.5 } },
                React.createElement("thead", null, React.createElement("tr", null,
                  React.createElement("th", { style: { textAlign: "left" } }, "Tanggal"),
                  React.createElement("th", { style: { textAlign: "left" } }, "Toping"),
                  React.createElement("th", { style: { textAlign: "left" } }, "Jenis"),
                  React.createElement("th", { style: { textAlign: "right" } }, "Qty"),
                  React.createElement("th", { style: { textAlign: "right" } }, "Biaya"),
                  React.createElement("th", null, "")
                )),
                React.createElement("tbody", null,
                  riwayat.map((e) => React.createElement("tr", { key: e.id },
                    React.createElement("td", null, e.date),
                    React.createElement("td", null, e.topingNama || "-"),
                    React.createElement("td", null, e.tipe === "kirim"
                      ? React.createElement("span", { style: { color: "var(--green)" } }, "\uD83D\uDE9A Kirim")
                      : React.createElement("span", { style: { color: "var(--yellow)" } }, "\uD83D\uDCCF Terpakai")),
                    React.createElement("td", { style: { textAlign: "right" } }, (e.tipe === "kirim" ? "+" : "-") + e.qty),
                    React.createElement("td", { style: { textAlign: "right", color: "var(--accent)" } }, e.nilaiRp != null ? fmtRp(e.nilaiRp) : "-"),
                    React.createElement("td", { style: { textAlign: "right" } }, React.createElement("button", { className: "btn-danger-sm", disabled: busy, onClick: () => hapusEntriToping(e), "aria-label": "Batalkan" }, "X"))
                  ))
                )
              )
            ),
      confirmModalT
      )
    );
  }

  function TutupBukuPanel({ pushNotif }) {
    const [mode, setMode] = useState("bulan"); // "bulan" | "tahun"
    return React.createElement("div", null,
      React.createElement("div", { className: "tabs mb8" },
        React.createElement("button", { className: "tab" + (mode === "bulan" ? " active" : ""), onClick: () => setMode("bulan") }, "Bulanan"),
        React.createElement("button", { className: "tab" + (mode === "tahun" ? " active" : ""), onClick: () => setMode("tahun") }, "Tahunan")
      ),
      mode === "bulan" ? React.createElement(TutupBuku, { pushNotif }) : React.createElement(TutupBukuTahunan, { pushNotif })
    );
  }

  // Helper: "2026-07" -> "2026-08-01" (dipakai untuk filter `date < to`, exclusive)
  function nextMonthStr(bulanStr) {
    const [y, m] = bulanStr.split("-").map(Number);
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    return `${ny}-${String(nm).padStart(2, "0")}-01`;
  }

  // ─── SettingData ───────────────────────────────────────────────────────────
  function SettingData({ pushNotif }) {
    const [busy, setBusy] = useState(false);
    const branches = S.get("branches") || [];
    const [selBranch, setSelBranch] = useState("");
    const [selDate, setSelDate] = useState("");
    const [includeLocked, setIncludeLocked] = useState(false);
    const [confirmAsk, confirmModal] = useConfirm();

    // Tabel yang punya konsep "terkunci / sudah dikonfirmasi" — dilindungi dari
    // hapus massal secara default. Owner harus centang eksplisit "sertakan data
    // terkunci" untuk ikut menghapusnya.
    const applyProtection = (query, table) => {
      if (includeLocked) return query; // override eksplisit — tidak ada proteksi
      switch (table) {
        case "setoranHarian":
        case "absensiBulanan":
          return query.neq("locked", true);
        case "setoranBulanan":
          return query.neq("status", "selesai");
        case "gajiPembayaran":
          return query.neq("status", "dikonfirmasi");
        default:
          return query;
      }
    };

    // Filter cabang/tanggal yang sama dipakai baik untuk query delete maupun
    // (jika perlu) query unlock di bawah — diekstrak supaya keduanya tidak
    // pernah beda logic secara diam-diam.
    const applyScopeFilters = (query, t) => {
      let q = query;
      if (selBranch && t !== "pengeluaranOwner" && t !== "produksiCK") q = q.eq("branchId", selBranch);
      if (selDate) {
        if (["transactions", "pengeluaranLapak", "pengeluaranOwner", "setoranHarian", "absensi", "produksiCK", "distribusiCK", "stokTidakTerjual"].includes(t)) q = q.eq("date", selDate);
        else if (["setoranBulanan", "absensiBulanan", "gajiPembayaran"].includes(t)) q = q.eq("bulan", selDate.slice(0, 7));
        else if (t === "editLog") {
          const parts = selDate.split("-");
          const tsDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : selDate;
          q = q.like("ts", `${tsDate},%`);
        }
      }
      return q;
    };

    // Tabel yang proteksinya sekarang juga ditegakkan di database lewat RLS
    // (policy RESTRICTIVE berbasis kolom `locked`). Kalau override "sertakan
    // data terkunci" dicentang, baris locked=true harus dibuka kuncinya dulu
    // di sini, atau DELETE di bawah akan ditolak oleh Supabase — bukan lagi
    // cuma dilewati oleh logic JS seperti sebelumnya.
    const RLS_LOCKED_TABLES = ["setoranHarian", "absensiBulanan"];

    // Tabel yang datanya terikat ke satu kombinasi cabang+tanggal tertentu, dan
    // harus ikut dilindungi kalau Setoran (setoranHarian) untuk cabang+tanggal
    // yang SAMA masih terkunci — supaya laporan yang sudah dikonfirmasi tidak
    // jadi tidak akurat karena data mentah di baliknya kehapus lewat tombol
    // lain (Transaksi/Pengeluaran/Distribusi CK/Donat Tidak Terjual).
    // SENGAJA tidak termasuk: stokLapak (tidak punya kolom tanggal), produksiCK
    // (branchId-nya milik Central Kitchen, tidak akan pernah cocok dengan
    // setoran lapak manapun), dan setoranHarian/absensiBulanan sendiri (sudah
    // punya mekanisme proteksi terpisah di atas).
    const DAY_LOCK_LINKED_TABLES = ["transactions", "pengeluaranLapak", "pengeluaranOwner", "distribusiCK", "stokTidakTerjual", "absensi"];

    // Ambil (branchId, date) yang masih terkunci, dibatasi ke scope cabang/
    // tanggal yang sedang difilter — supaya tidak menarik seluruh histori
    // kalau owner cuma mau hapus data 1 hari.
    const getLockedDayKeys = async () => {
      const q = applyScopeFilters(sb.from("setoranHarian").select("branchId, date"), "setoranHarian").eq("locked", true);
      const { data, error } = await q;
      if (error) throw error;
      return new Set((data || []).map((r) => r.branchId + "|" + r.date));
    };

    const runClear = async (label, tables, keysToReload) => {
      setBusy(true);
      try {
        // Kalau tidak ada satupun tabel di daftar ini yang mau dihapus (atau
        // ownernya sudah sengaja mencentang "sertakan data terkunci"), lewati
        // pengecekan ini total — jalur kode di bawah tetap 100% seperti semula.
        const needsDayLockCheck = !includeLocked && tables.some((t) => DAY_LOCK_LINKED_TABLES.includes(t));
        const lockedDayKeys = needsDayLockCheck ? await getLockedDayKeys() : new Set();

        for (const t of tables) {
          if (selDate && t === "stokLapak") throw new Error("Stok Lapak tidak punya kolom tanggal yang aman untuk filter hapus. Kosongkan tanggal jika memang ingin hapus stok lapak.");

          if (includeLocked && RLS_LOCKED_TABLES.includes(t)) {
            const unlockQuery = applyScopeFilters(sb.from(t).update({ locked: false }).eq("locked", true), t);
            const { error: unlockErr } = await unlockQuery;
            if (unlockErr) throw unlockErr;
          }

          // Kalau ada hari terkunci dalam scope ini DAN tabel ini termasuk yang
          // ikut dilindungi: ambil dulu baris kandidatnya, sisihkan (di JS, bukan
          // di filter SQL) yang cabang+tanggalnya masih terkunci, baru hapus
          // sisanya berdasarkan id persis. Kalau lockedDayKeys kosong (tidak ada
          // yang terkunci dalam scope ini), blok ini dilewati total dan jalur di
          // bawahnya (yang lama, tidak berubah) yang jalan — jadi tidak ada efek
          // apapun untuk kasus yang paling umum (tidak ada yang terkunci).
          if (lockedDayKeys.size > 0 && DAY_LOCK_LINKED_TABLES.includes(t)) {
            const { data: candidates, error: selErr } = await applyScopeFilters(sb.from(t).select("id, branchId, date"), t);
            if (selErr) throw selErr;
            const idsToDelete = (candidates || [])
              .filter((r) => !lockedDayKeys.has(r.branchId + "|" + r.date))
              .map((r) => r.id);
            if (idsToDelete.length > 0) {
              const { error: delErr } = await sb.from(t).delete().in("id", idsToDelete);
              if (delErr) throw delErr;
            }
            continue;
          }

          let query = applyScopeFilters(sb.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000"), t);
          query = applyProtection(query, t);
          const { error } = await query; if (error) throw error;
        }
        for (const k of keysToReload) await S.loadKey(k).catch(() => {});
        pushNotif(`Berhasil hapus: ${label}${includeLocked ? " (termasuk yang terkunci/dikonfirmasi)" : ""}`, "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); } finally { setBusy(false); }
    };

    const doClear = (label, tables, keysToReload) => {
      const branchName = selBranch ? branches.find((b) => b.id === selBranch)?.name : "SEMUA CABANG";
      const dateName = selDate ? formatTanggalIndo(selDate) : "SEMUA TANGGAL";
      const hasProtectedTable = tables.some((t) => ["setoranHarian", "absensiBulanan", "setoranBulanan", "gajiPembayaran"].includes(t));
      const isDeleteAllDates = !selDate;

      confirmAsk({
        title: isDeleteAllDates ? "⚠️ BAHAYA — Hapus SEMUA Tanggal: " + label : "Hapus Data: " + label,
        message: (isDeleteAllDates
            ? `Kolom tanggal KOSONG. Ini akan menghapus "${label}" untuk SEMUA TANGGAL yang pernah tercatat (cabang: ${branchName}), bukan cuma hari ini. Ini biasanya cuma dipakai waktu masih uji coba — kalau app sudah dipakai untuk data asli, isi dulu tanggalnya di atas sebelum lanjut, atau ketik persis "HAPUS SEMUA" di bawah untuk tetap lanjut.`
            : `Cabang: ${branchName} | Tanggal: ${dateName}. Tindakan ini tidak bisa dibatalkan.`) +
          (hasProtectedTable
            ? (includeLocked
                ? " ⚠️ Kamu MENCENTANG \"sertakan data terkunci\" — data yang sudah dikonfirmasi/dikunci JUGA akan ikut terhapus."
                : " Data yang sudah dikonfirmasi/dikunci akan DILEWATI otomatis (aman).")
            : ""),
        confirmLabel: "Ya, Hapus " + label,
        danger: true,
        requireText: isDeleteAllDates,
        textLabel: isDeleteAllDates ? 'Ketik persis: HAPUS SEMUA' : undefined,
        textPlaceholder: isDeleteAllDates ? "HAPUS SEMUA" : undefined,
        onConfirm: (textValue) => {
          if (isDeleteAllDates && (textValue || "").trim() !== "HAPUS SEMUA") {
            pushNotif('Dibatalkan — ketikan tidak sama persis dengan "HAPUS SEMUA".', "warning");
            throw new Error("confirmation phrase mismatch");
          }
          return runClear(label, tables, keysToReload);
        }
      });
    };

    const DANGER_ACTIONS = [
      { label: "Transaksi", icon: "\uD83E\uDDFE", fn: () => doClear("Transaksi", ["transactions"], ["transactions"]) },
      { label: "Biaya", icon: "\uD83D\uDCB8", fn: () => doClear("Biaya", ["pengeluaranLapak", "pengeluaranOwner"], ["pengeluaranLapak", "pengeluaranOwner"]) },
      { label: "Setoran", icon: "\uD83D\uDCB0", fn: () => doClear("Setoran", ["setoranHarian", "setoranBulanan"], ["setoranHarian", "setoranBulanan"]) },
      { label: "Absensi", icon: "\uD83D\uDD52", fn: () => doClear("Absensi", ["absensi", "absensiBulanan", "gajiPembayaran"], ["absensi", "absensiBulanan", "gajiPembayaran"]) },
      { label: "Edit Log", icon: "\uD83D\uDCDD", fn: () => doClear("Edit Log", ["editLog"], ["editLog"]) },
      { label: "Stok di toko", icon: "\uD83D\uDCE6", fn: () => doClear("Stok di toko", ["stokLapak"], ["stokLapak"]) },
      { label: "Donat tidak terjual", icon: "\uD83D\uDCC9", fn: () => doClear("Donat tidak terjual", ["stokTidakTerjual"], ["stokTidakTerjual"]) },
      { label: "Produksi & Distribusi CK", icon: "\uD83C\uDF69", fn: () => doClear("Produksi & Distribusi CK", ["produksiCK", "distribusiCK"], ["produksiCK", "distribusiCK"]) },
    ];

    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Bersihkan Data"),
      React.createElement("p", { className: "info-txt" }, "Pilih cabang dan tanggal untuk hapus data spesifik. Kosong = hapus SEMUA."),
      React.createElement("div", { className: "filter-bar mb8" },
        React.createElement("select", { className: "inp inp-sm", value: selBranch, onChange: (e) => setSelBranch(e.target.value) },
          React.createElement("option", { value: "" }, "-- Semua Cabang --"),
          branches.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name))
        ),
        React.createElement("input", { type: "date", className: "inp inp-sm", value: selDate, onChange: (e) => setSelDate(e.target.value) })
      ),
      React.createElement("div", { className: "danger-zone mt8" },
        React.createElement("div", { className: "danger-zone-header" },
          React.createElement("span", null, "\u26A0\uFE0F"),
          React.createElement("span", null, "Zona Berbahaya")
        ),
        React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Catatan: untuk \"Produksi & Distribusi CK\", filter Cabang tidak berlaku untuk Produksi (selalu hapus semua produksi sesuai tanggal). Untuk Distribusi, filter Cabang berlaku normal."),
        React.createElement("p", { className: "info-txt", style: { fontSize: 11 } }, "Catatan: hapus \"Absensi\" juga akan ikut menghapus informasi gaji yang sudah dibayarkan (gajiPembayaran) pada bulan/cabang yang sama."),
        React.createElement("label", { className: "row-wrap", style: { alignItems: "center", gap: 6, fontSize: 12, marginTop: 8, color: includeLocked ? "var(--red)" : "var(--text2)" } },
          React.createElement("input", { type: "checkbox", checked: includeLocked, onChange: (e) => setIncludeLocked(e.target.checked) }),
          includeLocked
            ? "⚠️ Sertakan juga data yang sudah TERKUNCI / DIKONFIRMASI (Setoran, Absensi, Gaji, Laporan Investor)"
            : "Secara default, Setoran/Absensi/Gaji/Laporan yang sudah dikonfirmasi & dikunci TIDAK ikut terhapus"
        ),
        React.createElement("div", { className: "danger-zone-list mt8" },
          DANGER_ACTIONS.map((a) => React.createElement("div", { key: a.label, className: "danger-zone-row" },
            React.createElement("span", { className: "danger-zone-icon" }, a.icon),
            React.createElement("span", { className: "danger-zone-label" }, a.label),
            React.createElement("button", { className: "danger-zone-trash", disabled: busy, onClick: a.fn, "aria-label": "Hapus " + a.label, title: "Hapus " + a.label }, "\uD83D\uDDD1\uFE0F")
          ))
        )
      ),
      confirmModal
    );
  }

  // ─── SettingModeHistori ────────────────────────────────────────────────────
  function SettingModeHistori({ pushNotif, historyMode, onChange }) {
    const tick = useStoreTick();
    const branches = (S.get("branches") || []).filter((b) => !!b.id);
    const [form, setForm] = useState(() => normalizeHistoryMode(historyMode));
    const [busy, setBusy] = useState(false);

    useEffect(() => setForm(normalizeHistoryMode(historyMode)), [historyMode]);

    const toggleBranch = (id) => setForm((f) => {
      const has = f.branchIds.includes(id);
      return { ...f, branchIds: has ? f.branchIds.filter((x) => x !== id) : [...f.branchIds, id] };
    });

    const simpan = async () => {
      const cfg = normalizeHistoryMode(form);
      if (cfg.enabled && cfg.scope === "selected" && cfg.branchIds.length === 0) {
        pushNotif("Pilih minimal satu cabang jika mode histori tidak dibuat global.", "warning");
        return;
      }
      setBusy(true);
      try {
        const saved = await saveHistoryModeToDb(cfg);
        onChange?.(saved);
        pushNotif(saved.enabled ? "Mode histori berhasil disimpan." : "Mode histori dimatikan. Pekerja kembali hanya bisa input hari ini.", "success");
      } catch (e) {
        pushNotif(e?.message || String(e), "warning");
      } finally {
        setBusy(false);
      }
    };

    const statusText = !form.enabled
      ? "Nonaktif. Semua pekerja lapak dan CK kembali terkunci ke tanggal hari ini."
      : form.scope === "global"
        ? "Aktif global. Semua cabang yang punya pekerja bisa input tanggal lain."
        : `Aktif terbatas. Hanya ${form.branchIds.length} cabang terpilih yang bisa input tanggal lain.`;

    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Input tanggal lama"),
      React.createElement("p", { className: "info-txt" }, "Owner tetap bebas input dan edit tanggal mana pun. Pengaturan ini hanya menentukan apakah pekerja lapak dan pekerja CK boleh membuka tanggal selain hari ini."),
      React.createElement("div", { className: "form-card mt8" },
        React.createElement("div", { className: "row-wrap mb8" },
          React.createElement("button", { className: "tab" + (form.enabled ? " active" : ""), onClick: () => setForm((f) => ({ ...f, enabled: true })) }, "Aktif"),
          React.createElement("button", { className: "tab" + (!form.enabled ? " active" : ""), onClick: () => setForm((f) => ({ ...f, enabled: false })) }, "Nonaktif")
        ),
        React.createElement("p", { className: "info-txt" }, statusText)
      ),
      form.enabled && React.createElement("div", { className: "form-card mt8" },
        React.createElement("div", { className: "row-wrap mb8" },
          React.createElement("button", { className: "tab" + (form.scope === "global" ? " active" : ""), onClick: () => setForm((f) => ({ ...f, scope: "global" })) }, "Global"),
          React.createElement("button", { className: "tab" + (form.scope === "selected" ? " active" : ""), onClick: () => setForm((f) => ({ ...f, scope: "selected" })) }, "Pilih Cabang")
        ),
        React.createElement("p", { className: "info-txt" },
          form.scope === "global"
            ? "Semua cabang, termasuk Central Kitchen, ikut mode histori."
            : "Centang hanya cabang yang memang ingin dibuka mode histori oleh owner."
        ),
        form.scope === "selected" && React.createElement("div", { className: "mt8" },
          branches.length === 0 && React.createElement(EmptyState, { icon: "🏪", title: "Belum ada cabang", desc: "Tambah cabang mandiri, investasi, atau central kitchen." }),
          branches.map((b) =>
            React.createElement("label", { key: b.id, className: "peng-row", style: { cursor: "pointer", gap: 10, alignItems: "center" } },
              React.createElement("input", {
                type: "checkbox",
                checked: form.branchIds.includes(b.id),
                onChange: () => toggleBranch(b.id)
              }),
              React.createElement("div", { className: "peng-info" },
                React.createElement("span", { className: "peng-ket" }, b.name),
                React.createElement("span", { className: "peng-ts" }, b.type === "central_kitchen" ? "Dapur pusat (CK)" : "Lapak / Cabang")
              )
            )
          )
        )
      ),
      React.createElement("button", { className: "btn-primary btn-full mt8", disabled: busy, onClick: simpan }, busy ? "Menyimpan..." : "Simpan Mode Histori")
    );
  }

  // ─── OwnerSetting ──────────────────────────────────────────────────────────

  // ─── SettingAreaOperasional — area, manager, CK, lapak, dana area ─────────
  function SettingAreaOperasional({ pushNotif }) {
    const tick = useStoreTick();
    const [areas, setAreas] = useState([]);
    const branches = S.get("branches") || [];
    const profiles = (S.get("profiles") || []).filter(isActiveProfile);
    const managers = profiles.filter((p) => p.role === "manager");
    const [form, setForm] = useState({ id: "", name: "", code: "", managerId: "", ckId: "", modal: "", perLapak: "" });
    const [selectedBranches, setSelectedBranches] = useState([]);
    const [busy, setBusy] = useState(false);
    const [selectedAreaId, setSelectedAreaId] = useState("");
    useEffect(() => {
      sb.from("operational_areas").select("*").order("name").then(({ data }) => setAreas(data || [])).catch(() => setAreas([]));
    }, [tick]);

    const reloadAreaData = async () => {
      await Promise.all([
        S.loadKey("branches"),
        S.loadKey("profiles").catch(() => {}),
      ]);
      // area tables are not part of the legacy Store map; force a UI tick via local cache marker.
      S.setLocal("area_ui_tick", Date.now());
    };
    const loadArea = async (id) => {
      if (!id) return;
      const { data, error } = await sb.from("operational_areas").select("*").eq("id", id).maybeSingle();
      if (error) { pushNotif(error.message, "warning"); return; }
      const areaBranches = branches.filter((b) => b.areaId === id).map((b) => b.id);
      setForm({ id: data?.id || "", name: data?.name || "", code: data?.code || "", managerId: data?.manager_id || "", ckId: data?.central_kitchen_id || "", modal: "", perLapak: "" });
      setSelectedBranches(areaBranches);
    };
    useEffect(() => { if (selectedAreaId) loadArea(selectedAreaId); }, [selectedAreaId, tick]);

    const toggleBranch = (id) => setSelectedBranches((xs) => xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]);
    const reset = () => { setForm({ id: "", name: "", code: "", managerId: "", ckId: "", modal: "", perLapak: "" }); setSelectedBranches([]); setSelectedAreaId(""); };

    const saveArea = async () => {
      if (!form.name.trim() || !form.code.trim()) { pushNotif("Nama dan kode area wajib diisi.", "warning"); return; }
      // Manager / CK / lapak OPSIONAL saat buat area dulu
      // (hindari deadlock: area butuh manager, manager butuh area, CK butuh area).
      // Lengkapi belakangan lewat edit area.
      setBusy(true);
      try {
        const areaId = form.id || ("area-" + uid());
        const { error: ae } = await sb.from("operational_areas").upsert({
          id: areaId,
          name: form.name.trim(),
          code: form.code.trim(),
          manager_id: form.managerId || null,
          central_kitchen_id: form.ckId || null,
          active: true,
          updated_at: nowIso()
        });
        if (ae) throw ae;
        if (form.managerId) {
          const { error: me } = await sb.from("profiles").update({ areaId }).eq("user_id", form.managerId);
          if (me) throw me;
        }
        const allAreaBranchIds = [...new Set([
          ...selectedBranches,
          ...(form.ckId ? [form.ckId] : [])
        ])].filter(Boolean);
        if (allAreaBranchIds.length) {
          const { error: be } = await sb.from("branches").update({ areaId }).in("id", allAreaBranchIds);
          if (be) throw be;
        }

        const modal = Math.max(0, Number(form.modal) || 0);
        const perLapak = Math.max(0, Number(form.perLapak) || 0);
        let { data: areaAccount, error: aaErr } = await sb.from("area_fund_accounts").select("*").eq("area_id", areaId).eq("account_type", "area").is("branch_id", null).maybeSingle();
        if (aaErr) throw aaErr;
        if (!areaAccount) {
          const r = await sb.from("area_fund_accounts").insert({ area_id: areaId, account_type: "area", name: "Dana " + form.name.trim(), opening_balance: 0 }).select("*").single();
          if (r.error) throw r.error; areaAccount = r.data;
        }
        const ensureAccount = async (accountType, branchId, name) => {
          const q = await sb.from("area_fund_accounts").select("id").eq("area_id", areaId).eq("account_type", accountType).eq("branch_id", branchId).maybeSingle();
          if (q.error) throw q.error;
          if (q.data) return q.data.id;
          const r = await sb.from("area_fund_accounts").insert({ area_id: areaId, account_type: accountType, branch_id: branchId, name, opening_balance: 0 }).select("id").single();
          if (r.error) throw r.error; return r.data.id;
        };
        let ckAccountId = null;
        if (form.ckId) {
          ckAccountId = await ensureAccount("central_kitchen", form.ckId, "Dana CK " + (branches.find((b) => b.id === form.ckId)?.name || ""));
        }
        const branchAccountIds = [];
        for (const bid of selectedBranches) branchAccountIds.push({ bid, id: await ensureAccount("branch", bid, "Kas " + (branches.find((b) => b.id === bid)?.name || bid)) });
        if (modal > 0 && !form.id) {
          const transferId = uid();
          const base = { transfer_id: transferId, area_id: areaId, date: today(), transaction_type: "modal_awal", amount: modal, source_type: "owner", description: "Modal awal " + form.name.trim(), created_by: null, status: "posted" };
          const r = await sb.from("area_fund_ledger").insert({ ...base, account_id: areaAccount.id, direction: "in" }); if (r.error) throw r.error;
        }
        if (modal > 0 && form.ckId && ckAccountId && (perLapak > 0 || form.ckId)) {
          const allocated = perLapak * selectedBranches.length;
          const ckAmount = Math.max(0, modal - allocated);
          if (ckAmount > 0) {
            const transferId = uid();
            const r = await sb.from("area_fund_ledger").insert([
              { transfer_id: transferId, area_id: areaId, account_id: areaAccount.id, branch_id: null, date: today(), direction: "out", transaction_type: "alokasi_ck", amount: ckAmount, description: "Alokasi dana CK", status: "posted" },
              { transfer_id: transferId, area_id: areaId, account_id: ckAccountId, branch_id: form.ckId, date: today(), direction: "in", transaction_type: "alokasi_ck", amount: ckAmount, description: "Alokasi dana CK", status: "posted" }
            ]); if (r.error) throw r.error;
          }
          for (const x of branchAccountIds) if (perLapak > 0) {
            const transferId = uid();
            const r = await sb.from("area_fund_ledger").insert([
              { transfer_id: transferId, area_id: areaId, account_id: areaAccount.id, date: today(), direction: "out", transaction_type: "alokasi_lapak", amount: perLapak, description: "Alokasi kas lapak", status: "posted" },
              { transfer_id: transferId, area_id: areaId, account_id: x.id, branch_id: x.bid, date: today(), direction: "in", transaction_type: "alokasi_lapak", amount: perLapak, description: "Alokasi kas lapak", status: "posted" }
            ]); if (r.error) throw r.error;
          }
        }
        await reloadAreaData();
        setSelectedAreaId(areaId); setForm((f) => ({ ...f, id: areaId, modal: "", perLapak: "" }));
        pushNotif("Area operasional dan struktur dana berhasil disimpan.", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
      finally { setBusy(false); }
    };

    const ckBranches = branches.filter((b) => b.type === "central_kitchen");
    const lapakBranches = branches.filter((b) => b.type !== "central_kitchen");
    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Area Operasional & Dana Area"),
      React.createElement("p", { className: "info-txt" }, "Satu Area Operasional terdiri dari satu Central Kitchen, beberapa lapak, satu Area Manager, dan satu dana area."),
      React.createElement("div", { className: "form-card mt8" },
        React.createElement("h4", null, form.id ? "Edit Area Operasional" : "Buat Area Operasional"),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Pilih area yang sudah ada"), React.createElement("select", { className: "inp", value: selectedAreaId, onChange: (e) => e.target.value ? setSelectedAreaId(e.target.value) : reset() }, React.createElement("option", { value: "" }, "+ Buat area baru"), areas.map((a) => React.createElement("option", { key: a.id, value: a.id }, a.name)))),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Nama area"), React.createElement("input", { className: "inp", value: form.name, onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })), placeholder: "Area Operasional Temanggung" })),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Kode area"), React.createElement("input", { className: "inp", value: form.code, onChange: (e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() })), placeholder: "TEM-01" })),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Area Manager (opsional)"), React.createElement("select", { className: "inp", value: form.managerId, onChange: (e) => setForm((f) => ({ ...f, managerId: e.target.value })) }, React.createElement("option", { value: "" }, "-- belakangan saja --"), managers.map((m) => React.createElement("option", { key: m.user_id, value: m.user_id }, m.display_name || m.email)))),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Central Kitchen (opsional dulu)"), React.createElement("select", { className: "inp", value: form.ckId, onChange: (e) => setForm((f) => ({ ...f, ckId: e.target.value })) }, React.createElement("option", { value: "" }, "-- belakangan saja --"), ckBranches.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name)))),
        React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Lapak dalam area"), lapakBranches.length === 0 ? React.createElement("p", { className: "empty-txt" }, "Belum ada lapak.") : lapakBranches.map((b) => React.createElement("label", { key: b.id, className: "pay-check", style: { padding: "8px 0" } }, React.createElement("input", { type: "checkbox", checked: selectedBranches.includes(b.id), onChange: () => toggleBranch(b.id) }), React.createElement("span", null, b.name, " · ", b.city || "-")))),
        React.createElement("div", { className: "two-col" },
          React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Modal awal area (Rp)"), React.createElement("input", { className: "inp", type: "number", min: 0, value: form.modal, onChange: (e) => setForm((f) => ({ ...f, modal: e.target.value })), placeholder: "10000000" })),
          React.createElement("div", { className: "field-group" }, React.createElement("label", null, "Alokasi kas per lapak (Rp)"), React.createElement("input", { className: "inp", type: "number", min: 0, value: form.perLapak, onChange: (e) => setForm((f) => ({ ...f, perLapak: e.target.value })), placeholder: "300000" }))
        ),
        React.createElement("p", { className: "info-txt" }, "Dana CK dihitung otomatis: modal area − total alokasi kas lapak. Modal awal hanya dicatat sekali saat area baru dibuat."),
        React.createElement("div", { className: "row-wrap" }, React.createElement("button", { className: "btn-primary", disabled: busy, onClick: saveArea }, busy ? "Menyimpan..." : "Simpan Area & Dana"), form.id && React.createElement("button", { className: "btn-secondary", onClick: reset }, "Buat Area Baru"))
      )
    );
  }


  // ─── SettingPayroll — payroll draft/approve/pay per area ───────────────────
  function SettingPayroll({ pushNotif }) {
    const tick = useStoreTick();
    const [areas, setAreas] = useState([]);
    const [areaId, setAreaId] = useState("");
    const [bulan, setBulan] = useState(today().slice(0, 7));
    const [period, setPeriod] = useState(null);
    const [lines, setLines] = useState([]);
    const [busy, setBusy] = useState(false);
    const load = async () => {
      if (!areaId) { setPeriod(null); setLines([]); return; }
      const p = await sb.from("payroll_periods").select("*").eq("area_id", areaId).eq("bulan", bulan).maybeSingle();
      if (p.error) { pushNotif(p.error.message, "warning"); return; }
      setPeriod(p.data || null);
      if (p.data) {
        const l = await sb.from("payroll_lines").select("*").eq("payroll_id", p.data.id).order("role");
        if (l.error) { pushNotif(l.error.message, "warning"); return; }
        setLines(l.data || []);
      } else setLines([]);
    };
    useEffect(() => { sb.from("operational_areas").select("id,name").eq("active", true).order("name").then(({ data }) => setAreas(data || [])).catch(() => {}); }, [tick]);
    useEffect(() => { load(); }, [areaId, bulan, tick]);
    const hitung = async () => {
      if (!areaId) { pushNotif("Pilih area.", "warning"); return; }
      setBusy(true); try {
        const { data, error } = await sb.rpc("create_payroll_period", { p_area_id: areaId, p_bulan: bulan });
        if (error) throw error;
        pushNotif("Payroll draft dibuat.", "success"); await load();
      } catch (e) { pushNotif(e?.message || String(e), "warning"); } finally { setBusy(false); }
    };
    const approve = async () => { if (!period) return; setBusy(true); try { const { error } = await sb.rpc("approve_payroll", { p_payroll_id: period.id }); if (error) throw error; pushNotif("Payroll disetujui.", "success"); await load(); } catch(e) { pushNotif(e?.message || String(e), "warning"); } finally { setBusy(false); } };
    const pay = async () => { if (!period) return; setBusy(true); try { const { error } = await sb.rpc("mark_payroll_paid", { p_payroll_id: period.id }); if (error) throw error; pushNotif("Payroll ditandai sudah dibayar.", "success"); await load(); } catch(e) { pushNotif(e?.message || String(e), "warning"); } finally { setBusy(false); } };
    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Payroll Area"),
      React.createElement("p", { className: "info-txt" }, "Check-in membentuk gaji terutang. Payroll dihitung, direview, disetujui, lalu dibayar satu kali."),
      React.createElement("div", { className: "filter-bar mb8" },
        React.createElement("select", { className: "inp inp-sm", value: areaId, onChange: (e) => setAreaId(e.target.value) }, React.createElement("option", { value: "" }, "-- pilih area --"), areas.map((a) => React.createElement("option", { key: a.id, value: a.id }, a.name))),
        React.createElement("input", { type: "month", className: "inp inp-sm", value: bulan, onChange: (e) => setBulan(e.target.value) }),
        React.createElement("button", { className: "btn-primary btn-sm", disabled: busy, onClick: hitung }, busy ? "Memproses..." : "Hitung Payroll")
      ),
      period && React.createElement("div", { className: "kpi-grid mt8" },
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Status"), React.createElement("div", { className: "kpi-val" }, period.status)),
        React.createElement("div", { className: "kpi-card kpi-peng" }, React.createElement("div", { className: "kpi-label" }, "Total Payroll"), React.createElement("div", { className: "kpi-val" }, fmtRp(period.total)))
      ),
      period && React.createElement("div", { className: "row-wrap mt8" },
        period.status === "draft" && React.createElement("button", { className: "btn-primary btn-sm", disabled: busy, onClick: approve }, "Approve Payroll"),
        period.status === "approved" && React.createElement("button", { className: "btn-primary btn-sm", disabled: busy, onClick: pay }, "Tandai Sudah Dibayar")
      ),
      React.createElement("div", { className: "tbl-wrap mt8" },
        React.createElement("table", { className: "tbl" },
          React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Pekerja"), React.createElement("th", null, "Role"), React.createElement("th", null, "Hadir"), React.createElement("th", null, "Gaji/Hari"), React.createElement("th", null, "Jumlah"), React.createElement("th", null, "Status"))),
          React.createElement("tbody", null, lines.length === 0 ? React.createElement("tr", null, React.createElement("td", { colSpan: 6 }, "Belum ada payroll untuk area/bulan ini.")) : lines.map((l) => React.createElement("tr", { key: l.id }, React.createElement("td", null, l.user_id), React.createElement("td", null, l.role), React.createElement("td", null, l.hadir), React.createElement("td", null, fmtRp(l.gaji_harian)), React.createElement("td", null, fmtRp(l.jumlah)), React.createElement("td", null, l.status))))
        )
      )
    );
  }


  // ─── SettingAccounting — trial balance and accounting overview ───────────
  function SettingAccounting({ pushNotif }) {
    const tick = useStoreTick();
    const [rows, setRows] = useState([]);
    const [journals, setJournals] = useState([]);
    const [income, setIncome] = useState([]);
    const [balance, setBalance] = useState([]);
    const [cashFlow, setCashFlow] = useState([]);
    const [areas, setAreas] = useState([]);
    const [areaId, setAreaId] = useState("");
    const [from, setFrom] = useState(today().slice(0,7) + "-01");
    const [to, setTo] = useState(today());
    const [summary, setSummary] = useState(null);
    const [reconciliation, setReconciliation] = useState(null);
    const [periodRow, setPeriodRow] = useState(null);
    const [busy, setBusy] = useState(false);
    const load = async () => {
      setBusy(true);
      const areaRes = await sb.from("operational_areas").select("id,name").eq("active", true).order("name");
      if (!areaRes.error) setAreas(areaRes.data || []);
      try {
        const { data, error } = await sb.from("trial_balance").select("*").order("code");
        if (error) throw error;
        setRows(data || []);
        const j = await sb.from("journal_entries").select("*").order("entry_date", { ascending: false }).limit(100);
        if (!j.error) setJournals(j.data || []);
        const [isr, bsr, cfr] = await Promise.all([
          sb.from("income_statement").select("*").order("code"),
          sb.from("balance_sheet").select("*").order("code"),
          sb.from("cash_flow_summary").select("*").order("code")
        ]);
        if (!isr.error) setIncome(isr.data || []);
        if (!bsr.error) setBalance(bsr.data || []);
        if (!cfr.error) setCashFlow(cfr.data || []);
        const sm = await sb.rpc("get_financial_summary", { p_from: from, p_to: to, p_area_id: areaId || null });
        if (!sm.error) setSummary(sm.data?.[0] || null);
        const rc = await sb.from("operational_accounting_reconciliation").select("*").maybeSingle();
        if (!rc.error) setReconciliation(rc.data || null);
        const pr = await sb.from("accounting_periods").select("*").eq("period", String(from).slice(0, 7)).maybeSingle();
        if (!pr.error) setPeriodRow(pr.data || null);
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
      finally { setBusy(false); }
    };
    useEffect(() => { load(); }, [tick, from, to, areaId]);
    const postPending = async () => {
      setBusy(true);
      try {
        const tx = await sb.from("transactions").select("id");
        if (tx.error) throw tx.error;
        const purchases = await sb.from("material_purchases").select("id").eq("status", "received");
        if (purchases.error) throw purchases.error;
        const payroll = await sb.from("payroll_periods").select("id").in("status", ["approved", "paid"]);
        if (payroll.error) throw payroll.error;
        let n = 0;
        for (const r of (tx.data || [])) { const x = await sb.rpc("post_sale_journal", { p_transaction_id: r.id }); if (x.error) throw x.error; n++; }
        for (const r of (purchases.data || [])) { const x = await sb.rpc("post_material_purchase_journal", { p_purchase_id: r.id }); if (x.error) throw x.error; n++; }
        for (const r of (payroll.data || [])) { const x = await sb.rpc("post_payroll_journal", { p_payroll_id: r.id }); if (x.error) throw x.error; n++; }
        await load();
        pushNotif(n + " sumber transaksi diproses ke jurnal. Entri yang sudah ada tidak digandakan.", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
      finally { setBusy(false); }
    };
    const closePeriod = async () => {
      const period = String(from).slice(0, 7);
      try { const { error } = await sb.rpc("close_accounting_period", { p_period: period }); if (error) throw error; pushNotif("Periode " + period + " ditutup.", "success"); await load(); } catch (e) { pushNotif(e?.message || String(e), "warning"); }
    };
    const reopenPeriod = async () => {
      const period = String(from).slice(0, 7);
      const reason = prompt("Alasan membuka kembali periode " + period + ":", "");
      if (!reason || !reason.trim()) { pushNotif("Alasan wajib diisi.", "warning"); return; }
      try { const { error } = await sb.rpc("reopen_accounting_period", { p_period: period, p_reason: reason.trim() }); if (error) throw error; pushNotif("Periode " + period + " dibuka kembali.", "warning"); await load(); } catch (e) { pushNotif(e?.message || String(e), "warning"); }
    };
    const exportAccounting = () => {
      if (typeof XLSX === "undefined") { pushNotif("Library Excel belum termuat.", "warning"); return; }
      const wb = XLSX.utils.book_new();
      const summaryRows = [["Laporan Keuangan Evora Donuts"],["Periode", from + " s/d " + to],["Area", areaId || "Semua area"],[],["Pendapatan", summary?.revenue || 0],["HPP", summary?.cost_of_sales || 0],["Beban", summary?.expenses || 0],["Laba Bersih", summary?.net_profit || 0],["Selisih Debit-Kredit", (summary?.debit_total || 0) - (summary?.credit_total || 0)]];
      XLSX.utils.book_append_sheet(wb, styledSummarySheet(summaryRows, [4,5,6,7,8]), "Ringkasan");
      XLSX.utils.book_append_sheet(wb, styledJsonSheet(rows), "Trial Balance");
      XLSX.utils.book_append_sheet(wb, styledJsonSheet(income), "Laba Rugi");
      XLSX.utils.book_append_sheet(wb, styledJsonSheet(balance), "Neraca");
      XLSX.utils.book_append_sheet(wb, styledJsonSheet(cashFlow), "Arus Kas");
      XLSX.utils.book_append_sheet(wb, styledJsonSheet(journals), "Jurnal");
      XLSX.writeFile(wb, "Evora-Laporan-Keuangan-" + String(from).slice(0,7) + ".xlsx");
      pushNotif("Excel laporan keuangan diunduh.", "success");
    };
    const debit = rows.reduce((a, r) => a + (Number(r.debit) || 0), 0);
    const credit = rows.reduce((a, r) => a + (Number(r.credit) || 0), 0);
    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Akuntansi"),
      React.createElement("p", { className: "info-txt" }, "Trial Balance hanya menampilkan jurnal yang sudah diposting. Total debit dan kredit wajib sama sebelum laporan formal dibuat."),
      React.createElement("div", { className: "filter-bar mt8" },
        React.createElement("input", { type: "date", className: "inp inp-sm", value: from, onChange: (e) => setFrom(e.target.value) }),
        React.createElement("span", { className: "muted" }, "s/d"),
        React.createElement("input", { type: "date", className: "inp inp-sm", value: to, onChange: (e) => setTo(e.target.value) }),
        React.createElement("select", { className: "inp inp-sm", value: areaId, onChange: (e) => setAreaId(e.target.value) }, React.createElement("option", { value: "" }, "Semua area"), areas.map((a) => React.createElement("option", { key: a.id, value: a.id }, a.name))),
        React.createElement("span", { className: "pill-badge" }, "Periode: ", periodRow?.status || "open"),
        periodRow?.status === "closed"
          ? React.createElement("button", { className: "btn-secondary btn-sm", onClick: reopenPeriod }, "Buka Kunci Periode")
          : React.createElement("button", { className: "btn-primary btn-sm", onClick: closePeriod }, "Tutup Periode"),
        React.createElement("button", { className: "btn-secondary btn-sm", onClick: exportAccounting }, "Export Excel")
      ),
      summary && React.createElement("div", { className: "kpi-grid mt8" },
        React.createElement("div", { className: "kpi-card kpi-omzet" }, React.createElement("div", { className: "kpi-label" }, "Pendapatan periode"), React.createElement("div", { className: "kpi-val" }, fmtRp(summary.revenue))),
        React.createElement("div", { className: "kpi-card kpi-modal" }, React.createElement("div", { className: "kpi-label" }, "HPP periode"), React.createElement("div", { className: "kpi-val" }, fmtRp(summary.cost_of_sales))),
        React.createElement("div", { className: "kpi-card kpi-peng" }, React.createElement("div", { className: "kpi-label" }, "Beban periode"), React.createElement("div", { className: "kpi-val" }, fmtRp(summary.expenses))),
        React.createElement("div", { className: "kpi-card kpi-profit" }, React.createElement("div", { className: "kpi-label" }, "Laba bersih"), React.createElement("div", { className: "kpi-val" }, fmtRp(summary.net_profit)))
      ),
      reconciliation && React.createElement("div", { className: "card mt8" },
        React.createElement("h3", null, "Rekonsiliasi Operasional vs Accounting"),
        React.createElement("p", { className: "info-txt" }, "Perbedaan harus diselidiki sebelum tutup buku. Angka jurnal tidak boleh dianggap benar jika belum cocok dengan sumber operasional."),
        React.createElement("div", { className: "kpi-grid" },
          React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Penjualan Operasional"), React.createElement("div", { className: "kpi-val" }, fmtRp(reconciliation.operational_sales))),
          React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Penjualan Jurnal"), React.createElement("div", { className: "kpi-val" }, fmtRp(reconciliation.journal_sales))),
          React.createElement("div", { className: "kpi-card " + (Math.abs(Number(reconciliation.sales_difference || 0)) < 0.01 ? "kpi-profit" : "kpi-peng") }, React.createElement("div", { className: "kpi-label" }, "Selisih Penjualan"), React.createElement("div", { className: "kpi-val" }, fmtRp(reconciliation.sales_difference))),
          React.createElement("div", { className: "kpi-card " + (Math.abs(Number(reconciliation.hpp_difference || 0)) < 0.01 ? "kpi-profit" : "kpi-peng") }, React.createElement("div", { className: "kpi-label" }, "Selisih HPP"), React.createElement("div", { className: "kpi-val" }, fmtRp(reconciliation.hpp_difference)))
        )
      ),
      React.createElement("div", { className: "kpi-grid mt8" },
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Total Debit"), React.createElement("div", { className: "kpi-val" }, fmtRp(debit))),
        React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Total Kredit"), React.createElement("div", { className: "kpi-val" }, fmtRp(credit))),
        React.createElement("div", { className: "kpi-card " + (Math.abs(debit-credit) < 0.01 ? "kpi-profit" : "kpi-peng") }, React.createElement("div", { className: "kpi-label" }, "Selisih"), React.createElement("div", { className: "kpi-val" }, fmtRp(debit-credit)))
      ),
      React.createElement("div", { className: "row-wrap mt8" },
        React.createElement("button", { className: "btn-secondary btn-sm", disabled: busy, onClick: load }, busy ? "Memuat..." : "Muat ulang saldo akun"),
        React.createElement("button", { className: "btn-primary btn-sm", disabled: busy, onClick: postPending }, busy ? "Memproses..." : "Posting transaksi belum dijurnal")
      ),
      React.createElement("div", { className: "tbl-wrap mt8" },
        React.createElement("table", { className: "tbl" },
          React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Kode"), React.createElement("th", null, "Akun"), React.createElement("th", null, "Jenis"), React.createElement("th", null, "Debit"), React.createElement("th", null, "Kredit"), React.createElement("th", null, "Saldo"))),
          React.createElement("tbody", null, rows.length === 0 ? React.createElement("tr", null, React.createElement("td", { colSpan: 6 }, "Belum ada jurnal diposting.")) : rows.map((r) => React.createElement("tr", { key: r.code }, React.createElement("td", null, r.code), React.createElement("td", null, r.name), React.createElement("td", null, r.account_type), React.createElement("td", null, fmtRp(r.debit)), React.createElement("td", null, fmtRp(r.credit)), React.createElement("td", { style: { color: Number(r.balance) >= 0 ? "var(--green)" : "var(--red)" } }, fmtRp(r.balance)))))
        )
      ),
      React.createElement("h3", { className: "section-title mt12" }, "Laporan Laba Rugi"),
      React.createElement("div", { className: "tbl-wrap" }, React.createElement("table", { className: "tbl" },
        React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Akun"), React.createElement("th", null, "Jenis"), React.createElement("th", null, "Nilai"))),
        React.createElement("tbody", null, income.length ? income.map((r) => React.createElement("tr", { key: r.code }, React.createElement("td", null, r.code, " — ", r.name), React.createElement("td", null, r.account_type), React.createElement("td", null, fmtRp(r.amount)))) : React.createElement("tr", null, React.createElement("td", { colSpan: 3 }, "Belum ada laporan laba rugi.")))
      )),
      React.createElement("h3", { className: "section-title mt12" }, "Neraca"),
      React.createElement("div", { className: "tbl-wrap" }, React.createElement("table", { className: "tbl" },
        React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Akun"), React.createElement("th", null, "Jenis"), React.createElement("th", null, "Nilai"))),
        React.createElement("tbody", null, balance.length ? balance.map((r) => React.createElement("tr", { key: r.code }, React.createElement("td", null, r.code, " — ", r.name), React.createElement("td", null, r.account_type), React.createElement("td", null, fmtRp(r.amount)))) : React.createElement("tr", null, React.createElement("td", { colSpan: 3 }, "Belum ada neraca.")))
      )),
      React.createElement("h3", { className: "section-title mt12" }, "Arus Kas"),
      React.createElement("div", { className: "tbl-wrap" }, React.createElement("table", { className: "tbl" },
        React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Akun Kas/Bank"), React.createElement("th", null, "Perubahan Bersih"))),
        React.createElement("tbody", null, cashFlow.length ? cashFlow.map((r) => React.createElement("tr", { key: r.code }, React.createElement("td", null, r.code, " — ", r.name), React.createElement("td", null, fmtRp(r.net_cash_change)))) : React.createElement("tr", null, React.createElement("td", { colSpan: 2 }, "Belum ada arus kas.")))
      )),
      React.createElement("h3", { className: "section-title mt12" }, "Jurnal Terposting"),
      React.createElement("div", { className: "tbl-wrap" },
        React.createElement("table", { className: "tbl" },
          React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Tanggal"), React.createElement("th", null, "Sumber"), React.createElement("th", null, "Keterangan"), React.createElement("th", null, "Status"))),
          React.createElement("tbody", null, journals.length === 0 ? React.createElement("tr", null, React.createElement("td", { colSpan: 4 }, "Belum ada jurnal terposting.")) : journals.map((j) => React.createElement("tr", { key: j.id }, React.createElement("td", null, j.entry_date), React.createElement("td", null, j.source_type), React.createElement("td", null, j.description), React.createElement("td", null, j.status))) )
        )
      )
    );
  }


  // ─── SettingTax — ringkasan pajak, rate dikonfirmasi akuntan ─────────────
  function SettingTax({ pushNotif }) {
    const tick = useStoreTick();
    const [rows, setRows] = useState([]);
    const [codes, setCodes] = useState([]);
    const [period, setPeriod] = useState(today().slice(0, 7));
    const load = async () => {
      const r = await sb.from("tax_period_summary").select("*").eq("period", period);
      if (!r.error) setRows(r.data || []); else pushNotif(r.error.message, "warning");
      const c = await sb.from("tax_codes").select("*").eq("active", true);
      if (!c.error) setCodes(c.data || []);
    };
    useEffect(() => { load(); }, [tick, period]);
    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Pajak"),
      React.createElement("p", { className: "info-txt" }, "Ringkasan pajak harus dikonfirmasi Owner bersama akuntan/konsultan pajak. Rate tidak boleh diasumsikan otomatis."),
      React.createElement("div", { className: "filter-bar mb8" }, React.createElement("input", { type: "month", className: "inp inp-sm", value: period, onChange: (e) => setPeriod(e.target.value) }), React.createElement("button", { className: "btn-secondary btn-sm", onClick: load }, "Muat ulang")),
      React.createElement("div", { className: "kpi-grid" }, React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Jenis pajak aktif"), React.createElement("div", { className: "kpi-val" }, codes.length)), React.createElement("div", { className: "kpi-card kpi-peng" }, React.createElement("div", { className: "kpi-label" }, "Total pajak periode"), React.createElement("div", { className: "kpi-val" }, fmtRp(rows.reduce((a, r) => a + Number(r.tax_amount || 0), 0))))),
      React.createElement("div", { className: "tbl-wrap mt8" }, React.createElement("table", { className: "tbl" }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Jenis"), React.createElement("th", null, "Dasar pengenaan"), React.createElement("th", null, "Pajak"), React.createElement("th", null, "Jumlah record"))), React.createElement("tbody", null, rows.length ? rows.map((r, i) => React.createElement("tr", { key: i }, React.createElement("td", null, r.tax_type), React.createElement("td", null, fmtRp(r.taxable_amount)), React.createElement("td", null, fmtRp(r.tax_amount)), React.createElement("td", null, r.record_count))) : React.createElement("tr", null, React.createElement("td", { colSpan: 4 }, "Belum ada data pajak untuk periode ini.")))) )
    );
  }

  function OwnerSetting({ stab, setStab, pushNotif, historyMode, onHistoryModeChange, hppFocus, setHppFocus }) {
    // Sub-pengaturan dikelompokkan jadi 4 kategori (lebih mudah dicari)
    const SETTING_GROUPS = [
      { label: "\uD83C\uDF69 Produk & HPP", items: [
        { key: "hpp", label: "Bahan, glaze & topping", icon: "\uD83C\uDF69" },
        { key: "paket", label: "Paket & ukuran box", icon: "\uD83D\uDCE6" },
        { key: "stok", label: "Stok donat di lapak", icon: "\uD83D\uDCE6" },
      ]},
      { label: "\uD83C\uDFE2 Bisnis", items: [
        { key: "area", label: "Area operasional", icon: "\uD83D\uDCCD" },
        { key: "cabang", label: "Cabang", icon: "\uD83C\uDFE2" },
        { key: "investor", label: "Investor", icon: "\uD83E\uDD1D" },
        { key: "branding", label: "Logo toko", icon: "\uD83C\uDFA8" },
      ]},
      { label: "\uD83D\uDC65 Tim", items: [
        { key: "akun", label: "Akun karyawan", icon: "\uD83D\uDC65" },
      ]},
      { label: "\uD83D\uDCB0 Keuangan & Gudang", items: [
        { key: "gudang", label: "Gudang bahan", icon: "\uD83C\uDFEC" },
        { key: "belanja", label: "Uang belanja", icon: "\uD83D\uDED2" },
        { key: "payroll", label: "Payroll", icon: "\uD83D\DCB5" },
        { key: "accounting", label: "Akuntansi", icon: "\uD83D\DCCA" },
        { key: "tax", label: "Pajak", icon: "\uD83D\DCC4" },
        { key: "dana", label: "Dana cadangan", icon: "\uD83D\uDEE1\uFE0F" },
        { key: "aruskas", label: "Arus uang", icon: "\uD83D\uDCB8" },
      ]},
      { label: "\uD83D\uDD27 Sistem", items: [
        { key: "histori", label: "Input tanggal lama", icon: "\uD83D\uDDD3\uFE0F" },
        { key: "diagnostik", label: "Cek sistem", icon: "\uD83D\uDD0D" },
        { key: "data", label: "Hapus / kelola data", icon: "\uD83D\uDDC4\uFE0F" },
      ]},
    ];
    const SETTING_TABS = SETTING_GROUPS.flatMap((g) => g.items);
    const current = SETTING_TABS.find((t) => t.key === stab) || SETTING_TABS[0];
    return React.createElement("div", null,
      React.createElement("div", { className: "setting-switcher" },
        React.createElement("select", {
          className: "inp setting-switcher-select",
          value: stab,
          onChange: (e) => setStab(e.target.value)
        },
          SETTING_GROUPS.map((g) => React.createElement("optgroup", { key: g.label, label: g.label },
            g.items.map((t) => React.createElement("option", { key: t.key, value: t.key }, t.icon + "  " + t.label))
          ))
        ),
        React.createElement("span", { className: "setting-switcher-current" }, current.icon, " ", current.label)
      ),
      stab === "hpp"      && React.createElement(SettingHPP, { pushNotif, initialSub: hppFocus === "menu" ? "menu" : hppFocus === "bahan" ? "bahan" : null, onConsumedFocus: () => setHppFocus && setHppFocus(null) }),
      stab === "paket"    && React.createElement(SettingPaket, { pushNotif }),
      stab === "area"     && React.createElement(SettingAreaOperasional, { pushNotif }),
      stab === "cabang"   && React.createElement(SettingCabang, { pushNotif }),
      stab === "akun"     && React.createElement(SettingAkun, { pushNotif }),
      stab === "investor" && React.createElement(SettingInvestor, { pushNotif }),
      stab === "histori"  && React.createElement(SettingModeHistori, { pushNotif, historyMode, onChange: onHistoryModeChange }),
      stab === "branding" && React.createElement(BrandingSetting, { pushNotif }),
      stab === "stok"     && React.createElement(SettingStokLapak, { pushNotif }),
      stab === "gudang"   && React.createElement(SettingGudangBahan, { pushNotif, goSetting: setStab }),
      stab === "dana"     && React.createElement(SettingDanaPemeliharaan, { pushNotif }),
      stab === "belanja"  && React.createElement(SettingKasBelanja, { pushNotif, goSetting: setStab }),
      stab === "payroll"  && React.createElement(SettingPayroll, { pushNotif }),
      stab === "accounting"  && React.createElement(SettingAccounting, { pushNotif }),
      stab === "tax"  && React.createElement(SettingTax, { pushNotif }),
      stab === "aruskas"  && React.createElement(SettingArusKasOps, { pushNotif }),
      stab === "diagnostik" && React.createElement(SettingDiagnostik, { pushNotif, goHppMenu: () => { if (setHppFocus) setHppFocus("menu"); setStab("hpp"); } }),
      stab === "data"     && React.createElement(SettingData, { pushNotif })
    );
  }

    // ─── SettingGudangBahan — stok bahan baku (yield-pcs) + ledger ───────────
  function SettingGudangBahan({ pushNotif, goSetting }) {
    const tick = useStoreTick();
    const [modalAwalBahan, setModalAwalBahan] = useState(0);
    const [areaOptions, setAreaOptions] = useState([]);
    const [restokAreaId, setRestokAreaId] = useState("");
    const [restokUnitId, setRestokUnitId] = useState("");
    useEffect(() => {
      sb.from("operational_areas").select("id,name").eq("active", true).order("name")
        .then(({ data }) => setAreaOptions(data || [])).catch(() => setAreaOptions([]));
    }, [tick]);
    useEffect(() => {
      sb.from("app_settings").select("value").eq("key", "kas_belanja_modal_awal").maybeSingle()
        .then(({ data }) => setModalAwalBahan(Number(data?.value?.jumlah || 0) || 0))
        .catch(() => {});
    }, [tick]);
    const bahan = S.get("bahanPokok") || [];
    const branches = S.get("branches") || [];
    const unitOptions = branches.filter((b) => !restokAreaId || b.areaId === restokAreaId);
    const ledger = getStokBahanLedger().slice().sort((a, b) => String(b.ts || b.date).localeCompare(String(a.ts || a.date)));
    const saldoMap = getAllStokBahanSaldoMap();
    const [tab, setTab] = useState("saldo"); // saldo | restok | laporan | mutasi
    const [form, setForm] = useState({ bahanId: "", tipe: "masuk", qty: "", note: "", date: today() });
    const [restok, setRestok] = useState({
      bahanId: "", modeQty: "batch", // batch | yield
      batch: "1", qtyYield: "",
      jumlahBayar: "", note: "", date: today(),
      updateHpp: false,
      fotoUrl: "", fotoPath: ""
    });
    const [uploadingNota, setUploadingNota] = useState(false);
    const [busy, setBusy] = useState(false);
    const [filterBahan, setFilterBahan] = useState("");
    const [bulanLap, setBulanLap] = useState(today().slice(0, 7));
    const [confirmAsk, confirmModal] = useConfirm();

    const rowsSaldo = bahan.map((b) => {
      const saldo = saldoMap[b.id] != null ? saldoMap[b.id] : 0;
      const minWarn = saldo <= 0;
      const low = saldo > 0 && saldo < Math.max((Number(b.kapasitas) || 0) * 0.2, 5);
      return { ...b, saldo, minWarn, low };
    }).sort((a, b) => a.saldo - b.saldo);

    // ── Kas belanja ringkas (jatah dari HPP distribusi − pengambilan) ──
    const distribAktif = (S.get("distribusiCK") || []).filter((d) => d.status !== "dibatalkan");
    const ambilAll = S.get("pengambilanBelanja") || [];
    const totalJatahAll = distribAktif.reduce((a, d) => a + (d.hppTotal || 0), 0);
    const totalAmbilAll = ambilAll.reduce((a, p) => a + (p.jumlah || 0), 0);
    const saldoKasBelanja = modalAwalBahan + totalJatahAll - totalAmbilAll;

    const doCatat = async () => {
      if (!form.bahanId) { pushNotif("Pilih bahan dulu.", "warning"); return; }
      const q = parseFloat(form.qty);
      if (!q || q <= 0) { pushNotif("Qty harus > 0.", "warning"); return; }
      const b = bahan.find((x) => x.id === form.bahanId);
      setBusy(true);
      try {
        if (form.tipe === "koreksi") {
          const nowSaldo = getStokBahanSaldo(form.bahanId);
          const target = q;
          const delta = target - nowSaldo;
          if (Math.abs(delta) < 1e-9) {
            pushNotif("Saldo sudah sama dengan target.", "warning");
            return;
          }
          await catatStokBahanRows([{
            bahanId: form.bahanId, bahanNama: b?.nama, tipe: "koreksi",
            qty: Math.abs(delta), qtySign: delta, date: form.date || today(),
            note: form.note || ("Koreksi stok → " + target), refType: "manual"
          }]);
        } else {
          await catatStokBahanRows([{
            bahanId: form.bahanId, bahanNama: b?.nama,
            tipe: form.tipe === "keluar" ? "keluar" : "masuk",
            qty: q, date: form.date || today(),
            note: form.note || (form.tipe === "keluar" ? "Keluar manual" : "Masuk manual (tanpa belanja)"),
            refType: "manual"
          }]);
        }
        setForm((f) => ({ ...f, qty: "", note: "" }));
        pushNotif("Stok gudang diperbarui.", "success");
      } catch (e) {
        pushNotif(e?.message || String(e), "warning");
      } finally {
        setBusy(false);
      }
    };

    const restokSatuBatch = async (b) => {
      const kap = Math.max(parseInt(b.kapasitas || 0) || 0, 0);
      if (!kap) { pushNotif("Kapasitas bahan belum diisi di Menu & HPP.", "warning"); return; }
      setRestok({
        bahanId: b.id, modeQty: "batch", batch: "1", qtyYield: String(kap),
        jumlahBayar: String(b.hargaBeli || ""), note: "Restok 1 batch", date: today(), updateHpp: false
      });
      setTab("restok");
    };

    /** Restok + belanja 1 form: stok naik + ambil kas belanja (uang aktual) + opsional update HPP master */
    const doRestokBelanja = async () => {
      if (!restok.bahanId) { pushNotif("Pilih bahan.", "warning"); return; }
      if (!restokAreaId || !restokUnitId) { pushNotif("Pilih Area Operasional dan unit tujuan stok.", "warning"); return; }
      const b = bahan.find((x) => x.id === restok.bahanId);
      if (!b) { pushNotif("Bahan tidak ditemukan.", "warning"); return; }
      const kap = Math.max(parseInt(b.kapasitas || 1) || 1, 1);
      let qtyYield = 0;
      if (restok.modeQty === "batch") {
        const nBatch = parseFloat(restok.batch || "0");
        if (!nBatch || nBatch <= 0) { pushNotif("Jumlah batch harus > 0.", "warning"); return; }
        qtyYield = nBatch * kap;
      } else {
        qtyYield = parseFloat(restok.qtyYield || "0");
        if (!qtyYield || qtyYield <= 0) { pushNotif("Qty yield harus > 0.", "warning"); return; }
      }
      const bayar = parseFloat(restok.jumlahBayar || "0");
      if (!bayar || bayar <= 0) { pushNotif("Isi uang belanja aktual (Rp) yang dibayar ke supplier.", "warning"); return; }

      const run = async () => {
        setBusy(true);
        const ambilId = uid();
        const stockRowId = uid();
        let stokSudahMasuk = false;
        try {
          const tgl = restok.date || today();
          const note = restok.note || ("Belanja " + (b.nama || "bahan"));
          // Jalur baru: pembelian dan stok masuk dicatat atomic di ledger terstruktur.
          if (restokAreaId && restokUnitId) {
            const { error: normalizedError } = await sb.rpc("receive_material_purchase", {
              p_id: ambilId,
              p_area_id: restokAreaId,
              p_branch_id: restokUnitId,
              p_date: tgl,
              p_bahan_id: b.id,
              p_bahan_nama: b.nama,
              p_amount: bayar,
              p_quantity_received: qtyYield,
              p_quantity_usable: qtyYield,
              p_quantity_damaged: 0,
              p_unit: b.satuanStok || "gram",
              p_note: note
            });
            if (normalizedError) throw normalizedError;
            setRestok((f) => ({ ...f, batch: "1", qtyYield: "", jumlahBayar: "", note: "", fotoUrl: "", fotoPath: "" }));
            pushNotif("Restok diterima: stok unit bertambah dan belanja tercatat.", "success");
            setTab("laporan");
            return;
          }
          // 1) Stok gudang naik (simpan id baris untuk rollback jika belanja gagal)
          await catatStokBahanRows([{
            id: stockRowId,
            bahanId: b.id, bahanNama: b.nama, tipe: "masuk", qty: qtyYield,
            date: tgl, note: note + " (+stok " + qtyYield + ")",
            refType: "belanja", refId: ambilId
          }]);
          stokSudahMasuk = true;
          // 2) Uang keluar dari kas belanja (jatah HPP) — BUKAN pengeluaranOwner
          //    supaya laba tidak double (laba sudah pakai HPP distribusi).
          const ambilRow = {
            id: ambilId,
            date: tgl,
            ts: nowIso(),
            jumlah: bayar,
            keterangan: "[Belanja Bahan] " + b.nama + (restok.note ? " — " + restok.note : ""),
            bahanId: b.id,
            bahanNama: b.nama,
            qtyYield: qtyYield,
            fotoUrl: restok.fotoUrl || null,
            fotoPath: restok.fotoPath || null,
            sumber: "gudang_restok",
            version: "belanja-per-bahan@2026-07"
          };
          let { error } = await sb.from("pengambilanBelanja").insert([ambilRow]);
          // Fallback skema ketat: coba tanpa kolom ekstra jika ditolak
          if (error && /column|schema|bahanId|qtyYield|sumber|version/i.test(String(error.message || error))) {
            const slim = {
              id: ambilId, date: tgl, ts: nowIso(), jumlah: bayar,
              keterangan: ambilRow.keterangan,
              fotoUrl: ambilRow.fotoUrl, fotoPath: ambilRow.fotoPath
            };
            const r2 = await sb.from("pengambilanBelanja").insert([slim]);
            error = r2.error;
            if (!error) {
              pushNotif("Belanja tersimpan (mode kompatibel). Jalankan migration_sprint_AB.sql agar tag bahan & laporan per bahan lengkap.", "warning");
            }
          }
          if (error) throw error;
          await S.loadKey("pengambilanBelanja");

          // 3) Opsional: update harga master HPP proporsional ke 1 batch kapasitas
          //    hargaBeli baru = bayar * (kapasitas / qtyYield)  → setara 1 batch
          if (restok.updateHpp) {
            const hargaPerBatch = bayar * (kap / qtyYield);
            const { error: e2 } = await sb.from("bahanPokok").update({
              hargaBeli: roundHppRp(hargaPerBatch)
            }).eq("id", b.id);
            if (e2) throw e2;
            await S.loadKey("bahanPokok");
          }

          setRestok((f) => ({ ...f, batch: "1", qtyYield: "", jumlahBayar: "", note: "", fotoUrl: "", fotoPath: "" }));
          pushNotif(
            "Restok " + b.nama + ": +" + qtyYield + " stok, belanja " + fmtRp(bayar) +
            (restok.updateHpp ? ", HPP master diupdate." : "."),
            "success"
          );
          setTab("laporan");
        } catch (e) {
          // Rollback stok jika uang belanja gagal tersimpan (hindari stok naik tanpa nota/uang)
          if (stokSudahMasuk) {
            try {
              await catatStokBahanRows([{
                bahanId: b.id, bahanNama: b.nama, tipe: "keluar", qty: qtyYield,
                date: today(),
                note: "Rollback otomatis: gagal simpan belanja (" + (e?.message || e) + ")",
                refType: "belanja_rollback", refId: ambilId
              }]);
            } catch (rbErr) {
              pushNotif("Belanja gagal DAN rollback stok gagal — cek Gudang manual. " + (rbErr?.message || rbErr), "warning");
            }
          }
          pushNotif(e?.message || String(e), "warning");
        } finally {
          setBusy(false);
        }
      };

      if (bayar > saldoKasBelanja + 0.5) {
        confirmAsk({
          title: "Kas Belanja Tidak Cukup",
          message: "Saldo kas belanja " + fmtRp(saldoKasBelanja) + " tapi belanja " + fmtRp(bayar) + ". Lanjut? (saldo jatah bisa minus — artinya belanja lebih besar dari HPP yang terkumpul)",
          confirmLabel: "Tetap Lanjut",
          onConfirm: run
        });
        return;
      }
      await run();
    };

    // ── Laporan per bahan: jatah HPP (estimasi dari pemakaian produksi × HPP/pcs bahan) vs belanja aktual ──
    const laporan = (() => {
      const bulan = bulanLap;
      // Belanja aktual dari pengambilanBelanja yang punya bahanId / tag
      const belanjaRows = ambilAll.filter((p) => String(p.date || "").startsWith(bulan));
      const belanjaByBahan = {};
      belanjaRows.forEach((p) => {
        const key = p.bahanId || (String(p.keterangan || "").includes("[Belanja Bahan]") ? ("ket:" + p.keterangan) : "__umum__");
        if (!belanjaByBahan[key]) belanjaByBahan[key] = { bahanId: p.bahanId || null, bahanNama: p.bahanNama || null, total: 0, qty: 0, rows: [] };
        belanjaByBahan[key].total += Number(p.jumlah) || 0;
        belanjaByBahan[key].qty += Number(p.qtyYield) || 0;
        if (!belanjaByBahan[key].bahanNama && p.bahanNama) belanjaByBahan[key].bahanNama = p.bahanNama;
        belanjaByBahan[key].rows.push(p);
      });

      // Estimasi pemakaian & nilai HPP standar dari ledger produksi bulan ini
      const pakaiByBahan = {};
      getStokBahanLedger().filter((e) => e.tipe === "produksi" && String(e.date || "").startsWith(bulan)).forEach((e) => {
        if (!pakaiByBahan[e.bahanId]) pakaiByBahan[e.bahanId] = { qty: 0, nilaiHpp: 0 };
        const b = bahan.find((x) => x.id === e.bahanId);
        const hppPcs = b ? getBahanHppPerPcs(b) : 0;
        const q = Number(e.qty) || 0;
        pakaiByBahan[e.bahanId].qty += q;
        pakaiByBahan[e.bahanId].nilaiHpp += q * hppPcs;
      });

      // Jatah kas belanja bulan ini (HPP distribusi)
      const jatahBulan = distribAktif.filter((d) => String(d.date || "").startsWith(bulan)).reduce((a, d) => a + (d.hppTotal || 0), 0);
      const ambilBulan = belanjaRows.reduce((a, p) => a + (p.jumlah || 0), 0);

      const perBahan = bahan.map((b) => {
        const pakai = pakaiByBahan[b.id] || { qty: 0, nilaiHpp: 0 };
        const bel = Object.values(belanjaByBahan).filter((x) => x.bahanId === b.id);
        const belanjaRp = bel.reduce((a, x) => a + x.total, 0);
        const belanjaQty = bel.reduce((a, x) => a + x.qty, 0);
        return {
          id: b.id,
          nama: b.nama,
          saldo: saldoMap[b.id] || 0,
          pakaiQty: pakai.qty,
          nilaiHppPakai: roundHppRp(pakai.nilaiHpp),
          belanjaRp,
          belanjaQty,
          selisihBelanjaVsHpp: belanjaRp - roundHppRp(pakai.nilaiHpp)
        };
      }).filter((r) => r.pakaiQty > 0 || r.belanjaRp > 0 || Math.abs(r.saldo) > 0.001);

      const belanjaUmum = (belanjaByBahan["__umum__"]?.total) || 0;
      return { jatahBulan, ambilBulan, sisaJatahBulan: jatahBulan - ambilBulan, perBahan, belanjaUmum, belanjaRows };
    })();

    const filteredLedger = ledger.filter((e) => !filterBahan || e.bahanId === filterBahan).slice(0, 80);
    const tipeLabel = (t) => ({
      masuk: "Masuk", keluar: "Keluar", produksi: "Produksi",
      retur_produksi: "Retur produksi", koreksi: "Koreksi"
    }[t] || t);

    const bRestok = bahan.find((x) => x.id === restok.bahanId);
    const kapRestok = Math.max(parseInt(bRestok?.kapasitas || 1) || 1, 1);
    const qtyPreview = restok.modeQty === "batch"
      ? (parseFloat(restok.batch || 0) || 0) * kapRestok
      : (parseFloat(restok.qtyYield || 0) || 0);
    const bayarPreview = parseFloat(restok.jumlahBayar || 0) || 0;
    const hppBaruPreview = (restok.updateHpp && qtyPreview > 0)
      ? roundHppRp(bayarPreview * (kapRestok / qtyPreview))
      : null;

    return React.createElement("div", null,
      confirmModal,
      React.createElement("h3", { className: "section-title mt8" }, "Gudang bahan & belanja"),
      React.createElement("p", { className: "info-txt" },
        "Alur: Beli bahan (restok+uang) → stok naik & kas belanja berkurang. ",
        "Produksi → stok turun otomatis. Distribusi → jatah HPP/kas belanja naik (bukan potong stok bahan lagi). ",
        "Laporan memisahkan jatah HPP vs belanja aktual (kentang, gandum, dll)."
      ),

      React.createElement("div", { className: "kpi-grid mt8" },
        React.createElement("div", { className: "kpi-card" },
          React.createElement("div", { className: "kpi-label" }, "Saldo Dana Bahan"),
          React.createElement("div", { className: "kpi-val", style: { color: saldoKasBelanja < 0 ? "var(--red)" : "var(--green)" } }, fmtRp(saldoKasBelanja))
        ),
        React.createElement("div", { className: "kpi-card kpi-peng" },
          React.createElement("div", { className: "kpi-label" }, "Bahan habis/minus"),
          React.createElement("div", { className: "kpi-val" }, rowsSaldo.filter((r) => r.minWarn).length)
        ),
        React.createElement("div", { className: "kpi-card" },
          React.createElement("div", { className: "kpi-label" }, "Jenis bahan"),
          React.createElement("div", { className: "kpi-val" }, bahan.length)
        )
      ),

      React.createElement("div", { className: "row-wrap mb8 mt8" },
        [
          { k: "saldo", l: "Stok tersedia" },
          { k: "restok", l: "Beli & terima bahan" },
          { k: "laporan", l: "HPP vs belanja aktual" },
          { k: "mutasi", l: "Koreksi/mutasi stok" }
        ].map((t) => React.createElement("button", {
          key: t.k, className: "tab" + (tab === t.k ? " active" : ""), onClick: () => setTab(t.k)
        }, t.l))
      ),

      // ════ SALDO ════
      tab === "saldo" && React.createElement("div", null,
        bahan.length === 0 && React.createElement(EmptyState, {
        icon: "🌾",
        title: "Belum ada bahan gudang",
        desc: "Tambah bahan (kentang, gandum, minyak…) di Menu & HPP → Bahan Pokok, lalu isi resep menu agar produksi memotong stok otomatis.",
        actionLabel: "Buka menu & modal",
        onAction: () => { if (goSetting) goSetting("hpp"); }
      }),
        React.createElement("table", { className: "tbl mt8" },
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", null, "Bahan"),
              React.createElement("th", null, "HPP/batch"),
              React.createElement("th", null, "Saldo yield"),
              React.createElement("th", null, "Status"),
              React.createElement("th", null, "")
            )
          ),
          React.createElement("tbody", null,
            rowsSaldo.map((b) =>
              React.createElement("tr", { key: b.id },
                React.createElement("td", null, b.nama),
                React.createElement("td", null, fmtRp(b.hargaBeli), React.createElement("span", { style: { fontSize: 11, color: "var(--text2)" } }, " /", b.kapasitas, "pcs")),
                React.createElement("td", null,
                  React.createElement("strong", {
                    style: { color: b.minWarn ? "var(--red)" : b.low ? "var(--yellow)" : "var(--green)" }
                  }, Number(b.saldo).toLocaleString("id-ID", { maximumFractionDigits: 2 }))
                ),
                React.createElement("td", null, b.minWarn ? "Habis/Minus" : b.low ? "Menipis" : "Aman"),
                React.createElement("td", null,
                  React.createElement("button", { className: "btn-secondary btn-sm", disabled: busy, onClick: () => restokSatuBatch(b) }, "Restok")
                )
              )
            )
          )
        )
      ),

      // ════ RESTOK + BELANJA ════
      tab === "restok" && React.createElement("div", null,
        React.createElement("div", { className: "form-card mt8" },
          React.createElement("h4", null, "Restok + Uang Belanja (1 form)"),
          React.createElement("p", { className: "info-txt" },
            "Isi area/unit tujuan, bahan, jumlah yang diterima, dan harga nota. Stok baru bertambah setelah barang benar-benar diterima."
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Area Operasional"),
            React.createElement("select", { className: "inp", value: restokAreaId, onChange: (e) => { setRestokAreaId(e.target.value); setRestokUnitId(""); } },
              React.createElement("option", { value: "" }, "-- pilih area --"),
              areaOptions.map((a) => React.createElement("option", { key: a.id, value: a.id }, a.name))
            )
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Unit tujuan stok"),
            React.createElement("select", { className: "inp", value: restokUnitId, onChange: (e) => setRestokUnitId(e.target.value) },
              React.createElement("option", { value: "" }, "-- pilih CK/lapak --"),
              unitOptions.map((u) => React.createElement("option", { key: u.id, value: u.id }, u.name))
            )
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Bahan"),
            React.createElement("select", {
              className: "inp", value: restok.bahanId,
              onChange: (e) => setRestok((f) => ({ ...f, bahanId: e.target.value }))
            },
              React.createElement("option", { value: "" }, "-- pilih: kentang / gandum / dll --"),
              bahan.map((b) => React.createElement("option", { key: b.id, value: b.id },
                b.nama, " · saldo ", Number(saldoMap[b.id] || 0).toLocaleString("id-ID"),
                " · HPP batch ", fmtRp(b.hargaBeli)
              ))
            )
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Cara isi qty"),
            React.createElement("select", {
              className: "inp", value: restok.modeQty,
              onChange: (e) => setRestok((f) => ({ ...f, modeQty: e.target.value }))
            },
              React.createElement("option", { value: "batch" }, "Per batch (= kapasitas di master HPP)"),
              React.createElement("option", { value: "yield" }, "Langsung yield-pcs")
            )
          ),
          restok.modeQty === "batch"
            ? React.createElement("div", { className: "field-group" },
                React.createElement("label", null, "Jumlah batch"),
                React.createElement("input", {
                  className: "inp", type: "number", min: "0", step: "0.01",
                  value: restok.batch, onChange: (e) => setRestok((f) => ({ ...f, batch: e.target.value }))
                }),
                bRestok && React.createElement("p", { className: "info-txt" },
                  "1 batch = ", kapRestok, " yield-pcs → total masuk ", qtyPreview, " pcs ekuivalen"
                )
              )
            : React.createElement("div", { className: "field-group" },
                React.createElement("label", null, "Qty masuk (yield-pcs)"),
                React.createElement("input", {
                  className: "inp", type: "number", min: "0", step: "0.01",
                  value: restok.qtyYield, onChange: (e) => setRestok((f) => ({ ...f, qtyYield: e.target.value }))
                })
              ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Uang belanja aktual (Rp) — contoh belanja kentang"),
            React.createElement("input", {
              className: "inp", type: "number", min: "0",
              value: restok.jumlahBayar, onChange: (e) => setRestok((f) => ({ ...f, jumlahBayar: e.target.value })),
              placeholder: "Nominal di nota supplier"
            })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Tanggal nota"),
            React.createElement("input", {
              className: "inp", type: "date", value: restok.date,
              onChange: (e) => setRestok((f) => ({ ...f, date: e.target.value }))
            })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Catatan"),
            React.createElement("input", {
              className: "inp", value: restok.note,
              onChange: (e) => setRestok((f) => ({ ...f, note: e.target.value })),
              placeholder: "Toko / no nota..."
            })
          ),
          React.createElement("label", {
            className: "peng-row", style: { cursor: "pointer", gap: 8, alignItems: "center" }
          },
            React.createElement("input", {
              type: "checkbox", checked: !!restok.updateHpp,
              onChange: (e) => setRestok((f) => ({ ...f, updateHpp: e.target.checked }))
            }),
            React.createElement("span", { style: { fontSize: 13 } },
              "Update harga master HPP bahan dari nota ini (agar HPP menu ikut menyesuaikan)"
            )
          ),
          restok.updateHpp && qtyPreview > 0 && bayarPreview > 0 && React.createElement("p", { className: "info-txt" },
            "HPP batch baru ≈ ", fmtRp(hppBaruPreview), " per ", kapRestok, " yield-pcs",
            bRestok ? " (lama " + fmtRp(bRestok.hargaBeli) + ")" : ""
          ),
          React.createElement("div", { className: "form-card mt8", style: { padding: 10 } },
            React.createElement("div", { style: { fontSize: 13 } }, "Preview: stok +", qtyPreview, " · belanja ", fmtRp(bayarPreview)),
            React.createElement("div", { style: { fontSize: 12, color: "var(--text2)" } },
              "Kas belanja sekarang ", fmtRp(saldoKasBelanja),
              bayarPreview > 0 ? " → sisa " + fmtRp(saldoKasBelanja - bayarPreview) : ""
            )
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Foto nota (opsional)"),
            React.createElement("input", {
              className: "inp", type: "file", accept: "image/*",
              disabled: uploadingNota || busy,
              onChange: async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                try {
                  setUploadingNota(true);
                  const uploaded = await uploadAsset(file, "nota-belanja-bahan", { maxBytes: 350 * 1024, maxEdge: 1600 });
                  setRestok((f) => ({ ...f, fotoUrl: uploaded.url || "", fotoPath: uploaded.path || "" }));
                  const info = uploaded.compressed
                    ? (" dikompres " + formatBytes(uploaded.originalBytes) + " → " + formatBytes(uploaded.bytes))
                    : (" (" + formatBytes(uploaded.bytes || file.size) + ")");
                  pushNotif("Foto nota terunggah" + info + ".", "success");
                } catch (err) {
                  pushNotif(err?.message || String(err), "warning");
                } finally {
                  setUploadingNota(false);
                  e.target.value = "";
                }
              }
            }),
            restok.fotoUrl && React.createElement("p", { className: "info-txt" }, "Nota terpasang ✓ ",
              React.createElement("button", {
                type: "button", className: "btn-secondary btn-sm",
                onClick: () => setRestok((f) => ({ ...f, fotoUrl: "", fotoPath: "" }))
              }, "Hapus foto")
            )
          ),
          React.createElement("button", {
            className: "btn-primary mt8", disabled: busy || uploadingNota, onClick: doRestokBelanja
          }, busy ? "Menyimpan..." : "Simpan Beli bahan (restok)")
        )
      ),

      // ════ LAPORAN ════
      tab === "laporan" && React.createElement("div", null,
        React.createElement("div", { className: "filter-bar mb8 row-wrap" },
          React.createElement("input", {
            type: "month", className: "inp inp-sm", value: bulanLap,
            onChange: (e) => setBulanLap(e.target.value)
          }),
          React.createElement("button", {
            className: "btn-secondary",
            onClick: () => exportGudangBelanjaExcel(bulanLap, pushNotif)
          }, "Export Excel")
        ),
        React.createElement("div", { className: "kpi-grid mt8" },
          React.createElement("div", { className: "kpi-card" },
            React.createElement("div", { className: "kpi-label" }, "Jatah modal dari kiriman"),
            React.createElement("div", { className: "kpi-val" }, fmtRp(laporan.jatahBulan))
          ),
          React.createElement("div", { className: "kpi-card kpi-peng" },
            React.createElement("div", { className: "kpi-label" }, "Belanja aktual"),
            React.createElement("div", { className: "kpi-val" }, fmtRp(laporan.ambilBulan))
          ),
          React.createElement("div", { className: "kpi-card" },
            React.createElement("div", { className: "kpi-label" }, "Sisa jatah bulan"),
            React.createElement("div", {
              className: "kpi-val",
              style: { color: laporan.sisaJatahBulan < 0 ? "var(--red)" : "var(--green)" }
            }, fmtRp(laporan.sisaJatahBulan))
          )
        ),
        React.createElement("p", { className: "info-txt" },
          "Jatah = HPP produk yang didistribusi (amplop restok). Belanja = uang nota per bahan dari form Restok. ",
          "Nilai HPP pakai = qty terpakai produksi × HPP standar bahan (bukan harga nota)."
        ),
        React.createElement("h3", { className: "section-title mt12" }, "Per bahan (kentang, gandum, …)"),
        React.createElement("table", { className: "tbl mt8" },
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", null, "Bahan"),
              React.createElement("th", null, "Stok sisa"),
              React.createElement("th", null, "Pakai produksi"),
              React.createElement("th", null, "Nilai HPP pakai"),
              React.createElement("th", null, "Belanja aktual Rp"),
              React.createElement("th", null, "Selisih belanja−HPP")
            )
          ),
          React.createElement("tbody", null,
            laporan.perBahan.length === 0 && React.createElement("tr", null,
              React.createElement("td", { colSpan: 6 }, "Belum ada pemakaian/belanja di bulan ini.")
            ),
            laporan.perBahan.map((r) =>
              React.createElement("tr", { key: r.id },
                React.createElement("td", null, r.nama),
                React.createElement("td", null, Number(r.saldo).toLocaleString("id-ID", { maximumFractionDigits: 2 })),
                React.createElement("td", null, Number(r.pakaiQty).toLocaleString("id-ID", { maximumFractionDigits: 2 })),
                React.createElement("td", null, fmtRp(r.nilaiHppPakai)),
                React.createElement("td", null, React.createElement("strong", null, fmtRp(r.belanjaRp))),
                React.createElement("td", {
                  style: { color: r.selisihBelanjaVsHpp > 0 ? "var(--red)" : r.selisihBelanjaVsHpp < 0 ? "var(--green)" : "var(--text2)" }
                }, fmtRp(r.selisihBelanjaVsHpp))
              )
            )
          )
        ),
        laporan.belanjaUmum > 0 && React.createElement("p", { className: "info-txt mt8" },
          "Belanja kas belanja tanpa tag bahan (lama/umum): ", fmtRp(laporan.belanjaUmum)
        ),
        React.createElement("h3", { className: "section-title mt12" }, "Rincian belanja bulan ini"),
        laporan.belanjaRows.length === 0 && React.createElement(EmptyState, { icon: "🧾", title: "Belum ada belanja bahan bulan ini", desc: "Pakai tab Beli bahan: pilih bahan, qty, dan uang nota.", actionLabel: "Buka beli bahan", onAction: () => setTab("restok") }),
        laporan.belanjaRows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((p) =>
          React.createElement("div", { key: p.id, className: "peng-row" },
            React.createElement("div", { className: "peng-info" },
              React.createElement("span", { className: "peng-ket" },
                p.bahanNama || "Umum", " — ", p.keterangan || "Belanja"
              ),
              React.createElement("span", { className: "peng-ts" },
                formatTanggalIndoPendek(p.date),
                p.qtyYield ? " · +" + p.qtyYield + " yield" : ""
              )
            ),
            React.createElement("div", { className: "peng-right", style: { display: "flex", gap: 8, alignItems: "center" } },
              p.fotoUrl && React.createElement("a", {
                href: p.fotoUrl, target: "_blank", rel: "noreferrer",
                style: { fontSize: 12, color: "var(--accent)" }
              }, "Nota"),
              React.createElement("span", { className: "peng-jml" }, fmtRp(p.jumlah))
            )
          )
        )
      ),

      // ════ MUTASI MANUAL / KOREKSI ════
      tab === "mutasi" && React.createElement("div", null,
        React.createElement("p", { className: "info-txt" },
          "Untuk koreksi stok fisik atau keluar non-produksi. Restok berbayar lebih baik lewat tab Beli bahan (restok)."
        ),
        React.createElement("div", { className: "form-card mt8" },
          React.createElement("h4", null, "Mutasi stok saja (tanpa uang)"),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Bahan"),
            React.createElement("select", {
              className: "inp", value: form.bahanId,
              onChange: (e) => setForm((f) => ({ ...f, bahanId: e.target.value }))
            },
              React.createElement("option", { value: "" }, "-- pilih bahan --"),
              bahan.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.nama))
            )
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Jenis"),
            React.createElement("select", {
              className: "inp", value: form.tipe,
              onChange: (e) => setForm((f) => ({ ...f, tipe: e.target.value }))
            },
              React.createElement("option", { value: "masuk" }, "Masuk (tanpa belanja)"),
              React.createElement("option", { value: "keluar" }, "Keluar"),
              React.createElement("option", { value: "koreksi" }, "Koreksi set saldo")
            )
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, form.tipe === "koreksi" ? "Saldo target" : "Qty"),
            React.createElement("input", {
              className: "inp", type: "number", value: form.qty,
              onChange: (e) => setForm((f) => ({ ...f, qty: e.target.value }))
            })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Tanggal"),
            React.createElement("input", {
              className: "inp", type: "date", value: form.date,
              onChange: (e) => setForm((f) => ({ ...f, date: e.target.value }))
            })
          ),
          React.createElement("div", { className: "field-group" },
            React.createElement("label", null, "Catatan"),
            React.createElement("input", {
              className: "inp", value: form.note,
              onChange: (e) => setForm((f) => ({ ...f, note: e.target.value }))
            })
          ),
          React.createElement("button", { className: "btn-primary", disabled: busy, onClick: doCatat }, "Simpan Mutasi")
        ),
        React.createElement("h3", { className: "section-title mt12" }, "Riwayat mutasi stok"),
        React.createElement("div", { className: "filter-bar mb8" },
          React.createElement("select", {
            className: "inp inp-sm", value: filterBahan,
            onChange: (e) => setFilterBahan(e.target.value)
          },
            React.createElement("option", { value: "" }, "Semua bahan"),
            bahan.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.nama))
          )
        ),
        filteredLedger.length === 0 && React.createElement(EmptyState, { icon: "📦", title: "Belum ada mutasi stok", desc: "Muncul setelah restok, produksi, atau koreksi. Mulai dari tab Beli bahan.", actionLabel: "Buka beli bahan", onAction: () => setTab("restok") }),
        filteredLedger.map((e) => {
          const sign = (e.tipe === "masuk" || e.tipe === "retur_produksi") ? "+"
            : (e.tipe === "koreksi" ? ((Number(e.qtySign) || 0) >= 0 ? "+" : "") : "−");
          const showQty = e.tipe === "koreksi" ? (Number(e.qtySign) || 0) : (Number(e.qty) || 0);
          return React.createElement("div", { key: e.id, className: "peng-row" },
            React.createElement("div", { className: "peng-info" },
              React.createElement("span", { className: "peng-ket" }, e.bahanNama || e.bahanId, " · ", tipeLabel(e.tipe)),
              React.createElement("span", { className: "peng-ts" },
                formatTanggalIndoPendek(e.date),
                e.menuNama ? " · " + e.menuNama + (e.qtyMenu ? " x" + e.qtyMenu : "") : "",
                e.note ? " — " + e.note : ""
              )
            ),
            React.createElement("div", { className: "peng-right" },
              React.createElement("span", {
                className: "peng-jml",
                style: { color: sign === "+" || (e.tipe === "koreksi" && showQty >= 0) ? "var(--green)" : "var(--red)" }
              }, sign, Math.abs(showQty).toLocaleString("id-ID", { maximumFractionDigits: 2 }))
            )
          );
        })
      )
    );
  }

  // ─── SettingArusKasOps — arus kas operasional sederhana (bukan PSAK) ─────
  function SettingArusKasOps({ pushNotif }) {
    const tick = useStoreTick();
    const [bulan, setBulan] = useState(today().slice(0, 7));
    const [branchId, setBranchId] = useState("all");
    const branches = (S.get("branches") || []).filter((b) => b.type !== "central_kitchen");
    const range = monthRange(bulan);
    const ak = hitungArusKasOperasional({ dateFrom: range.from, dateTo: range.to, branchId });
    const exportAk = () => {
      if (typeof XLSX === "undefined") { pushNotif("Library Excel belum termuat.", "warning"); return; }
      const wb = XLSX.utils.book_new();
      const rows = [
        ["Arus Kas Operasional (sederhana)"],
        ["Bulan", bulan],
        ["Cabang", branchId === "all" ? "Semua" : branchId],
        [],
        ["Penjualan di app", ak.omzetSistem],
        ["Kas masuk (setoran dikonfirmasi)", ak.kasMasukSetoran],
        ["Keluar pengeluaran lapak", ak.keluarLapak],
        ["Keluar pengeluaran owner", ak.keluarOwner],
        ["Keluar belanja bahan", ak.keluarBelanja],
        ["Total keluar", ak.totalKeluar],
        ["Neto (setoran - keluar)", ak.netoSetoranVsKeluar],
        [],
        ["Catatan: ini kontrol operasional, bukan laporan arus kas PSAK."],
        ["Penjualan di app bisa beda dari kas masuk jika ada selisih setoran / timing."]
      ];
      XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(rows)), "ArusKas");
      XLSX.writeFile(wb, "arus-kas-ops-" + bulan + ".xlsx");
      pushNotif("Excel arus kas diunduh.", "success");
    };
    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Arus Kas Operasional"),
      React.createElement("p", { className: "info-txt" },
        "Ringkas: uang masuk dari setoran terkonfirmasi vs uang keluar (lapak, owner, belanja bahan). ",
        "Bukan laporan PSAK — untuk kontrol kas harian/bulanan owner."
      ),
      React.createElement("div", { className: "filter-bar mb8 row-wrap" },
        React.createElement("input", { type: "month", className: "inp inp-sm", value: bulan, onChange: (e) => setBulan(e.target.value) }),
        React.createElement("select", { className: "inp inp-sm", value: branchId, onChange: (e) => setBranchId(e.target.value) },
          React.createElement("option", { value: "all" }, "Semua cabang"),
          branches.map((b) => React.createElement("option", { key: b.id, value: b.id }, b.name))
        ),
        React.createElement("button", { className: "btn-secondary", onClick: exportAk }, "Export Excel")
      ),
      React.createElement("div", { className: "kpi-grid mt8" },
        React.createElement("div", { className: "kpi-card" },
          React.createElement("div", { className: "kpi-label" }, "Penjualan di app"),
          React.createElement("div", { className: "kpi-val" }, fmtRp(ak.omzetSistem))
        ),
        React.createElement("div", { className: "kpi-card" },
          React.createElement("div", { className: "kpi-label" }, "Kas masuk setoran"),
          React.createElement("div", { className: "kpi-val", style: { color: "var(--green)" } }, fmtRp(ak.kasMasukSetoran))
        ),
        React.createElement("div", { className: "kpi-card kpi-peng" },
          React.createElement("div", { className: "kpi-label" }, "Total keluar"),
          React.createElement("div", { className: "kpi-val" }, fmtRp(ak.totalKeluar))
        ),
        React.createElement("div", { className: "kpi-card" },
          React.createElement("div", { className: "kpi-label" }, "Neto"),
          React.createElement("div", { className: "kpi-val", style: { color: ak.netoSetoranVsKeluar < 0 ? "var(--red)" : "var(--green)" } }, fmtRp(ak.netoSetoranVsKeluar))
        )
      ),
      React.createElement("table", { className: "tbl mt12" },
        React.createElement("tbody", null,
          React.createElement("tr", null, React.createElement("td", null, "Pengeluaran lapak"), React.createElement("td", null, fmtRp(ak.keluarLapak))),
          React.createElement("tr", null, React.createElement("td", null, "Pengeluaran owner (termasuk gaji/selisih kas)"), React.createElement("td", null, fmtRp(ak.keluarOwner))),
          React.createElement("tr", null, React.createElement("td", null, "Belanja bahan (kas belanja)"), React.createElement("td", null, fmtRp(ak.keluarBelanja))),
          React.createElement("tr", null, React.createElement("td", null, "Jumlah transaksi"), React.createElement("td", null, ak.txCount)),
          React.createElement("tr", null, React.createElement("td", null, "Setoran selesai"), React.createElement("td", null, ak.setoranCount))
        )
      )
    );
  }

  // ─── SettingDiagnostik — skor kesehatan app + cek konfigurasi ───────────
  function SettingDiagnostik({ pushNotif, goHppMenu }) {
    const tick = useStoreTick();
    const bahan = S.get("bahanPokok") || [];
    const menus = S.get("menuVarian") || [];
    const branches = S.get("branches") || [];
    const saldoMap = getAllStokBahanSaldoMap();
    const gudangHabis = bahan.filter((b) => (saldoMap[b.id] || 0) <= 0);
    const menusTanpaResep = menus.filter((m) => m.tipe !== "paket" && m.tipe !== "toping" && !(m.resepBahanPokok && m.resepBahanPokok.length));
    const setoranSelisih = (S.get("setoranHarian") || []).filter((s) => s.status === "menunggu" && s.selisihKas != null && Math.abs(Number(s.selisihKas)) >= 1);
    const hasXlsx = typeof XLSX !== "undefined";
    const hasSb = !!sb;
    const bucketOk = (() => { try { const b = getAssetBucket(); return b && b !== "ganti_dengan_nama_bucket_kamu"; } catch { return false; } })();
    const gajiHistLoaded = !!gajiHistoriCache.loaded;
    const stokLoaded = !!stokBahanCache.loaded;
    const menusSatuan = menus.filter((m) => m.tipe !== "paket" && m.tipe !== "toping");
    const adaCK = branches.some((b) => b.type === "central_kitchen");
    const workers = (S.get("profiles") || []).filter((p) => isActiveProfile(p) && p.role === "worker");
    const adaStokGudang = Object.values(saldoMap || {}).some((v) => Number(v) > 0);
    const adaHargaMenu = menusSatuan.length > 0 && menusSatuan.every((m) => Number(m.hargaJual) > 0);

    // Siap jual = data bisnis minimal untuk operasi harian (bukan cek teknis library)
    const jualChecks = [
      { ok: branches.length > 0 && adaCK, label: "Cabang + Central Kitchen" },
      { ok: bahan.length > 0, label: "Bahan pokok terisi" },
      { ok: menusSatuan.length > 0, label: "Ada menu satuan" },
      { ok: menusTanpaResep.length === 0 && menusSatuan.length > 0, label: "Semua menu ber-resep" },
      { ok: adaHargaMenu, label: "Semua menu punya harga jual" },
      { ok: adaStokGudang, label: "Stok gudang sudah diisi" },
      { ok: workers.length > 0, label: "Ada akun pekerja" },
      { ok: gudangHabis.length === 0 || bahan.length === 0, label: "Tidak ada bahan minus" }
    ];
    const jualOk = jualChecks.filter((x) => x.ok).length;
    const jualScore = Math.round(100 * jualOk / jualChecks.length);
    const siapJual = jualScore === 100;

    const checks = [
      { ok: hasSb, label: "Supabase client (sb)", fix: "Cek config.js & urutan script" },
      { ok: bucketOk, label: "Bucket storage foto", fix: "Isi SUPABASE_ASSET_BUCKET di config.js" },
      { ok: hasXlsx, label: "Library Excel (XLSX)", fix: "Pastikan xlsx.full.min.js di index.html" },
      { ok: gajiHistLoaded, label: "Histori gaji termuat", fix: "Logout/login ulang" },
      { ok: stokLoaded, label: "Ledger gudang termuat", fix: "Logout/login ulang" },
      { ok: branches.length > 0, label: "Ada cabang", fix: "Setting → Cabang" },
      { ok: bahan.length > 0, label: "Ada bahan pokok", fix: "Setting → Menu & HPP → Bahan" },
      { ok: menusTanpaResep.length === 0, label: "Semua menu satuan punya resep bahan", fix: "Lengkapi resep agar stok gudang terpotong" },
      { ok: gudangHabis.length === 0, label: "Tidak ada bahan habis/minus", fix: "Restok di Gudang Bahan" },
      { ok: setoranSelisih.length === 0, label: "Tidak ada setoran selisih menunggu", fix: "Menu Setoran" }
    ];
    const score = Math.round(100 * checks.filter((x) => x.ok).length / checks.length);

    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Diagnostik Sistem"),
      React.createElement("p", { className: "info-txt" },
        "Dua skor: (1) kesehatan teknis/app, (2) kesiapan data untuk jualan harian. ",
        "Target: keduanya hijau sebelum buka cabang."
      ),
      React.createElement("div", { className: "kpi-grid mt8" },
        React.createElement("div", { className: "kpi-card" },
          React.createElement("div", { className: "kpi-label" }, "Skor teknis app"),
          React.createElement("div", { className: "kpi-val", style: { color: score >= 90 ? "var(--green)" : score >= 70 ? "var(--yellow)" : "var(--red)" } }, score, "%")
        ),
        React.createElement("div", { className: "kpi-card " + (siapJual ? "kpi-profit" : "kpi-peng") },
          React.createElement("div", { className: "kpi-label" }, "Siap buka toko"),
          React.createElement("div", { className: "kpi-val" }, jualScore, "%"),
          React.createElement("div", { style: { fontSize: 12, marginTop: 6, fontWeight: 700, color: "var(--text2)" } },
            siapJual ? "Data dasar lengkap — siap operasi" : (jualOk + "/" + jualChecks.length + " syarat terpenuhi")
          )
        )
      ),
      React.createElement("div", { className: "section-label-row mt12" },
        React.createElement("h3", { className: "section-title", style: { marginBottom: 0 } }, "Ceklist siap buka toko"),
        React.createElement("button", {
          type: "button",
          className: "btn-secondary btn-sm",
          onClick: () => {
            if (typeof XLSX === "undefined") {
              pushNotif("Library Excel belum termuat. Pastikan xlsx.full.min.js ada di index.html.", "warning");
              return;
            }
            const wb = XLSX.utils.book_new();
            const rows = [
              ["Checklist Siap Jual — Donat Boss"],
              ["Tanggal export", nowTs()],
              ["Skor siap jual", jualScore + "%"],
              ["Status", siapJual ? "SIAP JUAL" : "BELUM LENGKAP"],
              [],
              ["No", "Syarat", "Status"]
            ];
            jualChecks.forEach((ch, i) => rows.push([i + 1, ch.label, ch.ok ? "Selesai" : "Belum"]));
            rows.push([]);
            rows.push(["Skor teknis app", score + "%"]);
            rows.push([]);
            rows.push(["Menu tanpa resep", menusTanpaResep.length ? menusTanpaResep.map((m) => m.nama).join(", ") : "(tidak ada)"]);
            rows.push(["Bahan habis/minus", gudangHabis.length ? gudangHabis.map((b) => b.nama).join(", ") : "(tidak ada)"]);
            XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(rows)), "SiapJual");
            const tech = [["Cek teknis", "Status", "Perbaikan"]];
            checks.forEach((ch) => tech.push([ch.label, ch.ok ? "OK" : "BELUM", ch.ok ? "" : ch.fix]));
            XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.aoa_to_sheet(tech)), "Teknis");
            XLSX.writeFile(wb, "checklist-siap-jual-" + today() + ".xlsx");
            pushNotif("Excel checklist-siap-jual-" + today() + ".xlsx diunduh.", "success");
          }
        }, "Export Excel")
      ),
      React.createElement("div", { className: "setup-wizard-steps mb8" },
        jualChecks.map((ch, i) =>
          React.createElement("div", {
            key: i,
            className: "setup-step" + (ch.ok ? " setup-step-done" : ""),
            style: { cursor: "default" }
          },
            React.createElement("span", { className: "setup-step-check" }, ch.ok ? "✅" : String(i + 1)),
            React.createElement("span", { className: "setup-step-body" },
              React.createElement("span", { className: "setup-step-label" }, ch.label),
              React.createElement("span", { className: "setup-step-hint" }, ch.ok ? "Selesai" : "Belum")
            )
          )
        )
      ),
      React.createElement("h3", { className: "section-title mt12" }, "Cek teknis & operasional"),
      React.createElement("table", { className: "tbl mt12" },
        React.createElement("thead", null,
          React.createElement("tr", null,
            React.createElement("th", null, "Status"),
            React.createElement("th", null, "Pemeriksaan"),
            React.createElement("th", null, "Perbaikan")
          )
        ),
        React.createElement("tbody", null,
          checks.map((ch, i) =>
            React.createElement("tr", { key: i },
              React.createElement("td", null, ch.ok ? "✅" : "❌"),
              React.createElement("td", null, ch.label),
              React.createElement("td", null, ch.ok ? "—" : ch.fix)
            )
          )
        )
      ),
      menusTanpaResep.length > 0 && React.createElement("div", { className: "alert-banner alert-banner-warn mt8" },
        React.createElement("div", { className: "alert-banner-title" }, menusTanpaResep.length, " menu tanpa resep"),
        React.createElement("div", { className: "alert-banner-item" }, menusTanpaResep.map((m) => m.nama).join(", ")),
        React.createElement("button", {
          type: "button", className: "btn-primary btn-sm mt8",
          onClick: () => goHppMenu && goHppMenu()
        }, "Buka isi resep")
      ),
      gudangHabis.length > 0 && React.createElement("p", { className: "info-txt" },
        "Bahan habis/minus: ", gudangHabis.map((b) => b.nama).join(", ")
      ),
      React.createElement("p", { className: "info-txt mt12" },
        "Jendela data transaksi di perangkat: ",
        (S.getCacheMeta && S.getCacheMeta().from) ? (S.getCacheMeta().from + " s/d " + (S.getCacheMeta().to || today())) : "belum termuat",
        ". Default ~120 hari untuk scale multi-cabang; periode lebih lama dimuat otomatis saat dibuka."
      ),
      React.createElement("button", {
        className: "btn-secondary mt12",
        onClick: () => {
          loadGajiHistoriFromDb().then(() => loadStokBahanFromDb()).then(() => pushNotif("Data gaji & gudang dimuat ulang.", "success")).catch((e) => pushNotif(e?.message || String(e), "warning"));
        }
      }, "Muat ulang histori gaji + ledger gudang"),
      React.createElement("button", {
        className: "btn-secondary mt8",
        onClick: () => {
          S.loadAll({ windowDays: 365 }).then((meta) => {
            pushNotif("Data 365 hari dimuat (" + (meta && meta.from) + " s/d " + (meta && meta.to) + ").", "success");
          }).catch((e) => pushNotif(e?.message || String(e), "warning"));
        }
      }, "Muat data 1 tahun (scale)")
    );
  }

  // ─── SettingDanaPemeliharaan — kas cadangan untuk perbaikan/pemeliharaan ──
  function SettingDanaPemeliharaan({ pushNotif }) {
    const tick = useStoreTick();
    const list = (S.get("danaPemeliharaan") || []).slice().sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    const [form, setForm] = useState({ tipe: "setor", keterangan: "", jumlah: "" });
    const [busy, setBusy] = useState(false);
    const [confirmAsk, confirmModal] = useConfirm();

    const saldo = list.reduce((a, d) => a + (d.tipe === "setor" ? d.jumlah : -d.jumlah), 0);

    const doTambah = async () => {
      const jml = parseFloat(form.jumlah);
      setBusy(true);
      try {
        const { error } = await sb.from("danaPemeliharaan").insert([{
          id: uid(), date: today(), ts: nowIso(), tipe: form.tipe, keterangan: form.keterangan, jumlah: jml
        }]);
        if (error) throw error;
        await S.loadKey("danaPemeliharaan");
        setForm({ tipe: form.tipe, keterangan: "", jumlah: "" });
        pushNotif("Tercatat!", "success");
      } catch (e) { pushNotif(e?.message || String(e), "warning"); }
      finally { setBusy(false); }
    };

    const tambah = () => {
      if (!form.keterangan || !form.jumlah) { pushNotif("Isi keterangan dan jumlah!", "warning"); return; }
      const jml = parseFloat(form.jumlah);
      if (form.tipe === "pakai" && jml > saldo) {
        confirmAsk({
          title: "Saldo Tidak Cukup",
          message: `Saldo dana cadangan hanya ${fmtRp(saldo)}, tapi mau pakai ${fmtRp(jml)}. Tetap lanjut? (saldo akan minus)`,
          confirmLabel: "Tetap Lanjut",
          danger: false,
          onConfirm: doTambah
        });
        return;
      }
      doTambah();
    };

    const hapus = async (id) => {
      const { error } = await sb.from("danaPemeliharaan").delete().eq("id", id);
      if (!error) { await S.loadKey("danaPemeliharaan"); pushNotif("Entri dihapus.", "warning"); }
    };
    const askHapus = (d) => confirmAsk({ title: "Hapus Entri", message: `Hapus entri "${d.keterangan}"?`, onConfirm: () => hapus(d.id) });

    return React.createElement("div", null,
      React.createElement("h3", { className: "section-title mt8" }, "Dana Pemeliharaan & Perbaikan"),
      React.createElement("p", { className: "info-txt" }, "Kas cadangan untuk perbaikan atau kondisi tak terduga. \"Setor\" = menyisihkan dana dari kas operasional ke cadangan. \"Pakai\" = dana cadangan dipakai untuk perbaikan/pemeliharaan."),
      React.createElement("div", { className: "kpi-card kpi-modal mt8", style: { maxWidth: 280 } },
        React.createElement("div", { className: "kpi-label" }, "Saldo Dana Cadangan"),
        React.createElement("div", { className: "kpi-val", style: { color: saldo >= 0 ? "var(--green)" : "var(--red)" } }, fmtRp(saldo))
      ),
      React.createElement("div", { className: "form-card mt8" },
        React.createElement("div", { className: "row-wrap mb8" },
          React.createElement("button", { className: "tab" + (form.tipe === "setor" ? " active" : ""), onClick: () => setForm((f) => ({ ...f, tipe: "setor" })) }, "Setor Dana"),
          React.createElement("button", { className: "tab" + (form.tipe === "pakai" ? " active" : ""), onClick: () => setForm((f) => ({ ...f, tipe: "pakai" })) }, "Pakai Dana")
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Keterangan"),
          React.createElement("input", { className: "inp", value: form.keterangan, onChange: (e) => setForm((f) => ({ ...f, keterangan: e.target.value })), placeholder: form.tipe === "setor" ? "Contoh: Sisihkan dana bulan ini" : "Contoh: Ganti kompor rusak" })
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Jumlah (Rp)"),
          React.createElement("input", { type: "number", className: "inp", value: form.jumlah, onChange: (e) => setForm((f) => ({ ...f, jumlah: e.target.value })) })
        ),
        React.createElement("button", { className: "btn-primary btn-full", disabled: busy, onClick: tambah }, busy ? "Menyimpan..." : (form.tipe === "setor" ? "Setor ke Dana Cadangan" : "Catat Pemakaian Dana"))
      ),
      React.createElement("h4", { className: "sub-title mt12" }, "Riwayat"),
      list.length === 0 && React.createElement(EmptyState, { icon: "📜", title: "Belum ada riwayat", desc: "Riwayat muncul setelah ada aktivitas." }),
      list.map((d) =>
        React.createElement("div", { key: d.id, className: "row-wrap", style: { justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" } },
          React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 13 } }, d.keterangan),
            React.createElement("div", { style: { fontSize: 11, color: "var(--text2)" } }, formatTanggalIndoPendek(d.date), " · ", d.tipe === "setor" ? "Setor" : "Pakai")
          ),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
            React.createElement("strong", { style: { color: d.tipe === "setor" ? "var(--green)" : "var(--red)" } }, d.tipe === "setor" ? "+" : "-", fmtRp(d.jumlah)),
            React.createElement(RowMenu, { actions: [{ label: "Hapus", danger: true, onClick: () => askHapus(d) }] })
          )
        )
      ),
      confirmModal
    );
  }


  // ─── SettingStokLapak — lihat, edit manual, hapus per-baris stok lapak ────
  // ─── OwnerPage ─────────────────────────────────────────────────────────────
  function OwnerPage({ pushNotif, me, tab: tabProp, setTab: setTabProp, historyMode, onHistoryModeChange, isManager, managerCities }) {
    const tick = useStoreTick();
    const [tabLocal, setTabLocal] = useState("dashboard");
    const tab = tabProp !== undefined ? tabProp : tabLocal;
    const setTab = setTabProp || setTabLocal;
    const managerMode = !!isManager || isAreaManager(me);
    const myCities = managerCities && managerCities.length ? managerCities : getProfileCities(me);
    // Manager tidak boleh setting / tutup buku
    useEffect(() => {
      if (!managerMode) return;
      const allowed = new Set(MANAGER_TABS.map((t) => t.key));
      if (!allowed.has(tab)) setTab("dashboard");
    }, [managerMode, tab]);
    const [stab, setStab] = useState("hpp");
    const [hppFocus, setHppFocus] = useState(null); // "menu" | "bahan" | null — buka sub-tab Setting HPP

    // Notifikasi sekali per hari: menu tanpa resep + stok gudang kosong (tidak mengganggu berulang)
    useEffect(() => {
      try {
        const day = today();
        const keyResep = "donatboss_resep_nudge_" + day;
        const keyStok = "donatboss_stok_nudge_" + day;
        const menus = (S.get("menuVarian") || []).filter((m) => m.tipe !== "paket" && m.tipe !== "toping");
        const missing = menus.filter((m) => !(m.resepBahanPokok && m.resepBahanPokok.length));
        if (missing.length && localStorage.getItem(keyResep) !== "1") {
          localStorage.setItem(keyResep, "1");
          pushNotif(
            missing.length + " menu belum punya resep. Dashboard → Isi resep, atau Menu & HPP.",
            "warning"
          );
        }
        const bahan = S.get("bahanPokok") || [];
        if (bahan.length && localStorage.getItem(keyStok) !== "1") {
          const saldoMap = getAllStokBahanSaldoMap();
          const anyPositive = Object.values(saldoMap).some((v) => Number(v) > 0);
          if (!anyPositive) {
            localStorage.setItem(keyStok, "1");
            pushNotif("Stok gudang masih kosong. Isi lewat Setting → Gudang Bahan (Beli bahan (restok)).", "warning");
          }
        }
        // Ringkasan malam: sekali sehari setelah jam 21:00 (WIB via today()/device)
        const keyMalam = "donatboss_ringkas_malam_" + day;
        if (localStorage.getItem(keyMalam) !== "1") {
          const now = new Date();
          // Estimasi jam WIB: pakai offset +7 jika device tidak WIB, fallback jam lokal
          let hourWib = now.getHours();
          try {
            const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }).formatToParts(now);
            const h = parts.find((p) => p.type === "hour");
            if (h) hourWib = Number(h.value);
          } catch {}
          if (hourWib >= 21) {
            const pending = (S.get("setoranHarian") || []).filter((s) => s.status === "menunggu");
            const selisihOpen = (S.get("setoranHarian") || []).filter((s) => s.status === "menunggu" && s.selisihKas != null && Math.abs(Number(s.selisihKas)) >= 1);
            const menus = (S.get("menuVarian") || []).filter((m) => m.tipe !== "paket" && m.tipe !== "toping");
            const missingResep = menus.filter((m) => !(m.resepBahanPokok && m.resepBahanPokok.length));
            const bahan = S.get("bahanPokok") || [];
            const saldoMap = getAllStokBahanSaldoMap();
            const gudangHabisN = bahan.filter((b) => (saldoMap[b.id] != null ? saldoMap[b.id] : 0) <= 0).length;
            const bits = [];
            if (pending.length) bits.push(pending.length + " setoran menunggu");
            if (selisihOpen.length) bits.push(selisihOpen.length + " selisih kas");
            if (gudangHabisN) bits.push(gudangHabisN + " bahan gudang habis/minus");
            if (missingResep.length) bits.push(missingResep.length + " menu tanpa resep");
            try { localStorage.setItem(keyMalam, "1"); } catch {}
            if (bits.length) {
              pushNotif("Ringkasan malam: " + bits.join(" · ") + ". Cek Dashboard / Setoran / Gudang.", "warning");
            } else {
              pushNotif("Ringkasan malam: setoran & data inti terlihat aman. Jangan lupa tutup kas cabang.", "success");
            }
          }
        }
        // Setoran menunggu (1x/hari) — di luar interval 5 detik yang bisa berisik
        const keySetoran = "donatboss_setoran_nudge_" + day;
        if (localStorage.getItem(keySetoran) !== "1") {
          const pending = (S.get("setoranHarian") || []).filter((s) => s.status === "menunggu");
          if (pending.length > 0) {
            try { localStorage.setItem(keySetoran, "1"); } catch {}
            pushNotif(pending.length + " setoran menunggu konfirmasi. Buka menu Setoran.", "warning");
          }
        }
        // Tutup buku: H-2 s/d akhir bulan, atau tgl 1–5 jika bulan lalu belum ditutup
        const keyTutup = "donatboss_tutup_nudge_" + day;
        if (localStorage.getItem(keyTutup) !== "1") {
          const y = Number(day.slice(0, 4)), mo = Number(day.slice(5, 7)), dd = Number(day.slice(8, 10));
          const lastDay = new Date(y, mo, 0).getDate();
          const daysLeft = lastDay - dd;
          let bulanCek = null;
          if (daysLeft <= 2) bulanCek = day.slice(0, 7);
          else if (dd <= 5) bulanCek = mo === 1 ? (y - 1) + "-12" : y + "-" + String(mo - 1).padStart(2, "0");
          if (bulanCek) {
            sb.from("tutupBuku").select("id").eq("bulan", bulanCek).eq("is_current", true).maybeSingle()
              .then(({ data }) => {
                if (!data) {
                  try { localStorage.setItem(keyTutup, "1"); } catch {}
                  pushNotif("Pengingat: tutup bulan " + bulanCek + " belum dikunci. Buka menu Tutup Buku.", "warning");
                }
              }).catch(() => {});
          }
        }
      } catch {}
    }, [tick, pushNotif]);

    useEffect(() => {
      const iv = setInterval(() => {
        try {
          if (localStorage.getItem("donatboss_setoran_banner_hide_" + today()) === "1") return;
          if (localStorage.getItem("donatboss_setoran_nudge_" + today()) === "1") return;
        } catch {}
        const list = S.get("setoranHarian") || [];
        const pending = list.filter((s) => s.status === "menunggu");
        if (pending.length) {
          const noted = S.get("notified_ids") || [];
          const fresh = pending.filter((s) => !noted.includes(s.id));
          if (fresh.length) {
            pushNotif(fresh.length + " setoran menunggu konfirmasi!", "warning");
            S.set("notified_ids", [...noted, ...fresh.map((s) => s.id)]);
            try { localStorage.setItem("donatboss_setoran_nudge_" + today(), "1"); } catch {}
          }
        }
      }, 5000);
      return () => clearInterval(iv);
    }, [pushNotif]);

    const TLABEL = Object.fromEntries(OWNER_TABS.map((t) => [t.key, t.label]));

    return React.createElement("div", { className: "page" },
      React.createElement("div", { className: "page-header" },
        React.createElement("img", { className: "page-icon", src: getBrandLogo(), style: { width: 45, height: 45, objectFit: "cover", borderRadius: 10 } }),
        React.createElement("div", null,
          React.createElement("h2", null, TLABEL[tab] || "Panel owner"),
          React.createElement("p", { className: "page-sub" }, "Pantau toko, uang, dan dapur dari sini")
        )
      ),
      tab === "dashboard"   && React.createElement(OwnerDashboard, { setTab, setStab, setHppFocus, pushNotif, me, managerMode, managerCities: myCities }),
      tab === "performaPeriode" && React.createElement(PerformaPeriode, { pushNotif }),
      tab === "analisaProduk" && React.createElement(AnalisaProduk, { pushNotif }),
      tab === "kasir"       && React.createElement(WorkerPage, { pushNotif, me, mode: "owner", historyMode }),
      tab === "setoran"     && React.createElement(OwnerSetoran, { pushNotif }),
      tab === "shift"       && React.createElement(ShiftKasPanel, { pushNotif, me }),
      tab === "laporan"     && React.createElement(OwnerLaporan, { pushNotif }),
      tab === "absensi"     && React.createElement(OwnerAbsensi, { pushNotif }),
      tab === "pengeluaran" && React.createElement(PengeluaranOwner, { pushNotif }),
      tab === "produksiCK"  && React.createElement(OwnerProduksiCK, { pushNotif }),
      tab === "belanja"     && React.createElement(BelanjaPanel, { pushNotif, me }),
      tab === "pesanan"     && React.createElement(PesananPanel, { pushNotif, me }),
      tab === "stokToping"  && React.createElement(StokTopingPanel, { pushNotif }),
      tab === "tutupBuku"   && !managerMode && React.createElement(TutupBukuPanel, { pushNotif }),
      tab === "setting"     && !managerMode && React.createElement(OwnerSetting, { stab, setStab, pushNotif, historyMode, onHistoryModeChange, hppFocus, setHppFocus }),
      tab === "setting"     && managerMode && React.createElement("div", { className: "form-card" },
        React.createElement("h3", { className: "section-title" }, "Akses terbatas"),
        React.createElement("p", { className: "info-txt" }, "Area Manager tidak membuka Setting penuh. Minta Owner untuk ubah master data / akun. Kota Anda: ", (myCities || []).join(", ") || "—")
      )
    );
  }

  // ─── InvestorPage — Laporan Harian/Bulanan/Tahunan Akumulatif ───────────────
  function InvestorPage({ investorId, pushNotif, me }) {
    const tick = useStoreTick();
    const [tab, setTab] = useState("harian");
    const [selDate, setSelDate] = useState(today());
    const [month, setMonth] = useState(today().slice(0, 7));
    const [year, setYear] = useState(today().slice(0, 4));
    const [openTx, setOpenTx] = useState({});
    // Filter cabang: "" = semua cabang investasi milik investor ini, atau id spesifik
    const [selBranch, setSelBranch] = useState("");
    const toggleTx = (id) => setOpenTx((o) => ({ ...o, [id]: !o[id] }));

    const investors = S.get("investors") || [];
    const invMe = investors.find((i) => i.id === investorId);
    const allInvBranches = (S.get("branches") || []).filter((b) => b.type === "investasi" && (!investorId || b.investorId === investorId));
    const branches = selBranch ? allInvBranches.filter((b) => b.id === selBranch) : allInvBranches;
    const txs = S.get("transactions") || [];
    const pLapakAll = S.get("pengeluaranLapak") || [];
    const pOwnerAll = S.get("pengeluaranOwner") || [];
    const setoranBulAll = (S.get("setoranBulanan") || []).filter((s) => !investorId || s.investorId === investorId);
    const nBranchTotal = Math.max((S.get("branches") || []).filter((b) => b.type !== "central_kitchen").length, 1);

    const konfirmBulananInvestor = (id) => {
      const all = S.get("setoranBulanan") || [];
      S.set("setoranBulanan", all.map((s) => s.id === id ? { ...s, status: "selesai", konfirmasiTs: nowTs(), confirmedBy: "investor", locked: true } : s));
      pushNotif?.("Laporan bulanan dikonfirmasi & dikunci.", "success");
    };

    // Distribusi "dibatalkan" (fitur Retur di OwnerProduksiCK) dibuang di sini —
    // sama seperti hitungPerformaPeriode — supaya laporan yang dilihat investor
    // tidak ikut terbebani HPP dari distribusi yang sudah ditarik balik stoknya.
    const distribAllInv = (S.get("distribusiCK") || []).filter((d) => d.status !== "dibatalkan");
    const allBranchesGlobal = S.get("branches") || [];

    // Helper: hitung akumulasi untuk rentang cabang + tanggal tertentu langsung dari transaksi
    const calcAccum = (branchIds, dateFilter) => {
      // REVISI AUDIT 2026-07: pakai hitungPerformaPeriode (bukan rumus salinan).
      // dateFilter di InvestorPage selalu berbasis prefix tanggal (hari/bulan/tahun),
      // jadi kita turunkan dateFrom/dateTo dari data yang lolos filter, fallback
      // ke rentang luas jika kosong.
      const allDates = [];
      (txs || []).forEach((t) => { if (dateFilter(t.date)) allDates.push(t.date); });
      (pLapakAll || []).forEach((p) => { if (dateFilter(p.date)) allDates.push(p.date); });
      (pOwnerAll || []).forEach((p) => { if (dateFilter(p.date)) allDates.push(p.date); });
      (distribAllInv || []).forEach((d) => { if (dateFilter(d.date)) allDates.push(d.date); });
      // Fallback: scan 400 hari ke belakang dari today untuk cakupan tahunan kosong
      let dateFrom = allDates.length ? allDates.slice().sort()[0] : "2000-01-01";
      let dateTo = allDates.length ? allDates.slice().sort().slice(-1)[0] : today();
      // Agar filter prefix (mis. "2026-07") tetap ketat meski tidak ada data,
      // coba deteksi pola dari dateFilter lewat probe tanggal.
      // (Investor tabs selalu pakai === hari / startsWith bulan / startsWith tahun.)
      const probe = today();
      // Lebih aman: jika branchIds banyak, hitung per cabang lalu jumlahkan —
      // hitungPerformaPeriode single-branch mode membagi biaya global 1/n, multi-branch full.
      if (!branchIds || branchIds.length === 0) {
        return { omzet: 0, modal: 0, pLapak: 0, pOwner: 0, pOwnerCk: 0, laba: 0, txCount: 0 };
      }
      // Pre-filter data dengan dateFilter supaya rentang & isi konsisten dengan UI lama
      const fTxs = (txs || []).filter((t) => branchIds.includes(t.branchId) && dateFilter(t.date));
      const fPL = (pLapakAll || []).filter((p) => branchIds.includes(p.branchId) && dateFilter(p.date));
      // Owner expense: langsung ke cabang investor + global + CK (fungsi pusat yang memilah)
      const fPO = (pOwnerAll || []).filter((p) => dateFilter(p.date));
      const fDistrib = (S.get("distribusiCK") || []).filter((d) => dateFilter(d.date));
      const fStok = (S.get("stokTidakTerjual") || []).filter((s) => branchIds.includes(s.branchId) && dateFilter(s.date));
      if (fTxs.length || fPL.length || fPO.length || fDistrib.length) {
        const ds = [];
        fTxs.forEach((t) => ds.push(t.date));
        fPL.forEach((p) => ds.push(p.date));
        fPO.forEach((p) => ds.push(p.date));
        fDistrib.forEach((d) => ds.push(d.date));
        ds.sort();
        dateFrom = ds[0];
        dateTo = ds[ds.length - 1];
      }
      // Jumlahkan statistik per cabang investor (masing-masing single-branch)
      // supaya porsi biaya global/CK per cabang sama dengan hitungPerformaPeriode.
      let omzet = 0, modal = 0, pLapak = 0, pOwner = 0, pOwnerCk = 0, laba = 0, txCount = 0;
      branchIds.forEach((bId) => {
        const h = hitungPerformaPeriode({
          txs: fTxs, pL: fPL, pO: fPO, distribAll: fDistrib, stokTidakTerjualAll: fStok,
          branches: allBranchesGlobal, investorsAll: investors,
          dateFrom, dateTo, branchId: bId, tipe: "all",
        });
        const b = (h.branchStats || [])[0];
        if (!b) return;
        omzet += b.omzet || 0;
        modal += b.modal || 0;
        pLapak += b.pengLapak || 0;
        pOwner += b.pengOwner || 0;
        pOwnerCk += b.pengGajiCk || 0;
        laba += b.laba || 0;
        txCount += b.txCount || 0;
      });
      return { omzet, modal, pLapak, pOwner, pOwnerCk, laba, txCount };
    };

    const branchIds = branches.map((b) => b.id);

    // Data harian langsung dari transaksi (real-time akumulatif hari dipilih)
    const harian = calcAccum(branchIds, (d) => d === selDate);

    // Data bulanan: akumulasi semua hari dalam bulan
    const bulanan = calcAccum(branchIds, (d) => d && d.startsWith(month));

    // Data tahunan: akumulasi semua hari dalam tahun
    const tahunan = calcAccum(branchIds, (d) => d && d.startsWith(year));

    // Rincian per bulan dalam tahun (untuk tabel tahunan)
    const bulanList = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      const key = `${year}-${m}`;
      const acc = calcAccum(branchIds, (d) => d && d.startsWith(key));
      return { key, label: ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][i], ...acc };
    });

    // Chart 7 hari
    const chart7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const ds = d.toISOString().slice(0, 10);
      const acc = calcAccum(branchIds, (dt) => dt === ds);
      return { label: ds.slice(5), v1: acc.omzet, v2: acc.modal + acc.pLapak + acc.pOwner };
    });

    const inv = invMe;
    const persen = inv?.persenBagi || 0;

    const KpiRow = ({ data, label }) => React.createElement("div", null,
      React.createElement("h4", { className: "sub-title mt8" }, label),
      React.createElement("div", { className: "investor-kpi-grid" },
        React.createElement("div", { className: "inv-kpi kpi-card kpi-omzet" }, React.createElement("div", { className: "kpi-label" }, "Penjualan"), React.createElement("div", { className: "kpi-val-sm", style: { color: "var(--green)" } }, fmtRp(data.omzet))),
        React.createElement("div", { className: "inv-kpi kpi-card kpi-modal" }, React.createElement("div", { className: "kpi-label" }, "HPP"), React.createElement("div", { className: "kpi-val-sm", style: { color: "var(--red)" } }, fmtRp(data.modal))),
        React.createElement("div", { className: "inv-kpi kpi-card kpi-peng" }, React.createElement("div", { className: "kpi-label" }, "Peng. Lapak"), React.createElement("div", { className: "kpi-val-sm", style: { color: "var(--red)" } }, fmtRp(data.pLapak))),
        React.createElement("div", { className: "inv-kpi kpi-card kpi-peng" }, React.createElement("div", { className: "kpi-label" }, "Peng. Pusat"), React.createElement("div", { className: "kpi-val-sm", style: { color: "var(--red)" } }, fmtRp(data.pOwner))),
        React.createElement("div", { className: "inv-kpi kpi-card kpi-profit" }, React.createElement("div", { className: "kpi-label" }, "Laba"), React.createElement("div", { className: "kpi-val-sm", style: { color: data.laba >= 0 ? "var(--green)" : "var(--red)" } }, fmtRp(data.laba))),
        React.createElement("div", { className: "inv-kpi kpi-card", style: { gridColumn: "1/-1", borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 10%, var(--bg2))" } },
          React.createElement("div", { className: "kpi-label" }, "Est. Bagian Anda (", persen, "%)"),
          React.createElement("div", { className: "kpi-val-sm", style: { color: "var(--accent)", fontSize: 18 } }, fmtRp(data.laba * persen / 100))
        )
      )
    );

    return React.createElement("div", { className: "page" },
      React.createElement("div", { className: "page-header" },
        React.createElement("img", { className: "page-icon", src: getBrandLogo(), style: { width: 45, height: 45, objectFit: "cover", borderRadius: 10 } }),
        React.createElement("div", null,
          React.createElement("h2", null, "Portal Investor"),
          React.createElement("p", { className: "page-sub" }, inv?.nama ? `Akun: ${inv.nama} (${persen}%)` : "Cabang Investasi")
        )
      ),
      // Filter cabang
      React.createElement("div", { className: "filter-bar mb8" },
        React.createElement("button", { className: "chip" + (!selBranch ? " chip-active" : ""), onClick: () => setSelBranch("") }, "Semua cabang"),
        allInvBranches.map((b) => React.createElement("button", { key: b.id, className: "chip" + (selBranch === b.id ? " chip-active" : ""), onClick: () => setSelBranch(b.id) }, b.name))
      ),
      // Tabs
      React.createElement("div", { className: "tabs" },
        React.createElement("button", { className: "tab" + (tab === "harian" ? " active" : ""), onClick: () => setTab("harian") }, "Harian"),
        React.createElement("button", { className: "tab" + (tab === "bulanan" ? " active" : ""), onClick: () => setTab("bulanan") }, "Bulanan"),
        React.createElement("button", { className: "tab" + (tab === "tahunan" ? " active" : ""), onClick: () => setTab("tahunan") }, "Tahunan")
      ),

      // ── Tab Harian ──
      tab === "harian" && React.createElement("div", null,
        React.createElement("div", { className: "field-group mt8" },
          React.createElement("label", null, "Pilih Tanggal"),
          React.createElement("input", { type: "date", className: "inp inp-sm", value: selDate, onChange: (e) => setSelDate(e.target.value) })
        ),
        React.createElement(KpiRow, { data: harian, label: "Laporan Harian - " + selDate }),
        // Rincian pengeluaran lapak
        branches.map((b) => {
          const dayTxs = txs.filter((t) => t.branchId === b.id && t.date === selDate);
          const pLapakRinci = pLapakAll.filter((p) => p.branchId === b.id && p.date === selDate);
          const pODirect = pOwnerAll.filter((p) => p.branchId === b.id && p.date === selDate);
          const pOGlobal = pOwnerAll.filter((p) => !p.branchId && p.date === selDate);
          if (dayTxs.length === 0 && pLapakRinci.length === 0) return null;
          return React.createElement("div", { key: b.id, className: "investor-report-card mt8" },
            React.createElement("div", { className: "investor-report-header" },
              React.createElement("h3", null, b.name),
              React.createElement("span", { className: "badge-type investasi" }, dayTxs.length + "x transaksi")
            ),
            // Transaksi accordion
            dayTxs.map((tx) =>
              React.createElement("div", { key: tx.id, className: "accordion-card" },
                React.createElement("div", { className: "accordion-header", onClick: () => toggleTx(tx.id) },
                  React.createElement("div", { className: "accordion-title" },
                    React.createElement("span", { className: "tx-id" }, "STRUK-", tx.id.slice(0, 6).toUpperCase()),
                    React.createElement("span", { className: "accordion-omzet" }, fmtTxTs(tx), " — ", fmtRp(tx.total))
                  ),
                  React.createElement("span", { className: "accordion-arrow" }, openTx[tx.id] ? "▲" : "▼")
                ),
                openTx[tx.id] && React.createElement("div", { className: "accordion-body" },
                  tx.items.map((it, i) => React.createElement("div", { key: i, className: "tx-item" }, it.nama, " x", it.qty, " = ", fmtRp(it.hargaJual * it.qty))),
                  React.createElement("div", { className: "tx-total" }, "Total: ", fmtRp(tx.total))
                )
              )
            ),
            // Pengeluaran lapak
            pLapakRinci.length > 0 && React.createElement("div", { className: "mt4" },
              React.createElement("h4", { className: "sub-title" }, "Pengeluaran Lapak"),
              pLapakRinci.map((p) => React.createElement("div", { key: p.id, className: "peng-row" },
                React.createElement("div", { className: "peng-info" }, React.createElement("span", { className: "peng-ket" }, p.keterangan), React.createElement("span", { className: "peng-ts" }, p.ts)),
                React.createElement("div", { className: "peng-right" }, React.createElement("span", { className: "peng-jml" }, fmtRp(p.jumlah)))
              ))
            ),
            // Pengeluaran owner
            (pODirect.length > 0 || pOGlobal.length > 0) && React.createElement("div", { className: "mt4" },
              React.createElement("h4", { className: "sub-title" }, "Pengeluaran Operasional"),
              pODirect.map((p) => React.createElement("div", { key: p.id, className: "peng-row" },
                React.createElement("div", { className: "peng-info" }, React.createElement("span", { className: "peng-ket" }, p.keterangan, " (Langsung)")),
                React.createElement("div", { className: "peng-right" }, React.createElement("span", { className: "peng-jml" }, fmtRp(p.jumlah)))
              )),
              pOGlobal.map((p) => React.createElement("div", { key: p.id, className: "peng-row" },
                React.createElement("div", { className: "peng-info" }, React.createElement("span", { className: "peng-ket" }, p.keterangan, " (Global÷", nBranchTotal, ")")),
                React.createElement("div", { className: "peng-right" }, React.createElement("span", { className: "peng-jml" }, fmtRp(p.jumlah / nBranchTotal)))
              ))
            )
          );
        }),
        React.createElement("div", { className: "chart-box mt12" },
          React.createElement("h3", { className: "section-title" }, "Omzet 7 Hari Terakhir"),
          React.createElement(BarChart, { data: chart7, height: 90 }),
          React.createElement("div", { className: "chart-legend mt4" },
            React.createElement("span", { className: "leg-dot leg-a" }), React.createElement("span", null, "Penjualan"),
            React.createElement("span", { className: "leg-dot leg-b", style: { marginLeft: 12 } }), React.createElement("span", null, "HPP+Peng")
          )
        )
      ),

      // ── Tab Bulanan ──
      tab === "bulanan" && React.createElement("div", null,
        React.createElement("div", { className: "field-group mt8" },
          React.createElement("label", null, "Pilih Bulan"),
          React.createElement("input", { type: "month", className: "inp inp-sm", value: month, onChange: (e) => setMonth(e.target.value) })
        ),
        React.createElement(KpiRow, { data: bulanan, label: "Akumulasi Bulanan - " + month }),
        React.createElement("p", { className: "info-txt mt4" }, "Data dihitung langsung dari semua transaksi harian dalam bulan ini (real-time)."),
        // Laporan resmi dari owner (jika sudah dikirim)
        branches.map((b) => {
          const laporan = setoranBulAll.find((s) => s.branchId === b.id && s.bulan === month);
          if (!laporan) return React.createElement("div", { key: b.id, className: "investor-report-card mt8" },
            React.createElement("div", { className: "investor-report-header" }, React.createElement("h3", null, b.name), React.createElement("span", { className: "badge-type investasi" }, "Investasi")),
            React.createElement("p", { className: "info-txt" }, "Laporan resmi bulan ini belum dikirim Owner. Data di atas adalah estimasi real-time.")
          );
          return React.createElement("div", { key: b.id, className: "investor-report-card mt8" },
            React.createElement("div", { className: "investor-report-header" }, React.createElement("h3", null, b.name), React.createElement("span", { className: "badge-type investasi" }, "Investasi")),
            React.createElement("h4", { className: "sub-title" }, "Laporan Resmi dari Owner"),
            React.createElement("div", { className: "investor-kpi-grid" },
              React.createElement("div", { className: "inv-kpi kpi-card kpi-omzet" }, React.createElement("div", { className: "kpi-label" }, "Penjualan"), React.createElement("div", { className: "kpi-val-sm", style: { color: "var(--green)" } }, fmtRp(laporan.omzet))),
              React.createElement("div", { className: "inv-kpi kpi-card kpi-modal" }, React.createElement("div", { className: "kpi-label" }, "HPP"), React.createElement("div", { className: "kpi-val-sm", style: { color: "var(--red)" } }, fmtRp(laporan.modal))),
              React.createElement("div", { className: "inv-kpi kpi-card kpi-peng" }, React.createElement("div", { className: "kpi-label" }, "Peng. Lapak"), React.createElement("div", { className: "kpi-val-sm", style: { color: "var(--red)" } }, fmtRp(laporan.pLapak || 0))),
              React.createElement("div", { className: "inv-kpi kpi-card kpi-peng" }, React.createElement("div", { className: "kpi-label" }, "Peng. Pusat"), React.createElement("div", { className: "kpi-val-sm", style: { color: "var(--red)" } }, fmtRp(laporan.pOwner || 0))),
              React.createElement("div", { className: "inv-kpi kpi-card kpi-profit" }, React.createElement("div", { className: "kpi-label" }, "Laba Bersih"), React.createElement("div", { className: "kpi-val-sm", style: { color: laporan.laba >= 0 ? "var(--green)" : "var(--red)" } }, fmtRp(laporan.laba))),
              React.createElement("div", { className: "inv-kpi kpi-card", style: { gridColumn: "1/-1", borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 10%, var(--bg2))" } },
                React.createElement("div", { className: "kpi-label" }, "Bagian Anda (", laporan.persen, "%)"),
                React.createElement("div", { className: "kpi-val-sm", style: { color: "var(--accent)", fontSize: 18 } }, fmtRp(laporan.bagianInvestor))
              )
            ),
            React.createElement("div", { className: "setoran-status setoran-" + laporan.status, style: { marginTop: 10 } },
              laporan.status === "menunggu" && React.createElement(React.Fragment, null,
                React.createElement("span", null, "Menunggu konfirmasi Anda"),
                React.createElement("button", { className: "btn-primary btn-sm", onClick: () => konfirmBulananInvestor(laporan.id) }, "Konfirmasi")
              ),
              laporan.status === "selesai" && React.createElement("span", null, "✓ Dikonfirmasi - ", laporan.konfirmasiTs)
            )
          );
        })
      ),

      // ── Tab Tahunan ──
      tab === "tahunan" && React.createElement("div", null,
        React.createElement("div", { className: "field-group mt8" },
          React.createElement("label", null, "Pilih Tahun"),
          React.createElement("input", { type: "number", className: "inp inp-sm", style: { width: 100 }, value: year, min: "2020", max: "2099", onChange: (e) => setYear(e.target.value) })
        ),
        React.createElement(KpiRow, { data: tahunan, label: "Akumulasi Tahunan - " + year }),
        React.createElement("p", { className: "info-txt mt4" }, "Dihitung dari akumulasi semua transaksi sepanjang tahun ", year, " (real-time)."),
        // Tabel per bulan
        React.createElement("h3", { className: "section-title mt12" }, "Rincian Per Bulan"),
        React.createElement("div", { className: "tbl-wrap mt8" },
          React.createElement("table", { className: "tbl" },
            React.createElement("thead", null,
              React.createElement("tr", null,
                React.createElement("th", null, "Bulan"),
                React.createElement("th", null, "Penjualan"),
                React.createElement("th", null, "Laba"),
                React.createElement("th", null, "Bagian Anda")
              )
            ),
            React.createElement("tbody", null,
              bulanList.map((m) =>
                React.createElement("tr", { key: m.key, style: m.omzet > 0 ? { fontWeight: 600 } : { opacity: 0.4 } },
                  React.createElement("td", null, m.label, " ", year),
                  React.createElement("td", { style: { color: "var(--kpi-omzet, #f4a227)" } }, fmtRp(m.omzet)),
                  React.createElement("td", { style: { color: m.laba >= 0 ? "var(--green)" : "var(--red)" } }, fmtRp(m.laba)),
                  React.createElement("td", { style: { color: "var(--accent)" } }, fmtRp(m.laba * persen / 100))
                )
              ),
              // Baris total
              React.createElement("tr", { style: { borderTop: "2px solid var(--border)", fontWeight: 700 } },
                React.createElement("td", null, "TOTAL"),
                React.createElement("td", { style: { color: "var(--kpi-omzet, #f4a227)" } }, fmtRp(tahunan.omzet)),
                React.createElement("td", { style: { color: tahunan.laba >= 0 ? "var(--green)" : "var(--red)" } }, fmtRp(tahunan.laba)),
                React.createElement("td", { style: { color: "var(--accent)" } }, fmtRp(tahunan.laba * persen / 100))
              )
            )
          )
        )
      )
    );
  }

  // ─── DistribusiPage — Halaman Kurir/Distribusi ───────────────────────────
  // Pagi: lihat & konfirmasi antar donat ke lapak. Sore: catat uang lapak dibawa.
  // Lalu setor uang ke owner.
  function DistribusiPage({ pushNotif, me }) {
    const tick = useStoreTick();
    const [subtab, setSubtab] = useState("antar"); // antar | ambil | setor
    const [busy, setBusy] = useState(false);
    const [confirmAskKurir, confirmModalKurir] = useConfirm();
    const namaSaya = me?.display_name || me?.displayName || me?.email || "Kurir";
    const tgl = today();
    const branches = (S.get("branches") || []).filter((b) => b.type !== "central_kitchen");

    // ── Antar (pagi): distribusi hari ini. Status per baris: pending → perjalanan → diterima ──
    const distribHariIni = (S.get("distribusiCK") || []).filter((d) => d.date === tgl && d.status !== "dibatalkan");
    const perCabangAntar = branches.map((b) => {
      const rows = distribHariIni.filter((d) => d.branchId === b.id);
      const totalPcs = rows.reduce((a, d) => a + (d.jumlahKirim || 0), 0);
      const semuaDiterima = rows.length > 0 && rows.every((d) => d.status === "diterima");
      const semuaPerjalanan = rows.length > 0 && rows.every((d) => d.status === "perjalanan" || d.status === "diterima");
      const belumAmbil = rows.some((d) => d.status === "pending");
      // tahap: menunggu-diambil | perjalanan | diterima
      const tahap = semuaDiterima ? "diterima" : (semuaPerjalanan ? "perjalanan" : "pending");
      return { branch: b, rows, totalPcs, semuaDiterima, tahap, belumAmbil };
    }).filter((x) => x.rows.length > 0);

    // Kurir tekan: ambil dari CK (semua baris cabang → perjalanan)
    const ambilDariCK = async (x) => {
      setBusy(true);
      try {
        const ids = new Set(x.rows.filter((d) => d.status === "pending").map((d) => d.id));
        if (ids.size === 0) { setBusy(false); return; }
        for (const id of ids) {
          await sb.from("distribusiCK").update({ status: "perjalanan", kurirAmbilTs: nowIso(), kurirNama: namaSaya }).eq("id", id);
        }
        await S.loadKey("distribusiCK");
        pushNotif("Donat untuk " + x.branch.name + " diambil. Status: dalam perjalanan.", "success");
      } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
    };
    // Kurir tekan: sudah sampai lapak (opsional penanda; lapak yang konfirmasi terima → stok masuk)
    const sampaiLapak = async (x) => {
      setBusy(true);
      try {
        const ids = new Set(x.rows.filter((d) => d.status === "perjalanan").map((d) => d.id));
        for (const id of ids) {
          await sb.from("distribusiCK").update({ status: "perjalanan", kurirSampaiTs: nowIso() }).eq("id", id);
        }
        await S.loadKey("distribusiCK");
        pushNotif("Ditandai sudah sampai " + x.branch.name + ". Minta pekerja lapak konfirmasi terima.", "success");
      } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
    };

    // ── Ambil uang (sore) ──
    const [uangForm, setUangForm] = useState({});
    const setUang = (bid, v) => setUangForm((s) => ({ ...s, [bid]: v }));
    const kurirHariIni = getKurirList().filter((k) => k.tanggal === tgl);
    const sudahAmbil = (bid) => kurirHariIni.find((k) => k.branchId === bid);

    // Deteksi lapak yang SUDAH TUTUP hari ini (ada absensi checkout) → notif "siap diambil"
    const absensiHariIni = (S.get("absensi") || []).filter((a) => a.date === tgl && a.checkout_ts);
    const lapakSudahTutup = branches.filter((b) => absensiHariIni.some((a) => a.branchId === b.id));
    const lapakSiapDiambil = lapakSudahTutup.filter((b) => !sudahAmbil(b.id));

    const simpanAmbilUang = async (b) => {
      const v = parseFloat(uangForm[b.id]);
      if (!Number.isFinite(v) || v < 0) { pushNotif("Isi jumlah uang yang benar.", "warning"); return; }
      setBusy(true);
      try {
        const _ku = { id: uid(), tanggal: tgl, branchId: b.id, branchNama: b.name, kurir: namaSaya, uangDibawa: v, statusUang: "dibawa", disetorOwner: false, ts: nowIso() }; await mutateLedger(loadKurirFromDb, (list) => [...list, _ku], saveKurirToDb);
        setUang(b.id, "");
        pushNotif("Uang dari " + b.name + " diterima kurir (" + fmtRp(v) + ").", "success");
      } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
    };

    // Koreksi/hapus catatan uang kurir yang BELUM diserahkan ke owner (statusUang "dibawa")
    const koreksiUang = (rec) => {
      const v = prompt("Perbaiki jumlah uang dari " + rec.branchNama + " (Rp):", String(rec.uangDibawa));
      if (v === null) return;
      const num = parseFloat(v);
      if (!Number.isFinite(num) || num < 0) { pushNotif("Jumlah tidak valid.", "warning"); return; }
      setBusy(true);
      mutateLedger(loadKurirFromDb, (list) => list.map((k) => k.id === rec.id ? { ...k, uangDibawa: num } : k), saveKurirToDb)
        .then(() => pushNotif("Jumlah uang diperbaiki jadi " + fmtRp(num) + ".", "success"))
        .catch((e) => pushNotif("Gagal: " + (e?.message || e), "warning"))
        .finally(() => setBusy(false));
    };
    const hapusUang = (rec) => {
      confirmAskKurir({ title: "Hapus Catatan Uang", danger: true, confirmLabel: "Hapus",
        message: "Hapus catatan uang " + fmtRp(rec.uangDibawa) + " dari " + rec.branchNama + "? (kalau salah catat)",
        onConfirm: async () => {
          setBusy(true);
          try { await mutateLedger(loadKurirFromDb, (list) => list.filter((k) => k.id !== rec.id), saveKurirToDb); pushNotif("Catatan dihapus.", "success"); }
          catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
        }
      });
    };

    // ── Setor ke owner: kirim (status → perjalanan). Owner yang konfirmasi jadi selesai. ──
    const dibawa = getKurirList().filter((k) => k.statusUang === "dibawa");
    const perjalanan = getKurirList().filter((k) => k.statusUang === "perjalanan");
    const totalDibawa = dibawa.reduce((a, k) => a + k.uangDibawa, 0);
    const totalPerjalanan = perjalanan.reduce((a, k) => a + k.uangDibawa, 0);
    const kirimKeOwner = async () => {
      if (dibawa.length === 0) { pushNotif("Tidak ada uang untuk dikirim.", "warning"); return; }
      setBusy(true);
      try {
        const ids = new Set(dibawa.map((k) => k.id));
        await mutateLedger(loadKurirFromDb, (list) => list.map((k) => ids.has(k.id) ? { ...k, statusUang: "perjalanan" } : k), saveKurirToDb);
        pushNotif("Uang dalam perjalanan ke owner: " + fmtRp(totalDibawa) + ". Tunggu owner konfirmasi.", "success");
      } catch (e) { pushNotif("Gagal: " + (e?.message || e), "warning"); } finally { setBusy(false); }
    };

     return React.createElement("div", { className: "page" },
      confirmModalKurir,
      React.createElement("div", { className: "page-header" },
        React.createElement("img", { className: "page-icon", src: getBrandLogo(), style: { width: 45, height: 45, objectFit: "cover", borderRadius: 10 } }),
        React.createElement("div", null,
          React.createElement("h2", null, "Halaman Kurir"),
          React.createElement("p", { className: "page-sub" }, namaSaya, " \u00B7 ", formatTanggalIndo ? formatTanggalIndo(tgl) : tgl)
        )
      ),
      React.createElement("div", { className: "tabs mb8" },
        React.createElement("button", { className: "tab" + (subtab === "antar" ? " active" : ""), onClick: () => setSubtab("antar") }, "\uD83C\uDF05 Antar (pagi)"),
        React.createElement("button", { className: "tab" + (subtab === "ambil" ? " active" : ""), onClick: () => setSubtab("ambil") }, "\uD83C\uDF06 Ambil uang (sore)"),
        React.createElement("button", { className: "tab" + (subtab === "setor" ? " active" : ""), onClick: () => setSubtab("setor") }, "\uD83D\uDCB0 Setor owner" + (belumSetor.length ? " (" + belumSetor.length + ")" : ""))
      ),

      // ── ANTAR ──
      subtab === "antar" && React.createElement("div", { className: "card" },
        React.createElement("h3", null, "Antar donat ke lapak hari ini"),
        React.createElement("p", { className: "info-txt" }, "Daftar kiriman dari dapur. Konfirmasi diterima dilakukan oleh pekerja lapak saat barang sampai."),
        perCabangAntar.length === 0
          ? React.createElement("p", { className: "info-txt mt8" }, "Belum ada kiriman terjadwal hari ini.")
          : perCabangAntar.map((x) => React.createElement("div", { key: x.branch.id, className: "form-card mt8" },
              React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 } },
                React.createElement("div", null,
                  React.createElement("strong", null, x.branch.name),
                  React.createElement("div", { style: { fontSize: 12, color: "var(--text2)" } }, x.totalPcs, " pcs \u00B7 ", x.rows.length, " jenis")
                ),
                x.tahap === "diterima"
                  ? React.createElement("span", { className: "pill-badge", style: { color: "var(--green)", borderColor: "var(--green)" } }, "\u2713 Diterima lapak")
                  : x.tahap === "perjalanan"
                    ? React.createElement("span", { className: "pill-badge", style: { color: "var(--blue)", borderColor: "var(--blue)" } }, "\uD83D\uDEF5 Dalam perjalanan")
                    : React.createElement("span", { className: "pill-badge", style: { color: "var(--yellow)", borderColor: "var(--yellow)" } }, "\uD83D\uDCE6 Siap diambil")
              ),
              React.createElement("div", { style: { marginTop: 6, fontSize: 12.5 } },
                x.rows.map((d) => React.createElement("div", { key: d.id, style: { display: "flex", justifyContent: "space-between", padding: "2px 0" } },
                  React.createElement("span", null, d.menuNama || d.menuId),
                  React.createElement("span", { style: { color: "var(--text2)" } }, d.jumlahKirim, " pcs")
                ))
              ),
              // Tombol aksi kurir sesuai tahap
              x.tahap === "pending" && React.createElement("button", { className: "btn-primary btn-sm mt8", disabled: busy, onClick: () => ambilDariCK(x) }, "\uD83D\uDEF5 Ambil dari dapur (mulai antar)"),
              x.tahap === "perjalanan" && React.createElement("div", { className: "info-txt mt8", style: { fontSize: 11.5 } }, "Sudah dibawa. Saat sampai, minta pekerja lapak konfirmasi terima di HP mereka \u2014 stok otomatis masuk kasir.")
            ))
      ),

      // ── AMBIL UANG ──
      subtab === "ambil" && React.createElement("div", { className: "card" },
        React.createElement("h3", null, "Ambil uang harian lapak"),
        React.createElement("p", { className: "info-txt" }, "Lapak yang sudah tutup akan muncul di sini otomatis \u2014 tanda siap diambil uangnya."),
        lapakSiapDiambil.length > 0 && React.createElement("div", { className: "alert-banner alert-banner-warn", style: { marginTop: 8 } },
          React.createElement("div", { className: "alert-banner-title" }, "\uD83D\uDD14 Siap diambil"),
          React.createElement("div", { className: "alert-banner-item" }, lapakSiapDiambil.map((b) => b.name).join(", "), " sudah tutup toko.")
        ),
        branches.map((b) => {
          const done = sudahAmbil(b.id);
          const tutup = lapakSudahTutup.some((x) => x.id === b.id);
          return React.createElement("div", { key: b.id, className: "form-card mt8" },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" } },
              React.createElement("div", null,
                React.createElement("strong", null, b.name),
                React.createElement("div", { style: { fontSize: 11, color: "var(--text2)" } }, tutup ? "\u2713 sudah tutup toko" : "\u23F3 belum tutup")
              ),
              done && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
                React.createElement("span", { className: "pill-badge", style: { color: "var(--green)", borderColor: "var(--green)" } }, "\u2713 " + fmtRp(done.uangDibawa)),
                done.statusUang === "dibawa" && React.createElement("button", { className: "btn-secondary btn-sm", disabled: busy, onClick: () => koreksiUang(done), "aria-label": "Koreksi" }, "\u270F\uFE0F"),
                done.statusUang === "dibawa" && React.createElement("button", { className: "btn-danger-sm", disabled: busy, onClick: () => hapusUang(done), "aria-label": "Hapus" }, "X"),
                done.statusUang !== "dibawa" && React.createElement("span", { style: { fontSize: 10.5, color: "var(--text2)" } }, done.statusUang === "perjalanan" ? "menuju owner" : "selesai")
              )
            ),
            !done && tutup && React.createElement("div", { className: "row-wrap mt8", style: { alignItems: "center", gap: 8 } },
              React.createElement("input", { className: "inp inp-sm", type: "number", inputMode: "numeric", style: { flex: 1, minWidth: 120 }, value: uangForm[b.id] == null ? "" : uangForm[b.id], onChange: (e) => setUang(b.id, e.target.value), placeholder: "Uang dibawa (Rp)" }),
              React.createElement("button", { className: "btn-primary btn-sm", disabled: busy, onClick: () => simpanAmbilUang(b) }, "Terima")
            ),
            !done && !tutup && React.createElement("p", { className: "info-txt mt8", style: { fontSize: 11 } }, "Tunggu lapak tutup toko dulu.")
          );
        })
      ),

      // ── SETOR ──
      subtab === "setor" && React.createElement("div", { className: "card" },
        React.createElement("h3", null, "Setor uang ke owner"),
        React.createElement("div", { className: "kpi-grid mt8" },
          React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Di tangan kurir"), React.createElement("div", { className: "kpi-val", style: { color: totalDibawa > 0 ? "var(--accent)" : "var(--text)" } }, fmtRp(totalDibawa))),
          React.createElement("div", { className: "kpi-card" }, React.createElement("div", { className: "kpi-label" }, "Perjalanan ke owner"), React.createElement("div", { className: "kpi-val", style: { color: totalPerjalanan > 0 ? "var(--blue)" : "var(--text)" } }, fmtRp(totalPerjalanan)))
        ),
        dibawa.length > 0 && React.createElement("div", { className: "mt8" },
          React.createElement("h4", { className: "sub-title" }, "Uang di tangan kurir"),
          dibawa.map((k) => React.createElement("div", { key: k.id, style: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 } },
            React.createElement("span", null, k.branchNama, " \u00B7 ", k.tanggal),
            React.createElement("strong", null, fmtRp(k.uangDibawa))
          ))
        ),
        React.createElement("button", { className: "btn-primary mt8", disabled: busy || totalDibawa <= 0, onClick: kirimKeOwner }, busy ? "..." : "\uD83D\uDEF5 Antar ke Owner (" + fmtRp(totalDibawa) + ")"),
        perjalanan.length > 0 && React.createElement("div", { className: "mt8", style: { borderTop: "1px dashed var(--border)", paddingTop: 10 } },
          React.createElement("h4", { className: "sub-title", style: { color: "var(--blue)" } }, "\uD83D\uDEF5 Sedang menuju owner (tunggu konfirmasi)"),
          perjalanan.map((k) => React.createElement("div", { key: k.id, style: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 } },
            React.createElement("span", null, k.branchNama, " \u00B7 ", k.tanggal),
            React.createElement("span", { style: { color: "var(--blue)" } }, fmtRp(k.uangDibawa), " \u23F3")
          ))
        )
      )
    );
  }

  // ─── KitchenPage — Halaman Pekerja Central Kitchen ────────────────────────
  function KitchenPage({ pushNotif, me, historyMode }) {
    const tick = useStoreTick();
    const [tab, setTab] = useState("produksi");
    const [date, setDate] = useState(today());
    const [form, setForm] = useState({ menuId: "", jumlah: "", keterangan: "" });
    const [busy, setBusy] = useState(false);
    const [absMonth, setAbsMonth] = useState(today().slice(0, 7));

    const branches = S.get("branches") || [];
    const menus = S.get("menuVarian") || [];
    const ckBranch = branches.find((b) => b.type === "central_kitchen");
    const branchId = ckBranch?.id || me?.branchId || "";
    const branchName = ckBranch?.name || "Dapur pusat (CK)";
    const userId = me?.user_id;
    const historyModeActive = isHistoryModeAllowedForBranch(historyMode, branchId);
    const canChangeDate = historyModeActive;
    const safeDate = canChangeDate ? date : today();

    const produksiList = (S.get("produksiCK") || [])
      .filter((p) => p.date === safeDate)
      .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));

    const totalPcs = produksiList.reduce((a, p) => a + (p.jumlah || 0), 0);

    useEffect(() => {
      if (!canChangeDate) {
        const td = today();
        if (date !== td) setDate(td);
      }
    }, [canChangeDate, date]);

    const simpan = async () => {
      if (!form.menuId) { pushNotif("Pilih menu dulu.", "warning"); return; }
      const jml = parseInt(form.jumlah);
      if (!jml || jml <= 0) { pushNotif("Jumlah harus lebih dari 0.", "warning"); return; }
      setBusy(true);
      try {
        const menu = menus.find((m) => m.id === form.menuId);
        const hppPerPcsProduksi = roundHppRp(getMenuHPPBreakdown(menu)?.hppSatuanPerPcs || 0);
        const cekStok = cekStokBahanCukupUntukProduksi(menu, jml);
        // Validasi final dilakukan oleh submit_production_atomic di database.
        // Cache lama hanya dipakai untuk membangun daftar bahan yang diperlukan.
        const entry = {
          id: uid(),
          date: safeDate,
          ts: tsForDate(safeDate),
          branchId,
          branchName,
          menuId: form.menuId,
          menuNama: menu?.nama || form.menuId,
          jumlah: jml,
          hppPerPcs: hppPerPcsProduksi,
          hppTotalProduksi: hppPerPcsProduksi * jml,
          keterangan: form.keterangan.trim(),
          createdBy: me?.user_id || null,
        };
        const materials = {};
        (cekStok.pakai || []).forEach((p) => {
          const bahan = (S.get("bahanPokok") || []).find((x) => x.id === p.bahanId);
          materials[p.bahanId] = { quantity: Number(p.qty) || 0, unit_cost: getBahanHppPerPcs(bahan) };
        });
        const areaId = me?.areaId || branches.find((b) => b.id === branchId)?.areaId || null;
        const { error: productionError } = await sb.rpc("submit_production_atomic", {
          p_id: entry.id,
          p_area_id: areaId,
          p_branch_id: branchId,
          p_date: safeDate,
          p_ts: entry.ts,
          p_menu_id: entry.menuId,
          p_menu_nama: entry.menuNama,
          p_quantity: jml,
          p_materials: materials,
          p_hpp_total: entry.hppTotalProduksi
        });
        if (productionError) throw productionError;
        await S.loadKey("produksiCK");
        setForm((f) => ({ ...f, jumlah: "", keterangan: "" }));
        pushNotif("Produksi tercatat!", "success");
      } finally {
        setBusy(false);
      }
    };

    const hapus = async (id) => {
      try { await batalkanPemakaianProduksi(id); } catch (e) { pushNotif("Gagal membatalkan pemakaian bahan: " + (e?.message || e), "warning"); }
      S.set("produksiCK", (S.get("produksiCK") || []).filter((x) => x.id !== id));
      pushNotif("Dihapus.", "warning");
    };

    // Absensi logic (sama seperti WorkerPage)
    const selectedAbs = useMemo(() => {
      const all = S.get("absensi") || [];
      return all.find((a) => a.user_id === userId && a.date === safeDate) || null;
    }, [tick, userId, safeDate]);

    const sudahCheckout = !!selectedAbs?.checkout_ts;

    const doCheckin = async () => {
      if (!userId) return;
      const targetDate = safeDate;
      const jadwalLibur = S.get("jadwalLibur") || {};
      const namaHari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][new Date(`${targetDate}T00:00:00`).getDay()];
      if (jadwalLibur[userId] && jadwalLibur[userId] === namaHari) {
        pushNotif(`Hari ${namaHari} adalah jadwal libur Anda.`, "warning"); return;
      }
      const all = S.get("absensi") || [];
      const ex = all.find((a) => a.user_id === userId && a.date === targetDate);
      if (ex?.checkin_ts) { pushNotif("Check-in sudah ada.", "warning"); return; }
      const row = ex
        ? { ...ex, checkin_ts: isoForDate(targetDate), branchId }
        : { id: uid(), user_id: userId, branchId, date: targetDate, checkin_ts: isoForDate(targetDate), checkout_ts: null };
      S.set("absensi", ex ? all.map((a) => a.id === row.id ? row : a) : [...all, row]);

      // Check-in hanya membentuk kehadiran/gaji terutang; pembayaran payroll dilakukan terpisah.
      pushNotif("Check-in berhasil!", "success");
    };

    const doCheckout = () => {
      if (!userId) return;
      const targetDate = safeDate;
      const all = S.get("absensi") || [];
      const ex = all.find((a) => a.user_id === userId && a.date === targetDate);
      if (!ex?.checkin_ts) { pushNotif("Belum check-in hari ini.", "warning"); return; }
      if (ex?.checkout_ts) { pushNotif("Sudah check-out.", "warning"); return; }
      S.set("absensi", all.map((a) => a.id === ex.id ? { ...a, checkout_ts: isoForDate(targetDate) } : a));
      pushNotif("Check-out berhasil!", "success");
    };

    const myMonthRows = useMemo(() => {
      const all = S.get("absensi") || [];
      return all.filter((a) => a.user_id === userId && String(a.date || "").startsWith(absMonth))
                .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }, [tick, userId, absMonth]);

    const calcMonth = useMemo(() => {
      let hadir = 0, menit = 0;
      for (const r of myMonthRows) {
        if (r.checkin_ts) hadir++;
        if (r.checkin_ts && r.checkout_ts) {
          const a = Date.parse(r.checkin_ts), b = Date.parse(r.checkout_ts);
          if (!isNaN(a) && !isNaN(b) && b > a) menit += Math.floor((b - a) / 60000);
        }
      }
      return { hadir, menit };
    }, [myMonthRows]);

    // Hadir minggu ini (Senin-Minggu pekan berjalan) & bulan ini (real-time), terpisah dari filter absMonth
    const myWeekHadir = useMemo(() => {
      const all = S.get("absensi") || [];
      const week = getWeekRange(today());
      return hitungHadirRange(all, userId, week.start, week.end);
    }, [tick, userId]);
    const myMonthHadirNow = useMemo(() => {
      const all = S.get("absensi") || [];
      const m = today().slice(0, 7);
      return all.filter((a) => a.user_id === userId && String(a.date || "").startsWith(m) && a.checkin_ts).length;
    }, [tick, userId]);

    // Estimasi gaji dari histori per hari hadir
    const gajiHarian = getGajiHarianPadaTanggal(userId || me?.user_id, today(), me?.gajiHarian);
    const estGaji = hitungGajiDariAbsensi(userId || me?.user_id, S.get("absensi") || [], today().slice(0, 7), me?.gajiHarian).total;

    return React.createElement("div", { className: "page" },
      React.createElement("div", { className: "page-header" },
        React.createElement("div", { className: "page-icon" }, "\uD83C\uDF73"),
        React.createElement("div", null,
          React.createElement("h2", null, "Dapur pusat (CK)"),
          React.createElement("p", { className: "page-sub" }, branchName, " \u2014 Catat Produksi Harian")
        )
      ),
      // Tabs
      React.createElement("div", { className: "tabs" },
        React.createElement("button", { className: "tab" + (tab === "produksi" ? " active" : ""), onClick: () => setTab("produksi") }, "Produksi"),
        React.createElement("button", { className: "tab" + (tab === "absensi" ? " active" : ""), onClick: () => setTab("absensi") }, "Absensi"),
        React.createElement("button", { className: "tab" + (tab === "gaji" ? " active" : ""), onClick: () => setTab("gaji") }, "Gaji")
      ),

      // ── Tab Produksi ──
      tab === "produksi" && React.createElement("div", null,
      // Filter tanggal
      React.createElement("div", { className: "filter-bar mb8" },
        canChangeDate
          ? React.createElement(DateField, { value: date, onChange: (e) => setDate(e.target.value) })
          : React.createElement("div", { className: "date-locked-badge" }, "\uD83D\uDCC5 ", formatTanggalIndoPendek(safeDate))
      ),
      React.createElement("p", { className: "info-txt mb8" },
        historyModeActive
          ? "Mode histori aktif untuk Central Kitchen. Pekerja CK bisa pilih tanggal lain bila owner membukanya."
          : "Tanggal produksi dan absensi CK dikunci ke hari ini. Owner bisa membuka mode histori khusus CK bila diperlukan."
      ),

      // Form input produksi
      React.createElement("div", { className: "form-card" },
        React.createElement("h4", null, "\u2795 Catat Produksi"),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Produk"),
          React.createElement("select", { className: "inp", value: form.menuId, onChange: (e) => setForm((f) => ({ ...f, menuId: e.target.value })) },
            React.createElement("option", { value: "" }, "-- Pilih Menu --"),
            menus.map((m) => React.createElement("option", { key: m.id, value: m.id }, m.nama))
          )
        ),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Berapa pcs diproduksi"),
          React.createElement("input", { type: "number", className: "inp", placeholder: "Contoh: 120", min: 1, value: form.jumlah, onChange: (e) => setForm((f) => ({ ...f, jumlah: e.target.value })) })
        ),
        !!form.menuId && (() => {
          const menuPrev = menus.find((m) => m.id === form.menuId);
          const est = estimasiMaxProduksiDariStok(menuPrev);
          const jmlPrev = parseInt(form.jumlah) || 0;
          return React.createElement("p", { className: "info-txt" },
            est.unlimited ? "Menu tanpa resep bahan." :
              ("Stok gudang cukup untuk maks " + est.maxPcs + " pcs" + (est.bottleneck ? " (batas: " + est.bottleneck + ")" : "") +
               (jmlPrev > 0 && jmlPrev > est.maxPcs ? " — qty melebihi stok!" : ""))
          );
        })(),
        React.createElement("div", { className: "field-group" },
          React.createElement("label", null, "Keterangan (opsional)"),
          React.createElement("input", { type: "text", className: "inp", placeholder: "Contoh: Batch pagi, Batch sore...", value: form.keterangan, onChange: (e) => setForm((f) => ({ ...f, keterangan: e.target.value })) })
        ),
        React.createElement("button", { className: "btn-primary", disabled: busy, onClick: simpan }, busy ? "Menyimpan..." : "Simpan produksi")
      ),

      // Rekap hari ini
      React.createElement("div", { className: "kpi-grid" },
        React.createElement("div", { className: "kpi-card kpi-omzet" },
          React.createElement("div", { className: "kpi-label" }, "Total Produksi Hari Ini"),
          React.createElement("div", { className: "kpi-val", style: { color: "var(--green)" } }, totalPcs, " pcs")
        ),
        React.createElement("div", { className: "kpi-card kpi-modal" },
          React.createElement("div", { className: "kpi-label" }, "Jenis Produk"),
          React.createElement("div", { className: "kpi-val" }, new Set(produksiList.map((p) => p.menuId)).size, " item")
        )
      ),

      // Tabel produksi
      React.createElement("h3", { className: "section-title" }, "Catatan Produksi - ", formatTanggalIndo(safeDate)),
      produksiList.length === 0
        ? React.createElement(EmptyState, { icon: "🍩", title: "Belum ada produksi di rentang ini", desc: "Isi form Input Produksi. Cek stok gudang bahan cukup dulu." })
        : React.createElement("div", { className: "tbl-wrap" },
            React.createElement("table", { className: "tbl" },
              React.createElement("thead", null,
                React.createElement("tr", null,
                  React.createElement("th", null, "Produk"),
                  React.createElement("th", null, "Jumlah"),
                  React.createElement("th", null, "Keterangan"),
                  React.createElement("th", null, "Jam"),
                  React.createElement("th", null, "")
                )
              ),
              React.createElement("tbody", null,
                produksiList.map((p) =>
                  React.createElement("tr", { key: p.id },
                    React.createElement("td", null, React.createElement("strong", null, p.menuNama)),
                    React.createElement("td", { style: { color: "var(--green)", fontWeight: 700 } }, p.jumlah, " pcs"),
                    React.createElement("td", { style: { color: "var(--text2)" } }, p.keterangan || "-"),
                    React.createElement("td", { style: { color: "var(--text2)", fontSize: 12 } }, p.ts || "-"),
                    React.createElement("td", null,
                      React.createElement("button", { className: "btn-danger-sm", onClick: () => hapus(p.id) }, "Hapus")
                    )
                  )
                ),
                React.createElement("tr", { style: { borderTop: "2px solid var(--border)", fontWeight: 700 } },
                  React.createElement("td", null, "TOTAL"),
                  React.createElement("td", { style: { color: "var(--green)" } }, totalPcs, " pcs"),
                  React.createElement("td", { colSpan: 3 })
                )
              )
            )
          )
      ), // end tab produksi

      // ── Tab Absensi CK ──
      tab === "absensi" && React.createElement("div", null,
        React.createElement("h3", { className: "section-title mt8" }, "Absensi"),
        sudahCheckout
          ? React.createElement("div", { className: "form-card", style: { background: "color-mix(in srgb, var(--red) 12%, var(--bg2))", borderColor: "var(--red)" } },
              React.createElement("p", { style: { color: "var(--red)", fontWeight: 700, textAlign: "center" } }, "Anda sudah Check-out untuk tanggal ini. Form absensi dikunci.")
            )
          : React.createElement("div", { className: "form-card" },
              React.createElement("div", { style: { fontWeight: 700 } }, formatTanggalIndo(safeDate)),
              React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginBottom: 10 } },
                "Check-in: ", fmtTs(selectedAbs?.checkin_ts), " | Check-out: ", fmtTs(selectedAbs?.checkout_ts)
              ),
              React.createElement("div", { className: "row-wrap" },
                React.createElement("button", { className: "btn-primary btn-sm", onClick: doCheckin }, "Check-in"),
                React.createElement("button", { className: "btn-secondary btn-sm", onClick: doCheckout }, "Check-out")
              )
            ),
        // KPI bulan ini
        React.createElement("div", { className: "field-group mt12" },
          React.createElement("label", null, "Rekap Bulan"),
          React.createElement("input", { type: "month", className: "inp inp-sm", value: absMonth, onChange: (e) => setAbsMonth(e.target.value) })
        ),
        React.createElement("div", { className: "kpi-grid mt8" },
          React.createElement("div", { className: "kpi-card kpi-omzet" },
            React.createElement("div", { className: "kpi-label" }, "Total Hadir"),
            React.createElement("div", { className: "kpi-val" }, calcMonth.hadir, " hari")
          ),
          React.createElement("div", { className: "kpi-card kpi-profit" },
            React.createElement("div", { className: "kpi-label" }, "Total Jam"),
            React.createElement("div", { className: "kpi-val" }, Math.round(calcMonth.menit / 60 * 10) / 10, " jam")
          ),
          gajiHarian > 0 && React.createElement("div", { className: "kpi-card kpi-peng", style: { gridColumn: "1/-1" } },
            React.createElement("div", { className: "kpi-label" }, "Est. Gaji Bulan Ini"),
            React.createElement("div", { className: "kpi-val" },
              fmtRp(estGaji),
              React.createElement("span", { style: { fontSize: 11, color: "var(--text2)", marginLeft: 6 } },
                "(", fmtRp(gajiHarian), "/hari × ", calcMonth.hadir, " hari)"
              )
            )
          )
        ),
        // Riwayat absensi
        React.createElement("h3", { className: "section-title mt12" }, "Riwayat Absensi (", formatBulanIndo(absMonth), ")"),
        myMonthRows.length === 0
          ? React.createElement(EmptyState, { icon: "⏰", title: "Belum ada absen", desc: "Muncul setelah pekerja check-in. Set gaji harian di Akun & Pekerja." })
          : myMonthRows.map((r) =>
              React.createElement("div", { key: r.id, className: "peng-row" },
                React.createElement("div", { className: "peng-info" },
                  React.createElement("span", { className: "peng-ket" }, formatTanggalIndoPendek(r.date)),
                  React.createElement("span", { className: "peng-ts" },
                    "Masuk: ", fmtTs(r.checkin_ts), " | Keluar: ", r.checkout_ts ? fmtTs(r.checkout_ts) : "Belum"
                  )
                ),
                r.checkin_ts && r.checkout_ts && React.createElement("div", { className: "peng-right" },
                  React.createElement("span", { style: { fontSize: 12, color: "var(--green)" } },
                    Math.round((Date.parse(r.checkout_ts) - Date.parse(r.checkin_ts)) / 60000), " menit"
                  )
                )
              )
            )
      ) // end tab absensi
      ,

      // ── Tab Gaji CK ──
      tab === "gaji" && (() => {
        const gajiList = (S.get("gajiPembayaran") || [])
          .filter((g) => g.user_id === userId)
          .sort((a, b) => (b.bulan || "").localeCompare(a.bulan || ""));
        const gajiMenunggu = gajiList.filter((g) => g.status === "dikirim");
        const doKonfirmGaji = async (gId) => {
          try {
            const { error } = await sb.from("gajiPembayaran").update({ status: "dikonfirmasi", confirmedAt: nowIso() }).eq("id", gId);
            if (error) throw error;
            await S.loadKey("gajiPembayaran");
            pushNotif("Gaji dikonfirmasi. Terima kasih!", "success");
          } catch (e) { pushNotif(e?.message || String(e), "warning"); }
        };
        return React.createElement("div", null,
          React.createElement("h3", { className: "section-title mt8" }, "Info Gaji"),
          React.createElement("div", { className: "kpi-grid" },
            React.createElement("div", { className: "kpi-card kpi-omzet" }, React.createElement("div", { className: "kpi-label" }, "Hadir Minggu Ini"), React.createElement("div", { className: "kpi-val" }, myWeekHadir, " / 7 hari")),
            React.createElement("div", { className: "kpi-card kpi-profit" }, React.createElement("div", { className: "kpi-label" }, "Hadir Bulan Ini"), React.createElement("div", { className: "kpi-val" }, myMonthHadirNow, " hari"))
          ),
          React.createElement("p", { className: "info-txt" }, "Daftar pembayaran gaji dari Owner. Konfirmasi setelah kamu menerima gaji."),
          gajiMenunggu.length > 0 && React.createElement("div", { className: "form-card mt8", style: { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, var(--bg2))" } },
            React.createElement("div", { style: { fontWeight: 700, color: "var(--accent)", marginBottom: 6 } }, "💸 Kamu punya gaji yang belum dikonfirmasi!"),
            gajiMenunggu.map((g) =>
              React.createElement("div", { key: g.id, style: { marginBottom: 10 } },
                React.createElement("div", { style: { fontSize: 14, fontWeight: 700 } }, fmtRp(g.jumlah)),
                React.createElement("div", { style: { fontSize: 12, color: "var(--text2)", marginBottom: 6 } }, "Bulan ", formatBulanIndo(g.bulan), " · ", fmtRp(g.gajiHarian), "/hari × ", g.hadir, " hari"),
                React.createElement("button", { className: "btn-primary btn-full", onClick: () => doKonfirmGaji(g.id) }, "✅ Konfirmasi Sudah Terima Gaji")
              )
            )
          ),
          gajiList.length === 0 && React.createElement("p", { className: "empty-txt mt8" }, "Belum ada riwayat pembayaran gaji."),
          gajiList.filter((g) => g.status === "dikonfirmasi").length > 0 && React.createElement("div", { className: "mt12" },
            React.createElement("h4", { className: "sub-title" }, "Riwayat Gaji Diterima"),
            gajiList.filter((g) => g.status === "dikonfirmasi").map((g) =>
              React.createElement("div", { key: g.id, className: "peng-row" },
                React.createElement("div", { className: "peng-info" },
                  React.createElement("span", { className: "peng-ket" }, "Gaji Bulan ", formatBulanIndo(g.bulan)),
                  React.createElement("span", { className: "peng-ts" }, fmtRp(g.gajiHarian), "/hari × ", g.hadir, " hari")
                ),
                React.createElement("div", { className: "peng-right" },
                  React.createElement("span", { className: "peng-jml", style: { color: "var(--green)" } }, fmtRp(g.jumlah)),
                  React.createElement("span", { style: { fontSize: 11, color: "var(--green)", marginLeft: 6 } }, "✅")
                )
              )
            )
          )
        );
      })()
    );
  }

  // ─── App Root ──────────────────────────────────────────────────────────────
  function App() {
    const [authSession, setAuthSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notifs, setNotifs] = useState([]);
    const [historyMode, setHistoryMode] = useState(() => getHistoryModeLocal());
    const [ownerTab, setOwnerTab] = useState("dashboard");
    const [navOpen, setNavOpen] = useState(false);
    const [openGroup, setOpenGroup] = useState(null); // grup sidebar yang sedang terbuka
    const [theme, setTheme] = useState(() => {
  try { return localStorage.getItem("evora_theme") || "dark"; } catch { return "dark"; }
});

if (!sb) {
  return React.createElement("div", { className: "login-wrap" },
    React.createElement("div", { className: "login-card" },
      React.createElement("div", { style: { fontSize: 44, textAlign: "center" } }, "⚠️"),
      React.createElement("h1", { className: "login-title" }, "Konfigurasi Belum Siap"),
      React.createElement("p", { className: "login-sub", style: { whiteSpace: "pre-line" } }, APP_BOOT_ERROR || "Client Supabase belum berhasil diinisialisasi."),
      React.createElement("p", { className: "login-hint" }, "Periksa file config.js, library Supabase, dan urutan load script sebelum app.bundle.js.")
    )
  );
}

    useEffect(() => {
      try { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("evora_theme", theme); } catch {}
    }, [theme]);

    const pushNotif = useCallback((msg, type = "success") => {
      const id = uid();
      setNotifs((n) => [...n, { id, msg, type }]);
    }, []);

    const removeNotif = useCallback((id) => setNotifs((n) => n.filter((x) => x.id !== id)), []);

    useEffect(() => { S.setErrorHandler((msg) => pushNotif(String(msg), "warning")); }, [pushNotif]);

    useEffect(() => {
      const onStorage = (e) => {
        if (!e || e.key === HISTORY_MODE_STORAGE_KEY) setHistoryMode(getHistoryModeLocal());
      };
      try { window.addEventListener("storage", onStorage); } catch {}
      return () => { try { window.removeEventListener("storage", onStorage); } catch {} };
    }, []);

    const syncAfterLogin = useCallback(async (session) => {
      setAuthSession(session);
      if (!session) { S.reset(); setProfile(null); setHistoryMode(getHistoryModeLocal()); setLoading(false); return; }
      setLoading(true);
      try {
        const { data: prof, error } = await sb.from("profiles").select("*").eq("user_id", session.user.id).single();
        if (error) throw error;
        if (!isActiveProfile(prof)) {
          pushNotif("Akun kamu belum diundang oleh Owner (akses ditolak).", "warning");
          await sb.auth.signOut(); return;
        }
        setProfile(prof);
        await syncBrandingFromDb().catch(() => {});
        const histCfg = await syncHistoryModeFromDb().catch(() => getHistoryModeLocal());
        setHistoryMode(normalizeHistoryMode(histCfg));
        const jadwalCfg = await syncJadwalLiburFromDb().catch(() => getJadwalLiburLocal());
        S.set("jadwalLibur", jadwalCfg);
        await S.loadAll();
        await syncNormalizedOperationalState().catch(() => {});
        if (prof.role === "owner") await S.loadKey("profiles").catch(() => {});
        await loadGajiHistoriFromDb().catch(() => {});
        await loadStokBahanFromDb().catch(() => {});
        await loadStokTopingFromDb().catch(() => {});
        await loadDonatCarryFromDb().catch(() => {});
        await loadPesananFromDb().catch(() => {});
        await loadResellerFromDb().catch(() => {});
        await loadShiftFromDb().catch(() => {});
        await loadKurirFromDb().catch(() => {});
        S.startRealtime();
      } catch (ex) {
        pushNotif(ex?.message || String(ex), "warning");
      } finally {
        setLoading(false);
      }
    }, [pushNotif]);

    useEffect(() => {
      let unsub = null;
      sb.auth.getSession().then(({ data }) => syncAfterLogin(data?.session || null));
      const { data } = sb.auth.onAuthStateChange((_event, session) => syncAfterLogin(session));
      unsub = data?.subscription;
      return () => { try { unsub?.unsubscribe(); } catch {} };
    }, [syncAfterLogin]);

    useEffect(() => {
      if (!authSession) return;
      let dead = false;
      const pullSettings = async () => {
        const cfg = await syncHistoryModeFromDb().catch(() => getHistoryModeLocal());
        if (!dead) setHistoryMode(normalizeHistoryMode(cfg));
        const jadwalCfg = await syncJadwalLiburFromDb().catch(() => getJadwalLiburLocal());
        if (!dead) S.set("jadwalLibur", jadwalCfg);
      };
      pullSettings();
      const iv = setInterval(pullSettings, 10000);
      return () => { dead = true; clearInterval(iv); };
    }, [authSession]);

    const myBranch = profile?.role === "worker" ? (S.get("branches") || []).find((b) => b.id === profile.branchId) : null;
    const managerCities = getProfileCities(profile);
    const roleLabel = profile?.role === "owner" ? "Owner"
      : isAreaManager(profile) ? ("Manager" + (managerCities.length ? " · " + managerCities.join(", ") : ""))
      : profile?.role === "worker" ? (myBranch?.type === "central_kitchen" ? "Pekerja CK" : "Pekerja")
      : profile?.role === "investor" ? "Investor"
      : profile?.role === "distribusi" ? "Kurir Distribusi" : "\u2014";
    const isOwner = profile?.role === "owner";
    const isManager = isAreaManager(profile);
    const isStaffAdminNav = isOwner || isManager;
    const navGroups = isOwner ? OWNER_NAV : isManager ? MANAGER_NAV : [];
    useEffect(() => {
      if (!isManager) return;
      const allowed = new Set(MANAGER_TABS.map((t) => t.key));
      if (!allowed.has(ownerTab)) setOwnerTab("dashboard");
    }, [isManager, ownerTab]);
    // buka otomatis grup yang berisi tab aktif (biar user tahu posisinya)
    useEffect(() => {
      for (const it of navGroups) {
        if (it.children && it.children.some((c) => c.key === ownerTab)) { setOpenGroup(it.group); break; }
      }
    }, [ownerTab, isOwner, isManager]);

    const closeNav = () => setNavOpen(false);

    return React.createElement(React.Fragment, null,
      !authSession
        ? React.createElement(LoginPage, null)
        : React.createElement("div", { className: "app-wrap" },
            // Mobile top bar — only visible on small screens via CSS
            React.createElement("header", { className: "mobile-bar" },
              React.createElement("button", { className: "nav-burger", onClick: () => setNavOpen(true), "aria-label": "Buka menu" },
                React.createElement("span", null), React.createElement("span", null), React.createElement("span", null)
              ),
              React.createElement("span", { className: "mobile-bar-brand" }, "\uD83C\uDF69 Evora Donuts")
            ),
            navOpen && React.createElement("div", { className: "nav-scrim", onClick: closeNav }),
            // Sidebar
            React.createElement("nav", { className: "sidebar" + (navOpen ? " sidebar-open" : "") },
              React.createElement("div", { className: "sidebar-brand" },
                React.createElement("span", { className: "sidebar-brand-emoji" }, "\uD83C\uDF69"),
                React.createElement("div", null,
                  React.createElement("div", { className: "sidebar-brand-name" }, "Evora Donuts"),
                  React.createElement("div", { className: "sidebar-brand-sub" }, "Potato Donuts")
                )
              ),
              React.createElement("div", { className: "sidebar-role" }, roleLabel),
              isStaffAdminNav && React.createElement("div", { className: "sidebar-nav" },
                navGroups.map((it) => {
                  // Item tunggal (bukan grup)
                  if (!it.children) {
                    return React.createElement("button", {
                      key: it.key,
                      className: "sidebar-link" + (ownerTab === it.key ? " active" : ""),
                      onClick: () => { setOwnerTab(it.key); closeNav(); }
                    },
                      React.createElement("span", { className: "sidebar-link-icon" }, it.icon),
                      React.createElement("span", null, it.label)
                    );
                  }
                  // Grup yang bisa dibuka/tutup
                  const isOpen = openGroup === it.group;
                  const activeInGroup = it.children.some((c) => c.key === ownerTab);
                  return React.createElement("div", { key: it.group, className: "sidebar-group" },
                    React.createElement("button", {
                      className: "sidebar-link sidebar-group-head" + (activeInGroup && !isOpen ? " has-active" : ""),
                      onClick: () => setOpenGroup(isOpen ? null : it.group)
                    },
                      React.createElement("span", { className: "sidebar-link-icon" }, it.icon),
                      React.createElement("span", { style: { flex: 1, textAlign: "left" } }, it.label),
                      React.createElement("span", { className: "sidebar-group-chev" }, isOpen ? "\u25B4" : "\u25BE")
                    ),
                    isOpen && React.createElement("div", { className: "sidebar-subnav" },
                      it.children.map((c) => React.createElement("button", {
                        key: c.key,
                        className: "sidebar-link sidebar-sublink" + (ownerTab === c.key ? " active" : ""),
                        onClick: () => { setOwnerTab(c.key); closeNav(); }
                      },
                        React.createElement("span", { className: "sidebar-link-icon" }, c.icon),
                        React.createElement("span", null, c.label)
                      ))
                    )
                  );
                })
              ),
              React.createElement("div", { className: "sidebar-spacer" }),
              React.createElement("button", { className: "sidebar-theme", onClick: () => setTheme((t) => t === "dark" ? "light" : "dark") },
                theme === "dark" ? "\u2600\uFE0F Mode Terang" : "\uD83C\uDF19 Mode Gelap"
              ),
              React.createElement("button", { className: "sidebar-logout", onClick: () => sb.auth.signOut() }, "\u21AA Keluar")
            ),
            React.createElement("main", { className: "content-wrap" },
              loading && React.createElement("p", { className: "info-txt" }, "Memuat data..."),
              !loading && profile?.role === "worker" && (
                myBranch?.type === "central_kitchen"
                  ? React.createElement(KitchenPage, { pushNotif, me: profile, historyMode })
                  : React.createElement(WorkerPage, { pushNotif, me: profile, historyMode })
              ),
              !loading && (profile?.role === "owner" || isAreaManager(profile)) && React.createElement(OwnerPage, {
                pushNotif, me: profile, tab: ownerTab, setTab: setOwnerTab, historyMode, onHistoryModeChange: setHistoryMode,
                isManager: isAreaManager(profile),
                managerCities: getProfileCities(profile)
              }),
              !loading && profile?.role === "investor" && React.createElement(InvestorPage, { investorId: profile.investorId, pushNotif, me: profile }),
              !loading && profile?.role === "distribusi" && React.createElement(DistribusiPage, { pushNotif, me: profile })
            )
          ),
      React.createElement("div", { className: "notif-stack" },
        notifs.map((n) => React.createElement(Notif, { key: n.id, msg: n.msg, type: n.type, onClose: () => removeNotif(n.id) }))
      )
    );
  }

  var root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(App, null));
})();
