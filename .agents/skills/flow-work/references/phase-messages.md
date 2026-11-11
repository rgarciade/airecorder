# Phase message examples

Worked examples for "Phase messages" in `SKILL.md`. Read them once, before your first message to the user.

They show the **shape and the tone**, not the content: never copy their wording, and write in the language of the conversation. The task in every example is invented.

## After research

**Cryptic. Don't write this:**

```
Research done. Impact map: 3 sites (1 uncovered: mailer.js:30). Seams TBD.
Size verdict: OK. Open q: date fmt (ISO vs locale)? Proceed?
```

What is wrong with it:

- It uses the skill's own words (impact map, seams, size verdict), which the user has never been taught.
- "1 uncovered" does not say what is uncovered, or why the user should care.
- The question gives no reason to prefer one answer, and no recommendation.
- It does not say what an "OK" would accept, or what happens next.

**Clear. Write this:**

```
#42 Export recordings to CSV · research done (3 of 8) · next: plan

I need one decision from you, and your OK to write the plan.

The task adds a button that downloads the list of recordings as a CSV file.

- The list screen already loads everything the file needs
  (src/pages/Recordings.jsx:48), so no new query is required.
- Dates are formatted in three places, and the issue only mentions one. Besides
  the list, the detail screen (src/pages/RecordingDetail.jsx:112) and the email
  summary (electron/mailer.js:30) format them too. The file has to follow one of
  them, or it will show dates differently from the screen.
- The task fits in one session.

Question 1. Which date format goes in the file?
People open this file in a spreadsheet, and a date written as text cannot be
sorted there.
  a) ISO (2026-11-04 17:30): sortable in any spreadsheet. Recommended.
  b) The format the screen uses (4 Nov, 17:30): familiar, but sorted as text.

Once you answer, I write the plan. A plain "OK" accepts option a.
```

## The plan, in one round

The plan is already drafted with the assumed answers, so the user sees the questions and the result together.

```
#42 Export recordings to CSV · plan ready (4 of 8) · next: tests

I need your OK on this plan. Two questions below already have an assumed answer.

The task adds a button that downloads the list of recordings as a CSV file.

What "done" means (these replace the criteria in the task description):
1. The button downloads a file with one row per recording visible in the list.
2. Filters applied to the list also apply to the file.
3. Dates are written in ISO format.

Where the tests call the code:
- buildCsv(recordings) in src/services/csv.js: the function that turns the
  list into text. It catches wrong columns, dates and escaping. It does not
  check that the button is wired to it.
- The Recordings screen, clicking the button: it catches the wiring and the
  filters. It does not check the content of the file in detail.

Scenarios:
1. With three recordings in the list, the file has a header and three rows.
2. With a filter that leaves one recording, the file has one row. Today there
   is no export at all.
3. A title containing a comma stays in one column.

Left out, and why:
- Exporting the transcriptions: they can be megabytes each, which needs a
  different file format. A separate task.

Question 1. What should the file be called?
  a) recordings-2026-11-04.csv, so several downloads don't overwrite each other.
     Recommended, and what the plan assumes.
  b) recordings.csv, always the same name.

Question 2. Should an empty list still download a file?
  a) Yes, with only the header: the button always does the same thing.
     Recommended, and what the plan assumes.
  b) No, the button is disabled when the list is empty.

A plain "OK" accepts the plan with both assumed answers, and I update the task
description with the three criteria above. Then I write the tests.
```

## A review finding

One line per finding, written so the user can decide without opening the file.

**Cryptic:**

```
| 3 | must fix | src/services/csv.js:22 | Unescaped quotes | Escape per RFC 4180 |
```

**Clear:**

```
| 3 | must fix | src/services/csv.js:22 | A title that contains a double quote breaks the row: the spreadsheet reads it as two columns and shifts every value after it. | Double the quotes inside the value, as the CSV format requires. |
```
