const readline = require('readline');

let resolveDecision = null;

// 初始化鍵盤監聽
function initInteraction(onShutdown) {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
    }

    process.stdin.on('keypress', (str, key) => {
        if (key.ctrl && key.name === 'c') {
            if (onShutdown) onShutdown();
            process.exit();
        } else if (key.name === 'q') {
            if (resolveDecision) {
                console.log('\n🛑 收到指令：中斷並關閉瀏覽器');
                resolveDecision('quit');
                resolveDecision = null;
            } else {
                console.log('\n🛑 正在關閉伺服器...');
                if (onShutdown) onShutdown();
                setTimeout(() => process.exit(), 500); // 稍微延遲確保指令送出
            }
        } else if (key.name === 'c') {
            if (resolveDecision) {
                console.log('\n✅ 收到指令：繼續（瀏覽器將保持開啟）');
                resolveDecision('continue');
                resolveDecision = null;
            }
        }
    });
}

function askToContinue() {
    return new Promise((resolve) => {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('❓ 測試已跑完流程，請在終端機選擇後續動作：');
        console.log('   👉 按下 [C]：繼續 (Continue) - 保持瀏覽器開啟 60 秒');
        console.log('   👉 按下 [Q]：離開 (Quit) - 立即關閉瀏覽器');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        resolveDecision = resolve;
    });
}

module.exports = { initInteraction, askToContinue };
