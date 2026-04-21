async function checkSpaceSpin(diag, stepResults, GAME_COORDINATE_MAP) {
  const launchRes = stepResults['launchGame'];
  const config = GAME_COORDINATE_MAP[launchRes?.gameId] || GAME_COORDINATE_MAP["default"];

  try {
    if (!diag.activeGamePage.isClosed()) {
      await diag.activeGamePage.bringToFront();
      
      let targetCanvas = await diag.findCanvas(diag.activeGamePage);
      if (!targetCanvas) throw new Error('找不到遊戲 Canvas');

      const box = await targetCanvas.boundingBox();
      if (!box || box.width === 0) throw new Error('無法獲取 Canvas 座標');

      const sx = box.x + box.width * config.spin.x;
      const sy = box.y + box.height * config.spin.y;
      
      console.log(`\x1b[35m[DIAG] 遊戲 ID: ${launchRes?.gameId || 'Unknown'}\x1b[0m`);
      console.log(`\x1b[35m[DIAG] 開始「連續點擊模式」，直到偵測到 Spin 封包...\x1b[0m`);

      diag.lastSpinResponseAt = 0;
      const startTime = Date.now();
      let clickCount = 0;

      // 連續點擊循環 (最多嘗試 15 秒)
      while (diag.lastSpinResponseAt === 0 && Date.now() - startTime < 15000) {
        if (diag.activeGamePage.isClosed()) throw new Error('遊戲頁面在連續點擊時關閉');

        clickCount++;
        console.log(`[STEP 5] 第 ${clickCount} 次嘗試點擊 Spin 鈕...`);
        
        // 使用真人點擊模式
        await diag.activeGamePage.mouse.move(sx, sy);
        await diag.activeGamePage.mouse.down();
        await diag.activeGamePage.waitForTimeout(100);
        await diag.activeGamePage.mouse.up();

        // 每次點擊後等待一小段時間觀察封包
        await diag.activeGamePage.waitForTimeout(1000);
      }

      // 判定是否成功收到封包
      if (diag.lastSpinResponseAt === 0) {
        return { success: false, error: `嘗試點擊 ${clickCount} 次後仍未偵測到 Spin 回應` };
      }
      
      console.log(`\x1b[32m[STEP 5] ✅ 偵測到 Spin 封包，點擊成功！(共點擊 ${clickCount} 次)\x1b[0m`);
    }

    return { success: true, message: '已成功點擊' };
  } catch (error) {
    console.error(`[STEP 5 ERROR] ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { checkSpaceSpin };
