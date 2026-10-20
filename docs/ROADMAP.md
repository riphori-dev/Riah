# Roadmap

## Before a production release

- Triage the remaining dependency advisories and validate an Expo SDK upgrade separately.
- Complete physical Android testing for notification delivery, permissions, background timers, reboot, and upgrades.
- Test TalkBack, larger text, three-button navigation, and small-screen keyboard behavior.
- Finish iOS device acceptance; current native evidence is Android-only.
- Define backup/export, recovery, notification privacy, and quiet-hour behavior.
- Improve top-edge masking when content scrolls beneath Android's transparent status bar.

## Product improvements

- Full-history browsing and filters beyond recent records.
- Profile birthdate correction with clear validation.
- Export and restore with a tested data format.
- More useful daily and weekly summaries.

Partner sharing, growth tracking, widgets, and cloud backup are ideas for later evaluation. They are not current features or promised release dates.

See [test results](testing/README.md) for verified behavior and [dependency security](RIAH_DEPENDENCY_SECURITY.md) for the recorded advisory snapshot.
