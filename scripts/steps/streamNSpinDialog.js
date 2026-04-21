/**
 * Stream n'Spin 彈窗測試
 * 
 * 測試目的：處理可能出現的 Stream n'Spin 活動彈窗
 * 
 * 元素定位策略：
 * 1. 查找所有可能的彈窗容器（role="dialog"、.modal、.ant-modal 等）
 * 2. 檢查彈窗內容是否包含 "stream" 和 "spin" 文字
 * 3. 在彈窗內查找 Confirm 按鈕（文字包含 "confirm"、"ok"、"確認"）
 * 
 * @param {import('playwright').Page} page - Playwright 頁面物件
 * @param {string} timestamp - 時間戳，用於截圖檔名
 * @returns {Promise<Object>} 測試結果
 */

const path = require('path');

async function checkStreamNSpinDialog(page, timestamp) {
  console.log('開始 Stream n\'Spin 彈窗測試...');
  
  try {
    await page.waitForTimeout(1000);
    
    // Check if there's a Stream n'Spin dialog
    const dialogInfo = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"], .modal, .ant-modal, .dialog, [class*="modal" i], [class*="dialog" i]');
      
      for (const dialog of dialogs) {
        if (dialog.offsetParent === null) continue; // Skip hidden dialogs
        
        const text = (dialog.textContent || '').toLowerCase();
        const hasStreamSpin = text.includes('stream') && (text.includes('spin') || text.includes('n'));
        
        if (hasStreamSpin) {
          // Look for confirm button in this dialog
          const buttons = Array.from(dialog.querySelectorAll('button'));
          for (const btn of buttons) {
            const rect = btn.getBoundingClientRect();
            const btnText = (btn.textContent || '').toLowerCase();
            if (rect.width > 0 && rect.height > 0 && 
                (btnText.includes('confirm') || btnText.includes('ok') || btnText.includes('確認'))) {
              return {
                found: true,
                buttonText: btn.textContent,
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2
              };
            }
          }
          // Dialog found but no confirm button
          return { found: true, buttonText: null };
        }
      }
      return { found: false };
    });
    
    if (!dialogInfo.found) {
      console.log('Stream n\'Spin 彈窗未出現，繼續下一步測試');
    return {
        found: false,
        clicked: false,
        message: 'Stream n\'Spin 彈窗未出現'
      };
    }
    
    if (!dialogInfo.buttonText) {
      console.log('找到 Stream n\'Spin 彈窗但未找到 Confirm 按鈕');
      return {
        found: true,
        clicked: false,
        message: '找到彈窗 but 未找到 Confirm 按鈕'
      };
    }
    
    console.log(`找到 Stream n'Spin 彈窗，點擊 Confirm 按鈕: ${dialogInfo.buttonText}`);
    await page.mouse.click(dialogInfo.x, dialogInfo.y);
    await page.waitForTimeout(1500);
    
    console.log('已點擊 Confirm 按鈕，彈窗已關閉');
    
    return {
      found: true,
      clicked: true,
      buttonText: dialogInfo.buttonText,
      message: '找到 Stream n\'Spin 彈窗並點擊 Confirm'
    };
    
  } catch (error) {
    console.error('Stream n\'Spin 彈窗測試錯誤:', error);
          return {
      found: false,
      clicked: false,
      error: String(error && error.message || error),
      message: `Stream n'Spin 彈窗測試失敗: ${error && error.message || error}`
    };
  }
}

module.exports = checkStreamNSpinDialog;
