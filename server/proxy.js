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
    } catch (e) { console.error("Sync failed:", e.message); }
}
syncStorage('GET');
setInterval(() => syncStorage('POST'), 5 * 60 * 1000);

// Initialize Unblocker with minimal settings
const unblocker = new Unblocker({
    prefix: '/proxy/',
    requestMiddleware: [
        (data) => {
            // Remove proxy-leaking headers
            delete data.headers['x-forwarded-for'];
            delete data.headers['via'];
            delete data.headers['x-real-ip'];

            // Log IP and URL
            const clientIp = data.headers['x-client-ip'] || 'Unknown';
            delete data.headers['x-client-ip'];
            addToHistory(data.url, clientIp);
        }
    ],
    responseMiddleware: [
        (data) => {
            // Strip security headers so our scripts work
            delete data.headers['content-security-policy'];
            delete data.headers['x-frame-options'];

            // Allow media streaming
            data.headers['access-control-allow-origin'] = '*';
            data.headers['access-control-expose-headers'] = 'Content-Length, Content-Range, Accept-Ranges';
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

// Middleware to capture IP
app.use((req, res, next) => {
    if (req.url.startsWith('/proxy/')) req.headers['x-client-ip'] = req.ip;
    next();
});

// --- INTERNAL ROUTES ---

app.get('/proxy-internal/sticky.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`
    (function() {
        const PROXY_PREFIX = '/proxy/';
        function toProxyUrl(url) {
            if (!url || typeof url !== 'string') return url;
            // Clean HTML Entities like &amp; (CRITICAL for 400 errors)
            let d = url.replace(/&amp;/g, '&');
            if (d.includes(PROXY_PREFIX)) return d;
            if (d.startsWith('http')) {
                let target = d;
                if (target.startsWith('http://')) target = target.replace('http://', 'plain://');
                return window.location.origin + PROXY_PREFIX + target;
            }
            // Handle relative paths
            if (d.startsWith('/') && !d.startsWith('//')) {
                const parts = window.location.pathname.split(PROXY_PREFIX);
                if (parts.length > 1) {
                    const match = parts[1].match(/^(https?:\/\/|plain:\/\/)([^\/]+)/);
                    if (match) return toProxyUrl((match[1] === 'plain://' ? 'http://' : match[1]) + match[2] + d);
                }
            }
            return d;
        }
        window.addEventListener('click', function(e) {
            const a = e.target.closest('a');
            if (a && a.href && !a.href.startsWith('javascript:') && !a.href.startsWith('#')) {
                const p = toProxyUrl(a.href);
                if (p !== a.href) { e.preventDefault(); if (a.target === '_blank') window.open(p, '_blank'); else window.location.href = p; }
            }
        }, true);
        window.addEventListener('submit', function(e) { if (e.target.action) e.target.action = toProxyUrl(e.target.action); }, true);
        const oOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(m, u) { if (u && typeof u === 'string' && !u.includes(PROXY_PREFIX)) arguments[1] = toProxyUrl(u); return oOpen.apply(this, arguments); };
        const oFetch = window.fetch;
        window.fetch = function(input, init) { if (typeof input === 'string' && !input.includes(PROXY_PREFIX)) input = toProxyUrl(input); return oFetch.apply(this, arguments); };
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
    const view = req.query.view || 'dashboard';
    if (view === 'dashboard') return res.send(`<body style="background:#0d0d0d;color:#fff;"><a href="?ps=${ps}&view=proxy">🌐 Proxy Logs</a><br><a href="?ps=${ps}&view=chat">🤖 Chat Logs</a></body>`);
    const list = view === 'chat' ? chatHistory : recentHistory;
    res.send(`<body style="background:#0d0d0d;color:#fff;"><h1>Admin [${view}]</h1>` + list.map(e => `<div><input type="checkbox" class="cb" data-id="${e.id}"> ${e.time}: ${view === 'chat' ? 'Prompt: ' + e.prompt : e.url}</div>`).join('') + `<script>function del(){const ids=Array.from(document.querySelectorAll('.cb:checked')).map(c=>c.dataset.id);if(ids.length)window.location.href='?ps=${ps}&view=${view}&delete='+ids.join(',');}</script><button onclick="del()">Delete</button></body>`);
});

app.post('/api/ai', async (req, res) => {
    const { prompt } = req.body;
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.json({ response: "API Key missing." });
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

app.listen(PORT, () => console.log(`Active on ${PORT}`));
