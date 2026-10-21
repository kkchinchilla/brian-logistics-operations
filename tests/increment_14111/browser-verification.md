# Desktop browser check — 2026-10-21

Environment: isolated static build from current application source, network connections blocked by CSP, fictional fixtures only. Browser viewport shown in screenshots: approximately 1348 × 926. Preview stopped after QA. No screenshots are packaged.

Observed:

1. Existing 跟車 cell opens with 路線 and 備註; no vehicle, run-link or time fields. Screenshot inspected: complete modal and buttons visible.
2. Switching to 學習 preserves the notes-only form.
3. Switching to 值班 shows no start/end times.
4. Switching to a real delivery restores 車號, rental hint and fixed route time information.
5. 月度報表 shows 值班筆數. 勤務／租車設定 exposes 值班／跟車／學習 per-entry fields and 租車 per-trip deduction. Screenshot inspected: long settings dialog has internal scrolling.

Browser-extension metadata errors were returned by the error-log query; no application error was observed in the checked views. No save was submitted to the connected project. Driver approval and database persistence were tested in isolated suites. Mobile layout and authenticated hosted acceptance remain unverified here.
