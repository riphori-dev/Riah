# Changelog

## Unreleased

### Reliability

- Preserve inventory records during loading and row IDs during edits.
- Add transactional schema migrations and recoverable active sleep sessions.
- Persist breastfeeding timer state and prevent duplicate session saves.
- Correct daily totals, overnight sleep overlap, and local birthdate handling.
- Reconcile future local reminders with explicit permission controls.

### Interface

- Add responsive Home shortcuts and separate profile artwork from care badges.
- Use native Android date and time dialogs.
- Improve loading, validation, save feedback, and deletion confirmation.
- Update existing screens when the theme changes, including status-bar contrast.
- Keep stock adjustment controls stable during rapid taps and enlarged-text use.

### Maintenance

- Remove legacy entry files, unused components, dependencies, and state.
- Add strict unused-code checks, formatting, and regression-test CI.
- Document architecture, local builds, device cases, and test evidence.
- Build and smoke-test a standalone Android APK offline.

Production release work is tracked in the [roadmap](docs/ROADMAP.md). Remaining dependency advisories are recorded in the [security review](docs/RIAH_DEPENDENCY_SECURITY.md).
