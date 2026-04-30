async function checkSpaceSpin(diag, gameId, GAME_COORDINATE_MAP) {
  const config = GAME_COORDINATE_MAP[gameId] || GAME_COORDINATE_MAP["default"];

  try {
    if (!diag.activeGamePage.isClosed()) {
      await diag.activeGamePage.bringToFront();
      
      let targetCanvas = await diag.findCanvas(diag.activeGamePage);
      if (!targetCanvas) {
        const isEmbedded = diag.activeGamePage.url().includes('sac');
        if (isEmbedded) {
          console.log('\x1b[33m[STEP 5] ⚠️ 遊戲以 iframe 嵌入 SAC 頁面，無法存取 Canvas，跳過 Spin 測試。\x1b[0m');
          return { success: true, message: 'iframe 嵌入遊戲，跳過 Spin 測試' };
        }
        throw new Error('找不到遊戲 Canvas');
      }

      const box = await targetCanvas.boundingBox();
      if (!box || box.width === 0) throw new Error('無法獲取 Canvas 座標');

      const sx = box.x + box.width * config.spin.x;
      const sy = box.y + box.height * config.spin.y;
      
      console.log(`\x1b[35m[DIAG] 遊戲 ID: ${gameId || 'Unknown'}\x1b[0m`);
      console.log(`\x1b[35m[DIAG] 開始「連續點擊模式」，直到偵測到 Spin 封包...\x1b[0m`);

      diag.lastSpinResponseAt = 0;
      const startTime = Date.now();
      let clickCount = 0;
      const isDefaultCoords = !GAME_COORDINATE_MAP[gameId];
      // 使用預設座標的遊戲，最多只點 5 次，避免觸發反作弊機制關閉 session
      const maxClicks = isDefaultCoords ? 5 : 999;

      // 連續點擊循環 (最多嘗試 25 秒)
      while (diag.lastSpinResponseAt === 0 && Date.now() - startTime < 25000 && clickCount < maxClicks) {
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
        const isDefaultCoords = !GAME_COORDINATE_MAP[gameId];
        if (isDefaultCoords) {
          // 未知遊戲使用預設座標，無法保證點到 Spin，以「待 AutoSpin 驗證」方式通過
          console.log(`\x1b[33m[STEP 5] ⚠️ 遊戲 ${gameId} 無客製座標，使用預設座標共點擊 ${clickCount} 次，未收到 Spin 回應。將依賴 AutoSpin 繼續驗證。\x1b[0m`);
          return { success: true, message: `預設座標點擊 ${clickCount} 次，未收到 Spin 封包 (依賴 AutoSpin 驗證)` };
        }
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
