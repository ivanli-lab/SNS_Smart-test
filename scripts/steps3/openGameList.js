async function openGameList(page) {
  console.log('\x1b[35m--- [DIAG] 正在穿透 Iframe 尋找 Open Game List 按鈕 ---\x1b[0m');

  try {
    // 1. 等待 3 秒確保 Iframe 內容完全載入 (Docker 環境必加)
    await page.waitForTimeout(3000);

    // 2. 定義目標按鈕
    // 我們同時在主頁面和所有 Iframe 裡找這個按鈕
    const btnSelector = 'button:has-text("Open Game List")';

    // 絕招：使用 frameLocator('iframe') 搭配 .locator
    // 如果有多個 iframe，我們用 .first() 或循環測試
    const target = page.frameLocator('iframe').locator(btnSelector).first();

    // 3. 檢查主頁面是否有按鈕 (備援)
    const mainBtn = page.locator(btnSelector).first();

    if (await mainBtn.isVisible()) {
      await mainBtn.click();
    } else {
      console.log('--- [DIAG] 主頁面未見按鈕，嘗試點擊 Iframe 內元素... ---');
      await target.waitFor({ state: 'visible', timeout: 15000 });
      await target.click({ force: true });
    }

    console.log('\x1b[32m--- [STEP 2] ✅ 成功點開遊戲清單！ ---\x1b[0m');
    return { success: true, message: '✅ 已進入遊戲列表' };

  } catch (err) {
    console.error(`\x1b[31m--- [ERROR] Step 2 失敗: ${err.message} ---\x1b[0m`);
    return { success: false, error: '無法找到或點擊 Open Game List 按鈕' };
  }
}

module.exports = { openGameList };