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
                        // --- Stealth: Disable WebRTC to prevent IP leaks ---
                        if (window.RTCPeerConnection) window.RTCPeerConnection = null;
                        if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = null;
                        if (window.mozRTCPeerConnection) window.mozRTCPeerConnection = null;

                        // --- Proxy Persistence: URL Rewriter ---
                        function rewriteUrl(url) {
                            if (!url) return url;
                            if (url.startsWith(window.location.origin + '/proxy/')) return url;
                            if (url.startsWith('http')) return window.location.origin + '/proxy/' + url;
                            return url;
                        }

                        // 1. Intercept Clicks (Capture Phase - aggressively)
                        document.addEventListener('click', function(e) {
                            const anchor = e.target.closest('a');
                            if (anchor && anchor.href) {
                                // If the link is strictly absolute HTTP/HTTPS and not proxied, force it.
                                // DuckDuckGo often uses absolute URLs in results.
                                if (anchor.href.startsWith('http') && !anchor.href.includes('/proxy/')) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.location.href = '/proxy/' + anchor.href;
                                }
                            }
                        }, true);

                        // 2. MutationObserver to rewrite 'href' and 'action' on the fly
                        // This fixes things before the user even clicks.
                        const observer = new MutationObserver((mutations) => {
                            mutations.forEach((mutation) => {
                                if (mutation.type === 'childList') {
                                    mutation.addedNodes.forEach((node) => {
                                        if (node.tagName === 'A') {
                                            if (node.href && node.href.startsWith('http') && !node.href.includes('/proxy/')) {
                                                node.href = '/proxy/' + node.href;
                                            }
                                            // Handle target="_blank" which might bypass proxy
                                            if (node.target === '_blank') node.target = '_self'; 
                                        }
                                        if (node.tagName === 'FORM') {
                                            if (node.action && node.action.startsWith('http') && !node.action.includes('/proxy/')) {
                                                node.action = '/proxy/' + node.action;
                                            }
                                        }
                                        // Also check children if it's a container
                                        if (node.querySelectorAll) {
                                            node.querySelectorAll('a[href^="http"]').forEach(a => {
                                                 if (!a.href.includes('/proxy/')) a.href = '/proxy/' + a.href;
                                                 if (a.target === '_blank') a.target = '_self';
                                            });
                                        }
                                    });
                                }
                            });
                        });
                        observer.observe(document, { childList: true, subtree: true });

                        // 3. Monkey-patch window.open
                        const originalOpen = window.open;
                        window.open = function(url, target, features) {
                            if (url && !url.includes('/proxy/') && url.startsWith('http')) {
                                return originalOpen('/proxy/' + url, target, features);
                            }
                            return originalOpen(url, target, features);
                        };
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
