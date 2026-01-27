const express = require('express');
const Unblocker = require('unblocker');
const app = express();
const PORT = process.env.PORT || 3000;

// --- GLOBAL STATE (Serverless In-Memory) ---
let recentHistory = []; // Stores recent proxied URLs metadata
const MAX_HISTORY = 50;

function addToHistory(url, ip) {
    if (!url || url.includes('sticky.js') || url.includes('favicon.ico')) return;

    // Format timestamp (JST/Local roughly)
    const now = new Date();
    const timestamp = now.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const logEntry = {
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
            // This is functional (required by many sites) rather than just stealthy.
            try {
                const url = new URL(data.url);
                const origin = url.origin;
                data.headers['origin'] = origin;
                data.headers['referer'] = origin + '/';

                // Track this URL for the history feature (include IP)
                // Render/Proxies store client IP in x-forwarded-for header
                const clientIp = data.headers['x-forwarded-for'] ? data.headers['x-forwarded-for'].split(',')[0] : '127.0.0.1';
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

// API: Get recent history (Password Protected & Pretty HTML)
app.get('/api/history', (req, res) => {
    const pw = req.query.pw;
    if (pw !== 'yuu1017dy') {
        return res.status(403).send('<html><body style="background:#0d0d0d;color:#ff4d4d;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;"><h1>403: Forbidden - Invalid Password</h1></body></html>');
    }

    let historyHtml = recentHistory.map(entry => `
        <div style="background:#151515; border:1px solid #222; padding:15px; border-radius:10px; margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #333; padding-bottom:5px;">
                <span style="color:#6366f1; font-weight:bold; font-family:monospace;">${entry.time}</span>
                <span style="color:#666; font-size:0.8rem; font-family:monospace;">IP: ${entry.ip}</span>
            </div>
            <div style="word-break:break-all;">
                <a href="${entry.url}" target="_blank" style="color:#aaa; text-decoration:none; font-size:0.9rem;">${entry.url}</a>
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
                h1 { border-left: 4px solid #6366f1; padding-left: 15px; margin-bottom: 30px; font-size: 1.5rem; }
                .refresh-info { color: #666; font-size: 0.8rem; margin-bottom: 20px; text-align: right; }
                a:hover { color: #6366f1 !important; text-decoration: underline !important; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Proxy Activity Log</h1>
                <div class="refresh-info">Auto-resets on server restart | Password Protected</div>
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
