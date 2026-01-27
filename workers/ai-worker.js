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
                return new Response(JSON.stringify({ response: "Workersにキーが設定されてないよ！" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // APIバージョンを v1 に、モデルを gemini-1.5-flash に固定
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

            const systemPrompt = lang === 'ja'
                ? "あなたは Antigravity Proxy のアシスタント、Gravity AIです。ゆうの友達として、フレンドリーに助けてね。回答は日本語で、語尾は「〜だよ」「〜だね」でお願い！"
                : "You are the Antigravity Proxy Assistant, Gravity AI. Be friendly to 'Yuu'. Reply in English.";

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nClient Input: ${prompt}` }] }]
                }),
            });

            const data = await response.json();

            if (data.error) {
                return new Response(JSON.stringify({ response: `Google APIエラー: ${data.error.message}` }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            if (data.candidates && data.candidates[0].content) {
                const text = data.candidates[0].content.parts[0].text;
                return new Response(JSON.stringify({ response: text }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            return new Response(JSON.stringify({ response: "AIが空の回答を返しました。内容を工夫してみて！" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });

        } catch (error) {
            return new Response(JSON.stringify({ response: `システムエラー: ${error.message}` }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    },
};
