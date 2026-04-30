async function openGameList(page) {
    console.log('\x1b[35m--- [DIAG] 開始全方位搜尋 Open Game List 按鈕 ---\x1b[0m');
    const btnSelector = 'button:has-text("Open Game List")';

    try {
        // 1. 先等一下下，確保所有 Frame 都載入
        await page.waitForTimeout(3000);

        // 2. 嘗試直接在主頁面尋找
        const mainBtn = page.locator(btnSelector).first();
        if (await mainBtn.isVisible()) {
            console.log('--- [DIAG] 在主頁面直接找到按鈕！ ---');
            await mainBtn.click();
            return { success: true };
        }

        // 3. 如果主頁面沒有，遍歷所有的 iframe (這招是絕招)
        const allFrames = page.frames();
        console.log(`--- [DIAG] 偵測到 ${allFrames.length} 個 Frame，開始逐一掃描... ---`);

        for (const frame of allFrames) {
            try {
                const btn = frame.locator(btnSelector).first();
                if (await btn.isVisible()) {
                    console.log(`--- [DIAG] 成功在 Frame [${frame.url().substring(0, 50)}...] 中定位並點擊！ ---`);
                    await btn.click();
                    return { success: true };
                }
            } catch (frameErr) {
                // 這個 Frame 沒找到，繼續找下一個
                continue;
            }
        }

        throw new Error("掃描完所有頁面與 Frame 仍找不到按鈕");

    } catch (e) {
        console.error('--- [ERROR] openGameList 失敗:', e.message);
        return { success: false, error: e.message };
    }
}

module.exports = openGameList;