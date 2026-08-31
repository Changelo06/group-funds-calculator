# Splitwise House

A fast, no-frills shared-house expense tracker. Create a split fund, select everyone (or just the people involved), split the total equally, and mark each person paid as money comes in.

## Run locally

```powershell
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The app starts with sample housemates and expenses. Local changes are stored in `splitwise-house-data.json`; that runtime data file is ignored by Git.

## Shared Vercel deployment

Deploy the repository to Vercel, then create a Vercel KV store and connect it to this project. Vercel supplies `KV_REST_API_URL` and `KV_REST_API_TOKEN`; when both are present, the API automatically uses that database instead of the local file. Everyone visiting the deployment then reads and updates the same shared data.

The backend needs no runtime dependencies. `api/index.js` is the Vercel serverless entrypoint and `api.js` holds the API plus the storage adapter.

## Included workflows

- Responsive overview for phone and desktop
- Add, view, edit, delete, search, and filter split funds
- Equal per-person calculation and a one-tap **All members** selector
- Add and remove members
- Mark each person paid; a fund becomes settled once everyone has paid
- 15-second refresh for changes made by someone else
