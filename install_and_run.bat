@echo off
echo 正在安裝必要環境...
npm install
npx playwright install chromium
echo 環境準備就緒，啟動程式...
node server.js
pause
