# Changelog - 20260115-integrate-test-tool-2-v1.0.8

## [1.0.8] - 2026-01-15

### Added
- 完整實作「測試工具 2 (Stream n'Spin & Bet Control)」。
- 新增 `routes/check2.js` 核心邏輯：
    - 支援 `Streaming Now` 區域 LIVE 卡片點擊。
    - 實作 Playwright 跨視窗 (New Page) 追蹤與控制。
    - 實作直播間內新手教學 (START PLAYING) 自動關閉。
    - 實作 Bet Control 投注控制區測試 (MAX/MIN/加減注)。
    - 實作連續 28 次投注金額變化驗證。
- 新增 `public/test2.html` 專屬前端介面。

### Changed
- 根據最新規範，移除工具 2 中所有截圖功能相關代碼。
- 優化瀏覽器生命週期管理：測試成功後保持開啟供人工檢查，失敗後 60 秒自動關閉。
- 更新 `public/config.js` 版本號至 1.0.8。
