# Bundled application fonts — Increment 1.4.64

Inter is used for Latin text and numbers; Noto Sans TC supplies Traditional Chinese.
Both variable fonts include weights 100–900. The app does not request a font CDN.
The company and reviewer builds copy these assets into the web/Android package.

- Inter 4.1: https://github.com/rsms/inter/tree/v4.1
  - Original WOFF2: `docs/font-files/InterVariable.woff2`.
  - License: `Inter-LICENSE.txt` (SIL OFL 1.1).
- Noto Sans TC: https://github.com/google/fonts/tree/main/ofl/notosanstc
  - Source: `NotoSansTC[wght].ttf`, retrieved 2026-10-30.
  - License: `NotoSansTC-OFL.txt` (SIL OFL 1.1).
  - Source SHA-256 recorded in `manifest.json`.

Noto was converted with fontTools 4.61.1 / Brotli 1.2.1 into WOFF2 subsets of at
most 2,048 sorted Unicode codepoints. All 20,745 source codepoints are retained
across the subsets, including layout features and the weight axis. The CSS
`unicode-range` declarations select the required local subsets. This avoids a
single large binary upload while preserving names beyond the static UI text.
The browser fetches only subsets needed on a page; Android bundles all of them.
`manifest.json` records each asset's byte length and SHA-256.

System fonts remain the fallback for characters absent from the original fonts
and while `font-display: swap` is loading a font. No original TTF is deployed.
