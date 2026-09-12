# Sponsor my slow run

Bhavya Gor’s December 20, 2026 half-marathon sponsorship auction. One full-screen Three.js arena, a textured 360° model of Bhavya in his race kit, a spots drawer, and a short story dialog.

## Run

Node 22.23+ and npm. `npm ci`, then `npm run dev`. `npm run build` emits the Cloudflare-compatible Worker. `npm test` exercises the actual award SQL against SQLite, including concurrent reservation, takeover, replay, and cutoff cases. `npx tsc --noEmit` checks types. Node’s SQLite test API is experimental.

## Auction contract

- Eight tee spots open at $10; the butt placement on the back of the shorts opens at $20.
- Each accepted takeover doubles the price for that spot. Prices are integer USD cents, calculated on the server from the current owner.
- Version checks and atomic 30-minute reservations prevent stale or parallel checkouts from replacing the wrong sponsor.
- A signed webhook plus canonical Dodo payment retrieval confirms the currency, product, quantity, price excluding tax, and order identity before ownership changes.
- The ownership transfer and previous sponsor’s refund job are one atomic D1 batch. Replays cannot award a bid or create a refund job twice.
- Outbid refund = original total charged including taxes minus Dodo’s recorded USD `payment_fees`. Any additional Dodo refund fee is absorbed by Bhavya. No estimated fee percentage. Missing/non-USD fee ledger entries leave the refund pending for reconciliation. Unfulfilled late/overlapping checkouts receive the full amount.
- Refund amount is frozen before the API request; a stable idempotency key protects retries. Dodo refund webhooks set final success/failure. Failed provider refunds require operator reconciliation.
- Dodo payment webhook retries process pending refund work. A scheduler/operator should additionally call `POST /api/admin/refunds` with `Authorization: Bearer REFUND_JOB_KEY`. Provision and schedule this before enabling checkout; it is not scheduled yet.
- Auction and logo edits close December 10, 2026 at midnight India time. The owner at closing gets race-kit placement. The cutoff is a working production default selected to allow printing.

## Storage and security

Sites provisions D1 `DB` and R2 `LOGOS`, declared in `.openai/hosting.json`. Drizzle migrations are in `drizzle/`. Public endpoints expose only sponsorship fields. Checkout metadata never grants ownership. Uploads require a 256-bit browser capability; only its SHA-256 is stored. The capability is kept in sessionStorage for the checkout tab, so there is no cross-device or email self-service yet. Contact Bhavya for recovery. PNG/JPEG/WebP only, 2 MB maximum, MIME/signature checks, non-executable content response. Outbid sponsors cannot edit branding.

## Payment activation — not yet enabled

The public preview can accept email enquiries while checkout is closed. GTA Bid’s payment code was reviewed as a reference; its live product, webhook, and customer records were not reused.

1. Create a dedicated USD pay-what-you-want Dodo product for this project, with tax-exclusive prices and discounts disabled.
2. Set `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_PRODUCT_ID`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT`, `SITE_URL`, `SPONSOR_CONTACT`, and a random `REFUND_JOB_KEY` through Sites. Never commit keys.
3. Register the site’s `/api/webhooks/dodo` endpoint for `payment.succeeded`, `refund.succeeded`, and `refund.failed` in the same environment.
4. Run provider test-mode acceptance: opening bid, doubling takeover, fee-ledger lookup, partial tax-inclusive refund, delayed/replayed webhooks, refund failure, and late checkout. Keep payments disabled until this passes.
5. Schedule refund-job retries, then configure live-mode keys/product/webhook and set `PAYMENTS_ENABLED=true`; redeploy.

The fee lookup and refund math follow the official [balance ledger](https://docs.dodopayments.com/api-reference/balance-ledger/list-ledger-entries) and [refund API](https://docs.dodopayments.com/api-reference/refunds/post-refunds). Actual provider payment/refund tests remain outstanding because this project’s Dodo configuration is missing.

## Assets and follow-up

The runner is a real textured GLB at `public/models/bhavya.glb`, generated with Meshy 7 Ultra from the race-kit likeness reference derived from Bhavya’s five supplied photos. It supports full orbit, front/back selection, and nine surface-projected sponsor decals. This is an AI reconstruction; facial/profile/back accuracy is not scan-verified.

The production asset is about 10.7 MB with 102,339 triangles and a 4K color texture. `scripts/optimize-avatar.mjs` compresses embedded textures without changing geometry. `lib/avatar.mjs` contains the calibrated garment anchors. `tests/avatar.test.mjs` loads the actual GLB, checks volume/textures/size, verifies that all nine anchors hit the right garment colors, and validates decal geometry and rear occlusion.

Generation source, high-detail master and four provider-rendered views remain in `output/avatar/`, excluded from deployment. `scripts/generate-avatar.mjs` uses local-only `MESHY_API_KEY`; never add that key to frontend or hosting settings. The completed task used 35 credits. Its persisted task record prevents accidental duplicate submissions; `status` and `download` resume the existing job.

`public/og.png` is the unused share card from the rejected editorial layout, generated with the built-in imagegen tool. It is intentionally not referenced in metadata. Prompt: premium off-white/olive/lime social card, “SLOW CLUB 21.1”, “I run slow. Your logo gets more airtime.”, “BHAVYA · 20 DECEMBER 2026”, and a floating tee with “YOUR LOGO HERE”. Replace with an arena-matched card later.

Contact: https://x.com/bhavya_gor · bhavya.gor9999@gmail.com.

## Vercel deployment

GitHub: https://github.com/bhavyagor12/half-marathon (branch `main`). Vercel project: `half-marathon` in `bhavyagor12s-projects`, connected to that GitHub repository.

`npm run build:vercel` creates an ignored `.vercel-next` app from the shared frontend and builds native Next.js for Vercel. `vercel.json` selects that output. This preserves the existing Cloudflare build for backend maintenance without duplicating product UI source.

The Vercel API adapter forwards only the known sponsorship routes to the original Sites Worker, where D1, R2, webhook verification, bids, and refunds remain authoritative. It enforces same-origin writes, bounded bodies, timeout, and an explicit route allowlist. It is not a general-purpose proxy. Consequently, the Sites backend must remain deployed and publicly reachable. Do not delete it after the Vercel launch. Checkout remains disabled until the activation steps above are completed; set the backend's `SITE_URL` to the Vercel production domain before enabling payments.
