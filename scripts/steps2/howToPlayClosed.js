/**
 * 5️⃣ How to play (關閉說明彈窗)
 * @param {import('playwright').Page} page
 */
async function checkHowToPlayDialog(page) {
  const b = await page.waitForSelector('button[class*="_startButton_"]', { timeout: 5000 }).catch(() => null);
  if (b) {
    await b.click({ force: true });
    return { success: true, message: '已關閉說明彈窗' };
  }
  return { success: false, message: '未發現說明彈窗' };
}

module.exports = checkHowToPlayDialog;
