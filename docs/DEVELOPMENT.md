# Development guide

## Runtime and setup

- Node 24 is the locally tested baseline (24.14.0). `package.json` permits >=22.13 and <25; tests use Node's built-in SQLite and may emit its experimental warning.
- npm and the committed `package-lock.json` provide dependency resolution. Use `npm ci` for a clean checkout.
- Android native builds need a suitable Android SDK/JDK toolchain and a device/emulator. A physical USB-connected phone must authorize debugging. iOS local builds require macOS/Xcode.
- No backend credentials or `.env` file are required by the current local app. Do not invent placeholder services just to run it.

```sh
npm ci
npm run check
npm start
```

The installed Expo SDK is kept within SDK 54. Native package versions must agree with Expo's SDK dependency map; do not independently upgrade React Native/native modules or run forced advisory upgrades without compatibility work.

## Android device workflow

Build from the checkout containing the intended fixes, rather than an older installed APK:

```sh
npm run android -- --device
```

The repository script expands to `expo run:android --device`; it can generate the ignored `android/` folder, compile/install the development client and start Metro. This is a native build, not a read-only check. If the matching client already exists and only JS/TS changed:

```sh
npm start -- --dev-client
```

Choose the development server from the client or use its connection workflow. Keep the phone able to reach the computer. Native dependency/app-config changes require a new native build. Do not delete/reinstall an app containing real records to troubleshoot a bundler connection.

For notification/offline/background release acceptance, repeat the relevant cases with a standalone preview/release-like APK. A development client may require Metro for JavaScript, so offline startup behavior must be interpreted in that context. The existing EAS profiles describe development/internal preview/production configuration; no usable APK, signing identity, remote build or published release is guaranteed by their presence.

Authoritative setup references: [Expo local native development](https://docs.expo.dev/guides/local-app-development/) and [using development clients](https://docs.expo.dev/develop/development-builds/use-development-builds/). No EAS build, submission or external project change is needed for documentation/test preparation.

Start [Android testing](testing/ANDROID_TEST_CASES.md) only after the build/source identity is recorded. Include uncommitted-source status: the current recovery changes may not be represented by the last Git commit alone.

## Verification commands

| Command               | What it establishes                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`   | TypeScript strict-mode compatibility, not functional correctness.                                                    |
| `npm test`            | Actual TypeScript modules against in-memory SQLite plus storage/notification mocks and a focused Stock hook harness. |
| `npm run check`       | Both checks above.                                                                                                   |
| `npm run export:web`  | A web bundle can be produced, not that native journeys pass.                                                         |
| `npm run web`         | Development web server.                                                                                              |
| `npm run preview:web` | Local server for an already-created `dist/` export.                                                                  |

The current automated suite has 15 tests covering schema upgrades/rollback, failed updates, stock preservation, daily totals, active sleep, feeding save idempotency, profile changes, civil dates, timers and reminder reconciliation. It uses disposable in-memory resources. Native OS scheduling, device accessibility and real installation upgrades require separate results.

The GitHub workflow installs the lockfile, checks Prettier formatting, runs `check` and exports web. TypeScript rejects unused locals and parameters. Run `npm run format` before committing; `.editorconfig` supplies editor defaults.

## Application structure

`package.json` uses `expo-router/entry`. `app/_layout.tsx` loads theme, initializes SQLite, reconciles legacy sleep/cache state and chooses the first route. See [architecture](ARCHITECTURE.md) for the data flow and design decisions.

- `app/landing.tsx` and `app/setup.tsx`: first-run profile setup.
- `app/(tabs)/`: Home, Diaper, Feed, Sleep, Stock and Appointments.
- `app/settings.tsx`, `app/about.tsx`: profile/theme/reminder controls and product context.
- `db/schema.ts`: additive schema checks/migrations; version 3 is the current implementation.
- `db/database.ts`: record helpers, stable updates and active sleep persistence.
- `utils/care.ts`: shared validation, local dates and sleep overlap rules.
- `hooks/`: guarded actions, persisted breastfeeding timers and deletion confirmation.
- `services/notifications.ts`: native local schedule reconciliation; `dataEvents.ts` signals mutations.
- `constants/ThemeContext.tsx`: preference/provider and reactive style helpers.

Home shortcuts open the corresponding tracker routes; logging has one active implementation per tracker.

## Persistence and changes

SQLite `riah.db` holds profiles, logs, inventory, appointments and active sleep. AsyncStorage holds preferences, breastfeeding session state and notification metadata. SQLite is authoritative for profile/onboarding recovery.

Version 3 adds persistent active sleep, unique sleep/feeding session IDs and time indexes without deleting/rebuilding existing user tables. Use parameterized helpers. Preserve IDs during editing, use deltas for stock changes, and keep retries idempotent. Startup refuses unsupported/malformed schemas rather than silently resetting records.

For persistence changes, test fresh and legacy fixtures, failed writes/rollback and a same-signature disposable APK upgrade. Do not execute migrations on real user records as a development check. Riah currently has no in-app backup/export/restore guarantee.

## Reminder behavior to verify

Settings explains and requests permission. Appointments schedule future offsets at 7, 3 and 1 calendar day before, and one hour before. Care checks use the existing 3-hour diaper and 2.5-hour feeding thresholds. Low-stock alerts use the shared <= rule and a 12-hour cooldown. Only the nearest 48 schedules are retained, with mutation/resume reconciliation.

There is no JS interval pretending to be an OS background service. Device permission, battery behavior, terminated/reboot delivery and notification-tap routing must still be verified. Notification bodies can expose profile/appointment details on the lock screen; privacy/quiet-hour decisions remain open.

## Web preview and troubleshooting

```sh
npm run export:web
npm run preview:web
```

Open `http://127.0.0.1:8083`. The preview server serves only loopback and adds `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`; any future web host must also satisfy SQLite's isolation needs. See [Expo SQLite web configuration](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/).

- **SQLite access-handle / Invalid VFS state:** close other Riah tabs on that origin, then reload. Do not clear the site's data as a first response; records may still be intact.
- **Metro resolution/SHA errors after package changes:** stop the old Metro process and restart with `npm start -- --clear`. An already-running bundler can hold stale paths after dependency installation.
- **Notifications on web:** Settings reports that reminders are available in the mobile app; browser success does not verify native scheduling.
- **Wrong behavior despite code changes:** verify source/build identity, restart the current bundler and rebuild the client if native/config dependencies changed.

Generated `node_modules/`, `.expo/`, `dist/`, local package cache and native build folders are ignored. Do not commit local databases, device logs, credentials or real care records. See [security reporting](../SECURITY.md) and [current dependency findings](RIAH_DEPENDENCY_SECURITY.md).
