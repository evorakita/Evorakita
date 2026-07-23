const assert = require('node:assert/strict');

function saldoDanaBahan({ modalAwal = 0, jatahHpp = 0, belanja = 0, tambahanDana = 0, koreksi = 0 }) {
  return Number(modalAwal) + Number(tambahanDana) + Number(jatahHpp) - Number(belanja) + Number(koreksi);
}

function hppPerPcs(hargaBeli, kapasitas) {
  if (Number(kapasitas) <= 0) throw new Error('Kapasitas harus lebih dari 0');
  return Math.round(Number(hargaBeli) / Number(kapasitas));
}

function selisihKas(omzet, pengeluaran, tunai, nonTunai) {
  return Number(tunai) + Number(nonTunai) - (Number(omzet) - Number(pengeluaran));
}

assert.equal(saldoDanaBahan({ modalAwal: 500000, jatahHpp: 0, belanja: 95000 }), 405000);
assert.equal(saldoDanaBahan({ modalAwal: 0, jatahHpp: 100000, belanja: 95000 }), 5000);
assert.equal(hppPerPcs(100000, 200), 500);
assert.equal(selisihKas(1000000, 50000, 850000, 50000), -50000);
assert.throws(() => hppPerPcs(100000, 0));

console.log('logic tests: PASS');
