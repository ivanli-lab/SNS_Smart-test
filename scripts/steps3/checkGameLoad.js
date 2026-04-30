async function checkGameLoad(gamePage) {
  console.log('\x1b[35m--- [DIAG] 正在監測新分頁載入狀況... ---\x1b[0m');

  try {
    // 1. 等待網址跳轉，直到不再是 about:blank (最多等 20 秒)
    await gamePage.waitForURL(url => url.href !== 'about:blank', { timeout: 20000 });
    console.log(`--- [DIAG] 遊戲網址已確認跳轉: ${gamePage.url()} ---`);

    // 2. 等待頁面穩定
    await gamePage.waitForTimeout(2000);

    // 3. 【關鍵驗證】搜尋遊戲核心元素
    // 大多數遊戲後台是用 <canvas> 繪圖，或者是包在 <iframe> 裡
    const selectors = ['canvas', 'iframe', '#game-container', '.game-player'];

    let isLoaded = false;
    for (const sel of selectors) {
      try {
        await gamePage.waitForSelector(sel, { state: 'visible', timeout: 5000 });
        console.log(`\x1b[32m--- [STEP 4] ✅ 偵測到遊戲元素 [${sel}]，載入成功！ ---\x1b[0m`);
        isLoaded = true;
        break;
      } catch (e) {
        continue; // 找不到就換下一個 selector 試試
      }
    }

    if (isLoaded) {
      return { success: true, message: '遊戲載入完成' };
    } else {
      return { success: false, error: '頁面已跳轉但未偵測到遊戲畫面(Canvas)' };
    }

  } catch (err) {
    console.error(`\x1b[31m--- [ERROR] 遊戲載入超時或異常: ${err.message} ---\x1b[0m`);
    return { success: false, error: `載入失敗: ${err.message}` };
  }
}

module.exports = { checkGameLoad };