const { findBetButton, getDisplayedAmount } = require('./utils');

/**
 * 8️⃣ Bet + 按鈕測試
 * @param {import('playwright').Page} page
 */
async function checkPlusButtonMax(page) {
  const btn = await findBetButton(page, '+');
  if (!btn.found) return { success: false, message: '找不到按鈕' };
  let last = await getDisplayedAmount(page, 'bet');
  for (let i = 0; i < 28; i++) {
    await page.mouse.click(btn.x, btn.y); 
    await page.waitForTimeout(200);
    const curr = await getDisplayedAmount(page, 'bet');
    if (curr === last) break;
    last = curr;
  }
  return { success: true, amountAfter: last };
}

module.exports = checkPlusButtonMax;
