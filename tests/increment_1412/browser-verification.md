# Browser verification — 2026-10-21

Source: current four-page offline build with fictional fixtures and network-disabled CSP. The offline fixture simulates the calculated response; isolated database tests and read-only live calls separately verify the real SQL implementation.

Desktop: new headers 值班／跟車／學習／租車 visible in order. Test driver B shows 1 follow and 2 learning entries. Driver detail shows 120 + 120 in duty amounts and −160 rental, subtotal 1,880 (all fictional). Screenshot inspected. Main dashboard CSS unchanged.

Responsive iframe widths: 320,375,390,768,1024,1366,1920. Measured content widths: 305,360,375,753,1009,1351,1905, respectively (15 px scrollbar). Document scrollWidth equaled clientWidth at each width; both new headers remained present. 390-wide screenshot inspected. This tests CSS responsive behavior in a desktop browser, not a physical mobile device or touch gestures. No authenticated hosted writes performed.

The final wording-only edit removed implementation terminology from user-facing explanatory text; UI structure and widths remained unchanged. UI integration/demo checks were rerun. Preview stopped after QA; no browser screenshots are included in this package.
