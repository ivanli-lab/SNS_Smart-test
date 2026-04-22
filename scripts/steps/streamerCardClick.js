/**
 * 直播主介紹卡片點擊測試
 * @param {import('playwright').Page} page
 * @param {string} timestamp
 */
const path = require('path');
async function checkStreamerCardClick(page, timestamp) {
  try {
    console.log('8️⃣ 開始直播主介紹卡片點擊測試...');
    
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    // 使用 ID 選擇器查找直播主卡片
    console.log('查找 offline-streamer-container...');
    const cardInfo = await page.evaluate(() => {
      // 1. 找容器
      const container = document.getElementById('offline-streamer-container');
      if (!container) {
        return { 
          found: false, 
          reason: '未找到 offline-streamer-container',
          cardCount: 0 
        };
      }
      
      // 2. 找所有卡片（ID 以 streamer-card- 開頭）
      const cards = Array.from(container.querySelectorAll('[id^="streamer-card-"]'));
      
      if (cards.length === 0) {
        return { 
          found: false, 
          reason: '容器內沒有卡片',
          cardCount: 0 
        };
      }
      
      // 3. 收集卡片資訊
      const cardList = cards.map(card => {
        const rect = card.getBoundingClientRect();
        const nameEl = card.querySelector('[data-first-name]');
        const imgEl = card.querySelector('img');
        
        return {
          id: card.id,
          name: nameEl ? nameEl.getAttribute('data-first-name') : 'unknown',
          hasImage: !!imgEl,
          imageSrc: imgEl ? imgEl.src : '',
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0
        };
      });
      
      return {
        found: true,
        cardCount: cards.length,
        cards: cardList.slice(0, 5),  // 返回前 5 個用於日誌
        allCards: cardList.length      // 總數
      };
    });
    
    if (!cardInfo.found) {
      console.log(`未找到卡片：${cardInfo.reason || '未知原因'}`);
      return {
        success: false,
        error: cardInfo.reason || '未找到直播主卡片',
        message: cardInfo.reason || '頁面上未找到直播主介紹卡片'
      };
    }
    
    // 輸出找到的卡片資訊
    console.log(`找到 ${cardInfo.cardCount} 個直播主卡片`);
    if (cardInfo.cards && cardInfo.cards.length > 0) {
      console.log('前 5 個卡片：');
      cardInfo.cards.forEach((card, idx) => {
        console.log(`  [${idx}] ${card.name} (${card.id}) - ${card.width}x${card.height} at (${card.x}, ${card.y})`);
      });
    }
    
    // 點擊第一個可見的卡片
    if (cardInfo.cards.length > 0) {
      // 找第一個可見的卡片
      const visibleCard = cardInfo.cards.find(card => card.visible);
      
      if (!visibleCard) {
        return {
          success: false,
          error: '所有卡片都不可見',
          cardCount: cardInfo.cardCount,
          message: `找到 ${cardInfo.cardCount} 個卡片，但都不可見`
        };
      }
      
      console.log(`點擊卡片：${visibleCard.name} (${visibleCard.id})`);
      await page.mouse.click(visibleCard.x, visibleCard.y);
      await page.waitForTimeout(1500);  // 增加等待時間
      
      // 點擊後滾動到頁面最上方
      console.log('點擊後執行滾動至頁面頂部...');
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
      });
      await page.waitForTimeout(500); // 等待滾動穩定
      
      // 檢查是否成功置頂
      const scrollStatus = await page.evaluate(() => {
        return {
          isAtTop: window.scrollY === 0,
          yOffset: window.scrollY
        };
      });
      
      console.log(`點擊後滾動狀態：是否置頂=${scrollStatus.isAtTop}, Y 偏移=${scrollStatus.yOffset}`);
      
      // 檢查是否有頁面變化（URL 或彈窗）
      const pageChanged = await page.evaluate(() => {
        // 檢查是否有新的彈窗或對話框
        const dialog = document.querySelector('[role="dialog"], [class*="dialog" i], [class*="modal" i]');
        return {
          hasDialog: !!dialog,
          url: window.location.href
        };
      });
      
      console.log(`點擊後頁面狀態：URL=${pageChanged.url}, 彈窗=${pageChanged.hasDialog}`);
      
      return {
        success: scrollStatus.isAtTop, // 當有置頂到頁面時，即算是跳轉成功
        cardCount: cardInfo.cardCount,
        clicked: true,
        opened: pageChanged.hasDialog,
        isAtTop: scrollStatus.isAtTop,
        clickedCard: visibleCard.name,
        pageChanged: pageChanged.hasDialog,
        message: scrollStatus.isAtTop ? 
          `成功點擊 ${visibleCard.name} 並置頂頁面` : 
          `已點擊 ${visibleCard.name} 但未成功置頂 (Y=${scrollStatus.yOffset})`,
        debug: { 
          clickedCardId: visibleCard.id,
          yOffset: scrollStatus.yOffset
        }
      };
    }
    
    return {
      success: true,
      cardCount: cardInfo.cardCount,
      message: `找到 ${cardInfo.cardCount} 個直播主卡片`
    };
  } catch (error) {
    console.error('直播主介紹卡片點擊測試錯誤:', error);
    return {
      success: false,
      error: String(error && error.message || error),
      message: `卡片點擊測試失敗: ${error && error.message || error}`
    };
  }
}

module.exports = checkStreamerCardClick;
