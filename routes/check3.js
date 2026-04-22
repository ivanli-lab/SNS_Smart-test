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
        } catch (e) {}
      });
      page.on('close', () => {
        console.log(`\x1b[31m[${label}] 視窗已關閉 | 最後步驟: ${this.lastStep}\x1b[0m`);
      });
    } catch (e) {}
  }

  setupContextListeners(context) {
    try {
      context.on('response', async res => {
        try {
          const url = res.url();
          if (!url.includes('gs.ingmsrv.cc')) return;
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
          if (text.includes('"command":"spin"')) {
            this.lastSpinResponseAt = Date.now();
            
            // [智慧等待] 偵測 Free Game 狀態
            if (text.includes('"get_sub_game":\s*true')) {
              if (!this.isInFreeGame) {
                console.log(`\x1b[33m[GS_DETECT] 🎰 偵測到進入 Free Game！等待結束中...\x1b[0m`);
                this.isInFreeGame = true;
              }
            } else if (text.includes('"data":\s*\[\]')) {
              if (this.isInFreeGame) {
                console.log(`\x1b[32m[GS_DETECT] ✨ Free Game 已結束，回到主遊戲。\x1b[0m`);
                this.isInFreeGame = false;
              }
            }

            if (hasErrorCode0) {
              this.spinStats.success++;
            } else {
              this.spinStats.fail++;
              if (text.includes('"error_code":\s*109')) {
                this.last109At = Date.now();
              }
            }
          }
        } catch (e) {}
      });
      context.on('page', newPage => {
        console.log(`\x1b[35m[CONTEXT] 偵測到新分頁: ${newPage.url()}\x1b[0m`);
        this.activeGamePage = newPage; 
        this.setupPageListeners(newPage, 'GAME_PAGE');
      });
    } catch (e) {}
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
      let canvas = await page.$('canvas');
      if (canvas) return canvas;
      for (const frame of page.frames()) {
        canvas = await frame.$('canvas');
        if (canvas) return canvas;
      }
    } catch (e) {}
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
  const userDataDir = path.join(__dirname, '../user_data/sac_isolated'); 
  const diag = new UltimateStabilityManager();
  const results = { url, timestamp: new Date().toISOString(), checks: {} };
  const targetGames = Array.isArray(selectedGames) ? selectedGames : [];
  
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1366, height: 768 }, 
      ignoreHTTPSErrors: true,
      args: [
        '--disable-blink-features=AutomationControlled', 
        '--no-sandbox', 
        '--window-size=1382,897' // 強制外框大小，確保內容區為 1366x768
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

    // 1. 登入
    setCurrentStep('login');
    diag.logStep('LOGIN_TEST');
    
    // 檢查是否需要登入
    let loginRes;
    if (await page.isVisible('input[name="account"]')) {
      loginRes = await steps.checkLogin(page, results.timestamp);
    } else {
      loginRes = { success: true, message: 'Session 有效', account: '自動登入' };
    }
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

    // 3. 尋找並開啟遊戲
    setCurrentStep('launchGame');
    diag.logStep('LAUNCH_GAME');
    const launchRes = await steps.launchGame(page, context, targetGames[0]);
    updateStepResult('launchGame', launchRes);
    await diag.takeStepScreenshot(page, 'step3-launch', launchRes.success ? 'success' : 'fail');
    if (!launchRes.success) throw new Error(launchRes.error);
    diag.activeGamePage = launchRes.gamePage;

    // 4. 載入遊戲穩定性檢查
    setCurrentStep('checkGameLoad');
    diag.logStep('WAITING_FOR_GAME_LOAD');
    const loadRes = await steps.checkGameLoad(diag);
    updateStepResult('checkGameLoad', loadRes);

    // [新增] 案發現場實測日誌
    if (diag.activeGamePage && !diag.activeGamePage.isClosed()) {
      try {
        const innerSize = await diag.activeGamePage.evaluate(() => ({
          w: window.innerWidth,
          h: window.innerHeight,
          ratio: window.devicePixelRatio
        }));
        console.log(`\x1b[35m[DIAG] 案發現場實際內容區: ${innerSize.w} x ${innerSize.h} (縮放比: ${innerSize.ratio})\x1b[0m`);
      } catch (e) {
        console.log(`\x1b[31m[DIAG ERROR] 無法讀取內容區尺寸: ${e.message}\x1b[0m`);
      }
    }

    await diag.takeStepScreenshot(diag.activeGamePage, 'step4-load', loadRes.success ? 'success' : 'fail');

    // 5. Spin 鈕點擊測試
    setCurrentStep('checkSpaceSpin');
    diag.logStep('SPIN_BUTTON_TEST');
    // 強化：確保 page 對象有效
    diag.activeGamePage = await diag.findActiveGamePage(context);
    const spaceRes = await steps.checkSpaceSpin(diag, stepResults, GAME_COORDINATE_MAP);
    updateStepResult('checkSpaceSpin', spaceRes);
    await diag.takeStepScreenshot(diag.activeGamePage, 'step5-spin', spaceRes.success ? 'success' : 'fail');

    // 6. AutoSpin 鈕點擊測試
    setCurrentStep('gameOperation');
    diag.logStep('AUTO_SPIN_TEST');
    // 強化：確保 page 對象有效
    diag.activeGamePage = await diag.findActiveGamePage(context);
    const config = GAME_COORDINATE_MAP[launchRes.gameId] || GAME_COORDINATE_MAP["default"];
    const opRes = await steps.gameOperation(diag, launchRes.gameId, config);
    updateStepResult('gameOperation', opRes);
    await diag.takeStepScreenshot(diag.activeGamePage, 'step6-auto', opRes.success ? 'success' : 'fail');

    // 7. 點擊 Start Streaming (SAC 分頁)
    setCurrentStep('startStreaming');
    diag.logStep('START_STREAMING_TEST');
    const streamRes = await steps.startStreaming(page, context);
    updateStepResult('startStreaming', streamRes);
    await diag.takeStepScreenshot(page, 'step7-stream', streamRes.success ? 'success' : 'fail');

    // [修正] 在焊死前先清除目前步驟狀態，讓前端顯示 ✅ 而不是 ⏳
    setCurrentStep(null);

    // 詢問使用者是否繼續
    const decision = await askToContinue();
    
    if (decision === 'quit') {
      if (context) await context.close().catch(() => {});
      console.log('Browser closed immediately');
    } else {
      console.log('💡 瀏覽器將保持開啟 60 秒後自動關閉...');
      await new Promise(r => setTimeout(r, 60000));
      if (context) await context.close().catch(() => {});
      console.log('Browser closed');
    }

  } catch (error) {
    console.error(`[ERROR] ${diag.lastStep}: ${error.message}`);
  } finally {
    setCurrentStep(null);
  }
  return results;
}

async function getGameList(url, _apiUrl) {
  const userDataDir = path.join(__dirname, '../user_data/sac_gamelist'); 
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
  let context = null;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-gpu']
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    if (await page.isVisible('input[name="account"]')) {
      console.log('正在進行 SAC 登入...');
      await page.fill('input[name="account"]', 'game07');
      await page.fill('input[name="password"]', 'ga07');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    }

    // [第一步] 點擊主選單 "Streaming"
    console.log('正在嘗試開啟 Streaming 選單...');
    const streamingSelector = 'text=Streaming';
    try {
      await page.waitForSelector(streamingSelector, { timeout: 5000 });
      const menu = page.locator(streamingSelector).first();
      await menu.scrollIntoViewIfNeeded();
      await menu.click({ force: true });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(__dirname, '../public/screenshots/sac_debug_1_streaming_clicked.png') });
    } catch (e) {
      console.log('⚠️ 直接點擊 Streaming 文字失敗，嘗試搜尋父容器...');
      await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('li, div')).find(e => e.innerText?.trim() === 'Streaming');
        if (el) el.click();
      });
    }

    // [第二步] 點擊子選單 "Game List"
    console.log('正在嘗試點擊 Game List 子選單...');
    try {
      const subMenuSelector = 'text=Game List';
      await page.waitForSelector(subMenuSelector, { timeout: 5000 });
      const subMenu = page.locator(subMenuSelector).first();
      await subMenu.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(__dirname, '../public/screenshots/sac_debug_2_gamelist_clicked.png') });
    } catch (e) {
      console.log('⚠️ 找不到 Game List 子選單，嘗試暴力搜尋所有包含 Game 的元素...');
      await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('li, div, span, a')).find(e => e.innerText?.trim() === 'Game List' && e.offsetParent !== null);
        if (el) el.click();
      });
      await page.waitForTimeout(2000);
    }

    // [第三步] 尋找最終的 "Open Game List" 按鈕
    const selectors = [
      'button:has-text("Open Game List")',
      'button:has-text("open game list")',
      'button:has-text("遊戲列表")',
      'button:has-text("Game")',
      '.ant-btn-primary'
    ];

    let targetButton = null;
    for (const sel of selectors) {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible()) {
        const text = await btn.innerText();
        if (text.toLowerCase().includes('game') || text.includes('列表') || text.includes('List')) {
           console.log(`✅ 找到可能的按鈕: "${text}" (選擇器: ${sel})`);
           targetButton = btn;
           break;
        }
      }
    }

    if (!targetButton) {
      const debugPath = path.join(__dirname, '../public/screenshots/sac_debug_list_failed.png');
      await page.screenshot({ path: debugPath });
      console.error(`❌ 找不到遊戲列表按鈕，截圖已存至: ${debugPath}`);
      throw new Error('找不到 "Open Game List" 按鈕，請檢查截圖確認頁面狀態');
    }

    await targetButton.click({ force: true });
    for (let i = 0; i < 20; i++) {
      if (interceptedJson) break;
      await page.waitForTimeout(500);
    }
    const findArray = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      for (const key in obj) {
        if (Array.isArray(obj[key]) && obj[key].length > 0 && obj[key][0].platform) return obj[key];
        const res = findArray(obj[key]);
        if (res) return res;
      }
      return null;
    };
    const list = findArray(interceptedJson) || [];
    const games = list.filter(g => (g.platform || '').toString().toUpperCase() === 'IDN').map(g => g.game_name || g.game_id);
    return { success: true, games };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    if (context) await context.close();
  }
}

module.exports = { checkWebsite, getProgress, setCurrentStep, resetProgress, getGameList };
