const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
    // CORS 設定（どこからでもアクセスできるようにする）
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { prompt, lang } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(200).json({ response: "Vercelの環境変数に GEMINI_API_KEY が設定されていないよ！" });
    }

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        // Vercel(アメリカ)ならこれらが確実に動く
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemPrompt = lang === 'ja'
            ? "あなたは Antigravity Proxy のアシスタント、Gravity AIです。フレンドリーな「ゆう」の友達として助けてね。回答は簡潔に日本語で、語尾は「〜だよ」「〜だね」でお願いします。"
            : "You are the Antigravity Proxy Assistant, Gravity AI. Be friendly to 'Yuu'. Reply in English and keep it concise.";

        const fullPrompt = `${systemPrompt}\n\nClient Input: ${prompt}`;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;

        res.status(200).json({ response: response.text() });
    } catch (error) {
        console.error("Vercel Gemini Error:", error);
        res.status(200).json({ response: `Vercel経由でもエラーが出たよ: ${error.message}` });
    }
};
