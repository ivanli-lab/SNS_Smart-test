/**
 * gVersion 版號測試
 * 
 * 測試目的：驗證系統版本號是否正確設定
 * 
 * 元素定位策略：
 * 1. 檢查 window.gVersion 全局變數
 * 2. 查找 meta 標籤 <meta name="gVersion"> 或 <meta property="gVersion">
 * 3. 掃描所有 script 標籤內容，使用正則匹配 gVersion = "x.x.x"
 * 
 * @param {import('playwright').Page} page - Playwright 頁面物件
 * @returns {Promise<{found: boolean, version: string | null}>} 測試結果
 */
async function checkGVersion(page) {
    const gVersion = await page.evaluate(() => {
      try {
      if (typeof window !== 'undefined' && window.gVersion !== undefined) {
          return window.gVersion;
        }
      const metas = document.querySelectorAll('meta[name="gVersion"], meta[property="gVersion"]');
      for (const m of metas) {
        const v = m.getAttribute('content');
        if (v) return v;
      }
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const txt = (s.textContent || '').toString();
        let m = txt.match(/gVersion\s*[=:]\s*['"]([^'"\n]+)['"]/);
        if (m && m[1]) return m[1];
        m = txt.match(/gVersion\s*[=:]\s*(\d+\.\d+\.\d+)/);
        if (m && m[1]) return m[1];
      }
      } catch (e) {
        return null;
      }
    return null;
  });
  return { found: gVersion != null, version: gVersion };
}

module.exports = checkGVersion;
