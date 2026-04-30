async function gameOperation(diag, targetId, config) {
  // 第一時間檢查頁面是否已進入關閉狀態
  if (!diag.activeGamePage || diag.activeGamePage.isClosed()) {
    console.log('\x1b[33m[STEP 6] ⚠️ 遊戲頁面已關閉，跨過此步驟。\x1b[0m');
    return { success: true, message: '遊戲頁面已關閉，跨過' };
  }

  try {
    await diag.activeGamePage.bringToFront();
    // 強化：點擊 body 確保焦點，但縮短時間
    await diag.activeGamePage.click('body');
    await diag.activeGamePage.waitForTimeout(500);
  } catch (e) {
    console.log('\x1b[33m[STEP 6] 頁面操作失敗，可能已關閉，跨過此步驟。\x1b[0m');
    return { success: true, message: '遊戲頁面操作失敗，跨過' };
  }
  
  let targetCanvas = await diag.findCanvas(diag.activeGamePage);
  if (!targetCanvas) {
    const isEmbedded = diag.activeGamePage.url().includes('sac');
    if (isEmbedded) {
      console.log('\x1b[33m[STEP 6] ⚠️ 遊戲以 iframe 嵌入 SAC 頁面，無法存取 Canvas，跳過 AutoSpin 測試。\x1b[0m');
      return { success: true, message: 'iframe 嵌入遊戲，跳過 AutoSpin 測試' };
    }
    throw new Error('找不到遊戲 Canvas');
  }

  let box = null;
  for (let retry = 0; retry < 10; retry++) {
    box = await targetCanvas.boundingBox();
    if (box && box.width > 0) break;
    await diag.activeGamePage.waitForTimeout(1000);
  }
  if (!box) throw new Error('無法獲取 Canvas 座標');

  const sx = box.x + box.width * config.spin.x;
  const sy = box.y + box.height * config.spin.y;
  const ax = config.auto ? (box.x + box.width * config.auto.x) : sx;
  const ay = config.auto ? (box.y + box.height * config.auto.y) : sy;
  const ox = box.x + box.width * config.ok.x;
  const oy = box.y + box.height * config.ok.y;
  
  // [新增] 智慧等待 Free Game 結束
  if (diag.isInFreeGame) {
    console.log(`\x1b[33m[STEP 6] 偵測到 Free Game 進行中，啟動智慧等待與破冰點擊...\x1b[0m`);
    const cx = box.x + box.width * 0.5;
    const cy = box.y + box.height * 0.5;
    
    let waitStart = Date.now();
    // 最多等待 5 分鐘 (防止意外卡死)
    while (diag.isInFreeGame && (Date.now() - waitStart < 300000)) {
      if (diag.activeGamePage.isClosed()) break;
      
      // 每 3 秒點擊一次畫面中央，嘗試點掉彈窗或 Skip 動畫
      console.log(`[STEP 6] Free Game 等待中... 執行破冰點擊 (0.5, 0.5)`);
      await diag.activeGamePage.mouse.click(cx, cy);
      
      await diag.activeGamePage.waitForTimeout(3000);
    }
    
    if (!diag.activeGamePage.isClosed()) {
      console.log(`\x1b[33m[STEP 6] ✨ 偵測到 Free Game 邏輯結束，等待 8 秒讓結算動畫與跳錢跑完...\x1b[0m`);
      // 緩衝期間繼續點擊中央，防止被最後一個彈窗卡住
      for (let k = 0; k < 4; k++) {
        await diag.activeGamePage.mouse.click(cx, cy);
        await diag.activeGamePage.waitForTimeout(2000);
      }
      console.log(`\x1b[32m[STEP 6] 動畫緩衝結束，準備啟動 AutoSpin。\x1b[0m`);
    }
  }

  // [DIAG] 座標視覺化日誌
  console.log(`\x1b[35m[DIAG] 遊戲 ID: ${targetId}\x1b[0m`);
  console.log(`\x1b[35m[DIAG] Canvas 實際寬高: ${box.width.toFixed(2)} x ${box.height.toFixed(2)}\x1b[0m`);
  console.log(`\x1b[35m[DIAG] Auto 按鈕座標: X=${ax.toFixed(2)}, Y=${ay.toFixed(2)}\x1b[0m`);
  console.log(`\x1b[35m[DIAG] OK 按鈕座標: X=${ox.toFixed(2)}, Y=${oy.toFixed(2)}\x1b[0m`);

  const startCount = diag.spinStats.success + diag.spinStats.fail;

  for (let i = 0; i < 30; i++) {
    if (diag.activeGamePage.isClosed()) break;
    
    // [強化] 真人點擊模式：點擊 Auto 按鈕
    await diag.activeGamePage.mouse.move(ax, ay);
    await diag.activeGamePage.mouse.down();
    await diag.activeGamePage.waitForTimeout(100);
    await diag.activeGamePage.mouse.up();
    
    await diag.activeGamePage.waitForTimeout(1000); // 等待選單彈出

    // [新增] 客製化額外點擊 (例如開啟 Spin Times)
    if (config.extra) {
      console.log(`[STEP 6] 執行額外點擊 (extra): x=${config.extra.x}, y=${config.extra.y}`);
      const ex = box.x + box.width * config.extra.x;
      const ey = box.y + box.height * config.extra.y;
      await diag.activeGamePage.mouse.move(ex, ey);
      await diag.activeGamePage.mouse.down();
      await diag.activeGamePage.waitForTimeout(100);
      await diag.activeGamePage.mouse.up();
      await diag.activeGamePage.waitForTimeout(800); // 等待開關反應
    }
    
    // [強化] 真人點擊模式：點擊 OK 按鈕
    await diag.activeGamePage.mouse.move(ox, oy);
    await diag.activeGamePage.mouse.down();
    await diag.activeGamePage.waitForTimeout(100);
    await diag.activeGamePage.mouse.up();
    
    await diag.activeGamePage.waitForTimeout(1500);
    
    if (diag.spinStats.success + diag.spinStats.fail > startCount) {
      console.log(`\x1b[32m[AUTO_SPIN] ✅ AutoSpin 啟動成功！\x1b[0m`);
      break;
    }
  }

  return {
    success: true,
    message: '已成功點擊'
  };
}

module.exports = { gameOperation };
