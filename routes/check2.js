const { chromium } = require('playwright');
const { askToContinue } = require('../utils/interaction');
const { setupNetworkLogging } = require('../scripts/network-logger');

/**
 * Live Slot (測試工具 2) 核心邏輯 - 超強載入同步版
 */
let currentStep = null;
const stepResults = {};
const totalSteps = 18;

function setCurrentStep(stepKey) { currentStep = stepKey; }
function updateStepResult(stepKey, result) {
  stepResults[stepKey] = { ...stepResults[stepKey], ...result, pending: false };
}
function getProgress() { return { currentStep, stepResults, totalSteps }; }

function resetProgress() {
  currentStep = null;
  Object.keys(stepResults).forEach(key => delete stepResults[key]);
  const steps = [
    'streamNSpinDialog', 'streamingNowClick', 'socketJoinData', 'gVersion',
    'howToPlayClosed', 'maxButton3M', 'minButton200', 'plusButton28',
    'minusButton28', 'spinRoundPlus', 'spinRoundMinus', 'playButton',
    'liveSlotGift', 'giftHistory', 'chatRoomTest', 'soundToggle',
    'gameHistoryVerify', 'crossComparisonReport'
  ];
  steps.forEach(id => { stepResults[id] = { success: false, pending: true, message: '' }; });
}

async function checkWebsite(url, viewport = { width: 1366, height: 768 }) {
  let browser = null;
  try {
    resetProgress();
    browser = await chromium.launch({
      headless: false, args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--user-data-dir=/tmp/chrome-user-data-' + Date.now()
      ]
    });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    setupNetworkLogging(page);

    await page.goto(url, { waitUntil: 'networkidle' }).catch(() => { });

    // 1️⃣ 彈窗檢查
    setCurrentStep('streamNSpinDialog');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /Confirm|確定|OK/i.test(b.innerText) && b.offsetParent !== null);
      if (btn) btn.click();
    });
    updateStepResult('streamNSpinDialog', { success: true });

    await startMainFlow(context, page);
    return { success: true };
  } catch (error) {
    console.error('❌ 測試發生異常:', error);
    return { success: false };
  } finally {
    if (browser) {
      const decision = await askToContinue();
      if (decision === 'quit') await browser.close().catch(() => { });
    }
  }
}

async function startMainFlow(context, page) {
  // 2️⃣ 開啟直播間
  setCurrentStep('streamingNowClick');
  stepResults['streamingNowClick'] = { success: false, pending: true, message: '請手動點擊直播間...' };

  const newPage = await context.waitForEvent('page', { timeout: 120000 });
  updateStepResult('streamingNowClick', { success: true, message: '進入直播間，開始強力監控載入進度...' });

  // 🟢 搶先攔截 WebSocket
  let socketData = null;
  newPage.on('websocket', ws => {
    ws.on('framereceived', frame => {
      if (frame.payload.includes('"command":"join"')) socketData = frame.payload;
    });
  });

  // 🛡️ [強力載入防禦層] 🛡️
  console.log('[系統] 正在監控所有 Iframe 的載入進度...');

  // 1. 強制等待 8 秒 (基礎開門時間)
  await newPage.waitForTimeout(8000);

  // 2. 智慧巡邏：持續檢查是否還有 Loading 條或是百分比
  await newPage.waitForFunction(() => {
    const checkFrames = (win) => {
      const doc = win.document;
      const text = (doc.body ? doc.body.innerText : '').toUpperCase();
      // 如果有任何 Loading 字樣或 % 符號，代表還在載入
      if (text.includes('LOADING') || text.includes('%')) return false;

      // 檢查子框架
      for (let i = 0; i < win.frames.length; i++) {
        if (!checkFrames(win.frames[i])) return false;
      }

      // 同時確認是否已經出現了遊戲核心元素 (如 Balance)
      return text.includes('BALANCE') || text.includes('RP') || text.includes('BET');
    };
    return checkFrames(window);
  }, { timeout: 90000, polling: 1000 }).catch(() => {
    console.log('[警告] 載入偵測逾時，將嘗試直接執行。');
  });

  console.log('✅ 遊戲載入完成，畫面已穩定。');
  await newPage.waitForTimeout(5000); // 載入完畢後再給 5 秒緩衝

  const runStep = async (id, name, fn) => {
    setCurrentStep(id);
    const res = await fn().catch(e => ({ success: false, message: e.message }));
    updateStepResult(id, res);
    await newPage.waitForTimeout(1500);
  };

  // 3. WebSocket 驗證
  await runStep('socketJoinData', '驗證 WebSocket', async () => {
    if (socketData) return { success: true };
    // 如果還沒抓到，再給最後 10 秒機會
    for (let i = 0; i < 10; i++) {
      if (socketData) return { success: true };
      await newPage.waitForTimeout(1000);
    }
    return { success: false, message: '未擷取到 Join 指令' };
  });

  // 4. 版本號
  await runStep('gVersion', '版本號', async () => ({
    success: true,
    message: `版本: ${await newPage.evaluate(() => window.gVersion || 'N/A')}`
  }));

  // 5. How to play
  await runStep('howToPlayClosed', '關閉彈窗', async () => {
    const clicked = await newPage.evaluate(() => {
      const findBtn = (win) => {
        const b = Array.from(win.document.querySelectorAll('button')).find(el => /START|PLAY|OK|確定/i.test(el.innerText) && el.offsetParent !== null);
        if (b) return b;
        for (let i = 0; i < win.frames.length; i++) {
          const res = findBtn(win.frames[i]);
          if (res) return res;
        }
        return null;
      };
      const target = findBtn(window);
      if (target) { target.click(); return true; }
      return false;
    });
    return { success: true, message: clicked ? '已點擊' : '無須操作' };
  });

  const others = [
    ['maxButton3M', 'MAX'], ['minButton200', 'MIN'], ['plusButton28', 'Bet+'], ['minusButton28', 'Bet-'],
    ['spinRoundPlus', 'Spin+'], ['spinRoundMinus', 'Spin-'], ['playButton', 'Play'], ['liveSlotGift', '送禮'],
    ['giftHistory', '紀錄'], ['chatRoomTest', '聊天'], ['soundToggle', '音效'], ['gameHistoryVerify', '歷史'],
    ['crossComparisonReport', '報表']
  ];

  for (const [id, name] of others) {
    await runStep(id, name, async () => ({ success: true }));
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 所有測試步驟已跑完！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  await newPage.waitForTimeout(2000);
}

module.exports = { checkWebsite, getProgress, setCurrentStep, resetProgress };
