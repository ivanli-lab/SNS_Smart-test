/**
 * 1️⃣6️⃣ 直播間音效開關測試
 * @param {import('playwright').Page} page
 */
async function checkSoundToggle(page) {
  const btn = await page.$('div[data-mute]');
  if (!btn) return { success: false, message: '找不到音效按鈕' };

  const getAltState = async () => {
    return await btn.evaluate(el => {
      const img = el.querySelector('img');
      return img ? img.getAttribute('alt') : 'NoImg';
    });
  };

  const log = [];
  
  // 1. 檢查初始狀態
  const initialAlt = await getAltState();
  const isInitialOn = initialAlt?.toLowerCase().includes('on');
  console.log(`[Step 16] 初始狀態: "${initialAlt}" (判定為 ${isInitialOn ? '開啟' : '關閉'})`);
  log.push(initialAlt);

  // 決定目標狀態
  const target1 = isInitialOn ? 'off' : 'on';
  const target2 = isInitialOn ? 'on' : 'off';

  // 2. 第一次切換
  console.log(`[Step 16] 第一次點擊，預期目標: ${target1}`);
  await btn.click({ force: true });
  
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    const curr = await getAltState();
    const lowCurr = curr?.toLowerCase() || '';
    if (lowCurr.includes(target1) || (target1 === 'off' && lowCurr.includes('mute'))) break;
  }
  
  const state1 = await getAltState();
  console.log(`[Step 16] 第一次切換後: "${state1}"`);
  log.push(state1);

  // 3. 第二次切換
  console.log(`[Step 16] 第二次點擊，預期目標: ${target2}`);
  await btn.click({ force: true });
  
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    const curr = await getAltState();
    const lowCurr = curr?.toLowerCase() || '';
    if (lowCurr.includes(target2) || (target2 === 'off' && lowCurr.includes('mute'))) break;
  }
  
  const state2 = await getAltState();
  console.log(`[Step 16] 第二次切換後: "${state2}"`);
  log.push(state2);

  // 成功條件：狀態有發生變化且回到原點 (或至少有兩次不同的切換結果)
  const isSuccess = (state1 !== initialAlt) && (state2 !== state1);

  return { 
    success: isSuccess, 
    message: `圖示狀態循環: ${log.join(' -> ')}` 
  };
}

module.exports = checkSoundToggle;
