(function() {
    // 清理旧面板与残留高亮层、旧样式
    const oldPanel = document.getElementById('auto-clicker-panel');
    if (oldPanel) oldPanel.remove();
    const oldMask = document.getElementById('clicker-picker-mask');
    if (oldMask) oldMask.remove();
    const oldStyle = document.getElementById('auto-clicker-style');
    if (oldStyle) oldStyle.remove();

    // 1. 创建悬浮面板
    const panel = document.createElement('div');
    panel.id = 'auto-clicker-panel';
    panel.innerHTML = `
        <div id="clicker-header">
            <span>🖱️ 双间隔循环助手 (Worker 定时)</span>
            <span id="clicker-close">×</span>
        </div>
        <div class="clicker-body">
            <button id="clicker-pick-btn" class="btn-pick">🎯 拾取目标元素 (点击捕获)</button>

            <label>目标 XPath / 选择器：</label>
            <input type="text" id="clicker-xpath" placeholder="可手动输入或点击上方拾取" value='//div[@id="live-control-goods-list-container"]//button[1]' />

            <div class="clicker-row">
                <div>
                    <label>间隔 1 (秒)：</label>
                    <input type="number" id="clicker-delay1" value="1" min="0.1" step="0.5" />
                    <span class="sub-tip">第1次点击后等待</span>
                </div>
                <div>
                    <label>间隔 2 (秒)：</label>
                    <input type="number" id="clicker-delay2" value="3" min="0.1" step="0.5" />
                    <span class="sub-tip">第2次点击后等待</span>
                </div>
            </div>

            <div class="clicker-actions">
                <button id="clicker-start-btn" class="btn-start">启动循环</button>
                <button id="clicker-stop-btn" class="btn-stop" disabled>停止</button>
            </div>

            <div id="clicker-status">状态：就绪</div>
        </div>
    `;

    // 2. 注入样式
    const style = document.createElement('style');
    style.id = 'auto-clicker-style';
    style.textContent = `
        #auto-clicker-panel {
            position: fixed;
            top: 70px;
            right: 20px;
            width: 320px;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            color: #333;
            z-index: 2147483647;
            overflow: hidden;
            border: 1px solid #e2e8f0;
        }
        #clicker-header {
            background: #1e40af;
            color: #fff;
            padding: 9px 12px;
            font-weight: 600;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
        }
        #clicker-close {
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
        }
        .clicker-body {
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .btn-pick {
            width: 100%;
            background: #6366f1;
            color: white;
            border: none;
            padding: 8px;
            border-radius: 4px;
            font-weight: 600;
            cursor: pointer;
            transition: 0.2s;
        }
        .btn-pick:hover { background: #4f46e5; }
        .btn-pick.picking {
            background: #ea580c;
        }
        .clicker-body label {
            font-size: 12px;
            color: #475569;
            margin-bottom: 2px;
            display: block;
        }
        .clicker-body input {
            width: 100%;
            padding: 6px 8px;
            box-sizing: border-box;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            font-size: 12px;
        }
        .sub-tip {
            font-size: 11px;
            color: #94a3b8;
            display: block;
            margin-top: 2px;
        }
        .clicker-row {
            display: flex;
            gap: 10px;
        }
        .clicker-row > div {
            flex: 1;
        }
        .clicker-actions {
            display: flex;
            gap: 10px;
        }
        .clicker-actions button {
            flex: 1;
            padding: 9px;
            border: none;
            border-radius: 4px;
            font-weight: bold;
            cursor: pointer;
        }
        .btn-start { background: #16a34a; color: white; }
        .btn-start:hover { background: #15803d; }
        .btn-stop { background: #dc2626; color: white; }
        .btn-stop:hover { background: #b91c1c; }
        .clicker-actions button:disabled, .btn-pick:disabled {
            background: #94a3b8;
            cursor: not-allowed;
        }
        #clicker-status {
            font-size: 12px;
            color: #475569;
            background: #f1f5f9;
            padding: 8px;
            border-radius: 4px;
            border: 1px dashed #cbd5e1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        #clicker-picker-mask {
            position: fixed;
            pointer-events: none;
            border: 2px solid #ef4444;
            background: rgba(239, 68, 68, 0.2);
            z-index: 2147483646;
            transition: all 0.08s ease;
            box-sizing: border-box;
            display: none;
        }
    `;

    // 3. 高亮辅助遮罩
    const mask = document.createElement('div');
    mask.id = 'clicker-picker-mask';

    document.head.appendChild(style);
    document.body.appendChild(panel);
    document.body.appendChild(mask);

    // 4. 拾取元素与路径生成
    function generateSmartXPath(el) {
        if (!el || el.nodeType !== 1) return '';
        if (el.id) return `//*[@id="${el.id}"]`;

        const components = [];
        let current = el;
        while (current && current.nodeType === 1 && current !== document.body && current !== document.documentElement) {
            if (current.id) {
                components.unshift(`*[@id="${current.id}"]`);
                break;
            }
            let index = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
                if (sibling.tagName === current.tagName) index++;
                sibling = sibling.previousElementSibling;
            }
            components.unshift(`${current.tagName.toLowerCase()}[${index}]`);
            current = current.parentElement;
        }
        return '//' + components.join('/');
    }

    let isPicking = false;
    const pickBtn = panel.querySelector('#clicker-pick-btn');
    const xpathInput = panel.querySelector('#clicker-xpath');
    const statusText = panel.querySelector('#clicker-status');

    function updateStatus(text) {
        statusText.textContent = `状态：${text}`;
    }

    function onMouseMove(e) {
        if (!isPicking) return;
        const target = e.target;
        if (panel.contains(target) || target === mask) return;

        const rect = target.getBoundingClientRect();
        mask.style.display = 'block';
        mask.style.top = `${rect.top}px`;
        mask.style.left = `${rect.left}px`;
        mask.style.width = `${rect.width}px`;
        mask.style.height = `${rect.height}px`;
    }

    function onElementClick(e) {
        if (!isPicking) return;
        if (panel.contains(e.target)) return;

        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        xpathInput.value = generateSmartXPath(target);
        stopPicking();
        updateStatus(`拾取成功：<${target.tagName.toLowerCase()}>`);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            stopPicking();
            updateStatus('拾取已取消');
        }
    }

    function startPicking() {
        isPicking = true;
        pickBtn.textContent = '❌ 点击目标或按 ESC 取消';
        pickBtn.classList.add('picking');
        updateStatus('移动鼠标到按钮上并点击...');
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('click', onElementClick, true);
        document.addEventListener('keydown', onKeyDown, true);
    }

    function stopPicking() {
        isPicking = false;
        mask.style.display = 'none';
        pickBtn.textContent = '🎯 拾取目标元素 (点击捕获)';
        pickBtn.classList.remove('picking');
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('click', onElementClick, true);
        document.removeEventListener('keydown', onKeyDown, true);
    }

    pickBtn.onclick = () => {
        if (isPicking) stopPicking();
        else startPicking();
    };

    // Worker 心跳定时器：Worker 里只有计时，不能碰 DOM；点击仍在主线程按 XPath 执行。
    // 心跳固定 200ms，主循环每等到一拍就扣 0.2 秒，和原来倒计时粒度一致。
    let bgTicker = null;

    function createBackgroundTicker(intervalMs) {
        intervalMs = intervalMs || 200;
        const workerCode = `
            let timer = null;
            self.onmessage = function(e) {
                if (e.data === 'start' && !timer) {
                    timer = setInterval(function() { self.postMessage('tick'); }, ${intervalMs});
                } else if (e.data === 'stop') {
                    clearInterval(timer);
                    timer = null;
                }
            };
        `;
        const url = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));
        const worker = new Worker(url);
        const listeners = new Set();
        worker.onmessage = function(e) {
            if (e.data === 'tick') listeners.forEach(function(cb) { cb(); });
        };
        return {
            onTick: function(cb) {
                listeners.add(cb);
                return function() { listeners.delete(cb); };
            },
            start: function() { worker.postMessage('start'); },
            stop: function() {
                try { worker.postMessage('stop'); } catch (e) {}
                worker.terminate();
                URL.revokeObjectURL(url);
            }
        };
    }

    // 5. 点击与双间隔主流程
    let isRunning = false;
    let timerId = null;
    let activeRun = 0; // 防止快速停止/启动时旧循环和新循环互相干扰
    const startBtn = panel.querySelector('#clicker-start-btn');
    const stopBtn = panel.querySelector('#clicker-stop-btn');

    function clickElement(xpath) {
        try {
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const el = result.singleNodeValue;
            if (el && typeof el.click === 'function') {
                el.click();
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    // 支持带倒计时的休眠，等待来源改为 Worker 心跳
    async function countdownSleep(seconds, cycle, stageName, runId) {
        let remaining = seconds;
        while (remaining > 0 && isRunning && activeRun === runId) {
            updateStatus(`[轮次 ${cycle}] ${stageName}，等待 ${remaining.toFixed(1)}s...`);
            await new Promise(function(resolve) {
                if (bgTicker) {
                    const off = bgTicker.onTick(function() { off(); resolve(); });
                } else {
                    timerId = setTimeout(resolve, 200); // Worker 被拦截时的回退
                }
            });
            remaining -= 0.2;
        }
    }

    async function runTwoStageLoop(runId) {
        const xpath = xpathInput.value.trim();
        const delay1 = parseFloat(panel.querySelector('#clicker-delay1').value) || 1;
        const delay2 = parseFloat(panel.querySelector('#clicker-delay2').value) || 3;
        const myTicker = bgTicker;

        let cycle = 1;

        try {
            while (isRunning && activeRun === runId) {
                // 步骤 1：第 1 次点击
                const ok1 = clickElement(xpath);
                if (!isRunning || activeRun !== runId) break;

                // 等待间隔 1 (秒)
                await countdownSleep(delay1, cycle, `第1次点击 ${ok1 ? '✔' : '❌'}`, runId);
                if (!isRunning || activeRun !== runId) break;

                // 步骤 2：第 2 次点击
                const ok2 = clickElement(xpath);
                if (!isRunning || activeRun !== runId) break;

                // 等待间隔 2 (秒)
                await countdownSleep(delay2, cycle, `第2次点击 ${ok2 ? '✔' : '❌'}`, runId);

                cycle++;
            }
        } finally {
            // 这里才真正终止本轮的 Worker；停止/关闭时不要提前杀，
            // 否则正在等的那个 Promise 永远等不到心跳。
            if (myTicker) {
                try { myTicker.stop(); } catch (e) {}
            }
            if (bgTicker === myTicker) bgTicker = null;
            if (activeRun === runId) {
                updateStatus('已停止');
                startBtn.disabled = false;
                stopBtn.disabled = true;
                pickBtn.disabled = false;
            }
        }
    }

    startBtn.onclick = () => {
        if (isRunning) return;
        if (!xpathInput.value.trim()) {
            alert('请先输入或拾取目标 XPath！');
            return;
        }
        activeRun++;
        const runId = activeRun;
        // 启动时创建 Worker，CSP 拦截 blob Worker 时回退普通定时
        try {
            bgTicker = createBackgroundTicker(200);
            bgTicker.start();
        } catch (e) {
            bgTicker = null;
            updateStatus('Worker 被拦截，已回退普通定时');
        }
        isRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        pickBtn.disabled = true;
        runTwoStageLoop(runId);
    };

    stopBtn.onclick = () => {
        // 只置标志位，不直接杀 Worker / 不清 timeout，
        // 等下一拍心跳（最多 200ms）让循环干净退出，finally 里再杀 Worker
        isRunning = false;
        updateStatus('正在中断...');
        startBtn.disabled = false;
        stopBtn.disabled = true;
        pickBtn.disabled = false;
    };

    panel.querySelector('#clicker-close').onclick = () => {
        // 同上：只置标志位，循环的 finally 会在下一拍后终止 Worker
        isRunning = false;
        stopPicking();
        panel.remove();
        mask.remove();
        style.remove();
    };

    // 6. 拖拽逻辑
    const header = panel.querySelector('#clicker-header');
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    header.onmousedown = (e) => {
        if (e.target.id === 'clicker-close') return;
        isDragging = true;
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;

        const onMouseMoveDrag = (me) => {
            if (!isDragging) return;
            panel.style.left = `${me.clientX - offsetX}px`;
            panel.style.top = `${me.clientY - offsetY}px`;
            panel.style.right = 'auto';
        };

        const onMouseUpDrag = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMoveDrag);
            document.removeEventListener('mouseup', onMouseUpDrag);
        };

        document.addEventListener('mousemove', onMouseMoveDrag);
        document.addEventListener('mouseup', onMouseUpDrag);
    };
})();
