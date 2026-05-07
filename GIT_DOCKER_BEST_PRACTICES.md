# Git 與 Docker 開發最佳實踐指南 (Best Practices)

本指南旨在幫助開發者保持專案輕量、提高提交速度，並確保 Docker 部署流程的穩定性。

---

## 1. Git 提交注意事項 (Avoid Large Commits)

### 🚩 核心原則：只提交「原始碼」，不提交「產出物」。

*   **善用 `.gitignore`**：
    確保以下目錄/檔案永遠被排除，不可進入 Git：
    - `node_modules/` (套件庫)
    - `logs/` (日誌)
    - `temp_profiles/` 或 `user_data/` (瀏覽器暫存檔)
    - `*.tar`, `*.tar.gz`, `*.zip` (壓縮檔)
    - `*.exe`, `*.dmg` (執行檔)
    - `debug/` 或 `screenshots/` (測試產出的圖片)

*   **提交前的檢查清單**：
    1. `git status`：確認顯示的檔案清單中沒有異常的大資料夾。
    2. `git diff --stat HEAD~1 HEAD`：提交後檢查檔案變化大小。
    3. **觀察 Push 速度**：若推送時間超過 10 秒，請立刻檢查是否有大檔案。

### 🆘 遇到大檔案誤交 Git 的救磚指令
如果您不小心把 10GB 檔案 `commit` 了，請執行：
```bash
# 1. 軟重設回前一個 commit (保留修改)
git reset --soft HEAD~1

# 2. 清空 Git 暫存快取
git rm -r --cached .

# 3. 重新 git add . (此時新的 .gitignore 會生效)
git add .

# 4. 重新 commit 與 push
```

---

## 2. Docker 建置與部署注意事項 (Optimizing Docker)

### 🚩 核心原則：Build Context 越小越好。

*   **檢查 Build Context**：
    執行 `docker build` 時，第一行會顯示 `Sending build context to Docker daemon`。
    - **正常**：1MB ~ 100MB
    - **警告**：超過 500MB
    - **危險**：出現 GB 等級 (代表您正在把沒用的垃圾打包進映像檔)

*   **伺服器端清理計畫**：
    在正式伺服器部署新版前，建議先清理舊的殘留檔案：
    ```bash
    # 停止舊容器
    sudo docker compose down
    # 清理資料夾 (小心執行)
    sudo rm -rf [不必要的舊檔案]
    # 重新解壓乾淨的壓縮檔
    sudo tar -xzf sns-test.tar.gz
    ```

*   **釋放磁碟空間**：
    Docker 映像檔很佔空間，建議定期清理：
    ```bash
    # 刪除所有未使用的映像檔與快取 (釋放 GB 等級空間)
    sudo docker image prune -a
    ```

---

## 3. 打包與上傳 SOP (Manual Deployment)

當您需要手動打包專案上傳到伺服器時，請使用**明確排除模式**：

```bash
# 推薦的打包指令
tar -czf sns-test.tar.gz \
  --exclude='node_modules' \
  --exclude='temp_profiles' \
  --exclude='logs' \
  --exclude='*.tar.gz' \
  --exclude='.git' \
  .
```

---

## 4. 快速檢查工具表

| 目的 | 指令 |
| :--- | :--- |
| 查看資料夾佔用空間 | `du -sh * | sort -h` |
| 查看本地 Docker 磁碟佔用 | `docker system df` |

---
*最後更新日期：2026-05-06*
