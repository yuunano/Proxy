document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('proxy-form');
    const input = document.getElementById('url-input');
    const quickLinks = document.querySelectorAll('.quick-link');

    const goBtn = document.getElementById('go-btn');

    // 実際のプロキシサーバーのエンドポイント（RenderのURL）
    // 末尾に必ず /proxy/ をつける
    const CUSTOM_PROXY_BASE = 'https://proxy-7e3b.onrender.com/proxy/';

    // ボタンクリック時の処理
    goBtn.addEventListener('click', () => {
        processSubmit();
    });

    // Enterキー入力時の処理
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // ここでも念のためブロック
            processSubmit();
        }
    });

    // クイックリンクの処理
    quickLinks.forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.dataset.url;
            if (url) {
                input.value = url;
                // 現在のモードを取得して実行
                processSubmit();
            }
        });
    });

    // 実行ロジック
    function processSubmit() {
        const rawInput = input.value.trim();
        const mode = document.getElementById('proxy-mode').value;

        if (!rawInput) return;

        handleNavigation(rawInput, mode);
    }

    function handleNavigation(destinationUrl, mode) {
        let target = destinationUrl;

        // URLか検索キーワードかの判定
        // 「スペースがある」または「ドットがない」場合は検索キーワードとみなす
        const isUrl = target.includes('.') && !target.includes(' ');

        if (!isUrl) {
            // DuckDuckGo検索に変換 (Googleはブロックされやすいため)
            target = 'https://duckduckgo.com/?q=' + encodeURIComponent(target);
        } else if (!target.startsWith('http://') && !target.startsWith('https://')) {
            // プロトコルがない場合はhttpsを付与
            target = 'https://' + target;
        }

        let finalUrl = '';

        switch (mode) {
            case 'translate':
                // Google翻訳 (サーバーレス)
                finalUrl = `https://translate.google.com/translate?sl=auto&tl=ja&u=${encodeURIComponent(target)}`;
                break;
            case 'bing':
                // Microsoft翻訳 (サーバーレス)
                finalUrl = `http://www.translatetheweb.com/?from=&to=ja&a=${encodeURIComponent(target)}`;
                break;
            case 'wayback':
                // Wayback Machine (サーバーレス)
                finalUrl = `https://web.archive.org/web/${target}`;
                break;
            case 'custom':
                // Custom Server (Render + Unblocker)
                let base = CUSTOM_PROXY_BASE;
                if (!base.endsWith('/')) base += '/';

                // Unblockerは /proxy/https://... の形を期待する
                finalUrl = base + target;
                break;
            default:
                finalUrl = target;
        }

        console.log(`Navigating to: ${target} via ${mode} mode`);

        if (mode === 'custom') {
            // カスタムサーバーの場合は現在のウィンドウで遷移（プロキシセッション維持のため）
            window.location.href = finalUrl;
        } else {
            // 公開ゲートウェイの場合は別タブで開く
            window.open(finalUrl, '_blank');
        }
    }
});
