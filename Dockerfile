# 使用 Playwright 官方鏡像
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

# 1. 安裝顯示環境工具
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
    xvfb \
    fluxbox \
    x11vnc \
    && rm -rf /var/lib/apt/lists/*

# 2. 【關鍵】設定工作目錄（這行會自動建立 /app 資料夾）
WORKDIR /app

# 3. 安裝 Node.js 套件
COPY package*.json ./
RUN npm install --only=production

# 4. 複製程式碼
COPY . .

# 5. 建立啟動腳本
# 注意：這裡我們改用相對路徑 entrypoint.sh，因為我們已經在 /app 目錄下了

RUN echo '#!/bin/bash\n\
Xvfb :99 -screen 0 1366x768x24 &\n\
sleep 2\n\
fluxbox &\n\
x11vnc -display :99 -forever -passwd 123456 -rfbport 5900 &\n\
export DISPLAY=:99\n\
npm start' > entrypoint.sh && chmod +x entrypoint.sh

# 6. 開放埠口
EXPOSE 3000 5900

# 執行腳本
CMD ["./entrypoint.sh"]
