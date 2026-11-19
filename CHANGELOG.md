# Changelog

All notable changes to SpectraFree are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [semantic versioning](https://semver.org/).

## [1.0.0] - 2026-11-19

First public release.

### Added
- FCS 2.0 / 3.0 / 3.1 reader (list mode; integer, float and double data; `$PnE`, `$PnG`, `$PnR` masking; `$SPILLOVER`).
- Density dot plots and histograms on Linear, Log and Biexponential (arcsinh) axes.
- Up to 8 plots, added and removed from the page; right-click axis titles to change channel and scale.
- Rectangle, polygon and range gates, nested to any depth, applied across samples by channel name.
- Gate resize handles, polygon corner editing, and open-ended edges for gates drawn on a plot border.
- Population statistics (events, % of parent, % of total, median, mean, CV), copied as tab-separated text.
- Compensation: editable spillover matrix, calculation from single-stain controls, and one-click **Auto-compensate** with automatic tube detection and debris exclusion.
- Cell-cycle auto-gating: singlet gating on DNA area against height, Dean-Jett-Fox-style histogram fit, Sub-G1 / G0/G1 / S / G2/M / >4N results, quality checks and a sample comparison table.
- Undo and Redo for gates, plots, compensation and cell-cycle gating.
- Synthetic training data: a stained sample, unstained and four single-stain controls, and two PI cell-cycle tubes.
- Light and dark themes, phone layout, and the SpectraFree logo.
- Automated browser checks (`npm test`).
