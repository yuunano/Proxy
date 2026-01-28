const express = require('express');
const Unblocker = require('unblocker');
const cors = require('cors');
const compression = require('compression');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);
app.use(cors());
app.use(compression());
app.use(express.json());

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
    const timestamp = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    recentHistory.unshift({ id: Date.now() + Math.random().toString(36).substr(2, 9), time: timestamp, ip: ip || 'Unknown', url: url });
    if (recentHistory.length > MAX_HISTORY) recentHistory.pop();
}

function addChatToHistory(prompt, response, ip) {
    const now = new Date();
    const timestamp = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    chatHistory.unshift({ id: 'chat_' + Date.now() + Math.random().toString(36).substr(2, 5), time: timestamp, ip: ip || 'Unknown', prompt: prompt, response: response });
    if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.pop();
}

const WORKERS_BASE_URL = 'https://antigravity-ai.yuunozhikkyou-sabu-1017.workers.dev';
async function syncStorage(method = 'POST') {
    try {
        if (method === 'POST') {
            await fetch(`${WORKERS_BASE_URL}/api/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recentHistory, chatHistory }) });
        } else {
            const res = await fetch(`${WORKERS_BASE_URL}/api/history`);
            const data = await res.json();
            if (data.recentHistory) recentHistory = data.recentHistory;
            if (data.chatHistory) chatHistory = data.chatHistory;
        }
    } catch (e) { }
}
syncStorage('GET');
setInterval(() => syncStorage('POST'), 5 * 60 * 1000);

// --- CORTEX: URL & PROTOCOL ENGINE ---
app.use((req, res, next) => {
    if (req.url.startsWith('/proxy/')) {
        let fixed = req.url.replace(/&amp;/g, '&').replace('plain://', 'http://');
        if (fixed.includes('google.com/url?')) {
            const match = fixed.match(/url=([^&]+)/) || fixed.match(/q=([^&]+)/);
            if (match) {
                const real = decodeURIComponent(match[1]);
                fixed = '/proxy/' + (real.startsWith('http://') ? real.replace('http://', 'plain://') : real);
            }
        }
        if (fixed !== req.url) req.url = fixed;
        req.headers['x-client-ip'] = req.ip;
    }
    next();
});

const unblocker = new Unblocker({
    prefix: '/proxy/',
    requestMiddleware: [
        (data) => {
            delete data.headers['x-forwarded-for'];
            delete data.headers['via'];
            delete data.headers['x-real-ip'];
            try {
                const url = new URL(data.url);
                data.headers['origin'] = url.origin;
                data.headers['referer'] = url.origin + '/';
                const ip = data.headers['x-client-ip'] || 'Unknown';
                delete data.headers['x-client-ip'];
                addToHistory(data.url, ip);
            } catch (e) { }
        }
    ],
    responseMiddleware: [
        (data) => {
            delete data.headers['content-security-policy'];
            delete data.headers['x-frame-options'];
            data.headers['access-control-allow-origin'] = '*';
            data.headers['access-control-expose-headers'] = 'Content-Length, Content-Range, Accept-Ranges';
        },
        (data) => {
            if (data.contentType && data.contentType.includes('text/html')) {
                const script = `<script src="/proxy-internal/sticky.js"></script>`;
                if (data.body && data.body.includes('<head>')) data.body = data.body.replace('<head>', '<head>' + script);
                else if (data.body) data.body += script;
            }
        }
    ]
});

app.get('/proxy-internal/sticky.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`
    (function() {
        const PROXY_PREFIX = '/proxy/';
        function toProxyUrl(u) {
            if (!u || typeof u !== 'string' || u.includes(PROXY_PREFIX)) return u;
            let d = u.replace(/&amp;/g, '&');
            if (d.includes('google.com/url?')) {
                const m = d.match(/url=([^&]+)/) || d.match(/q=([^&]+)/);
                if (m) d = decodeURIComponent(m[1]);
            }
            if (d.startsWith('//')) d = 'https:' + d;
            if (d.startsWith('http')) {
                if (d.startsWith('http://')) d = d.replace('http://', 'plain://');
                return window.location.origin + PROXY_PREFIX + d;
            }
            if (d.startsWith('/') && !d.startsWith('//')) {
                const parts = window.location.pathname.split(PROXY_PREFIX);
                if (parts.length > 1) {
                    const m = parts[1].match(/^(https?:\/\/|plain:\/\/)([^\/]+)/);
                    if (m) return toProxyUrl((m[1]==='plain://'?'http://':m[1]) + m[2] + d);
                }
            }
            return d;
        }
        window.addEventListener('click', e => {
            const a = e.target.closest('a');
            if (a && a.href && !a.href.startsWith('javascript:') && !a.href.startsWith('#')) {
                const p = toProxyUrl(a.href);
                if (p !== a.href) { e.preventDefault(); if (a.target === '_blank') window.open(p); else window.location.href = p; }
            }
        }, true);
        window.addEventListener('submit', e => { if (e.target.action) e.target.action = toProxyUrl(e.target.action); }, true);
        const oOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(m, u) { if (u && typeof u === 'string' && !u.includes(PROXY_PREFIX)) { arguments[1] = toProxyUrl(u); } return oOpen.apply(this, arguments); };
        const oFetch = window.fetch;
        window.fetch = function(input, init) {
            if (typeof input === 'string' && !input.includes(PROXY_PREFIX)) {
                input = toProxyUrl(input);
            } else if (input instanceof Request && !input.url.includes(PROXY_PREFIX)) {
                return oFetch(new Request(toProxyUrl(input.url), input));
            }
            return oFetch.apply(this, arguments);
        };
        if (window.RTCPeerConnection) window.RTCPeerConnection = null;
    })();
    `);
});

app.get('/admin', (req, res) => {
    const ps = req.query.ps;
    if (ps !== 'yuu1017dy') return res.status(403).send('<body style="background:#0d0d0d;color:#ff4d4d;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;"><h1>403: Forbidden</h1></body>');
    if (req.query.delete) {
        const ids = req.query.delete.split(',');
        recentHistory = recentHistory.filter(e => !ids.includes(e.id));
        chatHistory = chatHistory.filter(e => !ids.includes(e.id));
        return res.redirect('/admin?ps=' + ps + '&view=' + req.query.view);
    }
    const view = req.query.view || 'dashboard';
    const list = view === 'chat' ? chatHistory : recentHistory;

    let listHtml = '';
    if (view === 'dashboard') {
        listHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:40px;">' +
            '<a href="/admin?ps=' + ps + '&view=proxy" style="text-decoration:none;background:#1a1a1a;padding:40px;border-radius:20px;text-align:center;color:#fff;border:1px solid #333;">🌐 閲覧履歴</a>' +
            '<a href="/admin?ps=' + ps + '&view=chat" style="text-decoration:none;background:#1a1a1a;padding:40px;border-radius:20px;text-align:center;color:#fff;border:1px solid #333;">🤖 チャット履歴</a>' +
            '</div>';
    } else {
        listHtml = list.map(e => '<div style="background:#151515;border:1px solid #222;padding:15px;border-radius:12px;margin-bottom:15px;display:flex;gap:15px;align-items:flex-start;">' +
            '<input type="checkbox" class="cb" data-id="' + e.id + '" style="margin-top:5px;width:18px;height:18px;">' +
            '<div style="flex:1;"><small style="color:#666;">' + e.time + ' [' + e.ip + ']</small>' +
            '<div style="word-break:break-all;margin-top:5px;font-size:0.95rem;">' + (view === 'chat' ? '<b>Q:</b> ' + e.prompt + '<br><b style="color:#6366f1;">A:</b> ' + e.response : '<a href="' + e.url + '" style="color:#ddd;text-decoration:none;">' + e.url + '</a>') + '</div>' +
            '</div></div>').join('') || '<p style="text-align:center;color:#444;margin-top:100px;">ログはありません。</p>';
    }

    const html = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Panel</title>' +
        '<style>body{background:#0d0d0d;color:#fff;font-family:-apple-system,sans-serif;margin:0;padding:20px;}.container{max-width:900px;margin:0 auto;}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #222;padding-bottom:15px;margin-bottom:20px;}h1{margin:0;font-size:1.5rem;color:#6366f1;}.btn{padding:8px 16px;border-radius:8px;text-decoration:none;font-size:0.85rem;border:none;cursor:pointer;}.btn-del{background:#ef4444;color:#fff;}.btn-home{background:#333;color:#ccc;}</style></head>' +
        '<body><div class="container"><header><h1>Antigravity Admin</h1><a href="/" class="btn btn-home">Home</a></header>' +
        '<div style="margin-bottom:20px;">' + (view === 'dashboard' ? 'Dashboard' : '<a href="/admin?ps=' + ps + '" style="color:#6366f1;text-decoration:none;">Dashboard</a> > ' + (view === 'proxy' ? '閲覧履歴' : 'チャット履歴')) + '</div>' +
        (view !== 'dashboard' ? '<div style="margin-bottom:20px;display:flex;gap:10px;"><button onclick="del()" class="btn btn-del">選択削除</button><a href="/admin?ps=' + ps + '&view=' + view + '&clearall=true" style="color:#ef4444;font-size:0.85rem;margin-top:8px;text-decoration:none;">一括削除</a></div>' : '') +
        listHtml +
        '</div><script>function del(){const ids=Array.from(document.querySelectorAll(".cb:checked")).map(c=>c.dataset.id);if(ids.length && confirm(ids.length + "件削除しますか？")) window.location.href="?ps=' + ps + '&view=' + view + '&delete="+ids.join(",");}</script></body></html>';
    res.send(html);
});

app.post('/api/ai', async (req, res) => {
    const { prompt } = req.body;
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.json({ response: "Key missing." });
    try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        res.json({ response: result.response.text() });
    } catch (e) { res.json({ response: "Error: " + e.message }); }
});

app.post('/api/log-chat', (req, res) => {
    const { prompt, response } = req.body;
    if (prompt && response) addChatToHistory(prompt, response, req.ip);
    res.json({ success: true });
});

app.use(unblocker);

app.get('/', (req, res) => {
    if (req.query.q) return res.redirect('/proxy/https://duckduckgo.com/?q=' + encodeURIComponent(req.query.q));
    res.send('<h1>Antigravity Proxy Online</h1>');
});

const server = app.listen(PORT, () => console.log(`Active on ${PORT}`));
server.on('upgrade', (req, socket, head) => unblocker.onUpgrade(req, socket, head));
