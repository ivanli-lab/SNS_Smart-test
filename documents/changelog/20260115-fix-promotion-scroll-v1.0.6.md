# Changelog - 20260115-fix-promotion-scroll-v1.0.6

## [1.0.6] - 2026-01-15

### Fixed
- 優化 Promotion 圖片檢查的滾動邏輯，解決無法正確滾動到指定位置的問題。
- 使用 Playwright 原生定位器（Locator）與 `scrollIntoViewIfNeeded` 提高元素尋找的穩定性。
- 增加滾動後的等待時間至 2 秒，確保頁面加載完整。

### Changed
- 修正 `scripts/steps/promotionImages.js` 中的滾動實作。
- 更新 `public/config.js` 版本號至 1.0.6。
