# Docker 部署教學

## 1. 前置需求

### 本機（開發機）
- 已安裝 Node.js 與 npm
- 專案原始碼（`stream-lobby/` 目錄）

### 目標機器（部署機）
- 已安裝 Docker Engine
- 已安裝 Docker Compose（Docker Desktop 內建，或獨立安裝 `docker-compose-plugin`）
- 開放 port 80（HTTP）

## 2. Build 打包

在開發機上執行 build 工具，將專案打包成可部署的目錄：

```bash
cd dockerBuild
./build.sh
```

執行後會產生 `dockerBuild/dist/` 目錄，內容包含：

```
dist/
├── Dockerfile            # Docker 映像建置檔
├── docker-compose.yml    # Docker Compose 部署設定
├── .env                  # 環境變數（從 .env.example 複製）
├── server.js             # Express 伺服器
├── package.json          # npm 依賴定義
├── package-lock.json     # npm 依賴鎖定
├── routes/               # API 路由（check.js, check2.js, check3.js）
├── scripts/              # 測試步驟模組（steps/, steps2/, steps3/）
├── public/               # 前端靜態檔案（HTML, CSS, JS）
└── logs/                 # 日誌目錄（空）
```

## 3. 部署步驟

### 3.1 傳送到目標機器

將 `dist/` 目錄傳送到目標機器，例如：

```bash
# 壓縮
tar czf dist.tar.gz -C dockerBuild dist

# 傳送（依實際情況替換 IP 與路徑）
scp dist.tar.gz user@目標機器IP:/home/user/

# 在目標機器上解壓
ssh user@目標機器IP
tar xzf dist.tar.gz
cd dist
```

### 3.2 啟動服務

```bash
cd dist
docker compose up -d
```

首次執行會自動建置 Docker 映像（約需 2-5 分鐘），完成後服務即啟動。

### 3.3 驗證

在任意電腦的瀏覽器打開：

```
http://目標機器IP
```

可使用的頁面：

| 頁面 | 路徑 |
|------|------|
| Lobby 測試 | `http://目標機器IP/` |
| Live Slot 測試 | `http://目標機器IP/test2.html` |
| SAC 測試 | `http://目標機器IP/sac.html` |

## 4. 環境變數設定

部署目錄中的 `.env` 檔案可調整以下設定：

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | `3000` | 容器內 Express 監聽的 port（對外 port 由 docker-compose.yml 控制） |
| `HEADLESS` | `true` | Playwright 是否以 headless 模式執行（部署環境應為 `true`） |
| `TIMEOUT` | `30000` | 測試逾時時間（毫秒） |
| `MAX_RETRIES` | `3` | 測試最大重試次數 |
| `LOG_LEVEL` | `info` | 日誌等級 |

## 5. docker-compose.yml 說明

```yaml
services:
  stream-lobby:
    build: .
    ports:
      - "80:3000"
    ipc: host
    init: true
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
```

| 設定 | 說明 |
|------|------|
| `build: .` | 使用同目錄的 Dockerfile 建置映像 |
| `ports: "80:3000"` | 主機 port 80 對應容器內 port 3000 |
| `ipc: host` | Playwright 官方建議，避免 Chromium 記憶體不足 |
| `init: true` | 加入 init process，避免 zombie process |
| `restart: unless-stopped` | 非手動停止時自動重啟（包含機器重開機） |
| `volumes: ./logs:/app/logs` | 將容器內日誌掛載到主機，方便查看 |

## 6. 日誌查看

日誌檔案透過 volume 掛載在部署目錄的 `logs/` 下：

```bash
# 列出所有日誌
ls logs/

# 即時追蹤最新日誌
tail -f logs/server-*.log

# 查看特定日誌
cat logs/server-2026-03-02T06-44-32-648Z.log
```

每次伺服器啟動會產生一個新的日誌檔，檔名包含時間戳記。

## 7. 常用操作

```bash
# 啟動服務（背景執行）
docker compose up -d

# 停止服務
docker compose down

# 重啟服務
docker compose restart

# 重建映像並啟動（程式碼更新後使用）
docker compose up -d --build

# 查看服務狀態
docker compose ps

# 即時查看容器輸出
docker compose logs -f
```

## 8. 更新部署

當專案程式碼更新後：

```bash
# 1. 在開發機重新打包
cd dockerBuild
./build.sh

# 2. 傳送新的 dist/ 到目標機器
tar czf dist.tar.gz -C dockerBuild dist
scp dist.tar.gz user@目標機器IP:/home/user/

# 3. 在目標機器上解壓並重建
ssh user@目標機器IP
tar xzf dist.tar.gz
cd dist
docker compose up -d --build
```

## 9. 常見問題

### Chromium 啟動失敗 / Server error: 500

docker-compose.yml 中已設定 `ipc: host`，若仍有問題：
- 確認 Docker 版本支援 `ipc` 設定
- 嘗試手動執行：`docker run --rm --ipc=host stream-lobby node -e "require('playwright').chromium.launch().then(b=>b.close()).then(()=>console.log('OK'))"`

### Port 80 被佔用

修改 `docker-compose.yml` 的 ports 設定：

```yaml
ports:
  - "8080:3000"   # 改為其他 port
```

### 連不上服務

1. 確認 Docker 正在執行：`docker compose ps`
2. 確認防火牆開放 port 80：`sudo ufw allow 80`（Ubuntu）
3. 確認容器日誌無錯誤：`docker compose logs`

### 映像建置太慢

首次建置需下載 Ubuntu、Node.js、Playwright 與 Chromium，約 1-2 GB，後續重建會使用快取，速度較快。
