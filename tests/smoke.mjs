// SpectraFree smoke tests: run the app in headless Chromium and check its answers
// against values built into the synthetic example data.
// Usage: npm install && npx playwright install chromium && npm test
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appUrl = pathToFileURL(path.join(root, 'index.html')).href;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failed++;
};
const near = (v, target, tol) => Math.abs(v - target) <= tol;

const browser = await chromium.launch();
const errors = [];
async function freshPage(){
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_|net::/i.test(m.text())) errors.push(m.text()); });
  await page.goto(appUrl);
  await page.waitForFunction(() => typeof state !== 'undefined' && state.samples.length > 0);
  return page;
}

try {
  // ---------- start-up
  let page = await freshPage();
  check('page title is SpectraFree', (await page.title()) === 'SpectraFree');
  check('eight example tubes load', (await page.evaluate(() => state.samples.length)) === 8);

  // ---------- FCS reader
  const parse = await page.evaluate(() => {
    function build(ver, kv, data){
      const txt = '/' + kv.map(([k, v]) => k + '/' + v).join('/') + '/';
      const tS = 58, tE = tS + txt.length - 1, dS = tE + 1, dE = dS + data.length - 1;
      const h = ver + '    ' + [tS, tE, dS, dE, 0, 0].map(x => String(x).padStart(8, ' ')).join('');
      const buf = new Uint8Array(dS + data.length);
      for (let i = 0; i < h.length; i++) buf[i] = h.charCodeAt(i);
      for (let i = 0; i < txt.length; i++) buf[tS + i] = txt.charCodeAt(i);
      buf.set(data, dS); return buf.buffer;
    }
    const out = {};
    { const dv = new DataView(new ArrayBuffer(24)); [1.5, -2, 300.25, 4, 5e5, 6].forEach((v, i) => dv.setFloat32(i * 4, v, true));
      const s = parseFCS(build('FCS3.1', [['$PAR','2'],['$TOT','3'],['$DATATYPE','F'],['$MODE','L'],['$BYTEORD','1,2,3,4'],['$P1N','FSC-A'],['$P1B','32'],['$P1R','262144'],['$P2N','FL1-A'],['$P2B','32'],['$P2R','262144'],['$P2S','CD3//FITC']], new Uint8Array(dv.buffer)), 'f');
      out.float = [...s.raw[0], ...s.raw[1]]; out.stain = s.ch[1].stain; }
    { const dv = new DataView(new ArrayBuffer(4)); dv.setUint16(0, 1024 + 7, false); dv.setUint16(2, 1023, false);
      const s = parseFCS(build('FCS2.0', [['$PAR','1'],['$TOT','2'],['$DATATYPE','I'],['$MODE','L'],['$BYTEORD','2,1'],['$P1N','FL1'],['$P1B','16'],['$P1R','1024']], new Uint8Array(dv.buffer)), 'i');
      out.int16 = [...s.raw[0]]; }
    { const dv = new DataView(new ArrayBuffer(2)); dv.setUint16(0, 512, true);
      const s = parseFCS(build('FCS2.0', [['$PAR','1'],['$TOT','1'],['$DATATYPE','I'],['$MODE','L'],['$BYTEORD','1,2'],['$P1N','FL1'],['$P1B','16'],['$P1R','1024'],['$P1E','4,1']], new Uint8Array(dv.buffer)), 'e');
      out.logamp = s.raw[0][0]; }
    try { parseFCS(new TextEncoder().encode('not an fcs file at all, just some text padding here....').buffer, 'x'); out.rejectsText = false; } catch (e) { out.rejectsText = true; }
    return out;
  });
  check('reads 32-bit float data', JSON.stringify(parse.float) === JSON.stringify([1.5, 300.25, 500000, -2, 4, 6]));
  check('handles escaped delimiters in keywords', parse.stain === 'CD3/FITC');
  check('reads big-endian 16-bit integers with range masking', JSON.stringify(parse.int16) === JSON.stringify([7, 1023]));
  check('applies $PnE log amplification', near(parse.logamp, 100, 1e-6), String(parse.logamp));
  check('rejects a file that is not FCS', parse.rejectsText);

  // ---------- gating on the example data
  const gates = await page.evaluate(() => { const s = cur(); return { lymph: s.counts.get(1) / s.n, fl1: s.counts.get(2) / s.counts.get(1) }; });
  check('lymphocyte gate holds about half the events', near(gates.lymph, 0.497, 0.01), (100 * gates.lymph).toFixed(1) + '%');
  check('FL1+ gate holds about 38% of lymphocytes', near(gates.fl1, 0.379, 0.01), (100 * gates.fl1).toFixed(1) + '%');

  // ---------- auto-compensation
  await page.click('#autoCompBtn');
  const S = await page.evaluate(() => state.comp.S);
  check('FITC → PE spillover ≈ 12%', near(S['FL1-A|FL2-A'], 0.12, 0.012), (100 * S['FL1-A|FL2-A']).toFixed(2) + '%');
  check('PE → PerCP spillover ≈ 18%', near(S['FL2-A|FL3-A'], 0.18, 0.015), (100 * S['FL2-A|FL3-A']).toFixed(2) + '%');
  check('PerCP → APC spillover ≈ 8%', near(S['FL3-A|FL4-A'], 0.08, 0.012), (100 * S['FL3-A|FL4-A']).toFixed(2) + '%');
  check('compensation switched on', await page.evaluate(() => state.comp.on));
  await page.close();

  page = await freshPage();
  const detect = await page.evaluate(() => {
    const truth = ['stained', 'unstained', 'FL1-A', 'FL2-A', 'FL3-A', 'FL4-A'];
    const names = ['Tube_005', 'Tube_001', 'Tube_003', 'Tube_006', 'Tube_002', 'Tube_004'];
    state.samples.slice(0, 6).forEach((s, i) => { s.name = names[i] + '.fcs'; s.truth = truth[i]; });
    setCurrent(0); detectControls();
    const C = state.comp; let ok = C.unst?.truth === 'unstained' ? 1 : 0;
    for (const ch of ['FL1-A', 'FL2-A', 'FL3-A', 'FL4-A']) if (C.ctrl[ch]?.truth === ch) ok++;
    return ok;
  });
  check('finds all 5 control tubes from brightness alone', detect === 5, `${detect} of 5`);
  await page.close();

  // ---------- cell cycle
  page = await freshPage();
  const cc = {};
  for (const [kind, label] of [['untreated', /untreated/], ['arrest', /arrest/]]){
    await page.evaluate(src => setCurrent(state.samples.findIndex(s => new RegExp(src).test(s.name))), label.source);
    await page.click('#ccRun');
    cc[kind] = await page.evaluate(() => { const f = state.cc.fit; return f.ok ? { g1: f.G1 / f.total, s: f.S / f.total, g2: f.G2 / f.total, ratio: f.ratio } : null; });
  }
  const pc = v => (100 * v).toFixed(1) + '%';
  check('untreated: fit succeeds', !!cc.untreated);
  if (cc.untreated){
    check('untreated: G0/G1 ≈ 55%', near(cc.untreated.g1, 0.552, 0.025), pc(cc.untreated.g1));
    check('untreated: S ≈ 22%', near(cc.untreated.s, 0.217, 0.025), pc(cc.untreated.s));
    check('untreated: G2/M ≈ 13%', near(cc.untreated.g2, 0.128, 0.025), pc(cc.untreated.g2));
    check('untreated: G2/G1 ratio ≈ 1.97', near(cc.untreated.ratio, 1.97, 0.04), cc.untreated.ratio.toFixed(3));
  }
  check('arrest: fit succeeds', !!cc.arrest);
  if (cc.arrest){
    check('arrest: G2/M ≈ 51%', near(cc.arrest.g2, 0.513, 0.025), pc(cc.arrest.g2));
    check('arrest: G0/G1 ≈ 17%', near(cc.arrest.g1, 0.168, 0.025), pc(cc.arrest.g1));
  }

  // ---------- plots and undo / redo
  const before = await page.evaluate(() => ({ plots: panels.length, gates: state.gates.length }));
  await page.click('#addPlot');
  check('Add plot adds a plot', (await page.evaluate(() => panels.length)) === before.plots + 1);
  await page.evaluate(() => deleteGate(state.gates.find(g => g.name === 'FL1+').id));
  check('deleting a gate removes it', !(await page.evaluate(() => state.gates.some(g => g.name === 'FL1+'))));
  await page.click('#undoBtn');
  check('Undo restores the deleted gate', await page.evaluate(() => state.gates.some(g => g.name === 'FL1+')));
  await page.click('#undoBtn');
  check('second Undo removes the added plot', (await page.evaluate(() => panels.length)) === before.plots);
  await page.click('#redoBtn'); await page.click('#redoBtn');
  check('Redo re-applies both steps', await page.evaluate(n => panels.length === n + 1 && !state.gates.some(g => g.name === 'FL1+'), before.plots));
  await page.close();

  // ---------- quadrant gates
  page = await freshPage();
  const quad = await page.evaluate(() => {
    deleteGate(2); deleteGate(3);
    const B = panels[1], s = cur();
    B.addQuadrant(B.sx.fwd(2e4), B.sy.fwd(1e4));
    const qs = () => state.gates.filter(g => g.quad);
    const sum = () => qs().reduce((a, g) => a + s.counts.get(g.id), 0);
    const out = {n: qs().length, names: qs().map(g => g.name), sumOk: sum() === s.counts.get(1)};
    const q2 = qs().find(g => g.quad.q === 2), before = s.counts.get(q2.id);
    setQuadCentre(q2.quad.group, 2e5, 1e4); refresh();
    out.moved = s.counts.get(q2.id) !== before && qs().every(g => g.qc[0] === 2e5);
    out.sumAfterMove = sum() === s.counts.get(1);
    deleteGate(qs().find(g => g.quad.q === 3).id);
    out.groupDeleted = qs().length === 0;
    undo(); out.undone = qs().length === 4;
    return out;
  });
  check('quadrant makes four gates', quad.n === 4, quad.names.join(', '));
  check('quadrants add up to the parent', quad.sumOk);
  check('moving the centre moves all four together', quad.moved);
  check('quadrants still add up after moving', quad.sumAfterMove);
  check('deleting one quadrant deletes the group', quad.groupDeleted);
  check('Undo restores the quadrant', quad.undone);

  // ---------- medians and biexponential axes
  const misc = await page.evaluate(() => {
    let bad = 0;
    for (let t = 0; t < 300; t++){
      const n = 1 + Math.floor(Math.random() * 400), a = new Float32Array(n);
      for (let i = 0; i < n; i++) a[i] = t % 3 ? Math.random() * 1e6 - 2e5 : Math.floor(Math.random() * 6);
      const srt = Float32Array.from(a).sort(), ref = n % 2 ? srt[(n - 1) / 2] : (srt[n / 2 - 1] + srt[n / 2]) / 2;
      if (Math.abs(statsFor({n}, new Uint8Array(n).fill(1), a).med - ref) > 1e-6 * Math.max(1, Math.abs(ref))) bad++;
    }
    const sc = makeScale('asinh', {range: 16777216, pneg: -400, plo: 50, min: -2000, max: 1e6});
    return {bad, cf: sc.cf, ticksSorted: ticks(sc).every((t, i, a) => !i || a[i - 1].u <= t.u)};
  });
  check('fast median matches a full sort (300 random arrays)', misc.bad === 0, `${misc.bad} mismatches`);
  check('biexponential linear zone follows the data below zero', misc.cf === 400, `cofactor ${misc.cf}`);
  check('biexponential ticks are in order', misc.ticksSorted);
  await page.close();

  check('no JavaScript errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
