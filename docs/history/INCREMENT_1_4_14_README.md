# Increment 1.4.14

Current payroll includes individual monthly base salary. Configure 車輛管理 → 司機名單 → 設定底薪. Missing amount is not treated as zero. The monthly dashboard table no longer expands by temperature zone; the underlying data remains available for future Excel work.

Database migration 20261021094142_increment_1414_driver_base_salary.sql is already installed in dispatch-system-dev. Do not rerun migrations. Upload this full application folder to the existing host, preserve your js/config.js, and hard-refresh. The assistant has not deployed the frontend or entered salary amounts.

Read ../WORK_MODE_HANDOFF_INCREMENT_1_4_14.md and ../ACCEPTANCE_CHECKLIST_1_4_14.md. These supersede older no-base assumptions. Tests: tests/increment_1414. Isolated demo: ../OFFLINE_DEMO_1_4_14/index.html. Do not deploy offline demos as the operational app.
