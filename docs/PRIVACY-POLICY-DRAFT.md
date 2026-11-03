# CodeForge privacy policy — working draft

**Draft only — not published, legally reviewed, or ready for SignPath submission.**

This working draft is based on a source-code review performed on 2026-11-03. It is not a complete legal privacy notice. Retention periods, operational logging by hosting/model providers, data-subject request handling, and the final privacy contact still need to be confirmed.

## Product and network architecture

The Windows Tauri application and Android React Native application are native WebView shells. The current configuration loads the hosted CodeForge application at:

`https://codeforge-ide.vasudevaya.workers.dev/app`

The apps are therefore network-dependent; they do not operate as standalone offline editors. The hosted application uses a Cloudflare Worker API, Cloudflare D1 and KV, Supabase Auth, and Cloudflare Workers AI. User-configured external model providers can also be used.

## Information the application processes

The source currently shows these categories:

- **Account and authentication:** Supabase Auth user identity, email address and authentication tokens. The Worker validates bearer tokens by calling the Supabase Auth user endpoint.
- **Profile and collaboration:** profile display name and avatar URL; workspace names/descriptions; member identifiers and roles; invitation email addresses, invite-token hashes, roles, acceptance and expiry state.
- **Workspace content:** workspace file names and contents, editor state, file versions, revisions, code-change proposals and their before/after contents.
- **AI requests and history:** user task text, selected agent role, selected model provider, and up to ten workspace-file context items (up to 30,000 combined characters in the current Worker code). The Worker stores agent run task/status/result records and audit metadata in D1.
- **Provider credentials:** users may add API keys for OpenAI, DeepSeek, Groq or OpenRouter. The Worker encrypts these keys using AES-GCM before storing the ciphertext and IV in D1; it decrypts them inside the Worker when the user requests a provider call.
- **Operational/cache values:** KV is used for short-lived workspace-state/search caching and per-user AI rate-limit counters. Current code uses short TTLs for these cache/rate-limit entries.

## Services and transfers

- **Cloudflare:** hosts the Worker and static app, processes API requests, stores D1 workspace/profile/audit/agent/provider records and KV cache/rate-limit data, and provides Workers AI.
- **Supabase:** handles email/password authentication and optional GitHub/Google OAuth. The current Worker validates user access tokens with Supabase Auth.
- **Cloudflare Workers AI:** is the default model provider when a user runs an AI task without selecting a configured external provider. The task and selected file context are sent to the Workers AI model.
- **External AI providers:** when a user configures and selects OpenAI, DeepSeek, Groq or OpenRouter, the Worker forwards the task and selected context to that provider's API using the user's stored API key. The provider's own terms, privacy policy and retention practices also apply.
- **GitHub and Google:** may receive authentication requests if the user chooses one of those Supabase OAuth sign-in options.

This application does not currently provide a setting that disables all network transfers while retaining normal IDE functionality. External provider use is optional; workspace synchronization and authentication depend on the hosted service.

## User controls currently visible in the product

The source includes controls to delete workspaces/files, remove workspace members, and delete a saved external provider key. It does not show a global account deletion or data-export control, a user-configurable retention schedule, or a control to delete agent-run history and audit events. Exact database backup/log retention periods are not declared in this repository and must be obtained from the relevant service providers.

Do not promise a particular deletion deadline or retention period until those service-level settings and operational processes are verified.

## Security measures identified in source

- Worker API endpoints require a valid Supabase bearer token and enforce workspace roles for workspace operations.
- Provider API keys are encrypted using AES-GCM before storage in D1 and decrypted only by the Worker when needed.
- Some workspace/search/rate-limit values are cached in KV with short expiration TTLs.

This list is limited to mechanisms visible in the repository. It is not a security certification and does not claim end-to-end encryption or that every category of stored data is encrypted by the application.

## Choices and data minimization

- A user initiates agent runs. The default provider is Cloudflare Workers AI; external providers are used only after a user configures and selects one.
- A user can remove a saved external provider credential.
- Workspace and file deletion controls exist.
- Authentication, cloud synchronization and app loading require network access. The current native installers do not display a privacy notice during installation or offer installer options to disable the networked functionality.

## Items required before this can become a public policy

1. Confirm the legal service provider/data controller identity and provide a real privacy contact.
2. Verify Cloudflare and Supabase service regions, subprocessors, logging, backups and retention terms.
3. Confirm the exact third-party model provider terms and retention practices for each provider.
4. Decide and implement account-level access/export/deletion and agent/audit retention procedures, or accurately disclose the limitations.
5. Add a privacy notice to the native installer experience and determine how the installation process can disable networked functions or obtain SignPath Foundation's written direction on this hosted-WebView architecture.
6. Complete legal review for the jurisdictions in which CodeForge will be distributed.

**Do not publish this draft as a completed privacy policy and do not use it to claim SignPath compliance until all open items are resolved.**
