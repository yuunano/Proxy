export default {
    async fetch(request, env) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            const { prompt, lang } = await request.json();
            const apiKey = env.GEMINI_API_KEY;

            if (!apiKey) {
                return new Response(JSON.stringify({ response: "Workersの環境変数に GEMINI_API_KEY を設定してね！" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // APIへのリクエスト（最新の1.5-flashを使用）
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

            const systemPrompt = lang === 'ja'
                ? "あなたは Antigravity Proxy のアシスタント、Gravity AIです。ゆうの友達として、フレンドリーに助けてね。回答は簡潔に日本語でお願いします。"
                : "You are the Antigravity Proxy Assistant, Gravity AI. Be friendly to 'Yuu'. Reply in English and keep it concise.";

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nClient Input: ${prompt}` }] }]
                }),
            });

            const data = await response.json();

            // エラーチェックを強化
            if (data.error) {
                return new Response(JSON.stringify({ response: `Google APIエラー: ${data.error.message} (${data.error.status})` }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            if (!data.candidates || data.candidates.length === 0) {
                // 安全フィルターでブロックされた場合など
                const reason = data.promptFeedback?.blockReason || "回答が生成されませんでした（安全フィルター等）";
                return new Response(JSON.stringify({ response: `AIが回答を控えました。理由: ${reason}` }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const text = data.candidates[0].content.parts[0].text;

            return new Response(JSON.stringify({ response: text }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });

        } catch (error) {
            return new Response(JSON.stringify({ response: `Workersシステムエラー: ${error.message}` }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    },
};
