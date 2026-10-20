# Dependency security follow-up

Checked with `npm audit` on 2026-10-20 and repeated after removing unused dependencies. The count remains 44 affected entries. The service receives dependency metadata, not source code or care records.

The initial audit reported 56 affected package entries (2 critical, 34 high, 19 moderate, 1 low). `npm audit fix --ignore-scripts --no-fund --cache .npm-cache` applied compatible dependency updates without `--force`. It changed 142 packages, upgraded Expo within SDK 54 to 54.0.37, and removed the reported critical findings in shell-quote and tar. Expo-compatible native versions were then explicitly pinned.

Final pinned tree: **44 affected package entries: 0 critical, 24 high, 20 moderate, 0 low.** The intermediate count was 43 before restoring the SDK-supported date-picker version; the final count is 44. These counts include transitive/meta-vulnerability entries, not 44 proven independent attacks against Riah. Runtime reachability and tooling exposure require assessment.

The audit exits 1 because advisories remain. This is a release-readiness blocker; passing application tests is not a security clearance. Do not apply npm's suggested forced major Expo/React Native changes without a dedicated compatibility migration. There are also advisories reported against broad/all package version ranges, so upgrading alone must not be assumed to resolve every issue.

## Final affected entries

| Package                                | Severity | Direct dependency | npm reports automatic fix                                   |
| -------------------------------------- | -------- | ----------------- | ----------------------------------------------------------- |
| @expo/cli                              | high     | no                | expo@44.0.6 (major change)                                  |
| @expo/code-signing-certificates        | high     | no                | true                                                        |
| @expo/config                           | moderate | no                | expo@44.0.6 (major change)                                  |
| @expo/config-plugins                   | moderate | no                | expo@44.0.6 (major change)                                  |
| @expo/metro                            | high     | no                | expo@44.0.6 (major change)                                  |
| @expo/metro-config                     | high     | no                | expo@44.0.6 (major change)                                  |
| @expo/prebuild-config                  | moderate | no                | true                                                        |
| @istanbuljs/load-nyc-config            | moderate | no                | react-native@0.88.0 (major change)                          |
| @jest/environment                      | high     | no                | true                                                        |
| @jest/fake-timers                      | high     | no                | react-native@0.88.0 (major change)                          |
| @jest/transform                        | high     | no                | react-native@0.88.0 (major change)                          |
| @react-native-community/datetimepicker | high     | yes               | @react-native-community/datetimepicker@8.1.1 (major change) |
| @react-native/community-cli-plugin     | high     | no                | react-native@0.88.0 (major change)                          |
| argparse                               | moderate | no                | react-native@0.88.0 (major change)                          |
| babel-jest                             | high     | no                | react-native@0.88.0 (major change)                          |
| babel-plugin-istanbul                  | moderate | no                | react-native@0.88.0 (major change)                          |
| braces                                 | high     | no                | expo@44.0.6 (major change)                                  |
| decode-uri-component                   | moderate | no                | expo-router@58.0.24 (major change)                          |
| expo                                   | high     | yes               | expo@44.0.6 (major change)                                  |
| expo-asset                             | moderate | no                | expo@44.0.6 (major change)                                  |
| expo-constants                         | moderate | no                | expo-notifications@58.1.5 (major change)                    |
| expo-dev-client                        | moderate | yes               | expo-dev-client@58.0.14 (major change)                      |
| expo-dev-launcher                      | moderate | no                | true                                                        |
| expo-linking                           | moderate | yes               | expo-linking@58.0.13 (major change)                         |
| expo-manifests                         | moderate | no                | expo-dev-client@58.0.14 (major change)                      |
| expo-notifications                     | moderate | yes               | expo-notifications@58.1.5 (major change)                    |
| expo-router                            | moderate | yes               | expo-router@58.0.24 (major change)                          |
| image-size                             | high     | no                | true                                                        |
| jest-environment-node                  | high     | no                | react-native@0.88.0 (major change)                          |
| jest-haste-map                         | high     | no                | true                                                        |
| jest-message-util                      | high     | no                | react-native@0.88.0 (major change)                          |
| js-yaml                                | moderate | no                | react-native@0.88.0 (major change)                          |
| metro                                  | high     | no                | react-native@0.88.0 (major change)                          |
| metro-config                           | high     | no                | react-native@0.88.0 (major change)                          |
| metro-file-map                         | high     | no                | expo@44.0.6 (major change)                                  |
| metro-transform-worker                 | high     | no                | true                                                        |
| micromatch                             | high     | no                | expo@44.0.6 (major change)                                  |
| node-forge                             | high     | no                | expo@44.0.6 (major change)                                  |
| postcss                                | high     | no                | expo@44.0.6 (major change)                                  |
| query-string                           | moderate | no                | expo-router@58.0.24 (major change)                          |
| react-native                           | high     | yes               | react-native@0.88.0 (major change)                          |
| sprintf-js                             | moderate | no                | react-native@0.88.0 (major change)                          |
| uuid                                   | moderate | no                | expo@44.0.6 (major change)                                  |
| xcode                                  | moderate | no                | expo@44.0.6 (major change)                                  |

## Next security work

- [ ] Trace high/moderate advisories through `npm explain` and distinguish build/dev/server/runtime inputs.
- [ ] Evaluate current official Expo upgrade guidance and a supported SDK migration in a separate tested branch; retain the current passing baseline.
- [ ] Review patch/override compatibility where npm cannot resolve a transitive advisory within SDK constraints; do not apply untested major overrides.
- [ ] Repeat advisory checks, SDK compatibility checks, clean install, typecheck, regression tests, web bundle and physical native smoke tests after remediation.
- [ ] Record accepted residual risk with an owner before release; no deployment was performed.

Initial and final raw reports remain in the ignored `.npm-cache/dependency-audit*.json` files for local inspection. This summary contains dependency names/severities only and can be reviewed with the implementation changes.
