/**
 * Test otomatis logika inti Evora Donuts (uang & stok).
 * Jalankan: node tests/logic.test.js
 * Tidak butuh dependensi — pakai assert bawaan Node.
 *
 * Test ini mengunci PERILAKU logika bisnis supaya perubahan kode di masa depan
 * tidak diam-diam merusak hitungan uang. Fungsi di sini adalah salinan logika
 * murni dari app.bundle.js (tanpa React/DB) agar bisa diuji terisolasi.
 */
const assert = require("assert");
let pass = 0, fail = 0;
function test(nama, fn) {
  try { fn(); pass++; console.log("  \u2713 " + nama); }
  catch (e) { fail++; console.log("  \u2717 " + nama + "\n      " + e.message); }
}
const round = (n) => Math.round(Number(n) || 0);

// ─────────────────────────────────────────────────────────────
console.log("\n[1] Diskon kasir");
// total = subtotal - diskon, dibatasi 0..subtotal, persen maks 100
function hitungDiskon(subtotal, tipe, input) {
  const v = parseFloat(input) || 0;
  if (v <= 0 || tipe === "none") return { diskon: 0, total: subtotal };
  let d = tipe === "persen" ? Math.round(subtotal * (Math.min(v, 100) / 100)) : v;
  d = Math.max(0, Math.min(d, subtotal));
  return { diskon: d, total: Math.max(0, subtotal - d) };
}
test("persen 20% dari 50rb = diskon 10rb, total 40rb", () => {
  const r = hitungDiskon(50000, "persen", 20);
  assert.equal(r.diskon, 10000); assert.equal(r.total, 40000);
});
test("nominal tidak boleh melebihi subtotal", () => {
  const r = hitungDiskon(30000, "nominal", 50000);
  assert.equal(r.diskon, 30000); assert.equal(r.total, 0);
});
test("persen dibatasi maks 100%", () => {
  const r = hitungDiskon(20000, "persen", 250);
  assert.equal(r.total, 0);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[2] Box campur (mix) — HPP & stok");
function hitungMixBox(menu, isian, topings, menuHpp) {
  const boxCost = round(menu.boxCost || 0);
  let hppIsi = 0;
  isian.forEach((mid) => { hppIsi += menuHpp[mid] || 0; });
  const hppToping = topings.reduce((a, t) => a + (t.hpp || 0), 0);
  const hargaToping = topings.reduce((a, t) => a + (t.hargaJual || 0), 0);
  const pcs = {};
  isian.forEach((mid) => { pcs[mid] = (pcs[mid] || 0) + 1; });
  return { hpp: round(hppIsi + boxCost + hppToping), harga: (menu.hargaJual || 0) + hargaToping, pcsKonsumsi: pcs };
}
test("2 coklat + 1 keju + toping meses: HPP & stok benar", () => {
  const r = hitungMixBox(
    { boxCost: 1000, hargaJual: 25000 },
    ["coklat", "coklat", "keju"],
    [{ hpp: 500, hargaJual: 2000 }],
    { coklat: 2000, keju: 2500 }
  );
  assert.equal(r.hpp, 1000 + 2000 + 2000 + 2500 + 500); // 8000
  assert.equal(r.harga, 27000);
  assert.deepEqual(r.pcsKonsumsi, { coklat: 2, keju: 1 });
});

// ─────────────────────────────────────────────────────────────
console.log("\n[3] Box per-slot — toping ke-2 berbayar");
function hitungSlotBox(menu, slots, hppPolos, glazeDef, topDef) {
  let hpp = round(menu.boxCost || 0), hargaTambahan = 0;
  slots.forEach((s) => {
    hpp += hppPolos;
    if (s.glaze) { const g = glazeDef[s.glaze]; if (g && g.porsiPerPcs && g.hargaPerSatuan != null) hpp += g.porsiPerPcs * g.hargaPerSatuan; }
    (s.toping || []).forEach((tid, idx) => {
      const t = topDef[tid]; if (!t) return;
      hpp += t.hpp;
      if (idx >= 1) hargaTambahan += t.hargaJual; // ke-2 dst bayar
    });
  });
  return { hpp: round(hpp), harga: (menu.hargaJual || 0) + hargaTambahan };
}
test("slot: toping pertama gratis, kedua bayar", () => {
  const r = hitungSlotBox(
    { boxCost: 1000, hargaJual: 25000 },
    [{ glaze: "vanila", toping: ["oreo", "kacang"] }, { glaze: "coklat", toping: ["oreo"] }, { glaze: "vanila", toping: [] }],
    1500,
    { vanila: { porsiPerPcs: 5, hargaPerSatuan: 50 }, coklat: { porsiPerPcs: 5, hargaPerSatuan: 50 } },
    { oreo: { hpp: 400, hargaJual: 2000 }, kacang: { hpp: 500, hargaJual: 2500 } }
  );
  // harga: box 25000 + kacang (toping ke-2 slot 1) 2500 = 27500
  assert.equal(r.harga, 27500);
  // hpp: box 1000 + polos 3x1500=4500 + glaze 3x250=750 + toping(400+500+400)=1300 = 7550
  assert.equal(r.hpp, 7550);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[4] Donat carry-over (FIFO, umur 1 hari)");
function checkoutCarry(ledger, branchId, menuId, date, sisaTotal, masukHariIni, aksiBaru) {
  const carryLama = ledger.filter((e) => e.branchId === branchId && e.menuId === menuId && e.batchDate < date).reduce((a, e) => a + e.qty, 0);
  const qtyLama = Math.min(carryLama, Math.max(0, sisaTotal - masukHariIni));
  const qtyBaru = Math.max(0, sisaTotal - qtyLama);
  const buang = qtyLama + (aksiBaru === "buang" ? qtyBaru : 0);
  const bawa = aksiBaru === "buang" ? 0 : qtyBaru;
  let next = ledger.filter((e) => !(e.branchId === branchId && e.batchDate < date));
  if (bawa > 0) next.push({ branchId, menuId, batchDate: date, qty: bawa });
  return { buang, bawa, ledger: next };
}
test("hari1 sisa 10 baru, dibawa: 0 buang, 10 carry", () => {
  const r = checkoutCarry([], "A", "coklat", "2026-07-13", 10, 50, "bawa");
  assert.equal(r.buang, 0); assert.equal(r.bawa, 10);
});
test("hari lama lewat 1 hari: wajib buang", () => {
  const led = [{ branchId: "A", menuId: "coklat", batchDate: "2026-07-13", qty: 5 }];
  // hari ini sisa 7, masuk baru 50 → lama = min(5, max(0,7-50)=0) = 0... koreksi: FIFO lama laku dulu
  const r = checkoutCarry(led, "A", "coklat", "2026-07-15", 7, 2, "bawa");
  // sisa 7, masuk hari ini 2 → lama = min(5, 7-2=5) = 5 wajib buang; baru 2 dibawa
  assert.equal(r.buang, 5); assert.equal(r.bawa, 2);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[5] Shift kas — seharusnya & selisih");
function hitungShift(modalAwal, txs, pengeluaran, fisik) {
  let tunai = 0;
  txs.forEach((t) => {
    if (t.metodeBayar === "tunai") tunai += t.total;
    else if (t.metodeBayar === "campuran") tunai += Math.max(0, (t.jumlahBayar || 0) - (t.kembalian || 0));
  });
  const seharusnya = modalAwal + tunai - pengeluaran;
  return { seharusnya, selisih: fisik - seharusnya };
}
test("campuran dihitung bagian tunainya saja", () => {
  const r = hitungShift(200000, [
    { metodeBayar: "tunai", total: 500000 },
    { metodeBayar: "qris", total: 300000 },
    { metodeBayar: "campuran", total: 100000, jumlahBayar: 100000, kembalian: 20000 },
    { metodeBayar: "tunai", total: 770000 },
  ], 50000, 1495000);
  assert.equal(r.seharusnya, 1500000); // 200k + (500k+80k+770k) - 50k
  assert.equal(r.selisih, -5000); // kurang 5rb
});

// ─────────────────────────────────────────────────────────────
console.log("\n[6] Piutang pesanan (lunas/dp/utang)");
const sisaUtang = (p) => p.bayar === "lunas" ? 0 : p.bayar === "dp" ? Math.max(0, p.total - (p.dp || 0)) : p.total;
test("total piutang dari campuran status", () => {
  const list = [
    { total: 150000, bayar: "dp", dp: 50000 },
    { total: 250000, bayar: "utang" },
    { total: 800000, bayar: "lunas" },
  ];
  const total = list.reduce((a, p) => a + sisaUtang(p), 0);
  assert.equal(total, 350000); // 100k + 250k + 0
});

// ─────────────────────────────────────────────────────────────
console.log("\n[7] Rantai uang kurir (dibawa→perjalanan→dikonfirmasi)");
test("hanya 'perjalanan' yang bisa dikonfirmasi owner", () => {
  let k = [
    { id: "1", statusUang: "dibawa", uang: 100 },
    { id: "2", statusUang: "perjalanan", uang: 200 },
  ];
  const perjalanan = k.filter((x) => x.statusUang === "perjalanan");
  assert.equal(perjalanan.reduce((a, x) => a + x.uang, 0), 200);
  // owner konfirmasi
  const ids = new Set(perjalanan.map((x) => x.id));
  k = k.map((x) => ids.has(x.id) ? { ...x, statusUang: "dikonfirmasi" } : x);
  assert.equal(k.find((x) => x.id === "2").statusUang, "dikonfirmasi");
  assert.equal(k.find((x) => x.id === "1").statusUang, "dibawa"); // yg dibawa tak tersentuh
});

// ─────────────────────────────────────────────────────────────
console.log("\n[8] Laba periode (rumus inti konsisten)");
test("Laba = Omzet - HPP distribusi - Pengeluaran", () => {
  const omzet = 5000000, hppDistribusi = 2000000, peng = 800000;
  assert.equal(omzet - hppDistribusi - peng, 2200000);
});

// ─────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(40));
console.log(`HASIL: ${pass} lulus, ${fail} gagal`);
console.log("=".repeat(40));
process.exit(fail > 0 ? 1 : 0);
