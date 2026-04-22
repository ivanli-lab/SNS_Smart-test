# Changelog - 20260115-fix-step10-scroll-and-step11-selectors-v1.1.9

## [1.1.9] - 2026-01-15

### Changed
- **第 10 點 排行榜檢查**：
    - 調整滾動位置。原本為向上移 100px，現改為**下移 200px** (`window.scrollBy(0, -200)`)，以確保不會遮擋到上方的 Photo 按鈕。
- **第 11 點 直播主照片檢查**：
    - 優化頁籤與照片的選擇器，使用更精確的類名 (`_tabButton_`, `_photoImage_`) 與文字匹配。
    - 確保「展示 5 秒」與「關閉大圖」邏輯正確執行。
    - 流程結束後確保執行「頁面置頂」。
- **文件更新**：
    - 更新 `documents/test-logic.md` 與 `documents/test-tool-1.md` 中的邏輯說明與成功條件。

### Fixed
- 修正了排行榜滾動後遮擋上方 UI 的問題。
- 修正了照片檢查流程中可能因選擇器不精確導致的失敗。
