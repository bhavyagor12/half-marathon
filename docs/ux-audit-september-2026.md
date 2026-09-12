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

## Second audit fixes (September 12)

- **Blank scene:** the poster was removed as soon as the render loop started, but `requestAnimationFrame` does not run in hidden or occluded tabs, so visitors saw the page background. The first frame is now drawn synchronously before the poster fades, and the scene also redraws on prop changes, resizes, `visibilitychange`, logo loads and OrbitControls `change` events whenever no animation frame has run recently.
- **Full-bleed canvas:** the canvas always covers the viewport. `.scene-frame` marks the clear area between HUD layers, and `camera.setViewOffset` frames the runner inside it. Opening a panel shifts the frame instead of resizing the canvas, so the scene no longer flashes blank and the road fades into the bottom vignette instead of ending in a hard edge.
- **View state:** Front/Back and Full kit/Close-up are matching segmented controls. Every press bumps `frameKey`, so pressing the active side still resets a dragged view. Reframing flushes OrbitControls damping so the camera cannot drift afterwards. A drag only updates the Front/Back switch.
- **Framing and scale:** full kit targets y 1.86 at distance 5.6+, close-up y 2.08 at 3.3+. That leaves a clear gap between the head and the arch banner in both framings. The decorative sun behind the title card was removed.
- **Spots:** open spots are cream chips with a dashed accent outline, matching the panel chips. The chosen spot is filled with the accent. Decal textures match each spot's proportions, sleeve spots sit inside the sleeve, and the Spots switch hides every open marker (unless a panel is showing that spot).
- **Panels:** contextual eyebrows, a front/back kit diagram built from the decal anchors, and a facts list (status, takeover price, logo lock date). The email copy is first person throughout.
- **HUD:** shoes moved to a bottom-left card on desktop and an inline link under the CTA on mobile. The creator photo has an X badge, the focus ring uses the ink colour, the loader sits away from the runner, and mobile controls stay hidden until the scene is ready.
- **Assets:** `npm run capture:scene` (dev server running) photographs the bare scene with headless Chrome via `?capture` and regenerates `scene-poster.webp`, `scene-poster-mobile.webp` and `share.jpg`, so the poster matches the first 3D frame. The share card's offer is plain text rather than a button-like pill.

## Supabase backend, domain and motion pass (September 12)

- **Backend:** bids, orders, refund jobs, rate limits and logos moved from the Sites Worker (D1/R2) to Supabase. `supabase/migrations/20260912000000_slowrun_auction.sql` creates `slowrun_*` tables (RLS on, no public policies), three Postgres functions (`slowrun_hit_rate_limit`, `slowrun_reserve_slot`, `slowrun_award_payment`) that keep reservation and award atomic, and the `slowrun-logos` bucket. API routes run natively on Vercel; the old proxy is gone. `tests/auction.test.mjs` runs the real migration in PGlite. A daily Vercel cron retries pending refunds with `CRON_SECRET`.
- **Payments and domain:** a Dodo brand "Sponsor My Slow Run" with a $10-minimum pay-what-you-want product and a webhook at `https://sponsormyslowrun.com/api/webhooks/dodo` (payment.succeeded, refund.succeeded, refund.failed). Cloudflare DNS points the apex (A 76.76.21.21) and `www` (CNAME cname.vercel-dns.com) at Vercel, DNS only. Local dev is plain `next dev` on port 3001 reading `.env.local`.
- **Spot map:** chest, left/right chest, both forearms, upper/lower back, left quad, and the $20 butt spot. Forearm and quad anchors were placed by probing the model's skin texture; the avatar test now checks each spot hits shirt, skin or shorts as intended.
- **Controls:** a compact vertical rail (horizontal on tablet/mobile) with a sliding Front/Back pill and icon toggles for zoom, spots, music and full screen, each with a tooltip and an icon swap.
- **Music:** "Eye of the Tiger" via the official YouTube embed, on by default. Browsers block sound until a gesture, so it starts on the first tap/click/key; muting is remembered in localStorage.
- **Motion (transitions.dev tokens):** header texts reveal, HUD rise-in, countdown seconds number pop-in, panel reveal with open/close asymmetry, list ↔ detail page slide, 40ms row stagger capped at six steps, learn-more chevrons, shimmer loading label, tooltip timing for rail and 3D spot hover cards, and press scales. Every animation has a reduced-motion guard.
- **Delight:** clean warm-tinted spot stickers with hover highlight and a hover card, a small confetti burst when a spot is picked, and a two-sided confetti celebration once a sponsorship is confirmed.

## Local development

Use Node 22. `npm run dev` serves the live source; the current requested server is on `http://localhost:3001` because port 3000 was occupied. `npm run build:vercel` stages shared files under ignored `.vercel-next`. Vercel deploys main and continues proxying payment/data routes to the existing Sites backend; do not remove that backend.
