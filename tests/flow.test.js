const assert = require('node:assert/strict');

function distribute(stock, plan) {
  const total = Object.values(plan).reduce((a, n) => a + n, 0);
  if (total > stock) throw new Error('Distribusi melebihi stok produksi');
  return { distributed: total, remaining: stock - total };
}

function receiveSent(sent, good, damaged = 0, missing = 0) {
  if (good < 0 || damaged < 0 || missing < 0) throw new Error('Jumlah tidak valid');
  if (good + damaged + missing !== sent) throw new Error('Penerimaan tidak balance');
  return { stockIn: good, waste: damaged, discrepancy: missing };
}

function boxConsumption(slots) {
  const out = { plain: slots.length, glaze: {}, topping: {}, extraTopping: {} };
  for (const s of slots) {
    out.glaze[s.glaze] = (out.glaze[s.glaze] || 0) + 1;
    if (s.topping) out.topping[s.topping] = (out.topping[s.topping] || 0) + 1;
    for (const t of (s.extraToppings || [])) out.extraTopping[t] = (out.extraTopping[t] || 0) + 1;
  }
  return out;
}

const dist = distribute(10, { alun: 4, tembarak: 3, cafe: 2 });
assert.deepEqual(dist, { distributed: 9, remaining: 1 });
assert.throws(() => distribute(10, { a: 8, b: 5 }));

assert.deepEqual(receiveSent(4, 3, 1, 0), { stockIn: 3, waste: 1, discrepancy: 0 });
assert.throws(() => receiveSent(4, 4, 1, 0));

const use = boxConsumption([
  { glaze: 'cokelat', topping: 'kacang', extraToppings: ['keju'] },
  { glaze: 'stroberi', topping: 'keju', extraToppings: [] },
  { glaze: 'matcha', topping: 'meses', extraToppings: [] },
]);
assert.equal(use.plain, 3);
assert.deepEqual(use.glaze, { cokelat: 1, stroberi: 1, matcha: 1 });
assert.deepEqual(use.topping, { kacang: 1, keju: 1, meses: 1 });
assert.deepEqual(use.extraTopping, { keju: 1 });

console.log('flow tests: PASS');
