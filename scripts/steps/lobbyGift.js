/**
 * 🔟 Lobby 送禮功能測試 (精準簡化版)
 * 邏輯：
 * 1. 攔截 1026 封包：
 *    - Request Payload: 解碼提取 anchor_name
 *    - Response Body: 解碼提取 credit (餘額)
 * 2. 數據等待機制：確保異步攔截的數據在結果回傳前已就緒
 * 
 * @param {import('playwright').Page} page
 * @param {string} _timestamp
 */
async function checkLobbyGift(page, _timestamp) {
  try {
    console.log('🔟 開始執行 Lobby 送禮測試 (精準簡化版)...');
    
    let networkBalance = null;
    let targetAnchorName = null;
    let giftPrice = 0;

    // --- 1. 設置網絡攔截器 ---
    page.on('request', request => {
      const url = request.url();
      if (url.includes('ap.ingmsrv.cc')) {
        try {
          const payload = request.postData();
          if (payload) {
            const decoded = Buffer.from(payload, 'base64').toString();
            const json = JSON.parse(decoded);
            
            if (json.command === 1026) {
              // 精準提取 anchor_name (處理二次解碼)
              let data = json.data;
              if (typeof data === 'string') {
                data = JSON.parse(Buffer.from(data, 'base64').toString());
              }
              targetAnchorName = data.anchor_name || data.anchorName || 'Unknown';
              console.log(`[Network] 📡 攔截到 1026 請求，目標: ${targetAnchorName}`);
            }
          }
        } catch (e) {}
      }
    });

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('ap.ingmsrv.cc')) {
        try {
          const text = await response.text();
          const decoded = Buffer.from(text, 'base64').toString();
          const json = JSON.parse(decoded);
          
          // 憑「長相」認人：識別 1026 送禮回應的特有結構
          // 結構: {"data":[{"error_code":0,"message":"success","data":{"credit":29999000}}]}
          const credit = json.data?.[0]?.data?.credit;
          const msg = json.data?.[0]?.message;

          if (credit !== undefined && msg === 'success') {
            networkBalance = parseFloat(credit);
            console.log(`[Network] 📡 憑結構識別成功！攔截到 1026 餘額: ${networkBalance}`);
          }
        } catch (e) {}
      }
    });

    // --- 2. 初始狀態重置 ---
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // --- 3. 開啟送禮面板 ---
    const giftBtnInfo = await page.evaluate(() => {
      const btn = document.querySelector('div[class*="_giftButton_"]');
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center' });
      const rect = btn.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    if (!giftBtnInfo) throw new Error('找不到送禮按鈕');
    await page.mouse.click(giftBtnInfo.x, giftBtnInfo.y);
    await page.waitForTimeout(1500);

    // --- 4. 初始餘額偵測 (視覺) ---
    const balanceBefore = await page.evaluate(() => {
      const modal = document.querySelector('div[class*="_giftContainer_"], div[class*="_modal_"]');
      const els = Array.from((modal || document.body).querySelectorAll('*'));
      for (const el of els) {
        const text = (el.textContent || '').trim();
        if (text.toLowerCase().includes('balance') && text.match(/[0-9,.]+/)) {
          const val = parseFloat(text.match(/[0-9,.]+/)[0].replace(/,/g, ''));
          if (val > 1000) return val;
        }
      }
      return 0;
    });
    console.log(`判定初始餘額: ${balanceBefore}`);

    // --- 5. 選擇跑車 (CAR) ---
    const carInfo = await page.evaluate(() => {
      const img = document.querySelector('div[class*="_giftImage_"] img[src*="CAR"]');
      if (!img) return null;
      const itemRoot = img.closest('div[class*="_giftItem_"]');
      const rect = img.getBoundingClientRect();
      const priceText = itemRoot?.querySelector('[class*="_price_"]')?.textContent.trim().toUpperCase() || '0';
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, priceText };
    });
    if (!carInfo) throw new Error('找不到跑車禮物');
    
    giftPrice = parseFloat(carInfo.priceText.replace(/[^0-9.]/g, '')) || 0;
    if (carInfo.priceText.includes('K')) giftPrice *= 1000;
    if (carInfo.priceText.includes('M')) giftPrice *= 1000000;
    
    await page.mouse.click(carInfo.x, carInfo.y);
    await page.waitForTimeout(800);

    // --- 6. 點擊 Confirm 送出 ---
    const confirmBtnInfo = await page.evaluate(() => {
      const btn = document.querySelector('button[class*="_confirmButtonInGift_"]');
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    if (!confirmBtnInfo) throw new Error('找不到確認按鈕');
    
    await page.mouse.click(confirmBtnInfo.x, confirmBtnInfo.y);
    console.log('已點擊 Confirm，等待 1026 封包與動畫觸發 (最多 8s)...');

    // 🚀 核心修正：點擊 Confirm 後，先強制等待 3 秒，讓送禮動畫有時間在視窗關閉前「跳出來」
    // 這是模擬真人操作，點完後會先看一眼動畫，而不是秒關視窗
    await page.waitForTimeout(3000);

    // --- 7. 最終判定 ---
    let finalBalanceAfter = null;
    for (let i = 0; i < 16; i++) {
      if (networkBalance !== null) {
        finalBalanceAfter = networkBalance;
        break;
      }
      await page.waitForTimeout(500);
    }

    // 視覺備援
    if (finalBalanceAfter === null) {
      console.log('⚠️ 網絡餘額未更新，嘗試視覺抓取...');
      finalBalanceAfter = await page.evaluate(() => {
        const modal = document.querySelector('div[class*="_giftContainer_"], div[class*="_modal_"]');
        if (!modal) return null;
        const els = Array.from(modal.querySelectorAll('*'));
        for (const el of els) {
          const text = (el.textContent || '').trim();
          if (text.toLowerCase().includes('balance') && text.match(/[0-9,.]+/)) {
            const val = parseFloat(text.match(/[0-9,.]+/)[0].replace(/,/g, ''));
            if (val > 10000) return val;
          }
        }
        return null;
      }) || balanceBefore;
    }

    const diff = balanceBefore - finalBalanceAfter;
    const isCorrectAmount = Math.abs(diff - giftPrice) < 2;

    await page.evaluate(() => document.querySelector('button[class*="_closeButton_"]')?.click()).catch(() => {});

    // 🚀 核心修正：點擊關閉後，額外等待 5 秒讓送禮動畫（如跑車動畫）跑完，避免干擾下一項測試
    console.log('🎬 正在等待送禮動畫播放結束 (5s)...');
    await page.waitForTimeout(5000);

    return {
      success: true,
      giftAmount: giftPrice,
      anchorName: targetAnchorName || 'Unknown',
      balanceBefore,
      balanceAfter: finalBalanceAfter,
      isDeducted: finalBalanceAfter < balanceBefore,
      isCorrectAmount,
      deductionAmount: diff,
      source: networkBalance !== null ? 'network' : 'visual',
      message: `✅ 成功送禮給 [${targetAnchorName || '未知'}]！餘額減少 ${diff} (來源: ${networkBalance !== null ? '網絡' : '視覺'})`
    };

  } catch (error) {
    console.error('Lobby 送禮測試失敗:', error.message);
    return { success: false, error: error.message, message: `測試出錯: ${error.message}` };
  }
}

module.exports = checkLobbyGift;
