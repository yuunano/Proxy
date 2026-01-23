document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('proxy-form');
    const input = document.getElementById('url-input');
    const quickLinks = document.querySelectorAll('.quick-link');

    // 実際のプロキシサーバーのエンドポイント（Custom Mode用）
    // 実際のプロキシサーバーのエンドポイント（RenderのURL）
    const CUSTOM_PROXY_BASE = 'https://proxy-7e3b.onrender.com/proxy/';

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
        let target = destinationUrl.trim();

        // Simple heuristic to check if it's a URL or a Search 
