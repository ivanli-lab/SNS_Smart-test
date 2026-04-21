/**
 * All Streamers 排序按鈕測試
 * @param {import('playwright').Page} page
 * @param {string} timestamp
 */
const path = require('path');
async function checkAllStreamersSortButton(page, timestamp) {
  try {
    console.log('8️⃣ 開始 All Streamers 排列按鈕測試...');
    
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    // 使用 ID 選擇器查找按鈕
    const buttonInfo = await page.evaluate(() => {
      const listBtn = document.getElementById('offline-list-btn');
      const gridBtn = document.getElementById('offline-grid-btn');
      
      if (listBtn && gridBtn) {
        const listRect = listBtn.getBoundingClientRect();
        const gridRect = gridBtn.getBoundingClientRect();
        
        return {
          found: true,
          method: 'id',
          listButton: {
            x: listRect.x + listRect.width / 2,
            y: listRect.y + listRect.height / 2,
            width: listRect.width,
            height: listRect.height
          },
          gridButton: {
            x: gridRect.x + gridRect.width / 2,
            y: gridRect.y + gridRect.height / 2,
            width: gridRect.width,
            height: gridRect.height
          }
        };
      }
      
      return { found: false, reason: '未找到 offline-list-btn 或 offline-grid-btn' };
    });
    
    if (!buttonInfo.found) {
      return {
        success: false,
        error: buttonInfo.reason,
        message: buttonInfo.reason
      };
    }
    
    console.log(`找到按鈕: list(${Math.round(buttonInfo.listButton.x)}, ${Math.round(buttonInfo.listButton.y)}), grid(${Math.round(buttonInfo.gridButton.x)}, ${Math.round(buttonInfo.gridButton.y)})`);
    
    // 獲取初始狀態
    const initialState = await page.evaluate(() => {
      const listBtn = document.getElementById('offline-list-btn');
      const gridBtn = document.getElementById('offline-grid-btn');
      return {
        listActive: listBtn ? listBtn.getAttribute('data-is-active') === 'true' : false,
        gridActive: gridBtn ? gridBtn.getAttribute('data-is-active') === 'true' : false
      };
    });
    
    console.log(`初始狀態: list=${initialState.listActive}, grid=${initialState.gridActive}`);
    
    // 點擊 list 按鈕
    console.log('點擊 list 按鈕...');
    await page.mouse.click(buttonInfo.listButton.x, buttonInfo.listButton.y);
    await page.waitForTimeout(800);
    
    const stateAfterList = await page.evaluate(() => {
      const listBtn = document.getElementById('offline-list-btn');
      const gridBtn = document.getElementById('offline-grid-btn');
      return {
        listActive: listBtn ? listBtn.getAttribute('data-is-active') === 'true' : false,
        gridActive: gridBtn ? gridBtn.getAttribute('data-is-active') === 'true' : false
      };
    });
    
    console.log(`點擊 list 後: list=${stateAfterList.listActive}, grid=${stateAfterList.gridActive}`);
    
    // 點擊 grid 按鈕
    console.log('點擊 grid 按鈕...');
    await page.mouse.click(buttonInfo.gridButton.x, buttonInfo.gridButton.y);
    await page.waitForTimeout(800);
    
    const stateAfterGrid = await page.evaluate(() => {
      const listBtn = document.getElementById('offline-list-btn');
      const gridBtn = document.getElementById('offline-grid-btn');
      return {
        listActive: listBtn ? listBtn.getAttribute('data-is-active') === 'true' : false,
        gridActive: gridBtn ? gridBtn.getAttribute('data-is-active') === 'true' : false
      };
    });
    
    console.log(`點擊 grid 後: list=${stateAfterGrid.listActive}, grid=${stateAfterGrid.gridActive}`);
    
    // 檢查狀態變化
    const listWorking = initialState.listActive !== stateAfterList.listActive || 
                        initialState.gridActive !== stateAfterList.gridActive;
    const gridWorking = stateAfterList.listActive !== stateAfterGrid.listActive || 
                        stateAfterList.gridActive !== stateAfterGrid.gridActive;
    const anyWorking = listWorking || gridWorking;
    
    return {
      success: true,
      clicked: true,
      sortWorking: anyWorking,
      buttonsWorking: anyWorking,
      leftSortChanged: listWorking,   // 修正屬性名稱以匹配前端
      rightSortChanged: gridWorking,  // 修正屬性名稱以匹配前端
      listButtonWorking: listWorking,
      gridButtonWorking: gridWorking,
      message: anyWorking ? 
        `按鈕功能正常 - List: ${listWorking ? '有效' : '無變化'}, Grid: ${gridWorking ? '有效' : '無變化'}` :
        '按鈕已點擊，但狀態未改變',
      debug: {
        initialState,
        stateAfterList,
        stateAfterGrid
      }
    };
  } catch (error) {
    console.error('All Streamers 排列按鈕測試錯誤:', error);
    return {
      success: false,
      error: String(error && error.message || error),
      message: `排列按鈕測試失敗: ${error && error.message || error}`
    };
  }
}

module.exports = checkAllStreamersSortButton;
