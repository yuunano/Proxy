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
    const PROXY_SERVER_URL = 'https://proxy-7e3b.onrender.com';
    const CUSTOM_PROXY_BASE = PROXY_SERVER_URL + '/proxy/';

    // --- Translations ---
    const i18n = {
        ja: {
            tab_proxy: "プロキシ",
            tab_usage: "使い方",
            tab_changelog: "更新履歴",
            tagline: "重力なんて、ただの提案にすぎない。",
            mode_custom: "Antigravity (独自)",
            mode_croxy: "Chained Croxy (二重プロキシ)",
            mode_translate: "Google翻訳",
            mode_bing: "Bing翻訳",
            mode_wayback: "Wayback Machine",
            mode_archive: "Archive.today",
            usage_title: "使い方ガイド",
            step1_title: "モード選択",
            step1_desc: "基本は「Antigravity」を選んでください。",
            step2_title: "URL入力",
            step2_desc: "見たいサイトのURL、または検索ワードを入力。",
            step3_title: "GOを押す",
            step3_desc: "プロキシ経由でサイトにアクセスします。",
            step4_title: "互換性チェック",
            step4_desc: "サイトが開かない場合は「二重プロキシ」モードを試してください。",
            alert_title: "⚠️ 重要アドバイス",
            alert_desc: "サイトが開かない場合は「二重プロキシ」や「Google翻訳」を試してください。",
            comparison_title: "モード比較",
            col_mode: "モード",
            col_feature: "特徴",
            col_interactivity: "操作性",
            row_custom_feat: "フルブラウジング、ログイン対応",
            row_trans_feat: "高速、公開サーバー利用",
            row_croxy_feat: "外部プロキシ、高い互換性",
            row_bing_feat: "Googleの代替として",
            row_wayback_feat: "消されたサイトも閲覧可",
            changelog_title: "アップデート履歴",
            v150_1: "ロード高速化のためのデータ圧縮を導入",
            v150_2: "スクリプトの外出し（キャッシュ化）による最適化",
            v150_3: "動画ストリーミングの互換性を向上",
            v141_1: "軽量版 DuckDuckGo Lite を追加",
            v141_2: "検索結果を日本語に固定するように強化",
            v141_3: "フッターにバージョン情報を表示",
            v140_1: "検索エンジン選択機能（Google/Bing/DDG）",
            v140_2: "「二重プロキシ（Chained Croxy）」モードを追加",
            v140_3: "スマホ・モバイル端末向けのUI調整",
            v130_1: "リンク処理を強化する「Nuclear Click」戦略の導入",
            v130_2: "CSPおよびX-Frameヘッダーの自動削除",
            v130_3: "User-Agentのランダム化（検知回避）",
            v120_1: "日本語・英語の多言語対応",
            v120_2: "プレミアムなダークモードUIデザイン",
            v120_3: "人気サイトへの「クイックリンク」を追加",
            v100_1: "Antigravity Proxy 初版リリース",
            v100_2: "Unblockerエンジンによる基本機能の実装"
        },
        en: {
            tab_proxy: "Proxy",
            tab_usage: "Usage",
            tab_changelog: "Changelog",
            tagline: "Gravity is just a suggestion.",
            mode_custom: "Antigravity (Custom)",
            mode_croxy: "Chained Croxy (Double Proxy)",
            mode_translate: "Google Translate",
            mode_bing: "Microsoft Translator",
            mode_wayback: "Wayback Machine",
            mode_archive: "Archive.today",
            usage_title: "How to Use",
            step1_title: "Select Mode",
            step1_desc: "Choose \"Antigravity\" for the best experience.",
            step2_title: "Enter URL",
            step2_desc: "Type a website address or a search keyword.",
            step3_title: "Click GO",
            step3_desc: "Access the site through the proxy.",
            step4_title: "Compatibility Check",
            step4_desc: "If a site doesn't load, try the \"Double Proxy\" mode.",
            alert_title: "⚠️ Important Advice",
            alert_desc: "If Antigravity stops working, switch to Chained Croxy or Google Translate immediately.",
            comparison_title: "Mode Comparison",
            col_mode: "Mode",
            col_feature: "Feature",
            col_interactivity: "Interactive",
            row_custom_feat: "Full Browsing, Logins",
            row_trans_feat: "Fast, Public Server",
            row_croxy_feat: "External Proxy, High Compatibility",
            row_bing_feat: "Alternative to Google",
            row_wayback_feat: "View Deleted Sites",
            changelog_title: "Update History",
            v150_1: "Added data compression for faster loading",
            v150_2: "Externalized sticky scripts for browser caching",
            v150_3: "Optimized video streaming compatibility",
            v141_1: "Added DuckDuckGo Lite for maximum compatibility",
            v141_2: "Implemented localized Japanese search results",
            v141_3: "Added version badge to footer",
            v140_1: "Added Search Engine Selector (Google/Bing/DDG)",
            v140_2: "Added \"Chained Croxy\" (Double Proxy) mode",
            v140_3: "Improved mobile UI responsiveness",
            v130_1: "Implemented \"Nuclear Click\" strategy",
            v130_2: "Automatic CSP and X-Frame header stripping",
            v130_3: "Randomized User-Agent (Anti-Detection)",
            v120_1: "Multi-language support (JP/EN)",
            v120_2: "Dark mode premium UI design",
            v120_3: "Added \"Quick Links\" for popular sites",
            v100_1: "Initial release of Antigravity Proxy",
            v100_2: "Basic Unblocker integration"
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
            // Get selected search engine
            const engine = document.querySelector('input[name="search-engine"]:checked').value;

            if (engine === 'google') {
                // Classic Google (gbv=1) + Japanese (hl=ja)
                target = 'https://www.google.com/search?q=' + encodeURIComponent(target) + '&gbv=1&hl=ja';
            } else if (engine === 'bing') {
                // Bing + Japanese (setlang=ja)
                target = 'https://www.bing.com/search?q=' + encodeURIComponent(target) + '&setlang=ja';
            } else if (engine === 'ddglite') {
                // DuckDuckGo Lite + Japanese (kl=jp-jp)
                target = 'https://duckduckgo.com/lite/?q=' + encodeURIComponent(target) + '&kl=jp-jp';
            } else if (engine === 'startpage') {
                // Startpage + Japanese (language=japanese)
                target = 'https://www.startpage.com/do/search?q=' + encodeURIComponent(target) + '&language=japanese';
            } else {
                // DuckDuckGo Standard + Japanese (kl=jp-jp)
                target = 'https://duckduckgo.com/?q=' + encodeURIComponent(target) + '&kl=jp-jp&kad=ja_JP';
            }
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
            case 'croxy':
                // Chain: My Proxy -> CroxyProxy
                const croxyTarget = "https://www.croxyproxy.com/";
                finalUrl = CUSTOM_PROXY_BASE + croxyTarget;
                break;
            default:
                finalUrl = target;
        }

        console.log(`Navigating to: ${target} via ${mode} mode`);

        if (mode === 'custom' || mode === 'croxy') {
            window.location.href = finalUrl;
        } else {
            window.open(finalUrl, '_blank');
        }
    }

    // Initialize Language (Default Japanese)
    applyLanguage('ja');
});
