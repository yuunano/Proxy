const express = require('express');
const Unblocker = require('unblocker');
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Unblocker
// This handles URL rewriting, cookie forwarding, script injection, etc.
const unblocker = new Unblocker({
    prefix: '/proxy/', // The base path for the proxy
    requestMiddleware: [
        (data) => {
            // 1. Randomize User-Agent to look like a real browser (Anti-Detection)
            const userAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
            ];
            const randomAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
            data.headers['user-agent'] = randomAgent;

            // Stealth: Add Client Hints to match modern browsers
            data.headers['sec-ch-ua'] = '"Google Chrome";v="120", "Chromium";v="120", "Not?A_Brand";v="24"';
            data.headers['sec-ch-ua-mobile'] = '?0';
            data.headers['sec-ch-ua-platform'] = '"Windows"';
            data.headers['accept-language'] = 'ja,en-US;q=0.9,en;q=0.8';
            data.headers['upgrade-insecure-requests'] = '1';

            // 2. Hide Proxy Headers (High Anonymity)
            delete data.headers['x-forwarded-for'];
            delete data.headers['via'];
            delete data.headers['x-real-ip'];

            // 3. Spoof Referer/Origin for stricter sites (Experimental)
            // Some sites check if the referer matches their own domain
            // if (data.url.includes('youtube.com')) {
            //     data.headers['referer'] = 'https://www.youtube.com/';
            // }
        }
    ],
    responseMiddleware: [
        // Inject a script to force links to stay within the proxy (Enhanced "Sticky" Logic)
        (data) => {
            if (data.contentType && data.contentType.includes('text/html')) {
                const script = `
                <script>
                    (function() {
                        const PROXY_PREFIX = '/proxy/';
                        
                        function isProxied(url) {
                            return url.includes(PROXY_PREFIX);
                        }

                        function toProxyUrl(originalUrl) {
                            if (!originalUrl) return originalUrl;
                            if (isProxied(originalUrl)) return originalUrl;
                            if (originalUrl.startsWith(window.location.origin + PROXY_PREFIX)) return originalUrl;
                            
                            // Only proxy http(s) links
                            if (originalUrl.startsWith('http')) {
                                let target = originalUrl;
                                // Stealth: Obfuscate http to plain
                                if (target.startsWith('http://')) {
                                    target = target.replace('http://', 'plain://');
                                }
                                return window.location.origin + PROXY_PREFIX + target;
                            }
                            return originalUrl;
                        }

                        // --- 1. Click Interceptor (Navigation) ---
                        document.addEventListener('click', function(e) {
                            const anchor = e.target.closest('a');
                            if (anchor && anchor.href) {
                                // Don't interfere with hash links or javascript:
                                if (anchor.href.startsWith('javascript:') || anchor.href.startsWith('#')) return;
                                
                                const proxyUrl = toProxyUrl(anchor.href);
                                if (proxyUrl !== anchor.href) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    if (anchor.target === '_blank') {
                                        window.open(proxyUrl, '_blank');
                                    } else {
                                        window.location.href = proxyUrl;
                                    }
                                }
                            }
                        }, true);

                        // --- 2. Form Submission Interceptor ---
                        document.addEventListener('submit', function(e) {
                            const form = e.target;
                            if (form.action) {
                                const proxyUrl = toProxyUrl(form.action);
                                if (proxyUrl !== form.action) {
                                    // We can't easily preventDefault and submit manually for forms without breaking things,
                                    // so we rewrite the action attribute just before submit.
                                    form.action = proxyUrl;
                                }
                            }
                        }, true);

                        // --- 3. History API Patch (SPAs) ---
                        const originalPushState = history.pushState;
                        const originalReplaceState = history.replaceState;

                        function patchHistoryMethod(original) {
                            return function(state, unused, url) {
                                if (url) {
                                    // If the SPA tries to change URL to something non-proxied (absolute), fix it.
                                    // Note: Most SPAs use relative URLs, which is fine. 
                                    // But if they try to set a full URL, we must proxy it.
                                    // For now, we mainly log, as aggressively changing this might break the SPA's router.
                                    // But if it's an absolute URL starting with http, we rewrite it.
                                    if (typeof url === 'string' && url.startsWith('http') && !isProxied(url)) {
                                        arguments[2] = toProxyUrl(url);
                                    }
                                }
                                return original.apply(this, arguments);
                            };
                        }
                        history.pushState = patchHistoryMethod(originalPushState);
                        history.replaceState = patchHistoryMethod(originalReplaceState);

                        // --- 4. Window.open Patch ---
                        const originalOpen = window.open;
                        window.open = function(url, target, features) {
                            if (url) {
                                arguments[0] = toProxyUrl(url);
                            }
                            return originalOpen.apply(this, arguments);
                        };

                        // --- 5. Periodic DOM Sweeper (The "Hammer") ---
                        // Every 500ms, rewrite all visible links. This handles new content and "Right Click -> Open in New Tab"
                        setInterval(() => {
                            // Links
                            document.querySelectorAll('a').forEach(a => {
                                if (a.href && a.href.startsWith('http') && !isProxied(a.href)) {
                                    a.href = toProxyUrl(a.href);
                                }
                            });
                            // Forms
                            document.querySelectorAll('form').forEach(form => {
                                if (form.action && form.action.startsWith('http') && !isProxied(form.action)) {
                                    form.action = toProxyUrl(form.action);
                                }
                            });
                        }, 500);

                        // --- Stealth: WebRTC Disable ---
                        if (window.RTCPeerConnection) window.RTCPeerConnection = null;
                        if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = null;
                        if (window.mozRTCPeerConnection) window.mozRTCPeerConnection = null;

                    })();
                </script>
                `;
                // Append inside <body> or at the end
                if (data.body && data.body.includes('</body>')) {
                    data.body = data.body.replace('</body>', script + '</body>');
                } else if (data.body) {
                    data.body += script;
                }
            }
        }
    ]
});



// Stealh Middleware: Rewrite 'plain://' to 'http://' to bypass "http" keyword filters
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
