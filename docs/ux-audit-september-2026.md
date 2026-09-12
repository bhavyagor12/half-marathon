# September 2026 UX fixes

The public product name is **Sponsor my slow run**. Bhavya reconfirmed USD on September 12: tee slots start at $10, premium butt/shorts slot at $20, and every takeover doubles that slot’s price. The fee-adjusted refund policy is unchanged and disclosed in the rules. Only X is promised as a posting channel; no additional social activity was invented.

## Implementation

- `scripts/optimize-avatar.mjs` compresses the ignored original `output/avatar/bhavya.glb` with Meshopt and embedded 2K WebP textures. Published GLB: **1,710,896 bytes**, down from 10,718,824 bytes. `GLTFLoader` uses the bundled Three.js Meshopt decoder. The model test enforces a 2 MB budget and checks all nine garment anchors against decoded geometry.
- The server-rendered 53 KB scene poster is visible before JavaScript and during decoding/failure. A streamed fetch reports download progress, capped at 95% until the first 3D frame. Retry and sponsorship navigation remain available. Regenerate the poster and 1200×630 share image from a clean scene capture after major model/environment changes; exclude HUD, countdown, and shoe button from captures.
- Avatar/anchor dimensions are 65% of the previous size; arch height is 7.6 world units (about three avatar heights). Camera supports full-kit and close-up views plus actual horizontal drag and wheel/pinch zoom. Canvas sits above the page background; decorative layers do not intercept input. PCFShadowMap replaces the removed shadow mode.
- Open spots have numbered, dashed accent labels; selected spot is dark green. Visible-side filtering and body occlusion prevent through-body selection. A centered 44px shoe contact button is projected below the feet and hidden during loading or when feet leave the frame.
- Non-modal side panels leave the model interactive; at <=700px they become 60%-height bottom sheets. Selecting a row opens direct details, sets front/back immediately, and reframes the remaining scene. Shoes are a separate partnership section.
- When checkout is disabled, no brand/website form appears. Visitors get a specific email inquiry link; no fake waiting list or reservation is recorded. Existing payment recovery/upload handling remains intact.
- Cream panels, self-hosted Geist fonts (OFL included), explicit USD, larger text/touch targets, keyboard focus ring, Front/Back switch, mobile pinch hint, and a top countdown replace the previous dense HUD. Internal actions no longer use external-link arrows. Favicon, Apple icon, theme color, OG image, and large X card are included.
- No production Dodo payment/refund was attempted. Provider activation and refund retry scheduling remain separate launch requirements.

## Verification

- Production Next build and 14 tests passed. Focused frontend lint has no errors; the two native `<img>` warnings concern the intentionally pre-optimized poster and 44px profile image.
- Isolated headless Chrome previews at 1440×900, 900×650, 500×900, 390×844, and 375×667. Real pointer drag, wheel zoom in/out, front/rear raycast clicks, direct spot details, premium row, and shoe email flow exercised.
- Controlled 80 KB/s model stream: poster and 6% progress visible at ~1.7 seconds, email inquiry usable before loading completed, model ready at ~23.6 seconds. This is a deliberately throttled local test, not a production/mobile performance guarantee.
- No-JavaScript poster/metadata, aborted-download retry, and real touch rotation/pinch tests passed on both the development server and the production build.
- The supplied browser runtime still fails initialization; checks use an isolated headless Chrome profile, not the user's signed-in browser.

## Local development

Use Node 22. `npm run dev` serves the live source; the current requested server is on `http://localhost:3001` because port 3000 was occupied. `npm run build:vercel` stages shared files under ignored `.vercel-next`. Vercel deploys main and continues proxying payment/data routes to the existing Sites backend; do not remove that backend.
