async function openGameList(page) {
  const openBtn = page.locator('button', { hasText: 'Open Game List' });
  await openBtn.waitFor({ state: 'visible' });
  const listStartTime = Date.now();
  await openBtn.click();
  await page.waitForTimeout(3000);
  const listDuration = ((Date.now() - listStartTime) / 1000).toFixed(1);
  return { success: true, message: '✅ 已進入遊戲列表', duration: listDuration };
}

module.exports = { openGameList };
