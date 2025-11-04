# 📌 要件定義書 / 機能設計（MVP版）

---

## 0. 背景・目的
日常生活で発生する「小さいけど続かない・後回しになりがちなタスク」を
1行入力だけで Intake → 正規化 → 行動に変換する。
「続けられると生活が楽になる」状態を支援するWebアプリ。

---

## 1. 対象・範囲

### 対象ユーザー
- 一般生活者（特化なし・生活全般）

### 対象タスク（分類はIntake Agentで自動判定）
- procedure（手続き・支払い・契約）
- housework（家事全般：掃除/片付け/買い物準備等）
- study（勉強/調査/資格）
- work（仕事上のタスク）
- health（運動/睡眠/通院）
- misc（その他）

---

## 2. プロダクトの価値・差別化
- チャットではなく「行動変換」を主目的とする
- 入力→分解→“最初の5分”提示→詰まり防止→履歴学習
- 「説明」ではなく「実行」に責任を持つエージェント

---

## 3. 認証・課金

### 認証
- Cognito Hosted UI（Google等のOAuth）
- `/app/*` は middleware で認証必須
- ヘッダーに Sign in/out と状態表示

### 課金（方針）
- 無料枠あり（request countで判定）
- 上限超過時にアップセル
- Stripe連携は後工程で実装（設計済）

---

## 4. Intake（自由入力→正規化）

```
ユーザー入力：自由文 1行
↓
Intake Agent が JSON 正規化
↓
期限・緊急度のみUIで1クリック確認
↓
確定後 Planner/Coach へ渡す
```

### IntakeNormalized 形式
```ts
{
  intent: string
  type: 'procedure'|'housework'|'study'|'work'|'health'|'misc'
  deadline?: string|null
  urgency_suggested: 'high'|'mid'|'low'
  urgency_final?: 'high'|'mid'|'low'
  horizon: 'same_day'|'weekly'|'monthly'|'long_term'
  constraints: {
    time_limit?: string|null
    place?: string|null
    resources: string[]
  }
  notes?: string|null
}
```

---

## 5. Planner / Coach（MVP仕様）
- Planner：タスクを分解し DoD を付与
- Critic：整合/詰まりリスクをレビュー
- Coach：「最初の5分スクリプト」と実行補助を生成

---

## 6. UI/画面仕様（MVP）

- `/` ：トップ（説明・Sign in）
- `/app` ：メイン画面（認証必須）
  - 上部：1行入力欄
  - 中段：期限・緊急度・分類の確認バー
  - 下部：Planner出力カード表示（実装は後工程）
- ヘッダー：Sign in/out + ユーザー表示

---

## 7. セキュリティ
- TLS：**CloudFront / API Gateway / Cognito ドメイン すべて HTTPS（ACM 証明書）**
- Cookie = **HttpOnly + Secure + SameSite=Lax**
- JWT完全検証（jose） / `iss` `aud` `exp` `nbf` `token_use=id`
- middlewareで未ログイン強制転送
- HSTS（CloudFront / API GW カスタムドメイン）・TLS 1.2 以上
- Langfuseへは非PIIで送信（プロンプト/ログのPIIマスク）
- 監査：CloudWatch Logs / アクセスログ（CF / API GW）

---

## 8. 技術スタック
- Next.js (App Router)
- Cognito / OAuth
- Mastra（マルチエージェント）
- **Amazon Bedrock + Vercel AI SDK（@ai-sdk/amazon-bedrock）**
- Langfuse（トレーシング）
- Ragas/DeepEval（評価）
- Terraform（IaC）
- GitHub Actions（CI/CD）

---

## 9. スコープ（MVPで実装するところ）

認証（Cognito）＋ middleware ガード
ヘッダーに認証状態 + Sign out
Intake Agent連携（自由入力→正規化）
Intake確認UI（期限/緊急度の確定）
Planner/Coach 連携
Usage計測と無料枠ゲート
Stripe連携（アップセル）
**Bedrock 呼び出し（AI SDK 経由）**

---

## 10. ユースケース例
- 「免許更新 来週まで」→ procedure / 期限抽出 / high
- 「冷蔵庫掃除」→ housework / no deadline / low → 週末設定

---

## 11. 進行順序
1. 認証UI（完了）
2. Intake（自由入力→正規化）← 次に着手
3. Planner/Coach
4. 課金ゲート/Stripe
5. **Bedrock最適化（モデル選定/評価）**

---

## 12. AWSアーキテクチャ & TLS

### 12.1 構成（MVP, サーバレス最小）
- **Route 53**：`app.example.com`（A/AAAA）
- **AWS Certificate Manager (ACM)**：
  - `app.example.com`（CloudFront 用 / us-east-1）
  - `api.example.com`（API Gateway 用 / 稼働リージョン）
- **CloudFront**（TLS終端 / HSTS / HTTPS リダイレクト）
  - オリジン1：S3（静的アセット）
  - オリジン2：API Gateway（`/api/*` フォワード）
- **API Gateway (HTTP API)**：`/intake` `/plan` `/billing/webhook`
- **Lambda**：Mastra Orchestrator, Stripe Webhook
- **DynamoDB**：`users` / `subscriptions` / `usage` / `tasks` / `plans`
- **Cognito（User Pool）**：Hosted UI（TLSはAWS管理）
- **Langfuse**：マネージド or 自前

#### 概略図
```mermaid
flowchart LR
  U[User] -- HTTPS --> CF[CloudFront (TLS/HSTS)]
  CF -- / (static) --> S3[S3 Website]
  CF -- /api/* --> APIGW[API Gateway (HTTPS)]
  APIGW --> LBD[Lambda: Mastra Orchestrator]
  LBD --> DDB[(DynamoDB)]
  U -- OAuth/TLS --> COG[Cognito Hosted UI]
  STR[Stripe] -- Webhook/TLS --> APIGW2[API GW (Webhook)]
  APIGW2 --> LBD2[Lambda: Stripe Webhook]
  LBD2 --> DDB
```

### 12.2 TLS 方針
- CloudFront：ACM(us-east-1) 証明書 / HTTP→HTTPS リダイレクト / TLS1.2+ / HSTS
- API Gateway：カスタムドメイン + ACM（リージョン） / HTTPSのみ
- Cognito：AWS管理ドメインはTLS既定
- オリジン接続もHTTPS固定 / ACMは自動更新

### 12.3 Terraform モジュール（粒度）
- `acm/`, `route53/`, `cloudfront/`, `s3_website/`, `apigw_http/`, `lambda/`, `dynamodb/`, `cognito/`, `iam/`

---

## 13. LLM実装（Amazon Bedrock + Vercel AI SDK）← NEW

### 13.1 目的
- LLM呼び出しを **プロバイダ非依存**に近い形で統一
- Next.js（/api）と Lambda（APIGW）を **同一コード**で運用
- モデル切替（Claude/Llama 等）を **環境変数**で制御

### 13.2 依存関係
```json
{
  "dependencies": {
    "ai": "^3.2.8",
    "@ai-sdk/amazon-bedrock": "^0.2.7",
    "@aws-sdk/client-bedrock-runtime": "^3.657.0"
  }
}
```

### 13.3 環境変数
```env
AWS_REGION=ap-northeast-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
# Lambda実行ロールを使用する場合は AK/SK 不要（ローカル検証時のみ必要）
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...
```

### 13.4 LLMラッパ（`/mastra/llm.ts`）
```ts
import { generateText } from 'ai'
import { bedrock } from '@ai-sdk/amazon-bedrock'

export async function callLLM(system: string, user: string): Promise<string> {
  const modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0'
  const provider = bedrock({ region: process.env.AWS_REGION || 'ap-northeast-1' })
  const { text } = await generateText({
    model: provider(modelId),
    system,
    prompt: user,
    temperature: 0.2,
    maxTokens: 1024
  })
  return text
}
```

### 13.5 運用ベストプラクティス
- Bedrock コンソールで **対象モデルのアクセス権を有効化**
- 例外処理：`try/catch` でAPI層にエラーを返し、LangfuseにエラーSpanを記録
- コスト制御：`maxTokens` 明示・`temperature` 低め・再帰呼び出しを避ける
- モデル切替：`BEDROCK_MODEL_ID` を環境別に変更（dev/stg/prod）

### 13.6 Langfuse 連携（将来拡張）
- `callLLM` 内に Span を挿入：`userId=sub`, `prompt`, `latency`, `model`, `tokens`
- 失敗時も記録し、週次で失敗トップを改善

---
# 14. 秘密情報（鍵・パスワード）管理（Addendum / MVP設計追記）

本章は、これまでの設計書に対する追記です。**鍵・パスワード・トークン類の安全管理**と**配布/参照の運用**を定義します。対象は Stripe / Langfuse / Cognito 関連、AI/Bedrock 利用資格情報、Webhook 秘密、Cookie/PKCE、Terraform/CI/CD を含みます。

---

## 14.1 管理方針（要約）

* **原則1: サーバレス×短期クレデンシャル**

  * Lambda/Next.js(SSR/API) は **長期キーを持たない**。AWS リソースは **IAMロール**／**STSon-demand** で実行。
* **原則2: 機密は Secrets Manager、設定は Parameter Store**

  * 高機密（Stripe Secret、Webhook Secret、Langfuse Secret 等）→ **AWS Secrets Manager**（KMS で暗号化、ローテーション可）。
  * 低機密/設定値（Cognito Client ID、ドメイン等）→ **SSM Parameter Store**。
* **原則3: CI/CD は OIDC フェデレーション**

  * GitHub Actions → **OpenID Connect** で AWS に AssumeRole。**AWSアクセスキーをGitHubに保存しない**。
* **原則4: 環境分離**

  * `dev/stg/prod` ごとに **別Secrets名前空間** と **別IAMロール**。prod へのアクセスは厳格に制限。
* **原則5: 監査可能性**

  * Secrets 取得は CloudTrail で記録。失敗/異常はアラート（CW Alarms）。

---

## 14.2 シークレット一覧と保管場所

| 種別                    | 例                        | 保管先                                           | 参照主体           | 備考                                                |
| --------------------- | ------------------------ | --------------------------------------------- | -------------- | ------------------------------------------------- |
| Stripe Secret Key     | `sk_live_...`            | **Secrets Manager** (`/prod/stripe/secret`)   | Lambda(API)    | ローテーション手動/月次推奨。権限は `lambda-deploy-role` のみ読取      |
| Stripe Webhook Secret | `whsec_...`              | **Secrets Manager** (`/prod/stripe/webhook`)  | Webhook Lambda | Webhook 受信検証用。環境別に分離                              |
| Langfuse Secret       | `LF_...`                 | **Secrets Manager** (`/prod/langfuse/secret`) | Lambda/API     | トレース送信用。公開Keyは Parameter Store 可                  |
| Bedrock 認証            | (IAMロール)                 | **認証鍵なし**                                     | Lambda/API     | **ロールで実行**（長期AK/SK非使用）                            |
| Cognito Client Secret | 使わない                     | -                                             | -              | **Auth Code + PKCE** のため SPA/SSR ではクライアントシークレット不要 |
| OAuth STATE/PKCE      | `state`, `code_verifier` | **DynamoDB(TTL) or 暗号化Cookie**                | Next.js(API)   | TTL=10分程度。`HttpOnly+Secure`。サーバ保存が堅牢              |
| Cookie 暗号鍵(必要時)       | `COOKIE_KEY`             | **Secrets Manager**                           | Next.js(API)   | 暗号化/署名が必要な場合のみ                                    |
| その他設定                 | ドメイン、Pool ID 等           | **SSM Parameter Store**                       | フロント/CI        | 公知可能な設定値。IAMでread制限                               |

---

## 14.3 取得フロー（ランタイム）

* **Next.js API / Lambda** 起動時に **環境名 `ENV=prod|stg|dev`** を元に、必要な Secrets 名を解決。
* **Secrets Manager → Lambda 環境変数へ直展開しない**（メモリ上キャッシュ）。
* 取得パターン：

  1. 起動時にプリフェッチ（コールドスタート時のみ）
  2. 以降は **インメモリキャッシュ**（数分）で呼び出し回数を減らす
* 失敗時：CW Logs に出力し、**メトリクス/アラート**。

---

## 14.4 CI/CD（GitHub Actions）

* **AWS 認証**：GitHub OIDC → IAM Role（`gha-deploy-role-*`）。ポリシーは `cloudfront:CreateInvalidation`, `lambda:UpdateFunctionCode`, `ssm:GetParameter*`, `secretsmanager:GetSecretValue`, `apigateway:PATCH` 等に限定。
* **Secrets へのアクセス**：

  * dev/stg 用ロールは該当環境の Secrets のみ **read**。
  * prod ロールは手動承認付きの **環境保護ルール**（Required reviewers）。
* **GitHub Secrets には極力保存しない**。保存が必要な場合も短期・低機密のみ。

---

## 14.5 Terraform / State

* **S3 バケット + KMS 暗号化 + DynamoDB Lock** で tfstate を管理。
* **機密値は tfstate に残さない**：Secrets は `aws_secretsmanager_secret_version` に外部供給し、`sensitive = true` 変数を使用。
* 変数注入は **`terraform apply -var-file`**（Vault/1Password CLI/Doppler 等を併用可）。

---

## 14.6 ローテーションと期限

* **推奨サイクル**

  * Stripe Secret/Webhook：**90日**（イベント/漏洩時は即時）
  * Langfuse Secret：**180日**
  * Cookie鍵（使用時）：**90〜180日**
* **運用**：Secrets Manager の **Rotation Lambda** を将来導入可（まずは手動→自動化）。

---

## 14.7 ローカル開発

* `.env.local` は **開発専用・リポジトリ未コミット**（`.gitignore`）。
* 候補：**1Password/Vault/Doppler/SOPS** でチーム共有。prod 値は原則共有しない。
* Bedrock は **ローカルでも極力 IAM ロール（SSO/`aws sso login`）** を使用。長期AK/SKは避ける。

---

## 14.8 アクセス制御（IAM）

* **最小権限**：Lambda 実行ロールは必要な Secrets の **`GetSecretValue` のみ**（ARN絞り）。
* **環境毎の分離**：`arn:aws:secretsmanager:region:acct:secret:/prod/...` のみread 等。
* **CloudFront / API GW** は公開だが、**内部APIはJWT検証**と **Usage Gate** を必須。

---

## 14.9 監査・検知・インシデント

* **CloudTrail**：SecretsManager, SSM, STS, IAM 操作の記録を保持（最低 365日）。
* **メトリクス**：Secrets 取得失敗、Webhook 署名検証失敗を CW Metrics 化→アラーム（SNS）。
* **漏洩時の手順**：

  1. 影響範囲特定（CloudTrail/ログ）
  2. 対象Secretを **即ローテーション**、旧キー失効
  3. デプロイにて新値反映（Invalidation/再起動）
  4. 影響先（Stripe/Webhook送信元等）と整合確認

---

## 14.10 実装スニペット（擬似）

* **取得（Node/Lambda）**

```ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
const sm = new SecretsManagerClient({})
export async function getSecret(name: string) {
  const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: name }))
  return SecretString ? JSON.parse(SecretString) : null
}
```

* **GitHub Actions（OIDC例）**

```yaml
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/gha-deploy-role-prod
          aws-region: ap-northeast-1
      - run: |
          aws secretsmanager get-secret-value --secret-id /prod/stripe/secret
```

---

### 参考メモ

* **Cognito**：SPA/SSR は **Client Secret 不要**（Auth Code + PKCE）。
* **Bedrock**：**IAM ロール運用**が基本。キー配布は不要。
* **TLS/ACM**：証明書管理は ACM が自動更新。秘密鍵をアプリで扱わない。

# END
