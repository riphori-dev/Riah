# Contributing to Riah

Riah is a pre-release local-first baby-care app. Small, reviewable improvements to reliability and parent-facing usability are the current priority. Consult the [roadmap](docs/ROADMAP.md) before starting large feature or architecture changes.

## Run the project

Use Node 24 and npm, then:

```sh
npm ci
npm run check
npm start
```

See [development setup](docs/DEVELOPMENT.md) for native prerequisites and [Android cases](docs/testing/ANDROID_TEST_CASES.md) for device acceptance. Tests use synthetic/in-memory resources; native OS behavior is a separate verification layer.

## Report a bug

Use the bug-report template and include:

- A reproducible sequence, expected/actual result and the relevant Android case ID.
- App build/source label, uncommitted-source status, phone model and Android version.
- Relevant permission, battery, keyboard, network or time-zone settings.
- A redacted screenshot or short recording using synthetic records.

Keep security-sensitive reports private using [SECURITY.md](SECURITY.md). Do not upload a care database, credentials, personal names or whole device logs to a public issue. Do not treat Not run/Blocked as passing results.

## Propose a change

Describe the user problem and a concrete before/after scenario. Separate existing defects from product decisions. Partner sharing, cloud storage, widgets and medical/reference features need scope and data/privacy decisions before implementation.

For a pull request:

1. Keep the change focused; use the PR template to explain behavior and evidence.
2. Follow existing TypeScript, Router and theme conventions. Run `npm run format`; CI checks formatting and unused code.
3. For data changes, preserve records and IDs, use parameterized SQL, validate at the persistence boundary and make retries safe. Add meaningful failed-write/upgrade tests where behavior changes.
4. For UI changes, check light/dark mode, keyboard reachability, touch targets, field labels and appropriate phone widths; include captioned screenshots and native case results when relevant.
5. Run `npm run check`. Run `npm run export:web` when runtime/bundling/dependency behavior changes. Record checks that could not run and why. Documentation-only edits need link/path review, not invented runtime verification.
6. Update affected setup/behavior docs and record the scope of any device testing.

Avoid unrelated rewrites, forced SDK upgrades and release/service changes bundled into an ordinary fix. The configured CI has not yet been established as a remote release gate; report actual run results.

## Review expectations

Useful evidence is a reproducible failure followed by a focused fix, appropriate regression checks and honest limitations. Build success is not proof of a complete user journey. Use **Pass / Fail / Blocked / Not run** in device results and retest failed cases after a fix.

## License status

No license has been selected. This guide does not grant reuse rights or establish contributor licensing terms. The owner should select those terms before soliciting outside contributions or describing the repository as open source.
