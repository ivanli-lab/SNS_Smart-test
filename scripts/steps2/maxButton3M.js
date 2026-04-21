const { getDisplayedAmount } = require('./utils');

/**
 * 6️⃣ MAX 按鈕測試
 * @param {import('playwright').Page} page
 * @param {Object} socketJoinData
 */
async function checkMaxButton(page, socketJoinData) {
  // 增加耐受性：等待 UI 完全穩定
  await page.waitForTimeout(1500);
  
  const jd = socketJoinData?.data;
  const coinValues = jd?.game_data?.coin_value || jd?.gameData?.coinValue || jd?.coin_value || [];
  const theoreticalMax = coinValues.length > 0 ? coinValues[coinValues.length - 1] : null;

  // 1. 獲取玩家目前餘額作為第二標竿
  const balance = await getDisplayedAmount(page, 'balance');
  const expectedMax = (theoreticalMax !== null && balance > 0) ? Math.min(theoreticalMax, balance) : theoreticalMax;

  let after = 0;
  let isSuccess = false;

  // 2. 實作重複點擊機制 (最多 3 次)
  for (let attempt = 1; attempt <= 3; attempt++) {
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

module.exports = checkMaxButton;
