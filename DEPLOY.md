# Deployment Guide (無料で公開する方法)

Antigravity Proxyを24時間（または必要な時いつでも）使えるようにするには、クラウドサービスにデプロイ（アップロード）するのがおすすめです。
ここでは無料で使える **Render** と **Glitch** の手順を解説します。

## Option 1: Glitch (一番簡単・推奨)

Glitchはブラウザ上でコードを編集・実行できるサービスです。

1. [Glitch.com](https://glitch.com/) にアクセスしてログイン。
2. 右上の **"New Project"** -> **"glitch-hello-node"** を選択。
3. 以下のファイルのコードを、Glitchのエディタにコピペして上書きします。
   - `package.json` -> `server/package.json` の中身
   - `server.js` (Glitchのデフォルトファイル) -> `server/proxy.js` の中身
4. 左上の **"Share"** ボタンから **"Live Site"** のリンクをコピー。
   - 例: `https://my-antigravity-proxy.glitch.me`
5. このURLを、Antigravity Frontの `script.js` に設定します。

## Option 2: Render (安定・高速)

RenderはGitHubと連携して自動デプロイできるサービスです。

1. このプロジェクト全体を **GitHub** にプッシュします。
   - `server/` フォルダがルートになるように構成するか、Root Directory設定を使います。
2. [Render.com](https://render.com/) に登録。
3. **"New +"** -> **"Web Service"** を選択。
4. GitHubリポジトリを選択。
5. 設定：
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node proxy.js`
   - **Root Directory**: `server` (もし `server` フォルダ内に `package.json` がある場合)
6. **"Create Web Service"** をクリック。
7. デプロイ完了後、発行されたURL（例: `https://xxx.onrender.com`）をコピー。

---

## 最後に：フロントエンドの設定変更

クラウドにデプロイしたら、`docs/script.js` の以下の部分を書き換えてください：

```javascript
// docs/script.js

// const CUSTOM_PROXY_BASE = 'http://localhost:3000/proxy/'; // 古い設定
const CUSTOM_PROXY_BASE = 'https://あなたのアプリ名.glitch.me/proxy/'; // 新しいURL
```

これで、学校でもどこでも、あなたのURLからプロキシ経由でアクセスできます！
