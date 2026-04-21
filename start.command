cat <<EOF > start.command
#!/bin/bash
cd "\$(dirname "\$0")"
echo "========================================"
echo "   SNS 測試工具啟動中..."
echo "========================================"
if [ ! -d "node_modules" ]; then
    echo "偵測到尚未安裝環境，正在進行初始化安裝..."
    npm install
    npx playwright install chromium
fi
echo "正在啟動伺服器..."
node server.js
EOF
