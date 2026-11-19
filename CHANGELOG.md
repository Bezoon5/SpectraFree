# Changelog

All notable changes to SpectraFree are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [semantic versioning](https://semver.org/).

## [1.2.0] - 2026-11-19

### Added
- Channel names: give any channel your own label (for example FL1-A → CD45 RB545) from the axis menu or the new Channel names table. Labels appear on axes, menus, tables, quadrant names and exports; gates still match by channel. Undoable.
- Export menu: population statistics for all samples (CSV, with every channel's median), cell-cycle results (CSV), the events in a gate as FCS 3.1 or CSV, all plots as one PNG.
- Workspaces: save gates, plots, channel names, compensation and cell-cycle set-up to JSON and open them again. Workspace files are validated before use.
- Right-click a plot to copy it as a high-resolution PNG (white background, caption) for Word, PowerPoint or Excel, or to save it as PNG; a fallback window appears when the browser blocks copying images.
- In the claude.ai viewer, files are saved through the viewer's download prompt; FCS exports are wrapped in a ZIP there because the viewer does not save `.fcs` files directly.

## [1.1.0] - 2026-11-19

### Added
- Quadrant gates: one click creates four linked gates (Q1–Q4) named from the dye or channel; move the centre, either line, or the whole cross; delete and undo as one.
- Warning when an FCS file holds more than one data set (the first is shown).
- Plot descriptions for screen readers (channels, population and event count).

### Changed
- Biexponential axes size their linear zone from the data (spread below zero) instead of from the channel range, so compensated Accuri-range data spreads out instead of collapsing at zero.
- Plot controls: "Show events in" has its own row, so channel and scale pickers have room for full names.

### Performance
- Population medians use selection instead of a full sort: the population table is about 7× faster on 1 million events (138 → 20 ms), and a full refresh about 3× faster (184 → 55 ms).
- Channel statistics use a native numeric sort: opening a 1-million-event, 10-channel file is about a third faster (≈155 → ≈100 ms of processing).
- Theme colours and fonts are cached instead of being read for every axis label: plot redraws are about 2× faster.
- Cell-cycle fits are cached per sample until gates, compensation or the set-up change: refreshing with cell cycle on is about 4× faster (37 → 9 ms) and switching samples about 2× faster.
- The off-screen density canvas and its pixel buffer are reused between redraws.

### Fixed
- Switching a plot from Histogram back to Dot plot could crash the overlay when a quadrant was on that plot.

### Removed
- The old name-only control-tube matcher, superseded by Auto-compensate's detection; three duplicated population pickers merged into one helper.

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
