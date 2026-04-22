# Changelog - 20260115-fix-default-resolution-and-step10-scroll-v1.1.6

## [1.1.6] - 2026-01-15

### Fixed
- 修正測試工具 1 第 10 點：在進行排行榜檢查前，加入自動滾動至 `Weekly Ranking` (`h3._rankingTitle_1upir_274`) 的邏輯。
- 更新預設測試解析度為 **Desktop (1366x768)**。

### Changed
- 修改 `public/config.js` 將 Desktop 設為預設並移動到首位。
- 修改 `scripts/steps/rankingData.js` 實作滾動邏輯。
- 更新 `documents/test-logic.md` 與 `documents/test-tool-1.md`。
- 更新 `public/config.js` 版本號至 1.1.6。
