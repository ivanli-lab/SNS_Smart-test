FROM mcr.microsoft.com/playwright:v1.48.2-jammy

# 1. 安裝顯示環境所需的工具
# xvfb: 虛擬顯示器 / fluxbox: 輕量視窗管理員 / x11vnc: 遠端桌面服務
RUN apt-get update && apt-get install -y \
    xvfb \
    fluxbox \
    x11vnc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. 安裝 Node.js 套件
COPY package*.json ./
RUN npm install --only=production

# 3. 複製所有程式碼
COPY . .

# 4. 建立自動啟動腳本 (entrypoint)
# 這個腳本會依序啟動：虛擬顯示器 -> 視窗管理員 -> VNC 服務 -> 你的測試程式
RUN echo '#!/bin/bash\n\
Xvfb :99 -screen 0 1366x768x24 &\n\
sleep 2\n\
fluxbox &\n\
x11vnc -display :99 -forever -nopw -rfbport 5900 &\n\
export DISPLAY=:99\n\
npm start' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# 5. 開放埠口：3000 (UI 介面) 與 5900 (VNC 畫面)
EXPOSE 3000 5900

# 執行腳本
CMD ["/app/entrypoint.sh"]
