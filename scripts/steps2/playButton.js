/**
 * 1️⃣2️⃣ Play 按鈕測試 (升級版：支援自動調整 Spin 次數)
 * @param {import('playwright').Page} page
 * @param {number} targetSpinCount 目標 Spin 次數
 */
async function checkPlayButton(page, targetSpinCount = 20) {
  console.log(`[Step 12] 🎯 目標 Spin 次數: ${targetSpinCount}`);
  
  // 1. 取得目前的 Spin 次數
  const getCount = async () => {
    return await page.evaluate(() => {
      const span = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('Spin Round'));
      if (!span) return 20; // 預設
      const match = span.textContent.match(/\d+/);
      return match ? parseInt(match[0]) : 20;
    });
  };

  let currentCount = await getCount();
  console.log(`[Step 12] 🔢 目前 UI 顯示次數: ${currentCount}`);

  // 2. 如果目前次數不足，自動點擊「+」號調整
  if (currentCount < targetSpinCount) {
    const plusBtn = await page.$('button:has(svg path[d*="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"])');
    if (plusBtn) {
      console.log(`[Step 12] 👆 正在自動點擊「+」號調整次數...`);
      let retry = 0;
      while (currentCount < targetSpinCount && retry < 50) {
        await plusBtn.click({ force: true });
        await page.waitForTimeout(200);
        currentCount = await getCount();
        retry++;
      }
      console.log(`[Step 12] ✅ 次數已調整至: ${currentCount}`);
    } else {
      console.log(`[Step 12] ⚠️ 找不到「+」號按鈕，維持現有次數`);
    }
  }

  // 3. 點擊 Play 按鈕
  const btn = await page.$('button[data-is-playing]');
  if (!btn) return { success: false, message: '找不到 Play 按鈕' };
  
  const beforeState = await btn.getAttribute('data-is-playing');
  await btn.click({ force: true }); 
  await page.waitForTimeout(1000);
  const afterState = await btn.getAttribute('data-is-playing');
  
  return { 
    success: true, 
    message: `次數: ${currentCount}, 狀態: ${beforeState} -> ${afterState}` 
  };
}

module.exports = checkPlayButton;
