/**
 * 12️⃣ 直播主照片檢查 (結構精準版)
 * 邏輯：
 * 1. 點擊 Photos 頁籤 (使用 _tabButton_ 特徵)
 * 2. 點擊照片容器 (使用 _photoImageWrapper_ 特徵)
 * 3. 開啟大圖後等待 4 秒
 * 4. 點擊關閉按鈕 (使用 _closeButton_ 特徵)
 * 
 * @param {import('playwright').Page} page
 * @param {string} timestamp
 */
async function checkStreamerPhoto(page, timestamp) {
  try {
    console.log('12️⃣ 開始直播主照片檢查 (結構精準版)...');
    
    // --- 1. 點擊 Photos 頁籤 ---
    console.log('正在尋找 Photos 頁籤...');
    const photoTabSelector = 'button[class*="_tabButton_"]';
    
    const tabResult = await page.evaluate((sel) => {
      const tabs = Array.from(document.querySelectorAll(sel));
      const target = tabs.find(t => t.textContent.trim().includes('Photos'));
      if (!target) return { found: false };
      
      // 檢查是否已經是 active 狀態
      const isActive = target.className.includes('_active_');
      const rect = target.getBoundingClientRect();
      
      return { 
        found: true, 
        isActive, 
        x: rect.x + rect.width / 2, 
        y: rect.y + rect.height / 2 
      };
    }, photoTabSelector);

    if (!tabResult.found) throw new Error('找不到 Photos 頁籤按鈕');

    if (!tabResult.isActive) {
      console.log('執行點擊 Photos 頁籤...');
      await page.mouse.click(tabResult.x, tabResult.y);
      await page.waitForTimeout(1500);
    } else {
      console.log('Photos 頁籤已處於啟動狀態，跳過點擊');
    }

    // --- 2. 點擊照片容器 ---
    console.log('正在尋找照片容器 (_photoImageWrapper_)...');
    const wrapperSelector = 'div[class*="_photoImageWrapper_"]';
    
    // 等待容器出現
    await page.waitForSelector(wrapperSelector, { state: 'visible', timeout: 5000 }).catch(() => {
      throw new Error('等待照片列表載入超時 (未看到 _photoImageWrapper_)');
    });

    const wrapperInfo = await page.evaluate((sel) => {
      const firstWrapper = document.querySelector(sel);
      if (!firstWrapper) return null;
      const rect = firstWrapper.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }, wrapperSelector);

    if (!wrapperInfo) throw new Error('找不到可點擊的照片容器');

    console.log('點擊第一張照片...');
    await page.mouse.click(wrapperInfo.x, wrapperInfo.y);
    
    // --- 3. 展示大圖並等待 4 秒 ---
    console.log('大圖已開啟，展示 4 秒...');
    await page.waitForTimeout(4000);

    // --- 4. 關閉照片 ---
    console.log('正在尋找關閉按鈕 (_closeButton_)...');
    const closeBtnSelector = 'button[class*="_closeButton_"]';
    
    const closeResult = await page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (!btn || btn.offsetParent === null) return { found: false };
      const rect = btn.getBoundingClientRect();
      return { found: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }, closeBtnSelector);

    if (closeResult.found) {
      console.log('執行點擊關閉按鈕...');
      await page.mouse.click(closeResult.x, closeResult.y);
    } else {
      console.log('未找到明確關閉按鈕，嘗試使用 ESC 鍵關閉...');
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));

    return {
      success: true,
      message: '✅ 成功切換 Photos 頁籤、開啟照片並於 4 秒後關閉。'
    };

  } catch (error) {
    console.error('12️⃣ 照片檢查流程出錯:', error.message);
    return {
      success: false,
      error: error.message,
      message: `測試失敗: ${error.message}`
    };
  }
}

module.exports = checkStreamerPhoto;
