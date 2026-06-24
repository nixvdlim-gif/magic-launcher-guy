# Cloudflare Workers Deploy

Build output is fully Cloudflare-ready (Nitro `cloudflare-module` preset).

## One-time setup

1. **Cloudflare**: create an API Token (template: *Edit Cloudflare Workers*) and grab your Account ID.
2. **GitHub repo → Settings → Secrets and variables → Actions**, add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`

Values for the `VITE_*` keys are in your local `.env`.

## Deploy

Just push to `main`. The workflow at `.github/workflows/deploy.yml` builds and deploys.

## Manual deploy from your machine

```bash
bun install
bun run build
cd dist/server
bunx wrangler deploy
```

The worker name is auto-generated; rename it by editing `dist/server/wrangler.json` after build, or set `nitro.cloudflare.deployConfig` in `vite.config.ts`.

## One-command deploy from this machine

After editing code or adding Supabase migrations, run:

```powershell
npm run deploy:all -- -Message "Describe your change"
```

This script does three things in order:

1. Links the Supabase project from `.env` / `supabase/config.toml`.
2. Runs `supabase db push` so migrations go to Supabase.
3. Commits and pushes Git changes to `main`, which triggers the Cloudflare Workers deploy workflow.

Use this when only app code changed and no database migration is needed:

```powershell
npm run deploy:all:no-db -- -Message "Describe your change"
```

The live build still depends on GitHub Actions secrets. Keep these updated in GitHub repo settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
