# Android test results

Copy this template for a real device run. Every initial result is **Not run**; replace only after executing the matching case in [the Android guide](ANDROID_TEST_CASES.md). Use Find for the case ID. This template is not proof of completed device QA.

## Run identity

- Tester: _fill in_
- Test date and local time zone: _fill in_
- Phone model / Android version: _fill in_
- App version / APK or build label / installed date: _fill in_
- Build type (development client / standalone preview / release-like): _fill in_
- Source revision and whether uncommitted changes are included: _fill in_
- Fresh disposable install or same-signature upgrade: _fill in_
- Notification permission / battery restrictions / DND: _fill in_
- Keyboard / navigation mode / display and font scale: _fill in_
- Metro/network availability where relevant: _fill in_
- Dataset label (synthetic records only): _fill in_

## Results

Allowed statuses: **Pass, Fail, Blocked, Not run**. Put the actual result, issue link or blocker in the last column. Recheck a failed case after its fix and record the retest build/date.

| Case | Priority | Status  | Actual result / evidence / blocker |
| ---- | -------- | ------- | ---------------------------------- |
| A01  | P0       | Not run | —                                  |
| A02  | P1       | Not run | —                                  |
| A03  | P0       | Not run | —                                  |
| A04  | P0       | Not run | —                                  |
| A05  | P1       | Not run | —                                  |
| A06  | P1       | Not run | —                                  |
| N01  | P1       | Not run | —                                  |
| N02  | P1       | Not run | —                                  |
| N03  | P2       | Not run | —                                  |
| N04  | P2       | Not run | —                                  |
| N05  | P1       | Not run | —                                  |
| D01  | P1       | Not run | —                                  |
| D02  | P1       | Not run | —                                  |
| D03  | P0       | Not run | —                                  |
| D04  | P1       | Not run | —                                  |
| F01  | P1       | Not run | —                                  |
| F02  | P1       | Not run | —                                  |
| F03  | P1       | Not run | —                                  |
| F04  | P1       | Not run | —                                  |
| F05  | P0       | Not run | —                                  |
| F06  | P0       | Not run | —                                  |
| F07  | P0       | Not run | —                                  |
| S01  | P0       | Not run | —                                  |
| S02  | P0       | Not run | —                                  |
| S03  | P0       | Not run | —                                  |
| S04  | P0       | Not run | —                                  |
| S05  | P1       | Not run | —                                  |
| I01  | P0       | Not run | —                                  |
| I02  | P1       | Not run | —                                  |
| I03  | P0       | Not run | —                                  |
| I04  | P1       | Not run | —                                  |
| I05  | P0       | Not run | —                                  |
| P01  | P1       | Not run | —                                  |
| P02  | P0       | Not run | —                                  |
| P03  | P1       | Not run | —                                  |
| R01  | P1       | Not run | —                                  |
| R02  | P1       | Not run | —                                  |
| R03  | P1       | Not run | —                                  |
| R04  | P0       | Not run | —                                  |
| R05  | P1       | Not run | —                                  |
| R06  | P1       | Not run | —                                  |
| R07  | P1       | Not run | —                                  |
| R08  | P2       | Not run | —                                  |
| X01  | P0       | Not run | —                                  |
| X02  | P1       | Not run | —                                  |
| UX01 | P2       | Not run | —                                  |

## Notification timing evidence

| Case / synthetic title | Saved appointment time | Expected reminder time | Actual delivery time | App/lock/battery/permission state | Result  |
| ---------------------- | ---------------------- | ---------------------- | -------------------- | --------------------------------- | ------- |
| _fill in_              | —                      | —                      | —                    | —                                 | Not run |

## Defect report

Repeat this block for each failure.

- Case ID / severity:
- Reproduction steps and frequency:
- Expected result:
- Actual result:
- Last known good state:
- Redacted screenshot/recording/error excerpt:
- Whether any records were lost, changed or duplicated:
- Issue reference:
- Retest build/date/result:

## Run summary

- Pass: _count_
- Fail: _count_
- Blocked: _count_
- Not run: _count_
- Total cases: 46
- Open P0/P1 failures:
- Follow-up observations and first-use feedback:
- Native sign-off: **Pending**

Do not classify a blocker or missing test as success. Keep real care records, names, screenshots and device-wide logs out of public reports. A passing Android run does not clear remaining dependency security or privacy/release decisions.
