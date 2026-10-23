# Increment 1.4.20 — 趟管家 branding

The user-approved Illustrator SVG is preserved byte-for-byte in `assets/tangguanjia-logo.svg`. Its arrow is a transparent cutout, not a font glyph. The login and five dashboards use this shared asset and the chosen 趟管家 name; their browser icons use the same SVG. A dedicated stylesheet preserves proportions and prevents the legacy sidebar pseudo-icon from appearing twice. The static build includes assets.

No application logic or database changes. Android launcher and Google Play raster assets will be derived from this approved master during Android packaging; this web release is not an Android app build.

Publishing checkpoint (23 October 2026): personal developer account created; identity verification pending. Test device: Galaxy Z Flip 8 (user reported). App name: 趟管家. Public support email: tangguanjia.support@gmail.com; send/receive verified by user. Guide one action at a time.

Validation: build and deployment asset checks passed; all 32 existing phone-login checks passed; all six entry/dashboard pages reference the exact uploaded SVG and the new brand. SVG rendered and inspected on the sidebar background. Full authenticated browser layout remains unverified.
