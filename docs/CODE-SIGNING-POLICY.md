# Code signing policy — CodeForge

**Draft for review — CodeForge is not approved or enrolled with SignPath Foundation.**

**Current status:** no SignPath Foundation approval, organization, project, signing policy, artifact configuration, API token, or Foundation certificate has been issued to CodeForge. No CodeForge Windows installer is represented as Foundation-signed. The repository now uses a custom Non-Commercial License rather than the earlier Apache-2.0 candidate. This license restricts commercial use and must not be described as an OSI-approved open-source license. The public v1.0.26 preview release is explicitly unsigned.

## Proposed provider attribution

The following provider attribution is required by SignPath Foundation and is included here as a **proposed statement to activate only after written approval and certificate issuance**:

> Free code signing provided by SignPath.io, certificate by SignPath Foundation

Until approval, do not display that sentence without the preceding draft/status context or describe any build as signed by SignPath Foundation.

## Project and artifact scope

The project source repository is:

https://github.com/ram1234598766-dotcom/codeforge-ide

The proposed signed artifact is the Windows NSIS installer `CodeForge-Setup-Windows.exe`, built from CodeForge source on a GitHub-hosted runner. The signing workflow is configured to run only for `main`, upload the exact unsigned EXE as a GitHub Actions artifact, submit that artifact to SignPath, wait for its approval/completion, retrieve the signed EXE, and verify Authenticode status and the expected certificate thumbprint.

The workflow pins the SignPath signing action and artifact-upload action to immutable commit hashes. Missing SignPath configuration leaves the installer marked unsigned. The v1.0.26 preview publisher permits explicitly unsigned binaries only because the release is labelled unsigned and independently verifies artifact provenance and SHA-256 checksums. It does not claim publisher identity or code-signing authenticity.

## Proposed signing roles — confirmation required

Git history currently identifies one primary maintainer account, `@ram1234598766-dotcom` (author name `Mrityunjay K`). This is a proposed role mapping, not yet a SignPath-approved team roster.

| SignPath role | Proposed member / process | Status |
|---|---|---|
| Authors / committers | `@ram1234598766-dotcom` | Identified from repository history; confirm account owner and legal authority. |
| Reviewers | `@ram1234598766-dotcom` reviews every contribution from non-committers before merge. | Process must be documented and enforced; no independent reviewer is currently identified in repository history. |
| Signing approver | A named maintainer must inspect every signing request and explicitly approve it in SignPath. | **Not yet designated.** Confirm whether the one-person team can assign the maintainer to this role or add a separate trusted approver. |

All members must have MFA enabled on both GitHub and SignPath before the application is submitted. MFA status has not been verified in this review.

## Source, build and review controls

- Only CodeForge's own source-built Windows installer is submitted for signing. Do not submit upstream libraries or third-party executables to the CodeForge signing project.
- Signing requests must originate from the configured GitHub.com trusted build system and the protected `main` branch.
- Every PR from a non-committer must receive maintainer review before merge.
- Each release signing request requires manual approval by the designated SignPath approver.
- The signed output is checked for a valid Authenticode signature, exact expected certificate thumbprint, and a returned SignPath signing-request ID.
- The separate release publisher independently checks both native signatures, certificate fingerprints, checksums, exact source commit and downloadable assets. If any check fails, no public production release is created.
- Any modified MPL-covered dependency source must retain its own MPL-2.0 licensing and notices. Third-party dependencies are not relicensed under CodeForge's Non-Commercial License.

## Product behavior and SignPath review questions

CodeForge's current `security` agent is a user-selected coding assistant role. Its prompt reviews source files for authentication, authorization, input validation, secret handling and data exposure. The repository does not show it scanning the user's host, ports or runtime environment. SignPath's terms permit scanning software artifacts during development/testing but prohibit runtime security tools designed to find exploitable vulnerabilities in the execution environment. Obtain written confirmation from SignPath that this source-review assistant is within its permitted exception.

The native apps load the hosted CodeForge application in a WebView. Authentication, cloud workspace data and AI prompts are processed by the hosted Cloudflare Worker, D1/KV and Supabase Auth; AI requests use Cloudflare Workers AI by default or a configured provider selected by the user. The current installer does not display a privacy policy or include installer-level options to disable networked functions. The privacy draft in `docs/PRIVACY-POLICY-DRAFT.md` records the source-observed behavior and unresolved requirements. This is a **SignPath readiness blocker** until implemented or resolved in writing with the Foundation.

The dependency snapshot also includes `caniuse-lite` under CC-BY-4.0 as a build-time Expo/Browserslist data dependency. It is not identified as a runtime app dependency. Ask SignPath whether that build-only component satisfies its OSI-approved-license requirement before applying; do not conceal it.

## Required external prerequisites

1. SignPath Foundation accepts the CodeForge application.
2. Any future license change is confirmed by the actual rights holder and approved in writing.
3. All project and build dependencies satisfy SignPath's OSI-approved-license requirement, including written resolution of the build-only CC-BY-4.0 data dependency.
4. A previously released Windows installer in the same format exists, clearly labelled unsigned if not yet signed, and product functionality is documented on the download page.
5. A final privacy policy is published; the installer displays it and provides the required options for any transfers to systems not specified by the user.
6. The author, reviewer and approver roles are assigned; MFA is verified; manual approval is configured.
7. The project home page and release/download pages link to the approved policy and display the required provider attribution only after enrollment.

## Relevant references

- SignPath Foundation eligibility and code-signing conditions: https://signpath.org/terms
- SignPath Foundation application: https://signpath.org/apply
- SignPath GitHub trusted build system: https://docs.signpath.io/trusted-build-systems/github
- CodeForge Non-Commercial License: LICENSE
- Ownership and scope review: `docs/LICENSE-OWNERSHIP-REVIEW.md`
- Privacy policy working draft: [Privacy policy (draft)](PRIVACY-POLICY-DRAFT.md)
- Third-party license snapshot: `THIRD_PARTY_NOTICES.md`
