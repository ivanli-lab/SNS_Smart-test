/**
 * 1️⃣5️⃣ 聊天室視窗測試 (禁字過濾)
 * @param {import('playwright').Page} page
 */
async function checkChatRoom(page) {
  const input = await page.$('#chat-message-input');
  if (!input) return { success: false, message: '找不到輸入框' };

  const sendBtnSelector = 'button[data-send-button="true"]';

  // 1. 驗證禁字 agn88
  console.log('[Step 15] 正在模擬真人輸入禁字: agn88...');
  await input.click();
  await input.type('agn88', { delay: 150 }); 
  
  // 點擊 Send 按鈕送出
  const sendBtn = await page.$(sendBtnSelector);
  if (sendBtn) await sendBtn.click({ force: true });
  else await page.keyboard.press('Enter');
  
  console.log('[Step 15] 正在等待禁字警告訊息 (Message content is invalid)...');
  let detectedWarning = null;
  for (let i = 0; i < 10; i++) {
    detectedWarning = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Message content is invalid') || text.includes('agn88') || text.includes('invalid') ? 'detected' : null;
    });
    if (detectedWarning) break;
    await page.waitForTimeout(500);
  }
  
  if (detectedWarning) {
    console.log('[Step 15] ✅ 偵測到禁字訊息，停留 2 秒...');
    await page.waitForTimeout(2000);
  }

  // 2. 驗證正常文字 SNS-Test
  console.log('[Step 15] 正在輸入正常文字: SNS-Test...');
  await input.click();
  // 🚀 強化清空邏輯：先 fill('') 再搭配鍵盤清空
  await input.fill('');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(500);
  
  // 🚀 模擬更慢的打字速度，確保每個字元都進入 DOM
  await input.type('SNS-Test', { delay: 200 }); 
  await page.waitForTimeout(500); // 輸入完等一下再送出
  
  // 點擊 Send 按鈕送出
  if (sendBtn) await sendBtn.click({ force: true });
  else await page.keyboard.press('Enter');
  
  // 3. 補強驗證：使用 p[data-content="true"] 精確檢查聊天列表
  await page.waitForTimeout(2500); // 稍微增加等待時間確保訊息已上屏
  const isMessageInList = await page.evaluate((sentText) => {
    // 精確搜尋 p[data-content="true"] 標籤
    const messages = Array.from(document.querySelectorAll('p[data-content="true"]'));
    return messages.some(msg => msg.innerText.trim() === sentText);
  }, 'SNS-Test');

  console.log(`[Step 15] 聊天列表驗證結果: ${isMessageInList ? '已看見 SNS-Test' : '未看見 SNS-Test'}`);

  const isSuccess = !!detectedWarning && isMessageInList;

  return { 
    success: isSuccess, 
    message: `禁字偵測: ${detectedWarning ? '成功' : '失敗'}, 列表顯現: ${isMessageInList ? '成功' : '失敗'}` 
  };
}

module.exports = checkChatRoom;
