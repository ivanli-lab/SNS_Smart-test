const { getDisplayedAmount } = require('./utils');

/**
 * 7️⃣ MIN 按鈕測試
 * @param {import('playwright').Page} page
 * @param {Object} socketJoinData
 */
async function checkMinButton(page, socketJoinData) {
  // 增加耐受性：等待 UI 完全穩定
  await page.waitForTimeout(1000);

  const jd = socketJoinData?.data;
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

module.exports = checkMinButton;
