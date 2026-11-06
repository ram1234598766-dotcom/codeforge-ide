# CodeForge

**CodeForge is an AI-powered development workspace designed to help people plan, create, run, test, and improve software across desktop, mobile, and the web.**

The long-term goal is to make software development feel like working with an experienced engineering partner: describe an idea, build a project, run it, understand failures, and keep improving it in one connected workspace.

## What CodeForge is being built to do

- **Create software from ideas.** Turn natural-language goals into project plans, application structures, interfaces, and working features.
- **Edit projects in one workspace.** Work across files with an editor, project explorer, previews, and change history.
- **Use an autonomous coding partner.** Let an AI agent inspect a project, make proposed changes, run tests and builds, explain failures, and iterate on repairs until the project works or a decision is needed from the developer.
- **Run real projects.** Provide proper execution for JavaScript and Node.js, Python, and a Linux terminal, rather than limiting development to browser-only HTML and JavaScript previews.
- **Build and troubleshoot applications.** Run test suites, inspect build output, diagnose errors, and help resolve issues before a project is shipped.
- **Keep projects connected.** Access cloud-saved projects from the browser, Windows desktop, and Android apps using the same account.
- **Work with different AI providers.** Choose CodeForge's built-in AI capabilities or connect supported model providers.
- **Support the full development journey.** Move from an early idea through implementation, testing, debugging, review, and release preparation.

## Product availability

CodeForge is being developed as three connected experiences:

- **Web:** a limited browser preview for exploring the workspace and account experience. It is not the complete IDE.
- **Windows desktop:** a dedicated desktop application is available as an unsigned preview installer. The current app is still a hosted-workspace shell; native project runtimes and autonomous test-and-repair are not included yet.
- **Android:** an Android app shell is available as an unsigned preview APK. The current app is still a hosted-workspace shell; native project runtimes and autonomous test-and-repair are not included yet. The currently published APK is unsigned and cannot be installed by Android as published; it is provided for inspection/testing only until it is signed with an app certificate.

The autonomous run-test-diagnose-repair cycle and full Node.js, Python, and Linux execution are product goals, not features claimed as complete in this release.

## Latest preview release

**[CodeForge v1.0.26 — unsigned preview](https://github.com/ram1234598766-dotcom/codeforge-ide/releases/tag/v1.0.26)**

The release includes the Windows installer and Android APK, along with build metadata and SHA-256 checksums. Both installers are unsigned:

- Windows may show an unknown-publisher or SmartScreen warning.
- Android cannot install the currently published APK because it has no package signature. It is for inspection/testing only.
- Verify the SHA-256 values in the release before using either file.

## Project direction

The goal is a dependable AI development environment that gives developers control while taking care of repetitive implementation and troubleshooting work. CodeForge should make it easier to turn ideas into working software, understand what changed, see why something failed, and decide when a result is ready to ship.

## License

Original CodeForge material is distributed under the **CodeForge Non-Commercial License** in the LICENSE file. Commercial use requires prior written permission from **Mrityunjay K**. Third-party components remain under their own licenses; see THIRD_PARTY_NOTICES.md.
