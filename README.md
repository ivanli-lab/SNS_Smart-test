# SNS Stream - 網頁自動化測試工具

> 基於 Playwright 的 SNS Stream 功能驗證工具

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.18.0-brightgreen)
![Playwright](https://img.shields.io/badge/Playwright-1.48.2-blue)
![License](https://img.shields.io/badge/License-ISC-yellow)

## 📖 目錄

- [專案簡介](#專案簡介)
- [功能特色](#功能特色)
- [系統需求](#系統需求)
- [快速開始](#快速開始)
  - [安裝](#安裝)
  - [設定](#設定)
  - [執行](#執行)
- [專案目錄結構](#專案目錄結構)
- [使用說明](#使用說明)
- [Lobby](#lobby-13-項測試)
- [Live Slot](#live-slot-16-項測試)
- [SAC 後台](#sac-後台-7-項測試)
- [查看日誌](#查看日誌)
- [API 文件](#api-文件)
- [技術文件](#技術文件)
- [npm Scripts](#npm-scripts)
- [開發指南](#開發指南)
- [授權](#授權)

---

## 專案簡介

SNS Stream 是一個專為 **直播大廳系統** 設計的自動化測試工具，使用 Playwright 模擬真實用戶操作，自動執行功能驗證並生成詳細的測試報告。

### 專案定位

- **類型**：自動化測試工具 / QA 輔助系統
- **目標**：SNS Stream 功能驗證、回歸測試、視覺化驗證
- **特點**：高度模組化、Web-based 操作界面、即時進度反饋、執行紀錄追蹤

---

## 功能特色

### 🧪 三工具設計

- **Lobby**：13 項核心功能測試
- **Live Slot**：16 項進階功能測試
- **SAC 後台**：7 項後台與遊戲壓力測試 (AutoSpin)
- 提供全方位的系統驗證與壓力測試能力

### 📊 即時進度與紀錄

- **實時狀態**：前端輪詢機制，動態顯示 ✅/❌/⏳ 狀態。
- **測試完成統計**：測試結束後自動顯示 `測試完成: X 通過 / Y 失敗`。
- **執行紀錄 (Run History)**：自動記錄每次測試的時間、結果與網址，便於快速比對。

### 🏗️ 高度模組化架構

- 所有測試步驟均已拆分為獨立模組（`steps/`, `steps2/`, `steps3/`）。
- 易於維護、擴展與單獨偵錯。

---

## 系統需求

### 必要條件

- **Node.js**：>= 18.18.0
- **npm**：>= 9.0.0
- **作業系統**：macOS / Linux / Windows
- **瀏覽器**：Chromium（由 Playwright 自動安裝）

---

## 快速開始

### 安裝

```bash
git clone <repository-url>
cd sns-smart-test/stream-lobby
npm install
npm run setup
```

### 設定

建立 `.env` 檔案並設定 `PORT` 等參數。

### 執行

```bash
# 開發模式（自動重啟）
npm run dev

# 生產模式
npm start
```

---

## 專案目錄結構

```
stream-lobby/
├── routes/                # API 路由控管 (check.js, check2.js, check3.js)
├── scripts/
│   ├── steps/             # Lobby 測試步驟模組
│   ├── steps2/            # Live Slot 測試步驟模組
│   └── steps3/            # SAC 後台測試步驟模組
├── public/                # 前端介面 (index.html, test2.html, sac.html)
├── logs/                  # 測試日誌
└── documents/             # 詳細技術文件
```

---

## 使用說明

### Lobby / Live Slot / SAC 後台

1. **訪問界面**：
   - Lobby: `http://localhost:3000/`
   - Live Slot: `http://localhost:3000/test2.html`
   - SAC 後台: `http://localhost:3000/sac.html`
2. **操作步驟**：輸入網址，選擇遊戲（僅 SAC），點擊「🚀 開始測試」。
3. **觀察結果**：
   - 每項測項成功後會顯示 `✓` 與詳細資訊。
   - 測試完成後會顯示最終統計。
   - 右下角 `Run History` 會自動新增一筆紀錄。

---

## 技術文件

完整的技術文件位於 `documents/` 目錄：

- 📐 [系統架構文件](documents/architecture.md)
- 🧪 [Lobby 測試邏輯](documents/lobby-test.md)
- 🎰 [Live Slot 測試邏輯](documents/live-slot-test.md)
- 🛡️ [SAC 後台測試邏輯](documents/sac-test-logic.md)
- 📦 [模組化重構文件](documents/module-refactoring.md)

---

## 授權

本專案採用 ISC 授權條款。

<p align="center">
  <strong>🎬 SNS Stream</strong><br>
  讓自動化測試變得簡單
</p>
