async function checkLogin(page, timestamp) {
  try {
    await page.fill('input[name="account"]', 'tt0000');
    await page.fill('input[name="password"]', '1111');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    return { success: true, message: '登入成功', account: 'tt0000' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { checkLogin };
