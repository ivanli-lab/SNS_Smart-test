/**
 * Test Tool 2 共用工具函數
 */

/**
 * 在所有 Frame 中尋找元素
 */
async function findElementInAnyFrame(page, selector) {
  const main = await page.$(selector);
  if (main) return { element: main, frame: page };
  for (const f of page.frames()) {
    const el = await f.$(selector);
    if (el) return { element: el, frame: f };
  }
  return null;
}

/**
 * 獲取畫面上顯示的金額 (Bet, Balance, Spin Round)
 */
async function getDisplayedAmount(page, type) {
  return await page.evaluate((t) => {
    const divs = Array.from(document.querySelectorAll('div[data-text="true"]'));
    const target = divs.find(div => div.innerText?.toLowerCase().includes(t));
    if (target) {
      const rawText = target.innerText;
      const cleanText = rawText.replace(/,/g, '').replace(/\s/g, '');
      const match = cleanText.match(/\d+\.?\d*/);
      return match ? parseFloat(match[0]) : 0;
    }
    return 0;
  }, type);
}

/**
 * 尋找 Bet 控制按鈕 (+, -)
 */
async function findBetButton(page, type, index = 0) {
  const pathKey = type === '+' ? '256 80c0-17.7' : '432 256c0 17.7'; 
  return await page.evaluate(({ key, idx }) => {
    const svgs = Array.from(document.querySelectorAll('svg')).filter(s => {
      const path = s.querySelector('path');
      return path && (path.getAttribute('d') || '').includes(key);
    });
    if (svgs[idx]) {
      const r = svgs[idx].getBoundingClientRect();
      return { found: true, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return { found: false };
  }, { key: pathKey, idx: index });
}

module.exports = {
  findElementInAnyFrame,
  getDisplayedAmount,
  findBetButton
};
