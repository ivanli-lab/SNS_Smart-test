# SNS Stream - 程式碼結構文件

## 檔案組織架構

```
stream-lobby/
├── routes/                # 業務邏輯層 (API 路由與流程調度)
│   ├── check.js           # Lobby 主流程
│   ├── check2.js          # Live Slot 主流程
│   └── check3.js          # SAC 後台主流程
├── scripts/               # 工具腳本層 (模組化測試步驟)
│   ├── steps/             # Lobby 步驟模組
│   ├── steps2/            # Live Slot 步驟模組
│   └── steps3/            # SAC 後台步驟模組
├── public/                # 前端展示層 (UI 介面與主題)
│   ├── index.html         # Lobby UI
│   ├── test2.html         # Live Slot UI
│   ├── sac.html           # SAC UI
│   └── theme.css          # 視覺主題
├── logs/                  # 運行時產出 (日誌檔案)
└── documents/             # 文件層 (技術與測試規範)
```

## 核心設計原則

1.  **高度模組化**：所有測試工具均採用 `routes` + `steps` 的架構，確保程式碼整潔。
2.  **狀態同步**：透過 `/api/progress` 端點實現前後端實時進度同步。
3.  **環境隔離**：每個工具使用獨立的 `user_data` 目錄，防止瀏覽器快取干擾。
