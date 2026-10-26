# Increment 1.4.53 — deleted accounts in attendance roster

Deleted accounts retain an inactive profile for historical reporting. The attendance
matrix previously rendered every driver profile, including inactive drivers with no
records, so a deleted test account appeared as an empty row.

Both current and fallback attendance tables now show active drivers plus inactive
drivers with records on the selected date. Delivery, cancelled-plan, observed run,
active extra-trip, duty, standby, leave/plan and execution history remain available.
No profile or attendance records are deleted, and monthly reports are unchanged.

Verified the reported test account has Auth deleted and profile active=false. UI
regressions cover hidden inactive empty rows, active unscheduled drivers, historical
records and changing dates. Login after disabling public signup passed on the phone;
settings were independently verified with signup disabled and phone login enabled.
Admin-created accounts after the setting change still need their focused check.
