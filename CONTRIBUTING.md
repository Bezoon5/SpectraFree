# Contributing to SpectraFree

Thanks for helping. SpectraFree is small on purpose: one HTML file that anyone can open, read and change. Contributions that keep it that way are the easiest to accept.

## Ways to help

- **Compare with real data.** The most valuable contribution right now. Analyse the same FCS files in SpectraFree and in FlowJo, FCS Express, ModFit or your instrument's software. Open an issue with the event counts, gate percentages, compensation values or cell-cycle results side by side. Please share files only if you are allowed to.
- **Report a file that will not open.** Include the error message, the cytometer model and software version, and if possible the file's keywords (the **File keywords** section; remove anything identifying).
- **Fix bugs or add features.** See the limitations in the README for ideas: per-tube compensation, t-SNE/UMAP, selectable text in PDF reports.

## Running it

There is nothing to build. Open `index.html` in a browser. Edit it, then reload.

## Running the tests

The tests drive the app in headless Chromium with [Playwright](https://playwright.dev/).

```bash
npm install
npx playwright install chromium
npm test
```

`tests/smoke.mjs` checks:
- file reading (float, 16-bit integer, log-amplified, FCS 2.0, escaped delimiters, rejection of bad files);
- gate counts on the example data;
- Auto-compensate's matrix against the spillover built into the example data, including detection with meaningless file names;
- cell-cycle fit accuracy on both cell-cycle tubes;
- adding and removing plots, and Undo / Redo;
- zoom, overlays, backgating, plot styles, auto-gates, absolute counts, reports, the gate tree, shortcuts and tabs;
- no JavaScript errors.

Please run them before opening a pull request, and add a check for anything you fix or add.

## How the code is organised

Everything is in `index.html`, in this order:

| Section (search for the comment) | What it holds |
|---|---|
| `<style>` | Design tokens (light and dark), then component styles |
| `FCS parsing` | `parseFCS`, `parseText`, `parseSpill`, `chStats` |
| `Scales` | `makeScale` (lin / log / asinh), ticks, number formatting |
| `State` | `state`, gate masks (`gateMask`, `computeMasks`) |
| `Colours` | Theme tokens, `palette()`, greyscale table, overlay colours, `contourSegs` (marching squares), `smoothGrid` |
| `Plot panel` | `class Panel`: drawing (density / contour / dots / grey, overlays, backgating, legend), zoom (`setRange`, `zoomScale`), axes, gates, quadrants, handles, pointer handling |
| `Axis menu` | Right-click channel / scale menu |
| `Undo / redo` | Snapshots of gates, compensation, cell-cycle set-up and plots |
| `Page rendering` | `refresh`, `setCurrent`, population table (`statsFor`, `kth` selection for medians) |
| `Absolute counts` / `Auto-gates` | `sampleVol`, `setVolume`; `autoGateCells` (densest connected cluster → convex hull), `autoGateSinglets` |
| `Compensation` | `applyComp`, `calcFromControls`, `autoCellMask`, `detectControls` |
| `Cell cycle` | `fitCellCycle`, `singletWedge`, `runCellCycle`, results |
| `Example data` | `writeFCS`, `makeTube`, `makeCellCycleTube` (synthetic tubes, seeded) |
| `Channel names` | `setLabel`, the Channel names table, the rename form in the axis menu |
| `Files out` / `Exports` | `saveFile` (viewer downloads or browser download), `makeZip`, `buildFCS`, CSV helpers, statistics / events / cell-cycle exports |
| `Plot pictures` | `renderPanelImage` (high-resolution light-theme render), copy to clipboard, PNG export |
| `Batch reports` | `composeReportPage`, `buildPDF` (minimal PDF 1.4 with JPEG pages), `buildPPTX` (minimal PresentationML package via `makeZip`) |
| `Workspace` | `workspaceObject`, `cleanWorkspace` (validates untrusted files), `openWorkspace` |
| `Export and plot menus` | `openMenu`, the Export menu, the right-click plot menu |
| `Plot management` | Adding and removing plots |
| `Sidebar` / `Tabs` / `Theme` / `Keyboard shortcuts` / `Autosave` | Sample list, gate tree, active plot (`ui`, `activePanel`), tab switching, theme button, tool keys, `scheduleAutosave` / `offerRestore` |
| `Start` | Example gates and start-up |

A few conventions:
- **Per-plot view settings** (`PANEL_VIEW`: population, channels, scales, zoom ranges, style, backgate, overlays) go through `panelView()` for undo and workspaces. Add new view settings there and in `cleanWorkspace`.
- **Masks for samples that are not on screen** come from `masksFor(s)`, which recomputes only when gates or compensation changed.
- **Browser storage** goes through `store` (wrapped in try/catch); it only holds conveniences (tab, theme, autosave).
- **Gates live in data coordinates** (`g.pts`) together with the scale types they were drawn on (`g.xs`, `g.ys`). Membership is tested in that display space. `±EDGE` (1e30) means "this edge is open-ended".
- **Quadrants are four ordinary polygon gates** with `shape: 'quad'`, a shared `quad.group`, their position `quad.q` (1–4) and the centre `qc`. Always move them with `setQuadCentre()` so the four stay linked.
- **Theme tokens are cached** (`tok()`, `palette()`); call `themeChanged()` (or `redraw()`) after changing CSS variables.
- **Raw data stays in `s.raw`**; `s.cols` holds compensated values when compensation is on. Calculations of spillover always use `s.raw`.
- **Anything that changes the analysis should end in `refresh()`**, which also records an Undo step. Changes that do not refresh call `markChange()` themselves.
- **No external libraries and no network access** beyond Google Fonts. Keep it working offline.
- **Colours come from CSS tokens** so both themes work; canvas drawing reads them with `tok('--name')`.

## Pull requests

- Keep each pull request to one change, with a short description of what and why.
- Include before / after screenshots for visual changes.
- Note any change to numerical results, and why it is more correct.
- By contributing, you agree that your contribution is licensed under the GNU GPL v3.0 or later, the same as the project.

## Code of conduct

Be kind and assume good intent. Many users are students and new to cytometry: questions are welcome.
