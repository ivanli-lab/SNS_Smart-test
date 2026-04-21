# Changelog - 20260115-fix-step10-11-scroll-photo-v1.1.7

## [1.1.7] - 2026-01-15

### Fixed
- 修正測試工具 1 第 10 點：調整排行榜滾動位置，將標題上移 100px 以確保在 Desktop 解析度下有更好的可見性。
- 修正測試工具 1 第 11 點：重新實作直播主照片流程。
    - 加入「Photo」頁籤的點擊。
    - 實作點擊照片開啟大圖的功能。
    - 新增 5 秒展示時間後自動關閉（嘗試關閉按鈕或 ESC 鍵）。
    - 流程結束後自動執行頁面置頂。

### Changed
- 修改 `scripts/steps/rankingData.js` 優化滾動位移。
- 修改 `scripts/steps/streamerPhoto.js` 實現完整互動流程。
- 更新 `documents/test-logic.md` 與 `documents/test-tool-1.md`。
- 更新 `public/config.js` 版本號至 1.1.7。
