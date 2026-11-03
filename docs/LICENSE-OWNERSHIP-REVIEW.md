# Apache-2.0 license and ownership review

**Draft — not a legal opinion or an effective license grant.**

This review accompanies the candidate root `LICENSE` file. The file contains the unmodified official Apache License 2.0 text. Its candidate-only status is recorded here and in the README; it must not be treated as an effective grant until the rights holder confirms the items below and the proposed change is approved and merged.

## Proposed scope

The proposed Apache-2.0 grant is intended to cover only original CodeForge-authored source code, build scripts, and project documentation for which the licensor has the necessary rights. It does **not** relicense or replace any third-party package, dataset, font, image, logo, service, or upstream source license.

Apache-2.0 does not grant rights to use a licensor's trademarks, service marks, or product names. The CodeForge name and logo should therefore be treated separately from the source-code license.

## Repository provenance review

The repository history is dominated by commits attributed to the GitHub account `ram1234598766-dotcom` / author name `Mrityunjay K`. The current Worker implementation in `apps/web/functions/index.ts` is attributed line-by-line in Git blame to that account. No source-file SPDX headers, third-party copyright headers, vendored source directory, or Git submodules were found in the tracked tree.

Nine historical commits include `Co-authored-by: arena-agent`. The review traced those changes mainly to early Worker configuration and initial Worker function files. The early function stubs have since been removed or replaced; current Worker implementation lines are attributed to the repository maintainer. Some short, declarative configuration lines remain in `wrangler.toml` (entry-point and resource-binding declarations). Git author/co-author metadata is useful provenance evidence, but does not by itself prove ownership or license rights.

The account name identifies the contributor recorded in Git history; it does not establish whether an employer, client, contractor agreement, or another rights holder owns any contribution.

### AI-assisted contributions

The co-author string `arena-agent <297053741+arena-agent@users.noreply.github.com>` appears in nine historical commit messages. The GitHub username and commit trailers do not, by themselves, identify the coding tool, model provider, service terms, prompt, output provenance, or the legal person/entity responsible for the contribution. This review has not established that the account is related to Arena Intelligence, Inc. or to the Arena.ai comparison service. Do not apply Arena.ai's consumer Terms of Use to these commits without first establishing that the same service was used.

Before relying on any retained machine-generated contribution under Apache-2.0, identify the tool/service used at the time and review the terms in force on those dates, including any limits on redistribution or licensing. The current code history suggests the surviving co-authored content is limited mainly to early infrastructure configuration; historical function stubs were later removed or superseded, and current Worker implementation lines are attributed to the repository maintainer. The remaining declarative configuration lines should still be checked against the actual agent/service terms.

A current public username lookup is not sufficient evidence of authorship or copyright ownership. If the actual service used was Arena.ai, its current Terms of Use contain output ownership language but also a restriction on licensing, selling, transferring or distributing Output; that is a reason to check the exact applicable product terms and dates, not evidence that those terms governed this repository's historical contributions.

References for further investigation:
- https://github.com/297053741
- https://help.arena.ai/articles/5629909088-terms-of-use (only if that is confirmed as the actual service used; not established by the GitHub co-author string).

## Artwork and brand assets

The four tracked CodeForge icon/logo assets were added in commits attributed to `Mrityunjay K`:

- `apps/desktop/src-tauri/icons/icon.png`
- `apps/mobile/assets/adaptive-icon.png`
- `apps/mobile/assets/icon.png`
- `apps/web/public/codeforge-icon.png`

The Git history establishes who added the files, not where the underlying artwork came from. Before merging the Apache license, confirm that each asset was created by the rights holder or is covered by a license that permits this public distribution. Also confirm that the CodeForge name and logo do not misuse another party's trademark. The Apache license does not grant trademark rights.

## Dependency and component audit

The review resolved temporary npm and Cargo dependency graphs on 2026-11-03 with package install scripts disabled. The temporary `apps/mobile/package-lock.json`, `apps/desktop/package-lock.json`, and `apps/desktop/src-tauri/Cargo.lock` files were removed after the audit and are **not** committed. Therefore the mobile and desktop dependency snapshot is not pinned or guaranteed to match future CI builds. Only `apps/web/package-lock.json` is currently tracked.

Notable declared licenses in the resolved graphs:

| Component | Resolved version / graph | Declared license | Review note |
|---|---|---|---|
| DOMPurify | 3.4.17, web | MPL-2.0 OR Apache-2.0 | Apache-2.0 is an available licensing option; retain upstream notices. |
| lightningcss | 1.33.0, web/mobile build graphs | MPL-2.0 | Keep its files under MPL-2.0; do not relabel them Apache-2.0. |
| option-ext | 0.2.0, Windows Tauri graph | MPL-2.0 | Keep upstream MPL-2.0 terms and notices. |
| node-forge | 1.4.2, Expo CLI build graph | BSD-3-Clause OR GPL-2.0 | The permissive BSD-3-Clause option is available; preserve its notice. |
| caniuse-lite | 1.0.30001820, Expo/Browserslist build graph | CC-BY-4.0 | Build-time browser compatibility data, not identified as a runtime app dependency. Attribution is required; this is not an OSI-approved software license. Ask SignPath whether this build-only data dependency affects its “all components” condition. |

The all-target Rust metadata also identified MPL-2.0 crates `cssparser`, `cssparser-macros`, `dtoa-short`, and `selectors` in addition to `option-ext`. Other resolved packages declare MIT, Apache-2.0, ISC, BSD, 0BSD, BlueOak-1.0.0, Python-2.0, Unicode-3.0, Zlib, CC0, or Unlicense terms, sometimes as alternatives. The lockfile snapshot reported no package with a missing license expression, but this is not a full legal review of every upstream notice.

The SignPath Foundation's current terms require an OSI-approved license for all project components. The build-only `caniuse-lite` CC-BY-4.0 dependency is therefore an eligibility question to raise with SignPath before applying; do not hide it or assume it is exempt. A complete, reproducible SBOM and bundled third-party notices should be generated from the exact lockfiles used for a release.

References:
- https://github.com/browserslist/caniuse-lite/blob/main/package.json
- https://github.com/Fyrd/caniuse
- https://www.mozilla.org/en-US/MPL/2.0/FAQ/
- https://opensource.org/licenses

## SignPath-specific ownership and compliance items

SignPath Foundation requires the team signing the binaries to be responsible for development and maintenance and to own the source repository. Its terms also require an OSI-approved license for all components, a previously released installer in the same form, product documentation, verified contributor roles/MFA, a public signing policy, and manual approval of each signing request.

Before applying, confirm:

1. The individual or legal entity that owns the CodeForge source and is authorized to grant Apache-2.0 rights.
2. Whether an employer, client, contractor, contributor, or other agreement claims any part of the code or artwork.
3. That the four icon/logo assets are original or separately cleared.
4. Identify the coding tool/service behind the `arena-agent` co-author commits and verify the applicable terms on the dates used; remove or replace any retained contribution that cannot be cleared for public redistribution and Apache-2.0 licensing.
5. How SignPath treats the build-only CC-BY-4.0 `caniuse-lite` package; if it is ineligible, replace/remove it from the trusted build chain or choose a different distribution route.
6. The exact copyright holder name to use in source notices (currently proposed as `Mrityunjay K`, based on Git author metadata, not independently verified).

**Do not merge the candidate license until these confirmations are complete.** The candidate is for review only.
