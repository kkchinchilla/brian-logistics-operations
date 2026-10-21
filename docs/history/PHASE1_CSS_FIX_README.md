# Increment 1.2 Phase 1 — CSS path packaging fix

The original project ZIP was packaged under `dispatch-system-v0.5.5/`, but the first incremental patch ZIP had files at the ZIP root. Extracting both separately created unmatched paths, which caused pages to appear unstyled.

## Recommended: complete, ready-to-run project

1. Extract `dispatch-system-v0.5.5-phase1-css-fixed.zip`. It contains one `dispatch-system-v0.5.5/` folder with ALL original app pages and scripts, plus the new Phase 1 frontend.
2. Open that folder in VS Code and start **Live Server** from `index.html` (or `attendance-board.html?demo=1`).
3. Make sure the CSS files exist at the relative paths below.
4. This project copy comes from the uploaded v0.5.5 baseline. If you made any later local changes, back those up and use the incremental patch instead of replacing your current folder.

## Alternative: path-corrected incremental patch

Extract `dispatch-increment-1.2-phase1-path-fixed-patch.zip` INTO THE PARENT DIRECTORY of your existing `dispatch-system-v0.5.5/` folder. Allow overwriting the two HTML files (`driver.html`, `dispatcher.html`) after backup. The ZIP itself already includes the `dispatch-system-v0.5.5/` prefix.

Do NOT extract the patch inside `dispatch-system-v0.5.5/`, as that would create a second nested project folder.

## Required relative file locations

```
dispatch-system-v0.5.5/
  index.html               -> css/style.css
  driver.html              -> css/style.css
  dispatcher.html          -> css/style.css
  attendance-board.html    -> css/attendance-board.css
  css/
    style.css
    attendance-board.css
  js/
    attendance-board.js
    config.js
```

`attendance-board.html?demo=1` displays demo data only; edits and day closeout are not written to Supabase in this phase. There are no SQL changes.

## If CSS still fails

Visit `http://127.0.0.1:<Live-Server-port>/attendance-board.html?demo=1` in the browser and open Developer Tools -> Network -> CSS. Verify `attendance-board.css` returns 200, not 404. If you see 404, the Live Server root directory or the extracted folder nesting is incorrect. On the other pages check `css/style.css`.
