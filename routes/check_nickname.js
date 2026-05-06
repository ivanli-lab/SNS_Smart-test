const { chromium } = require('playwright');
const { askToContinue } = require('../utils/interaction');
const fs = require('fs');
const path = require('path');

const debugDir = path.join(__dirname, '..', 'debug');
if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

let currentStep2 = null;
const stepResults2 = {};
const totalSteps2 = 7;
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
        for (let i = 0; i < 5; i++) {
            ensureNotStopped();
            const ok = await smartClick(page, /Confirm|確認|OK/i, 'Nickname OK');
            if (ok) {
                nicknameConfirmed = true;
                break;
            }
            // 檢查是否其實已經進入 Lobby 了 (如果已經看得到餘額或頭像)
            const alreadyInLobby = await page.evaluate(() => {
                const text = document.body.innerText;
                return text.includes('Balance') || text.includes('Streaming Now');
            });
            if (alreadyInLobby) {
                console.log('[Step 2] Nickname dialog not found, but already in Lobby. Skipping...');
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

        // 點擊大頭貼前再次確保翻譯泡泡消失
        await dismissTranslateBar(page);
        await page.waitForTimeout(1000);
        ensureNotStopped();

        const viewport = page.viewportSize() || { width: 1280, height: 720 };

        // 🚀 嘗試多次開啟暱稱視窗，並使用多點打擊
        let dialogOpened = false;
        const nicknameSelector = 'input[type="text"], input[placeholder*="nickname" i], input[placeholder*="暱稱" i]';
        let inputLocator = null;

        for (let attempt = 0; attempt < 5; attempt++) {
            ensureNotStopped();
            console.log(`[Step 2] Attempting to open profile settings (Try ${attempt + 1})...`);
            
            await dismissTranslateBar(page).catch(() => {});
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(1000);

            // 方法 A: 嘗試搜尋「暱稱文字」並點擊 (這是最準確的)
            let iconFound = false;
            const currentName = await page.evaluate(() => {
                // 尋找看起來像暱稱的文字（通常在 Balance 旁邊）
                const bodyText = document.body.innerText;
                const match = bodyText.match(/([a-zA-Z0-9]{4,})\s+Balance/);
                return match ? match[1] : null;
            });

            const frames = page.frames();
            for (const frame of frames) {
                // 如果有抓到當前名稱，優先點擊該文字
                if (currentName) {
                    const nameLoc = frame.locator(`text="${currentName}"`).first();
                    if (await nameLoc.isVisible().catch(() => false)) {
                        await nameLoc.click({ force: true });
                        iconFound = true;
                        console.log(`[Step 2] Success: Clicked nickname text "${currentName}"`);
                        break;
                    }
                }

                // 方法 B: 智慧掃描所有框架中的右上角頭像元素
                const found = await frame.evaluate((width) => {
                    const els = Array.from(document.querySelectorAll('div, span, img, a, button, i'));
                    const target = els.find(el => {
                        const r = el.getBoundingClientRect();
                        const style = window.getComputedStyle(el);
                        // 擴大偵測範圍：右上角寬度 45% 的區域
                        const isTopRight = r.top < 120 && r.left > width * 0.55; 
                        const isVisible = r.width > 0 && r.height > 0 && style.display !== 'none';
                        // 包含頭像關鍵字或是很短的文字 (可能是暱稱)
                        const className = (el.className || '').toLowerCase();
                        const hasPotential = style.backgroundImage !== 'none' || el.tagName === 'IMG' || className.includes('avatar') || className.includes('user') || el.innerText.length < 15;
                        return isTopRight && isVisible && hasPotential;
                    });
                    if (target) { target.click(); return true; }
                    return false;
                }, viewport.width).catch(() => false);
                if (found) { iconFound = true; break; }
            }

            if (iconFound) {
                console.log('[Step 2] Profile icon clicked.');
                await page.waitForTimeout(1500);
            } else {
                // 方法 C: 區域座標地毯式點擊 (針對畫布版)
                console.log('[Step 2] Profile icon not found, using coordinate grid click...');
                const points = [
                    {x: viewport.width - 50, y: 35},
                    {x: viewport.width - 100, y: 35},
                    {x: viewport.width - 150, y: 35},
                    {x: viewport.width - 200, y: 35}
                ];
                for (const p of points) {
                    await page.mouse.click(p.x, p.y);
                    await page.waitForTimeout(400);
                    inputLocator = await findInputInFrames(page, nicknameSelector);
                    if (inputLocator) break;
                }
            }

            inputLocator = await findInputInFrames(page, nicknameSelector);
            if (inputLocator) {
                dialogOpened = true;
                break;
            }

            if (await inputLocator.isVisible({ timeout: 2500 }).catch(() => false)) {
                dialogOpened = true;
                break;
            }

            // 備案 C: 極限座標點擊 (針對畫布版)
            console.log('[Step 3] Trying extreme coordinate click (width-100)...');
            await page.mouse.click(viewport.width - 40, 40);
            await page.waitForTimeout(1000);
            if (await inputLocator.isVisible({ timeout: 1000 }).catch(() => false)) {
                dialogOpened = true;
                break;
            }
        }

        let newName = generateRandomNickname();

        if (dialogOpened) {
            console.log(`[Step 2] Dialog opened. Initial name choice: ${newName}`);

            for (let i = 0; i < 15; i++) {
                ensureNotStopped();
                // 輸入暱稱
                await inputLocator.click({ force: true });
                await page.keyboard.press('Meta+A').catch(() => page.keyboard.press('Control+A'));
                await page.keyboard.press('Backspace');
                await inputLocator.fill(newName);
                await page.waitForTimeout(1000);

                // 點擊確認
                console.log(`[Step 2] Attempting to set nickname: ${newName} (Try ${i + 1})`);
                await page.keyboard.press('Enter');
                await smartClick(page, /Confirm|Save|確認|儲存|SAVE/i, 'Nick Confirm');
                await page.waitForTimeout(2000);

                // 檢查是否出現「名稱已占用」錯誤
                const errorMsg = await page.evaluate(() => {
                    const els = Array.from(document.querySelectorAll('div, span, p'));
                    return els.find(el => {
                        const txt = (el.innerText || '').toLowerCase();
                        return txt.includes('already taken') || txt.includes('名稱已被使用') || txt.includes('different name');
                    })?.innerText || null;
                });

                if (errorMsg) {
                    console.log(`[Step 2] ⚠️ Nickname "${newName}" is already taken. Generating new one...`);
                    newName = generateRandomNickname();
                    continue;
                }

                // 檢查輸入框是否消失 (代表成功)
                const isStillThere = await inputLocator.isVisible().catch(() => false);
                if (!isStillThere) {
                    console.log(`[Step 2] ✅ Success! Nickname set to: ${newName}`);
                    break;
                }

                console.log(`[Step 2] Dialog still visible, retrying...`);
                await page.keyboard.press('Tab');
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

        // 4️⃣ Manual Interaction
        setCurrentStep2('manualInteraction');
        console.log('[Step 4] AWAITING MANUAL STREAMER CARD CLICK...');
        updateStepResult2('manualInteraction', { success: false, waiting: true, message: '請點擊直播主卡片' });

        const [newPage] = await Promise.all([context.waitForEvent('page', { timeout: 120000 })]);
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
                            const labels = Array.from(document.querySelectorAll('label, div, span, p'));
                            const checkboxText = labels.find(el => {
                                const t = (el.innerText || '').toLowerCase();
                                return t.includes("don't show") || t.includes("不再顯示") || t.includes("不再提示");
                            });
                            
                            if (checkboxText) {
                                const cb = checkboxText.querySelector('input[type="checkbox"]') || 
                                           checkboxText.parentElement.querySelector('input[type="checkbox"]') ||
                                           document.querySelector('input[type="checkbox"]');
                                if (cb && !cb.checked) cb.click();
                            }
                        }).catch(() => {});
                        
                        await targetPage.waitForTimeout(1000);

                        // 2. 點擊 START PLAYING
                        const clicked = await smartClick(frame, /START PLAYING|START|PLAY|開始|開始遊戲/i, 'Start Button');
                        if (clicked) return true;

                        // 備案：座標點擊 (針對 Canvas 內部的按鈕)
                        const btnPos = await frame.evaluate(() => {
                            const btns = Array.from(document.querySelectorAll('button, div[role="button"], .startButton, .btn-start'));
                            const bigBtn = btns.find(b => b.offsetWidth > 50 && b.offsetHeight > 20);
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
                            console.log(`[Step 4] 透過座標點擊按鈕: (${finalX}, ${finalY})`);
                            return true;
                        }
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
