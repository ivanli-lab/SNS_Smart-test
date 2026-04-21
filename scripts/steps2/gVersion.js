/**
 * 4️⃣ 版本號檢測
 * @param {import('playwright').Page} page
 */
async function checkGVersion(page) {
  const v = await page.evaluate(() => window.gVersion).catch(() => null);
  return { success: !!v, version: v, found: !!v };
}

module.exports = checkGVersion;
