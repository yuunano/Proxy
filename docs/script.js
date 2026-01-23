document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('proxy-form');
    const input = document.getElementById('url-input');
    const quickLinks = document.querySelectorAll('.quick-link');

    // 実際のプロキシサーバーのエンドポイント（Custom Mode用）
    const CUSTOM_PROXY_BASE = 'https://proxy-7e3b.onrender.com/proxy';

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = input.value.trim();
        const mode = document.getElementById('proxy-mode').value;

        if (url) {
            handleNavigation(url, mode);
        }
    });

    quickLinks.forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.dataset.url;
            // Quick links default to Translate mode for ease of use
            const mode = document.getElementById('proxy-mode').value;
            if (url) {
                input.value = url;
                handleNavigation(url, mode);
            }
        });
    });

    function handleNavigation(destinationUrl, mode) {
        let target = destinationUrl;
        if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = 'https://' + target;
        }

        let finalUrl = '';

        switch (mode) {
            case 'translate':
                // Google Translate Proxy (Serverless)
                finalUrl = `https://translate.google.com/translate?sl=auto&tl=ja&u=${encodeURIComponent(target)}`;
                break;
            case 'bing':
                // Microsoft Translator (Serverless)
                // Using translatetheweb.com
                finalUrl = `http://www.translatetheweb.com/?from=&to=ja&a=${encodeURIComponent(target)}`;
                break;
            case 'wayback':
                // Wayback Machine (Serverless)
                // Use the latest snapshot
                finalUrl = `https://web.archive.org/web/${target}`;
                break;
            case 'custom':
                // Custom Server (Unblocker)
                // Unblocker expects /proxy/https://google.com
                // Remove /proxy/ from base if it's already there to ensure clean path
                let base = CUSTOM_PROXY_BASE;
                if (!base.endsWith('/')) base += '/';

                // If the user didn't type http/https, unblocker might default to http, so we stick to what we have
                finalUrl = base + target;
                break;
            default:
                finalUrl = target;
        }

        console.log(`Navigating to: ${target} via ${mode} mode`);

        if (mode === 'custom') {
            alert(`Connecting to Custom Server:\n${target}\n\n(Ensure server is running at localhost:3000)`);
            // In a real scenario: window.location.href = finalUrl;
        } else {
            // For public gateways, we can open directly
            window.open(finalUrl, '_blank');
        }
    }
});

