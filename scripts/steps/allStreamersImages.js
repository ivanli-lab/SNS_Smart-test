/**
 * 7️⃣ All Streamers 圖片檢查 (區域鎖定 + ID 動態掃描版)
 * 策略：
 * 1. 定位 "All Streamers" 標題並強制滾動 (觸發懶加載)
 * 2. 鎖定標題下方的兄弟容器，縮小掃描範圍
 * 3. 僅在該區域內掃描 id="streamer-card-*" 的容器
 * 4. 動態抓取數量與主播名稱 (data-first-name)
 * 
 * @param {import('playwright').Page} page
 * @param {string} _timestamp
 */
async function checkAllStreamersImages(page, _timestamp) {
  console.log('7️⃣ 開始 All Streamers 圖片檢查 (區域鎖定 + ID 動態版)...');
  
  try {
    // --- 1. 尋找並滾動到 All Streamers 標題 (不可刪除) ---
    const titleFound = await page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll('div, span, h1, h2, h3'));
      const target = titles.find(el => {
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        return text === 'all streamers' || text === 'all streamer';
      });
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'center' });
        return true;
      }
      return false;
    });

    if (!titleFound) {
      throw new Error('找不到 "All Streamers" 區域標題');
    }
    
    console.log('已滾動到 All Streamers 區域，等待內容加載...');
    await page.waitForTimeout(2000); // 給予足夠時間讓懶加載渲染
    
    // --- 2. 執行區域內精準動態掃描 ---
    const result = await page.evaluate(() => {
      // 重新定位標題作為基準點
      const titles = Array.from(document.querySelectorAll('div, span, h1, h2, h3'));
      const titleEl = titles.find(el => {
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        return text === 'all streamers' || text === 'all streamer';
      });

      if (!titleEl) return { found: false, error: '重新定位標題失敗' };

      // 鎖定標題下方的容器 (Sibling)，避免全頁掃描
      const searchRoot = titleEl.nextElementSibling || titleEl.parentElement;
      
      // 關鍵：僅在該區域內鎖定 id^="streamer-card-" 的容器
      const cardContainers = Array.from(searchRoot.querySelectorAll('div[id^="streamer-card-"]'));
      
      const streamerDetails = cardContainers.map(card => {
        // 抓取名字：優先從 data-first-name 抓，保底從 h1 抓
        const name = card.querySelector('div[data-first-name]')?.getAttribute('data-first-name') || 
                     card.querySelector('div[data-footer="true"] h1')?.textContent?.trim() || 
                     '未知主播';
        
        // 檢查圖片狀態 (naturalWidth 為 0 代表破圖)
        // 🚀 核心修正：優先檢查主圖，避免小頭像 (data-streamer) 破圖造成誤報
        const img = card.querySelector('img:not([data-streamer="true"])') || card.querySelector('img');
        const isBroken = img ? (img.complete && img.naturalWidth === 0) : true;
        const isLoaded = img ? (img.complete && img.naturalWidth > 0) : false;

        return {
          id: card.id,
          name: name,
          isBroken,
          isLoaded
        };
      });

      const brokenCount = streamerDetails.filter(d => d.isBroken).length;
      const loadedCount = streamerDetails.filter(d => d.isLoaded).length;

      return {
        found: cardContainers.length > 0,
        imageCount: cardContainers.length,
        streamerNames: streamerDetails.map(d => d.name),
        loadedCount: loadedCount,
        brokenCount: brokenCount,
        allImagesOK: brokenCount === 0 && cardContainers.length > 0,
        details: streamerDetails
      };
    });

    if (!result.found) {
      throw new Error('在標題下方未找到任何主播卡片 (id="streamer-card-*")');
    }

    console.log(`7️⃣ 掃描完成：在指定區域偵測到 ${result.imageCount} 位主播: ${result.streamerNames.join(', ')}`);

    return {
      success: result.allImagesOK,
      imageCount: result.imageCount,
      streamerNames: result.streamerNames,
      loadedCount: result.loadedCount,
      brokenCount: result.brokenCount,
      allImagesOK: result.allImagesOK,
      message: result.allImagesOK 
        ? `✅ 成功偵測到 ${result.imageCount} 位主播，頭像全部載入正常。` 
        : `❌ 發現 ${result.brokenCount} 張主播頭像異常。`,
      debug: { details: result.details }
    };
    
  } catch (error) {
    console.error('7️⃣ All Streamers 圖片檢查錯誤:', error.message);
    return {
      success: false,
      error: error.message,
      message: `圖片檢查失敗: ${error.message}`
    };
  }
}

module.exports = checkAllStreamersImages;
