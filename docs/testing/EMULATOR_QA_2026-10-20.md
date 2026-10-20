# Android emulator and browser QA — October 20, 2026

Executed by Codex against the current modified checkout. This report is separate from the owner's Samsung A56 results; it does not certify physical Samsung behavior or all 46 Android cases.

## Environment

- Android emulator: Pixel_6 AVD, Android 14 / API 34, Expo Go 54.0.8, Asia/Shanghai.
- Native Metro: localhost:8083 through ADB reverse. Synthetic profile `QA_Emulator`, DOB October 19, 2026.
- Display: initial 1080×2400 at 420 dpi (about 411 dp wide); stress check at 540 dpi (320 dp) and font scale 1.3. Original density and unset font scale restored afterward.
- Browser: localhost:8082, existing synthetic preview profile; viewport checks at 320×740 and 390×844. Override restored afterward.
- No physical phone was connected. No release APK was built or tested.

## Executed checks

| Area / related cases                | Result and precise scope                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup / A01                         | Passed synthetic onboarding with name, past birthdate and Boy selection. Home showed the profile and zero initial care records.                                                                                                                                                                                                                     |
| Birthdate / A02 subset              | Passed native calendar open, Cancel leaving DOB unset, October 19 selection/confirmation, and October 21 disabled. Full February/month-length matrix not executed.                                                                                                                                                                                  |
| Persistence / A04 subset            | Profile, 120 ml bottle and appointment survived process termination/reopening and display-configuration activity restart. Full phone-reboot and all-record-type case not executed.                                                                                                                                                                  |
| Theme / A06 subset                  | Night mode propagated from Settings to Home, Diaper and Stock. Complete per-screen form and cold-restart theme matrix remains untested.                                                                                                                                                                                                             |
| Navigation / N01 subset             | Visited all six native tabs; opened Settings; Android Back returned to Home. Complete history/deletion-dialog matrix remains untested.                                                                                                                                                                                                              |
| Keyboard / N02 subset               | Appointment title and final notes stayed editable with keyboard open; form scrolled to Doctor; Save remained reachable above keyboard and saved successfully without dismissing it first. Stock name entry survived keyboard dismissal and saved. Full stock final-field matrix remains untested.                                                   |
| Responsive / N03 subset             | Home illustration and feed/diaper badges stayed separate at browser 320 and 390 widths and native 320 dp / 130% font. Native Feed and Sleep controls remained reachable by scrolling. This is an emulator retest, not a Samsung A56 closure.                                                                                                        |
| Bottle / F01                        | Passed 120 ml Formula save with one native history entry. Later Home reported two feeds after the separate breast test.                                                                                                                                                                                                                             |
| Breast / F06 subset                 | Started Left, force-stopped Expo Go, reopened and observed running elapsed timer. Paused and saved one 1-minute breast entry. Browser separately restored a running timer after reload, paused at 45 seconds and saved once. Long lock-screen/reboot and stopwatch-tolerance checks not executed.                                                   |
| Sleep / S01, S03 subset, S04 subset | Started a nap, navigated Home, force-stopped and reopened. Home showed Sleeping now; Sleep retained original 12:42 PM start and showed 1m45s elapsed. Wake Up saved one roughly 2-minute nap and returned to awake state. Phone reboot, duplicate rapid-stop stress and midnight overlap not executed on Android.                                   |
| Appointment / P01 subset            | Native calendar selected October 21. Native clock opened at 12:37 PM; Cancel preserved that value. Synthetic title, doctor and notes saved with keyboard open. Clock confirmation/12 AM/12 PM and vaccine matrix not executed.                                                                                                                      |
| Stock / I02 subset, I04 subset      | Created QA_supplies with quantity 1 / threshold 1 / packs. Equality showed low stock and badge; above threshold showed All stocked and removed badge. Blank validation not executed natively.                                                                                                                                                       |
| Stock / I03 variant                 | After layout fixes, sent ten increase taps and three decrease taps from baseline 13; native UI showed exactly 20 packs. Quantity controls stayed in place. Full zero-floor and relaunch variant remains untested. Earlier coordinate batches were inconclusive because controls moved during loading; they are not evidence of database write loss. |

All unlisted cases remain **Not run**. Partial checks above do not mark the corresponding complete checklist case Pass.

## Defects found and fixed in this session

1. Settings contained whitespace text directly inside a View, producing React Native Web errors. Removed it and added top/bottom safe-area spacing. Native Settings opened successfully afterward.
2. Android status-bar icons stayed black after entering Night mode. Added a theme-aware Expo StatusBar; emulator confirmed white status-bar icons on dark screens.
3. Stock quantity updates inserted a loading message and shifted the buttons during rapid taps. Quantity refreshes now run without inserting the loader, and ignore superseded query results. Controls use their own row so enlarged text has room. Retest confirmed 13 + 10 − 3 = 20.

## Evidence

- [Native birthdate calendar](../screenshots/android-birthdate-picker.png)
- [Native Home, 320 dp and 130% font](../screenshots/android-home-large-text.png)
- [Native restored breast timer](../screenshots/android-feeding-restored.png)
- [Native restored sleep timer](../screenshots/android-sleep-restored.png)
- [Native stock after fixes](../screenshots/android-stock-large-text.png)
- [Browser Home, 320 px](../screenshots/home-fixed-320.png)
- [Browser Home, 390 px](../screenshots/home-fixed-390.png)

## Remaining release checks

- Physical Samsung A56 retest, TalkBack, three-button navigation, full deletion/cancel and profile-edit matrices.
- Standalone/development-build notification delivery, permissions, background restrictions and offline cold start. Expo Go displayed its notification-support warning; this run cannot certify notification delivery.
- Overnight/midnight behavior, full reboot, upgrade from existing installations and backup/recovery.
- Follow-up cosmetic issue: scrolling content can pass beneath Android's transparent status bar; the icon contrast is fixed, but top-edge content masking deserves a separate layout pass.

Automated supporting evidence: `npm run check` passed (type checking and 15 regression tests). Native Android and web bundles compiled during these tests. A fresh browser reload and Settings visit produced no new captured errors; earlier whitespace errors remain in historical logs and are not counted as post-fix failures.
