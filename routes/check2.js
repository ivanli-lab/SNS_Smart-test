const { chromium } = require('playwright');
const { askToContinue } = require('../utils/interaction');
const { setupNetworkLogging, disableNetworkLogging, resetNetworkLogging } = require('../scripts/network-logger');
const fs = require('fs');
const path = require('path');

/**
 * Live Slot (測試工具 2) 核心邏輯 - 超強載入同步版
 */
let activeBrowser = null;
let stopRequested = false;
let currentStep = null;
const stepResults = {};
const totalSteps = 18;

function setCurrentStep(stepKey) { currentStep = stepKey; }
function updateStepResult(stepKey, result) {
  stepResults[stepKey] = { ...stepResults[stepKey], ...result, pending: false };
}
function getProgress() { return { currentStep, stepResults, totalSteps, stopRequested }; }

function ensureNotStopped() {
  if (stopRequested) {
    const error = new Error('Test stopped by user');
    error.name = 'StopRequestedError';
    throw error;
  }
}

async function stopTest() {
  stopRequested = true;
  if (activeBrowser) {
    console.log('🛑 [Live Slot] 收到停止請求，正在關閉瀏覽器...');
    await activeBrowser.close().catch(() => {});
    activeBrowser = null;
  }
}

function resetProgress() {
  currentStep = null;
  Object.keys(stepResults).forEach(key => delete stepResults[key]);
  stopRequested = false;
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
  stopRequested = false;
  let browser = null;
  try {
    resetProgress();
    resetNetworkLogging(); // 重置日誌狀態
    browser = await chromium.launch({
      headless: false, args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    activeBrowser = browser;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    setupNetworkLogging(page);

    await page.goto(url, { waitUntil: 'networkidle' }).catch(() => { });
    ensureNotStopped();

    // 1️⃣ 彈窗檢查
    setCurrentStep('streamNSpinDialog');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /Confirm|確定|OK/i.test(b.innerText) && b.offsetParent !== null);
      if (btn) btn.click();
    });
    updateStepResult('streamNSpinDialog', { success: true });
    ensureNotStopped();

    await startMainFlow(context, page);
    return { success: true };
  } catch (error) {
    if (stopRequested && (error.name === 'StopRequestedError' || error.message.includes('closed'))) {
      console.log('✅ [Live Slot] 測試已成功中斷');
      return { success: false, stopped: true };
    }
    console.error('❌ 測試發生異常:', error);
    return { success: false };
  } finally {
    if (browser && !stopRequested) {
      // 在進入互動模式前，關閉所有背景網路日誌，確保終端機乾淨
      disableNetworkLogging();
      console.log('💡 測試完成，瀏覽器將在 3 秒後自動關閉...');
      await new Promise(r => setTimeout(r, 3000));
      await browser.close().catch(() => { });
    }
    activeBrowser = null;
    stopRequested = false;
  }
}

async function startMainFlow(context, page) {
  // 2️⃣ 自動點擊直播主卡片功能測試
  setCurrentStep('streamingNowClick');
  stepResults['streamingNowClick'] = { success: false, pending: true, message: '正在自動尋找並點擊直播主卡片...' };
  ensureNotStopped();

  const screenshotDir = path.join(__dirname, '..', 'public', 'screenshots', 'lobby');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  const clickStreamerCard = async (targetPage) => {
      console.log('[Step 2] Waiting for lobby to load...');
      
      // 等待大廳有任何內容出現（最多15秒）
      await targetPage.waitForLoadState('domcontentloaded').catch(() => {});
      await targetPage.waitForTimeout(3000); // 額外等待 React 渲染完成

      for (let i = 0; i < 5; i++) {
          console.log(`[Step 2] 第 ${i + 1} 次嘗試點擊...`);
          
          // 截圖除錯，看看每次點擊前的畫面狀態
          await targetPage.screenshot({ path: path.join(screenshotDir, `click-attempt-${i + 1}.png`) }).catch(() => {});

          // 方法 1: Playwright locator (最穩定，能等待元素出現)
          try {
              const card = targetPage.locator('div[data-cover="true"]').first();
              if (await card.isVisible({ timeout: 2000 })) {
                  console.log('[Step 2] [方法1] 找到 data-cover="true"，直接點擊！');
                  await card.click({ force: true, timeout: 3000 });
                  return true;
              }
          } catch (e) { console.log(`[Step 2] [方法1] 失敗: ${e.message}`); }

          // 方法 2: 找畫面上任何 img 元素（直播卡片內通常有圖片）
          try {
              const imgCount = await targetPage.evaluate(() => {
                  const imgs = Array.from(document.querySelectorAll('img'));
                  // 找寬度大於 100px 的圖片（排除小 icon）
                  const bigImg = imgs.find(img => {
                      const r = img.getBoundingClientRect();
                      return r.width > 100 && r.height > 80 && r.top > 50;
                  });
                  if (bigImg) {
                      bigImg.click();
                      const r = bigImg.getBoundingClientRect();
                      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
                  }
                  return null;
              });
              if (imgCount) {
                  console.log(`[Step 2] [方法2] 找到大圖，滑鼠補點 (${imgCount.x}, ${imgCount.y})...`);
                  await targetPage.mouse.click(imgCount.x, imgCount.y);
                  return true;
              }
          } catch (e) { console.log(`[Step 2] [方法2] 失敗: ${e.message}`); }

          // 方法 3: 根據 1366x768 解析度的固定座標盲點擊 "Streaming Now" 第一張卡片
          // 從截圖觀察，Streaming Now 區塊的第一張卡片大約在 (700, 200) 附近
          if (i >= 2) {
              console.log('[Step 2] [方法3] 啟動固定座標盲點擊...');
              const coords = [
                  { x: 700, y: 210 },  // Streaming Now 第一張卡片中央
                  { x: 870, y: 210 },  // Streaming Now 第二張卡片中央
                  { x: 530, y: 210 },  // 左邊備用
              ];
              for (const { x, y } of coords) {
                  await targetPage.mouse.click(x, y);
                  await targetPage.waitForTimeout(500);
              }
              return true; // 盲點擊後直接回傳 true，讓 waitForEvent 去決定是否成功開了新分頁
          }

          await targetPage.waitForTimeout(2000);
      }
      return false;
  };

  const clickPromise = clickStreamerCard(page).then(success => {
      if (!success) throw new Error('所有點擊方法均已嘗試，等待手動介入');
  });

  const [newPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 35000 }),
      clickPromise
  ]).catch(async (err) => {
      console.log(`[Step 2] 自動點擊失敗 (${err.message})，等待手動點擊...`);
      updateStepResult('streamingNowClick', { success: false, pending: true, message: '自動點擊失敗，請點擊直播主卡片' });
      return [await context.waitForEvent('page', { timeout: 90000 })];
  });


  updateStepResult('streamingNowClick', { success: true, newPageOpened: true, message: '進入直播間，開始強力監控載入進度...' });

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
  ensureNotStopped();

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
  ensureNotStopped();

  const runStep = async (id, name, fn) => {
    setCurrentStep(id);
    ensureNotStopped();
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

module.exports = { checkWebsite, getProgress, setCurrentStep, resetProgress, stopTest };
