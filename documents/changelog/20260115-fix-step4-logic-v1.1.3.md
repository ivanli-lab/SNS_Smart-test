# Changelog - 20260115-fix-step4-logic-v1.1.3

## [1.1.3] - 2026-01-15

### Fixed
- 修正測試工具 1 第 4 點：將原本基於「位置與內容變化」的舊邏輯，更新為與第 7 點一致的「ID 定位與狀態檢查」邏輯。
    - 使用 `offline-list-btn` 與 `offline-grid-btn` 作為定位標記。
    - 透過檢查 `data-is-active` 屬性來判斷按鈕是否有效。
    - 統一了兩個排序測試項目的技術實現方式，提高測試穩定性。

### Changed
- 修改 `scripts/steps/sortButton.js`。
- 更新 `documents/test-logic.md` 與 `documents/test-tool-1.md`。
- 更新 `public/config.js` 版本號至 1.1.3。
