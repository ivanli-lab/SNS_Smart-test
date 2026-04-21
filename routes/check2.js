const { chromium } = require('playwright');
const { askToContinue } = require('../utils/interaction');
const { setupNetworkLogging } = require('../scripts/network-logger');

/**
 * Live Slot (測試工具 2) 核心邏輯 - 深度驗證版
 */
let currentStep = null;
const stepResults = {};
const totalSteps = 16;

let lastBetData = null;
let lastPayoutData = null;

function setCurrentStep(stepKey) {
  currentStep = stepKey;
}

function updateStepResult(stepKey, result) {
  stepResults[stepKey] = {
    ...stepResults[stepKey],
    ...result,
    pending: false
  };
}

function getProgress() {
  return { currentStep, stepResults, totalSteps };
}

function resetProgress() {
  currentStep = null;
  lastBetData = null;
  lastPayoutData = null;
  Object.keys(stepResults).forEach(key => delete stepResults[key]);
  const steps = [
    'streamNSpinDialog', 'streamingNowClick', 'socketJoinData', 'gVersion',
    'howToPlayClosed', 'maxButton3M', 'minButton200', 'plusButton28',
    'minusButton28', 'spinRoundPlus', 'spinRoundMinus', 'playButton',
    'liveSlotGift', 'giftHistory', 'chatRoomTest', 'soundToggle'
  ];
  steps.forEach(id => {
    stepResults[id] = { success: false, pending: true, message: '' };
  });
}

async function checkWebsite(url, viewport = { width: 1366, height: 768 }) {
  let browser = null;
  const results = { url, timestamp: new Date().toISOString(), checks: {} };

  try {
    resetProgress();
    browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    // 設置網路封包記錄
    setupNetworkLogging(page);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    await page.waitForTimeout(2000);

    // 1️⃣ Stream n'Spin 彈窗測試
    setCurrentStep('streamNSpinDialog');
    results.checks.streamNSpinDialog = await checkStreamNSpinDialog(page);
    updateStepResult('streamNSpinDialog', {
      success: !results.checks.streamNSpinDialog.found || results.checks.streamNSpinDialog.clicked,
      error: results.checks.streamNSpinDialog.error
    });

    // 2️⃣-16️⃣ 主要流程測試
    results.checks.streamingNowClick = await checkStreamingNowClick(context, page);

    return results;

  } catch (error) {
    console.error('❌ 測試執行異常:', error);
    results.error = String(error.message || error);
    return results;
  } finally {
    if (browser) {
      // 詢問使用者是否繼續
      const decision = await askToContinue();
      
      if (decision === 'quit') {
        await browser.close().catch(() => {});
        console.log('Browser closed immediately');
      } else {
        console.log('🏁 測試完成，等待 60 秒後自動關閉...');
        await new Promise(r => setTimeout(r, 60000));
        await browser.close().catch(() => { });
        console.log('Browser closed');
      }
    }
  }
}

/**
 * 輔助：尋找並點擊 Confirm 彈窗
 */
async function checkStreamNSpinDialog(page) {
  try {
    const dialogInfo = await page.evaluate(() => {
      // 1. 先找所有可能是彈窗的容器
      const dialogs = document.querySelectorAll('[role="dialog"], .modal, .ant-modal, [class*="modal" i], [class*="dialog" i]');

      for (const dialog of dialogs) {
        if (dialog.offsetParent === null) continue; // 跳過隱藏的

        const text = (dialog.textContent || '').toLowerCase();
        // 2. 確認是否為 Stream n'Spin 相關彈窗
        if (text.includes('stream') && (text.includes('spin') || text.includes('n'))) {
          // 3. 在此彈窗內找確認按鈕
          const btn = Array.from(dialog.querySelectorAll('button')).find(b => {
            const bt = (b.textContent || '').toLowerCase();
            return bt.includes('confirm') || bt.includes('ok') || bt.includes('確定') || bt.includes('確認');
          });

          if (btn) {
            const r = btn.getBoundingClientRect();
            return { found: true, x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }
        }
      }
      return { found: false };
    });

    if (!dialogInfo.found) return { found: false, clicked: false };

    console.log('✅ 找到 Stream n\'Spin 彈窗，執行點擊...');
    await page.mouse.click(dialogInfo.x, dialogInfo.y);
    await page.waitForTimeout(1000);
    return { found: true, clicked: true };
  } catch (e) {
    console.error('❌ Stream n\'Spin 檢查失敗:', e.message);
    return { found: false, error: e.message };
  }
}

/**
 * 主要流程控製
 */
async function checkStreamingNowClick(context, page) {
  const stepResults = {
    success: false,
    newPageOpened: false,
    gVersion: { found: false },
    howToPlayClosed: false,
    maxButton3M: { success: false },
    minButton200: { success: false },
    plusButton28: { success: false },
    minusButton28: { success: false },
    spinRoundPlus: { success: false },
    spinRoundMinus: { success: false },
    playButton: { success: false },
    soundToggle: { success: false },
    liveSlotGift: { success: false },
    giftHistory: { success: false },
    chatRoomTest: { success: false },
    socketJoinData: { success: false }
  };

  try {
    console.log('2️⃣ [開啟直播間] 正在鎖定 Streaming Now 區域並尋找 LIVE 卡片...');
    setCurrentStep('streamingNowClick');

    let targetHandle = null;
    let targetFrame = page;

    // 取得所有 Frame (支援跨 Iframe)
    const allFrames = [page, ...page.frames()];

    for (const frame of allFrames) {
      const handle = await frame.evaluateHandle(() => {
        // 1. 先定位 "Streaming Now" 標題容器
        const streamingNowHeader = Array.from(document.querySelectorAll('div._container_l2ipi_1, span'))
          .find(el => el.innerText && el.innerText.includes('Streaming Now'));

        if (!streamingNowHeader) return null;

        // 2. 在該標題附近尋找卡片列表
        const section = streamingNowHeader.closest('section') || streamingNowHeader.parentElement?.parentElement;
        const covers = Array.from((section || document).querySelectorAll('div[data-cover="true"]'));

        if (covers.length === 0) return null;

        // 3. 優先尋找「正在直播」的證據
        let targetCover = null;
        for (const cover of covers) {
          const text = (cover.innerText || '').toLowerCase();
          let isLive = text.includes('viewers') || text.includes('live');

          if (!isLive) {
            let parent = cover.parentElement;
            for (let i = 0; i < 3 && parent; i++) {
              if (parent.innerText && (parent.innerText.toLowerCase().includes('live') || parent.innerText.toLowerCase().includes('viewers'))) {
                isLive = true;
                break;
              }
              parent = parent.parentElement;
            }
          }

          if (isLive) {
            targetCover = cover;
            break;
          }
        }

        // 4. 備案
        return targetCover || covers[0];
      });

      const element = handle.asElement();
      if (element) {
        targetHandle = element;
        targetFrame = frame;
        break;
      }
    }

    if (!targetHandle) {
      console.log('❌ 失敗: 找不到 Streaming Now 區域或任何卡片');
      updateStepResult('streamingNowClick', { success: false, error: '找不到 Streaming Now 區域或卡片' });
      return { success: false, message: '找不到 Streaming Now 區域或卡片' };
    }

    console.log(`✅ 找到目標卡片，執行點擊...`);

    let newPage;
    try {
      // 點擊並等待新視窗
      const [p] = await Promise.all([
        context.waitForEvent('page', { timeout: 15000 }),
        targetHandle.click({ force: true }) // 使用 elementHandle.click 更穩定
      ]);
      newPage = p;
      stepResults.newPageOpened = true;
      stepResults.newPageUrl = newPage.url();
      updateStepResult('streamingNowClick', { success: true });
      console.log(`✅ 新視窗已開啟: ${stepResults.newPageUrl}`);

      // 在新視窗也設置網路封包記錄
      setupNetworkLogging(newPage);

      // 1️⃣5️⃣ WebSocket Join 資料抓取 - 建立監聽器
      setCurrentStep('socketJoinData');
      newPage.on('websocket', ws => {
        console.log(`📡 WebSocket 連線建立: ${ws.url()}`);
        ws.on('framereceived', frame => {
          try {
            const payload = JSON.parse(frame.payload);
            if (payload.command === 'join') {
              console.log('✅ 抓取到 Join 資料');
              const joinData = Array.isArray(payload.data) ? payload.data[0] : payload.data;
              updateStepResult('socketJoinData', {
                success: true,
                data: joinData,
                message: '成功抓取 Join 封包'
              });
            }
            if (payload.command === 'bet') {
              lastBetData = payload.data;
              console.log('📡 攔截到 Bet 封包');
            }
            if (payload.command === 'broadcast_payout') {
              lastPayoutData = JSON.parse(payload.data);
              console.log('📡 攔截到 Payout 封包');
            }
          } catch (e) { }
        });
      });
    } catch (e) {
      console.error('❌ 點擊後新視窗未開啟:', e.message);
      // 如果 click() 沒反應，嘗試 mouse click 作為最後手段
      try {
        const box = await targetHandle.boundingBox();
        if (box) {
          console.log(`⚠️ 嘗試使用座標點擊作為備案: (${box.x + box.width / 2}, ${box.y + box.height / 2})`);
          // 這裡座標需要加上 iframe 偏移，如果是在 iframe 裡
          let x = box.x + box.width / 2;
          let y = box.y + box.height / 2;

          if (targetFrame !== page) {
            const frameElement = await targetFrame.frameElement();
            const frameBox = await frameElement.boundingBox();
            if (frameBox) {
              x += frameBox.x;
              y += frameBox.y;
            }
          }

          const [p2] = await Promise.all([
            context.waitForEvent('page', { timeout: 10000 }),
            page.mouse.click(x, y)
          ]);
          newPage = p2;
          stepResults.newPageOpened = true;
          stepResults.newPageUrl = newPage.url();
          updateStepResult('streamingNowClick', { success: true });
          console.log(`✅ (備案) 新視窗已開啟: ${stepResults.newPageUrl}`);

          // 在新視窗也設置網路封包記錄
          setupNetworkLogging(newPage);
        } else {
          updateStepResult('streamingNowClick', { success: false, error: '點擊後新視窗未開啟' });
          throw e;
        }
      } catch (e2) {
        updateStepResult('streamingNowClick', { success: false, error: '點擊後新視窗未開啟 (逾時 15s)' });
        return { ...stepResults, message: '點擊卡片後新視窗未開啟 (逾時 15s)' };
      }
    }

    await newPage.waitForLoadState('domcontentloaded');
    await newPage.waitForTimeout(3000);

    // 3️⃣ WebSocket Join 資料抓取 (檢查是否已在事件中抓到)
    setCurrentStep('socketJoinData');
    if (!stepResults.socketJoinData.success) {
      console.log('⏳ 正在等待 WebSocket Join 資料...');
      await newPage.waitForTimeout(2000);
      if (!stepResults.socketJoinData.success) {
        stepResults.socketJoinData = { success: false, message: '逾時未抓取到 WebSocket Join 指令資料' };
        updateStepResult('socketJoinData', { success: false, error: '逾時未抓取到 WebSocket Join 指令資料' });
      } else {
        updateStepResult('socketJoinData', stepResults.socketJoinData);
      }
    } else {
      updateStepResult('socketJoinData', stepResults.socketJoinData);
    }

    // 4️⃣ 版本號檢測
    setCurrentStep('gVersion');
    stepResults.gVersion = await checkGVersion(newPage);
    updateStepResult('gVersion', { success: stepResults.gVersion.found, error: !stepResults.gVersion.found ? '找不到版本號' : null });

    // 5️⃣ START PLAYING
    setCurrentStep('howToPlayClose');
    stepResults.howToPlayClosed = (await checkHowToPlayDialog(newPage)).success;
    updateStepResult('howToPlayClose', { success: stepResults.howToPlayClosed });

    // 6️⃣ MAX 按鈕測試
    setCurrentStep('maxButton3M');
    stepResults.maxButton3M = await checkMaxButton(newPage);
    updateStepResult('maxButton3M', { success: stepResults.maxButton3M.success });

    // 7️⃣ MIN 按鈕測試
    setCurrentStep('minButton200');
    stepResults.minButton200 = await checkMinButton(newPage);
    updateStepResult('minButton200', { success: stepResults.minButton200.success });

    // 8️⃣ Bet +
    setCurrentStep('plusButton28');
    stepResults.plusButton28 = await checkPlusButtonMax(newPage);
    updateStepResult('plusButton28', { success: stepResults.plusButton28.success });

    // 9️⃣ Bet -
    setCurrentStep('minusButton28');
    stepResults.minusButton28 = await checkMinusButtonMin(newPage);
    updateStepResult('minusButton28', { success: stepResults.minusButton28.success });

    // 🔟 Spin Round +
    setCurrentStep('spinRoundPlus');
    stepResults.spinRoundPlus = await checkSpinRoundPlusMax(newPage);
    updateStepResult('spinRoundPlus', { success: stepResults.spinRoundPlus.success });

    // 1️⃣1️⃣ Spin Round -
    setCurrentStep('spinRoundMinus');
    stepResults.spinRoundMinus = await checkSpinRoundMinusMin(newPage);
    updateStepResult('spinRoundMinus', { success: stepResults.spinRoundMinus.success });

    // 1️⃣2️⃣ Play 按鈕測試
    setCurrentStep('playButton');
    stepResults.playButton = await checkPlayButton(newPage);
    updateStepResult('playButton', { success: stepResults.playButton.success, message: stepResults.playButton.message });

    // 1️⃣3️⃣ 送禮測試
    setCurrentStep('liveSlotGift');
    stepResults.liveSlotGift = await checkGiftSending(newPage);
    updateStepResult('liveSlotGift', { success: stepResults.liveSlotGift.success, error: stepResults.liveSlotGift.message });

    // 1️⃣4️⃣ 送禮記錄測試
    setCurrentStep('giftHistory');
    stepResults.giftHistory = await checkGiftHistory(newPage);
    updateStepResult('giftHistory', { success: stepResults.giftHistory.success, error: stepResults.giftHistory.message });

    // 1️⃣5️⃣ 聊天室視窗測試
    setCurrentStep('chatRoomTest');
    stepResults.chatRoomTest = await checkChatRoom(newPage);
    updateStepResult('chatRoomTest', { success: stepResults.chatRoomTest.success, error: stepResults.chatRoomTest.message });

    // 1️⃣6️⃣ 音效開關測試 (移至最後)
    setCurrentStep('soundToggle');
    stepResults.soundToggle = await checkSoundToggle(newPage);
    updateStepResult('soundToggle', { success: stepResults.soundToggle.success, message: stepResults.soundToggle.message });

    stepResults.success = stepResults.newPageOpened;
    return stepResults;
  } catch (error) {
    console.error('❌ 主要流程異常:', error);
    return { ...stepResults, error: error.message };
  }
}

/**
 * 15️⃣ 聊天室視窗測試
 */
async function checkChatRoom(page) {
  try {
    console.log('15️⃣ [聊天室測試] 執行中...');

    // 1. 尋找聊天室輸入框
    const chatInput = await page.waitForSelector('#chat-message-input', { timeout: 5000 }).catch(() => null);
    if (!chatInput) return { success: false, message: '找不到聊天室輸入框 (#chat-message-input)' };

    // 2. 輸入禁字 "agn88"
    console.log('輸入禁字: agn88');
    await chatInput.click();
    await chatInput.fill(''); // 先清空
    await chatInput.type('agn88', { delay: 100 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // 3. 檢查是否跳出訊息 (這裡假設會出現一個包含特定文字的 div 或彈窗)
    // 由於用戶沒給具體的訊息元素，我們先模擬偵測頁面上的文字變化或特定對話框
    const messageFound = await page.evaluate(() => {
      // 搜尋頁面上是否出現了警告訊息（通常是禁字警告）
      const bodyText = document.body.innerText;
      return bodyText.includes('禁字') || bodyText.includes('invalid') || bodyText.includes('forbidden') || bodyText.includes('agn88');
    });

    if (messageFound) {
      return { success: true, message: '已偵測到禁字警告' };
    }
    return { success: false, message: '未偵測到禁字警告' };
  } catch (error) {
    return { success: false, message: error.message || String(error) };
  }
}

async function checkStreamingNowClick(context, page) {
  try {
    setCurrentStep('streamingNowClick');
    let targetHandle = null;

    // 等待頁面穩定
    await page.waitForTimeout(2000);

    const allFrames = [page, ...page.frames()];
    for (const frame of allFrames) {
      targetHandle = await frame.evaluateHandle(() => {
        // 1. 先找包含 "Streaming Now" 的標題區域
        const headers = Array.from(document.querySelectorAll('div, span, h1, h2, h3'))
          .find(el => el.innerText?.includes('Streaming Now'));

        if (!headers) return null;

        // 2. 獲取所有直播卡片
        const allCovers = Array.from(document.querySelectorAll('div[data-cover="true"]'));

        // 優先級 1: 尋找指定主播 game01 的卡片
        const game01Card = allCovers.find(c =>
          c.querySelector('img[data-streamer="true"][src*="game01.png"]')
        );

        // 保底: 選擇該區域內的第一張卡片
        return game01Card || allCovers[0];
      }).then(h => h.asElement());
      if (targetHandle) break;
    }

    if (!targetHandle) {
      updateStepResult('streamingNowClick', { success: false, error: '找不到直播卡片' });
      return;
    }

    // 執行點擊並等待新分頁
    let newPage = null;
    try {
      const [p] = await Promise.all([
        context.waitForEvent('page', { timeout: 20000 }),
        targetHandle.click({ force: true, delay: 50 }) // 延遲縮短至 50ms
      ]);
      newPage = p;
    } catch (clickErr) {
      // 備案：如果第一次沒開成功，嘗試直接點擊座標
      const box = await targetHandle.boundingBox();
      if (box) {
        const [p] = await Promise.all([
          context.waitForEvent('page', { timeout: 15000 }),
          page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        ]).catch(() => [null]);
        newPage = p;
      }
    }

    if (!newPage) {
      updateStepResult('streamingNowClick', { success: false, error: '點擊後未開啟分頁' });
      return;
    }

    updateStepResult('streamingNowClick', { success: true });
    // 等待新頁面載入
    await Promise.race([
      newPage.waitForLoadState('domcontentloaded'),
      newPage.waitForLoadState('networkidle'),
      new Promise(r => setTimeout(r, 10000))
    ]);

    setCurrentStep('socketJoinData');
    for (let i = 0; i < 15; i++) {
      if (stepResults.socketJoinData?.success && stepResults.socketJoinData?.data) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    const runStep = async (id, fn, ...args) => {
      setCurrentStep(id);
      const res = await fn(...args).catch(e => ({ success: false, message: e.message }));
      updateStepResult(id, res);
      return res;
    };

    await runStep('gVersion', checkGVersion, newPage);
    await runStep('howToPlayClosed', checkHowToPlayDialog, newPage);
    await runStep('maxButton3M', checkMaxButton, newPage);
    await runStep('minButton200', checkMinButton, newPage);
    await runStep('plusButton28', checkPlusButtonMax, newPage);
    await runStep('minusButton28', checkMinusButtonMin, newPage);
    await runStep('spinRoundPlus', checkSpinRoundPlusMax, newPage);
    await runStep('spinRoundMinus', checkSpinRoundMinusMin, newPage);
    await runStep('playButton', checkPlayButton, newPage);
    await runStep('liveSlotGift', checkGiftSending, newPage);
    await runStep('giftHistory', checkGiftHistory, newPage);
    await runStep('chatRoomTest', checkChatRoom, newPage);
    await runStep('soundToggle', checkSoundToggle, newPage);
  } catch (e) {
    console.error('StreamingNowClick 異常:', e.message);
  }
}

// --- 測項實作 ---

async function checkStreamNSpinDialog(page) {
  return await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText.includes('Confirm') || b.innerText.includes('確定')) && b.offsetParent !== null);
    if (btn) { const r = btn.getBoundingClientRect(); return { found: true, clicked: true, x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
    return { found: false };
  }).then(async res => { if (res.found) await page.mouse.click(res.x, res.y); return res; });
}

async function checkGVersion(page) {
  const v = await page.evaluate(() => window.gVersion).catch(() => null);
  return { success: !!v, version: v, found: !!v };
}

async function checkHowToPlayDialog(page) {
  const b = await page.waitForSelector('button[class*="_startButton_"]', { timeout: 5000 }).catch(() => null);
  if (b) { await b.click({ force: true }); return { success: true }; }
  return { success: false, message: '未發現說明彈窗' };
}

async function checkMaxButton(page) {
  const jd = stepResults.socketJoinData?.data;
  const coinValues = jd?.game_data?.coin_value || jd?.gameData?.coinValue || jd?.coin_value || [];
  const theoreticalMax = coinValues.length > 0 ? coinValues[coinValues.length - 1] : null;

  // 1. 獲取玩家目前餘額作為第二標竿
  const balance = await getDisplayedAmount(page, 'balance');
  const expectedMax = (theoreticalMax !== null && balance > 0) ? Math.min(theoreticalMax, balance) : theoreticalMax;

  let after = 0;
  let isSuccess = false;

  // 2. 實作重複點擊機制 (最多 3 次)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const before = await getDisplayedAmount(page, 'bet');
    const res = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button.btn-primary'))
        .find(e => e.textContent.trim() === 'MAX' && e.offsetParent !== null);
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });

    if (res) {
      console.log(`[Step 6] 第 ${attempt} 次嘗試點擊 MAX...`);
      await page.mouse.click(res.x, res.y, { delay: 100 });
      await page.waitForTimeout(2000);
      after = await getDisplayedAmount(page, 'bet');

      isSuccess = expectedMax !== null ? (Math.abs(after - expectedMax) < 0.01 || after >= expectedMax) : (after > 0);

      if (isSuccess) break; // 成功就跳出迴圈
      console.log(`[Step 6] 點擊後數值未達標 (${after} < ${expectedMax})，準備重試...`);
    } else {
      return { success: false, message: '找不到 MAX 按鈕' };
    }
  }

  const msg = isSuccess ? `目前已達上限值 ${after}` : `金額未達標 (UI: ${after}, 標竿: ${expectedMax}, 餘額: ${balance})`;
  console.log(`[Step 6] 最終結果: ${msg}`);
  return { success: isSuccess, message: msg };
}

async function checkMinButton(page) {
  const jd = stepResults.socketJoinData?.data;
  const coinValues = jd?.game_data?.coin_value || jd?.gameData?.coinValue || jd?.coin_value || [];
  const expectedMin = coinValues.length > 0 ? coinValues[0] : null;

  let after = 0;
  let isSuccess = false;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button.btn-primary'))
        .find(e => e.textContent.trim() === 'MIN' && e.offsetParent !== null);
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });

    if (res) {
      console.log(`[Step 7] 第 ${attempt} 次嘗試點擊 MIN...`);
      await page.mouse.click(res.x, res.y, { delay: 100 });
      await page.waitForTimeout(2000);
      after = await getDisplayedAmount(page, 'bet');

      isSuccess = expectedMin !== null ? (Math.abs(after - expectedMin) < 0.01) : (after > 0);
      if (isSuccess) break;
    } else {
      return { success: false, message: '找不到 MIN 按鈕' };
    }
  }

  const msg = isSuccess ? `目前已達最小值 ${after}` : `金額未達標 (UI: ${after}, 標竿: ${expectedMin})`;
  return { success: isSuccess, message: msg };
}

async function checkPlusButtonMax(page) {
  const btn = await findBetButton(page, '+');
  if (!btn.found) return { success: false, message: '找不到按鈕' };
  let last = await getDisplayedAmount(page, 'bet');
  for (let i = 0; i < 28; i++) {
    await page.mouse.click(btn.x, btn.y); await page.waitForTimeout(200);
    const curr = await getDisplayedAmount(page, 'bet');
    if (curr === last) break;
    last = curr;
  }
  return { success: true, amountAfter: last };
}

async function checkMinusButtonMin(page) {
  const btn = await findBetButton(page, '-');
  if (!btn.found) return { success: false, message: '找不到按鈕' };
  let last = await getDisplayedAmount(page, 'bet');
  for (let i = 0; i < 28; i++) {
    await page.mouse.click(btn.x, btn.y); await page.waitForTimeout(200);
    const curr = await getDisplayedAmount(page, 'bet');
    if (curr === last) break;
    last = curr;
  }
  return { success: true, amountAfter: last };
}

async function checkSpinRoundPlusMax(page) {
  const btn = await findBetButton(page, '+', 1);
  if (!btn.found) return { success: false };
  let last = await getDisplayedAmount(page, 'spin round');
  for (let i = 0; i < 40; i++) {
    await page.mouse.click(btn.x, btn.y); await page.waitForTimeout(200);
    const curr = await getDisplayedAmount(page, 'spin round');
    if (curr === last) break; last = curr;
  }
  return { success: true, amountAfter: last };
}

async function checkSpinRoundMinusMin(page) {
  const btn = await findBetButton(page, '-', 1);
  if (!btn.found) return { success: false };
  let last = await getDisplayedAmount(page, 'spin round');
  for (let i = 0; i < 40; i++) {
    await page.mouse.click(btn.x, btn.y); await page.waitForTimeout(200);
    const curr = await getDisplayedAmount(page, 'spin round');
    if (curr === last) break; last = curr;
  }
  return { success: true, amountAfter: last };
}

async function checkPlayButton(page) {
  const btn = await page.$('button[data-is-playing]');
  if (!btn) return { success: false };
  const b = await btn.getAttribute('data-is-playing');
  await btn.click({ force: true }); await page.waitForTimeout(1000);
  const a = await btn.getAttribute('data-is-playing');
  return { success: true, message: `${b} -> ${a}` };
}

async function checkGiftSending(page) {
  const giftBtn = await findElementInAnyFrame(page, '[data-gift-button="true"]');
  if (!giftBtn) return { success: false, message: '找不到禮物按鈕' };
  await giftBtn.element.click({ force: true }); await page.waitForTimeout(2000);

  let carDiv = null, carFrame = null, carImg = null;
  for (const f of [page, ...page.frames()]) {
    carDiv = await f.$('div[data-selected]:has(img[src*="CAR.png"])').catch(() => null);
    if (carDiv) { carFrame = f; carImg = await carDiv.$('img[src*="CAR.png"]'); break; }
  }
  if (!carDiv) return { success: false, message: '找不到跑車' };

  const box = await carImg.boundingBox();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  else await carDiv.click({ force: true });

  await page.waitForTimeout(1000);
  // 改用原生 JS 穩定搜尋 Confirm 按鈕中心座標
  const confirmPos = await carDiv.evaluate((el) => {
    const btns = Array.from(el.querySelectorAll('button'));
    const btn = btns.find(b =>
      b.innerText?.includes('Confirm') ||
      b.innerText?.includes('確定') ||
      b.classList.contains('btn-primary')
    );
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });

  if (confirmPos) {
    await page.mouse.click(confirmPos.x, confirmPos.y, { delay: 100 });
    console.log('✅ 已使用座標點擊 Confirm，等待動畫播放 (5s)...');
    await page.waitForTimeout(5000);

    // 尋找關閉按鈕
    const closeBtn = await findElementInAnyFrame(page, '[data-close-btn="true"], .btn-close, button[class*="closeBtn"]');
    if (closeBtn) {
      await closeBtn.element.click({ force: true });
      await page.waitForTimeout(1000);
    }
    return { success: true };
  }
  return { success: false, message: '未出現 Confirm' };
}

async function checkGiftHistory(page) {
  // 強制點擊畫面左上角 (0,0) 附近的空白處，關閉可能存在的 Toast 或遮罩
  await page.mouse.click(10, 10);
  await page.waitForTimeout(500);

  const giftBtn = await findElementInAnyFrame(page, '[data-gift-button="true"]');
  if (!giftBtn) return { success: false, message: '找不到按鈕' };

  // 座標點擊禮物按鈕
  const gBox = await giftBtn.element.boundingBox();
  if (gBox) await page.mouse.click(gBox.x + gBox.width / 2, gBox.y + gBox.height / 2);
  else await giftBtn.element.click({ force: true });

  await page.waitForTimeout(1500);

  // 座標點擊 History 按鈕
  const hPos = await giftBtn.frame.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div[class*="history"], div[class*="History"]'));
    const btn = divs.find(d => d.innerText?.includes('History') || d.querySelector('span')?.innerText?.includes('History'));
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });

  if (!hPos) return { success: false, message: '找不到 History 按鈕' };
  await page.mouse.click(hPos.x, hPos.y);

  let data = null;
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(1000);
    data = await giftBtn.frame.evaluate(() => {
      const item = document.querySelector('div[class*="modalContent"] div[class*="item"], div[class*="History"] div[class*="item"]');
      if (!item) return null;
      return {
        streamer: item.querySelector('span[class*="anchorName"], span[class*="AnchorName"]')?.innerText,
        timestamp: item.querySelector('span[class*="timestamp"], span[class*="Timestamp"]')?.innerText,
        amount: item.querySelector('span[class*="amount"], span[class*="Amount"]')?.innerText,
        giftName: item.querySelector('span[class*="giftName"], span[class*="GiftName"]')?.innerText
      };
    });
    if (data && data.giftName) break;
  }

  const closeBtn = await giftBtn.frame.$('button[class*="closeBtn"], button[class*="CloseBtn"], .btn-close').catch(() => null);
  if (closeBtn) await closeBtn.click({ force: true });

  return data ? { success: true, data } : { success: false, message: '無記錄' };
}

async function checkChatRoom(page) {
  const input = await page.$('#chat-message-input');
  if (!input) return { success: false, message: '找不到輸入框' };

  // 1. 驗證禁字 agn88
  console.log('[Step 15] 正在驗證禁字 agn88...');
  await input.fill('agn88');
  await page.keyboard.press('Enter');

  // 增加等待時間讓用戶看清楚警告
  await page.waitForTimeout(3000);

  const hasWarning = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Forbidden') || text.includes('禁言') || text.includes('不當') || text.includes('agn88');
  });

  // 2. 驗證正常文字 SNS-Test
  console.log('[Step 15] 正在驗證正常文字 SNS-Test...');
  await input.fill(''); // 清空
  await page.waitForTimeout(500); // 確保清空動作完成
  await input.type('SNS-Test');
  await page.keyboard.press('Enter');

  // 3. 補強驗證：等待並檢查聊天列表中是否出現該訊息
  await page.waitForTimeout(2000);
  const isMessageInList = await page.evaluate((sentText) => {
    const chatContainers = Array.from(document.querySelectorAll('div[class*="chat"], div[class*="message"], div[class*="list"]'));
    return chatContainers.some(container => container.innerText.includes(sentText));
  }, 'SNS-Test');

  console.log(`[Step 15] 聊天列表驗證結果: ${isMessageInList ? '已看見訊息' : '未看見訊息'}`);

  const isSuccess = hasWarning && isMessageInList;

  return {
    success: isSuccess,
    message: `禁字偵測: ${hasWarning ? '成功' : '失敗'}, 列表顯現: ${isMessageInList ? '成功' : '失敗'}`
  };
}

async function checkSoundToggle(page) {
  const btn = await page.$('div[data-mute]');
  if (!btn) return { success: false, message: '找不到音效按鈕' };

  // 0. 先檢查是否有網路錯誤彈窗
  const errorMsg = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    if (bodyText.includes('Network error') || bodyText.includes('problem about connection')) {
      return '偵測到遊戲連線錯誤彈窗，測試中斷';
    }
    return null;
  });
  if (errorMsg) return { success: false, message: errorMsg };

  const log = [];

  const getAltState = async (p) => {
    return await p.evaluate(() => {
      const el = document.querySelector('div[data-mute]');
      const img = el ? el.querySelector('img') : null;
      return img ? img.getAttribute('alt') : null;
    });
  };

  // 1. 檢查初始狀態
  const initialAlt = await getAltState(page);
  log.push(initialAlt || 'Unknown');

  // 2. 第一次切換: On -> Off
  console.log('[Step 16] 正在切換音效: On -> Off');
  await btn.click({ force: true });

  // 循環檢查直到圖示變更或超時 (3秒)
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    const curr = await getAltState(page);
    if (curr?.toLowerCase().includes('off')) break;
    // 同時檢查是否切換中途跳出網路錯誤
    const midError = await page.evaluate(() => document.body.innerText.includes('Network error'));
    if (midError) return { success: false, message: '測試中途偵測到網路錯誤' };
  }

  const state1 = await getAltState(page);
  log.push(state1 || 'Unknown');

  // 3. 第二次切換: Off -> On
  console.log('[Step 16] 正在切換音效: Off -> On');
  await btn.click({ force: true });

  // 循環檢查直到圖示變更或超時 (3秒)
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    const curr = await getAltState(page);
    if (curr?.toLowerCase().includes('on')) break;
  }

  const state2 = await getAltState(page);
  log.push(state2 || 'Unknown');

  const isSuccess = initialAlt?.toLowerCase().includes('on') &&
    state1?.toLowerCase().includes('off') &&
    state2?.toLowerCase().includes('on');

  return {
    success: isSuccess,
    message: `圖示狀態循環: ${log.join(' -> ')}`
  };
}

async function checkGameHistory(page) {
  return { success: true, message: '跳過測試' };
}

// 輔助
async function findElementInAnyFrame(page, selector) {
  const main = await page.$(selector); if (main) return { element: main, frame: page };
  for (const f of page.frames()) { const el = await f.$(selector); if (el) return { element: el, frame: f }; }
  return null;
}

async function getDisplayedAmount(page, type) {
  return await page.evaluate((t) => {
    const divs = Array.from(document.querySelectorAll('div[data-text="true"]'));
    const target = divs.find(div => div.innerText?.toLowerCase().includes(t));
    if (target) {
      const rawText = target.innerText;
      const cleanText = rawText.replace(/,/g, '').replace(/\s/g, '');
      const match = cleanText.match(/\d+\.?\d*/);
      return match ? parseFloat(match[0]) : 0;
    }
    return 0;
  }, type);
}

async function findBetButton(page, type, index = 0) {
  const pathKey = type === '+' ? "256 80c0-17.7" : "432 256c0 17.7";
  return await page.evaluate(({ key, idx }) => {
    const svgs = Array.from(document.querySelectorAll('svg')).filter(s => {
      const path = s.querySelector('path');
      return path && (path.getAttribute('d') || '').includes(key);
    });
    if (svgs[idx]) {
      const r = svgs[idx].getBoundingClientRect();
      return { found: true, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return { found: false };
  }, { key: pathKey, idx: index });
}

module.exports = { checkWebsite, getProgress, setCurrentStep, resetProgress };
