/**
 * 網路封包記錄工具
 * 記錄 HTTP 請求/回應和 WebSocket 封包
 */

function setupNetworkLogging(page, options = {}) {
  const {
    maxBodyLength = 1000
  } = options;
  
  // HTTP 請求監聽
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    
    const headers = request.headers();
    const postData = request.postData();
    
    console.log(`[HTTP REQUEST] ${method} ${url}`);
    
    // 記錄 headers（過濾敏感資訊）
    if (Object.keys(headers).length > 0) {
      console.log(`[HTTP REQUEST HEADERS] ${JSON.stringify(headers, null, 2)}`);
    }
    
    // 記錄 POST body
    if (postData) {
      try {
        const data = JSON.parse(postData);
        console.log(`[HTTP REQUEST BODY] ${JSON.stringify(data, null, 2)}`);
      } catch (e) {
        const truncated = postData.length > maxBodyLength 
          ? postData.substring(0, maxBodyLength) + '...' 
          : postData;
        console.log(`[HTTP REQUEST BODY] ${truncated}`);
      }
    }
  });
  
  // HTTP 回應監聽
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    
    const headers = response.headers();
    const contentType = headers['content-type'] || '';
    
    console.log(`[HTTP RESPONSE] ${status} ${url}`);
    console.log(`[HTTP RESPONSE HEADERS] ${JSON.stringify(headers, null, 2)}`);
    
    // 只記錄 JSON 回應（避免日誌過大）
    if (contentType.includes('application/json')) {
      try {
        const body = await response.json();
        console.log(`[HTTP RESPONSE BODY] ${JSON.stringify(body, null, 2)}`);
      } catch (e) {
        // 忽略無法解析的 JSON
      }
    }
  });
  
  // WebSocket 完整監聽
  page.on('websocket', ws => {
    const wsUrl = ws.url();
    console.log(`[WEBSOCKET] 連線建立: ${wsUrl}`);
    
    // 記錄發送的封包
    ws.on('framesent', event => {
      try {
        const data = JSON.parse(event.payload);
        console.log(`[WEBSOCKET SENT] ${JSON.stringify(data, null, 2)}`);
      } catch (e) {
        const truncated = event.payload.length > maxBodyLength
          ? event.payload.substring(0, maxBodyLength) + '...'
          : event.payload;
        console.log(`[WEBSOCKET SENT] ${truncated}`);
      }
    });
    
    // 記錄接收的封包
    ws.on('framereceived', event => {
      try {
        const data = JSON.parse(event.payload);
        console.log(`[WEBSOCKET RECEIVED] ${JSON.stringify(data, null, 2)}`);
      } catch (e) {
        const truncated = event.payload.length > maxBodyLength
          ? event.payload.substring(0, maxBodyLength) + '...'
          : event.payload;
        console.log(`[WEBSOCKET RECEIVED] ${truncated}`);
      }
    });
    
    // 記錄連線關閉
    ws.on('close', () => {
      console.log(`[WEBSOCKET] 連線關閉: ${wsUrl}`);
    });
  });
}

module.exports = { setupNetworkLogging };
