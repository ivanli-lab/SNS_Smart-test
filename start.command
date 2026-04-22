#!/bin/bash
cd "$(dirname "$0")"

echo "========================================"
echo "   SNS 測試工具啟動中..."
echo "========================================"

# 檢查環境
if [ ! -d "node_modules" ]; then
    echo "偵測到尚未安裝環境，正在進行初始化安裝..."
    npm install
    npx playwright install chromium
fi

# 自動開啟瀏覽器到工具頁面
echo "正在開啟測試網頁..."
open "http://localhost:3000"

# 啟動伺服器
echo "正在啟動伺服器..."
npm run dev
