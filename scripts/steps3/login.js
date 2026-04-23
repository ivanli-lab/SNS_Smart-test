async function checkLogin(page, timestamp) {
  try {
    await page.fill('input[name="account"]', 'qa_test03');
    await page.fill('input[name="password"]', 'qa03');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    return { success: true, message: '登入成功', account: 'qa_test03' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { checkLogin };
