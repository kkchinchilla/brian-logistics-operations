# Increment 1.4.54 — footer link placement

Privacy and account/data-request links now follow 登出 on all five current
dashboards, including routes and the driver attendance view. The login page already
places them below 登入. Shared footer spacing and responsive layout rules apply.

Validation: build/asset checks and existing release-preparation checks passed.
No authentication, payroll, permission or data changes.

User-confirmed physical tests on 2026-10-27: account creation through Brian after
public signup was disabled; new account phone login with read-only driver view;
deletion of that test account and absence from attendance; privacy-page readability
and Android Back returning to attendance without another login. Account/data-request
mail link and the other remaining release gates have not yet been accepted.
