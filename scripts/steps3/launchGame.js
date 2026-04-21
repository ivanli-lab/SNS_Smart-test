async function launchGame(page, context, targetId) {
  const finalGameId = String(targetId);
  const gameImg = page.locator(`img[alt*="${finalGameId}"], img[src*="${finalGameId}"]`).first();
  await gameImg.waitFor({ state: 'visible' });
  console.log(`\x1b[35m[DIAG] 準備開啟遊戲: ${finalGameId}...\x1b[0m`);
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
    gameImg.click()
  ]);

  console.log(`\x1b[32m[STEP 3] ✅ 遊戲已開啟: ${finalGameId}\x1b[0m`);
  return {
    success: true,
    message: `已開啟 ${finalGameId}`,
    gameId: finalGameId,
    gamePage
  };
}

module.exports = { launchGame };
