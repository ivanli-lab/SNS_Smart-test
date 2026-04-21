# Changelog - 20260115-fix-step4-ids-v1.1.4

## [1.1.4] - 2026-01-15

### Fixed
- 修正測試工具 1 第 4 點：更新按鈕 ID 為 `streaming-list-btn` 與 `streaming-grid-btn`。
    - 調整了定位邏輯以符合 Streaming Now 區域的按鈕設計。
    - 強化了成功判定：只要外觀佈局 (Layout) 狀態有變化即視為通過。
    - 更新了相關文件說明。

### Changed
- 修改 `scripts/steps/sortButton.js`。
- 更新 `documents/test-logic.md` 與 `documents/test-tool-1.md`。
- 更新 `public/config.js` 版本號至 1.1.4。
