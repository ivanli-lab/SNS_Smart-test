# SAC 後台自動化測試規範 (SNS Stream)

本文件定義了針對 SAC 後台及其關聯遊戲（如 4400, 4600, 3500）的自動化測試邏輯、座標測量標準、智慧等待機制以及穩定性判定標準。

## 🧪 測試目標
驗證從 SAC 後台登入後，能否順利開啟指定遊戲，並在正確的遊戲 Token 環境下執行單次 Spin 與 AutoSpin 測試，最後跳轉回 SAC 啟動串流。

---

## 🗺️ 測試流程 (Test Flow)

### 1️⃣ 登入功能測試 (`login`)
*   **帳號/密碼**：`tt0000` / `1111`
*   **智慧選取器**：針對 SAC 登入頁面 input 無 `name` 屬性的問題，採用 `nth(0)` 與 `nth(1)` 定位技術。
*   **驗證**：確保進入 SAC 首頁並看見 `Open Game List` 按鈕。

### 2️⃣ 點擊 Open Game List (`openGameList`)
*   **動作**：點擊 `Open Game List` 按鈕。
*   **驗證**：確保遊戲列表成功展開。

### 3️⃣ 點擊遊戲 (`launchGame`)
*   **動作**：點擊指定遊戲 ID 圖示。
*   **分頁**：捕獲新開啟的遊戲分頁 (`GAME_PAGE`)。

### 4️⃣ 載入遊戲與穩定性檢查 (`checkGameLoad`)
*   **核心邏輯**：**身分絕對隔離**。
*   **解析度校準**：維持原始視窗比例，確保座標精準度。
*   **成功判定**：收到 GS API 回傳 `error_code: 0`。

### 5️⃣ Spin 鈕點擊測試 (`checkSpaceSpin`)
*   **動作**：使用「真人點擊模式」(MouseDown -> Wait 100ms -> MouseUp)。
*   **驗證**：監聽網路封包，確保點擊後收到 Spin 回應。

### 6️⃣ AutoSpin 鈕點擊測試 (`gameOperation`)
*   **智慧等待 (Free Game)**：
    *   **偵測**：監聽 `gs.ingmsrv.cc` 封包，若 `get_sub_game: true` 則判定進入 Free Game。
    *   **破冰**：等待期間每 3 秒點擊一次畫面中央 `(0.5, 0.5)`，嘗試點掉彈窗。
    *   **緩衝**：偵測到 `data: []` (Free Game 結束) 後，額外等待 8 秒讓計分動畫跑完才執行點擊。
*   **動作**：點擊 AutoSpin 鈕 -> (如有 extra 則點擊開關) -> 點擊 OK。

### 7️⃣ 點擊 Start Streaming (`startStreaming`)
*   **動作**：跳轉回 SAC 分頁，點擊 `Start Streaming`。
*   **成功判定**：按鈕文字由 `Start Streaming` 變更為 `Stop Streaming`。

---

## 📐 座標測量指南 (精準座標抓取)

為了確保自動化點擊能精準命中 Canvas 上的按鈕，必須使用以下腳本進行測量。

### 🚀 終極座標尺 (JavaScript Code)
請在遊戲畫面的瀏覽器控制台 (F12 Console) 中貼入以下代碼：

```javascript
(function() {
    const canvas = document.querySelector('canvas') || document.getElementsByTagName('canvas')[0];
    if (!canvas) {
        console.error("%c ❌ 找不到 Canvas！請確保您是在遊戲的 iframe 內執行此腳本。", "color: white; background: red; padding: 5px;");
        return;
    }

    console.log("%c 🚀 終極座標尺已就緒！請點擊 Canvas 上的按鈕來獲取百分比座標。", "color: white; background: purple; padding: 5px;");
    console.log(`%c 📊 當前內容區尺寸: ${window.innerWidth} x ${window.innerHeight} (Ratio: ${window.devicePixelRatio})`, "color: #333; background: #eee;");

    canvas.addEventListener('mousedown', function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        
        console.log(`%c 🎯 座標捕獲！`, "color: green; font-weight: bold; font-size: 14px;");
        console.log(`%c x: ${x.toFixed(4)}, y: ${y.toFixed(4)} `, "color: white; background: #222; padding: 3px; border-radius: 3px;");
        console.log(`(絕對座標參考: clientX=${e.clientX}, clientY=${e.clientY})`);
    });
})();
```

### 📝 標註規範
在 `GAME_COORDINATE_MAP` 中標註時，請統一使用以下格式：
*   **Spin**: 遊戲的主旋轉按鈕。
*   **Auto**: 開啟自動旋轉選單的按鈕。
*   **Extra**: (選填) 進入選單後，若需額外點擊的開關（如 Spin Times）。
*   **OK**: 最後確認啟動 AutoSpin 的按鈕。

---

## 🛡️ 核心技術規範

### 1. 視窗焊死機制
測試完成後，視窗將保持開啟，禁止自動關閉，以便人工檢查遊戲狀態。

### 2. 座標保護
禁止強制鎖定 `deviceScaleFactor`，以維持與開發環境一致的像素渲染，確保座標點擊 100% 準確。

### 3. 智慧封包監聽
系統會自動過濾非必要的日誌，僅針對關鍵的 GS (Game Server) 封包進行解析，確保測試流程的高效與穩定。
