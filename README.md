# first5 (Auth-enabled MVP)

## 概要
- `/` : マーケティング/ログイン導線。Cognito Hosted UI にリダイレクトするサインインボタンを表示。
- `/app` : 認証済みワークスペース。Cognito の ID トークンが有効な場合のみアクセス可能です。
- `/auth/login`・`/auth/callback`・`/auth/logout` : PKCE 付き Authorization Code Flow を処理するサーバールート。
- `middleware.ts` : `/app/*` へのリクエストで ID トークンを検証し、未ログイン時は `/auth/login` にリダイレクトします。

### ディレクトリ構成（Next.js 推奨）

```
src/
  app/                # ルート/ページ/レイアウト/サーバーアクション
    auth/             # Cognito 認証フローのルートハンドラ
    app/              # 認証済みダッシュボード
    globals.css       # グローバルスタイル
    layout.tsx        # 共有レイアウト（ヘッダー等）
    page.tsx          # ランディングページ
  lib/
    auth/             # config / cookies / token 検証などのユーティリティ
public/               # 画像・favicon 等
middleware.ts         # `/app/*` を保護する認証ミドルウェア
```

## 必要な環境変数 (.env)
`.env.example` をコピーして以下を設定してください。

| 変数 | 説明 |
| --- | --- |
| `COGNITO_REGION` | 例: `ap-northeast-1` |
| `COGNITO_USER_POOL_ID` | 例: `ap-northeast-1_xxxxx` |
| `COGNITO_CLIENT_ID` | Hosted UI 用アプリクライアント ID |
| `COGNITO_DOMAIN` | `your-domain.auth.ap-northeast-1.amazoncognito.com` のような Hosted UI ドメイン |
| `COGNITO_REDIRECT_URI` | Cognito コンソールで許可したコールバック URL。ローカルでは `http://localhost:3000/auth/callback` |
| `COGNITO_LOGOUT_REDIRECT_URI` | サインアウト後に戻したい URL (例: `http://localhost:3000/`) |
| `COGNITO_SCOPES` | スペース区切りのスコープ。既定値は `openid email profile` |

> **PKCE の状態/コード検証情報は HttpOnly Cookie (`first5_pkce`) に 5 分間だけ保持されます。**

## ログインの流れ
1. `/auth/login` にアクセスすると、`state` と `code_verifier` を生成し Hosted UI へ 302 リダイレクト。
2. `/auth/callback` で `state` を検証し、トークンエンドポイントへ `code_verifier` と共に交換リクエストを送信。
3. 受け取った ID トークンを Web Crypto API で署名検証し、有効であれば `first5_id_token` Cookie (HttpOnly/SameSite=Lax/Secure) に保存。
4. `/auth/logout` はセッションクッキーを削除し、Cognito の `/logout` へリダイレクト。

## 開発手順
```bash
npm install
npm run dev
```

- `http://localhost:3000/` : サインイン導線付きのランディング。
- `http://localhost:3000/app` : 認証が必要。ミドルウェアが ID トークンを検証し、未ログイン時は `/auth/login` に戻します。

## セキュリティメモ
- ID トークンの検証は `src/lib/auth/token.ts` にて JWKS をフェッチし Web Crypto で署名確認・`iss`/`aud`/`exp`/`token_use` をチェックしています。
- すべての認証関連 Cookie は `HttpOnly`/`Secure`/`SameSite=Lax`/`path=/` で設定。
- API ルートが追加された場合は、同様に `verifyIdToken` を呼び出して保護してください。
