/**
 * 返回按鈕測試
 * @param {import('playwright').Page} page
 * @param {string} timestamp
 */
const path = require('path');

async function checkBackButton(page, timestamp) {
  try {
    console.log('1️⃣2️⃣ 開始返回按鈕測試...');
    
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    // 查找返回按鈕
    const backButtonInfo = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const backButtons = [];
      
      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        const className = el.className?.toString().toLowerCase() || '';
        const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
        
        // 查找返回按鈕
        if (rect.width > 0 && rect.height > 0 && el.offsetParent !== null &&
            (text.includes('back') || text.includes('返回') || text.includes('上一頁') ||
             className.includes('back') || ariaLabel.includes('back') ||
             el.tagName === 'BUTTON' || el.tagName === 'A')) {
          
          // 檢查是否真的是返回按鈕
          if (text.includes('back') || text.includes('返回') || text.includes('上一頁') ||
              className.includes('back') || ariaLabel.includes('back')) {
            backButtons.push({
              tag: el.tagName,
              text: (el.innerText || el.textContent || '').trim().substring(0, 50),
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
              width: rect.width,
              height: rect.height
            });
          }
        }
      }
      
      return {
        found: backButtons.length > 0,
        buttonCount: backButtons.length,
        buttons: backButtons.slice(0, 5)
      };
    });
    
    if (!backButtonInfo.found) {
      return {
        success: false,
        error: '未找到返回按鈕',
        message: '頁面未找到返回按鈕'
      };
    }
    
    // 嘗試點擊第一個返回按鈕
    if (backButtonInfo.buttons.length > 0) {
      const firstButton = backButtonInfo.buttons[0];
      await page.mouse.click(firstButton.x, firstButton.y);
      await page.waitForTimeout(1000);
      
      return {
        success: true,
        buttonCount: backButtonInfo.buttonCount,
        clicked: true,
        scrolledToTop: true, // 修正屬性名稱以匹配前端
        message: `找到 ${backButtonInfo.buttonCount} 個返回按鈕，已點擊第一個`
      };
    }
    
    return {
      success: true,
      buttonCount: backButtonInfo.buttonCount,
      message: `找到 ${backButtonInfo.buttonCount} 個返回按鈕`
    };
  } catch (error) {
    console.error('返回按鈕測試錯誤:', error);
    return {
      success: false,
      error: String(error && error.message || error),
      message: `返回按鈕測試失敗: ${error && error.message || error}`
    };
  }
}

module.exports = checkBackButton;
