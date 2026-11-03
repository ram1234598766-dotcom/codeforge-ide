# SignPath Foundation onboarding and eligibility

**Status: preparation only.** CodeForge has not been approved by SignPath Foundation, and no SignPath project, signing policy, artifact configuration, or API token has been provisioned. Until those conditions are met and a signature is verified, the Windows installer is unsigned and the versioned release publisher must keep the public release gate closed.

## Eligibility checklist

The Foundation's published terms require all of the following before signing:

- An OSI-approved open-source license covering all project components, with no commercial dual licensing.
- No proprietary/non-open-source code (apart from permitted system libraries).
- An actively maintained project with the exact Windows installer form already publicly released.
- Product functionality documented on the download page.
- A public code-signing policy on the project home page and download page, with the exact Foundation wording.
- A privacy policy link, or a truthful privacy statement that matches the product's actual network behavior.
- Named author, reviewer, and signing approver roles; MFA for all team members on GitHub and SignPath.
- Only CodeForge's own source-built artifacts may be signed. Do not submit third-party software binaries for signing.
- All jobs leading to signing must use GitHub-hosted runners and SignPath's GitHub.com trusted build system.
- Each release signing request must receive manual approval in SignPath.

The app includes cloud authentication, workspace synchronization, and optional external AI-provider integrations. Do not copy a generic privacy statement into the signing policy until the actual data flows and privacy notice have been reviewed.

## Steps before applying

1. Choose and review an OSI-approved license with the rights holder. Do not add a license until all source files, contributions, and bundled components have been checked for licensing compatibility.
2. Publish a clearly identified first Windows installer release in the same form that will later be signed. If it is unsigned, label it prominently as unsigned and disclose that Windows may show a warning. Do not link it as a verified production download.
3. Publish product documentation on the download page and complete a truthful privacy policy.
4. Publish a CodeForge code-signing policy on the repository home page and download page. Once accepted, it must include the exact statement: "Free code signing provided by SignPath.io, certificate by SignPath Foundation", identify the team members responsible for authoring, reviewing, and approving signatures, and link the privacy policy.
5. Enable MFA for all GitHub and SignPath team members and require pull-request review for changes from contributors. Assign an approver who checks every signing request.
6. Apply at https://signpath.org/apply. Approval is determined by SignPath Foundation; this repository change cannot grant eligibility.

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
