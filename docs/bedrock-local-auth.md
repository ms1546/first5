# Bedrock ローカル認証ガイド

短命な AWS 資格情報で Amazon Bedrock を呼び出すための手順です。`.env` は `.gitignore` 済みなので、ここに値を入れてもリポジトリへはコミットされません。

## 1. 既存トークンをクリア
`.env` 内の `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` をいったん空にするか、別ファイルへ退避します。

## 2. 元になるプロファイルを確認
- **IAM ユーザーの長期キー** がある場合 → `aws configure --profile first5` などで AccessKey/Secret が保存されているか確認。
- **IAM ロール or AWS SSO** の場合 → `aws configure sso` でサインインしておきます。

## 3. STS で短命キーを発行
- IAM ユーザーの長期キーを使う場合:
  ```bash
  aws sts get-session-token --duration-seconds 43200 --profile first5
  ```
- IAM ロールを使う場合:
  ```bash
  aws sts assume-role \
    --role-arn arn:aws:iam::<ACCOUNT_ID>:role/<BedrockRole> \
    --role-session-name first5-local
  ```
どちらも `Credentials.AccessKeyId / SecretAccessKey / SessionToken / Expiration` が返るので控えておきます。

## 4. `.env` を更新
`.env.example` を `.env` にコピーし、以下のように貼り付けます（引用符や余計なスペースは不要）。
```env
AWS_REGION=ap-northeast-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_MAX_OUTPUT_TOKENS=1024
AWS_ACCESS_KEY_ID=ASIA...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...
```

## 5. 認証を検証
```bash
set -a
source .env
aws sts get-caller-identity
```
エラーになったら資格情報を再取得し、リージョン指定 (`AWS_REGION`) が Bedrock を有効化したリージョンと一致しているか確認します。

## 6. 開発サーバーを再起動
`npm run dev` を一度停止→再起動して `.env` を再読込させた後、`/app` からワークフローを実行してください。

## セキュリティチェックリスト
- `.env` は Git に含まれていないことを `git status --short | rg "^.env"` で確認。
- セッションの有効期限 (`Expiration`) が切れる前に更新。403 `The security token included in the request is invalid` が出たら新しいトークンを取得。
- 本番用キーは AWS Secrets Manager / IAM ロールで供給し、ローカル `.env` には **開発用の短命キーのみ** を入れる。
