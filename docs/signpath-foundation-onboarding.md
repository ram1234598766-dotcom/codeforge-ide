# SignPath Foundation onboarding and eligibility

**Status: preparation only.** CodeForge has not been approved by SignPath Foundation, and no SignPath project, signing policy, artifact configuration, or API token has been provisioned. Until those conditions are met and a signature is verified, the Windows installer is unsigned and the versioned release publisher must keep the public release gate closed.

## Eligibility checklist

The Foundation's published terms require all of the following before signing:

- An OSI-approved open-source license covering all project components, with no commercial dual licensing. A candidate Apache-2.0 text is in the root `LICENSE`, but it is marked draft-only and is not an effective license grant until the rights holder confirms ownership and the PR is approved and merged.
- No proprietary/non-open-source code (apart from permitted system libraries). The dependency audit found a build-time `caniuse-lite@1.0.30001820` package under CC-BY-4.0, which is not an OSI-approved software license; obtain written confirmation from SignPath that this build-only data dependency is outside the component rule or replace/remove it from the trusted build chain.
- An actively maintained project with the exact Windows installer form already publicly released.
- Product functionality documented on the download page.
- A public code-signing policy on the project home page and download page, with the exact Foundation wording.
- A privacy policy link, or a truthful privacy statement that matches the product's actual network behavior.
- Named author, reviewer, and signing approver roles; MFA for all team members on GitHub and SignPath.
- Only CodeForge's own source-built artifacts may be signed. Do not submit third-party software binaries for signing.
- All jobs leading to signing must use GitHub-hosted runners and SignPath's GitHub.com trusted build system.
- Each release signing request must receive manual approval in SignPath.
- Do not include runtime features designed to scan execution environments for exploitable vulnerabilities, expose unprotected ports, or bypass security controls. The Foundation explicitly permits analysis of software artifacts during development/testing, outside the software's execution environment.

### CodeForge-specific eligibility questions

The current CodeForge "security" agent is a user-selected coding assistant role. Its prompt asks it to review workspace source files for threat boundaries, authentication, authorization, input validation, secret handling, and data exposure. It does not instruct the agent to scan the user's host, network ports, or runtime environment. This appears closer to the Foundation's development-time source-code analysis exception, but the Foundation must confirm its interpretation before approval. Describe this feature accurately in the application and ask for written confirmation; do not rename or hide the capability to evade the policy.

The source audit is recorded in [the privacy policy working draft](PRIVACY-POLICY-DRAFT.md). The current native apps are WebView shells that load the hosted CodeForge service; the Worker uses Supabase Auth, Cloudflare D1/KV, Cloudflare Workers AI by default, and optional external model providers selected by the user. Workspace content, prompts, file context, provider configuration and agent history are processed by these services. The current installer does not display a privacy policy or offer installer-level options to disable networked functions. This is a SignPath readiness blocker unless the Foundation confirms an applicable exception or the installer and product are changed. Confirm the NSIS installer exposes a working uninstallation path. Do not claim the app is offline or that transfers are disabled unless the product actually behaves that way.

## Steps before applying

1. Review the candidate root `LICENSE` together with [the ownership and compatibility review](LICENSE-OWNERSHIP-REVIEW.md). Do not treat it as effective until the rights holder confirms all source, AI-assisted contributions and artwork can be licensed under Apache-2.0.
2. Publish a clearly identified first Windows installer release in the same form that will later be signed. If it is unsigned, label it prominently as unsigned and disclose that Windows may show a warning. Do not link it as a verified production download.
3. Publish product documentation on the download page and complete a truthful privacy policy.
4. Review [the CodeForge code-signing policy draft](CODE-SIGNING-POLICY.md) and [privacy policy working draft](PRIVACY-POLICY-DRAFT.md). Publish the final policy on the repository home page and download page only after approval and completion of its placeholders. It must include the exact statement: "Free code signing provided by SignPath.io, certificate by SignPath Foundation", identify the team members responsible for authoring, reviewing, and approving signatures, and link the final privacy policy.
5. Enable MFA for all GitHub and SignPath team members and require pull-request review for changes from contributors. Assign an approver who checks every signing request.
6. Confirm the build-only CC-BY-4.0 data dependency, AI-assisted source provenance, and hosted-WebView privacy/installer interaction with SignPath before applying at https://signpath.org/apply. Approval is determined by SignPath Foundation; this repository change cannot grant eligibility.

## SignPath project setup after approval

1. Create a SignPath project for the exact GitHub repository.
2. Add the predefined GitHub.com trusted build system to the SignPath organization and link it to the project.
3. Install the SignPath GitHub App and grant it access to this repository.
4. Configure a Windows installer artifact configuration for a single PE/EXE artifact. Enforce the product name as `CodeForge` and the product version as the version embedded in the same build.
5. Configure a release signing policy that requires manual approval for every request and verifies GitHub source/build origin. Restrict allowed branch names to `main`.
6. Obtain the organization ID, project slug, signing-policy slug, artifact-configuration slug, API token, and SHA-1 thumbprint of the Foundation-issued certificate.

## GitHub Actions configuration after approval

Create these repository settings only after approval and SignPath project setup:

| GitHub setting | Name |
| --- | --- |
| Secret | `SIGNPATH_API_TOKEN` |
| Variable | `SIGNPATH_ORGANIZATION_ID` |
| Variable | `SIGNPATH_PROJECT_SLUG` |
| Variable | `SIGNPATH_SIGNING_POLICY_SLUG` |
| Variable | `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` |
| Variable | `WINDOWS_SIGNING_CERT_THUMBPRINT` |

Do not put the API token, certificate private key, or other credentials in source control. The Windows workflow is fail-closed: absent settings produce an explicitly unsigned artifact, and the separate release publisher refuses it.

## Release procedure after approval

1. Merge the reviewed SignPath integration and eligibility documentation.
2. Run CodeForge production installers on `main`.
3. Review and approve the signing request in SignPath.
4. Confirm that the Windows signing step reports a valid signature, expected Foundation certificate thumbprint, and matching build/run metadata.
5. Confirm that Android is signed by the persistent CodeForge Android keystore.
6. Let the separate publisher verify both signatures, both checksums, exact source commit, and downloadable release assets. It publishes only when every gate passes.

## References

- https://signpath.org/terms
- https://signpath.org/apply
- https://docs.signpath.io/trusted-build-systems/github
