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

// --- GLOBAL STATE ---
let recentHistory = [];
let chatHistory = [];
const MAX_HISTORY = 50;
const MAX_CHAT_HISTORY = 100;

function addToHistory(url, ip) {
    if (!url || url.includes('sticky.js') || url.includes('favicon.ico')) return;
    const lowerUrl = url.toLowerCase().split('?')[0];
    const ignoredExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ico', '.json', '.txt', '.mp4', '.mp3'];
    if (ignoredExtensions.some(ext => lowerUrl.endsWith(ext))) return;

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
        } else {
            const res = await fetch(`${WORKERS_BASE_URL}/api/history`);
            const data = await res.json();
            if (data.recentHistory) recentHistory = data.recentHistory;
            if (data.chatHistory) chatHistory = data.chatHistory;
        }
    } catch (e) {
        console.error("Storage sync failed:", e.message);
    }
}

syncStorage('GET');
setInterval(() => syncStorage('POST'), 5 * 60 * 1000);

// Initialize Unblocker
const unblocker = new Unblocker({
    prefix: '/proxy/',
    requestMiddleware: [
        (data) => {
            // Basic Anonymity
            delete data.headers['x-forwarded-for'];
            delete data.headers['via'];
            delete data.headers['x-real-ip'];

            try {
                const url = new URL(data.url);
                const origin = url.origin;
                data.headers['origin'] = origin;
                data.headers['referer'] = origin + '/';

                const clientIp = data.headers['x-client-ip'] || 'Unknown';
                delete data.headers['x-client-ip'];
                addToHistory(data.url, clientIp);
            } catch (e) { }
        }
    ],
    responseMiddleware: [
        (data) => {
            delete data.headers['content-security-policy'];
            delete data.headers['content-security-policy-report-only'];
            delete data.headers['x-frame-options'];
            delete data.headers['x-content-type-options'];

            data.headers['access-control-allow-origin'] = '*';
            data.headers['access-control-allow-methods'] = 'GET, POST, OPTIONS, HEAD, PUT, DELETE';
            data.headers['access-control-allow-headers'] = 'Range, Content-Type, Authorization, X-Requested-With';
            data.headers['access-control-expose-headers'] = 'Content-Length, Content-Range, Accept-Ranges';

            if (data.headers['content-type'] && data.headers['content-type'].includes('video')) {
                data.headers['accept-ranges'] = 'bytes';
            }
        },
        (data) => {
            if (data.contentType && data.contentType.includes('text/html')) {
                const scriptTag = `<script src="/proxy-internal/sticky.js"></script>`;
                if (data.body && data.body.includes('<head>')) {
                    data.body = data.body.replace('<head>', '<head>' + scriptTag);
                } else if (data.body) {
                    data.body += scriptTag;
                }
            }
        }
    ]
});

// --- ROUTES ---

app.get('/proxy-internal/sticky.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`
    (function() {
        const PROXY_PREFIX = '/proxy/';
        function isProxied(url) { return url.includes(PROXY_PREFIX); }
        function toProxyUrl(url) {
            if (!url || typeof url !== 'string') return url;
            if (isProxied(url)) return url;
            if (url.startsWith(window.location.origin)) return url;
            if (url.startsWith('http')) {
                let target = url;
                if (target.startsWith('http://')) target = target.replace('http://', 'plain://');
                return window.location.origin + PROXY_PREFIX + target;
            }
            return url;
        }
        window.addEventListener('click', function(e) {
            const a = e.target.closest('a');
            if (a && a.href && !a.href.startsWith('javascript:') && !a.href.startsWith('#')) {
                const p = toProxyUrl(a.href);
                if (p !== a.href) {
                    e.preventDefault();
                    if (a.target === '_blank') window.open(p, '_blank');
                    else window.location.href = p;
                }
            }
        }, true);
        window.addEventListener('submit', function(e) {
            if (e.target.action) e.target.action = toProxyUrl(e.target.action);
        }, true);
        const oOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(m, u) {
            if (u && typeof u === 'string' && u.startsWith('http') && !isProxied(u)) arguments[1] = toProxyUrl(u);
            return oOpen.apply(this, arguments);
        };
        const oFetch = window.fetch;
        window.fetch = function(input, init) {
            if (typeof input === 'string' && input.startsWith('http') && !isProxied(input)) input = toProxyUrl(input);
            return oFetch.apply(this, arguments);
        };
        if (window.RTCPeerConnection) window.RTCPeerConnection = null;
    })();
    `);
});

app.get('/admin', (req, res) => {
    const ps = req.query.ps;
    if (ps !== 'yuu1017dy') return res.status(403).send('Forbidden');
    if (req.query.delete) {
        const ids = req.query.delete.split(',');
        recentHistory = recentHistory.filter(e => !ids.includes(e.id));
        chatHistory = chatHistory.filter(e => !ids.includes(e.id));
        return res.redirect(`/admin?ps=${ps}&view=${req.query.view}`);
    }
    if (req.query.clearall === 'true') {
        if (req.query.view === 'chat') chatHistory = [];
        else recentHistory = [];
        return res.redirect(`/admin?ps=${ps}&view=${req.query.view}`);
    }
    const view = req.query.view || 'dashboard';
    const list = view === 'chat' ? chatHistory : recentHistory;
    let content = list.map(e => `
        <div style="background:#151515;padding:10px;margin-bottom:5px;border-radius:5px;display:flex;gap:10px;">
            <input type="checkbox" class="cb" data-id="${e.id}">
            <div>
                <small style="color:#666;">${e.time}</small><br>
                ${view === 'chat' ? `<b>Q:</b> ${e.prompt}<br><b>A:</b> ${e.response}` : e.url}
            </div>
        </div>
    `).join('') || '<p>No logs.</p>';

    if (view === 'dashboard') content = `<a href="?ps=${ps}&view=proxy">🌐 Proxy Logs</a><br><a href="?ps=${ps}&view=chat">🤖 Chat Logs</a>`;

    res.send(`
        <body style="background:#0d0d0d;color:#fff;font-family:sans-serif;padding:20px;">
            <h1>Admin Panel</h1>
            <a href="?ps=${ps}">Dashboard</a> | <button onclick="del()">Delete Selected</button>
            <div style="margin-top:20px;">${content}</div>
            <script>
                function del() {
                    const ids = Array.from(document.querySelectorAll('.cb:checked')).map(c => c.dataset.id);
                    if(ids.length) window.location.href = '?ps=${ps}&view=${view}&delete=' + ids.join(',');
                }
            </script>
        </body>
    `);
});

app.post('/api/log-chat', (req, res) => {
    const { prompt, response } = req.body;
    if (prompt && response) addChatToHistory(prompt, response, req.ip);
    res.json({ success: true });
});

app.post('/api/ai', async (req, res) => {
    const { prompt, lang } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.json({ response: "API Key missing." });
    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        res.json({ response: result.response.text() });
    } catch (e) { res.json({ response: "Error: " + e.message }); }
});

app.use(unblocker);

app.get('/', (req, res) => {
    if (req.query.q) return res.redirect('/proxy/https://duckduckgo.com/?q=' + encodeURIComponent(req.query.q));
    res.send('<h1>Antigravity Proxy Online</h1>');
});

const server = app.listen(PORT, () => console.log(`Running on ${PORT}`));
server.on('upgrade', (req, socket, head) => unblocker.onUpgrade(req, socket, head));
