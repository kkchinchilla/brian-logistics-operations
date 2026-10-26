# Bundled authentication client

Supabase JavaScript 2.118.0, MIT. Source/checksum: supabase-manifest.json.
The unmodified UMD build is bundled so login does not depend on a third-party
CDN or silently change when a new major-2 SDK is released. The backend still
requires an internet connection. License: supabase-LICENSE.txt.

Upgrade deliberately: download an exact version from the official package,
update its checksum and every loader, then run release and authentication tests.
No secret keys are included. This does not change the Mac Capacitor dependencies.
