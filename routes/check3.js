const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const steps = require('../scripts/steps3');
const { askToContinue } = require('../utils/interaction');

// 狀態管理
let currentStep = null;
const stepResults = {};
const totalSteps = 7;

const GAME_COORDINATE_MAP = {
  "4100": {
    spin: { x: 0.9209, y: 0.850 },
    auto: { x: 0.7980, y: 0.9518 },
    extra: { x: 0.4041, y: 0.1107 },
    ok: { x: 0.4978, y: 0.9193 }
  },
  "4401": {
    spin: { x: 0.9202, y: 0.6758 },
    auto: { x: 0.8258, y: 0.9206 },
    ok: { x: 0.4993, y: 0.8698 }
  },
  "2702": {
    spin: { x: 0.9165, y: 0.7214 },
    auto: { x: 0.8302, y: 0.8906 },
    extra: { x: 0.2511, y: 0.2708 },
    ok: { x: 0.5044, y: 0.6172 }
  },
  "4600": {
    spin: { x: 0.9012, y: 0.7643 },
    auto: { x: 0.8441, y: 0.9219 },
    ok: { x: 0.4985, y: 0.7669 }
  },
  "2900": {
    spin: { x: 0.9004, y: 0.7515 },
    auto: { x: 0.7906, y: 0.9131 },
    extra: { x: 0.3770, y: 0.4362 },
    ok: { x: 0.5051, y: 0.6095 }
  },
  "3800": {
    spin: { x: 0.8968, y: 0.7385 },
    auto: { x: 0.7921, y: 0.9183 },
    extra: { x: 0.3895, y: 0.1703 },
    ok: { x: 0.5007, y: 0.8883 }
  },
  "3900": {
    spin: { x: 0.8990, y: 0.7346 },
    auto: { x: 0.7884, y: 0.9079 },
    extra: { x: 0.2987, y: 0.2915 },
    ok: { x: 0.5007, y: 0.7645 }
  },
  "4300": {
    spin: { x: 0.8221, y: 0.6641 },
    auto: { x: 0.8272, y: 0.9310 },
    ok: { x: 0.4993, y: 0.6862 }
  },
  "2600": {
    spin: { x: 0.9136, y: 0.7305 },
    auto: { x: 0.8302, y: 0.8880 },
    extra: { x: 0.2496, y: 0.2878 },
    ok: { x: 0.5059, y: 0.7344 }
  },
  "4400": {
    spin: { x: 0.9202, y: 0.6836 },
    auto: { x: 0.8236, y: 0.9232 },
    ok: { x: 0.4985, y: 0.8646 }
  },
  "4301": {
    spin: { x: 0.9561, y: 0.6432 },
    auto: { x: 0.8294, y: 0.9336 },
    ok: { x: 0.4927, y: 0.8789 }
  },
  "4500": {
    spin: { x: 0.8873, y: 0.7669 },
    auto: { x: 0.8250, y: 0.9453 },
    ok: { x: 0.4978, y: 0.7279 }
  },
  "4200": {
    spin: { x: 0.8931, y: 0.7695 },
    auto: { x: 0.8587, y: 0.9414 },
    ok: { x: 0.5051, y: 0.7031 }
  },
  "3500": {
    spin: { x: 0.9026, y: 0.7398 },
    auto: { x: 0.7936, y: 0.9157 },
    extra: { x: 0.3016, y: 0.2902 },
    ok: { x: 0.4985, y: 0.7685 }
  },
  "default": { spin: { x: 0.8258, y: 0.9167 }, ok: { x: 0.4985, y: 0.8711 } }
};

class UltimateStabilityManager {
  constructor() {
    this.spinStats = { success: 0, fail: 0 };
    this.lastStep = 'INIT';
    this.activeGamePage = null;
    this.gameApiToken = null;
    this.last109At = 0;
    this.lastRenameOkAt = 0; // [新增] 用於追蹤 GS API 成功通訊
    this.lastSpinResponseAt = 0;
    this.isInFreeGame = false;
    this.screenshotDir = path.join(__dirname, '../public/screenshots/sac');
    if (!fs.existsSync(this.screenshotDir)) fs.mkdirSync(this.screenshotDir, { recursive: true });
  }

  async clearScreenshots() {
    try {
      const files = fs.readdirSync(this.screenshotDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.screenshotDir, file));
      }
      console.log(`\x1b[33m[DIAG] 已清空舊截圖目錄: ${this.screenshotDir}\x1b[0m`);
    } catch (e) {
      console.error(`[DIAG ERROR] 清空截圖失敗: ${e.message}`);
    }
  }

  async takeStepScreenshot(page, stepName, status) {
    try {
      if (!page || page.isClosed()) return;
      const filename = `${stepName}-${status}-${Date.now()}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      await page.screenshot({ path: filepath });
      console.log(`\x1b[33m[DIAG] 已儲存截圖: ${filename}\x1b[0m`);
    } catch (e) {
      console.error(`[DIAG ERROR] 截圖失敗: ${e.message}`);
    }
  }

  logStep(label) {
    this.lastStep = label;
    const url = this.activeGamePage ? (this.activeGamePage.isClosed() ? '(closed)' : this.activeGamePage.url()) : 'N/A';
    console.log(`\x1b[34m[STEP] ${new Date().toLocaleTimeString()} | ${label} | URL: ${url}\x1b[0m`);
  }

  setupPageListeners(page, label) {
    try {
      page.on('console', msg => {
        try {
          const text = msg.text();
          if (label === 'GAME_PAGE') {
            if (text.includes('Error Code 109') || /"error_code":\s*109/.test(text)) {
              this.last109At = Date.now();
            }
          }
        } catch (e) { }
      });
      page.on('close', () => {
        console.log(`\x1b[31m[${label}] 視窗已關閉 | 最後步驟: ${this.lastStep}\x1b[0m`);
      });
    } catch (e) { }
  }

  setupContextListeners(context) {
    try {
      context.on('response', async res => {
        try {
          const url = res.url();
          if (!url.includes('gs.ingmsrv.cc') && !url.includes('gs.istaweb.xyz')) return;
          const text = await res.text().catch(() => '');
          if (!text) return;
          const tokenMatch = text.match(/"token":"([^"]+)"/);
          if (tokenMatch && tokenMatch[1] !== this.gameApiToken) {
            this.gameApiToken = tokenMatch[1];
            console.log(`\x1b[32m[GS_DETECT] 🎫 成功捕獲真．遊戲 Token: ${this.gameApiToken.substring(0, 15)}...\x1b[0m`);
          }
          const hasErrorCode0 = /"error_code":\s*0/.test(text);
          if (hasErrorCode0) {
            this.lastRenameOkAt = Date.now();
          }
          const isSpinResponse = /"command"\s*:\s*"spin"/.test(text);
          if (isSpinResponse) {
            this.lastSpinResponseAt = Date.now();
            console.log(`\x1b[32m[GS_DETECT] 🎰 偵測到 Spin 封包回應！\x1b[0m`);

            // [智慧等待] 偵測 Free Game 狀態
            if (/"get_sub_game"\s*:\s*true/.test(text)) {
              if (!this.isInFreeGame) {
                console.log(`\x1b[33m[GS_DETECT] 🎰 偵測到進入 Free Game！等待結束中...\x1b[0m`);
                this.isInFreeGame = true;
              }
            } else if (/"data"\s*:\s*\[\s*\]/.test(text)) {
              if (this.isInFreeGame) {
                console.log(`\x1b[32m[GS_DETECT] ✨ Free Game 已結束，回到主遊戲。\x1b[0m`);
                this.isInFreeGame = false;
              }
            }

            if (hasErrorCode0) {
              this.spinStats.success++;
            } else {
              this.spinStats.fail++;
              if (/"error_code"\s*:\s*109/.test(text)) {
                this.last109At = Date.now();
              }
            }
          }
        } catch (e) { }
      });
      context.on('page', newPage => {
        console.log(`\x1b[35m[CONTEXT] 偵測到新分頁: ${newPage.url()}\x1b[0m`);
        this.activeGamePage = newPage;
        this.setupPageListeners(newPage, 'GAME_PAGE');
      });
    } catch (e) { }
  }

  async findActiveGamePage(context, targetUrl) {
    const pages = context.pages();
    // 優先尋找包含遊戲網址的分頁
    let page = pages.find(p => p.url().includes('gc.ingmsrv.cc') || p.url().includes('gameid='));
    if (page) return page;
    // 如果找不到，找最後一個開啟的分頁（通常是遊戲）
    return pages.length > 1 ? pages[pages.length - 1] : this.activeGamePage;
  }

  async findCanvas(page) {
    try {
      // 1. 直接在頁面找
      let canvas = await page.$('canvas');
      if (canvas) return canvas;

      // 2. 搜尋所有 frames（含 iframe 內）
      for (const frame of page.frames()) {
        try {
          canvas = await frame.$('canvas');
          if (canvas) {
            console.log(`\x1b[35m[DIAG] 在 frame [${frame.url()}] 找到 Canvas\x1b[0m`);
            return canvas;
          }
          // 3. 搜尋 frame 裡的子 frame
          for (const childFrame of frame.childFrames()) {
            try {
              canvas = await childFrame.$('canvas');
              if (canvas) {
                console.log(`\x1b[35m[DIAG] 在子 frame [${childFrame.url()}] 找到 Canvas\x1b[0m`);
                return canvas;
              }
            } catch (e) {}
          }
        } catch (e) {}
      }
    } catch (e) { }
    return null;
  }
}

function setCurrentStep(stepKey) { currentStep = stepKey; }
function updateStepResult(stepKey, result) { stepResults[stepKey] = result; }
function getProgress() { return { currentStep, stepResults, totalSteps }; }
function resetProgress() {
  currentStep = null;
  Object.keys(stepResults).forEach(key => delete stepResults[key]);
}

async function checkWebsite(url, viewport = { width: 1366, height: 768 }, selectedGames = [], gaMode = false) {
  console.log('--- [DIAG] 目前 steps 的狀態:', typeof steps); // 加入這行
  const userDataDir = path.join(__dirname, '../user_data/sac_isolated');
  // [超級偵察機] 看看 steps 到底抓到了什麼
  console.log('\x1b[33m--- [DIAG] steps 物件的所有 Key: ---\x1b[0m', Object.keys(steps));
  const diag = new UltimateStabilityManager();
  const results = { url, timestamp: new Date().toISOString(), checks: {} };
  const targetGames = Array.isArray(selectedGames) ? selectedGames : [];
  // --- 新增這兩行 ---
  let launchRes = { success: false };
  let gamePage = null;
  try {
    // 1. 修改 userDataDir 的定義 (通常在檔案上方，或函數開頭)
    // 讓它每次執行都加上時間戳記，避免 SingletonLock
    const uniqueUserDataDir = path.join(__dirname, '../temp_profiles/sac-' + Date.now());

    if (!fs.existsSync(uniqueUserDataDir)) {
      fs.mkdirSync(uniqueUserDataDir, { recursive: true });
    }

    // 2. 修改啟動部分
    context = await chromium.launchPersistentContext(uniqueUserDataDir, { // 使用唯一的路徑
      headless: false,
      viewport: { width: 1366, height: 768 },
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        // --- 這裡不需要再加 --user-data-dir 了，因為上面第一個參數已經給了 ---
      ]
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    diag.setupContextListeners(context);
    diag.setupPageListeners(page, 'MAIN_PAGE');
    resetProgress();

    // 啟動前清空舊截圖
    await diag.clearScreenshots();

    // 0. 前往 SAC 網址
    diag.logStep('NAVIGATING_TO_SAC');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await diag.takeStepScreenshot(page, 'step0-nav', 'success');

    // --- [最終解決方案] 登入與狀態判定 ---
    let loginRes = { success: false };
    try {
        // 使用最基礎的選擇器，分開判定，絕不合併，避免 CSS 解析報錯
        const isSiderVisible = await page.locator('.ant-layout-sider').isVisible().catch(() => false);
        const isListBtnVisible = await page.locator('button:has-text("Open Game List")').isVisible().catch(() => false);

        if (isSiderVisible || isListBtnVisible) {
            console.log('<<<<<<<< [DIAG] 偵測到後台特徵，直接跳過登入 >>>>>>>>');
            loginRes = { success: true, message: 'Session 有效', account: '自動登入' };
        } else {
            console.log('<<<<<<<< [DIAG] 沒看到後台，開始搜尋登入欄位... >>>>>>>>');
            // 等待最原始的 account 欄位
            await page.waitForSelector('input[name="account"]', { state: 'visible', timeout: 10000 });
            console.log('<<<<<<<< [CRITICAL] 執行 steps.checkLogin >>>>>>>>');
            loginRes = await steps.checkLogin(page, results.timestamp);
        }
    } catch (err) {
        console.log('<<<<<<<< [DIAG] 判定路徑不通 (可能是已在後台或頁面異常):', err.message);
        // 保險手段：如果上述判定噴錯，最後再試一次直接抓 Open Game List
        const finalCheck = await page.locator('button:has-text("Open Game List")').isVisible().catch(() => false);
        if (finalCheck) {
            loginRes = { success: true, message: 'Final check pass' };
        } else {
            loginRes = { success: false, error: err.message };
        }
    }
    // 更新 UI 狀態
    updateStepResult('login', loginRes);
    await diag.takeStepScreenshot(page, 'step1-login', loginRes.success ? 'success' : 'fail');
    if (!loginRes.success) throw new Error(loginRes.error);

    // 2. Open Game List
    setCurrentStep('openGameList');
    diag.logStep('OPEN_GAME_LIST');
    const listRes = await steps.openGameList(page);
    updateStepResult('openGameList', listRes);
    await diag.takeStepScreenshot(page, 'step2-list', listRes.success ? 'success' : 'fail');
    if (!listRes.success) throw new Error(listRes.error);

    // --- 修改後的 323 行起 ---
    // 使用 Promise.all 同時執行「等待新頁面」和「點擊遊戲」
    [gamePage, launchRes] = await Promise.all([
      context.waitForEvent('page', { timeout: 15000 }).catch(() => {
        console.log('--- [DIAG] 15 秒內未偵測到新分頁，假設遊戲在原分頁/彈窗開啟 ---');
        return page;
      }), // 1. 準備好網子捕捉新視窗，如果沒抓到就退回使用原本的 page
      steps.launchGame(page, context, targetGames[0])  // 2. 執行點擊動作
    ]);

    updateStepResult('launchGame', launchRes);
    await diag.takeStepScreenshot(page, 'step3-launch', launchRes.success ? 'success' : 'fail');

    if (!launchRes.success) throw new Error(launchRes.error);

    // 將捕捉到的新分頁 (gamePage) 存入 diag，讓後面的步驟可以用它
    diag.activeGamePage = gamePage;
    // --- 修改結束 ---

    // --- [STEP 4] Waiting for Game Load ---
    setCurrentStep('checkGameLoad');
    if (diag.activeGamePage && !diag.activeGamePage.isClosed()) {
      try {
        const loadRes = await steps.checkGameLoad(gamePage);
        updateStepResult('checkGameLoad', loadRes);
      } catch (err) {
        console.error('--- [ERROR] 遊戲載入超時或異常:', err.message);
        updateStepResult('checkGameLoad', { success: false, error: err.message });
      }
    }

    // [關鍵] 等待遊戲引擎與伺服器連線完全初始化，再開始 Spin 測試
    console.log('--- [DIAG] 等待 8 秒讓遊戲引擎完全就緒... ---');
    await gamePage.waitForTimeout(8000);

    // 確認 Step 4 是否成功，作為 Step 5、6 的執行前提
    const gameLoadSucceeded = stepResults['checkGameLoad']?.success === true;

    // --- [STEP 5] Space Spin Check ---
    setCurrentStep('checkSpaceSpin');
    if (!gameLoadSucceeded) {
      console.log('\x1b[33m[STEP 5] ⚠️ 遊戲未成功載入，跳過 Spin 測試。\x1b[0m');
      updateStepResult('checkSpaceSpin', { success: false, error: '遊戲未成功載入，跳過 Spin 測試' });
    } else if (diag.activeGamePage && !diag.activeGamePage.isClosed()) {
      try {
        const spinRes = await steps.checkSpaceSpin(diag, targetGames[0], GAME_COORDINATE_MAP);
        updateStepResult('checkSpaceSpin', spinRes);
      } catch (err) {
        console.error('--- [ERROR] Space Spin 失敗:', err.message);
        updateStepResult('checkSpaceSpin', { success: false, error: err.message });
      }
    }

    // --- [STEP 6] Game Operation (Auto Spin, etc) ---
    setCurrentStep('gameOperation');
    if (!gameLoadSucceeded) {
      console.log('\x1b[33m[STEP 6] ⚠️ 遊戲未成功載入，跳過 AutoSpin 測試。\x1b[0m');
      updateStepResult('gameOperation', { success: false, error: '遊戲未成功載入，跳過 AutoSpin 測試' });
    } else if (diag.activeGamePage && !diag.activeGamePage.isClosed()) {
      try {
        const config = GAME_COORDINATE_MAP[targetGames[0]] || GAME_COORDINATE_MAP["default"];
        const opRes = await steps.gameOperation(diag, targetGames[0], config);
        updateStepResult('gameOperation', opRes);
      } catch (err) {
        console.error('--- [ERROR] Game Operation 失敗:', err.message);
        updateStepResult('gameOperation', { success: false, error: err.message });
      }
    }

    // --- [STEP 7] Start Streaming ---
    setCurrentStep('startStreaming');
    try {
      const streamRes = await steps.startStreaming(page, context);
      updateStepResult('startStreaming', streamRes);
    } catch (err) {
      console.error('--- [ERROR] Start Streaming 失敗:', err.message);
      updateStepResult('startStreaming', { success: false, error: err.message });
    }

    console.log('--- [DIAG] 測試流程結束 ---');
    // 等待前端輪詢有機會抓到最後一個步驟的結果，再回傳 HTTP response
    await new Promise(r => setTimeout(r, 2500));

    // 提示使用者決定後續操作
    const decision = await askToContinue();
    if (decision === 'continue') {
      console.log('\x1b[32m[DIAG] 繼續模式：瀏覽器保持開啟 60 秒...\x1b[0m');
      await new Promise(r => setTimeout(r, 60000));
    }

    return results;

} catch (err) {
        console.error('--- [ERROR] 主流程發生錯誤:', err.message);
        return { success: false, error: err.message };
    } finally {
        setCurrentStep(null);
    }
} // <--- 確保這一個括號在最左邊，徹底關閉 checkWebsite

// ==========================================
// 獨立定義 getGameList (現在它不會被擠回去了)
// ==========================================
async function getGameList(url, _apiUrl) {
    try {
        // 預設測試遊戲清單
        const games = ["5200", "5300", "5400", "5500", "4100", "4401", "2702", "4600", "2900", "3800"];
        return { success: true, games: games };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// 最終匯出模組
module.exports = {
    checkWebsite,
    getProgress,
    setCurrentStep,
    updateStepResult,
    resetProgress,
    getGameList
};



