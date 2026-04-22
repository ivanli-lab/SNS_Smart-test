# v1.0.0 (2026-01-09)

## 新增
- 解析度選擇功能
- 5 種裝置預設解析度（Desktop、iPad Pro、iPhone 14 Pro Max、iPhone 13、Samsung S21）
- 前端解析度下拉選單
- 後端接收 viewport 參數

## 修改
- Playwright 瀏覽器開啟尺寸改為可自訂
- `checkWebsite` 函數增加 viewport 參數
- POST /api/check 接收 viewport 參數

## 修復
- All Streamers 排序按鈕檢測失敗
- 排序按鈕改用 ID 選擇器（offline-list-btn、offline-grid-btn）
- 新增按鈕狀態檢測邏輯

## 重構
- 無
