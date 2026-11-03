# Third-party notices and dependency-license snapshot

**Audit snapshot: 2026-11-03.** This is a review inventory, not a final SBOM and not a substitute for shipping the complete upstream license texts/notices with installers. Dependencies without committed lockfiles can resolve to different versions in later CI builds.

CodeForge's proposed Apache-2.0 license covers only original CodeForge material that its rights holder is authorized to license. It does not relicense the third-party projects listed below.

## Specific packages requiring prominent treatment

### caniuse-lite — CC-BY-4.0

The resolved Expo/Browserslist build chain included `caniuse-lite@1.0.30001820` (through `@expo/metro-config` → `browserslist`). Its package metadata declares CC-BY-4.0. It supplies browser compatibility data to build tooling; the audit did not identify it as a runtime library in the app bundle.

Proposed attribution for distributions that include/use this data:

> Contains browser compatibility data from caniuse.com, licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).

Upstream:
- https://github.com/browserslist/caniuse-lite
- https://github.com/Fyrd/caniuse
- https://creativecommons.org/licenses/by/4.0/

This dependency is not an OSI-approved software license. Ask SignPath Foundation whether a build-only data dependency affects its requirement that all project components use an OSI-approved license.

### lightningcss — MPL-2.0

The resolved `lightningcss@1.33.0` package and optional platform packages in the web/mobile build graphs declare MPL-2.0. The all-target Rust graph also includes MPL-2.0 crates: `cssparser`, `cssparser-macros`, `dtoa-short`, `option-ext`, and `selectors`. The Windows-target Tauri graph includes `option-ext`.

These components remain under MPL-2.0. If any MPL-covered source files are modified or distributed, follow the MPL source-code and notice obligations for those files. They are not relicensed under the CodeForge Apache-2.0 candidate.

Upstream:
- https://github.com/parcel-bundler/lightningcss
- https://www.mozilla.org/en-US/MPL/2.0/

### node-forge — BSD-3-Clause OR GPL-2.0

The Expo CLI build graph includes `node-forge@1.4.2`, declared `BSD-3-Clause OR GPL-2.0`. The BSD-3-Clause option is available. Preserve the selected upstream license and copyright notice.

Upstream:
- https://github.com/digitalbazaar/forge

### DOMPurify — MPL-2.0 OR Apache-2.0

The web dependency graph includes `dompurify@3.4.17`, which declares `MPL-2.0 OR Apache-2.0`. Apache-2.0 is an available option. Preserve the upstream notices.

Upstream:
- https://github.com/cure53/DOMPurify

## Other license families observed

The resolved web, mobile, desktop CLI, and Rust graphs also declared combinations of:

- MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, and Zlib
- BlueOak-1.0.0, Unicode-3.0, Python-2.0, Unlicense, and CC0
- Some packages expose alternative license expressions; the downstream distributor must select and comply with a permitted option and retain its notices.

These licenses remain independent of CodeForge's project license. A complete release notice generator should read the exact npm/Cargo lockfiles used by each build and include all required upstream license texts and attributions in the Windows installer and Android distribution.

## Reproducibility gaps found during this audit

- `apps/web/package-lock.json` is tracked.
- `apps/mobile/package-lock.json` is not tracked.
- `apps/desktop/package-lock.json` is not tracked.
- `apps/desktop/src-tauri/Cargo.lock` is not tracked.

The latter three lockfiles were generated temporarily to resolve and audit the dependency graphs, then removed from the working tree. Their resolved versions are not pinned in this PR. Before a production signing application or release, commit and use reproducible lockfiles (and make CI use locked install commands), then regenerate this notice inventory from those exact lockfiles.

**Status:** preliminary dependency-license inventory; final installer-level third-party notices and a machine-generated SBOM remain outstanding.
