async function launchGame(page, context, gameId) {
  console.log(`\x1b[35m--- [DIAG] 準備啟動遊戲 ID: ${gameId} (全框架地毯式掃描) ---\x1b[0m`);

  try {
    // 1. 先給彈窗一點載入時間
    await page.waitForTimeout(5000);

    const selectors = [
      `img[alt="${gameId}"]`,
      `img[src*="${gameId}.png"]`,
      `a:has(img[alt="${gameId}"])`,
      `a:has(img[src*="${gameId}"])`
    ];

    let target = null;
    const frames = page.frames(); // 獲取頁面上所有的 Iframe
    console.log(`--- [DIAG] 目前偵測到 ${frames.length} 個框架，開始逐一搜尋... ---`);

    // 2. 雙重迴圈：掃描每個框架裡的每個可能選擇器
    for (const frame of frames) {
      for (const sel of selectors) {
        try {
          const loc = frame.locator(sel).first();
          // 檢查是否可見
          if (await loc.isVisible()) {
            console.log(`--- [DIAG] ✅ 在框架 [${frame.name() || '匿名框架'}] 中找到目標: ${sel} ---`);
            target = loc;
            break;
          }
        } catch (e) {
          // 忽略單一框架的搜尋錯誤
        }
      }
      if (target) break;
    }

    // 3. 如果初步掃描沒找到，進行最後的「強制等待」
    if (!target) {
      console.log('--- [DIAG] 快速掃描未果，嘗試對所有 Iframe 進行深度等待... ---');
      try {
        // 使用模糊匹配，只要是任何 Iframe 裡的 5400 圖片都行
        target = page.frameLocator('iframe').locator(`img[alt="${gameId}"], img[src*="${gameId}"]`).first();
        await target.waitFor({ state: 'visible', timeout: 10000 });
      } catch (e) {
        throw new Error(`在所有框架中均找不到 ID 為 ${gameId} 的遊戲圖片，請確認 ID 是否正確或圖片是否已載入`);
      }
    }

    // 4. 執行點擊
    console.log('--- [DIAG] 發現遊戲圖標，執行點擊動作... ---');
    await target.scrollIntoViewIfNeeded().catch(() => { });

    // 使用 dispatchEvent 確保點擊能穿透任何透明遮罩
    await target.dispatchEvent('click');

    console.log(`\x1b[32m--- [STEP 3] ✅ 遊戲 ${gameId} 已成功點擊啟動！ ---\x1b[0m`);
    return { success: true, message: `成功啟動遊戲: ${gameId}` };

  } catch (err) {
    console.error(`\x1b[31m--- [ERROR] 啟動遊戲失敗: ${err.message} ---\x1b[0m`);
    return { success: false, error: err.message };
  }
}

module.exports = { launchGame };