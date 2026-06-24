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
