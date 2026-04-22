# Changelog - 20260115-fix-scroll-diagnostics-v1.0.7

## [1.0.7] - 2026-01-15

### Fixed
- 強化 Promotion 圖片檢查的滾動邏輯，加入即時位置診斷日誌（Before/After Scroll）。
- 改用 `behavior: 'auto'` 進行強制滾動，避免平滑滾動被頁面渲染中斷。
- 統一 All Streamers 圖片檢查也加入自動滾動功能，確保元素可視。
- 增加滾動後的日誌輸出，標註元素在頁面上的具體座標 Y 值。

### Changed
- 修改 `scripts/steps/promotionImages.js`。
- 修改 `scripts/steps/allStreamersImages.js`。
- 更新 `public/config.js` 版本號至 1.0.7。
