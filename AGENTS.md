# Agent Operations Guide (MVP)

## Product Summary
- Goal: convert single-line, natural language tasks into normalized actions that users can start within five minutes.
- Primary value: focus on execution over explanation, remove friction in task breakdown, and learn from history to prevent future blockers.
- Target users: general consumers without domain specialization who juggle everyday tasks.
- Supported task types (auto-classified by the Intake agent): `procedure`, `housework`, `study`, `work`, `health`, `misc`.

## Delivery Sequence (MVP)
1. Authentication UX with Cognito Hosted UI (done).
-2. Intake flow (free text -> normalized JSON confirmation).
3. Planner and Coach agent orchestration.
4. Usage tracking, free quota enforcement, and Stripe upsell.
5. Amazon Bedrock optimization and evaluation loop.

## System Overview
- Next.js App Router front end backed by Cognito authentication; every `/app/*` route is guarded by middleware that redirects unauthenticated users.
- UI flows: `/` for marketing and sign-in, `/app` for the authenticated workspace with input field, verification strip, and downstream plan cards.
- Backend orchestration uses Mastra multi-agent runtime calling Amazon Bedrock through the Vercel AI SDK (`ai` + `@ai-sdk/amazon-bedrock` + `@aws-sdk/client-bedrock-runtime`).
- Observability and evaluation: Langfuse for tracing, Ragas/DeepEval for regression checks.
- Hosting baseline follows the serverless architecture documented in the README: CloudFront (TLS/HSTS) in front of S3 static assets and API Gateway -> Lambda -> DynamoDB, with Cognito for OAuth and Stripe for billing webhooks.

## Agent Roster
| Agent | Purpose | Primary Inputs | Primary Outputs |
| --- | --- | --- | --- |
| Intake | Normalize raw user text into structured `IntakeNormalized` payloads and propose urgency/type. | Natural language string, historical context, AWS Bedrock model via Mastra. | `IntakeNormalized` JSON with recommended urgency/horizon, constraints, notes. |
| Planner | Decompose normalized tasks into actionable steps with explicit Definition of Done (DoD). | Confirmed `IntakeNormalized`, recent task history, system policies. | Structured plan object (task breakdown, sequencing, DoD metadata). |
| Critic | Vet planner output for logical gaps, missing constraints, or risk of user friction. | Planner output, intake metadata, historical blockers. | Annotated feedback plus remediation suggestions for Planner. |
| Coach | Generate the "first five minutes" script and execution support artifacts. | Planner output, critic feedback, user progress context. | Coaching instructions, accountability reminders, follow-up triggers. |

### Intake Agent
- Classifies task type, recommends urgency (`high`/`mid`/`low`) and horizon (`same_day`/`weekly`/`monthly`/`long_term`).
- Extracts constraints (`time_limit`, `place`, `resources`) and optional notes, falling back to explicit user entry when confidence is low.
- Runs the confirmation step in the UI so users can override deadline or urgency before handing control to downstream agents.
- Must log prompts/responses to Langfuse without PII and respect AWS region settings (`AWS_REGION`, `BEDROCK_MODEL_ID`).

### Planner Agent
- Splits tasks into minimal actionable steps with clear DoD per step; avoid overly granular sub-steps that exceed the five-minute onboarding window.
- Aligns plan horizon with intake metadata; if the timeline is unrealistic, surface a request for clarification.
- Emits structured payload that downstream Critic and Coach can parse without additional LLM calls.

### Critic Agent
- Reviews planner output for consistency, compliance, and risk (missing prerequisites, conflicting resources, unclear outcomes).
- Uses early-return feedback: highlight blockers first, propose fixes second, defer to Planner for recalculation.
- Flags unsafe or ambiguous instructions before they reach Coach; escalate to human review when confidence is low.

### Coach Agent
- Translates approved plan segments into a concise "first five minutes" script plus nudges for continued execution.
- Provides accountability hooks (reminders, checklists) and surface-level motivation tied to original intent.
- Should reference prior task history to avoid repetitive suggestions and to reinforce successful patterns.

## Data Contract
```ts
export interface IntakeNormalized {
  intent: string;
  type: 'procedure' | 'housework' | 'study' | 'work' | 'health' | 'misc';
  deadline?: string | null;
  urgency_suggested: 'high' | 'mid' | 'low';
  urgency_final?: 'high' | 'mid' | 'low';
  horizon: 'same_day' | 'weekly' | 'monthly' | 'long_term';
  constraints: {
    time_limit?: string | null;
    place?: string | null;
    resources: string[];
  };
  notes?: string | null;
}
```
- Agents must treat `deadline` as ISO 8601 and preserve `null` when no deadline is known.
- `urgency_final` is written by the UI confirmation step; downstream agents must read it preferentially over `urgency_suggested`.
- Keep `constraints.resources` stable (no duplicate strings) to simplify downstream consumption.

## Authentication, Usage, and Billing
- Cognito Hosted UI handles OAuth sign-in; display the user state and sign-out controls in the header at all times.
- Middleware must reject unauthenticated access to `/app/*` and redirect to the hosted login page.
- Track request counts per user (`usage` table in DynamoDB); enforce free-tier quotas and trigger Stripe upsell when limits are exceeded.
- Stripe integration (webhooks and upsell flows) is part of the MVP scope - ensure agent workflows surface quota warnings early so users can upgrade without losing context.

## LLM Integration Guidelines
- Bedrock access requires enabling the target model in the AWS console; development defaults to `anthropic.claude-3-5-sonnet-20241022-v2:0` in `ap-northeast-1`.
- Use the shared wrapper (`/mastra/llm.ts`) to call Bedrock via the Vercel AI SDK; do not inline AWS SDK calls in agents.
- Wrap calls with `try/catch`, return actionable errors to the HTTP/API layer, and emit Langfuse spans capturing prompt, latency, model, and tokens.
- Keep `maxTokens` conservative (~1024) and avoid recursive retries to control cost.

## Evaluation and Observability
- Record every agent-turn in Langfuse with `userId = Cognito sub`, tagging errors and long latency for weekly review.
- Use Ragas or DeepEval suites to regression-test prompt changes before release; capture success criteria per agent (accuracy, coherence, completion rate).
- Maintain non-PII logging discipline; sanitize prompts before persistence or export.

## Security and Secrets Handling
- Enforce TLS across CloudFront, API Gateway, and Cognito; redirect all HTTP to HTTPS and enable HSTS.
- Validate Cognito JWTs with full claim checks (`iss`, `aud`, `exp`, `nbf`, `token_use = id`).
- Cookies must be `HttpOnly`, `Secure`, `SameSite=Lax`; store OAuth `state`/`code_verifier` in DynamoDB with TTL or encrypted cookies.
- Secrets policy (per README Section 14):
  - Use AWS Secrets Manager for high-sensitivity values (Stripe keys, Langfuse secret, webhook secrets) and Parameter Store for low-risk configuration.
  - Access AWS resources via IAM roles and STS; avoid long-lived access keys in Lambda or Next.js runtime.
  - GitHub Actions should authenticate with AWS via OIDC and environment scoped IAM roles; keep prod roles behind manual approval gates.
  - Protect Terraform state with S3 + KMS encryption and DynamoDB locking; avoid leaking secrets into `tfstate`.

## MCP Tooling Practices
- MCP integration is available in this repository - use it to inspect and verify behavior instead of ad-hoc scripts.
  - `serena` tools: fast codebase search, symbol lookup, and structured edits.
  - `next-devtools` runtime: interrogate the running Next.js app (routes, diagnostics) and automate browser checks.
  - `next-devtools` browser automation: load routes in a real browser to catch hydration or client-side issues.
  - `ultracite`: invoke lint/format runs (`fix`, `check`, `doctor`) through MCP so formatting stays consistent with CI.
  - `exa`: reach fresh web context and code examples directly from the CLI when exploring libraries or prompt craft changes.
  - `context7`: pull official documentation snippets (Next.js, Supabase, etc.) via MCP to ground implementation details in primary sources.
- Prefer MCP calls for diagnostics, navigation, and refactors before manual edits; document any limitations or fallback approaches in PRs.

## Development Workflow
- Format and lint with Ultracite (Biome preset): `npx ultracite fix` to apply fixes, `npx ultracite check` before committing, `npx ultracite doctor` if tooling misbehaves.
- Use TypeScript's strictness and the conventions above (explicit types, arrow functions, semantic HTML) to keep agents maintainable.
- Remove debugging statements (`console.log`, `debugger`, `alert`) from production code and add targeted tests where logic branches grow.
- When introducing new prompts or flows, update this document and Langfuse dashboards so future contributors can trace responsibilities.

## Reference Checklist
- [ ] Intake -> Planner -> Critic -> Coach pipeline satisfied.
- [ ] Cognito enforcement and quota checks in place before surfacing agent output.
- [ ] Bedrock model configuration confirmed per environment.
- [ ] Secrets resolved via AWS-managed services; no hard-coded keys.
- [ ] MCP-based verification executed (runtime diagnostics and/or code search) prior to release.
- [ ] Ultracite lint/format run and clean.
