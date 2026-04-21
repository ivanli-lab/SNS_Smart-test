async function checkGameLoad(diag) {
  const loadStartTime = Date.now();
  let isLoaded = false;
  while (Date.now() - loadStartTime < 90000) {
    if (diag.activeGamePage.isClosed()) break;
    if (diag.lastRenameOkAt > 0) {
      console.log(`\x1b[32m[STEP 4] ✅ 偵測到 GS API 成功通訊，遊戲載入完成。\x1b[0m`);
      isLoaded = true;
      break;
    }
    if (diag.last109At > 0 && (Date.now() - diag.last109At < 5000)) {
      throw new Error('偵測到致命 109 Invalid Token (來自 Spin API)');
    }
    await diag.activeGamePage.waitForTimeout(1000);
  }
  if (!isLoaded) throw new Error('遊戲載入超時');
  return {
    success: true,
    message: '✅ 遊戲載入完成',
    token: diag.gameApiToken ? `${diag.gameApiToken.substring(0, 15)}...` : '已取得'
  };
}

module.exports = { checkGameLoad };
