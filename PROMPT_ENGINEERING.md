# Prompt engineering notes

## Daily clinic report (`generateReportWithGemini`)
| Version | What changed | Problem it fixed / left |
|---|---|---|
| v1 (original) | One user prompt: "Generate a formal healthcare practice administrative report" + a comma-joined metrics string | Model filled gaps with plausible but invented trends; fallback text also contained invented claims ("contact completeness above 95%") |
| v2 (original) | Added "Strictly reflect the provided metrics. Do not fabricate." | Better, but only 5 flat numbers were supplied, so the model still had to guess everything else |
| v3 (this version) | `systemInstruction` split into ROLE / RULES / OUTPUT; facts sent as JSON built from the live DB (status, doctor, service, inquiry, automation breakdowns); every sentence must cite a figure; explicit empty-data behaviour; max items per section; `responseSchema` forces valid JSON; temperature 0.2 | Grounded, checkable output. The offline fallback now builds the report from the same facts, so it can no longer invent anything |

## Inquiry classifier
Added category definitions, a priority rubric, three worked examples, enum-constrained JSON schema and a rule that suggested replies never give clinical advice. Emergency keywords are checked in code before any model call.

## Receptionist assistant
System prompt now injects today's date/weekday in the clinic time zone, the real doctor/service ids, and hard rules: never state availability without `check_availability`; never invent name/phone/email; stage bookings only after the patient supplies them; booking is not final until the patient presses Confirm. Tool results go back to the model as a user turn (replacing the non-standard `tool` role), with up to 4 tool rounds.

## Honest limits
These notes describe prompt design changes. I could not run live Gemini calls where this was built (no API key / network), so prompt quality against the real model has not been measured; the schema + grounding rules are designed to make that safe, and you should spot-check a few reports with your key.
