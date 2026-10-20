# Security

Riah is pre-release. It has no established supported-release/security-response timetable, and a successful build/test run is not a security assurance.

## Report privately

Do not post credentials, care records, personal identifiers or a working sensitive exploit in a public issue. Use GitHub's private vulnerability reporting **if it is enabled for this repository**. Otherwise use an existing trusted private channel to the maintainer; no dedicated security address or response SLA is currently published.

A useful report identifies the affected build/dependency, an isolated reproduction using synthetic data, likely impact and relevant redacted output. Do not attach an actual baby-care database or whole device logs.

## Current limitations

- Personal care records are local SQLite data; preferences/timer/notification metadata use AsyncStorage. No in-app encryption, backup/restore or cloud-sync guarantee is made.
- Notification bodies can include profile and appointment details; lock-screen disclosure is part of pending device/privacy review.
- The October 20, 2026 dependency audit still reports 44 affected package entries (0 critical, 24 high, 20 moderate), including transitive/meta-vulnerabilities. See [the detailed follow-up](docs/RIAH_DEPENDENCY_SECURITY.md) for the exact snapshot and triage plan.
- Physical Android/iOS delivery, upgrade, accessibility and recovery checks remain release gates. No production-readiness or published-release claim is made.

Before publishing a release, reassess advisories and actual exposure, verify data migrations with disposable fixtures, test native behavior and agree on privacy/recovery expectations. Do not apply a forced major SDK/dependency upgrade as a substitute for compatibility validation.
