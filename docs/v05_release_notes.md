# v0.5 — Confirmed decisions

1. Route temperature name and scheduled start/end are fixed **route master** properties, edited by dispatcher/supervisor.
2. Actual start/end timestamps per run are **not needed**; use completion status and supervisor review instead.
3. Whether a run uses a rental vehicle is **decided per dispatch assignment**, not a permanent vehicle attribute.
4. Monthly driver temperature-zone names/row counts are derived from routes assigned during that month, **not manually configured per driver**.
5. A cancelled or pending delivery is **not** a confirmed completed run or a payable salary unit.
6. Routes may be renamed/retimed; captured route details on new-version assignments/executions must remain stable.
7. The dynamic Excel grid carries **route codes**, which are not silently treated as legacy payroll attendance codes. Source-code conversions await explicit confirmation.
8. The old report mapping tables are retained but no longer drive the dynamic report.
