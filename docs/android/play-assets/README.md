# Draft Play artwork

- store-icon-512.png: 512×512 RGBA PNG; approved white arrow / #ffc533 yellow.
  Square background for Google Play's own corner treatment. Native icon unchanged.
- feature-graphic-1024x500.png: opaque RGB PNG, 1024×500.

Prepared from the existing SVG; user can replace the icon later. These are listing
artwork, not screenshots or evidence of Android tests. Final phone screenshots are
still required, using fictional data in the current signed app. Browser capture was
not available in the preparation environment; no screenshots are fabricated.

Regenerate with scripts/prepare-play-assets.mjs, sharp, Python/Pillow and FONT_FILE
pointing to a local Noto Sans TC font (SIL Open Font License). The font is not bundled.
The app itself continues to use system fonts; artwork does not change application UI.
