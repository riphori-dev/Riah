# Testing

## Automated checks

```sh
npm run check
npm run export:web
```

The 15 regression tests exercise the actual persistence, validation, timer, and reminder modules using disposable resources. The suite includes failed writes, rollback, retries, full-day totals, overnight intervals, and rapid inventory adjustments. CI runs these checks on pushes and pull requests.

## Device checks

- [Android cases](ANDROID_TEST_CASES.md): 46 cases with steps and expected outcomes.
- [Results template](ANDROID_TEST_RESULTS_TEMPLATE.md): record Pass, Fail, Blocked, or Not run.
- [Android emulator and browser results](EMULATOR_QA_2026-10-20.md): scoped native and responsive-layout checks.
- [Standalone APK verification](APK_BUILD_2026-10-20.md): signature, installation, and offline cold start.
- [Samsung A56 feedback](ANDROID_SAMSUNG_A56_RESULTS.md): owner-reported results and pending retests.

Run with synthetic records. Record the build/source identity, device, OS, font scale, navigation mode, and permission state. A partial case does not count as a complete pass. Notification delivery, physical-device background behavior, accessibility, upgrades, and recovery remain acceptance work.
