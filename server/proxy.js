const express = require('express');
const Unblocker = require('unblocker');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable trust proxy to get the real client IP through Render's load balancer
app.set('trust proxy', true);

// Middleware to capture the real client IP and pass it to unblocker via a temporary header
app.use((req, res, next) => {
    if (req.url.startsWith('/proxy/')) {
        req.headers['x-client-ip'] = req.ip;
    }
    next();
});

// --- GLOBAL STATE (Serverless In-Memory) ---
let recentHistory = []; // Stores recent proxied URLs metadata
const MAX_HISTORY = 50;

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

// Initialize Unblocker
// This handles URL rewriting, cookie forwarding, script injection, etc.
const unblocker = new Unblocker({
    prefix: '/proxy/', // The base path for the proxy
    requestMiddleware: [
        (data) => {
            // 1. Hide Proxy Headers (High Anonymity)
            delete data.headers['x-forwarded-for'];
            delete data.headers['via'];
            delete data.headers['x-real-ip'];

            // 2. Spoof Referer/Origin based on the target URL
            try {
                const url = new URL(data.url);
                const origin = url.origin;
                data.headers['origin'] = origin;
                data.headers['referer'] = origin + '/';

                // Track this URL for the history feature (include IP)
                const clientIp = data.headers['x-client-ip'] || 'Unknown';
                delete data.headers['x-client-ip']; // Important: Don't send this to the target site!

                addToHistory(data.url, clientIp);
            } catch (e) {
                // Fallback
            }
        }
    ],
    responseMiddleware: [
        // 1. Strip CSP & Frame Options to allow our script to run (CRITICAL for Video & Complex Apps)
        (data) => {
            delete data.headers['content-security-policy'];
            delete data.headers['content-security-policy-report-only'];
            delete data.headers['x-frame-options'];
            delete data.headers['x-content-type-options'];

            // Allow all origins to prevent CORS issues with media blobs/fragments
            data.headers['access-control-allow-origin'] = '*';
            data.headers['access-control-allow-methods'] = 'GET, POST, OPTIONS, HEAD, PUT, DELETE';
        },
        // 2. Inject a script to force links to stay within the proxy (Nuclear Externalized)
        (data) => {
            if (data.contentType && data.contentType.includes('text/html')) {
                // Point to our internal cacheable script instead of injecting the whole thing
                const scriptTag = `<script src="/proxy-internal/sticky.js"></script>`;

                if (data.body && data.body.includes('</body>')) {
                    data.body = data.body.replace('</body>', scriptTag + '</body>');
                } else if (data.body) {
                    data.body += scriptTag;
                }
            }
        }
    ]
});



const compression = require('compression');
app.use(compression());

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
        recentHistory = recentHistory.filter(entry => entry.id !== req.query.delete);
        return res.redirect(`/admin?ps=${ps}`);
    }

    let historyHtml = recentHistory.map(entry => `
        <div style="background:#151515; border:1px solid #222; padding:18px; border-radius:12px; margin-bottom:20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid #2a2a2a; padding-bottom:8px; align-items:center;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <a href="/admin?ps=${ps}&delete=${entry.id}" style="background:#ef4444; color:#fff; text-decoration:none; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:bold; transition: background 0.2s;" onclick="return confirm('このログを削除しますか？')">削除</a>
                    <span style="color:#888; font-size:0.85rem; font-family:monospace; background:#0a0a0a; padding:2px 8px; border-radius:4px; border:1px solid #222;">IP: ${entry.ip}</span>
                </div>
                <span style="color:#818cf8; font-weight:600; font-family:'JetBrains Mono', monospace; font-size:0.85rem;">[ ${entry.time} ]</span>
            </div>
            <div style="word-break:break-all; line-height:1.4;">
                <a href="${entry.url}" target="_blank" style="color:#ddd; text-decoration:none; font-size:0.95rem; font-family:sans-serif; display:block;">${entry.url}</a>
            </div>
        </div>
    `).join('');

    if (recentHistory.length === 0) {
        historyHtml = '<p style="color:#444; text-align:center; padding:50px;">No history logs available yet.</p>';
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Antigravity Admin Log</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { background: #0d0d0d; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; }
                header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #222; padding-bottom: 15px; }
                h1 { margin: 0; font-size: 1.5rem; color: #6366f1; }
                .refresh-info { color: #444; font-size: 0.75rem; }
                a:hover { opacity: 0.8; }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>Admin Activity Log</h1>
                    <div class="refresh-info">Auto-resets on server restart</div>
                </header>
                ${historyHtml}
            </div>
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

// Mount Unblocker and let it handle the requests under /proxy/
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
