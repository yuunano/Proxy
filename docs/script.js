document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const goBtn = document.getElementById('go-btn');
    const input = document.getElementById('url-input');
    const quickLinks = document.querySelectorAll('.quick-link');
    const tabs = document.querySelectorAll('.nav-tab');
    const views = document.querySelectorAll('.view-section');
    const langSelect = document.getElementById('lang-select');

    // --- AI UI Elements ---
    const aiBubble = document.getElementById('ai-chat-bubble');
    const aiWindow = document.getElementById('ai-chat-window');
    const aiClose = document.getElementById('close-ai');
    const aiSend = document.getElementById('send-ai');
    const aiInput = document.getElementById('ai-input');
    const aiMessages = document.getElementById('ai-messages');

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
            v100_2: "Unblockerエンジンによる基本機能の実装",
            ai_welcome: "こんにちは、ゆう！Antigravity Assistantです。何かお手伝いできることはありますか？",
            ai_placeholder: "質問を入力...",
            ai_err_empty: "メッセージを入力してください。",
            ai_resp_default: "すみません、その質問にはまだ答えられません。使い方のタブを確認するか、URLを入力してみてください！",
            ai_resp_slow: "プロキシが遅い場合は、サーバーの場所や時間帯が影響している可能性があります。動画の場合は少し待つか、二重プロキシモードを試してね！",
            ai_resp_video: "動画（YouTubeなど）が見れない場合は「Antigravity」モードで、しばらくロードを待ってみてください。内部で特別なパッチを当てています！",
            ai_resp_how: "「プロキシ」タブで、見たいサイトのURLを入力してGOボタンを押すだけだよ！かんたんでしょ？"
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
            v100_2: "Basic Unblocker integration",
            ai_welcome: "Hi, I'm Gravity AI! How can I help you today?",
            ai_placeholder: "Type a message...",
            ai_err_empty: "Please type something.",
            ai_resp_default: "I'm not sure about that. Check the Usage tab or try entering a URL!",
            ai_resp_slow: "If it's slow, try another time or use Double Proxy mode. Server load varies!",
            ai_resp_video: "For videos, stick to 'Antigravity' mode and give it a few seconds to buffer. We have special patches for that!",
            ai_resp_how: "Just type a URL in the Proxy tab and hit GO. It's that simple!"
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

    // --- AI Chat Logic ---
    aiBubble.addEventListener('click', () => {
        aiWindow.classList.toggle('hidden');
    });

    aiClose.addEventListener('click', () => {
        aiWindow.classList.add('hidden');
    });

    aiSend.addEventListener('click', () => {
        handleAiMessage();
    });

    aiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAiMessage();
    });

    function handleAiMessage() {
        const text = aiInput.value.trim();
        if (!text) return;

        appendMessage('user', text);
        aiInput.value = '';

        // Simple Logic Response
        setTimeout(() => {
            const lang = langSelect.value;
            let response = i18n[lang].ai_resp_default;

            const lowText = text.toLowerCase();
            if (lowText.includes('遅い') || lowText.includes('slow')) response = i18n[lang].ai_resp_slow;
            else if (lowText.includes('動画') || lowText.includes('video') || lowText.includes('youtube')) response = i18n[lang].ai_resp_video;
            else if (lowText.includes('使い方') || lowText.includes('how') || lowText.includes('やり方')) response = i18n[lang].ai_resp_how;
            else if (lowText.includes('こんにちは') || lowText.includes('hi') || lowText.includes('hello')) response = i18n[lang].ai_welcome;

            appendMessage('system', response);
        }, 600);
    }

    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        msgDiv.innerHTML = `<p>${text}</p>`;
        aiMessages.appendChild(msgDiv);
        aiMessages.scrollTop = aiMessages.scrollHeight;
    }

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

        // Update placeholders
        if (lang === 'ja') {
            input.placeholder = "URL または 検索ワードを入力";
            aiInput.placeholder = i18n.ja.ai_placeholder;
        } else {
            input.placeholder = "Enter URL or Search Query";
            aiInput.placeholder = i18n.en.ai_placeholder;
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
                target = 'https://www.google.com/search?q=' + encodeURIComponent(target) + '&gbv=1&hl=ja';
            } else if (engine === 'bing') {
                target = 'https://www.bing.com/search?q=' + encodeURIComponent(target) + '&setlang=ja';
            } else if (engine === 'ddglite') {
                target = 'https://duckduckgo.com/lite/?q=' + encodeURIComponent(target) + '&kl=jp-jp';
            } else if (engine === 'startpage') {
                target = 'https://www.startpage.com/do/search?q=' + encodeURIComponent(target) + '&language=japanese';
            } else {
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
                const croxyTarget = "https://www.croxyproxy.com/";
                finalUrl = CUSTOM_PROXY_BASE + croxyTarget;
                break;
            default:
                finalUrl = target;
        }

        if (mode === 'custom' || mode === 'croxy') {
            window.location.href = finalUrl;
        } else {
            window.open(finalUrl, '_blank');
        }
    }

    // Initialize Language (Default Japanese)
    applyLanguage('ja');
});
