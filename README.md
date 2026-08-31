# Group Funds Calculator

A fast, phone-friendly shared expense board for Chan, Winston, Wei, Ann, and Lianne. It replaces a group spreadsheet and calculator with one shared view of open splits, payments, personal trackers, and payment records.

## Run locally

```powershell
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Local changes are saved in `splitwise-house-data.json`, which is intentionally ignored by Git.

## Vercel setup — required for shared live data

Vercel serverless functions cannot use the local JSON file as durable storage. Connect an Upstash Redis database before adding real group expenses:

1. In Vercel, open **Group Funds Calculator → Storage** and create or connect an **Upstash Redis** database.
2. Open **Settings → Environment Variables** and add these two values from Upstash:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Tick both **Production** and **Preview** for each variable, then save. The legacy `RMIKO_*` variables are not used by this app.
4. Open **Settings → Deployment Protection → Vercel Authentication**. Disable it for the public production app, or use a public custom production domain. Standard Protection sends API requests to a Vercel login page, so the app cannot load shared data.
5. Redeploy the latest `master` commit.
6. Visit `https://YOUR-DEPLOYMENT/api/health`. It must return JSON with `"storage":"redis"` — not a Vercel login screen.

## Preview checklist

Use a branch and pull request for every change, then test the automatically created Preview URL before merging:

- [ ] The app loads without a Vercel sign-in screen.
- [ ] `/api/health` returns JSON and reports `"storage":"redis"`.
- [ ] Select each of the five profiles; the selection screen appears on entry.
- [ ] Create one test split, refresh the page, and confirm it remains.
- [ ] Open the same Preview URL on a second device or browser and confirm the split appears there.
- [ ] Mark a payment as Cash and Online; confirm both are shown in Payment History.
- [ ] Copy a fund share link, open it in a private window, select a profile, and confirm the fund details open.
- [ ] Do not merge while the status reads **Shared data unavailable** or **Shared storage needs setup**.

Vercel Preview deployments use Preview-scoped variables, while the live branch uses Production-scoped variables. A value added to only Production will not work in Preview. See Vercel’s [preview deployment guide](https://vercel.com/academy/svelte-on-vercel/preview-deployments) and [environment-variable guide](https://examples.vercel.com/kb/guide/how-to-add-vercel-environment-variables).

## Included workflows

- Responsive overview for phone and desktop
- Shared open/settled expense board with sorting and search
- Equal split calculator, formatted descriptions, and receipt attachment
- Fixed five-profile member system with photos, nicknames, payment QR codes, and personal tracker
- Payment confirmation (cash or online), optional note, and audit trail
- Shareable fund links that ask the visitor to select their profile
