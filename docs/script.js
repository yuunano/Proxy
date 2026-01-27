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
    const PROXY_SERVER_URL = 'https://proxy-7e3b.onrender.com';
    // AI専用のサーバーURL (Cloudflare WorkersのURLをここに入れるよ！)
    const AI_SERVER_URL = 'https://ここに自分のWorkersのURLを入れてね.workers.dev';
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
            ai_welcome: "こんにちは！Antigravity Assistantです。何かお手伝いできることはありますか？",
            ai_placeholder: "質問を入力...",
            ai_err_empty: "メッセージを入力してください。"
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
            ai_welcome: "Hi, I'm Gravity AI! How can I help you today?",
            ai_placeholder: "Type a message...",
            ai_err_empty: "Please type something."
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
                    // Load changelog if that tab is selected
                    if (targetId === 'changelog-view') renderChangelog();
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

    async function handleAiMessage() {
        const text = aiInput.value.trim();
        if (!text) return;

        appendMessage('user', text);
        aiInput.value = '';

        // Add loading indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message system typing';
        typingDiv.innerHTML = '<p>...</p>';
        aiMessages.appendChild(typingDiv);
        aiMessages.scrollTop = aiMessages.scrollHeight;

        try {
            const lang = langSelect.value;
            const response = await fetch(`${AI_SERVER_URL}/api/ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text, lang: lang })
            });

            const data = await response.json();

            if (typingDiv.parentNode) aiMessages.removeChild(typingDiv);
            appendMessage('system', data.response);

            // Send log to Render server for admin panel
            logChatToServer(text, data.response);
        } catch (error) {
            console.error("AI Fetch Error:", error);
            if (typingDiv.parentNode) aiMessages.removeChild(typingDiv);
            const lang = langSelect.value;
            const errMsg = lang === 'ja' ? "サーバーと通信できませんでした。" : "Could not connect to the server.";
            appendMessage('system', errMsg);
        }
    }

    function appendMessage(sender, text) {
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
        aiMessages.appendChild(div);
        aiMessages.scrollTop = aiMessages.scrollHeight;
    }

    // --- AI Logging Helpers ---
    async function logChatToServer(prompt, response) {
        try {
            await fetch(`${PROXY_SERVER_URL}/api/log-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, response })
            });
        } catch (e) {
            console.warn('Chat logging failed:', e);
        }
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

        // Re-render changelog if active
        const activeTab = document.querySelector('.nav-tab.active');
        if (activeTab && activeTab.dataset.tab === 'changelog-view') {
            renderChangelog();
        }
    }

    let changelogDataCache = null;

    async function renderChangelog() {
        const container = document.getElementById('changelog-container');
        const lang = langSelect.value;

        if (!changelogDataCache) {
            try {
                const response = await fetch('changelog.json');
                changelogDataCache = await response.json();
            } catch (e) {
                container.innerHTML = '<p style="color:red;">Error loading changelog.</p>';
                return;
            }
        }

        container.innerHTML = changelogDataCache.map(item => `
            <div class="changelog-item">
                <div class="changelog-header">
                    <span class="version-tag">${item.version}</span>
                    <span class="changelog-date">${item.date}</span>
                </div>
                <ul class="changelog-list">
                    ${item.notes[lang].map(note => `<li>${note}</li>`).join('')}
                </ul>
            </div>
        `).join('');
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

