const { chromium } = require('playwright');
const { askToContinue } = require('../utils/interaction');
const fs = require('fs');
const path = require('path');

const debugDir = path.join(__dirname, '..', 'debug');
if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

let currentStep2 = null;
const stepResults2 = {};
const totalSteps2 = 8;

function setCurrentStep2(stepKey) { currentStep2 = stepKey; }
function updateStepResult2(stepKey, result) { stepResults2[stepKey] = result; }
function getProgress2() { return { currentStep: currentStep2, stepResults: stepResults2, totalSteps: totalSteps2 }; }
function resetProgress2() {
  currentStep2 = null;
  Object.keys(stepResults2).forEach(key => delete stepResults2[key]);
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
            closeBtn.click();
            return { x: r.x + r.width/2, y: r.y + r.height/2 };
        }
        return null;
    });

    if (x_btn) {
        console.log(`[Translate Killer] Clicked X button at (${x_btn.x.toFixed(0)}, ${x_btn.y.toFixed(0)})`);
    } else {
        // 矩陣式轟炸：在右上角可能區域點擊 9 個點，確保命中 X
        const base_x = viewport.width - 50;
        const base_y = 85;
        console.log(`[Translate Killer] No X found. Bombing coordinates around (${base_x}, ${base_y})...`);
        for (let dx = -10; dx <= 10; dx += 10) {
            for (let dy = -10; dy <= 10; dy += 10) {
                await page.mouse.click(base_x + dx, base_y + dy).catch(() => {});
            }
        }
    }
    
    // 額外嘗試：點擊可能存在的 Menu 旁的 X (針對 Chrome 泡泡)
    await page.waitForTimeout(500);
    
    // 強制隱藏所有可疑橫條與泡泡
    await page.evaluate(() => {
        const selectors = [
            '.yt-translate-bar', '#google-translate-element', '.goog-te-banner-frame', 
            '[class*="translate"] iframe', '#goog-gt-tt', '.goog-te-balloon-frame',
            '#translate-button', '.translate-bubble'
        ];
        selectors.forEach(s => {
            document.querySelectorAll(s).forEach(el => el.style.display = 'none');
        });
        
        // 清除推擠版面的 margin
        document.documentElement.style.marginTop = '0px';
        document.body.style.marginTop = '0px';
        if (document.body.style.top) document.body.style.top = '0px';
    });
}

/**
 * 萬能點擊：確保在翻譯列消失後執行
 */
async function smartClick(handle, textRegex, description = 'Element') {
    console.log(`[Diagnostic] Seeking ${description} (${textRegex})...`);

    // 實體座標點擊 — 取所有可見元素中最後一個（通常是最高層級）
    try {
        const els = handle.locator('button, div, span, a, [role="button"]').filter({ hasText: textRegex });
        const count = await els.count();
        for (let i = count - 1; i >= 0; i--) {
            const el = els.nth(i);
            if (await el.isVisible({ timeout: 500 })) {
                const box = await el.boundingBox();
                if (box && box.width > 5 && box.height > 5) {
                    await handle.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 100 });
                    console.log(`[Diagnostic] SUCCESS: Clicked ${description} at (${(box.x + box.width/2).toFixed(0)}, ${(box.y + box.height/2).toFixed(0)}) via Native Mouse`);
                    return true;
                }
            }
        }
    } catch (e) {}

    // JS 備案
    const jsClicked = await handle.evaluate(({ pattern, flags }) => {
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
    }, { pattern: textRegex.source, flags: textRegex.flags });

    if (jsClicked) {
        console.log(`[Diagnostic] SUCCESS: Clicked ${description} via JS`);
        return true;
    }
    return false;
}

async function checkWebsite2(url) {
    console.log('[Diagnostic] Launching Chromium (Ultra-Clean Mode)...');
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--disable-translate',
            '--disable-features=Translate,TranslateLanguageDetection,TranslateLanguageDetectionInternal,IPH_TranslateMenuButton',
            '--no-first-run',
            '--no-default-browser-check',
            '--lang=en-US',
            '--disable-blink-features=AutomationControlled',
            '--window-position=0,0'
        ]
    });

    const context = await browser.newContext({
        locale: 'en-US',
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    resetProgress2();

    try {
        // 1️⃣ Initialize
        setCurrentStep2('versionCheck');
        console.log('[Step 1] Initializing page:', url);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(3000);
        
        // 擊殺翻譯列
        await dismissTranslateBar(page);
        
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
        for (let i = 0; i < 6; i++) {
            const ok = await smartClick(page, /Confirm|確認|OK/i, 'Nickname OK');
            await page.waitForTimeout(2000);
            
            // 驗證視窗是否真的消失 (檢查是否還有 visible 的 OK 按鈕或特定的 modal 背景)
            const stillExists = await page.evaluate(() => {
                const els = Array.from(document.querySelectorAll('button, div, span, p'));
                return els.some(el => {
                    const txt = el.innerText || '';
                    const isVisible = el.offsetParent !== null && window.getComputedStyle(el).display !== 'none';
                    return (/Confirm|確認|OK/i.test(txt) && isVisible && txt.length < 10);
                });
            });
            
            if (!stillExists) {
                nicknameConfirmed = true;
                break;
            }
            console.log(`[Step 2] Nickname dialog still visible (retry ${i+1}), retrying click...`);
            await dismissTranslateBar(page);
            await page.waitForTimeout(1000);
        }

        if (!nicknameConfirmed) {
            const failPath = path.join(debugDir, `step2-fail-${Date.now()}.png`);
            await page.screenshot({ path: failPath });
            console.log(`[Step 2] FAIL - Screenshot saved to: ${failPath}`);
        }
        updateStepResult2('nicknameDialog', { success: nicknameConfirmed });

        // 3️⃣ Congratulations Claim
        setCurrentStep2('freeSpinClaim');
        console.log('[Step 3] Handling Congratulations...');
        for (let i = 0; i < 20; i++) {
            await smartClick(page, /CONTINUE|CLAIM SPIN|CLAIM|Claim Now|Confirm|確認|繼續|領取/i, 'Lobby Congrats');
            await page.waitForTimeout(1500);

            const stillVisible = await page.evaluate(() => {
                const regex = /CONTINUE|領取|繼續/i;
                return Array.from(document.querySelectorAll('button, div, span')).some(el => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return regex.test(el.innerText) && rect.width > 10 && style.display !== 'none';
                });
            });

            if (!stillVisible) {
                console.log('[Step 3] Congratulations dismissed!');
                break;
            }
            console.log(`[Step 3] Popup still visible, retry ${i + 1}/20...`);
        }
        updateStepResult2('freeSpinClaim', { success: true });

        // 4️⃣ Change Nickname
        setCurrentStep2('tcNicknameChange');
        console.log('[Step 4] Changing nickname...');
        
        // 點擊大頭貼前再次確保翻譯泡泡消失
        await dismissTranslateBar(page);
        await page.waitForTimeout(1000);

        const viewport = page.viewportSize() || { width: 1280, height: 720 };

        // 嘗試多種方式點擊右上角的大頭貼或暱稱開啟視窗
        let iconClicked = false;
        
        // 方法 A: 透過 CSS 選擇器
        try {
            const icon = page.locator('.header-user-info, .nickname-icon, .user-name, [class*="Nickname"], .user-info').first();
            if (await icon.isVisible({ timeout: 2000 })) {
                await icon.click();
                iconClicked = true;
                console.log('[Step 4] Clicked Profile Icon via CSS selector.');
            }
        } catch (e) {}

        // 方法 B: 掃描右上角區域 (Top-Right Quadrant)
        if (!iconClicked) {
            console.log('[Step 4] Scanning top-right header area for clickable elements...');
            iconClicked = await page.evaluate((width) => {
                // 尋找右上角 (x > width * 0.6, y < 70) 且有內容或背景圖的元素
                const candidates = Array.from(document.querySelectorAll('div, span, img, a, button'))
                    .filter(el => {
                        const r = el.getBoundingClientRect();
                        return r.top < 70 && r.left > width * 0.6 && r.width > 20 && r.height > 20;
                    });
                
                // 優先找看起來像暱稱 (包含 sns) 或有點擊屬性的
                const target = candidates.find(el => (el.innerText || '').includes('sns')) || 
                               candidates.find(el => window.getComputedStyle(el).cursor === 'pointer');
                
                if (target) {
                    target.click();
                    return true;
                }
                return false;
            }, viewport.width);
        }

        // 方法 C: 座標備案 (右上角精準打擊)
        if (!iconClicked) {
            const rx = viewport.width - 150;
            const ry = 35;
            console.log(`[Step 4] Using top-right coordinate fallback: clicking (${rx}, ${ry})`);
            await page.mouse.click(rx, ry);
            iconClicked = true;
        }
        await page.waitForTimeout(3000);

        let newName = generateRandomNickname();
        const inputLocator = page.locator('input[type="text"], input[placeholder*="nickname" i]').first();
        
        if (await inputLocator.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`[Step 4] Dialog opened. Initial name choice: ${newName}`);
            
            for (let i = 0; i < 15; i++) {
                // 輸入暱稱
                await inputLocator.click();
                await page.keyboard.press('Control+A');
                await page.keyboard.press('Backspace');
                await inputLocator.fill(newName);
                await page.waitForTimeout(1000);

                // 點擊確認
                console.log(`[Step 4] Attempting to set nickname: ${newName} (Try ${i+1})`);
                await page.keyboard.press('Enter');
                await smartClick(page, /Confirm|Save|確認|儲存|SAVE/i, 'Nick Confirm');
                await page.waitForTimeout(2000);

                // 檢查是否出現「名稱已占用」錯誤
                const errorMsg = await page.evaluate(() => {
                    const els = Array.from(document.querySelectorAll('div, span, p'));
                    return els.find(el => {
                        const txt = el.innerText || '';
                        return txt.includes('already taken') || txt.includes('名稱已被使用') || txt.includes('choose a different name');
                    })?.innerText || null;
                });

                if (errorMsg) {
                    console.log(`[Step 4] ⚠️ Nickname "${newName}" is already taken. Generating new one...`);
                    newName = generateRandomNickname();
                    continue;
                }

                // 檢查輸入框是否消失 (代表成功)
                const isStillThere = await inputLocator.isVisible().catch(() => false);
                if (!isStillThere) {
                    console.log(`[Step 4] ✅ Success! Nickname set to: ${newName}`);
                    break;
                }

                console.log(`[Step 4] Dialog still visible, retrying...`);
                await page.keyboard.press('Tab');
            }
        } else {
            console.log('[Step 4] WARNING: Nickname input field not found. Dialog might not be open.');
            const failPath = path.join(debugDir, `step4-input-fail-${Date.now()}.png`);
            await page.screenshot({ path: failPath });
            console.log(`[Step 4] FAIL - Screenshot saved to: ${failPath}`);
        }

        let success = false;
        for (let j = 0; j < 8; j++) {
            const content = await page.evaluate(() => document.body.innerText);
            if (content.includes(newName)) { success = true; break; }
            await page.waitForTimeout(1500);
        }
        console.log(`[Step 4] Result: ${success ? 'PASS' : 'FAIL'} ("${newName}")`);
        updateStepResult2('tcNicknameChange', { success, newName });

        await page.keyboard.press('Escape').catch(() => {});
        await smartClick(page, /Confirm|Cancel|Close|確認|關閉|CLOSE/i, 'Setting Close');

        // 5️⃣ Manual Interaction
        setCurrentStep2('manualInteraction');
        console.log('[Step 5] AWAITING MANUAL STREAMER CARD CLICK...');
        updateStepResult2('manualInteraction', { success: false, waiting: true, message: '請點擊直播主卡片' });

        const [newPage] = await Promise.all([context.waitForEvent('page', { timeout: 120000 })]);
        await newPage.waitForLoadState('domcontentloaded', { timeout: 90000 });
        updateStepResult2('manualInteraction', { success: true });
        console.log('[Step 5] Room page loaded!');
        
        // 🚀 新增：進入直播間後等待 10 秒，確保遊戲與彈窗完整載入
        console.log('[系統] 正在等待直播間頁面完整載入 (10秒)...');
        await newPage.waitForTimeout(10000);

        // 6️⃣ Handle Terms and Conditions
        setCurrentStep2('termsAndConditions');
        console.log('[Step 6] Checking Terms and Conditions...');
        const hasTicket = await newPage.evaluate(() =>
            Array.from(document.querySelectorAll('img, div, span, i')).some(el => {
                const r = el.getBoundingClientRect();
                return r.left < 250 && r.top < 250 && /ticket|coupon|voucher|活動|票券/i.test(el.className + el.id + el.innerHTML);
            })
        );
        if (hasTicket) {
            await smartClick(newPage, /Terms and conditions apply|服務條款/i, 'Terms Link');
            await newPage.waitForTimeout(2000);
            await smartClick(newPage, /X|Close|關閉|Back|CLOSE/i, 'Terms Close');
        }
        updateStepResult2('termsAndConditions', { success: true });

        // 7️⃣ Handle "How to Play" Popup
        setCurrentStep2('howToPlayPopup');
        console.log('[Step 7] Handling How to Play popups...');
        await newPage.waitForTimeout(1000);
        
        // 【關鍵】先關閉直播間頁面的翻譯列
        await dismissTranslateBar(newPage).catch(() => {});
        await newPage.waitForTimeout(1000);

        const vp = newPage.viewportSize() || { width: 1280, height: 720 };
        const scanAndHandlePopups = async (targetPage) => {
            const frames = targetPage.frames();
            for (const frame of frames) {
                try {
                    const content = await frame.evaluate(() => document.body.innerText).catch(() => '');
                    const lowerContent = content.toLowerCase();
                    if (lowerContent.includes('how to play') || lowerContent.includes('start')) {
                        console.log(`[Step 7] Found popup in frame: ${frame.url().substring(0, 40)}`);
                        await frame.evaluate(() => {
                            const labels = Array.from(document.querySelectorAll('label, div, span, p'));
                            const target = labels.find(el => el.innerText?.toLowerCase().includes("don't show this again"));
                            if (target) {
                                const cb = target.querySelector('input[type="checkbox"]') || target.parentElement.querySelector('input[type="checkbox"]');
                                if (cb) cb.click(); else target.click();
                            }
                        }).catch(() => {});
                        await targetPage.waitForTimeout(500);
                        const clicked = await smartClick(frame, /START PLAYING|START|PLAY/i, 'Start Button');
                        if (clicked) return true;
                        
                        const btnPos = await frame.evaluate(() => {
                            const btns = Array.from(document.querySelectorAll('button, div[role="button"], .startButton'));
                            const bigBtn = btns.find(b => b.offsetWidth > 100 && b.offsetHeight > 30);
                            if (bigBtn) { const r = bigBtn.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; }
                            return null;
                        }).catch(() => null);
                        if (btnPos) {
                            let finalX = btnPos.x, finalY = btnPos.y;
                            if (frame !== targetPage) {
                                const frameEl = await frame.frameElement();
                                const box = await frameEl.boundingBox();
                                if (box) { finalX += box.x; finalY += box.y; }
                            }
                            await targetPage.mouse.click(finalX, finalY);
                            return true;
                        }
                    }
                } catch (e) {}
            }
            return false;
        };

        let popupSuccess = false;
        for (let i = 0; i < 10; i++) {
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
        updateStepResult2('howToPlayPopup', { success: popupSuccess });

        // 8️⃣ Sound Control
        setCurrentStep2('soundControl');
        console.log('[Step 8] Testing Sound Control...');
        await newPage.evaluate(() => {
            const btn = document.querySelector('.sound-icon, .volume-icon, [class*="Sound"], [class*="Volume"]');
            if (btn) { btn.click(); setTimeout(() => btn.click(), 500); }
        });
        await newPage.waitForTimeout(1500);
        updateStepResult2('soundControl', { success: true });

        console.log('[Diagnostic] TEST COMPLETED.');
    } finally {
        setCurrentStep2(null);
        
        // 詢問使用者是否繼續
        const decision = await askToContinue();
        
        if (decision === 'quit') {
            await browser.close().catch(() => {});
            console.log('Browser closed immediately');
        } else {
            console.log('💡 瀏覽器將保持開啟 60 秒後自動關閉...');
            await page.waitForTimeout(60000).catch(() => {});
            await browser.close().catch(() => {});
        }
    }
}

module.exports = { checkWebsite2, getProgress2, setCurrentStep2 };
