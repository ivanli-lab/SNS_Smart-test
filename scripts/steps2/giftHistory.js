const { findElementInAnyFrame } = require('./utils');

/**
 * 1️⃣4️⃣ 送禮記錄測試
 * @param {import('playwright').Page} page
 */
async function checkGiftHistory(page) {
  // 強制點擊畫面左上角 (0,0) 附近的空白處，關閉可能存在的 Toast 或遮罩
  await page.mouse.click(10, 10);
  await page.waitForTimeout(500);

  const giftBtn = await findElementInAnyFrame(page, '[data-gift-button="true"]');
  if (!giftBtn) return { success: false, message: '找不到按鈕' };
  
  // 座標點擊禮物按鈕
  const gBox = await giftBtn.element.boundingBox();
  if (gBox) await page.mouse.click(gBox.x + gBox.width/2, gBox.y + gBox.height/2);
  else await giftBtn.element.click({ force: true });
  
  await page.waitForTimeout(1500);
  
  // 座標點擊 History 按鈕
  const hPos = await giftBtn.frame.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div[class*="history"], div[class*="History"]'));
    const btn = divs.find(d => d.innerText?.includes('History') || d.querySelector('span')?.innerText?.includes('History'));
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 };
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

module.exports = checkGiftHistory;
