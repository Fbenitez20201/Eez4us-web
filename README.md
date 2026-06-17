# Eez4us — Web Admin

Panel de administración web de **Eez4us**, sistema de coordinación de recogida
vehicular en zonas escolares. El padre (app mobile) avisa "voy en camino", el
colegio ve el ETA en tiempo real y un geofence dispara el aviso de llegada.

> **Solo panel admin.** No hay landing pública ni versión web para usuarios
> finales: el producto para padres es exclusivamente mobile (repo aparte,
> `eez4us-mobile`). El `/` del web no es navegable salvo login admin.

## Stack

- **Next (App Router)** sobre **OpenNext en Cloudflare Workers**
- **Tailwind CSS** + **shadcn/ui** + Nunito
- **Prisma** + **Prisma Postgres** + **Accelerate** (motor edge/WASM)
- **better-auth** — cookies (web) + Bearer JWT (mobile), solo email+password
- **Google Maps** (`@vis.gl/react-google-maps`)
- **Pusher Channels** — canales `private-encrypted-*` con NaCl secretbox
- **Stripe** — cobro recurrente B2B a las escuelas

Roles: `director`, `support_staff`, `vendor`, `super_admin` (web) y `parent` (mobile).

## Requisitos

- Node >= 20
- pnpm 10.33.2 (`packageManager` pineado)

## Desarrollo

```bash
pnpm install
cp .env.example .env   # completar con credenciales reales
pnpm db:generate       # prisma generate
pnpm db:migrate        # migraciones en la DB de dev
pnpm dev               # http://localhost:3000
```

### Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm dev` | Next en modo dev |
| `pnpm build` | `next build --webpack` |
| `pnpm build:cf` | Build del Worker con OpenNext (genera `.open-next/`) |
| `pnpm preview:cf` | Preview local del Worker |
| `pnpm deploy:cf` | `build:cf` + `wrangler deploy` |
| `pnpm db:migrate` / `db:migrate:deploy` | Migraciones Prisma |
| `pnpm db:studio` | Prisma Studio |

## Deploy (Cloudflare Workers)

CI vía **Cloudflare Workers Builds** conectado a la branch `main`:

- **Build command:** `pnpm run build:cf`
- **Deploy command:** `pnpm run db:migrate:deploy && pnpm exec wrangler deploy`
- **Non-production:** `pnpm exec wrangler versions upload`

Dominio de producción: **eez4us.com** (apex servido directo por el Worker; `www`
también bindeado como Custom Domain, sin redirect 308).

### Secrets de runtime — `wrangler secret put NAME`

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `PUSHER_APP_ID`, `PUSHER_KEY`,
`PUSHER_SECRET`, `PUSHER_ENCRYPTION_MASTER_KEY`, `GOOGLE_MAPS_BACKEND_KEY`,
`RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`,
`STRIPE_PORTAL_RETURN_URL`, `N8N_WEBHOOK_URL`, `EXPO_ACCESS_TOKEN`, `CRON_SECRET`.

### Build variables (NO son secrets, van en el dashboard)

`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`,
`NEXT_PUBLIC_GOOGLE_MAPS_WEB_KEY`, `DIRECT_URL` (la usa `prisma migrate deploy`),
`PNPM_VERSION=10.33.2`.

---

Las reglas duras del proyecto viven en [`CLAUDE.md`](./CLAUDE.md).
