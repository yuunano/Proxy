export default {
    async fetch(request, env) {
        // CORS設定
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
        }

        try {
            const { prompt, lang } = await request.json();
            const apiKey = env.GEMINI_API_KEY;

            if (!apiKey) {
                return new Response(JSON.stringify({ response: "Workersに GEMINI_API_KEY が設定されてないよ！" }), {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

            const systemPrompt = lang === 'ja'
                ? "あなたは Antigravity Proxy のアシスタント、Gravity AIです。ゆうの友達として、フレンドリーに助けてね。回答は簡潔に日本語で、語尾は「〜だよ」「〜だね」でお願い！"
                : "You are the Antigravity Proxy Assistant, Gravity AI. Be friendly to 'Yuu'. Reply in English and keep it concise.";

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nClient Input: ${prompt}` }] }]
                }),
            });

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;

            return new Response(JSON.stringify({ response: text }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        } catch (error) {
            return new Response(JSON.stringify({ response: `Workersエラー: ${error.message}` }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    },
};
