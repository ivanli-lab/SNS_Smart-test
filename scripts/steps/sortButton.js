/**
 * 排序按鈕測試 (修正為使用 streaming-list-btn 與 streaming-grid-btn 定位與狀態檢查)
 * 
 * @param {import('playwright').Page} page - Playwright 頁面物件
 * @param {string} timestamp - 時間戳
 * @returns {Promise<Object>} 測試結果
 */
const path = require('path');

async function checkSortButton(page, timestamp) {
  try {
    console.log('4️⃣ 開始排序按鈕測試 (採用 streaming-list-btn 與 streaming-grid-btn)...');
    
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    // 使用 ID 選擇器查找按鈕
    const buttonInfo = await page.evaluate(() => {
      const listBtn = document.getElementById('streaming-list-btn');
      const gridBtn = document.getElementById('streaming-grid-btn');
      
      if (listBtn && gridBtn) {
        const listRect = listBtn.getBoundingClientRect();
        const gridRect = gridBtn.getBoundingClientRect();
        
        return {
          found: true,
          listButton: {
            x: listRect.x + listRect.width / 2,
            y: listRect.y + listRect.height / 2,
          },
          gridButton: {
            x: gridRect.x + gridRect.width / 2,
            y: gridRect.y + gridRect.height / 2,
          }
        };
      }
      
      return { found: false, reason: '未找到 streaming-list-btn 或 streaming-grid-btn' };
    });
    
    if (!buttonInfo.found) {
      console.log(`[Step 4] ${buttonInfo.reason}`);
      return {
        success: false,
        error: buttonInfo.reason,
        message: buttonInfo.reason
      };
    }
    
    // 獲取初始狀態
    const getButtonState = async () => {
      return await page.evaluate(() => {
        const listBtn = document.getElementById('streaming-list-btn');
        const gridBtn = document.getElementById('streaming-grid-btn');
        return {
          listActive: listBtn ? listBtn.getAttribute('data-is-active') === 'true' : false,
          gridActive: gridBtn ? gridBtn.getAttribute('data-is-active') === 'true' : false
        };
      });
    };
    
    const initialState = await getButtonState();
    console.log(`初始狀態: list=${initialState.listActive}, grid=${initialState.gridActive}`);
    
    // 1. 點擊左邊按鈕 (List)
    console.log('點擊左按鈕 (streaming-list-btn)...');
    await page.mouse.click(buttonInfo.listButton.x, buttonInfo.listButton.y);
    await page.waitForTimeout(1000);
    const stateAfterLeft = await getButtonState();
    
    // 2. 點擊右邊按鈕 (Grid)
    console.log('點擊右按鈕 (streaming-grid-btn)...');
    await page.mouse.click(buttonInfo.gridButton.x, buttonInfo.gridButton.y);
    await page.waitForTimeout(1000);
    const stateAfterRight = await getButtonState();
    
    // 檢查狀態變化
    const leftChanged = initialState.listActive !== stateAfterLeft.listActive || 
                        initialState.gridActive !== stateAfterLeft.gridActive;
    const rightChanged = stateAfterLeft.listActive !== stateAfterRight.listActive || 
                         stateAfterLeft.gridActive !== stateAfterRight.gridActive;
    const anyWorking = leftChanged || rightChanged;
    
    console.log(`測試結果: 左按鈕變化=${leftChanged}, 右按鈕變化=${rightChanged}`);
    
    return {
      success: anyWorking,
      clicked: true,
      sortWorking: anyWorking,
      leftButtonWorking: leftChanged,
      rightButtonWorking: rightChanged,
      message: anyWorking ? 
        `佈局切換功能正常 - List: ${leftChanged ? '有變化' : '無變化'}, Grid: ${rightChanged ? '有變化' : '無變化'}` :
        '按鈕已點擊，但外觀佈局 (Layout) 未改變',
      debug: {
        initialState,
        stateAfterLeft,
        stateAfterRight
      }
    };
    
  } catch (error) {
    console.error('排序按鈕測試錯誤:', error);
    return {
      success: false,
      clicked: false,
      sortWorking: false,
      error: String(error && error.message || error),
      message: `排序按鈕測試失敗: ${error && error.message || error}`
    };
  }
}

module.exports = checkSortButton;
