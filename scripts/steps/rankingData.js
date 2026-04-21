/**
 * 11️⃣ 排行榜檢查 (數據對帳 + 偏移修正版)
 * 邏輯：
 * 1. 優先使用全域攔截到的 1021 封包 (由第 9 點觸發)
 * 2. 若無，則捲動並點擊切換鈕誘發 API
 * 3. 提取 7d/30d 前三名並計算 30d 總金額
 * 4. 置中捲動並動態校對 UI 總金額 (解決偏移問題)
 * 
 * @param {import('playwright').Page} page
 * @param {string} _timestamp
 * @param {Function} getRankingDataFn - 從 check.js 傳入的獲取全域攔截數據的函數
 */
async function checkRankingData(page, _timestamp, getRankingDataFn) {
  try {
    console.log('11️⃣ 開始排行榜數據檢查與對帳 (強化版)...');
    
    let apiData = getRankingDataFn();

    // --- 1. 等待數據 (如果第 9 點觸發的數據還在處理中) ---
    if (!apiData) {
      console.log('正在等待第 9 點觸發的排行榜封包...');
      for (let i = 0; i < 10; i++) { // 先等 5 秒
        apiData = getRankingDataFn();
        if (apiData) break;
        await page.waitForTimeout(500);
      }
    }

    // --- 2. 誘發 API (如果還是沒抓到數據) ---
    if (!apiData) {
      console.log('尚未抓到數據，執行手動誘發動作...');
      await page.evaluate(() => {
        // 精準尋找整個排行榜容器並對齊底部
        const container = document.querySelector('#weekly-ranking-7d') || document.querySelector('div[class*="_weeklyRanking_"]');
        if (container) {
          // 使用 block: 'end' 讓整個區塊容器對齊視窗底部
          container.scrollIntoView({ behavior: 'auto', block: 'end' });
        } else {
          // 備援方案
          const fallbackTitle = Array.from(document.querySelectorAll('h3, div, span')).find(el => 
            el.textContent.trim() === 'Weekly Ranking' || el.textContent.trim() === 'Ranking'
          );
          if (fallbackTitle) fallbackTitle.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
      });
      await page.waitForTimeout(1000);

      // 模擬點擊切換鈕來誘發 API (GS 1021)
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('div, button, span')).filter(el => 
          el.textContent.includes('Weekly') || el.textContent.includes('All Time')
        );
        if (tabs.length > 0) {
          // 點擊非當前啟動的標籤來誘發請求
          tabs.forEach(t => t.click());
        }
      });

      // 再次循環等待攔截數據更新
      console.log('正在等待誘發後的排行榜封包回傳...');
      for (let i = 0; i < 10; i++) {
        apiData = getRankingDataFn();
        if (apiData) {
          console.log(`✅ 成功獲取到數據`);
          break;
        }
        await page.waitForTimeout(500);
      }
    } else {
      console.log('✅ 已成功獲取到排行榜數據');
    }

    if (!apiData) {
       throw new Error('未能攔截到排行榜 API 數據 (AP 1021)。');
    }

    // --- 3. 數據提取與運算 ---
    // 根據提供的結構進行深層提取
    const rawRanking = apiData.data?.[0]?.data || apiData.data || apiData;
    const ranking7d = rawRanking.ranking_7d || [];
    const ranking30d = rawRanking.ranking_30d || [];

    const top3Weekly = ranking7d.slice(0, 3).map(u => ({ name: u.user_name, credit: u.credit }));
    const top3AllTime = ranking30d.slice(0, 3).map(u => ({ name: u.user_name, credit: u.credit }));
    
    // 計算 All Time 總加總 (30d)
    const calculatedTotal = ranking30d.reduce((sum, u) => sum + (parseFloat(u.credit) || 0), 0);
    
    console.log(`✅ API 數據解析成功。總額：${calculatedTotal}`);

    // --- 4. 動態校對 UI 總金額 (解決偏移與同步問題) ---
    let uiTotal = 0;
    let isMatched = false;

    // 確保排行榜區域穩定在視窗底部
    await page.evaluate(() => {
      const container = document.querySelector('#weekly-ranking-7d') || document.querySelector('div[class*="_weeklyRanking_"]');
      if (container) {
        container.scrollIntoView({ behavior: 'auto', block: 'end' });
      } else {
        const totalEl = document.querySelector('#total-donation-amount');
        if (totalEl) totalEl.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
    });
    await page.waitForTimeout(1000);

    console.log('開始與 UI 總金額進行動態校對 (最多 10 秒)...');
    for (let i = 0; i < 10; i++) {
      uiTotal = await page.evaluate(() => {
        const el = document.querySelector('#total-donation-amount span');
        if (!el) return 0;
        return parseFloat(el.textContent.replace(/,/g, '')) || 0;
      });

      // 容許極小誤差 (處理浮點數)
      if (Math.abs(uiTotal - calculatedTotal) < 0.1) {
        isMatched = true;
        break;
      }
      
      console.log(`第 ${i+1} 次比對：UI(${uiTotal}) vs API(${calculatedTotal}) - 尚未同步...`);
      await page.waitForTimeout(1000);
    }

    // --- 5. 🚀 核心修正：排行榜兩大區域真實截圖 (All Times & Weekly Ranking, 共 6 獎盃) ---
    console.log('正在執行排行榜實體影像抓取 (2 區域 x 3 獎盃 = 6 截圖)...');
    
    const captureRankingSection = async (titleText) => {
      return await page.evaluate(async (title) => {
        // 1. 尋找標題元素
        const headers = Array.from(document.querySelectorAll('h2, h3, div, span'));
        const header = headers.find(el => el.textContent.trim().toLowerCase() === title.toLowerCase());
        if (!header) return [];

        // 2. 尋找標題下方的第一個排行榜容器
        let container = header.nextElementSibling;
        while (container && !container.querySelector('div[class*="_rankingItem_"]')) {
          container = container.nextElementSibling;
        }
        if (!container) return [];

        // 3. 抓取前三名項目
        const items = Array.from(container.querySelectorAll('div[class*="_rankingItem_"]')).slice(0, 3);
        return items.map((item, index) => {
          // 檢查破圖
          const img = item.querySelector('img');
          const isBroken = img ? (img.naturalWidth === 0 || img.complete === false) : true;
          
          // 獲取元素位置以便後續截圖 (在 evaluate 外部執行截圖)
          const rect = item.getBoundingClientRect();
          return {
            rank: index + 1,
            isBroken,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            // 由於在 evaluate 內無法直接截圖，我們回傳選擇器或索引
            index: index
          };
        });
      }, titleText);
    };

    const sections = [
      { title: 'All Times', key: 'allTimes' },
      { title: 'Weekly Ranking', key: 'weekly' }
    ];

    const visualResults = { allTimes: [], weekly: [] };
    let anyBroken = false;

    for (const sec of sections) {
      console.log(`正在掃描區域: ${sec.title}...`);
      
      // 🚀 核心修正：截圖前強制「凍結」全網頁動畫與過渡效果，消除閃爍
      await page.addStyleTag({ content: `
        * { 
          transition: none !important; 
          animation: none !important; 
          scroll-behavior: auto !important; 
        }
      `});

      // 🚀 核心修正：改用 window.scrollTo 進行精準、無閃爍定位
      await page.evaluate((title) => {
        const headers = Array.from(document.querySelectorAll('h2, h3, div, span'));
        const header = headers.find(el => el.textContent.trim().toLowerCase() === title.toLowerCase());
        if (header) {
          const rect = header.getBoundingClientRect();
          const absoluteY = window.pageYOffset + rect.top - 100; // 預留 100px 緩衝
          window.scrollTo({ top: absoluteY, behavior: 'auto' });
        }
      }, sec.title);

      await page.waitForTimeout(800); // 增加靜止時間，確保圖片加載完全

      const sectionContainer = await page.evaluateHandle((title) => {
        const headers = Array.from(document.querySelectorAll('h2, h3, div, span'));
        const header = headers.find(el => el.textContent.trim().toLowerCase() === title.toLowerCase());
        let container = header?.nextElementSibling;
        while (container && !container.querySelector('div[class*="_rankingItem_"]')) {
          container = container.nextElementSibling;
        }
        return container;
      }, sec.title);

      if (sectionContainer.asElement()) {
        const items = await sectionContainer.$$('div[class*="_rankingItem_"]');
        for (let i = 0; i < Math.min(items.length, 3); i++) {
          const item = items[i];
          
          // 🚀 核心優化：改用「靜態座標剪裁」截圖，徹底消除視窗抖動與縮放
          // 1. 先在背景算出元素的精確座標
          const rect = await item.boundingBox();
          
          let base64;
          if (rect) {
            // 2. 使用 page.screenshot({ clip }) 進行「離屏剪裁」，不觸發 Playwright 的對齊補償
            const buffer = await page.screenshot({
              clip: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              }
            });
            base64 = `data:image/png;base64,${buffer.toString('base64')}`;
          } else {
            // 保底方案：如果抓不到座標才用原本的截圖
            const buffer = await item.screenshot();
            base64 = `data:image/png;base64,${buffer.toString('base64')}`;
          }
          
          const isBroken = await item.evaluate((el) => {
            const img = el.querySelector('img');
            return img ? (img.naturalWidth === 0 || img.complete === false) : true;
          });

          if (isBroken) anyBroken = true;

          visualResults[sec.key].push({
            rank: i + 1,
            screenshot: base64,
            isBroken: isBroken
          });
        }
      }
    }

    const finalSuccess = isMatched && !anyBroken && (visualResults.allTimes.length > 0 || visualResults.weekly.length > 0);

    return {
      success: finalSuccess,
      top3Weekly,
      top3AllTime,
      calculatedTotal,
      uiTotal,
      isMatched,
      visuals: visualResults, // 傳回兩排截圖數據
      anyBroken,
      message: anyBroken 
        ? `❌ 偵測到排行榜圖片破圖！` 
        : (isMatched ? `✅ 數據校對成功且 6 獎盃影像正常` : `❌ 數據不一致！`)
    };

  } catch (error) {
    console.error('11️⃣ 排行榜檢查失敗:', error.message);
    return {
      success: false,
      error: error.message,
      message: `測試失敗: ${error.message}`
    };
  }
}

module.exports = checkRankingData;
