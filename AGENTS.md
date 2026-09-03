# Group Funds Calculator — Agent Guide

## Project purpose

RM331 is a lightweight, mobile-friendly shared-expense tracker for a small household group. It combines a calculator, split-fund board, payment audit trail, member IDs, and payment QR profiles without requiring a separate spreadsheet.

The primary members are Chan, Winston, Wei, Ann, and Lianne. A selected profile is required before the tracker can be used. Chan is the group administrator, but this is a lightweight browser-based group tool rather than a high-security authentication system.

## Repository map

- `index.html` contains the static application shell and modal containers.
- `app.js` contains browser state, rendering, form behavior, calculations, and API calls.
- `styles.css` contains the responsive UI and visual system.
- `api.js` is the shared-state API implementation.
- `api/` contains Vercel-compatible API entry points, including share-link metadata.
- `server.js` runs the local Node server.
- `splitwise-house-data.json` is only the local fallback data store.
- `vercel.json` and `package.json` contain deployment and runtime configuration.

## Product constraints

- Keep the app fast and mobile-first. Prefer small DOM/CSS changes over heavy libraries, large images, or unnecessary network calls.
- Preserve the black, white, and restrained gray visual direction. Red is reserved for unpaid attention states; green indicates paid/receivable states where already established.
- Do not expose the tracker or fund details before a profile has been chosen.
- Keep payment and fund data dynamic. Do not hardcode member-specific balances, notification counts, payment status, or fund details into the UI.
- Reuse loaded state for computed summaries and notifications. Do not add a separate request just to calculate a display count.
- Preserve the payment audit trail. Marking a payment paid requires cash or online confirmation; the optional note and timestamp must remain associated with the action.
- Receipt attachments are optional. Validate image type and size, keep the attachment linked to its fund, and make its failure state clear.
- Member profiles and payment QR details should remain editable only according to the existing profile/admin rules.

## Implementation guidance

- This is a vanilla JavaScript application. Avoid framework migrations or broad rewrites unless explicitly requested.
- Maintain the existing route/hash behavior: `overview`, `funds`, `members`, and `profile`.
- Preserve working fund modes: equal split and itemized order. For equal splits, calculate each share from the bill total and the people selected to pay.
- Keep destructive actions deliberate: require confirmation for deleting a fund or permanent profile/payment changes.
- Use accessible buttons, labels, focus states, and concise live-status text for asynchronous work.
- Use lightweight, purposeful motion. Respect `prefers-reduced-motion` and do not use animation to conceal a failed request.
- Keep share links public-domain-safe: never construct a hosted share redirect using a fixed `localhost` origin.

## Data and deployment

- Never commit credentials, API keys, Redis URLs, tokens, or `.env` files.
- The deployed app requires its configured shared storage to persist data between people and refreshes. Treat local fallback data as development-only.
- Keep Vercel handlers compatible with the current Node runtime in `package.json`.
- Avoid changing build/deployment configuration unless the task requires it.

## Verification checklist

After JavaScript changes, run:

```powershell
node --check app.js
git diff --check
```

When API files change, also run syntax checks for the affected Node files. Verify the affected flow manually when practical, especially for:

- initial loading and mandatory profile selection;
- creating, editing, deleting, and opening a split fund;
- equal and itemized calculations;
- payment confirmation, reopening, and audit history;
- receipt upload and preview;
- mobile layout and profile switching.

## Interface quality standard

- Make every important interaction keyboard-operable. Use native elements before ARIA, give icon-only controls descriptive names, and keep focus rings visible with `:focus-visible`.
- Use generous, forgiving hit targets: at least 24 px for desktop controls and 44 px for touch controls. Do not leave decorative-looking parts of an interactive control inert.
- Keep browser zoom enabled. On mobile, use 16 px or larger text inputs where possible to prevent unintended browser zoom.
- Keep each UI state honest: design loading, empty, dense, success, and failure states. A failed request must offer recovery, not an endless loader.
- Loading feedback should preserve the original action label, use an ellipsis while work is in progress, and avoid flicker by delaying very short states or keeping them visible briefly when shown.
- Prefer targeted, reversible optimistic feedback for likely-successful actions. If the request fails, restore the prior UI and explain how to recover.
- Confirm destructive actions or provide a safe undo path. Never make deletion accidental.
- Use URLs for shareable, refresh-safe context such as the active fund. Preserve expected Back/Forward behavior where a view has meaningful state.
- Use CSS `transform` and `opacity` for motion whenever practical. Keep animation purposeful, interruptible, and compatible with `prefers-reduced-motion`; never transition every property with `transition: all`.
- Match skeleton dimensions to the final layout to avoid layout shift. Do not use a skeleton to hide an error or a long-running operation.
- Maintain intentional alignment, intrinsic responsive layout, safe-area spacing, and no unwanted horizontal overflow across mobile, laptop, and wide screens.
- Use clear text alongside color-dependent meaning. Status, payment state, and errors must remain understandable without relying on color alone.
- Keep labels associated with controls, place validation near the affected field, retain input values on validation failures, and never block paste or normal typing without feedback.
- Use locale-aware money and dates, tabular numerals where values are compared, and resilient layouts for short or very long user-provided content.
- Minimize main-thread work and unnecessary rerenders. Reserve image space, lazy-load noncritical imagery, and avoid additional network calls when the required data is already in memory.

## Git workflow

- Keep commits focused and use descriptive messages.
- Do not overwrite or discard unrelated user changes.
- Push to `origin/master` only after the requested work is complete and verified.
