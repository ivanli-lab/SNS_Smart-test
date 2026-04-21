const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { askToContinue } = require('../utils/interaction');
const {
  checkGVersion,
  checkStreamNSpinDialog,
  checkRenameFunction,
  checkStreamingNowCount,
  checkSortButton,
  checkPromotionImages,
  checkAllStreamersImages,
  checkAllStreamersSortButton,
  checkStreamerCardClick,
  checkLobbyGift,
  checkRankingData,
  checkStreamerPhoto,
  checkBackButton
} = require('../scripts/steps');

// 截圖管理
const screenshotDir = path.join(__dirname, '../public/screenshots/lobby');
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

async function clearScreenshots() {
  try {
    const files = fs.readdirSync(screenshotDir);
    for (const file of files) {
      fs.unlinkSync(path.join(screenshotDir, file));
    }
    console.log(`\x1b[33m[DIAG] 已清空 Lobby 舊截圖目錄: ${screenshotDir}\x1b[0m`);
  } catch (e) {
    console.error(`[DIAG ERROR] 清空 Lobby 截圖失敗: ${e.message}`);
  }
}

async function takeStepScreenshot(page, stepName, status) {
  try {
    if (!page || page.isClosed()) return;
    // [優化] 僅在失敗時截圖，減輕系統負擔
    if (status !== 'fail' && stepName !== 'step0-nav') return;
    
    const filename = `${stepName}-${status}-${Date.now()}.png`;
    const filepath = path.join(screenshotDir, filename);
    await page.screenshot({ path: filepath });
    console.log(`\x1b[33m[DIAG] 已儲存 Lobby 截圖: ${filename}\x1b[0m`);
  } catch (e) {
    console.error(`[DIAG ERROR] Lobby 截圖失敗: ${e.message}`);
  }
}

// Real-time progress tracking
let currentStep = null;
const stepResults = {};
const totalSteps = 13;

function setCurrentStep(stepKey) {
  currentStep = stepKey;
}

function updateStepResult(stepKey, result) {
  stepResults[stepKey] = result;
}

function getProgress() {
  return { currentStep, stepResults, totalSteps };
}

function resetProgress() {
  currentStep = null;
  Object.keys(stepResults).forEach(key => delete stepResults[key]);
}

async function checkWebsite(url, viewport = { width: 1366, height: 768 }) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  
  // --- 全域變數與 API 攔截器狀態 ---
  let globalRankingData = null;
  let isRankingInterceptorActive = false; // 預設關閉，第 9 點才開啟

  page.on('response', async response => {
    const resUrl = response.url();
    // 修正：攔截網址改為 ap.ingmsrv.cc
    if (isRankingInterceptorActive && resUrl.includes('ap.ingmsrv.cc')) {
      try {
        const text = await response.text();
        const decoded = Buffer.from(text, 'base64').toString();
        const json = JSON.parse(decoded);
        
        const findRanking = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          // 精準識別：檢查 command 1021
          if (obj.command === 1021 || (obj.data && obj.data.ranking_30d)) return obj;
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const r = findRanking(item);
              if (r) return r;
            }
          } else {
            for (const key in obj) {
              const r = findRanking(obj[key]);
              if (r) return r;
            }
          }
          return null;
        };

        const ranking = findRanking(json);
        if (ranking) {
          globalRankingData = ranking;
          console.log('📡 [Interceptor] 成功在 ap.ingmsrv.cc 捕捉到 1021 封包');
        }
      } catch (e) {
        // 忽略
      }
    }
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const results = {
    url,
    timestamp: new Date().toISOString(),
    checks: {},
    debug: {}
  };

  // Reset progress before starting
  resetProgress();
  await clearScreenshots();

  try {
    console.log(`Start navigation to ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      console.log('networkidle timed out, retry with domcontentloaded');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    await page.waitForTimeout(1500);
    await takeStepScreenshot(page, 'step0-nav', 'success');

    // 1️⃣ gVersion 版號測試
    setCurrentStep('gVersion');
    try {
      results.checks.gVersion = await checkGVersion(page);
      updateStepResult('gVersion', { ...results.checks.gVersion, success: results.checks.gVersion.found });
      await takeStepScreenshot(page, 'step1-gVersion', results.checks.gVersion.found ? 'success' : 'fail');
      console.log('1️⃣ gVersion 版號測試:', JSON.stringify(results.checks.gVersion));
    } catch (err) {
      results.checks.gVersion = { found: false, error: String(err && err.message || err) };
      updateStepResult('gVersion', { success: false, error: results.checks.gVersion.error });
      await takeStepScreenshot(page, 'step1-gVersion', 'fail');
    }

    // 2️⃣ Stream n'Spin 彈窗測試
    setCurrentStep('streamNSpinDialog');
    try {
      results.checks.streamNSpinDialog = await checkStreamNSpinDialog(page, timestamp);
      const snSuccess = results.checks.streamNSpinDialog.found ? results.checks.streamNSpinDialog.clicked : true;
      updateStepResult('streamNSpinDialog', { ...results.checks.streamNSpinDialog, success: snSuccess });
      await takeStepScreenshot(page, 'step2-dialog', snSuccess ? 'success' : 'fail');
      console.log('2️⃣ Stream n\'Spin 彈窗測試:', JSON.stringify(results.checks.streamNSpinDialog));
    } catch (err) {
      results.checks.streamNSpinDialog = { found: false, error: String(err && err.message || err) };
      updateStepResult('streamNSpinDialog', { success: false, error: results.checks.streamNSpinDialog.error });
      await takeStepScreenshot(page, 'step2-dialog', 'fail');
    }

    // 3️⃣ 更名功能測試
    setCurrentStep('renameFunction');
    try {
      results.checks.renameFunction = await checkRenameFunction(page, timestamp);
      const isRenameSuccess = results.checks.renameFunction.confirmButtonClicked || 
                             results.checks.renameFunction.confirmClicked;
      updateStepResult('renameFunction', { 
        ...results.checks.renameFunction,
        success: isRenameSuccess
      });
      await takeStepScreenshot(page, 'step3-rename', isRenameSuccess ? 'success' : 'fail');
      console.log('3️⃣ 更名功能測試:', JSON.stringify(results.checks.renameFunction));
    } catch (err) {
      results.checks.renameFunction = { 
        clicked: false, 
        confirmButtonClicked: false,
        error: String(err && err.message || err) 
      };
      updateStepResult('renameFunction', { success: false, error: results.checks.renameFunction.error });
      await takeStepScreenshot(page, 'step3-rename', 'fail');
    }

    // 4️⃣ Streaming Now 已開啟的直播間
    setCurrentStep('streamingNowCount');
    try {
      results.checks.streamingNowCount = await checkStreamingNowCount(page);
      updateStepResult('streamingNowCount', results.checks.streamingNowCount);
      await takeStepScreenshot(page, 'step4-streamingCount', results.checks.streamingNowCount.success ? 'success' : 'fail');
      console.log('4️⃣ Streaming Now 已開啟的直播間:', JSON.stringify(results.checks.streamingNowCount));
    } catch (err) {
      results.checks.streamingNowCount = { success: false, error: String(err && err.message || err) };
      updateStepResult('streamingNowCount', results.checks.streamingNowCount);
      await takeStepScreenshot(page, 'step4-streamingCount', 'fail');
    }

    // 5️⃣ 排序按鈕測試 (先左後右)
    setCurrentStep('sortButton');
    try {
      results.checks.sortButton = await checkSortButton(page, timestamp);
      const sortSuccess = results.checks.sortButton.clicked && results.checks.sortButton.sortWorking;
      updateStepResult('sortButton', { ...results.checks.sortButton, success: sortSuccess });
      await takeStepScreenshot(page, 'step5-sort', sortSuccess ? 'success' : 'fail');
      console.log('5️⃣ 排序按鈕測試:', JSON.stringify(results.checks.sortButton));
    } catch (err) {
      results.checks.sortButton = { clicked: false, sortWorking: false, error: String(err && err.message || err) };
      updateStepResult('sortButton', { success: false, error: results.checks.sortButton.error });
      await takeStepScreenshot(page, 'step5-sort', 'fail');
    }

    // 6️⃣ Promotion 圖片檢查
    setCurrentStep('promotionImages');
    try {
      results.checks.promotionImages = await checkPromotionImages(page, timestamp);
      const promoSuccess = results.checks.promotionImages.found && results.checks.promotionImages.allImagesOK;
      updateStepResult('promotionImages', { ...results.checks.promotionImages, success: promoSuccess });
      await takeStepScreenshot(page, 'step6-promotion', promoSuccess ? 'success' : 'fail');
      console.log('6️⃣ Promotion 圖片檢查:', JSON.stringify(results.checks.promotionImages));
    } catch (err) {
      results.checks.promotionImages = { found: false, error: String(err && err.message || err) };
      updateStepResult('promotionImages', { success: false, error: results.checks.promotionImages.error });
      await takeStepScreenshot(page, 'step6-promotion', 'fail');
    }

    // 7️⃣ All Streamers 圖片檢查
    setCurrentStep('allStreamersImages');
    try {
      results.checks.allStreamersImages = await checkAllStreamersImages(page, timestamp);
      updateStepResult('allStreamersImages', results.checks.allStreamersImages);
      await takeStepScreenshot(page, 'step7-allStreamersImg', results.checks.allStreamersImages.success ? 'success' : 'fail');
      console.log('7️⃣ All Streamers 圖片檢查:', JSON.stringify(results.checks.allStreamersImages));
    } catch (err) {
      results.checks.allStreamersImages = { success: false, error: String(err && err.message || err) };
      updateStepResult('allStreamersImages', results.checks.allStreamersImages);
      await takeStepScreenshot(page, 'step7-allStreamersImg', 'fail');
    }

    // 8️⃣ All Streamers 排列按鈕測試
    setCurrentStep('allStreamersSortButton');
    try {
      results.checks.allStreamersSortButton = await checkAllStreamersSortButton(page, timestamp);
      updateStepResult('allStreamersSortButton', results.checks.allStreamersSortButton);
      await takeStepScreenshot(page, 'step8-allStreamersSort', results.checks.allStreamersSortButton.success ? 'success' : 'fail');
      console.log('8️⃣ All Streamers 排列按鈕測試:', JSON.stringify(results.checks.allStreamersSortButton));
    } catch (err) {
      results.checks.allStreamersSortButton = { success: false, error: String(err && err.message || err) };
      updateStepResult('allStreamersSortButton', { success: false, error: results.checks.allStreamersSortButton.error });
      await takeStepScreenshot(page, 'step8-allStreamersSort', 'fail');
    }

    // 9️⃣ 直播主介紹卡片點擊測試
    setCurrentStep('streamerCardClick');
    try {
      // 在點擊前開啟排行榜攔截器
      isRankingInterceptorActive = true;
      console.log('📡 [System] 已啟動 GS 1021 排行榜攔截器');
      
      results.checks.streamerCardClick = await checkStreamerCardClick(page, timestamp);
      updateStepResult('streamerCardClick', results.checks.streamerCardClick);
      await takeStepScreenshot(page, 'step9-cardClick', results.checks.streamerCardClick.success ? 'success' : 'fail');
      console.log('9️⃣ 直播主介紹卡片點擊測試:', JSON.stringify(results.checks.streamerCardClick));
    } catch (err) {
      results.checks.streamerCardClick = { success: false, error: String(err && err.message || err) };
      updateStepResult('streamerCardClick', { success: false, error: results.checks.streamerCardClick.error });
      await takeStepScreenshot(page, 'step9-cardClick', 'fail');
    }

    // 🔟 Lobby 送禮功能
    setCurrentStep('lobbyGift');
    try {
      results.checks.lobbyGift = await checkLobbyGift(page, timestamp);
      updateStepResult('lobbyGift', results.checks.lobbyGift);
      await takeStepScreenshot(page, 'step10-gift', results.checks.lobbyGift.success ? 'success' : 'fail');
      console.log('🔟 Lobby 送禮功能:', JSON.stringify(results.checks.lobbyGift));
    } catch (err) {
      results.checks.lobbyGift = { success: false, error: String(err && err.message || err) };
      updateStepResult('lobbyGift', { success: false, error: results.checks.lobbyGift.error });
      await takeStepScreenshot(page, 'step10-gift', 'fail');
    }

    // 1️⃣1️⃣ 排行榜檢查
    setCurrentStep('rankingData');
    try {
      results.checks.rankingData = await checkRankingData(page, timestamp, () => globalRankingData);
      updateStepResult('rankingData', results.checks.rankingData);
      await takeStepScreenshot(page, 'step11-ranking', results.checks.rankingData.success ? 'success' : 'fail');
      console.log('1️⃣1️⃣ 排行榜檢查:', JSON.stringify(results.checks.rankingData));
    } catch (err) {
      results.checks.rankingData = { success: false, error: String(err && err.message || err) };
      updateStepResult('rankingData', { success: false, error: results.checks.rankingData.error });
      await takeStepScreenshot(page, 'step11-ranking', 'fail');
    }

    // 1️⃣2️⃣ 直播主照片檢查
    setCurrentStep('streamerPhoto');
    try {
      results.checks.streamerPhoto = await checkStreamerPhoto(page, timestamp);
      updateStepResult('streamerPhoto', results.checks.streamerPhoto);
      await takeStepScreenshot(page, 'step12-photo', results.checks.streamerPhoto.success ? 'success' : 'fail');
      console.log('1️⃣2️⃣ 直播主照片檢查:', JSON.stringify(results.checks.streamerPhoto));
    } catch (err) {
      results.checks.streamerPhoto = { success: false, error: String(err && err.message || err) };
      updateStepResult('streamerPhoto', { success: false, error: results.checks.streamerPhoto.error });
      await takeStepScreenshot(page, 'step12-photo', 'fail');
    }

    // 1️⃣3️⃣ 返回按鈕測試（返回上一頁）
    setCurrentStep('backButton');
    try {
      results.checks.backButton = await checkBackButton(page, timestamp);
      updateStepResult('backButton', results.checks.backButton);
      await takeStepScreenshot(page, 'step13-back', results.checks.backButton.success ? 'success' : 'fail');
      console.log('1️⃣3️⃣ 返回按鈕測試:', JSON.stringify(results.checks.backButton));
    } catch (err) {
      results.checks.backButton = { success: false, error: String(err && err.message || err) };
      updateStepResult('backButton', { success: false, error: results.checks.backButton.error });
      await takeStepScreenshot(page, 'step13-back', 'fail');
    }
  } catch (error) {
    console.error('checkWebsite error:', error);
    results.error = String(error && error.message || error);
    results.stack = error && error.stack ? error.stack : undefined;
  } finally {
    setCurrentStep(null);
    
    // 詢問使用者是否繼續
    const decision = await askToContinue();
    
    if (decision === 'quit') {
      await browser.close().catch(() => {});
      console.log('Browser closed immediately');
    } else {
      console.log('💡 瀏覽器將保持開啟 60 秒後自動關閉...');
      await page.waitForTimeout(60000).catch(() => {});
      await browser.close().catch(() => {});
      console.log('Browser closed');
    }
  }

  return results;
}

module.exports = { checkWebsite, getProgress, setCurrentStep, resetProgress };
