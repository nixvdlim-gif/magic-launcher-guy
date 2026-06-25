# Magic Launcher Guy 🚀

A modern web application built with TypeScript, React, and TanStack technologies.

## Stack

- **Frontend**: React 19 + TypeScript
- **Framework**: TanStack Start
- **Build**: Vite
- **Styling**: Tailwind CSS + Radix UI
- **Backend**: Supabase (PostgreSQL)
- **Hosting**: Cloudflare Workers
- **Runtime**: Bun

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed

### Installation

```bash
bun install
```

### Development

```bash
bun run dev
```

The app runs at `http://localhost:5173`

### Build

```bash
bun run build
```

Output goes to the `dist/` directory.

### Deploy

Push to `main` branch and GitHub Actions will automatically deploy to Cloudflare Workers.

For manual deployment:

```bash
bun run build
cd dist/server
bunx wrangler deploy
```

## Environment Variables

Create a `.env` file:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

## Scripts

- `bun run dev` - Start dev server
- `bun run build` - Build for production
- `bun run preview` - Preview production build
- `bun run lint` - Run ESLint
- `bun run format` - Format code with Prettier
- `bun run deploy:all` - Deploy app + database to Supabase

## Learn More

- [TanStack Start Docs](https://tanstack.com/start/latest)
- [Vite](https://vitejs.dev)
- [React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com)
