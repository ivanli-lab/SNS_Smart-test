const { findElementInAnyFrame } = require('./utils');

/**
 * 1️⃣3️⃣ 送禮測試 (Live Slot 內部)
 * @param {import('playwright').Page} page
 * @param {Object} socketJoinData
 * @param {Function} getGiftDataFn - 獲取攔截到的送禮封包數據的函數
 */
async function checkGiftSending(page, socketJoinData, getGiftDataFn) {
  const giftBtn = await findElementInAnyFrame(page, '[data-gift-button="true"]');
  if (!giftBtn) return { success: false, message: '找不到禮物按鈕' };
  await giftBtn.element.click({ force: true }); 
  await page.waitForTimeout(2000);
  
  let carDiv = null, carImg = null;
  for (const f of [page, ...page.frames()]) {
    carDiv = await f.$('div[data-selected]:has(img[src*="CAR.png"])').catch(() => null);
    if (carDiv) { 
      carImg = await carDiv.$('img[src*="CAR.png"]'); 
      break; 
    }
  }
  if (!carDiv) return { success: false, message: '找不到跑車' };
  
  const box = await carImg.boundingBox();
  if (box) await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
  else await carDiv.click({ force: true });
  
  await page.waitForTimeout(1000);
  const confirmPos = await carDiv.evaluate((el) => {
    const btns = Array.from(el.querySelectorAll('button'));
    const btn = btns.find(b => 
      b.innerText?.includes('Confirm') || 
      b.innerText?.includes('確定') ||
      b.classList.contains('btn-primary')
    );
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 };
  });

  if (confirmPos) {
    await page.mouse.click(confirmPos.x, confirmPos.y, { delay: 100 }); 
    console.log('✅ 已點擊 Confirm，等待送禮封包與動畫 (5s)...');
    
    // 等待 5 秒，同時監控是否有抓到封包
    await page.waitForTimeout(5000); 
    
    const lastGiftData = getGiftDataFn();
    let giftDetails = '(數據未抓取)';
    if (lastGiftData) {
      try {
        const giftId = lastGiftData.number;
        const jd = socketJoinData?.data;
        const giftList = jd?.game_data?.gift || jd?.gift || [];
        const match = giftList.find(g => g.id == giftId);
        if (match) {
          giftDetails = `${match.name} (${match.cost})`;
        } else {
          giftDetails = `ID: ${giftId}`;
        }
      } catch (err) {
        console.error('解析送禮封包失敗:', err);
      }
    }

    // 尋找關閉按鈕
    const closeBtn = await findElementInAnyFrame(page, '[data-close-btn="true"], .btn-close, button[class*="closeBtn"]');
    if (closeBtn) {
      await closeBtn.element.click({ force: true });
      await page.waitForTimeout(1000);
    }
    
    return { success: true, message: `已發送: ${giftDetails}` };
  }
  return { success: false, message: '未出現 Confirm' };
}

module.exports = checkGiftSending;
