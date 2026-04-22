# SNS Stream 技術文件索引

## 文件總覽
本目錄包含 SNS Stream 專案的完整技術文件，涵蓋系統架構、程式流程、測試邏輯與開發規範。

## 文件列表

### 1. [architecture.md](./architecture.md) - 系統架構文件
說明系統的整體架構設計、技術選型和各層次的職責劃分。

### 2. [code-structure.md](./code-structure.md) - 程式碼結構文件
詳細說明專案的程式碼組織方式、檔案職責和模組關係。

### 3. [flow.md](./flow.md) - 程式流程文件
記錄系統各功能的執行流程，包括測試流程、API 請求流程等。

### 4. [test-logic.md](./test-logic.md) - 測試邏輯總表
彙整三款測試工具的核心邏輯、項目統計與技術標準。

### 5. [lobby-test.md](./lobby-test.md) - Lobby 測試說明文件
詳細說明 Lobby (測試工具 1) 的 13 項測試細節與 UI 穩定化技術。

### 6. [live-slot-test.md](./live-slot-test.md) - Live Slot 測試規範
詳細說明 Live Slot (測試工具 2) 的 18 項測試細節與 19 位單號精準對帳邏輯。

### 7. [sac-test-logic.md](./sac-test-logic.md) - SAC 後台測試規範
專為 SAC 後台 (測試工具 3) 與遊戲座標點擊設計的規範文件。

### 8. [deployment.md](./deployment.md) - Docker 部署教學
完整的 Docker 部署流程，包含 Build 打包、環境變數設定與問題排除。

### 9. [dev-workflow.md](./dev-workflow.md) - 開發規章文件
定義開發時需要遵守的規則和工作流程。

## 文件閱讀建議

1. **新手入門**：閱讀 `architecture.md` 與 `code-structure.md` 了解全貌。
2. **測試維護**：根據工具類型閱讀 `lobby-test.md`、`live-slot-test.md` 或 `sac-test-logic.md`。
3. **部署上線**：閱讀 `deployment.md` 進行環境建置。

---

**最後更新**：2026-03-06
