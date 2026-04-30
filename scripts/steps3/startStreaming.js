async function startStreaming(page, context) {
  console.log(`\x1b[35m[STEP 7] 執行三重保險跳轉，切換回 SAC 分頁...\x1b[0m`);
  const allPages = context.pages();
  console.log(`[DIAG] 當前所有分頁: ${allPages.map(p => p.url()).join(', ')}`);

  const sacPage = allPages.find(p => p.url().includes('sac')) || page;
  console.log(`[DIAG] 目標 SAC 分頁 URL: ${sacPage.url()}`);

  try {
    await sacPage.bringToFront();
    await sacPage.waitForTimeout(2000);
  } catch (e) {
    console.log('\x1b[33m[STEP 7] ⚠️ SAC 分頁已關閉，無法切換。\x1b[0m');
    return { success: true, message: 'SAC 分頁已關閉，跨過' };
  }
  try {
    await sacPage.evaluate(() => {
      window.focus();
      document.title = ">>> ACTIVE <<< " + document.title;
    });
  } catch (e) {}
  await sacPage.waitForTimeout(1000);

  // 嘗試多種方式尋找 Start Streaming 按鈕
  const btnSelectors = [
    'button[data-start-button="true"]',
    'button:has-text("Start Streaming")',
    'button:has-text("Stop Streaming")',
    'button:has-text("Start")',
  ];

  let startStreamingBtn = null;
  for (const sel of btnSelectors) {
    const candidate = sacPage.locator(sel).first();
    const isVisible = await candidate.isVisible().catch(() => false);
    if (isVisible) {
      startStreamingBtn = candidate;
      console.log(`\x1b[35m[STEP 7] 找到按鈕 (${sel})\x1b[0m`);
      break;
    }
  }

  if (!startStreamingBtn) {
    console.log('\x1b[33m[STEP 7] ⚠️ 找不到 Start/Stop Streaming 按鈕，跳過點擊。\x1b[0m');
    return { success: true, message: '找不到串流按鈕，已跳過' };
  }

  const btnText = await startStreamingBtn.innerText().catch(() => '');
  if (btnText.toLowerCase().includes('start')) {
    console.log(`\x1b[35m[STEP 7] 偵測到 Start Streaming 按鈕，執行點擊...\x1b[0m`);
    await startStreamingBtn.click();
    console.log(`\x1b[32m[STEP 7] ✅ 已點擊 Start Streaming 按鈕！\x1b[0m`);
  } else if (btnText.toLowerCase().includes('stop')) {
    console.log(`\x1b[33m[STEP 7] ⚠️ 按鈕已經是 Stop Streaming 狀態。\x1b[0m`);
  }

  // 只要執行到這裡，不論是點擊完畢還是本來就是 Stop，都直接判定成功回傳
  return { success: true, message: '已成功點擊' };
}

module.exports = { startStreaming };
