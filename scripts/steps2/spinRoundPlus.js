const { findBetButton, getDisplayedAmount } = require('./utils');

/**
 * 🔟 Spin Round + 按鈕測試
 * @param {import('playwright').Page} page
 */
async function checkSpinRoundPlusMax(page) {
  const btn = await findBetButton(page, '+', 1);
  if (!btn.found) return { success: false };
  let last = await getDisplayedAmount(page, 'spin round');
  for (let i = 0; i < 40; i++) {
    await page.mouse.click(btn.x, btn.y); 
    await page.waitForTimeout(200);
    const curr = await getDisplayedAmount(page, 'spin round');
    if (curr === last) break; 
    last = curr;
  }
  return { success: true, amountAfter: last };
}

module.exports = checkSpinRoundPlusMax;
