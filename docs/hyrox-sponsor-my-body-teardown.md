# Product Teardown: "Sponsor My Body" (hyrox.marclou.com)

> Reviewed on 12 Sept 2026 in Chrome (desktop at 1512×806 and mobile at 390×844). I clicked through every visible control, modal, theme and timeline state, then checked the site's public API responses and front-end bundle to capture flows that are no longer reachable (checkout and branding upload close when bidding ends).
>
> Purpose: reference for building a similar product for **my half marathon on 20 December 2026**.

---

## 1. Product Summary

| | |
|---|---|
| **Product name** | Sponsor My Body. The manage page is branded "BODY BID" |
| **Owner** | Marc Lou (@marclou), an indie maker |
| **One-liner** | Brands bid for spots on Marc's body. Winners' logos appear on a 3D scan of him on the site, and he wears them as temporary tattoos at his HYROX race. |
| **Event** | Marc's first HYROX race, 19 Sept 2026, İzmir, Turkey |
| **Business model** | Per-body-part auction. Each takeover raises the price, and the outbid sponsor gets a 100% refund. |
| **Result** | **$112,058** raised, **54 sponsorships**, **15 body spots**, all sold at close |
| **Auction window** | First sale 8 Sept 13:46 UTC. Closed **11 Sept 00:00 UTC**, so it ran about 2.5 days |
| **Traffic (visible)** | About 6,900–7,000 visitors per day and 20–30 people live on the site when I checked |

### Why it works (PM read)
1. **Novelty and virality.** "Put your logo on my body" is funny, easy to share, and makes a good story.
2. **Scarcity plus escalation.** There are only 15 spots, and every takeover doubles the price. People compete in public, which drives more attention.
3. **Low risk for buyers.** An outbid buyer gets a full refund, so bidding costs nothing unless you win.
4. **Two-sided value.** Sponsors get traffic on the site right away, and winners also get real-world placement plus social posts.
5. **Radical transparency.** Live revenue, live visitor count, a public analytics link, view counts per spot, and a full bid history all build trust.
6. **Interactive 3D.** The 3D body turns a price list into something people want to explore and share.

---

## 2. Information Architecture

```
/                      Main experience (single page app, everything is modal/panel based)
 ├─ Header (title, revenue, auction status, "How it works?")
 ├─ Control bar (theme, music, fullscreen, rewind)
 ├─ Countdown ("Race in")
 ├─ 3D arena + 3D body with logo stickers
 ├─ "Real body" video portal (in-scene)
 ├─ Live visitors widget (DataFast)
 ├─ Creator badge (@marclou)
 ├─ Primary CTA: "View sponsors"
 ├─ Modals/panels:
 │   ├─ How it works (Sponsor My Body)
 │   ├─ Meet the sponsors (list)
 │   ├─ Spot detail panel (right side)
 │   ├─ Auction rules
 │   ├─ Real body video
 │   ├─ Live visitors (mobile)
 │   └─ Checkout / Branding form (when auction open)
 └─ Timeline mode ("Sponsorship history" / Rewind)

/manage                Sponsor self-service (magic-link login by payment email)
```

---

## 3. Feature Inventory (Main Page)

### 3.1 Header (top-left)
- **Title:** "Sponsor My Body". Clicking the title block opens the How it works modal.
- **Subtitle:** "I'm paid **$112,058** to race HYROX." The number updates live.
  - A different subtitle variant, "I'm getting paid to race HYROX.", sometimes shows before revenue loads.
- **Auction status text** changes with the auction state:
  - `Auction opens soon`
  - Open: `Bidding closes on …` / `X days and Y hours left` / `X hours left` / `X minutes left` / `Less than a minute left`
  - `Bidding closed`
  - `Auction cancelled`
- **"How it works?"** link opens the How it works modal.
- Revenue is refreshed **every 5 minutes** and whenever the tab becomes visible again (`visibilitychange`).

### 3.2 Control bar (icons under header)
| Control | Behaviour |
|---|---|
| **Theme dot** (colored circle) | Switches between two themes: **"Ares"** (red neon arena) and **"Legacy"** (blue neon arena with circular platform). The aria-label says "Switch to Legacy" or "Switch to Ares". |
| **Music toggle** (speaker) | "Turn music on/off". Plays a **YouTube soundtrack through the YouTube IFrame API**, with a different track per theme ("Red theme" and "Blue theme" soundtracks, which start at a set timestamp). Errors: "The soundtrack player did not load." / "…is unavailable." |
| **Fullscreen** | "Enter/Exit full screen". Error toast: "Full screen unavailable. Try again." **Hidden on mobile.** |
| **Rewind** (circular arrow) | Enters **timeline mode** (see 3.9). While active, the label becomes "Return to live". |

### 3.3 Countdown (top-right)
- Labelled **"Race in"**, formatted `DD d HH h MM m SS s` in the Orbitron display font and ticking every second.
- It counts down to **race day**, not auction close.
- The same countdown appears again in the How it works modal footer.

### 3.4 3D Scene (center)
- **Photoreal 3D scan of Marc's body.** The model is a Polycam scan refined in Blender, served as a **Draco-compressed GLB** (`marc-20260909-glutes-v1.glb`). The file name suggests versions were added as new spots (glutes) went on sale.
- **Logos rendered as stickers/tattoos** on 15 body regions, with each sponsor's uploaded logo mapped onto the skin.
- **Neon sci-fi arena:** pillars, grid floor, glowing lines, a portal/door frame, and a platform under the feet. The environment changes with the theme.
- **Interactions:**
  - **Drag** to rotate or orbit the camera around the body.
  - **Scroll/pinch** to zoom.
  - **Click a sticker** to open that spot's detail panel. The camera animates to frame the spot and a highlight box outlines the sticker.
  - The camera also moves to a side or angled view when a spot is selected from the list or during rewind.
- Accessible name: "Interactive 3D sponsorship body".

### 3.5 "Real body" video portal (in-scene)
- A **framed video screen inside the 3D scene** (it looks like a mirror or door behind the model). It plays short clips of Marc's real body (front and back poses), streamed with **Mux**.
- It has a small **expand icon** ("Watch the real body video").
- Expanding opens a **vertical video modal** with a caption explaining that the 3D model is a Polycam scan refined in Blender, and that the video shows his real body where the tattoos will go.
- **PM note:** this proves the 3D model is really him and that the tattoos will actually happen.

### 3.6 Live visitors widget (bottom-left)
- A pulsing dot followed by "**6,945 watched today**", plus a **"DataFast ↗"** link to the **public DataFast analytics dashboard**.
- **Recent visitors feed:** the last 3 visitors, each shown with a **country flag, country name and timestamp**. It updates live.
- Empty and error states: "Waiting for visitor activity…", "Live traffic is unavailable right now.", "Visitor count unavailable", "Reconnecting…".
- **On mobile** the feed collapses. Tapping "watched today" opens a **"Live visitors by DataFast"** modal.
- Data comes from `/api/activity`, which returns `active` (people on site now), `visitorsToday`, and the last events (`country`, `isNew`, `seenAt`).

### 3.7 Creator badge (bottom-right)
- A cartoon avatar with "I'm **@marclou** ↗ (100% natty btw)" that links to marclou.com.
- Adds personality and humor, and makes it clear who is behind the site.

### 3.8 Primary CTA: "View sponsors" (bottom-center)
- A large button with a scanline texture. It opens the **Meet the sponsors** list.

### 3.9 Timeline / Rewind mode ("Sponsorship history")
- The header subtitle changes to **"SPONSORSHIP HISTORY"**, and a **"× Close timeline"** button appears top-right.
- A bottom **timeline player card** contains:
  - The current event: **sponsor logo, brand name, spot, and date/time in UTC** (e.g. "Stanley · Glutes · 10 Sept, 23:51 UTC").
  - A running counter: "**54** sponsorships".
  - A **scrubber (range slider)** labelled "Sponsorship version", which goes from 0 to 54.
  - A position readout, e.g. `2 / 54`.
  - **Previous sponsor / Play timeline (pause) / Next sponsor** buttons.
  - A "REWIND" label.
- **State 0:** "Before the first sponsor – Every sponsorship starts a new chapter." The body has no logos.
- The 3D body **re-renders the stickers as they were at that point in history**, so you can watch the body fill up and see logos replaced.
- Errors and empty states: "Couldn't load the timeline.", "No sponsorships yet.", "Try again".
- Data comes from `/api/history`, which returns `events[]` with `slotId`, `acceptedAt`, `amount` and `sponsor{brandName, tagline, websiteUrl, logoUrl, xHandle}`.
- **PM note:** this turns the bidding war into content people can replay.

---

## 4. Modals & Panels

### 4.1 How it works ("Sponsor My Body" modal)
- **Big revenue card:** "$112,058 – Paid to race HYROX so far".
- **Story:** who he is, the race date and city, and that he has trained daily for 6 months and is committed to his best time.
- **"By sponsoring my body, here's what you get:"**
  1. **Your logo on this site.** Pay, then upload your logo. It appears on the 3D body with your tagline and startup link. The copy shows a **live count of people on the site right now** ("Put your logo in front of ● 27 people"), with a link saying the count updates live that opens DataFast.
  2. **A tattoo on race day.** If you own the spot when bidding closes, he wears your logo as a temporary tattoo at the race.
  3. **Race content.** Final sponsors appear in his race posts on X (390k followers) and LinkedIn (55k), and in his YouTube video (150k subscribers).
- **Pricing explanation:** most spots double with each takeover. The premium glute spot starts at $10,000 and goes up $5,000 per takeover. Outbid sponsors get a 100% refund with no fees.
- **Sticky footer:** the "Race in" countdown, a status line ("Bidding closed · Race on September 19."), and a **View sponsors** button.
- The body text scrolls inside the modal, and the footer stays fixed.

### 4.2 Meet the sponsors (list modal)
- One row per spot (15 total). Each row shows:
  - **Spot name** (e.g. "Right shoulder")
  - **View count** for that spot (e.g. "(9,752 views)"), **or** a **"New" badge** for recently added spots
  - A **sponsor logo thumbnail and brand name**
  - The **current price** on the right
- Rows are **sorted by price, low to high** ($4k spots first, Glutes at $20k last).
- Hovering a row highlights it, and clicking opens that spot's detail panel and moves the camera to it.
- **Footer link:** "Manage your spot ↗" (goes to `/manage`).

### 4.3 Spot detail panel (right-side panel)
- **Header:** spot name, view count, an **ⓘ Auction rules** button, and a close (×) button.
- **Large sponsor logo**
- **Brand name** (large)
- **"by [X avatar] @handle"**, linking to the sponsor's X profile. The avatar is fetched through `/api/x-avatar/`.
- **Tagline** (e.g. "Every AI Video and Image models")
- **Website link ↗**
- **Price box:** "Sponsored for **$4,000**"
- **When the auction is open**, the price box is replaced by a CTA:
  - Empty spot: **"Claim for $X →"**
  - Occupied spot: **"Take over for $X →"**
  - Payments not yet enabled: **"$X · Opens soon"** (disabled)
  - Fine print: "By continuing, you accept the **auction rules**." The link opens the rules modal.
  - A spot that has been paid for but not yet branded shows "Sponsor details coming soon."
  - Closed states: "Bidding closed." / "Auction cancelled."
  - A loading spinner reads "Opening checkout".

### 4.4 Auction rules modal
- Claim a spot, then add your brand's **logo, tagline and link**. They stay on the site until someone outbids you.
- **Price ladder:** $1,000 → $2,000 → $4,000 → … (doubling). The glutes variant starts at $10,000 and adds $5,000 per takeover.
- If you own the spot at **11 Sept 00:00 UTC (Auction closed)** you get:
  - A temporary tattoo on his body for the race
  - A mention on X (390k) and LinkedIn (55k)
  - Inclusion in a YouTube video (150k)
- **Branding locks at closing.**
- **Outbid:** 100% refund, no fees deducted.
- **No voluntary refunds.** Full refund if he cannot race.
- **"Manage your spot ↗"** link

### 4.5 Real body video modal
See 3.5. It is a vertical video with a close button and a caption.

### 4.6 Live visitors modal (mobile)
See 3.6. The title is "Live visitors by **DataFast**" and it lists flag, country and time.

---

## 5. Purchase & Sponsor Flows (from front-end code; auction was closed when reviewed)

### 5.1 Claim / takeover checkout
1. The user opens a spot and clicks **"Claim for $X"** or **"Take over for $X"**. Clicking the button counts as accepting the rules.
2. The front end calls `POST /api/checkout` with:
   - `attemptId` (UUID, idempotency)
   - `slotId`
   - `version`, the spot's current version number. This is **optimistic concurrency**: if someone else takes over first, the stale checkout is rejected.
   - `rulesAccepted: true`
   - `returnProof` (so the sponsor can edit branding after returning)
   - `visitorId`, the DataFast visitor cookie, used to **attribute revenue to traffic sources**
3. **Stripe Checkout opens in a new tab.** The site opens a blank tab first, then redirects it, which avoids popup blockers.
4. The return states are:
   - "Confirming payment…"
   - "Payment confirmation is taking longer than expected."
   - "Checkout cancelled." (dismissible toast, "Dismiss notification")
   - "Payment received. Add your branding below."

### 5.2 Branding form (after payment)
| Field | Rules |
|---|---|
| **Logo** | Required. PNG, SVG, JPG or WebP, up to **5 MB**. **Chunked upload** in 2 MB parts to `/api/uploads`, stored in Vercel Blob. Shows a preview and "Upload logo" / "Replace logo" / "Uploading…". Errors: "Choose a logo up to 5 MB.", "Upload interrupted. Please try again.", "Upload failed.", "Upload your logo." |
| **Brand name** | Required, **max 12 chars**, with a live counter `n/12`. Placeholder "Your company". |
| **Tagline** | Required, **max 60 chars**, with a live counter `n/60`. Placeholder "What you do". |
| **Website** | Required, `type=url`, must be a full **HTTPS** URL ("Enter a complete HTTPS website URL."). |
| **X handle** | **Optional.** Accepts `@handle` or an x.com/twitter.com URL, validated as 1–15 characters from `[A-Za-z0-9_]` ("Enter a valid X handle, like @marclou."). |

- Input sanitisation: "Remove control characters."
- Buttons: **"Publish branding"** for the first save and **"Save changes"** afterwards, with a "One moment…" spinner.
- Success message: "Branding published."
- Locked states: "Branding is locked." (after close) and "You no longer own this spot." (after being outbid)

### 5.3 Outbid & refund
- When someone takes over, the previous sponsor's logo is replaced right away and they get an **automatic 100% refund through Stripe**.
- The manage page shows the refund status, e.g. "Preparing refund" and "Refunds are initiated through Stripe. Bank processing time can vary."

---

## 6. `/manage`: Sponsor Self-Service Portal

- **Branding:** "BODY BID" wordmark (links home) and an "Auction ↗" link top-right.
- **Login screen:**
  - Title "Manage your spot"
  - "Get a sign-in link using your payment email."
  - **Payment email** field (placeholder you@company.com)
  - **"Email me a link ↗"** button
- **Passwordless magic link:** `POST /api/manage/request-link` sends the email, and `POST /api/manage/exchange` swaps the token for a session (20s timeout, with a 401 error state).
- **Dashboard** (from code), one card per bid:
  - `BID` (spot)
  - `STATUS` (active / outbid / final / cancelled)
  - `AMOUNT PAID`
  - `NEXT TAKEOVER` (price someone else must pay to take the spot)
  - `REFUND` status
  - **Invoice ↗** and **Receipt ↗** (Stripe links)
  - The branding form (5.2) for editing logo, name, tagline and links until close
- Page title: "Manage your sponsorship — Sponsor My Body"

---

## 7. Auction Mechanics & Data

### 7.1 Spots (15)
| Spot | Pricing rule | Final price | Takeovers (version) | Final sponsor |
|---|---|---|---|---|
| Right shoulder | Doubling from $1k | $4,000 | 3 | Higgsfield |
| Left bicep | Doubling | $4,000 | 3 | Higgsfield |
| Left forearm | Doubling | $4,000 | 3 | Higgsfield |
| Right forearm | Doubling | $4,000 | 3 | Higgsfield |
| Right quad (New) | Doubling | $4,000 | 3 | Higgsfield |
| Left calf (New) | Doubling | $4,000 | 3 | OrcaRouter |
| Right calf (New) | Doubling | $4,000 | 3 | Peptide Conf |
| Right chest | Doubling | $8,000 | 7* | Higgsfield |
| Left shoulder | Doubling | $8,000 | 4 | Higgsfield |
| Right bicep | Doubling | $8,000 | 4 | ZeroRank |
| Upper back ("Upper left back") | Doubling | $8,000 | 4 | Higgsfield |
| Lower back ("Upper right back") | Doubling | $8,000 | 4 | Higgsfield |
| Left quad (New) | Doubling | $8,000 | 4 | Sam's List |
| Left chest | Doubling | $16,000 | 5 | Higgsfield (QR code logo) |
| Glutes (New, premium) | $10k start, +$5k steps | $20,000 | 3 | Stanley |

\*The version counter can move past the price step, e.g. when a checkout is cancelled or refunded.

- The final prices add up to **$112,000**. The site shows **$112,058**, which probably includes small extras such as currency conversion or rounding.
- Prices are stored in **cents** (`100000` = $1,000).
- Each spot has a `version`, `nextPrice`, `paidAmount`, `status` (`final` after close) and `occupied`.
- Global auction state: `status` (`closed`), `deadline` (2026‑09‑11T00:00Z), `raceDate` (2026‑09‑19), `paymentsEnabled`, `modelReady` (whether the 3D model has loaded), `serverTime` (keeps the countdown in sync).

### 7.2 Bidding dynamics (from history)
- **54 accepted sponsorships** from 8 Sept 13:46 to 10 Sept 23:51 UTC.
- **Day 1:** about 22 small indie-SaaS sponsors bought $1k–$4k spots within hours, e.g. TrustMRR, DataFast, Postiz, AudioPen and Inbox Zero.
- **Day 2:** the legs were added as new spots. **Glutes launched at $10k and sold immediately.**
- **Evening of Day 2:** **Higgsfield bought about 15 spots in 30 minutes** (a whale takeover), which raised prices across the board.
- **Day 3:** late snipes on single spots (ZeroRank, Mediaboost, Stanley on glutes at $20k just before close).
- **PM insight:** adding new inventory halfway through (legs, glutes) kept things moving, and one big buyer can dominate. Consider **per-brand caps** if you want a variety of sponsors.

### 7.3 View tracking
- `/api/slot-views` returns a views count per spot, shown in the list and the detail panel (e.g. left chest ~34k views, calf ~5k).
- These numbers act as **social proof for the value of each spot**.

---

## 8. Technical Architecture (observed)

| Layer | Tech |
|---|---|
| Framework | **Next.js** (App Router), hosted on **Vercel** |
| 3D | **Three.js** (react-three-fiber style), **GLB model with Draco compression** (`/draco/` decoder wasm), orbit controls, raycast clicks on stickers |
| Video | **Mux** (thumbnails, storyboard, Litix analytics) |
| Music | **YouTube IFrame API** (youtube-nocookie embed), one track per theme |
| Payments | **Stripe Checkout** plus Stripe refunds, invoices and receipts |
| File storage | **Vercel Blob** (`/logos/<uuid>.png`) |
| Validation | **zod** schemas shared by client and server |
| UI primitives | Radix-style accessible dialogs (focus trap, Esc to close, aria labels everywhere) |
| Analytics | **DataFast** (script plus public share dashboard; visitor ID passed to checkout for revenue attribution) |
| Auth | Passwordless magic link (email) for sponsors |
| Fonts | **Geist Variable** (UI), **Orbitron** (countdown/HUD digits) |
| Assets | Country flag SVGs (`/flags/XX.svg`) |

### API endpoints
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/slots` | Auction state and all 15 spots with current sponsor |
| GET | `/api/revenue` | Total raised (`amount`, `currency`, `asOf`) |
| GET | `/api/slot-views` | Views per spot |
| GET | `/api/activity` | Live visitors, today's count, recent visitor events |
| GET | `/api/history` | Every accepted sponsorship (for Rewind) |
| POST | `/api/checkout` | Create Stripe checkout (slotId + version + rulesAccepted) |
| POST | `/api/uploads` (+ `/api/uploads/:id`) | Chunked logo upload |
| GET | `/api/x-avatar/:handle` | Proxy for the sponsor's X avatar |
| POST | `/api/manage/request-link` | Send magic sign-in link |
| POST | `/api/manage/exchange` | Exchange link token for session |
| GET/POST | `/api/manage` | Sponsor dashboard data and branding updates |

Live data is refreshed by **polling** (slots and activity are re-fetched every few seconds; revenue every 5 minutes and when the tab regains focus).

---

## 9. Visual & UX Design

- **Aesthetic:** a cyberpunk / sci-fi "arena" with neon lines, dark backgrounds, a HUD look, and **corner bracket frames** around the viewport.
- **Themes:**
  - **Ares (red):** bg `#130505`, red/crimson neon, pink-red CTA. This is the default and matches `theme-color`.
  - **Legacy (blue):** navy background, cyan neon, a circular glowing platform and a cyan CTA. The site's OG image uses this theme.
- **Typography:** Geist for UI text and Orbitron for the countdown digits.
- **Panels:** translucent dark glass with subtle borders and rounded corners, tinted to the active theme.
- **Micro-details:** scanline/CRT texture on buttons, a pulsing live dot, a "New" pill badge, ↗ arrows on external links, UTC timestamps.
- **Tone of voice:** first person, casual and self-deprecating ("100% natty btw"), short sentences, transparent about money.
- **Accessibility:** buttons have aria labels, dialogs use role=dialog, external links say they open in a new tab, the range slider is labelled, and error messages use role=alert.

### Responsive (mobile 390px)
- Full-screen 3D body centered, with the header and countdown side by side at the top.
- Controls stack **vertically** on the left, and **fullscreen is removed**.
- The visitor feed collapses to "● 6,945 watched today" and opens as a modal.
- The creator badge stays bottom-right and the View sponsors CTA sits above the platform.
- Modals become near full-width sheets with larger touch targets.

---

## 10. SEO & Sharing

- `<title>`: "Sponsor My Body — Marc Lou's HYROX Race"
- Meta description and OG/Twitter description: put your brand on his body, pick a spot, get seen on the site, and have your logo worn as a temporary tattoo on race day.
- **OG image:** 3142×2058 JPG showing the 3D body with example logos in the blue neon arena (with alt text).
- Twitter card `summary_large_image`, site and creator @marclou.
- `robots: index, follow`; `googlebot: max-image-preview:large`.
- `theme-color: #130505`; app icon `icon.png`.

---

## 11. States & Edge Cases Catalogue

| Area | States |
|---|---|
| Auction | opens soon · open (with countdown text) · closed · cancelled |
| Payments | enabled · disabled ("Opens soon") |
| Spot | empty ("Claim") · occupied ("Take over") · paid-but-unbranded ("Sponsor details coming soon") · final/locked |
| Checkout | opening · confirming · slow confirm · cancelled · received |
| Branding | uploading · validation errors · published · saved · locked · ownership lost |
| Refund | preparing · initiated (Stripe) |
| Live data | loading · waiting for activity · unavailable · reconnecting |
| Timeline | loading · error ("Couldn't load the timeline") · empty ("No sponsorships yet") · at 0 ("Before the first sponsor") |
| Media | soundtrack unavailable · fullscreen unavailable |

---

## 12. Adapting This to My Half Marathon (20 Dec 2026)

A direct mapping of each feature, as a starting point:

| HYROX site feature | Half marathon equivalent / idea |
|---|---|
| 15 body spots on a 3D scan | Body/kit spots: chest, back, shoulders, arms, calves, **race bib area**, cap, shoes, and **km-marker spots** (buy "km 1–21") |
| Temporary tattoo on race day | Temporary tattoos, printed singlet patches, or a custom bib/cap |
| Doubling auction + refund on outbid | Same mechanic, or a simpler fixed price per spot at smaller scale |
| Countdown "Race in" | Countdown to 20 Dec 2026 start time |
| Revenue ticker | "Raised so far"; could also be framed as **charity pledges** |
| Rewind timeline | Same, plus a **race-day replay** (km splits synced with sponsor logos) |
| Real body video | Training videos / Strava proof of training |
| Race content for sponsors | Posts on my own channels (use my real follower counts) plus a race-day recap |
| Live visitors | Same (DataFast, Plausible, or custom) |
| New spots added mid-auction | Release km markers or premium spots in waves |
| /manage magic link | Same |

**Open decisions for me to make:**
1. Is money going to me, a charity, or both? This changes the copy and the refund and tax rules.
2. Auction vs. fixed pricing, starting price, increment, and whether to cap spots per brand.
3. 3D body scan (Polycam + Blender) vs. a 2D illustration or photo with hotspots (much cheaper to build).
4. Auction close date: it needs lead time to print tattoos or patches before 20 Dec.
5. Does the race allow logos on kit? Check the race rules.
6. What distribution can I realistically promise sponsors?
7. Payments: Stripe availability in my country, currency, and refunds.

---

## Appendix A: Copy Inventory (key strings, paraphrased where long)
- Header: "Sponsor My Body" · "I'm paid $X to race HYROX." · "Bidding closed · How it works?"
- Countdown label: "Race in"
- CTA: "View sponsors"
- Creator badge: "I'm @marclou (100% natty btw)"
- List title: "Meet the sponsors" · footer "Manage your spot ↗"
- Detail panel: "Sponsored for $X" · "Claim for $X" · "Take over for $X" · "$X · Opens soon"
- Timeline: "SPONSORSHIP HISTORY" · "Close timeline" · "Before the first sponsor" · "N sponsorships" · "REWIND"
- Visitors: "N watched today" · "Live visitors by DataFast" · "Recent visitors"
- Manage: "BODY BID" · "Manage your spot" · "Get a sign-in link using your payment email." · "Email me a link"
- Dashboard labels: BID · STATUS · AMOUNT PAID · NEXT TAKEOVER · REFUND · Invoice ↗ · Receipt ↗
