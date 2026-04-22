async function startStreaming(page, context) {
  console.log(`\x1b[35m[STEP 7] 執行三重保險跳轉，切換回 SAC 分頁...\x1b[0m`);
  const allPages = context.pages();
  console.log(`[DIAG] 當前所有分頁: ${allPages.map(p => p.url()).join(', ')}`);

  const sacPage = allPages.find(p => p.url().includes('sac')) || page;
  console.log(`[DIAG] 目標 SAC 分頁 URL: ${sacPage.url()}`);

  await sacPage.bringToFront();
  await sacPage.waitForTimeout(2000);
  try {
    await sacPage.evaluate(() => {
      window.focus();
      document.title = ">>> ACTIVE <<< " + document.title;
    });
  } catch (e) {}
  await sacPage.waitForTimeout(1000);

  // 點擊最左上角 (5, 5) 關閉遊戲列表
  console.log(`\x1b[35m[STEP 7] 點擊座標 (5, 5) 嘗試關閉遊戲列表...\x1b[0m`);
  await sacPage.mouse.click(5, 5, { force: true });
  await sacPage.waitForTimeout(2000);

  const startStreamingBtn = sacPage.locator('button[data-start-button="true"]');
  await startStreamingBtn.waitFor({ state: 'visible', timeout: 10000 });

  const btnText = await startStreamingBtn.innerText();
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
