# ClientOps Portal

A capstone portfolio application demonstrating modern full-stack product engineering for multi-workspace agency operations.

**Live demo:** [donovantownes.dev/clientops](https://donovantownes.dev/clientops)  
**Portfolio:** [donovantownes.dev](https://donovantownes.dev)

---

## Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Auth:** NextAuth v4 (credentials provider, JWT sessions)
- **Database:** PostgreSQL via Prisma ORM + `@prisma/adapter-pg`
- **Styling:** Tailwind CSS v4
- **Testing:** Vitest (103 tests, 16 suites)

## Features

- Multi-workspace management with role-based access control (Owner / Admin / Contributor / Viewer)
- Task management with status lifecycle (To Do → In Progress → Done)
- Team membership with email-based invite tokens
- Deliverables file metadata tracking
- Dashboard KPI summary with live per-workspace scoping
- Activity log for workspace audit events

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL running locally

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd client-ops-portal

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your local DATABASE_URL and a NEXTAUTH_SECRET

# 4. Run database migrations
npx prisma migrate deploy

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000/clientops](http://localhost:3000/clientops) — the `basePath` is `/clientops`.

### Scripts

```bash
npm run dev       # development server
npm run build     # production build
npm run lint      # ESLint
npm run test      # Vitest (all tests)
```

---

## Deployment (Vercel + Neon)

### 1. Create a Neon PostgreSQL database

1. Go to [neon.tech](https://neon.tech) and create a free project.
2. Copy the **connection string** — it looks like:
   ```
   postgresql://<user>:<password>@<host>.neon.tech/<dbname>?sslmode=require
   ```

### 2. Deploy to Vercel

1. Push the repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Set the **Root Directory** to `client-ops-portal` (if using the monorepo layout).
4. Add these **Environment Variables** in the Vercel dashboard:

   | Variable              | Value                                 |
   | --------------------- | ------------------------------------- |
   | `DATABASE_URL`        | Your Neon connection string           |
  | `NEXTAUTH_URL`        | `https://donovantownes.dev/clientops/api/auth` |
   | `NEXTAUTH_SECRET`     | A secure random 32-byte hex string\*  |
   | `ENABLE_FILE_UPLOADS` | `false`                               |

   \*Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

5. Deploy. Vercel will run `npm run build` automatically.

### 3. Run database migrations in production

After the first deploy, run migrations against the Neon database:

```bash
# Set DATABASE_URL to your Neon connection string temporarily
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

Or run it as a Vercel build command prefix:

```
npx prisma migrate deploy && npm run build
```

### 4. Custom domain routing

The app uses `basePath: '/clientops'`. The root domain `donovantownes.dev` is owned by a separate portfolio project. Add a rewrite to the **portfolio project's** `vercel.json` to proxy the `/clientops` prefix to this deployment:

```json
{
  "rewrites": [
    {
      "source": "/clientops/:path*",
      "destination": "https://<clientops-vercel-url>.vercel.app/clientops/:path*"
    }
  ]
}
```

Replace `<clientops-vercel-url>` with this project's actual Vercel deployment URL (e.g. `client-ops-portal-abc123.vercel.app`). The ClientOps Portal project itself does **not** need to be assigned the custom domain — all traffic is proxied through the portfolio project.

> **Note:** Do not assign `donovantownes.dev` as a custom domain in this Vercel project. Leave domain assignment to the portfolio project only.

---

## Environment Variables Reference

See [`.env.example`](.env.example) for all variables with descriptions.

| Variable              | Required | Description                                             |
| --------------------- | -------- | ------------------------------------------------------- |
| `DATABASE_URL`        | Yes      | PostgreSQL connection string                            |
| `NEXTAUTH_URL`        | Yes      | Full auth endpoint URL (`/clientops/api/auth`)          |
| `NEXTAUTH_SECRET`     | Yes      | JWT signing secret — use a strong random value in prod  |
| `ENABLE_FILE_UPLOADS` | No       | Set to `"false"` to disable uploads in demo deployments |

---

## Project Structure

```
src/
  app/
    (protected)/dashboard/   # main dashboard (server + client components)
    api/                     # API routes (auth, workspaces, tasks, deliverables, members, activity, invites)
    login/ register/         # auth pages
    invite/[token]/          # invite acceptance
  components/
    workspace-dashboard-client.tsx   # full dashboard client component
    app-header.tsx                   # top nav with auth state
  lib/
    auth.ts                  # NextAuth config
    prisma.ts                # Prisma client singleton
    rbac.ts                  # role-based permission checks
    workspaces.ts            # workspace resolution helpers
prisma/
  schema.prisma              # database schema
  migrations/                # migration history
```
