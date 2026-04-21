/**
 * 4️⃣ Streaming Now 已開啟的直播間數量計算 (強化版)
 * 策略：
 * 1. 定位 "Streaming Now" 標題文字
 * 2. 獲取標題下方的兄弟容器 (Sibling Container) - 方案 A
 * 3. 等待區域內出現至少一個直播主卡片 (img[data-streamer="true"])
 * 4. 執行精確計數
 * 
 * @param {import('playwright').Page} page
 */
async function checkStreamingNowCount(page) {
  console.log('4️⃣ 開始 Streaming Now 數量計算 (區域掃描 + 強制等待)...');
  
  try {
    // --- 1. 等待區域標題出現 ---
    const titleSelector = 'div[class*="_container_"]';
    await page.waitForFunction((sel) => {
      const els = Array.from(document.querySelectorAll(sel));
      return els.some(el => el.textContent.toLowerCase().includes('streaming now'));
    }, titleSelector, { timeout: 10000 }).catch(() => {
      throw new Error('找不到 "Streaming Now" 區域標題');
    });

    // --- 2. 執行區域內計數與等待 ---
    const result = await page.evaluate(async () => {
      // 尋找標題元素
      const allContainers = Array.from(document.querySelectorAll('div[class*="_container_"]'));
      const titleEl = allContainers.find(el => el.textContent.toLowerCase().includes('streaming now'));
      
      if (!titleEl) return { success: false, error: '定位標題失敗' };

      // 方案 A：獲取標題下方的兄弟區塊
      // 通常結構是：<div class="title">Streaming Now</div> <div class="list">...cards...</div>
      // 或者卡片就在 titleEl 裡面。我們兩者都檢查。
      const getStreamers = (root) => Array.from(root.querySelectorAll('img[data-streamer="true"]'));

      // 等待函數：直到抓到數量 > 0 或超時
      const waitForStreamers = async (targetRoot, timeout = 3000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          const cards = getStreamers(targetRoot);
          if (cards.length > 0) return cards;
          await new Promise(r => setTimeout(r, 200));
        }
        return getStreamers(targetRoot);
      };

      // 優先檢查標題的下一個兄弟元素 (方案 A)
      let streamerCards = [];
      const nextSibling = titleEl.nextElementSibling;
      
      if (nextSibling) {
        console.log('正在掃描標題下方的兄弟容器...');
        streamerCards = await waitForStreamers(nextSibling);
      }

      // 如果兄弟元素沒抓到，檢查標題本身內部 (保底)
      if (streamerCards.length === 0) {
        console.log('兄弟容器無結果，掃描標題內部容器...');
        streamerCards = await waitForStreamers(titleEl);
      }

      const streamerData = streamerCards.map(img => {
        // 從圖片向上找到卡片容器，再向下尋找 data-footer="true" 內的 span
        const card = img.closest('div[class*="_container_"]') || img.parentElement.parentElement;
        const footerSpan = card.querySelector('div[data-footer="true"] span');
        const name = footerSpan ? footerSpan.textContent.trim() : '未知主播';
        
        // 檢查圖片是否破圖 (naturalWidth 為 0 代表載入失敗)
        const isBroken = img.naturalWidth === 0;
        
        return { name, isBroken };
      });

      const brokenCount = streamerData.filter(d => d.isBroken).length;

      return {
        success: brokenCount === 0, // 🚀 核心修正：只要有破圖，狀態就是失敗 (false)
        count: streamerCards.length,
        brokenCount: brokenCount,
        streamerNames: streamerData.map(d => d.name),
        streamerDetails: streamerData,
        message: `目前共有 ${streamerCards.length} 位主播正在直播${brokenCount > 0 ? ` (其中 ${brokenCount} 位頭像破圖 ❌)` : ''}`
      };
    });

    console.log(`4️⃣ 測試結果：${result.message}`);
    return result;

  } catch (error) {
    console.error('4️⃣ Streaming Now 數量計算錯誤:', error.message);
    return {
      success: false,
      error: error.message,
      message: `數量計算失敗: ${error.message}`
    };
  }
}

module.exports = checkStreamingNowCount;
