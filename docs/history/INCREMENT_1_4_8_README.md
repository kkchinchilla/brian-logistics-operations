# Increment 1.4.8 — 所有司機趟次變更須經調度員核准

Read `../WORK_MODE_HANDOFF_INCREMENT_1_4_8.md` first.

- 司機新增、刪除、修改趟次，一律先送出申請；調度員核准前不改動出勤紀錄。
- 新增申請只進入審核清單，核准後才建立趟次。刪除核准後以取消／作廢保留歷史。
- 「結案」仍是最終確認；月報只使用結案快照。待審申請不進入月報，結案時不會自動核准。
- 重新開啟仍須調度員填寫原因；月報仍只有 Brian 可以存取。

## Deployment

Migration `20261020060723_increment_148_all_driver_schedule_approvals` is **already installed** in `dispatch-system-dev`. **Do not rerun migrations.**

1. Retain a copy of the existing frontend and its `js/config.js`.
2. Deploy this complete source folder's contents to the existing host, preserving config.js.
3. Hard-refresh and sign in with existing accounts.
4. Run `ACCEPTANCE_INCREMENT_1_4_8.md`.

No frontend host was deployed by this delivery. The old direct-add endpoint now rejects driver calls; deploy the current frontend to use the new request action. No credentials, fake production data or new Auth users are included/created. Historical documentation is reference only when it conflicts with the current handoff.
