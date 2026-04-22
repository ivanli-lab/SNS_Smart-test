/**
 * 1️⃣ 彈窗檢查 (Stream n'Spin)
 * @param {import('playwright').Page} page
 */
async function checkStreamNSpinDialog(page) {
  return await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => 
      (b.innerText.includes('Confirm') || b.innerText.includes('確定')) && 
      b.offsetParent !== null
    );
    if (btn) {
      const r = btn.getBoundingClientRect();
      return { found: true, clicked: true, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return { found: false };
  }).then(async res => {
    if (res.found) {
      await page.mouse.click(res.x, res.y);
    }
    return res;
  });
}

module.exports = checkStreamNSpinDialog;
