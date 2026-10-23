# Birthday Tab

Scan a restaurant receipt, send one link, and everyone taps what they had. No accounts. The organizer page shows who claimed what, live, plus every unclaimed item and amount.

## How it works

- **Organizer** opens `/`, scans or types the bill, and taps *Create bill*. They land on `/b/<id>/admin?k=<key>`, the organizer page. Bookmark it: the key in the address is what lets you edit.
- **Guests** open `/b/<id>`, type a name, and tap items. Picks save automatically (a random id in their browser identifies them, no sign-in).
- **Splitting rules**
  - A dish picked by several people is split between them automatically.
  - Items with a quantity above 1 (3 margaritas) let each guest say how many they had.
  - Tax, included gratuity, fees and tip are shared in proportion to each person's items.
  - The birthday person's marked items, with their tax and tip, are split evenly among everyone who claimed something, or among a fixed number you set.
- **Organizer page** polls every 3 seconds: bill total, claimed, still unclaimed, unclaimed items with their cost including tax and tip, each person's breakdown, and a remove button for test or duplicate entries.

## Deploy (about 15 minutes)

1. **Supabase**: create a free project at supabase.com. Open *SQL Editor*, paste `supabase/schema.sql`, run it. From *Project Settings > API* copy the Project URL and the `service_role` key.
2. **OpenAI** (for scanning): create an API key at platform.openai.com and make sure the API account has credit.
3. **GitHub**: push this folder to a new repository.
4. **Vercel**: *Add New > Project*, import the repo, and add these environment variables (see `.env.example`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (optional, defaults to `gpt-6-astra`)
   - `CREATE_PASSCODE` (recommended, so strangers cannot create bills or spend your scanning credits)
5. Deploy. Open the site, create the bill, and copy the guest link from the organizer page.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

## Notes

- The `service_role` key stays on the server. Row level security is on with no policies, so nothing can be read or written with the public key.
- Guest ids live in each guest's browser. If a guest switches phones they show up as a new person; remove the old entry from the organizer page.
- Re-scanning on the organizer page replaces the item list, which drops picks guests already made. Scan before you send the link.
