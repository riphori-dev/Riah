# Samsung A56 5G device feedback

Reported October 20, 2026 by the project owner using Expo Go with local changes. Android version, font/display scale, keyboard and navigation mode were not recorded.

| Case                 | Result          | Evidence                                                                                                                                                                    |
| -------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A04                  | Pass (reported) | User marked done; restart/storage substeps were not itemized.                                                                                                               |
| A05                  | Pass (reported) | User marked done.                                                                                                                                                           |
| A06                  | Pass (reported) | User marked done.                                                                                                                                                           |
| N01                  | Pass (reported) | User said navigation works.                                                                                                                                                 |
| N03                  | Fail            | Overlap involving the baby illustration and feeding area. Other dimensions untested.                                                                                        |
| Date-entry usability | Fail            | User reported awkward date input; the specific date-entry screen was not identified. The second N01 reference is recorded separately rather than assuming N02 was executed. |
| All other cases      | Not run         | User reported the remainder untested, including N04 and N05.                                                                                                                |

## Changes awaiting device retest

- Home: last diaper/feed badges now occupy a full-width wrapping row below the profile and illustration. Text and artwork can wrap onto separate rows.
- Android setup: native date dialog with future birthdates disabled.
- Android appointments: native date and time dialogs, with individual minute selection. Cancellation preserves the prior value.

These changes are not device-confirmed fixes. Retest Home with long badge text and larger system fonts, birthdate selection/cancellation, and appointment date/time selection/cancellation and save/reopen. Browser checks cannot verify Android native dialogs. For notification test R02, calculate the reminder from the actual saved appointment time; Android now supports individual minutes rather than quarter-hour choices.

Follow-up: [Codex emulator QA](EMULATOR_QA_2026-10-20.md) exercised native Android dialogs, process restoration and enlarged-text layouts. Those results supplement this report; the Samsung-specific overlap retest remains pending.
