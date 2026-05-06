# SNS Smart Test - Docker 部署與測試指南

本文件詳細說明如何使用 Docker 進行本地測試以及將專案部署至正式環境。

---

## 1. 前置需求

- 已安裝 **Docker Engine** 與 **Docker Compose**。
- 如果需要查看自動化測試過程，請準備 **VNC 客戶端** (如 RealVNC 或 macOS 內建的螢幕共享)。

---

## 2. 本地 Docker 測試 (Local Testing)

如果您想在開發環境中驗證 Docker 映像檔是否運作正常：

### 2.1 建置映像檔
在專案根目錄執行：
```bash
docker build -t sns-smart-test .
```

### 2.2 啟動容器
啟動時請務必關閉 `AUTO_OPEN_BROWSER`，並映射 VNC 埠號：
```bash
docker run -d \
  -p 3000:3000 \
  -p 5900:5900 \
  -e AUTO_OPEN_BROWSER=false \
  --name sns-test-run \
  sns-smart-test
```

### 2.3 驗證與存取
- **網頁工具介面**：開啟瀏覽器訪問 `http://localhost:3000`
- **遠端查看測試 (VNC)**：
  - 連線位址：`localhost:5900`
  - 連線密碼：`123456`
  - *說明：透過 VNC 可以即時看到 Playwright 在虛擬顯示器中操作瀏覽器的畫面。*

---

## 3. 使用現有映像檔 (.tar)

如果已有導出的映像檔（如 `stream-lobby.tar`），可直接載入：

```bash
# 1. 載入映像檔
docker load -i stream-lobby.tar

# 2. 確認載入後的映像檔名稱
docker images

# 3. 按照 2.2 的方式啟動容器（請將映像檔名稱換成載入後的名稱）
```

---

## 4. 正式環境部署 (Formal Deployment)

正式環境建議使用 `docker-compose.yml` 進行管理。

### 4.1 準備 docker-compose.yml
在伺服器上建立以下內容的檔案：

```yaml
services:
  sns-test-tool:
    build: .
    image: sns-smart-test:latest
    ports:
      - "80:3000"   # 將主機 80 port 對應到容器內 3000
    environment:
      - AUTO_OPEN_BROWSER=false
      - PORT=3000
      - NODE_ENV=production
    ipc: host       # 解決 Playwright/Chromium 記憶體不足問題
    restart: always # 確保自動重啟
    volumes:
      - ./logs:/app/logs # 將容器日誌保存至主機
```

### 4.2 部署操作
```bash
# 啟動服務 (背景執行)
docker compose up -d

# 查看服務狀態
docker compose ps

# 查看日誌輸出
docker compose logs -f
```

---

## 5. 常用維護指令

| 指令 | 說明 |
|------|------|
| `docker compose pull` | 拉取最新映像檔 |
| `docker compose restart` | 重啟所有服務 |
| `docker compose down` | 停止並移除容器 |
| `docker exec -it sns-test-run bash` | 進入容器內部終端機 |
| `docker system prune -f` | 清理未使用的 Docker 資源 (節省空間) |

---

## 6. 常見問題排除 (FAQ)

- **Q: 為什麼測試一直失敗？**
  - A: 請確認容器內的 `HEADLESS` 是否設為 `true`，或確認 VNC 是否正常運行供偵錯。
- **Q: 埠號被佔用怎麼辦？**
  - A: 修改 `docker-compose.yml` 中的 `ports` 設定，例如將 `"80:3000"` 改為 `"8080:3000"`。
- **Q: 如何更新程式碼？**
  - A: 更新原始碼後，執行 `docker compose up -d --build` 重新編譯。

---
*更新日期：2026-05-04*
