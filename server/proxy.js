const express = require('express');
const Unblocker = require('unblocker');
const cors = require('cors');
const compression = require('compression');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;

// Enable trust proxy to get the real client IP through Render's load balancer
app.set('trust proxy', true);

// Global Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Middleware to capture the real client IP and pass it to unblocker via a temporary header
app.use((req, res, next) => {
    if (req.url.startsWith('/proxy/')) {
        req.headers['x-client-ip'] = req.ip;
    }
    next();
});

// --- GLOBAL STATE (Serverless In-Memory) ---
let recentHistory = []; // Stores recent proxied URLs metadata
let chatHistory = [];   // Stores AI chat logs
const MAX_HISTORY = 50;
const MAX_CHAT_HISTORY = 100;


function addToHistory(url, ip) {
    if (!url || url.includes('sticky.js') || url.includes('favicon.ico')) return;

    // --- FILTER ASSETS & TRACKERS ---
    const lowerUrl = url.toLowerCase().split('?')[0];
    const ignoredExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ico', '.json', '.txt', '.mp4', '.mp3'];
    if (ignoredExtensions.some(ext => lowerUrl.endsWith(ext))) return;
    if (url.includes('/t/sl_l') || url.includes('analytics') || url.includes('advertising')) return;

    // Format timestamp (JST)
    const now = new Date();
    const timestamp = now.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const logEntry = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        time: timestamp,
        ip: ip || 'Unknown',
        url: url
    };

    recentHistory.unshift(logEntry);
    if (recentHistory.length > MAX_HISTORY) recentHistory.pop();
}

function addChatToHistory(prompt, response, ip) {
    const now = new Date();
    const timestamp = now.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const chatEntry = {
        id: 'chat_' + Date.now() + Math.random().toString(36).substr(2, 5),
        time: timestamp,
        ip: ip || 'Unknown',
        prompt: prompt,
        response: response
    };

    chatHistory.unshift(chatEntry);
    if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.pop();
}

// --- PERSISTENCE: Cloudflare Workers Sync ---
const WORKERS_BASE_URL = 'https://antigravity-ai.yuunozhikkyou-sabu-1017.workers.dev';

async function syncStorage(method = 'POST') {
    try {
        if (method === 'POST') {
            await fetch(`${WORKERS_BASE_URL}/api/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recentHistory, chatHistory })
            });
            console.log(`[${new Date().toLocaleTimeString()}] History backed up to Cloudflare.`);
        } else {
            const res = await fetch(`${WORKERS_BASE_URL}/api/history`);
            const data = await res.json();
            if (data.recentHistory) recentHistory = data.recentHistory;
            if (data.chatHistory) chatHistory = data.chatHistory;
            console.log(`[${new Date().toLocaleTimeString()}] History restored from Cloudflare.`);
        }
    } catch (e) {
        console.error("Storage sync failed:", e.message);
    }
}

// Initial pull on start
syncStorage('GET');

// Save every 5 minutes (300,000 ms)
setInterval(() => syncStorage('POST'), 5 * 60 * 1000);



// --- STEALTH & ANONYMITY CONFIG (Ver 2.0) ---
// We match User-Agents with their corresponding Sec-CH-UA headers for perfect browser spoofing
const BROWSER_FINGERPRINTS = [
    {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ch_ua: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        platform: '"Windows"'
    },
    {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
        ch_ua: '"Not_A Brand";v="8", "Chromium";v="121", "Microsoft Edge";v="121"',
        platform: '"Windows"'
    },
    {
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ch_ua: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        platform: '"macOS"'
    }
];

// Initialize Unblocker
const unblocker = new Unblocker({
    prefix: '/proxy/',
    requestMiddleware: [
        (data) => {
            // 1. Nuclear Header Stripping: Kill anything that leaks a datacenter/proxy
            const headersToRemove = [
                'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-port', 'x-forwarded-host',
                'via', 'x-real-ip', 'client-ip', 'true-client-ip',
                'x-render-host', 'x-render-request-id', 'x-render-region', 'x-render-src',
                'cf-connecting-ip', 'cf-ray', 'cf-ipcountry', 'cf-visitor', 'cf-request-id',
                'cdn-loop', 'x-amz-cf-id', 'forwarded', 'x-envoy-external-address',
                'x-requested-with', 'proxy-connection', 'proxy-authorization'
            ];
            headersToRemove.forEach(h => delete data.headers[h]);

            // 2. Browser Identity Spoofing (Fingerprinting)
            const fingerprint = BROWSER_FINGERPRINTS[Math.floor(Math.random() * BROWSER_FINGERPRINTS.length)];
            data.headers['user-agent'] = fingerprint.ua;
            data.headers['sec-ch-ua'] = fingerprint.ch_ua;
            data.headers['sec-ch-ua-mobile'] = '?0';
            data.headers['sec-ch-ua-platform'] = fingerprint.platform;

            // 3. Realistic Handshake Headers
            data.headers['dnt'] = '1';
            data.headers['sec-fetch-dest'] = 'document';
            data.headers['sec-fetch-mode'] = 'navigate';
            data.headers['sec-fetch-site'] = 'same-origin';
            data.headers['sec-fetch-user'] = '?1';
            data.headers['upgrade-insecure-requests'] = '1';
            data.headers['accept-language'] = 'ja,en-US;q=0.9,en;q=0.8';

            // 4. Referer/Origin Spoofing
            try {
                const url = new URL(data.url);
                const origin = url.origin;
                data.headers['origin'] = origin;
                if (!data.headers['referer']) {
                    data.headers['referer'] = origin + '/';
                }

                // Internal logging Cleanup
                const clientIp = data.headers['x-client-ip'] || 'Unknown';
                delete data.headers['x-client-ip'];
                addToHistory(data.url, clientIp);
            } catch (e) { }
        }
    ],
    responseMiddleware: [
        // 1. Strip CSP & Frame Options to allow our script to run (CRITICAL for Video & Complex Apps)
        (data) => {
            delete data.headers['content-security-policy'];
            delete data.headers['content-security-policy-report-only'];
            delete data.headers['x-frame-options'];
            delete data.headers['x-content-type-options'];

            // --- VIDEO STREAMING OPTIMIZATION ---
            // Allow all origins and expose crucial headers for video fragments (Range)
            data.headers['access-control-allow-origin'] = '*';
            data.headers['access-control-allow-methods'] = 'GET, POST, OPTIONS, HEAD, PUT, DELETE';
            data.headers['access-control-allow-headers'] = 'Range, Content-Type, Authorization, X-Requested-With, Origin, Accept';
            data.headers['access-control-expose-headers'] = 'Content-Length, Content-Range, Accept-Ranges';

            // Force Accept-Ranges to allow video seeking even if target hides it
            if (data.headers['content-type'] && data.headers['content-type'].includes('video')) {
                data.headers['accept-ranges'] = 'bytes';
            }
        },
        // 2. Inject a script to force links to stay within the proxy (Nuclear Externalized)
        (data) => {
            if (data.contentType && data.contentType.includes('text/html')) {
                // Point to our internal cacheable script
                // We inject it as early as possible in the <head> to avoid reload issues
                const scriptTag = `<script src="/proxy-internal/sticky.js"></script>`;

                const payload = scriptTag;

                if (data.body && data.body.includes('<head>')) {
                    data.body = data.body.replace('<head>', '<head>' + payload);
                } else if (data.body && data.body.includes('<html>')) {
                    data.body = data.body.replace('<html>', '<html>' + payload);
                } else if (data.body) {
                    data.body = payload + data.body;
                }
            }
        }
    ]
});



// --- INTERNAL ROUTES (Fast, No-Proxy) ---

// Moving the huge sticky script to a separate file so it's cached by the browser
app.get('/proxy-internal/sticky.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(`
    (function() {
        const PROXY_PREFIX = '/proxy/';
        
        function isProxied(url) {
            return url.includes(PROXY_PREFIX);
        }

        function toProxyUrl(originalUrl) {
            if (!originalUrl) return originalUrl;
            if (isProxied(originalUrl)) return originalUrl;
            if (originalUrl.startsWith(window.location.origin + PROXY_PREFIX)) return originalUrl;
            
            if (originalUrl.startsWith('http')) {
                let target = originalUrl;
                if (target.startsWith('http://')) {
                    target = target.replace('http://', 'plain://');
                }
                return window.location.origin + PROXY_PREFIX + target;
            }
            // --- NEW: Handle relative paths starting with "/" ---
            if (originalUrl.startsWith('/') && !originalUrl.startsWith('//')) {
                const parts = window.location.pathname.split(PROXY_PREFIX);
                if (parts.length > 1) {
                    const targetInfo = parts[1]; // e.g., "https://example.com/page"
                    const match = targetInfo.match(/^(https?:\/\/|plain:\/\/)([^\/]+)/);
                    if (match) {
                        const targetOrigin = (match[1] === 'plain://' ? 'http://' : match[1]) + match[2];
                        return toProxyUrl(targetOrigin + originalUrl);
                    }
                }
            }
            return originalUrl;
        }

        // --- NUCLEAR EVENT CAPTURE ---
        window.addEventListener('click', function(e) {
            const anchor = e.target.closest('a') || e.target.closest('area');
            if (anchor && anchor.href) {
                if (anchor.href.startsWith('javascript:') || anchor.href.startsWith('#')) return;
                const proxyUrl = toProxyUrl(anchor.href);
                if (proxyUrl !== anchor.href) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    if (anchor.target === '_blank') {
                        window.open(proxyUrl, '_blank');
                    } else {
                        window.location.href = proxyUrl;
                    }
                }
            }
        }, true);

        window.addEventListener('submit', function(e) {
            const form = e.target;
            if (form.action) {
                const proxyUrl = toProxyUrl(form.action);
                if (proxyUrl !== form.action) {
                    form.action = proxyUrl;
                }
            }
        }, true);

        // --- XHR & FETCH PATCH (Crucial for Video Steaming/SPAs) ---
        const originalXhrOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            if (url && typeof url === 'string' && url.startsWith('http') && !isProxied(url)) {
                arguments[1] = toProxyUrl(url);
            }
            return originalXhrOpen.apply(this, arguments);
        };

        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
            if (typeof input === 'string' && input.startsWith('http') && !isProxied(input)) {
                input = toProxyUrl(input);
            } else if (input instanceof Request && input.url.startsWith('http') && !isProxied(input.url)) {
                // Hard to re-construct Request, but for most simple cases, we can replace the URL
                const newRequest = new Request(toProxyUrl(input.url), input);
                return originalFetch.call(this, newRequest, init);
            }
            return originalFetch.apply(this, arguments);
        };

        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        function patchHistoryMethod(original) {
            return function(state, unused, url) {
                if (url && typeof url === 'string' && url.startsWith('http') && !isProxied(url)) {
                    arguments[2] = toProxyUrl(url);
                }
                return original.apply(this, arguments);
            };
        }
        history.pushState = patchHistoryMethod(originalPushState);
        history.replaceState = patchHistoryMethod(originalReplaceState);

        const originalOpen = window.open;
        window.open = function(url, target, features) {
            if (url) arguments[0] = toProxyUrl(url);
            return originalOpen.apply(this, arguments);
        };

        if (window.RTCPeerConnection) window.RTCPeerConnection = null;
    })();
    `);
});

// Admin Route (Password Protected & Pretty HTML)
app.get('/admin', (req, res) => {
    const ps = req.query.ps;
    if (ps !== 'yuu1017dy') {
        return res.status(403).send('<html><body style="background:#0d0d0d;color:#ff4d4d;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;"><h1>403: Forbidden - Invalid Password</h1></body></html>');
    }

    // Handle Individual Deletion
    if (req.query.delete) {
        const idsToDelete = req.query.delete.split(',');
        recentHistory = recentHistory.filter(entry => !idsToDelete.includes(entry.id));
        chatHistory = chatHistory.filter(entry => !idsToDelete.includes(entry.id));
        return res.redirect(`/admin?ps=${ps}${req.query.view ? '&view=' + req.query.view : ''}`);
    }

    // Handle Clear All
    if (req.query.clearall === 'true') {
        if (req.query.view === 'chat') chatHistory = [];
        else recentHistory = [];
        return res.redirect(`/admin?ps=${ps}${req.query.view ? '&view=' + req.query.view : ''}`);
    }

    const view = req.query.view || 'dashboard';

    let contentHtml = '';

    if (view === 'dashboard') {
        contentHtml = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 40px;">
                <a href="/admin?ps=${ps}&view=proxy" style="text-decoration: none; background: #1a1a1a; border: 1px solid #333; padding: 40px; border-radius: 20px; text-align: center; transition: 0.3s; color: #fff;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🌐</div>
                    <div style="font-size: 1.25rem; font-weight: bold;">閲覧履歴</div>
                    <p style="color: #888; font-size: 0.9rem; margin-top: 10px;">プロキシ経由でアクセスしたURLのログを表示します。</p>
                </a>
                <a href="/admin?ps=${ps}&view=chat" style="text-decoration: none; background: #1a1a1a; border: 1px solid #333; padding: 40px; border-radius: 20px; text-align: center; transition: 0.3s; color: #fff;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🤖</div>
                    <div style="font-size: 1.25rem; font-weight: bold;">チャット履歴</div>
                    <p style="color: #888; font-size: 0.9rem; margin-top: 10px;">Gemini AIへの質問と回答のログを表示します。</p>
                </a>
            </div>
        `;
    } else if (view === 'proxy') {
        contentHtml = recentHistory.map(entry => `
            <div style="background:#151515; border:1px solid #222; padding:18px; border-radius:12px; margin-bottom:20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: flex-start; gap: 15px;">
                <input type="checkbox" class="log-checkbox" data-id="${entry.id}" style="margin-top: 5px; width: 18px; height: 18px; cursor: pointer;">
                <div style="flex: 1;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid #2a2a2a; padding-bottom:8px; align-items:center;">
                        <span style="color:#888; font-size:0.85rem; font-family:monospace; background:#0a0a0a; padding:2px 8px; border-radius:4px; border:1px solid #222;">IP: ${entry.ip}</span>
                        <span style="color:#818cf8; font-weight:600; font-family:'JetBrains Mono', monospace; font-size:0.85rem;">[ ${entry.time} ]</span>
                    </div>
                    <div style="word-break:break-all;">
                        <a href="${entry.url}" target="_blank" style="color:#ddd; text-decoration:none; font-size:0.95rem;">${entry.url}</a>
                    </div>
                </div>
            </div>
        `).join('') || '<p style="color:#444; text-align:center; padding:50px;">閲覧履歴はありません。</p>';
    } else if (view === 'chat') {
        contentHtml = chatHistory.map(entry => `
            <div style="background:#151515; border:1px solid #222; padding:18px; border-radius:12px; margin-bottom:20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: flex-start; gap: 15px;">
                <input type="checkbox" class="log-checkbox" data-id="${entry.id}" style="margin-top: 5px; width: 18px; height: 18px; cursor: pointer;">
                <div style="flex: 1;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid #2a2a2a; padding-bottom:8px; align-items:center;">
                        <span style="color:#818cf8; font-size:0.85rem; font-family:monospace; background:#0a0a0a; padding:2px 8px; border-radius:4px; border:1px solid #222;">Chat Log (IP: ${entry.ip})</span>
                        <span style="color:#f472b6; font-weight:600; font-family:'JetBrains Mono', monospace; font-size:0.85rem;">[ ${entry.time} ]</span>
                    </div>
                    <div style="margin-bottom:10px;">
                        <div style="color:#6366f1; font-size:0.75rem; text-transform:uppercase; font-weight:bold; margin-bottom:4px;">User Prompt</div>
                        <div style="background:#0a0a0a; padding:10px; border-radius:6px; color:#ddd; font-size:0.9rem;">${entry.prompt}</div>
                    </div>
                    <div>
                        <div style="color:#f472b6; font-size:0.75rem; text-transform:uppercase; font-weight:bold; margin-bottom:4px;">AI Response</div>
                        <div style="background:#0a0a0a; padding:10px; border-radius:6px; color:#aaa; font-size:0.9rem; line-height:1.5;">${entry.response}</div>
                    </div>
                </div>
            </div>
        `).join('') || '<p style="color:#444; text-align:center; padding:50px;">チャット履歴はありません。</p>';
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Antigravity Admin Panel</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { background: #0d0d0d; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; }
                .container { max-width: 900px; margin: 0 auto; }
                header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #222; padding-bottom: 15px; }
                header h1 { margin: 0; font-size: 1.5rem; color: #6366f1; }
                .nav-bread { margin-bottom: 20px; font-size: 0.9rem; color: #666; }
                .nav-bread a { color: #6366f1; text-decoration: none; }
                .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 10px; background: #111; border-radius: 10px; border: 1px solid #222; }
                .btn { padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: 500; cursor: pointer; border: none; }
                .btn-delete { background: #ef4444; color: #fff; }
                .btn-clear { background: #991b1b; color: #fff; }
                .btn-home { background: #333; color: #ccc; }
                .refresh-info { color: #444; font-size: 0.75rem; text-align: center; margin-top: 40px; }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>Antigravity Admin</h1>
                    <a href="https://yuunano.github.io/antigravity-proxy/" class="btn btn-home">ホームに戻る</a>
                </header>
                
                <div class="nav-bread">
                    ${view === 'dashboard' ? 'Dashboard' : `<a href="/admin?ps=${ps}">Dashboard</a> > ${view === 'proxy' ? '閲覧履歴' : 'チャット履歴'}`}
                </div>

                ${view !== 'dashboard' ? `
                <div class="toolbar">
                    <label style="font-size: 0.85rem; color: #888; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="select-all"> 全て選択
                    </label>
                    <div style="display: flex; gap: 10px;">
                        <button id="delete-selected" class="btn btn-delete">削除</button>
                        <a href="/admin?ps=${ps}&view=${view}&clearall=true" class="btn btn-clear" onclick="return confirm('表示中のログを一括消去しますか？')">一括削除</a>
                    </div>
                </div>
                ` : ''}

                ${contentHtml}
                
                <div class="refresh-info">Auto-resets on server restart | (c) Antigravity Proxy</div>
            </div>

            <script>
                const selectAll = document.getElementById('select-all');
                if (selectAll) {
                    const checkboxes = document.querySelectorAll('.log-checkbox');
                    const deleteBtn = document.getElementById('delete-selected');

                    selectAll.addEventListener('change', () => {
                        checkboxes.forEach(cb => cb.checked = selectAll.checked);
                    });

                    deleteBtn.addEventListener('click', () => {
                        const selectedIds = Array.from(checkboxes)
                            .filter(cb => cb.checked)
                            .map(cb => cb.dataset.id);
                        
                        if (selectedIds.length === 0) {
                            alert('削除する項目を選択してください。');
                            return;
                        }

                        if (confirm(selectedIds.length + '件の項目を削除しますか？')) {
                            window.location.href = '?ps=${ps}&view=${view}&delete=' + selectedIds.join(',');
                        }
                    });
                }
            </script>
        </body>
        </html>
    `);

});

// Stealth Middleware: Rewrite 'plain://' to 'http://' to bypass "http" keyword filters
app.use((req, res, next) => {
    if (req.url.includes('plain://')) {
        req.url = req.url.replace('plain://', 'http://');
    }
    next();
});

// --- MOUNT MIDDLEWARE ---
// Important: Place API and Admin routes BEFORE unblocker

// Initialize Gemini AI safely
let model = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
try {
    if (GEMINI_API_KEY) {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        // Using 1.5-flash for better speed and stability
        model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }
} catch (e) {
    console.error("Failed to initialize Gemini SDK:", e);
}

// AI ENDPOINT (Gemini Integration)
app.post('/api/ai', async (req, res) => {
    const { prompt, lang } = req.body;

    if (!GEMINI_API_KEY || !model) {
        return res.json({
            response: lang === 'ja'
                ? "AI設定（APIキー）が見つからないよ。Renderの設定を確認してね！"
                : "AI features are not configured (missing API Key)."
        });
    }

    try {
        const systemPrompt = lang === 'ja'
            ? "あなたは Antigravity Proxy のアシスタント、Gravity AIです。フレンドリーな「ゆう」の友達として助けてね。回答は簡潔に日本語で、語尾は「〜だよ」「〜だね」でお願いします。"
            : "You are the Antigravity Proxy Assistant, Gravity AI. Be friendly to 'Yuu'. Reply in English and keep it concise.";

        const fullPrompt = `${systemPrompt}\n\nClient Input: ${prompt}`;

        // Use the absolute model string for the latest flash model
        const flashModel = new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await flashModel.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        if (!text) throw new Error("AI returned an empty response.");
        res.json({ response: text });
    } catch (error) {
        console.error("Gemini API Error:", error);

        let errorMsg = lang === 'ja'
            ? `Gemini接続エラー: ${error.message}`
            : `Gemini Connection Error: ${error.message}`;

        // Recognize 404 as a potential Region issue
        if (error.message.includes('404') || error.message.includes('not found')) {
            errorMsg = lang === 'ja'
                ? "【原因判明！】Renderのサーバー地域がGemini未対応の場所にあるようです。新しくRenderで『Oregon (US West)』などの地域を選んで作り直すと直る可能性が高いよ！"
                : "It seems your Render server region is not supported by Gemini. Try recreating the service in 'Oregon (US West)'.";
        } else if (error.message.includes('User location is not supported')) {
            errorMsg = lang === 'ja'
                ? "おっと！この地域からはGeminiが使えません。Renderの地域(Region)設定を確認してね。"
                : "Your server region is not supported by Gemini.";
        } else if (error.message.includes('API_KEY_INVALID')) {
            errorMsg = lang === 'ja' ? "APIキーが間違っています。設定を見直してね！" : "Invalid API Key.";
        }

        res.json({ response: errorMsg });
    }
});

// --- AI LOGGING ENDPOINT ---
// Receive chat data from frontend and store it in Render memory
app.post('/api/log-chat', (req, res) => {
    const { prompt, response } = req.body;
    if (prompt && response) {
        addChatToHistory(prompt, response, req.ip);
    }
    res.json({ success: true });
});


// --- 404 RESCUE MIDDLEWARE ---
// If a request leaks out of the proxy to the root server, redirect it back into the proxy.
app.use((req, res, next) => {
    // 既にプロキシ済みのパスや管理用パスならループ防止のためスルーする
    if (req.url.startsWith('/proxy/') || req.url.startsWith('/proxy-internal/') || req.url.startsWith('/admin') || req.url.startsWith('/api/')) {
        return next();
    }

    const referer = req.headers['referer'];
    if (referer && referer.includes('/proxy/')) {
        const parts = referer.split('/proxy/');
        const targetInfo = parts[1]; // e.g., "https://example.com/path"
        const match = targetInfo.match(/^(https?:\/\/|plain:\/\/)([^\/]+)/);

        if (match) {
            const targetOrigin = (match[1] === 'plain://' ? 'http://' : match[1]) + match[2];
            let targetUrl = targetOrigin + req.url;
            if (targetUrl.startsWith('http://')) targetUrl = targetUrl.replace('http://', 'plain://');

            console.log(`[Rescue] Redirecting leaked request: ${req.url} -> ${targetUrl}`);
            return res.redirect(`/proxy/${targetUrl}`);
        }
    }
    next();
});

app.use(unblocker);


// Root route - Basic Status Page
app.get('/', (req, res) => {
    // Fix for DuckDuckGo search bar within proxy
    // If the proxy fails to rewrite the search form, it submits to /, so we catch it here.
    if (req.query.q) {
        // Assume it's a DuckDuckGo search
        const query = req.query.q;
        const ddgUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(query) + '&kl=jp-jp&kad=ja_JP';
        return res.redirect('/proxy/' + ddgUrl);
    }

    res.send(`
        <html>
            <head>
                <title>Antigravity Server</title>
                <style>
                    body { background: #0d0d0d; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .status { text-align: center; }
                    h1 { margin-bottom: 0.5rem; }
                    p { color: #888; }
                </style>
            </head>
            <body>
                <div class="status">
                    <h1>Antigravity Proxy Server</h1>
                    <p>Status: <span style="color: #4cd137;">Online</span></p>
                    <p>Endpoint: /proxy/</p>
                </div>
            </body>
        </html>
    `);
});

// Explicitly handle 404s for non-proxy routes
app.use((req, res) => {
    res.status(404).send('404: Not Found');
});

app.listen(PORT, () => {
    console.log(`\n=== Antigravity Proxy Server ===`);
    console.log(`Listening on port ${PORT}`);
    console.log(`Proxy Prefix: /proxy/`);
});
