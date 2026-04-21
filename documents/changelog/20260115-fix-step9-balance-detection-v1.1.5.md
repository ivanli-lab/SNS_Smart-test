# Changelog - 20260115-fix-step9-balance-detection-v1.1.5

## [1.1.5] - 2026-01-15

### Fixed
- 修正測試工具 1 第 9 點：大幅優化餘額 (Balance) 的偵測與提取邏輯。
    - 解決了原本會誤抓頁面上其他大型數字（如 ID 或時間戳）導致金額異常增加的問題。
    - 新增了基於正則表達式的「關鍵字 + 數字」匹配策略。
    - 優先尋找帶有 `balance` 類名的純數字元素。
    - 加入了數值過濾，避免將不合理的極大值視為餘額。

### Changed
- 修改 `scripts/steps/lobbyGift.js`。
- 更新 `public/config.js` 版本號至 1.1.5。
