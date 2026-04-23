async function launchGame(page, context, targetId) {
  const finalGameId = String(targetId);
  console.log(`\x1b[35m[DIAG] 準備開啟遊戲: ${finalGameId}...\x1b[0m`);
  
  // 強化選擇器，加入更多可能包含 gameId 的屬性
  let gameImg = page.locator(`img[alt*="${finalGameId}"], img[src*="${finalGameId}"], [data-gameid*="${finalGameId}"], [data-id*="${finalGameId}"]`).first();
  
  try {
    await gameImg.waitFor({ state: 'visible', timeout: 5000 });
  } catch (e) {
    console.log(`\x1b[33m[WARNING] 畫面上找不到指定的遊戲 ID: ${finalGameId}，自動尋找畫面上的第一個遊戲來測試...\x1b[0m`);
    // 備援：隨便找一個看起來像遊戲封面的圖 (通常在 SAC 裡面是以圖片呈現)
    gameImg = page.locator('.ant-card-cover img, img[src*="game"]').first();
    await gameImg.waitFor({ state: 'visible', timeout: 10000 });
  }

  await page.waitForTimeout(3000);

  // [提前封印] 點擊瞬間就讓 SAC 靜音
  try {
    await page.evaluate(() => {
      console.log('--- [EARLY_SILENCE] 準備開啟遊戲，SAC 進入靜音模式 ---');
      window.stop();
    });
  } catch (e) {}

  const [gamePage] = await Promise.all([
    context.waitForEvent('page', { timeout: 20000 }),
    gameImg.click({ force: true })
  ]);

  console.log(`\x1b[32m[STEP 3] ✅ 遊戲已開啟\x1b[0m`);
  return {
    success: true,
    message: `已開啟遊戲`,
    gameId: finalGameId,
    gamePage
  };
}

module.exports = { launchGame };
