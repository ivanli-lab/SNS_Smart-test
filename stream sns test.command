@echo off
echo 正在啟動測試工具...
:: 檢查是否安裝了 node_modules，沒安裝就自動安裝
if not exist "node_modules" (
    echo 偵測到尚未安裝套件，正在進行初始化 (僅限第一次)...
    call npm install
    call npx playwright install chromium
)
:: 執行工具
npm start
pause
