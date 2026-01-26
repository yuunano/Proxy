document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const goBtn = document.getElementById('go-btn');
    const input = document.getElementById('url-input');
    const quickLinks = document.querySelectorAll('.quick-link');
    const tabs = document.querySelectorAll('.nav-tab');
    const views = document.querySelectorAll('.view-section');
    const langSelect = document.getElementById('lang-select');

    // --- Constants ---
    // RenderのURL (末尾スラッシュ必須)
    const CUSTOM_PROXY_BASE = 'https://proxy-7e3b.onrender.com/proxy/';

    // --- Translations ---
    const i18n = {
        ja: {
            tab_proxy: "プロキシ",
            tab_usage: "使い方",
            tagline: "重力なんて、ただの提案にすぎない。",
            mode_custom: "カスタムサーバー (推奨)",
            mode_translate: "Google翻訳",
            mode_bing: "Bing翻訳",
            mode_wayback: "Wayback Machine",
            mode_archive: "Archive.today",
            usage_title: "使い方ガイド",
            step1_title: "モード選択",
            step1_desc: "基本は「カスタムサーバー」を選んでください。",
            step2_title: "URL入力",
            step2_desc: "見たいサイトのURL、または検索ワードを入力。",
            step3_title: "GOを押す",
            step3_desc: "プロキシ経由でサイトにアクセスします。",
            alert_title: "⚠️ 重要アドバイス",
            alert_desc: "カスタムサーバーが繋がらない場合は、すぐに「Google翻訳」や「Bing翻訳」に切り替えてください。",
            comparison_title: "モード比較",
            col_mode: "モード",
            col_feature: "特徴",
            col_interactivity: "操作性",
            row_custom_feat: "フルブラウジング、ログイン対応",
            row_trans_feat: "高速、公開サーバー利用",
            row_bing_feat: "Googleの代替として",
            row_wayback_feat: "消されたサイトも閲覧可"
        },
        en: {
            tab_proxy: "Proxy",
            tab_usage: "Usage",
            tagline: "Gravity is just a suggestion.",
            mode_custom: "Custom Server (Recommended)",
            mode_translate: "Google Translate",
            mode_bing: "Microsoft Translator",
            mode_wayback: "Wayback Machine",
            mode_archive: "Archive.today",
            usage_title: "How to Use",
            step1_title: "Select Mode",
            step1_desc: "Choose \"Custom Server\" for the best experience.",
            step2_title: "Enter URL",
            step2_desc: "Type a website address or a search keyword.",
            step3_title: "Click GO",
            step3_desc: "Access the site through the proxy.",
            alert_title: "⚠️ Important Advice",
            alert_desc: "If Custom Server stops working, switch to Google Translate or Microsoft Translator immediately.",
            comparison_title: "Mode Comparison",
            col_mode: "Mode",
            col_feature: "Feature",
            col_interactivity: "Interactive",
            row_custom_feat: "Full Browsing, Logins",
            row_trans_feat: "Fast, Public Server",
            row_bing_feat: "Alternative to Google",
            row_wayback_feat: "View Deleted Sites"
        }
    };

    // --- Event Listeners ---

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetId = tab.dataset.tab;
            views.forEach(view => {
                if (view.id === targetId) {
                    view.classList.remove('hidden');
                    view.classList.add('active');
                } else {
                    view.classList.add('hidden');
                    view.classList.remove('active');
                }
            });
        });
    });

    // Language Switching
    langSelect.addEventListener('change', () => {
        const lang = langSelect.value;
        applyLanguage(lang);
    });

    // Go Button
    goBtn.addEventListener('click', () => {
        processSubmit();
    });

    // Enter Key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            processSubmit();
        }
    });

    // Quick Links
    quickLinks.forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.dataset.url;
            if (url) {
                input.value = url;
                processSubmit();
            }
        });
    });

    // --- Functions ---

    function applyLanguage(lang) {
        const texts = i18n[lang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (texts[key]) {
                el.innerText = texts[key];
            }
        });

        // Update placeholders if needed (optional)
        if (lang === 'ja') {
            input.placeholder = "URL または 検索ワードを入力";
        } else {
            input.placeholder = "Enter URL or Search Query";
        }
    }

    function processSubmit() {
        const rawInput = input.value.trim();
        const mode = document.getElementById('proxy-mode').value;
        if (!rawInput) return;
        handleNavigation(rawInput, mode);
    }

    function handleNavigation(destinationUrl, mode) {
        let target = destinationUrl;

        // URL/Search Detection heuristic
        const isUrl = target.includes('.') && !target.includes(' ');

        if (!isUrl) {
            // DuckDuckGo通常版 (日本語設定: kl=jp-jp)
            target = 'https://duckduckgo.com/?q=' + encodeURIComponent(target) + '&kl=jp-jp&kad=ja_JP';
        } else if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = 'https://' + target;
        }

        let finalUrl = '';

        switch (mode) {
            case 'custom':
                let base = CUSTOM_PROXY_BASE;
                if (!base.endsWith('/')) base += '/';

                // Stealth Logic: "http://" という文字列がURLに含まれるとブロックされる場合がある
                // そのため、http:// を plain:// に置換して送信する（バックエンドで戻す）
                if (target.startsWith('http://')) {
                    target = target.replace('http://', 'plain://');
                }

                finalUrl = base + target;
                break;
            case 'translate':
                finalUrl = `https://translate.google.com/translate?sl=auto&tl=ja&u=${encodeURIComponent(target)}`;
                break;
            case 'bing':
                finalUrl = `http://www.translatetheweb.com/?from=&to=ja&a=${encodeURIComponent(target)}`;
                break;
            case 'wayback':
                finalUrl = `https://web.archive.org/web/${target}`;
                break;
            case 'archiveis':
                finalUrl = `https://archive.today/newest/${target}`;
                break;
            default:
                finalUrl = target;
        }

        console.log(`Navigating to: ${target} via ${mode} mode`);

        if (mode === 'custom') {
            window.location.href = finalUrl;
        } else {
            window.open(finalUrl, '_blank');
        }
    }

    // Initialize Language (Default Japanese)
    applyLanguage('ja');
});
