/**
 * 2️⃣ 開啟直播間 (從 Streaming Now 區域)
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Page} page
 */
async function checkStreamingNowClick(context, page) {
  let targetHandle = null;
  
  // 等待頁面穩定
  await page.waitForTimeout(2000);

  const allFrames = [page, ...page.frames()];
  for (const frame of allFrames) {
    targetHandle = await frame.evaluateHandle(() => {
      // 1. 先找包含 "Streaming Now" 的標題區域
      const headers = Array.from(document.querySelectorAll('div, span, h1, h2, h3'))
        .find(el => el.innerText?.includes('Streaming Now'));
      
      if (!headers) return null;

      // 2. 獲取所有直播卡片
      const allCovers = Array.from(document.querySelectorAll('div[data-cover="true"]'));
      
      // 優先級 1: 尋找指定主播 game01 的卡片
      const game01Card = allCovers.find(c => 
        c.querySelector('img[data-streamer="true"][src*="game01.png"]')
      );

      // 保底: 選擇該區域內的第一張卡片
      return game01Card || allCovers[0];
    }).then(h => h.asElement());
    if (targetHandle) break;
  }

  if (!targetHandle) {
    return { success: false, error: '找不到直播卡片' };
  }

  // 執行點擊並等待新分頁
  let newPage = null;
  try {
    const [p] = await Promise.all([
      context.waitForEvent('page', { timeout: 20000 }),
      targetHandle.click({ force: true, delay: 50 })
    ]);
    newPage = p;
  } catch (clickErr) {
    // 備案：如果第一次沒開成功，嘗試直接點擊座標
    const box = await targetHandle.boundingBox();
    if (box) {
      const [p] = await Promise.all([
        context.waitForEvent('page', { timeout: 15000 }),
        page.mouse.click(box.x + box.width/2, box.y + box.height/2)
      ]).catch(() => [null]);
      newPage = p;
    }
  }

  if (!newPage) {
    return { success: false, error: '點擊後未開啟分頁' };
  }

  return { success: true, newPage };
}

module.exports = checkStreamingNowClick;
