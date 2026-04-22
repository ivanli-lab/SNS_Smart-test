// 載入環境變數
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { initInteraction } = require('./utils/interaction');
const { checkWebsite, getProgress, setCurrentStep, resetProgress } = require('./routes/check');
const { 
  checkWebsite: checkWebsite2, 
  getProgress: getProgress2, 
  setCurrentStep: setCurrentStep2,
  resetProgress: resetProgress2
} = require('./routes/check2');
const { 
  checkWebsite: checkWebsite3, 
  getProgress: getProgress3, 
  setCurrentStep: setCurrentStep3,
  resetProgress: resetProgress3,
  getGameList: getGameList3
} = require('./routes/check3');
const { 
  checkWebsite2: checkWebsite4, 
  getProgress2: getProgress4, 
  setCurrentStep2: setCurrentStep4 
} = require('./routes/check_nickname.js');

const app = express();
const PORT = process.env.PORT || 3000;
// 預設關閉自動開啟，除非環境變數明確要求 (通常由 F5 啟動時帶入)
const AUTO_OPEN_BROWSER = (process.env.AUTO_OPEN_BROWSER || 'true').toLowerCase() === 'true';

function openBrowser(url) {
  // 只有當明確啟用時才執行
  if (!AUTO_OPEN_BROWSER) return;
  
  if (process.platform === 'win32') {
    console.log(`[System] Opening browser: ${url}`);
    exec(`start "" "${url}"`, (err) => {
      if (err) exec(`powershell -Command "Start-Process '${url}'"`);
    });
    return;
  }
  if (process.platform === 'darwin') {
    exec(`open "${url}"`);
    return;
  }
  exec(`xdg-open "${url}"`);
}

/**
 * 🚀 強大功能：在 Mac 上自動關閉所有儀表板分頁
 */
function closeDashboardBrowsers() {
  if (process.platform !== 'darwin') return;

  const script = `
    try
      tell application "Google Chrome"
        repeat with w in windows
          repeat with t in tabs of w
            if URL of t contains "localhost:${PORT}" then close t
          end repeat
        end repeat
      end tell
    end try
    try
      tell application "Safari"
        repeat with w in windows
          repeat with t in tabs of w
            if URL of t contains "localhost:${PORT}" then close t
          end repeat
        end repeat
      end tell
    end try
  `;
  
  exec(`osascript -e '${script.replace(/\n/g, ' ')}'`);
}

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a log file with timestamp
const logFile = path.join(logsDir, `server-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

// Override console.log to also write to file
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
  originalLog(...args);
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`, 'utf8');
};

console.error = (...args) => {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
  originalError(...args);
  fs.appendFileSync(logFile, `[${timestamp}] ERROR: ${message}\n`, 'utf8');
};

console.log(`📝 日誌文件已創建: ${logFile}`);

app.use(express.json());
app.use(express.static('public'));
// 🚀 核心修正：開放 documents 目錄的靜態存取，讓前端能讀取測試說明文件
app.use('/documents', express.static(path.join(__dirname, 'documents')));

// API endpoint for checking website (Test Tool 1)
app.post('/api/check', async (req, res) => {
  try {
    const { url, viewport } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    // 立即重置進度，確保前端輪詢不會抓到舊資料
    if (typeof resetProgress === 'function') {
      resetProgress();
    } else {
      setCurrentStep(null);
    }
    const results = await checkWebsite(url, viewport);
    res.json(results);
  } catch (error) {
    console.error('Error checking website:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      details: error.stack
    });
  } finally {
    setCurrentStep(null); // Ensure progress is reset even on error
  }
});

// API endpoint for progress
app.get('/api/progress', (req, res) => {
  res.json(getProgress());
});

app.get('/api/progress2', (req, res) => {
  res.json(getProgress2 ? getProgress2() : { currentStep: null, stepResults: {}, totalSteps: 17 });
});

app.get('/api/progress3', (req, res) => {
  res.json(getProgress3 ? getProgress3() : { currentStep: null, stepResults: {}, totalSteps: 1 });
});

app.get('/api/progress4', (req, res) => {
  res.json(getProgress4 ? getProgress4() : { currentStep: null, stepResults: {}, totalSteps: 7 });
});

// 獲取 SAC 遊戲列表
app.post('/api/sac/games', async (req, res) => {
  try {
    const { url, apiUrl } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const result = await getGameList3(url, apiUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for checking website (Test Tool 2)
app.post('/api/check2', async (req, res) => {
  try {
    const { url, viewport, targetSpinCount } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // 🚀 鐵則：這裡絕對不准執行 resetProgress2()
    // 因為 checkWebsite2 內部已經會執行 reset 了
    // 在這裡 reset 會導致 WebSocket 剛抓到的資料被第二次 reset 沖掉

    const results = await checkWebsite2(url, viewport, targetSpinCount);
    res.json(results);
  } catch (error) {
    console.error('Error checking website (test2):', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (setCurrentStep2) setCurrentStep2(null);
  }
});

// API endpoint for checking website (Test Tool 3 - SAC)
app.post('/api/check3', async (req, res) => {
  try {
    const { url, viewport, selectedGames, games, gaMode } = req.body;
    const targetGames = selectedGames || games || [];
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    if (typeof resetProgress3 === 'function') {
      resetProgress3();
    } else if (setCurrentStep3) {
      setCurrentStep3(null);
    }

    const results = await checkWebsite3(url, viewport, targetGames, gaMode);
    res.json(results);
  } catch (error) {
    console.error('Error checking website (test3):', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (setCurrentStep3) setCurrentStep3(null);
  }
});

// API endpoint for Nickname Test (Tool 4)
app.post('/api/check4', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    if (setCurrentStep4) setCurrentStep4(null);
    const results = await checkWebsite4(url);
    res.json(results);
  } catch (error) {
    console.error('Error checking nickname:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (setCurrentStep4) setCurrentStep4(null);
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`\nReady: http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Lobby: http://localhost:' + PORT + '/');
  console.log('🎮 Live Slot: http://localhost:' + PORT + '/test2.html');
  console.log('⚙️ SAC: http://localhost:' + PORT + '/sac.html');
  console.log('🛠️ Nickname Test: http://localhost:' + PORT + '/nickname-test.html');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (AUTO_OPEN_BROWSER) {
    setTimeout(() => {
      openBrowser(`http://localhost:${PORT}/`);
    }, 500);
  }

  console.log('💡 提示: 若欲中斷測試並關閉伺服器，請按 [Q] 鍵或 [Ctrl+C]');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// 初始化互動監聽
initInteraction(closeDashboardBrowsers);

// 處理埠號被佔用的錯誤
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`❌ 錯誤: 埠號 ${PORT} 已被佔用。`);
    console.log(`💡 嘗試建議: 請執行 'lsof -ti :${PORT} | xargs kill -9' 關閉殘留程序後再試。`);
    process.exit(1);
  } else {
    console.error('❌ 伺服器啟動失敗:', e);
  }
});

// 全域未捕獲異常處理，防止伺服器崩潰
process.on('uncaughtException', (err) => {
  console.error('🔥 偵測到未捕獲異常 (Uncaught Exception):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🌐 偵測到未處理的 Promise 拒絕 (Unhandled Rejection):', reason);
});
