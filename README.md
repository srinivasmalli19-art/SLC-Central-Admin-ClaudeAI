# SLC Central Admin

Central Admin control plane for SLC Technologies' applications, to be hosted at
`https://slcvet.com/admin`.

Start here:

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — system design
- [docs/APPLICATION-INVENTORY.md](./docs/APPLICATION-INVENTORY.md) — discovery of existing SLC apps
- [docs/INTEGRATION-STRATEGY.md](./docs/INTEGRATION-STRATEGY.md) — how/which apps get integrated, and in what order
- [docs/ROADMAP.md](./docs/ROADMAP.md) — phased build plan
- [docs/PHASE-1-IMPLEMENTATION.md](./docs/PHASE-1-IMPLEMENTATION.md) — **setup instructions, environment variables, and what's built so far**
- [CLAUDE.md](./CLAUDE.md) — condensed architectural rules for future work on this repo

## Quick start

```bash
npm install
cp backend/.env.example backend/.env    # fill in DATABASE_URL, JWT_SECRET, SEED_SUPER_ADMIN_*
cp frontend/.env.example frontend/.env
createdb slc_central_admin_dev
cd backend && npx prisma migrate dev && npm run db:seed && cd ..
npm run dev:backend    # :4000
npm run dev:frontend   # :5173
```

Full details in [docs/PHASE-1-IMPLEMENTATION.md](./docs/PHASE-1-IMPLEMENTATION.md).
