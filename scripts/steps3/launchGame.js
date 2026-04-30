async function launchGame(page, context, gameId) {
  console.log(`\x1b[35m--- [DIAG] 準備啟動遊戲 ID: ${gameId} ---\x1b[0m`);

  try {
    await page.waitForTimeout(5000); // 等待 modal 動畫完畢
    const frames = page.frames();
    let target = null;

    // 策略 A: 尋找精準的 ID 圖片
    for (const f of frames) {
      const loc = f.locator(`img[alt="${gameId}"], img[src*="${gameId}"]`).first();
      if (await loc.isVisible()) {
        target = loc;
        console.log(`--- [DIAG] ✅ 找到 ID ${gameId} 的專屬圖片 ---`);
        break;
      }
    }

    // 策略 B: 如果搜尋不到 ID，但畫面有東西，直接點擊「第一個遊戲項目」
    if (!target) {
      console.log('--- [DIAG] 找不到精準 ID，嘗試點擊畫面第一個遊戲項目... ---');
      for (const f of frames) {
        const firstGame = f.locator('.modal-body a[role="button"], .modal-content img').first();
        if (await firstGame.isVisible()) {
          target = firstGame;
          break;
        }
      }
    }

    if (!target) throw new Error(`無法在任何框架中找到可點擊的遊戲項目`);

    // 執行穿透點擊
    await target.scrollIntoViewIfNeeded();
    await target.click({ force: true });

    console.log('\x1b[32m--- [STEP 3] ✅ 已送出點擊指令 ---\x1b[0m');
    return { success: true, message: `已點擊遊戲項目` };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { launchGame };