const { chromium } = require('playwright');
const { askToContinue } = require('../utils/interaction');
const fs = require('fs');
const path = require('path');

const debugDir = path.join(__dirname, '..', 'debug');
if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

let currentStep2 = null;
const stepResults2 = {};
const totalSteps2 = 15;
let activeBrowser = null;
let stopRequested = false;
let isRunning = false;

function setCurrentStep2(stepKey) { currentStep2 = stepKey; }
function updateStepResult2(stepKey, result) { stepResults2[stepKey] = result; }
function getProgress2() {
    return {
        currentStep: currentStep2,
        stepResults: stepResults2,
        totalSteps: totalSteps2,
        isRunning,
        stopRequested
    };
}
function resetProgress2() {
    currentStep2 = null;
    Object.keys(stepResults2).forEach(key => delete stepResults2[key]);
    stopRequested = false;
}

function isStopError(error) {
    return error?.name === 'StopRequestedError' || /Target page, context or browser has been closed/i.test(error?.message || '');
}

function ensureNotStopped() {
    if (stopRequested) {
        const error = new Error('Test stopped by user');
        error.name = 'StopRequestedError';
        throw error;
    }
}

async function stopNicknameTest() {
    stopRequested = true;
    currentStep2 = null;
    updateStepResult2('stopped', { success: false, stopped: true, message: '測試已停止' });
    if (activeBrowser) {
        await activeBrowser.close().catch(() => { });
    }
}

/**
 * 產生隨機暱稱: sns + 4-5位隨機英數字
 */
function generateRandomNickname() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'sns';
    // 隨機決定長度為 4 或 5
    const length = Math.floor(Math.random() * 2) + 4;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 【核心修正】先消除翻譯列，再點擊目標
 * 翻譯列使整個頁面高度偏移約40px，這是所有座標點擊失敗的根本原因
 */
async function dismissTranslateBar(page) {
    const viewport = page.viewportSize() || { width: 1280, height: 720 };

    // 嘗試點擊翻譯列右側的「X」關閉按鈕（固定在右上角）
    const x_btn = await page.evaluate(() => {
        // 尋找 role="button" 或有 title/aria-label 含 close 的按鈕
        const candidates = Array.from(document.querySelectorAll('button, div, span, cr-icon-button'));
        const closeBtn = candidates.find(el => {
            const rect = el.getBoundingClientRect();
            const label = (el.ariaLabel || el.title || el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
            // 在頂部區域，且是小按鈕，且含有 close 相關提示
            return rect.top < 60 && rect.top >= 0 && rect.width < 40 && (label.includes('close') || label.includes('never') || label.includes('x'));
        });
        if (closeBtn) {
            const r = closeBtn.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
                closeBtn.click();
                return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            }
        }
        return null;
    });

    if (x_btn) {
        console.log(`[Translate Killer] Clicked X button at (${x_btn.x.toFixed(0)}, ${x_btn.y.toFixed(0)})`);
    } else {
        // 矩陣式轟炸：在右上角可能區域點擊 9 個點，確保命中 X
        // 增加針對現代 Chrome 翻譯泡泡的點擊 (通常在網址列下方或右上角)
        const bombs = [
            { x: viewport.width - 25, y: 25 },
            { x: viewport.width - 45, y: 45 },
            { x: viewport.width - 100, y: 80 }
        ];
        for (const b of bombs) {
            await page.mouse.click(b.x, b.y).catch(() => { });
        }
    }

    // 額外嘗試：點擊可能存在的 Menu 旁的 X (針對 Chrome 泡泡)
    await page.waitForTimeout(500);

    // 強制隱藏所有可疑橫條與泡泡
    await page.evaluate(() => {
        const selectors = [
            '.yt-translate-bar', '#google-translate-element', '.goog-te-banner-frame',
            '[class*="translate"] iframe', '#goog-gt-tt', '.goog-te-balloon-frame',
            '#translate-button', '.translate-bubble', '.translation-bar',
            '#translate-bar', 'cr-translate-bubble', '.goog-te-menu-frame'
        ];
        selectors.forEach(s => {
            document.querySelectorAll(s).forEach(el => {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('opacity', '0', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
            });
        });

        // 清除推擠版面的 margin
        document.documentElement.style.setProperty('margin-top', '0px', 'important');
        document.body.style.setProperty('margin-top', '0px', 'important');
        if (document.body.style.top) document.body.style.setProperty('top', '0px', 'important');
    });
}

async function smartClick(page, textRegex, description = 'Element') {
    // 🚀 每次點擊前自動清理翻譯列
    await dismissTranslateBar(page).catch(() => {});
    console.log(`[Diagnostic] Seeking ${description} (${textRegex})...`);

    const frames = page.frames();
    for (const frame of frames) {
        try {
            // 方法 A: 實體點擊
            const els = frame.locator('button, div, span, a, [role="button"]').filter({ hasText: textRegex });
            const count = await els.count().catch(() => 0);
            for (let i = count - 1; i >= 0; i--) {
                const el = els.nth(i);
                if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
                    await el.click({ force: true, timeout: 2000 }).catch(() => {});
                    console.log(`[Diagnostic] SUCCESS: Clicked ${description} in frame ${frame.name() || 'main'}`);
                    return true;
                }
            }

            // 方法 B: JS 強制點擊
            const jsClicked = await frame.evaluate(({ pattern, flags }) => {
                const regex = new RegExp(pattern, flags);
                const all = Array.from(document.querySelectorAll('button, div, span, a, [role="button"]'));
                const target = all.reverse().find(el => {
                    const content = el.textContent || el.innerText || '';
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return regex.test(content) && rect.width > 2 && style.display !== 'none' && style.visibility !== 'hidden';
                });
                if (target) {
                    target.click();
                    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    return true;
                }
                return false;
            }, { pattern: textRegex.source, flags: textRegex.flags }).catch(() => false);

            if (jsClicked) {
                console.log(`[Diagnostic] SUCCESS: Clicked ${description} via JS in frame ${frame.name() || 'main'}`);
                return true;
            }
        } catch (e) { }
    }
    return false;
}

/**
 * 跨框架尋找輸入框
 */
async function findInputInFrames(page, selector) {
    const frames = page.frames();
    for (const frame of frames) {
        try {
            const input = frame.locator(selector).first();
            if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
                return input;
            }
        } catch (e) {}
    }
    return null;
}

async function checkWebsite2(url) {
    console.log('[Diagnostic] Launching Chromium (Ultra-Clean Mode)...');
    stopRequested = false;
    isRunning = true;
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--start-maximized',
            '--disable-notifications',
            '--disable-infobars',
            '--disable-features=Translate', // 嘗試從底層停用翻譯功能
            '--lang=en-US,en'               // 設定語系以減少翻譯提示
        ]
    });
    activeBrowser = browser;

    const context = await browser.newContext({
        locale: 'en-US',
        viewport: { width: 1366, height: 768 } // 強制固定尺寸，避免 Docker 內最大化失敗
    });

    // 🚀 在所有頁面（包含 Iframe）初始化時注入 CSS 與 JS 炸彈
    await context.addInitScript(() => {
        const style = document.createElement('style');
        style.id = 'kill-translate-style';
        style.innerHTML = `
            .goog-te-banner-frame, .goog-te-menu-value, .goog-te-balloon-frame,
            #goog-gt-tt, .goog-te-spinner-pos, cr-translate-bubble,
            .translation-bar, #translate-bar, #google-translate-element, .goog-te-menu-frame { 
                display: none !important; 
                visibility: hidden !important; 
                opacity: 0 !important; 
                pointer-events: none !important; 
            }
            body { top: 0px !important; margin-top: 0px !important; }
        `;
        const root = document.head || document.documentElement;
        if (root) root.appendChild(style);

        // 每 200ms 強力掃蕩一次，包含 Shadow DOM
        setInterval(() => {
            const kill = (root) => {
                if (!root) return;
                // 處理標準 DOM
                root.querySelectorAll('cr-translate-bubble, .translation-bar, #google-translate-element, goog-te-banner-frame').forEach(el => el.remove());
                // 遍歷 Shadow DOM
                const all = root.querySelectorAll('*');
                all.forEach(el => {
                    if (el.shadowRoot) kill(el.shadowRoot);
                });
            };
            kill(document);
            if (document.body) {
                document.body.style.setProperty('margin-top', '0px', 'important');
                document.body.style.setProperty('top', '0px', 'important');
            }
        }, 200);
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    resetProgress2();

    try {
        ensureNotStopped();
        // 1️⃣ Initialize
        setCurrentStep2('versionCheck');
        console.log('[Step 1] Initializing page:', url);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        const actualSize = page.viewportSize();
        console.log(`[Diagnostic] Current Viewport: ${actualSize.width}x${actualSize.height}`);
        
        // 確保頁面在最頂部
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(3000);
        ensureNotStopped();

        // 擊殺翻譯列
        await dismissTranslateBar(page);
        ensureNotStopped();

        const gVersion = await page.evaluate(() => window.gVersion || 'unknown');
        updateStepResult2('versionCheck', { success: true, value: gVersion });

        // 2️⃣ Nickname Dialog
        setCurrentStep2('nicknameDialog');
        console.log('[Step 2] Handling initial nickname...');

        // 依照需求：在點擊暱稱視窗前再次精準擊殺翻譯列
        console.log('[Step 2] Final Translate Killing before Nickname OK...');
        await dismissTranslateBar(page);
        await page.waitForTimeout(1000);

        let nicknameConfirmed = false;
        console.log('[Step 2] Waiting for nickname confirm dialog...');
        for (let i = 0; i < 8; i++) {
            ensureNotStopped();
            const ok = await smartClick(page, /Confirm|確認|OK|I understand/i, 'Nickname OK');
            if (ok) {
                nicknameConfirmed = true;
                console.log('[Step 2] Clicked OK/Confirm button.');
                break;
            }
            // 檢查是否其實已經進入 Lobby 了 (使用您提供的 data-info 屬性偵測)
            const lobbyState = await page.evaluate(() => {
                const hasDataInfo = !!document.querySelector('div[data-info="true"]');
                const text = document.body.innerText;
                const hasBalance = text.includes('Balance') || !!document.querySelector('[class*="balance"]');
                return hasDataInfo || hasBalance;
            });
            
            if (lobbyState) {
                console.log('[Step 2] Lobby features (data-info/Balance) detected. Skipping...');
                nicknameConfirmed = true;
                break;
            }
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);
        }
        updateStepResult2('nicknameDialog', { success: nicknameConfirmed });

        // 3️⃣ Change Nickname
        setCurrentStep2('tcNicknameChange');
        console.log('[Step 2] Changing nickname...');

        await dismissTranslateBar(page);
        await page.waitForTimeout(1500);
        ensureNotStopped();

        // 🚀 嘗試開啟暱稱視窗
        let dialogOpened = false;
        let inputLocator = null;
        const nicknameSelector = 'input[type="text"], input[placeholder*="nickname" i], input[placeholder*="暱稱" i], #nickname-input';
        
        for (let attempt = 0; attempt < 8; attempt++) {
            ensureNotStopped();
            console.log(`[Step 2] Attempting to open profile settings (Try ${attempt + 1})...`);
            
            await dismissTranslateBar(page).catch(() => {});
            if (attempt > 0) await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(1000);

            // 【主力方法】使用您提供的 data-info="true" 進行點擊
            let clicked = false;
            const frames = page.frames();
            for (const frame of frames) {
                const infoBtn = frame.locator('div[data-info="true"]').first();
                if (await infoBtn.isVisible().catch(() => false)) {
                    await infoBtn.click({ force: true });
                    console.log('[Step 2] Success: Clicked div[data-info="true"]');
                    clicked = true;
                    break;
                }
                
                // 備案：點擊包含 "Balance" 文字的 span 或其父層
                const balanceLoc = frame.locator('span:has-text("Balance")').first();
                if (await balanceLoc.isVisible().catch(() => false)) {
                    await balanceLoc.click({ force: true });
                    console.log('[Step 2] Success: Clicked Balance span');
                    clicked = true;
                    break;
                }
            }

            if (!clicked) {
                // 最後備案：座標點擊 (根據 1366x768 比例)
                const vp = page.viewportSize() || { width: 1366, height: 768 };
                await page.mouse.click(vp.width - 150, 40);
                console.log('[Step 2] Using fallback coordinate click.');
            }

            // 檢查輸入框是否出現
            inputLocator = await findInputInFrames(page, nicknameSelector);
            if (inputLocator && await inputLocator.isVisible({ timeout: 2500 }).catch(() => false)) {
                dialogOpened = true;
                console.log('[Step 2] Nickname input found!');
                break;
            }
            
            // 如果最後一次嘗試還是失敗，截圖診斷
            if (attempt === 7 && !dialogOpened) {
                const debugPath = `public/screenshots/lobby/step3-debug-${Date.now()}.png`;
                await page.screenshot({ path: debugPath }).catch(() => {});
                console.log(`[Step 3] Diagnostic screenshot saved to: ${debugPath}`);
            }
        }

        let newName = generateRandomNickname();

        if (dialogOpened) {
            console.log(`[Step 2] Dialog opened. Initial name choice: ${newName}`);

            for (let i = 0; i < 15; i++) {
                ensureNotStopped();
                // 🚀 更加擬人的輸入方式
                console.log(`[Step 2] Attempting to set nickname: ${newName} (Try ${i + 1})`);
                
                try {
                    await inputLocator.focus();
                    await inputLocator.click({ clickCount: 3 }); // 強力全選
                    await page.keyboard.press('Backspace');
                    await page.waitForTimeout(500);
                    await inputLocator.type(newName, { delay: 50 });
                    await page.waitForTimeout(500);
                    
                    // 檢查值是否正確輸入
                    const val = await inputLocator.inputValue().catch(() => '');
                    if (val !== newName) {
                        await inputLocator.fill(newName); // 備案：強制 Fill
                    }
                } catch (e) {
                    console.log(`[Step 2] Input error: ${e.message}, trying direct fill...`);
                    await inputLocator.fill(newName).catch(() => {});
                }

                await page.waitForTimeout(1000);

                // 點擊確認 (擴張選擇器範圍)
                let confirmed = false;
                const confirmBtn = page.locator('button[class*="confirmButton"], button:has-text("Confirm"), button:has-text("確認"), button:has-text("Save")').first();
                
                if (await confirmBtn.isVisible().catch(() => false) && await confirmBtn.isEnabled().catch(() => false)) {
                    await confirmBtn.click({ force: true });
                    confirmed = true;
                    console.log('[Step 2] Clicked Confirm button.');
                } else {
                    // 備案：Enter 鍵
                    await page.keyboard.press('Enter');
                    console.log('[Step 2] Pressed Enter as fallback.');
                    confirmed = true;
                }
                
                await page.waitForTimeout(3000);

                // 檢查是否出現「名稱已占用」或其他錯誤提示
                const errorMsg = await page.evaluate(() => {
                    const els = Array.from(document.querySelectorAll('div, span, p, .error, .message'));
                    return els.find(el => {
                        const txt = (el.innerText || '').toLowerCase();
                        return (txt.includes('already taken') || txt.includes('名稱已被使用') || txt.includes('different name') || txt.includes('error')) 
                               && el.offsetWidth > 0;
                    })?.innerText || null;
                });

                if (errorMsg) {
                    console.log(`[Step 2] ⚠️ Server message: "${errorMsg}". Generating new name...`);
                    newName = generateRandomNickname();
                    continue;
                }

                // 檢查輸入框是否消失 (代表成功關閉彈窗)
                const isStillThere = await inputLocator.isVisible().catch(() => false);
                if (!isStillThere) {
                    console.log(`[Step 2] ✅ Success! Nickname window closed.`);
                    break;
                }

                console.log(`[Step 2] Dialog still visible, retrying with Tab/Enter...`);
                await page.keyboard.press('Tab');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(1000);
            }
        } else {
            console.log('[Step 2] FAIL - Nickname input dialog not found.');
            const failPath = path.join(debugDir, `step2-fail-${Date.now()}.png`);
            await page.screenshot({ path: failPath });
        }

        let success = false;
        for (let j = 0; j < 8; j++) {
            ensureNotStopped();
            const content = await page.evaluate(() => document.body.innerText);
            if (content.includes(newName)) { success = true; break; }
            await page.waitForTimeout(1500);
        }
        console.log(`[Step 2] Result: ${success ? 'PASS' : 'FAIL'} ("${newName}")`);
        updateStepResult2('tcNicknameChange', { success, newName });

        await page.keyboard.press('Escape').catch(() => { });
        await smartClick(page, /Confirm|Cancel|Close|確認|關閉|CLOSE/i, 'Setting Close');

        // 4️⃣ Automated Streamer Card Click
        setCurrentStep2('manualInteraction');
        console.log('[Step 4] Attempting to automate streamer card click...');
        updateStepResult2('manualInteraction', { success: false, message: '正在自動尋找並點擊直播主卡片...' });

        // 確保大廳列表已加載
        await page.waitForSelector('div[data-cover="true"]', { timeout: 20000 }).catch(() => {
            console.log('[Step 4] Warning: data-cover selector not found, attempting fallback...');
        });

        const clickStreamerCard = async (targetPage) => {
            console.log('[Step 4] Starting aggressive streamer card click strategy...');
            for (let i = 0; i < 8; i++) { // 嘗試 8 次
                await targetPage.waitForTimeout(1000);
                try {
                    const clickedBox = await targetPage.evaluate(() => {
                        const keywords = ['viewers', 'LIVE', 'Sn\'S'];
                        const els = Array.from(document.querySelectorAll('div, span, p'));
                        
                        for (let el of els) {
                            const txt = el.innerText || '';
                            if (keywords.some(k => txt.includes(k))) {
                                let parent = el;
                                let depth = 0;
                                while(parent && depth < 5) {
                                    const rect = parent.getBoundingClientRect();
                                    if (rect.width > 120 && rect.height > 80 && rect.top > 0) {
                                        parent.click(); // JS 點擊
                                        return { x: rect.x + 50, y: rect.y + 50 };
                                    }
                                    parent = parent.parentElement;
                                    depth++;
                                }
                            }
                        }
                        
                        const imgs = Array.from(document.querySelectorAll('#streaming-list-container img, div[data-cover="true"] img'));
                        if (imgs.length > 0) {
                            imgs[0].click();
                            const rect = imgs[0].getBoundingClientRect();
                            return { x: rect.x + 20, y: rect.y + 20 };
                        }
                        return null;
                    });

                    if (clickedBox) {
                        console.log(`[Step 4] Found card. Firing JS click & Mouse click at x:${clickedBox.x}, y:${clickedBox.y}...`);
                        await targetPage.mouse.click(clickedBox.x, clickedBox.y);
                        return true;
                    }
                } catch (e) { }
            }
            return false;
        };

        const clickPromise = clickStreamerCard(page).then(success => {
            if (!success) throw new Error('畫面上找不到任何直播主卡片');
        });

        const [newPage] = await Promise.all([
            context.waitForEvent('page', { timeout: 30000 }),
            clickPromise
        ]).catch(async (err) => {
            console.log(`[Step 4] 自動點擊失敗 (${err.message})，等待手動點擊...`);
            updateStepResult2('manualInteraction', { success: false, waiting: true, message: '自動點擊失敗，請點擊直播主卡片' });
            return [await context.waitForEvent('page', { timeout: 90000 })];
        });

        ensureNotStopped();
        
        console.log('[Step 3] 偵測到新視窗開啟，正在等待初始化...');
        
        // 使用 Race 競爭機制，只要 Canvas 出現或等過 10 秒就繼續
        await Promise.race([
            newPage.waitForSelector('canvas', { state: 'attached', timeout: 30000 }),
            newPage.waitForSelector('iframe', { state: 'attached', timeout: 30000 }),
            newPage.waitForLoadState('load', { timeout: 15000 }),
            newPage.waitForTimeout(10000)
        ]).catch(() => {
            console.log('[Step 3] 等待超時，但將嘗試繼續執行...');
        });

        updateStepResult2('manualInteraction', { success: true });
        console.log('[Step 3] 直播間分頁已就緒，準備進入後續測試。');

        // 🚀 增加等待時間到 15 秒：確保 UI 彈窗、聊天室與資源完全就緒
        console.log('[系統] 正在等待直播間頁面完整載入 (15秒)...');
        await newPage.waitForTimeout(15000);
        ensureNotStopped();

        // 5️⃣ Handle "How to Play" Popup
        setCurrentStep2('howToPlayPopup');
        console.log('[Step 5] Handling How to Play popups...');
        await newPage.waitForTimeout(1000);

        // 【關鍵】先關閉直播間頁面的翻譯列
        await dismissTranslateBar(newPage).catch(() => { });
        await newPage.waitForTimeout(1000);

        const vp = newPage.viewportSize() || { width: 1280, height: 720 };
        const scanAndHandlePopups = async (targetPage) => {
            const frames = targetPage.frames();
            console.log(`[Step 5] 正在掃描 ${frames.length} 個 Frames 尋找彈窗...`);
            
            for (const frame of frames) {
                try {
                    const content = await frame.evaluate(() => document.body.innerText).catch(() => '');
                    const lowerContent = content.toLowerCase();
                    
                    if (lowerContent.includes('how to play') || lowerContent.includes('start') || lowerContent.includes('playing')) {
                        console.log(`[Step 5] 在 Frame 中偵測到 How to Play 關鍵字: ${frame.url().substring(0, 50)}`);
                        
                        // 1. 勾選 "Don't show this again"
                        await frame.evaluate(() => {
                            // 優先使用 ID 定位
                            const cb = document.querySelector('#dontShowAgain');
                            if (cb) {
                                if (!cb.checked) cb.click();
                                return;
                            }
                            
                            // 備案：文字搜尋
                            const labels = Array.from(document.querySelectorAll('label, div, span, p'));
                            const checkboxText = labels.find(el => {
                                const t = (el.innerText || '').toLowerCase();
                                return t.includes("don't show") || t.includes("不再顯示") || t.includes("不再提示");
                            });
                            
                            if (checkboxText) {
                                const cbAlt = checkboxText.querySelector('input[type="checkbox"]') || 
                                              checkboxText.parentElement.querySelector('input[type="checkbox"]') ||
                                              document.querySelector('input[type="checkbox"]');
                                if (cbAlt && !cbAlt.checked) cbAlt.click();
                            }
                        }).catch(() => {});
                        
                        await targetPage.waitForTimeout(1000);

                        // 2. 點擊 START PLAYING 按鈕
                        // 優先使用精確文字匹配
                        const clicked = await smartClick(frame, /^START PLAYING$/i, 'Start Button');
                        if (!clicked) {
                            // 備案：模糊匹配
                            await smartClick(frame, /START PLAYING|START|PLAY|開始|開始遊戲/i, 'Start Button (Fuzzy)');
                        }
                        
                        // 備案：座標點擊 (針對 Canvas 或特殊渲染)
                        const btnPos = await frame.evaluate(() => {
                            const btns = Array.from(document.querySelectorAll('button, div[role="button"], .startButton, .btn-start'));
                            const bigBtn = btns.find(b => {
                                const t = (b.innerText || '').toUpperCase();
                                return t.includes('PLAYING') && b.offsetWidth > 50;
                            });
                            if (bigBtn) { 
                                const r = bigBtn.getBoundingClientRect(); 
                                return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; 
                            }
                            return null;
                        }).catch(() => null);

                        if (btnPos) {
                            let finalX = btnPos.x, finalY = btnPos.y;
                            if (frame !== targetPage) {
                                const frameEl = await frame.frameElement().catch(() => null);
                                if (frameEl) {
                                    const box = await frameEl.boundingBox().catch(() => null);
                                    if (box) { finalX += box.x; finalY += box.y; }
                                }
                            }
                            await targetPage.mouse.click(finalX, finalY);
                            console.log(`[Step 5] 透過座標點擊按鈕: (${finalX}, ${finalY})`);
                            return true;
                        }
                        return clicked;
                    }
                } catch (e) {}
            }
            return false;
        };

        let popupSuccess = false;
        for (let i = 0; i < 10; i++) {
            ensureNotStopped();
            const handled = await scanAndHandlePopups(newPage);
            if (handled) { popupSuccess = true; break; }
            if (i > 4) {
                await newPage.mouse.click(vp.width / 2, vp.height * 0.8);
                await newPage.waitForTimeout(500);
            }
            const isCleared = await newPage.evaluate(() => !document.body.innerText.toLowerCase().includes('how to play')).catch(() => true);
            if (isCleared && i > 1) { popupSuccess = true; break; }
            await newPage.waitForTimeout(1500);
        }
        console.log(`[Step 5] How to play popup handling: ${popupSuccess ? 'SUCCESS' : 'SKIPPED/NOT_FOUND'}`);
        updateStepResult2('howToPlayPopup', { success: popupSuccess });

        // 6️⃣ Sound Control
        setCurrentStep2('soundControl');
        console.log('[Step 6] Testing Sound Control...');
        await newPage.evaluate(() => {
            const btn = document.querySelector('.sound-icon, .volume-icon, [class*="Sound"], [class*="Volume"]');
            if (btn) { btn.click(); setTimeout(() => btn.click(), 500); }
        });
        await newPage.waitForTimeout(1500);
        updateStepResult2('soundControl', { success: true });

        // 7️⃣ 基本資訊內容確認
        setCurrentStep2('basicInfoCheck');
        console.log('[Step 7] Testing Basic Information Confirmation...');
        
        // 🚀 再次清理翻譯列，避免遮擋右上角按鈕
        await dismissTranslateBar(newPage).catch(() => {});
        await newPage.waitForTimeout(1000);

        const viewportSize = newPage.viewportSize() || { width: 1280, height: 720 };

        try {
            // Step.1 點擊右上方的『？』UI icon
            const scanAndClickInfoBtn = async (targetPage) => {
                const frames = targetPage.frames();
                console.log(`[Step 7] 正在 ${frames.length} 個 Frames 中搜尋幫助按鈕 (精準模式)...`);
                for (const frame of frames) {
                    try {
                        const clicked = await frame.evaluate(() => {
                            const container = document.querySelector('div[data-control="true"], .hstack');
                            if (container) {
                                const svgs = Array.from(container.querySelectorAll('svg'));
                                if (svgs.length >= 2) {
                                    svgs[1].parentElement.click(); // '?' 通常在中間
                                    return true;
                                }
                            }
                            return false;
                        });
                        if (clicked) return true;
                    } catch (e) { }
                }
                return false;
            };

            let dialogOpened = false;
            await scanAndClickInfoBtn(newPage);
            
            // 檢查 body 是否出現 .modal-open (這是您提供的核心標記)
            console.log('[Step 7] 檢查 body 是否出現 .modal-open...');
            for (let i = 0; i < 5; i++) {
                dialogOpened = await newPage.evaluate(() => document.body.classList.contains('modal-open'));
                if (dialogOpened) break;
                await newPage.waitForTimeout(1000);
            }

            if (!dialogOpened) {
                console.log('[Step 7] 未偵測到 .modal-open，執行座標掃射...');
                const points = [
                    { x: viewportSize.width * 0.94, y: 35 }, 
                    { x: viewportSize.width * 0.97, y: 35 }, 
                    { x: viewportSize.width * 0.91, y: 35 }
                ];
                for (const p of points) {
                    await newPage.mouse.click(p.x, p.y, { clickCount: 2 });
                    await newPage.waitForTimeout(1500);
                    dialogOpened = await newPage.evaluate(() => document.body.classList.contains('modal-open'));
                    if (dialogOpened) break;
                }
            }

            if (!dialogOpened) {
                console.log('[Step 7] 嘗試最後等待 Introduction...');
                dialogOpened = await newPage.waitForSelector('text=Introduction', { state: 'visible', timeout: 5000 })
                    .then(() => true).catch(() => false);
            }

            if (!dialogOpened) {
                throw new Error('無法開啟基本資訊彈窗 (未偵測到 .modal-open 或 Introduction)');
            }

            ensureNotStopped();

            // Step.2 & 3: 動態掃描並依序點擊所有 Tab 項目
            console.log('[Step 7] 開始動態點擊所有說明標籤頁...');
            
            const tabResults = await newPage.evaluate(async () => {
                const tabs = Array.from(document.querySelectorAll('a[role="tab"]'));
                const results = [];
                for (const tab of tabs) {
                    const text = tab.innerText.trim();
                    tab.click();
                    results.push(text);
                    // 模擬閱讀等待
                    await new Promise(r => setTimeout(r, 2000));
                }
                return results;
            });

            console.log(`[Step 7] 成功遍歷 ${tabResults.length} 個項目: ${tabResults.join(', ')}`);
            clickSuccessCount = tabResults.length;

            // Step.4 點選右上方的『Ｘ』icon 關閉
            console.log('[Step 7] Closing Basic Info popup...');
            const closed = await newPage.evaluate(() => {
                const closeBtn = document.querySelector('svg[class*="closeBtn"], .modal-header button.close, .modal-content .close');
                if (closeBtn) {
                    // SVG 可能沒有 .click()，使用事件派發
                    ['mousedown', 'mouseup', 'click'].forEach(name => {
                        closeBtn.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true }));
                    });
                    // 同時點擊父元素作為備案
                    if (closeBtn.parentElement) closeBtn.parentElement.click();
                    return true;
                }
                return false;
            });

            if (!closed) {
                await smartClick(newPage, /X|CLOSE|關閉/i, 'Info Close Button');
            }
            await newPage.waitForTimeout(1000);

            updateStepResult2('basicInfoCheck', { 
                success: clickSuccessCount > 0, 
                message: `成功遍歷 ${clickSuccessCount} 個說明標籤頁` 
            });
        } catch (err) {
            console.error('[Step 7] Basic Info Check error:', err.message);
            updateStepResult2('basicInfoCheck', { success: false, error: err.message });
        }

        // =========================================================================
        // Step 8: Game History 點擊功能確認
        // =========================================================================
        try {
            setCurrentStep2('gameHistoryCheck');
            console.log('[Step 8] Testing Game History Confirmation...');
            ensureNotStopped();

            // Step.1 點擊右上方的『歷史紀錄』UI icon (通常在 ? 旁邊，時鐘圖示)
            const scanAndClickHistoryBtn = async (targetPage) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    try {
                        const clicked = await frame.evaluate(() => {
                            const container = document.querySelector('div[data-control="true"], .hstack');
                            if (container) {
                                const svgs = Array.from(container.querySelectorAll('svg'));
                                // 根據截圖，時鐘圖示通常在第三個 (0:Globe, 1:?, 2:Clock)
                                if (svgs.length >= 3) {
                                    svgs[2].parentElement.click();
                                    return true;
                                }
                            }
                            return false;
                        });
                        if (clicked) return true;
                    } catch (e) { }
                }
                return false;
            };

            await scanAndClickHistoryBtn(newPage);
            
            // 檢查 body 是否出現 .modal-open
            console.log('[Step 8] 檢查 body 是否出現 .modal-open...');
            let historyOpened = false;
            for (let i = 0; i < 5; i++) {
                historyOpened = await newPage.evaluate(() => document.body.classList.contains('modal-open'));
                if (historyOpened) break;
                await newPage.waitForTimeout(1000);
            }

            if (!historyOpened) {
                console.log('[Step 8] 未偵測到 .modal-open，嘗試座標點擊 (右上角偏右)...');
                await newPage.mouse.click(viewportSize.width * 0.97, 35, { clickCount: 2 });
                await newPage.waitForTimeout(2000);
                historyOpened = await newPage.evaluate(() => document.body.classList.contains('modal-open'));
            }

            if (!historyOpened) {
                throw new Error('無法開啟 Game History 彈窗');
            }

            // Step.2: 動態點擊所有紀錄標籤 (All Bet / My Bet / My Win)
            console.log('[Step 8] 開始動態點擊歷史紀錄標籤...');
            const historyTabResults = await newPage.evaluate(async () => {
                // 根據截圖，標籤是 a[role="button"] 且有 data-rr-ui-event-key
                const tabs = Array.from(document.querySelectorAll('a[role="button"][data-rr-ui-event-key]'));
                const results = [];
                for (const tab of tabs) {
                    const text = tab.innerText.trim();
                    tab.click();
                    results.push(text);
                    await new Promise(r => setTimeout(r, 2000));
                }
                return results;
            });

            console.log(`[Step 8] 成功遍歷 ${historyTabResults.length} 個標籤: ${historyTabResults.join(', ')}`);

            // Step.2.5: 點擊標題右方的「查看詳細紀錄」時鐘 icon
            console.log('[Step 8] 點擊「查看詳細紀錄」時鐘圖示...');
            const detailOpened = await newPage.evaluate(() => {
                // 使用您提供的精準參數 title="viewDetailedRecords"
                const detailBtn = document.querySelector('button[title="viewDetailedRecords"], button[aria-label*="詳細"]');
                if (detailBtn) {
                    detailBtn.click();
                    return true;
                }
                return false;
            });

            if (detailOpened) {
                console.log('[Step 8] 已點擊詳細紀錄圖示，等待新視窗反應...');
                await newPage.waitForTimeout(3000); 
            }

            // Step.3: 點擊右上方的『Ｘ』關閉
            console.log('[Step 8] Closing Game History popup...');
            await newPage.evaluate(() => {
                const closeBtn = document.querySelector('button.btn-close, svg[class*="closeBtn"], .modal-header button.close');
                if (closeBtn) {
                    ['mousedown', 'mouseup', 'click'].forEach(name => {
                        closeBtn.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true }));
                    });
                    if (closeBtn.parentElement && closeBtn.tagName === 'svg') closeBtn.parentElement.click();
                }
            });

            await newPage.waitForTimeout(1000);
            updateStepResult2('gameHistoryCheck', { 
                success: historyTabResults.length > 0, 
                message: `成功遍歷 ${historyTabResults.length} 個歷史紀錄標籤` 
            });

        } catch (err) {
            console.error('[Step 8] Game History Check error:', err.message);
            updateStepResult2('gameHistoryCheck', { success: false, error: err.message });
        }

        // =========================================================================
        // Step 9: 聊天室訊息輸入翻譯功能確認
        // =========================================================================
        try {
            setCurrentStep2('chatTranslationCheck');
            console.log('[Step 9] Testing Chat Translation Check...');
            ensureNotStopped();

            // Step.1 點擊右上方的『地球』UI icon (通常在第一個, data-control="true" 容器內)
            const scanAndClickGlobeBtn = async (targetPage) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    try {
                        const clicked = await frame.evaluate(() => {
                            const container = document.querySelector('div[data-control="true"], .hstack');
                            if (container) {
                                const svgs = Array.from(container.querySelectorAll('svg'));
                                if (svgs.length >= 1) {
                                    // 地球 icon 通常是第一個
                                    svgs[0].parentElement.click();
                                    return true;
                                }
                            }
                            return false;
                        });
                        if (clicked) return true;
                    } catch (e) { }
                }
                return false;
            };

            await scanAndClickGlobeBtn(newPage);
            
            // Step.2 勾選『日本語』
            console.log('[Step 9] 正在尋找並點擊『日本語』語系...');
            let langSelected = false;
            for (let i = 0; i < 5; i++) {
                langSelected = await newPage.evaluate(() => {
                    const items = Array.from(document.querySelectorAll('div[data-item="true"]'));
                    const target = items.find(el => el.innerText.includes('日本語'));
                    if (target) {
                        target.click();
                        return true;
                    }
                    return false;
                });
                if (langSelected) break;
                await newPage.waitForTimeout(1000);
            }

            if (!langSelected) {
                // 備案：使用 span[data-name="true"] 尋找
                langSelected = await smartClick(newPage, /日本語/i, 'Japanese Language Option');
            }

            if (!langSelected) {
                throw new Error('無法找到或點擊『日本語』語系選項');
            }

            // 等待語系列表自動關閉
            await newPage.waitForTimeout(1500);

            // Step.3 點選『訊息輸入框』並輸入文字
            console.log('[Step 9] 輸入測試訊息: Language test...');
            const chatInput = newPage.locator('#chat-message-input');
            if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                await chatInput.click();
                await chatInput.fill('Language test');
                await newPage.keyboard.press('Enter');
                // 🚀 追加等待時間，以便目視確認
                await newPage.waitForTimeout(3000);
            } else {
                throw new Error('找不到聊天室訊息輸入框 (#chat-message-input)');
            }

            // Step.4 驗證翻譯結果 (等待翻譯處理時間)
            console.log('[Step 9] 等待翻譯結果出現...');
            let translationSuccess = false;
            for (let i = 0; i < 10; i++) {
                const content = await newPage.evaluate(() => {
                    const messages = Array.from(document.querySelectorAll('p[data-original="true"], p[data-content="true"]'));
                    // 檢查是否有包含日文字元 (語学テスト 或其他日文)
                    return messages.some(p => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(p.innerText));
                });
                if (content) {
                    translationSuccess = true;
                    console.log('[Step 9] ✅ 偵測到日文翻譯內容！');
                    break;
                }
                await newPage.waitForTimeout(1500);
            }

            updateStepResult2('chatTranslationCheck', { 
                success: translationSuccess, 
                message: translationSuccess ? '成功確認翻譯功能' : '未偵測到翻譯後的日文訊息' 
            });

        } catch (err) {
            console.error('[Step 9] Chat Translation Check error:', err.message);
            updateStepResult2('chatTranslationCheck', { success: false, error: err.message });
        }

        // =========================================================================
        // Step 10: 印尼語訊息翻譯確認 (Bahasa Indonesia)
        // =========================================================================
        try {
            setCurrentStep2('chatTranslationCheckID');
            console.log('[Step 10] Testing Indonesian Translation Check...');
            ensureNotStopped();

            // Step.1 點擊地球 icon
            const scanAndClickGlobeBtn = async (targetPage) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    try {
                        const clicked = await frame.evaluate(() => {
                            const container = document.querySelector('div[data-control="true"], .hstack');
                            if (container) {
                                const svgs = Array.from(container.querySelectorAll('svg'));
                                if (svgs.length >= 1) {
                                    svgs[0].parentElement.click();
                                    return true;
                                }
                            }
                            return false;
                        });
                        if (clicked) return true;
                    } catch (e) { }
                }
                return false;
            };
            await scanAndClickGlobeBtn(newPage);
            
            // Step.2 勾選『Bahasa Indonesia』
            console.log('[Step 10] 正在點擊『Bahasa Indonesia』...');
            let langSelected = await newPage.evaluate(() => {
                const items = Array.from(document.querySelectorAll('div[data-item="true"]'));
                const target = items.find(el => el.innerText.includes('Bahasa Indonesia'));
                if (target) { target.click(); return true; }
                return false;
            });

            if (!langSelected) {
                langSelected = await smartClick(newPage, /Bahasa Indonesia/i, 'Indonesian Language Option');
            }

            if (!langSelected) throw new Error('無法找到印尼語選項');
            await newPage.waitForTimeout(1500);

            // Step.3 輸入訊息
            const chatInput = newPage.locator('#chat-message-input');
            await chatInput.click();
            await chatInput.fill('Language test');
            await newPage.keyboard.press('Enter');
            await newPage.waitForTimeout(3000); // 目視確認

            // Step.4 驗證
            console.log('[Step 10] 等待印尼語翻譯...');
            let translationSuccess = false;
            for (let i = 0; i < 10; i++) {
                const content = await newPage.evaluate(() => {
                    const messages = Array.from(document.querySelectorAll('p[data-original="true"]'));
                    // 印尼語使用拉丁字母，檢查是否有內容且非原文字串
                    return messages.some(p => p.innerText.length > 0 && p.innerText.toLowerCase() !== 'language test');
                });
                if (content) { translationSuccess = true; break; }
                await newPage.waitForTimeout(1500);
            }

            updateStepResult2('chatTranslationCheckID', { 
                success: translationSuccess, 
                message: translationSuccess ? '成功確認印尼語翻譯' : '未偵測到翻譯內容' 
            });
        } catch (err) {
            console.error('[Step 10] Indonesian error:', err.message);
            updateStepResult2('chatTranslationCheckID', { success: false, error: err.message });
        }

        // =========================================================================
        // Step 11: 泰語訊息翻譯確認 (ภาษาไทย)
        // =========================================================================
        try {
            setCurrentStep2('chatTranslationCheckTH');
            console.log('[Step 11] Testing Thai Translation Check...');
            ensureNotStopped();

            // Step.1 點擊地球 icon
            const scanAndClickGlobeBtn = async (targetPage) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    try {
                        const clicked = await frame.evaluate(() => {
                            const container = document.querySelector('div[data-control="true"], .hstack');
                            if (container) {
                                const svgs = Array.from(container.querySelectorAll('svg'));
                                if (svgs.length >= 1) {
                                    svgs[0].parentElement.click();
                                    return true;
                                }
                            }
                            return false;
                        });
                        if (clicked) return true;
                    } catch (e) { }
                }
                return false;
            };
            await scanAndClickGlobeBtn(newPage);
            
            // Step.2 勾選『ภาษาไทย』
            console.log('[Step 11] 正在點擊『ภาษาไทย』...');
            let langSelected = await newPage.evaluate(() => {
                const items = Array.from(document.querySelectorAll('div[data-item="true"]'));
                const target = items.find(el => el.innerText.includes('ภาษาไทย') || el.innerText.includes('Thai'));
                if (target) { target.click(); return true; }
                return false;
            });

            if (!langSelected) {
                langSelected = await smartClick(newPage, /ภาษาไทย|Thai/i, 'Thai Language Option');
            }

            if (!langSelected) throw new Error('無法找到泰語選項');
            await newPage.waitForTimeout(1500);

            // Step.3 輸入訊息
            const chatInput = newPage.locator('#chat-message-input');
            await chatInput.click();
            await chatInput.fill('Language test');
            await newPage.keyboard.press('Enter');
            await newPage.waitForTimeout(3000); // 目視確認

            // Step.4 驗證
            console.log('[Step 11] 等待泰語翻譯...');
            let translationSuccess = false;
            for (let i = 0; i < 10; i++) {
                const content = await newPage.evaluate(() => {
                    const messages = Array.from(document.querySelectorAll('p[data-original="true"]'));
                    // 檢查是否包含泰文字元 (U+0E00 到 U+0E7F)
                    return messages.some(p => /[\u0e00-\u0e7f]/.test(p.innerText));
                });
                if (content) { translationSuccess = true; break; }
                await newPage.waitForTimeout(1500);
            }

            updateStepResult2('chatTranslationCheckTH', { 
                success: translationSuccess, 
                message: translationSuccess ? '成功確認泰語翻譯' : '未偵測到泰語翻譯' 
            });
        } catch (err) {
            console.error('[Step 11] Thai error:', err.message);
            updateStepResult2('chatTranslationCheckTH', { success: false, error: err.message });
        }
        
        // =========================================================================
        // Step 12: Bet value 選取功能確認 (優化版)
        // =========================================================================
        try {
            setCurrentStep2('betValueCheck');
            console.log('[Step 12] Testing Bet Value Selection Check (Refined)...');
            ensureNotStopped();

            const betControlSelector = 'div[data-bet-value-control="true"]';
            const betDisplaySelector = 'div[data-text="true"]';

            const findBetButton = async (targetPage, textOrIndex) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    let btn;
                    if (typeof textOrIndex === 'string') {
                        btn = frame.locator(`${betControlSelector} button:has-text("${textOrIndex}")`).first();
                    } else {
                        btn = frame.locator(`${betControlSelector} button`).nth(textOrIndex);
                    }
                    if (await btn.isVisible().catch(() => false)) return btn;
                }
                return null;
            };

            const getBetValue = async (targetPage) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    const display = frame.locator(betDisplaySelector).first();
                    if (await display.isVisible().catch(() => false)) {
                        const val = await display.evaluate(el => {
                            const spans = el.querySelectorAll('span');
                            return spans.length >= 2 ? spans[1].innerText.replace(/,/g, '') : null;
                        });
                        if (val) return parseInt(val);
                    }
                }
                return null;
            };

            const isBtnDisabled = async (btn) => {
                if (!btn) return false;
                return await btn.isDisabled().catch(() => false) || 
                       await btn.evaluate(el => el.hasAttribute('disabled') || el.classList.contains('disabled'));
            };

            // 1. 先前往起點 MIN
            console.log('[Step 12] Moving to MIN...');
            const minBtn = await findBetButton(newPage, 'MIN');
            if (!minBtn) throw new Error('找不到 MIN 按鈕');
            await minBtn.click({ force: true });
            await newPage.waitForTimeout(2000);
            
            let currentVal = await getBetValue(newPage);
            console.log(`[Step 12] Start Value (MIN): ${currentVal}`);
            if (currentVal !== 200) throw new Error(`起點數值不符 (預期 200): ${currentVal}`);

            // 2. 向上遞增至 MAX
            console.log('[Step 12] Phase 1: Climbing up to MAX...');
            const plusBtn = await findBetButton(newPage, 2); // 第 3 個按鈕是 Plus
            const maxBtn = await findBetButton(newPage, 'MAX');
            if (!plusBtn || !maxBtn) throw new Error('找不到 Plus 或 MAX 按鈕');

            for (let i = 1; i <= 35; i++) {
                ensureNotStopped();
                await plusBtn.click({ force: true });
                await newPage.waitForTimeout(1000);
                let newVal = await getBetValue(newPage);
                console.log(`[Step 12] [Up] Plus x${i}: ${currentVal} -> ${newVal}`);
                if (newVal <= currentVal && newVal !== 3000000) {
                    throw new Error(`第 ${i} 次點擊 Plus 數值未遞增: ${newVal}`);
                }
                currentVal = newVal;
                if (currentVal === 3000000) break;
            }

            // 確認 MAX 邊界狀態
            const plusDisabled = await isBtnDisabled(plusBtn);
            const maxDisabled = await isBtnDisabled(maxBtn);
            if (currentVal !== 3000000 || !plusDisabled || !maxDisabled) {
                throw new Error(`MAX 邊界校驗失敗: Val=${currentVal}, PlusDisabled=${plusDisabled}, MaxDisabled=${maxDisabled}`);
            }
            console.log('[Step 12] MAX Boundary OK. Starting reverse sweep...');
            await newPage.waitForTimeout(2000);

            // 3. 向下遞減回 MIN
            console.log('[Step 12] Phase 2: Descending back to MIN...');
            const minusBtn = await findBetButton(newPage, 1); // 第 2 個按鈕是 Minus
            if (!minusBtn) throw new Error('找不到 Minus 按鈕');

            for (let i = 1; i <= 35; i++) {
                ensureNotStopped();
                await minusBtn.click({ force: true });
                await newPage.waitForTimeout(1000);
                let newVal = await getBetValue(newPage);
                console.log(`[Step 12] [Down] Minus x${i}: ${currentVal} -> ${newVal}`);
                if (newVal >= currentVal && newVal !== 200) {
                    throw new Error(`第 ${i} 次點擊 Minus 數值未遞減: ${newVal}`);
                }
                currentVal = newVal;
                if (currentVal === 200) break;
            }

            // 確認 MIN 邊界狀態
            const minusDisabled = await isBtnDisabled(minusBtn);
            const minDisabledFinal = await isBtnDisabled(minBtn);
            const success = currentVal === 200 && minusDisabled && minDisabledFinal;

            updateStepResult2('betValueCheck', { 
                success, 
                message: success ? 'Bet value 雙向遞增遞減與邊界禁用功能確認成功' : 
                                   `Fail: Val=${currentVal}, MinusDisabled=${minusDisabled}, MinDisabled=${minDisabledFinal}`
            });

        } catch (err) {
            console.error('[Step 12] Bet Value Check error:', err.message);
            updateStepResult2('betValueCheck', { success: false, error: err.message });
        }

        // =========================================================================
        // Step 13: Spin Round time 選取功能確認
        // =========================================================================
        try {
            setCurrentStep2('spinRoundCheck');
            console.log('[Step 13] Testing Spin Round Time Selection...');
            ensureNotStopped();

            const spinControlSelector = 'div[class*="_container_"]'; // Spin Round 控制區

            // 從 Spin Round 數值顯示框出發，定位相鄰的 +/- 按鈕
            const findSpinControls = async (targetPage) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    // Spin Round 顯示區為第 2 個 data-text="true"
                    const displays = await frame.locator('div[data-text="true"]').all();
                    if (displays.length < 2) continue;

                    const spinDisplay = displays[1];
                    if (!await spinDisplay.isVisible().catch(() => false)) continue;

                    // 取得父層容器，再找相鄰的 button 按鈕
                    const container = spinDisplay.locator('xpath=..');
                    const btns = await container.locator('button').all();
                    if (btns.length < 2) {
                        // 嘗試往上一層
                        const parentContainer = spinDisplay.locator('xpath=../..'); 
                        const parentBtns = await parentContainer.locator('button').all();
                        if (parentBtns.length >= 2) {
                            // 第一個 button 是 Minus，最後一個是 Plus
                            return { minusBtn: parentBtns[0], plusBtn: parentBtns[parentBtns.length - 1], frame };
                        }
                        continue;
                    }
                    // 第一個 button 是 Minus，最後一個是 Plus
                    return { minusBtn: btns[0], plusBtn: btns[btns.length - 1], frame };
                }
                return null;
            };

            const getSpinValue = async (targetPage) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    const displays = await frame.locator('div[data-text="true"]').all();
                    if (displays.length >= 2) {
                        const val = await displays[1].evaluate(el => {
                            const spans = el.querySelectorAll('span');
                            return spans.length >= 2 ? spans[1].innerText.replace(/,/g, '') : null;
                        }).catch(() => null);
                        if (val && !isNaN(parseInt(val))) return parseInt(val);
                    }
                }
                return null;
            };

            const isSpinBtnDisabled = async (btn) => {
                if (!btn) return false;
                return await btn.isDisabled().catch(() => false) ||
                       await btn.evaluate(el => el.hasAttribute('disabled') || el.classList.contains('disabled'));
            };

            // Step 13-1: 連續點擊 Plus (+) 至最大値
            console.log('[Step 13] Phase 1: Clicking Plus until MAX (1000)...');
            const spinControls = await findSpinControls(newPage);
            if (!spinControls) throw new Error('找不到 Spin Round 控制按鈕');

            const { minusBtn: spinMinusBtn, plusBtn: spinPlusBtn } = spinControls;

            let spinVal = await getSpinValue(newPage);
            console.log(`[Step 13] Initial Spin Round value: ${spinVal}`);

            for (let i = 1; i <= 10; i++) {
                ensureNotStopped();
                await spinPlusBtn.click({ force: true });
                await newPage.waitForTimeout(1000);
                let newSpinVal = await getSpinValue(newPage);
                console.log(`[Step 13] [+] x${i}: ${spinVal} -> ${newSpinVal}`);
                if (newSpinVal <= spinVal && newSpinVal !== 1000) {
                    throw new Error(`點擊 Plus 數値未遞增: ${newSpinVal}`);
                }
                spinVal = newSpinVal;
                if (spinVal === 1000) break;
            }

            const spinPlusDisabled = await isSpinBtnDisabled(spinPlusBtn);
            if (spinVal !== 1000 || !spinPlusDisabled) {
                throw new Error(`MAX 邊界校驗失敗: Val=${spinVal}, PlusDisabled=${spinPlusDisabled}`);
            }
            console.log('[Step 13] MAX (1000) reached. Plus is disabled. Waiting 2s...');
            await newPage.waitForTimeout(2000);

            // Step 13-2: 連續點擊 Minus (-) 至最小値
            console.log('[Step 13] Phase 2: Clicking Minus until MIN (20)...');

            for (let i = 1; i <= 10; i++) {
                ensureNotStopped();
                await spinMinusBtn.click({ force: true });
                await newPage.waitForTimeout(1000);
                let newSpinVal = await getSpinValue(newPage);
                console.log(`[Step 13] [-] x${i}: ${spinVal} -> ${newSpinVal}`);
                if (newSpinVal >= spinVal && newSpinVal !== 20) {
                    throw new Error(`點擊 Minus 數値未遞減: ${newSpinVal}`);
                }
                spinVal = newSpinVal;
                if (spinVal === 20) break;
            }

            const spinMinusDisabled = await isSpinBtnDisabled(spinMinusBtn);
            const spinSuccess = spinVal === 20 && spinMinusDisabled;
            if (spinSuccess) {
                console.log('[Step 13] MIN (20) reached. Minus is disabled. Waiting 2s...');
            }
            await newPage.waitForTimeout(2000);

            updateStepResult2('spinRoundCheck', {
                success: spinSuccess,
                message: spinSuccess ? 'Spin Round time 選取功能確認成功' :
                                       `Fail: Val=${spinVal}, MinusDisabled=${spinMinusDisabled}`
            });

        } catch (err) {
            console.error('[Step 13] Spin Round Check error:', err.message);
            updateStepResult2('spinRoundCheck', { success: false, error: err.message });
        }

        // =========================================================================
        // Step 14: Play button with Spin Round 整合功能確認
        // =========================================================================
        try {
            setCurrentStep2('playBtnSpinCheck');
            console.log('[Step 14] Testing Play Button + Spin Round Integration...');
            ensureNotStopped();

            // 定位 Play button (data-is-playing 屬性)
            const findPlayBtn14 = async (targetPage) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    const btn = frame.locator('button[data-is-playing]').first();
                    if (await btn.isVisible().catch(() => false)) return { btn, frame };
                }
                return null;
            };

            // 讀取 Play button 啟動後顯示的倒數數字
            // 點擊 Play 後，數字顯示於 button[data-is-playing="true"] 的內部或緊鄰容器
            const getPlayBtnCount14 = async (targetPage) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    // 方法1: 直接從 button[data-is-playing="true"] 的所有子元素文字讀取
                    const playingBtn = frame.locator('button[data-is-playing="true"]').first();
                    if (await playingBtn.isVisible().catch(() => false)) {
                        const text = await playingBtn.evaluate(el => {
                            // 遞迴取得所有文字節點
                            const getAllText = (node) => {
                                let text = '';
                                for (const child of node.childNodes) {
                                    if (child.nodeType === 3) text += child.textContent;
                                    else text += getAllText(child);
                                }
                                return text.trim();
                            };
                            return getAllText(el);
                        }).catch(() => null);
                        if (text && !isNaN(parseInt(text))) {
                            return parseInt(text.replace(/,/g, ''));
                        }
                    }

                    // 方法2: 尋找 "Waiting for Next Round" 狀態下的綠色數字圓圈元素
                    // data-is-playing 按鈕的父層容器中尋找顯示數字的 div
                    const allBtns = await frame.locator('button[data-is-playing]').all();
                    for (const btn of allBtns) {
                        if (!await btn.isVisible().catch(() => false)) continue;
                        const parent = btn.locator('xpath=..');
                        const numText = await parent.evaluate(el => {
                            const divs = Array.from(el.querySelectorAll('div, span'));
                            for (const d of divs) {
                                const t = d.innerText?.trim().replace(/,/g, '');
                                if (t && !isNaN(parseInt(t)) && parseInt(t) >= 20) return t;
                            }
                            return null;
                        }).catch(() => null);
                        if (numText) return parseInt(numText);
                    }
                }
                return null;
            };

            // 定位 Spin Round Plus/Minus 按鈕
            const findStep14SpinControls = async (targetPage) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    const displays = await frame.locator('div[data-text="true"]').all();
                    if (displays.length < 2) continue;
                    const spinDisplay = displays[1];
                    if (!await spinDisplay.isVisible().catch(() => false)) continue;
                    const parentContainer = spinDisplay.locator('xpath=../..'); 
                    const parentBtns = await parentContainer.locator('button').all();
                    if (parentBtns.length >= 2) {
                        return { minusBtn: parentBtns[0], plusBtn: parentBtns[parentBtns.length - 1] };
                    }
                    const container = spinDisplay.locator('xpath=..');
                    const btns = await container.locator('button').all();
                    if (btns.length >= 2) {
                        return { minusBtn: btns[0], plusBtn: btns[btns.length - 1] };
                    }
                }
                return null;
            };

            // 讀取目前 Spin Round 値
            const getStep14SpinValue = async (targetPage) => {
                const frames = targetPage.frames();
                for (const frame of frames) {
                    const displays = await frame.locator('div[data-text="true"]').all();
                    if (displays.length >= 2) {
                        const val = await displays[1].evaluate(el => {
                            const spans = el.querySelectorAll('span');
                            return spans.length >= 2 ? spans[1].innerText.replace(/,/g, '') : null;
                        }).catch(() => null);
                        if (val && !isNaN(parseInt(val))) return parseInt(val);
                    }
                }
                return null;
            };

            // 等待遊戲回到待機狀態 (Play button 變回 data-is-playing="false")
            const waitForPlayIdle = async (targetPage, timeoutMs = 15000) => {
                const deadline = Date.now() + timeoutMs;
                while (Date.now() < deadline) {
                    const frames = targetPage.frames();
                    for (const frame of frames) {
                        const btn = frame.locator('button[data-is-playing="false"]').first();
                        if (await btn.isVisible().catch(() => false)) return true;
                    }
                    await targetPage.waitForTimeout(500);
                }
                return false;
            };

            // 等待 Spin Round UI 恢復可見並讀取值 (有 timeout)
            const waitAndGetSpinValue = async (targetPage, timeoutMs = 8000) => {
                const deadline = Date.now() + timeoutMs;
                while (Date.now() < deadline) {
                    const val = await getStep14SpinValue(targetPage);
                    if (val !== null) return val;
                    await targetPage.waitForTimeout(500);
                }
                return null;
            };

            // 將 Spin Round 調整至目標值 (循環點擊 + 直到達標)
            const adjustSpinTo = async (targetPage, targetVal) => {
                for (let attempt = 0; attempt < 15; attempt++) {
                    const curVal = await waitAndGetSpinValue(targetPage, 5000);
                    if (curVal === null) {
                        console.log(`[Step 14] Spin value still null, retrying...`);
                        await targetPage.waitForTimeout(1000);
                        continue;
                    }
                    if (curVal === targetVal) return true;

                    const controls = await findStep14SpinControls(targetPage);
                    if (!controls) { await targetPage.waitForTimeout(500); continue; }

                    if (curVal < targetVal) {
                        await controls.plusBtn.click({ force: true });
                    } else {
                        await controls.minusBtn.click({ force: true });
                    }
                    await targetPage.waitForTimeout(600);
                }
                return false;
            };

            // 先將 Spin Round 重置回 MIN (20)
            console.log('[Step 14] Resetting Spin Round to MIN (20)...');
            await adjustSpinTo(newPage, 20);

            const spinRoundTestCases = [20, 50, 100, 200, 500, 1000];
            let allPassed = true;
            const results = [];

            for (const targetSpin of spinRoundTestCases) {
                ensureNotStopped();

                // Step A: 調整 Spin Round 至目標值（循環點擊直到達標）
                console.log(`[Step 14] Adjusting Spin Round to ${targetSpin}...`);
                const adjusted = await adjustSpinTo(newPage, targetSpin);
                if (!adjusted) {
                    console.log(`[Step 14] ⚠️ Could not reach target spin ${targetSpin}, recording failure.`);
                    results.push({ targetSpin, displayedCount: null, match: false });
                    allPassed = false;
                    continue;
                }

                const confirmedSpin = await getStep14SpinValue(newPage);
                console.log(`[Step 14] Confirmed Spin Round = ${confirmedSpin}, Target = ${targetSpin}`);

                // Step B: 點擊 Play button，進入 "Waiting for Next Round" 狀態
                const playControl = await findPlayBtn14(newPage);
                if (!playControl) throw new Error('找不到 Play button');
                await playControl.btn.click({ force: true });
                console.log(`[Step 14] Play clicked, waiting 1.5s for display...`);
                await newPage.waitForTimeout(1500);

                // Step C: 讀取 Play button 顯示的倒數數字 (在 "Waiting for Next Round" 狀態下)
                const displayedCount = await getPlayBtnCount14(newPage);
                const match = displayedCount === targetSpin;
                console.log(`[Step 14] Spin Round=${targetSpin}, Play shows=${displayedCount}, Match=${match}`);
                results.push({ targetSpin, displayedCount, match });
                if (!match) allPassed = false;

                // Step D: 再次點擊 Play button 取消 "Waiting for Next Round" 狀態
                // (遊戲中再次點擊綠色圓圈按鈕可取消排隊等待)
                console.log(`[Step 14] Cancelling play session by clicking Play button again...`);
                const cancelControl = await findPlayBtn14(newPage);
                if (cancelControl) {
                    await cancelControl.btn.click({ force: true });
                    console.log(`[Step 14] Play cancelled. Waiting for Spin Round controls to reappear...`);
                } else {
                    console.log(`[Step 14] Could not find play button to cancel, waiting anyway...`);
                }
                await newPage.waitForTimeout(1500);

                // Step E: 等待 Spin Round 控制恢復可見（最多 10 秒）
                const restoredVal = await waitAndGetSpinValue(newPage, 10000);
                console.log(`[Step 14] Spin Round restored to: ${restoredVal}`);

                // Step F: 若 targetSpin !== 1000，重置回 20 準備下一輪
                if (targetSpin !== 1000) {
                    console.log(`[Step 14] Resetting Spin Round to 20 for next iteration...`);
                    await adjustSpinTo(newPage, 20);
                }
            }

            const resultMsg = results.map(r => `SR=${r.targetSpin}/PB=${r.displayedCount}(${r.match?'✓':'✗'})`).join(', ');
            updateStepResult2('playBtnSpinCheck', {
                success: allPassed,
                message: allPassed ? `Play button 整合測試全數通過: ${resultMsg}` :
                                     `部分失敗: ${resultMsg}`
            });

        } catch (err) {
            console.error('[Step 14] Play Button Spin Check error:', err.message);
            updateStepResult2('playBtnSpinCheck', { success: false, error: err.message });
        }

        // ⏳ 第 14 步冷卻 3 秒
        console.log('[Step 14] 完成，等待 3 秒...');
        await newPage.waitForTimeout(3000);

        // ==================== [STEP 15] Play button plus Spin Round 整合功能確認 ====================
        setCurrentStep2('playPlusSpinRound');
        updateStepResult2('playPlusSpinRound', { success: false, pending: true, message: '正在執行第 15 步...' });
        try {
            console.log('[Step 15] 開始執行 Play button plus Spin Round 整合功能確認...');

            // Step 15.1: 重新載入網頁
            console.log('[Step 15.1] 重新載入網頁 (Refresh)...');
            await newPage.reload({ waitUntil: 'domcontentloaded' });
            await newPage.waitForTimeout(3000);

            // Step 15.2 & 15.3: 處理「How to Play」彈窗，按下 X 關閉
            console.log('[Step 15.2] 等待 How to Play 彈窗出現...');
            try {
                // 等待 How to Play 彈窗出現 (最多 8 秒)
                await newPage.waitForSelector('.modal-header, svg[class*="closeBtn"]', { timeout: 8000 });
                console.log('[Step 15.3] 找到 How to Play 彈窗，點擊 X 關閉...');
                const closeBtn = newPage.locator('svg[class*="closeBtn"], path[class*="closeBtn"], button[class*="closeBtn"], .modal-header button').first();
                if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await closeBtn.click({ force: true });
                    console.log('[Step 15.3] 已點擊 X 按鈕，等待彈窗關閉...');
                    await newPage.waitForTimeout(1000);
                } else {
                    // 備案：按下 ESC 關閉
                    await newPage.keyboard.press('Escape');
                    console.log('[Step 15.3] 備案：已按下 ESC 關閉彈窗');
                    await newPage.waitForTimeout(1000);
                }
            } catch (e) {
                console.log('[Step 15.2] How to Play 彈窗未出現，跳過關閉步驟');
            }

            // Step 15.4: 點擊中央下方的「PLAY」按鈕
            console.log('[Step 15.4] 點擊 PLAY 按鈕...');
            const playBtn = newPage.locator('button[data-is-playing], button[class*="_container_qible"]').first();
            if (await playBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                await playBtn.click({ force: true });
                console.log('[Step 15.4] 已點擊 PLAY 按鈕，等待 Add Round 列表出現...');
                await newPage.waitForTimeout(2000);
            } else {
                throw new Error('找不到 PLAY 按鈕');
            }

            // 讀取點擊 PLAY 後的初始數值
            const getSpinCount = async () => {
                return await newPage.evaluate(() => {
                    const btn = document.querySelector('button[data-is-playing="true"], button[class*="_container_qible"]');
                    if (!btn) return null;
                    const txt = btn.innerText || btn.textContent || '';
                    const num = parseInt(txt.trim());
                    return isNaN(num) ? null : num;
                });
            };

            const initialCount = await getSpinCount();
            console.log(`[Step 15.4] 點擊 PLAY 後初始數值: ${initialCount}`);

            // Step 15.5: 依序點擊 +10, +20, +50, +100, +200（每次間隔 1 秒）
            const addRoundValues = ['+10', '+20', '+50', '+100', '+200'];
            const stepResults15 = [];
            let currentCount = initialCount;
            const expectedAdditions = [10, 20, 50, 100, 200];

            for (let i = 0; i < addRoundValues.length; i++) {
                const btnText = addRoundValues[i];
                const expectedAdd = expectedAdditions[i];
                const expectedNext = currentCount !== null ? currentCount + expectedAdd : null;

                console.log(`[Step 15.5] 點擊 ${btnText} 按鈕 (預期: ${currentCount} + ${expectedAdd} = ${expectedNext})...`);

                // 定位 Add Round 按鈕
                const addBtn = newPage.locator(`div[data-type="BUTTONS"] button:has-text("${btnText}"), div[class*="_buttonsContainer"] button:has-text("${btnText}")`).first();
                if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await addBtn.click({ force: true });
                } else {
                    // 備案：文字完全匹配
                    await newPage.locator(`button:has-text("${btnText}")`).first().click({ force: true }).catch(() => {});
                }

                await newPage.waitForTimeout(1000); // Step 15.5 規定每次間隔 1 秒

                // Step 15.6: 驗證中央綠色方框數字是否增加
                const afterCount = await getSpinCount();
                const matched = expectedNext !== null && afterCount === expectedNext;
                console.log(`[Step 15.6] 點擊 ${btnText} 後: 顯示=${afterCount}, 預期=${expectedNext}, 驗證=${matched ? '✓' : '✗'}`);
                stepResults15.push({ btn: btnText, before: currentCount, after: afterCount, expected: expectedNext, matched });
                currentCount = afterCount;
            }

            const allMatched = stepResults15.every(r => r.matched);
            const resultSummary = stepResults15.map(r => `${r.btn}:${r.before}→${r.after}(${r.matched ? '✓' : '✗'})`).join(', ');
            console.log(`[Step 15] 結果: ${allMatched ? '全部通過' : '部分失敗'} - ${resultSummary}`);

            updateStepResult2('playPlusSpinRound', {
                success: allMatched,
                message: allMatched
                    ? `Play + Spin Round 整合測試全數通過: ${resultSummary}`
                    : `部分驗證失敗: ${resultSummary}`
            });

        } catch (err) {
            console.error('[Step 15] Play Plus Spin Round error:', err.message);
            updateStepResult2('playPlusSpinRound', { success: false, error: err.message });
        }

        console.log('[Diagnostic] TEST COMPLETED.');
        return { success: true, stopped: false, stepResults: stepResults2 };
    } catch (error) {
        if (stopRequested && isStopError(error)) {
            console.log('[Diagnostic] TEST STOPPED BY USER.');
            return { success: false, stopped: true, message: '測試已停止', stepResults: stepResults2 };
        }
        throw error;
    } finally {
        setCurrentStep2(null);
        if (!stopRequested) {
            console.log('💡 測試完成，瀏覽器將在 3 秒後自動關閉...');
            await new Promise(r => setTimeout(r, 3000));
            if (activeBrowser) await activeBrowser.close().catch(() => { });
        }
        activeBrowser = null;
        isRunning = false;
        stopRequested = false;
    }
}

module.exports = { checkWebsite2, getProgress2, setCurrentStep2, stopNicknameTest };
