# Live Slot 17-18 點開發死因分析 (Post-Mortem)

**日期**: 2026-02-04  
**範圍**: `routes/check2.js`, `public/test2.html`

---

## 死因一：API 回傳格式被破壞

**症狀**: 前端收不到正確的測試結果，displayTestResults 無法解析。

**根因**: 重構時移除了 `results` 變數與 `results.checks.streamingNowClick` 的組裝邏輯，導致 `return results` 拋出 `ReferenceError`，API 從未正常回傳。

**修復**: 保留 `const results = { url, timestamp, checks: {} }`，並在 try 結尾組裝 `results.checks.streamingNowClick = { ...stepResults, newPageOpened }`。

---

## 死因二：finalAccounting 無限 hang

**症狀**: 測試永遠不結束，前端 fetch 一直等待。

**根因**: 第 18 點結尾使用 `await new Promise(() => {})` 刻意不 resolve，導致整個 `checkWebsite` 永不回傳。

**修復**: 移除無限 Promise，改為直接計算帳務並回傳結果。

---

## 死因三：browser 未關閉

**症狀**: 測試結束後 browser 視窗殘留，process 可能無法正常結束。

**根因**: 重構時移除了 `finally` 區塊中的 `browser.close()`。

**修復**: 恢復 `finally { if (browser) { await delay(3000); await browser.close(); } }`。

---

## 死因四：test2.html 語法錯誤

**症狀**: 點擊 URL 下拉選單外部時，`document.addEventListener('mousedown')` 拋錯，可能導致後續 init 中斷。

**根因**: 第 614 行 `if (!dropdown.contains(e.target) e.target !== dropdownBtn)` 缺少 `&&`。

**修復**: 改為 `if (!dropdown.contains(e.target) && e.target !== dropdownBtn)`。

---

## 死因五：網址與 Test Flow 消失（推測）

**症狀**: 使用者回報「網址不見了、Test Flow 也不見了」。

**可能根因**:
1. `config.js` 路徑改為 `/config.js` 後，在某些環境下載入失敗。
2. 上述語法錯誤導致 init 中斷，`initTestList()` 未執行，Test Flow 維持空白。
3. 額外的 null 檢查或 try-catch 可能隱藏了真實錯誤。

**修復**: 還原 `config.js` 路徑、還原原始 init 邏輯，僅保留 `&&` 修正。

---

## 死因六：1-16 點邏輯被過度改動

**症狀**: 使用者回報「Live Slot 都修壞了」。

**根因**: 為支援 17-18 點，改動了 1-16 的流程：
- 將 `streamingNowClick` 失敗改為 `throw`，中斷後續步驟
- 移除 `Promise.race` 等待新頁面載入
- 改動 WebSocket Join 的解析與結構
- 移除 streamNSpinDialog 的 try-catch

**修復**: 以原始 check2.js 為基底，僅新增 17-18 所需的最小改動（accounting、broadcast_payout 抓取、兩個 runStep）。

---

## 死因七：broadcast_payout 資料抓取錯誤

**症狀**: 單號變成 2028 開頭、金額為 0。

**根因**:
1. 使用 `raw.match()` 正則搜尋，可能抓到 `history_order_id` 或其他數字
2. 未將長數字轉為字串，導致 JavaScript 精度丟失
3. 過度依賴 `obj.data` 層級，而實際資料可能在同一層

**修復**: 直接從解析後的 `payload` / `payload.data` 讀取 `order_id`、`payout_credit`，並在 parse 前對 15 位以上數字做字串保護。

---

## 已修正項目 (打掃戰場)

| 項目 | 修正 |
|------|------|
| `check2.js` 的 `totalSteps` | 16 → 18 |
| `server.js` progress2 fallback | totalSteps: 17 → 18 |
| joinData 的 `credit` vs `balance` | 使用 `joinData?.credit ?? joinData?.balance` 相容兩種欄位 |
