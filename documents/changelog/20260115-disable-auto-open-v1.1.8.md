# Changelog - 20260115-disable-auto-open-v1.1.8

## [1.1.8] - 2026-01-15

### Changed
- 禁用自動開啟瀏覽器功能：
    - 將 `server.js` 中的 `AUTO_OPEN_BROWSER` 預設值改為 `false`。
    - 修改 `.vscode/launch.json`，移除 `postDebugTask` 並將環境變數設為 `false`。
    - 確保在開發過程中伺服器重啟時不會一直彈出新視窗。
- 遵循使用者指令：僅在修改完成並同步到 Git 後才手動開啟測試工具介面。

### Fixed
- 解決了開發過程中瀏覽器頻繁開啟的問題。
