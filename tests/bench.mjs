// SpectraFree large-file benchmark: 1 million events at 10, 20 and 40 parameters.
// Usage: npm run bench            (this copy of index.html)
//        node tests/bench.mjs path/to/other/index.html   (compare another build)
// Times are wall-clock milliseconds in headless Chromium; they vary between machines, so the limits below are generous.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'index.html');
const N = 1e6, SIZES = [10, 20, 40];
const browser = await chromium.launch({ args: ['--js-flags=--max-old-space-size=8192'] });
const rows = [];
let failed = 0;

for (const P of SIZES){
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', e => { console.log('page error:', e.message); failed++; });
  await page.goto(pathToFileURL(target).href);
  await page.waitForFunction(() => typeof state !== 'undefined' && state.samples.length > 0);
  const r = await page.evaluate(async ({ P, N }) => {
    const t = () => performance.now(), o = { P };
    // synthetic file: FSC, SSC and P-2 fluorescence channels; each dye spills into its neighbours (a realistic, mostly-zero matrix)
    let seed = 7; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const chs = [], cols = [];
    for (let p = 0; p < P; p++){
      chs.push({ name: p === 0 ? 'FSC-A' : p === 1 ? 'SSC-A' : `F${p}-A`, label: '', range: 262144 });
      const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = rnd() < 0.5 ? 200 * rnd() : 4000 + 40000 * rnd(); cols.push(a);
    }
    const bytes = buildFCS(chs, cols, []); cols.length = 0;
    o.fileMB = Math.round(bytes.length / 1e6);
    // open: on the page, and (new builds) in the background worker, where the page itself is only busy for the hand-over
    const copy0 = bytes.buffer.slice(0);
    let t0 = t(); const s = parseFCS(copy0, 'bench.fcs'); o.open = Math.round(t() - t0);
    if (typeof parseBuffer === 'function'){
      const copy = bytes.buffer.slice(0); // (the file as read from disk)
      t0 = t(); const p = parseBuffer(copy); o.openBlocking = Math.round(t() - t0); await p; o.openWorker = Math.round(t() - t0);
    }
    const fl = s.ch.filter(c => /^F/.test(c.name)).map(c => c.name);
    state.comp.chs = fl; state.comp.S = {};
    fl.forEach((a, i) => { if (fl[i + 1]) state.comp.S[a + '|' + fl[i + 1]] = .12; if (fl[i - 1]) state.comp.S[a + '|' + fl[i - 1]] = .03; if (fl[i + 2]) state.comp.S[a + '|' + fl[i + 2]] = .01; });
    state.comp.on = true;
    // compensation, as far as the first plot needs it (two channels), then every channel
    t0 = t(); applyComp(s); s.cols[s.idx[fl[0]]]; s.cols[s.idx[fl[1]]]; o.compShown = Math.round(t() - t0);
    t0 = t(); for (let p = 0; p < s.ch.length; p++) s.cols[p]; o.compAll = Math.round(t() - t0);
    // 20 gates in 5 chains of 4: rectangles and pentagons on compensated biexponential axes
    state.samples.push(s); const keepGates = state.gates, keepCur = state.cur; state.cur = state.samples.length - 1;
    const gates = [];
    for (let c = 0; c < 5; c++) for (let d = 0; d < 4; d++){
      const id = 1000 + c * 4 + d, xch = fl[(c * 4 + d) % fl.length], ych = fl[(c * 4 + d + 1) % fl.length], lo = 100 + 300 * d;
      const pts = d % 2 ? [[lo, lo], [2e5, lo], [2e5, 2e5], [lo, 2e5]] : [[lo, lo], [2e5, lo], [2.2e5, 1e5], [2e5, 2e5], [lo, 2e5]];
      gates.push({ id, name: 'g' + id, parent: d ? id - 1 : null, type: 'poly', shape: pts.length === 4 ? 'rect' : 'poly', xch, ych, xs: 'asinh', ys: 'asinh', pts });
    }
    state.gates = gates;
    t0 = t(); computeMasks(s); o.gatesAll = Math.round(t() - t0);
    const counts = JSON.stringify([...s.counts]);
    const leaf = gates[3]; leaf.pts = leaf.pts.map(([x, y]) => [x * 1.1, y]);
    t0 = t(); computeMasks(s); o.gateLeaf = Math.round(t() - t0);
    const top = gates[0]; top.pts = top.pts.map(([x, y]) => [x * 1.1, y]);
    t0 = t(); computeMasks(s); o.gateTop = Math.round(t() - t0);
    o.gatesOk = s.counts.size === 21 && counts !== JSON.stringify([...s.counts]);
    for (const p of panels){ p.xn = fl[0]; p.yn = fl[1]; p.xs = p.ys = 'asinh'; p.pop = 'all'; p.draw(); }
    t0 = t(); panels.forEach(p => p.draw()); o.redraw = Math.round(t() - t0);
    const live = s.cols.filter((c, i) => Object.getOwnPropertyDescriptor(s.cols, i)?.value).length;
    o.memMB = Math.round((s.raw.length * 4 * N + live * 4 * N * (state.comp.on ? 1 : 0) + s.ucache.size * 4 * N + 21 * N) / 1e6);
    state.samples.pop(); state.gates = keepGates; state.cur = keepCur; state.comp.on = false; state.comp.S = {};
    return o;
  }, { P, N });
  rows.push(r);
  await page.close();
}
await browser.close();

const cols = [['P', 'Parameters'], ['fileMB', 'File MB'], ['open', 'Open (on page)'], ['openWorker', 'Open (worker)'], ['openBlocking', 'Page busy while opening'],
  ['compShown', 'Compensate: 2 plotted channels'], ['compAll', 'Compensate: all channels'], ['gatesAll', '20 gates from scratch'],
  ['gateLeaf', 'Move a gate (no gates inside)'], ['gateTop', 'Move a gate (3 inside)'], ['redraw', 'Redraw 2 plots']];
console.log(`\nSpectraFree benchmark: ${N.toLocaleString('en-GB')} events, ${path.relative(process.cwd(), target) || target}\n`);
console.log(cols.map(c => c[1]).join(' | '));
for (const r of rows) console.log(cols.map(c => r[c[0]] ?? '—').join(' | '));
// generous limits, to catch large regressions rather than machine differences
const at40 = rows.find(r => r.P === 40);
if (process.argv[2] === undefined && at40){
  const lim = { compShown: 1500, gateLeaf: 1500, redraw: 500 };
  for (const [k, v] of Object.entries(lim)) if (!(at40[k] <= v)){ console.log(`FAIL  ${k} at 40 parameters: ${at40[k]} ms (limit ${v} ms)`); failed++; }
  if (!rows.every(r => r.gatesOk)){ console.log('FAIL  gate counts did not update after moving gates'); failed++; }
}
console.log(failed ? `\n${failed} problem(s)` : '\nBenchmark finished');
process.exit(failed ? 1 : 0);
