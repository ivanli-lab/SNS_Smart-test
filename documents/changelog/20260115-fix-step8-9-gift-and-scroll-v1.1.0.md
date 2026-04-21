# Changelog - 20260115-fix-step8-9-gift-and-scroll-v1.1.0

## [1.1.0] - 2026-01-15

### Fixed
- 修正測試工具 1 第 8 點：將「頁面置頂」作為跳轉成功的判斷標準。
- 修正測試工具 1 第 9 點：完整實作送禮功能流程。
    - 精確定位送禮按鈕 `_giftButton_1upir_228`。
    - 自動點擊「跑車 (CAR)」禮物 `_giftImage_wr1vj_173`。
    - 增加 5 秒動畫等待時間。
    - 加入餘額 (Balance) 扣除檢查邏輯。
    - 實作關閉按鈕 `_closeButton_wr1vj_73` 的點擊。

### Changed
- 修改 `scripts/steps/streamerCardClick.js`。
- 修改 `scripts/steps/lobbyGift.js`。
- 更新 `documents/test-logic.md` 與 `documents/test-tool-1.md`。
- 更新 `public/config.js` 版本號至 1.1.0。
