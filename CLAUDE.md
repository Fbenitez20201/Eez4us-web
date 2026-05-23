# Eez4us — Reglas duras del proyecto

Sistema de coordinación de recogida vehicular en zonas escolares.
Padre (mobile) presiona "voy en camino", colegio ve el ETA en tiempo real,
geofence dispara "Llegué" automático al entrar al colegio.

## Stack (ley, no se discute)

Definido por el team leader en `eez4us-web-arquitecture.md` + decisiones del producto. **Las decisiones de stack abajo son ley.**

- **Dos repos separados** (NO monorepo): `eez4us-web` y `eez4us-mobile`
- **Web admin**: Next 15 App Router + **OpenNext en Cloudflare Workers** + Tailwind + shadcn/ui
- **Mobile**: Expo SDK 54 + expo-router + NativeWind v4 + Nunito
- **DB**: Prisma + **Prisma Postgres** + **Accelerate** (NO Neon)
- **Auth**: **better-auth** (NO Auth.js). Cookies para web + Bearer JWT para mobile (plugin `jwt()`). Solo email+password, NO OAuth/social
- **Mapas**: **Google Maps** (NO Mapbox). Web: `@vis.gl/react-google-maps`. Mobile: `react-native-maps`
- **Realtime**: **Pusher Channels** (NO Supabase Realtime). Canales `private-encrypted-*` con NaCl secretbox vía `tweetnacl`. `encryptForChannel()` deriva clave per-channel con HMAC-SHA256(masterKey, channelName)
- Stripe para cobro recurrente de colegios
- n8n self-hosted (VPS Hetzner ~$5/mes) para WhatsApp, facturas, citas
- Turf.js en backend para cálculos geoespaciales (ETA, dead reckoning, point-in-polygon)
- Tracking background mobile: `react-native-background-geolocation` (Transistor, $399 STARTER no se compra hasta /goal 4)

## Identidad del producto

- Mobile-first puro. Web SOLO panel admin.
- CERO landing pública. CERO versión web del producto para usuarios finales.
- "/" del web NO es navegable salvo login admin.
- Tres tipos de usuario:
  - **Padre** (mobile)
  - **Director** (web admin)
  - **Super-Admin Eez4us** (web admin)
- v2 no se toca ahora: "Niños con celular".

## Estética

- Duolingosa: Nunito redonda grande, botones con elevación, esquinas muy
  redondeadas, micro-animaciones de feedback en cada tap.
- Sin emojis decorativos en UI productiva.
- Sin banderas, sin código país en inputs de teléfono.

## Base de datos: Prisma Postgres + Accelerate (Workers-only en runtime)

Tres URLs en `.env` del repo web. Cuál usar:

- **`DATABASE_URL`** (Accelerate, `prisma+postgres://accelerate.prisma-data.net/...`)
  - Única URL válida en runtime sobre Cloudflare Workers (HTTP, no TCP).
  - `PrismaClient` se importa desde `@prisma/client/edge` (motor WASM, sin binario nativo).
  - Se extiende con `withAccelerate()` desde `@prisma/extension-accelerate`.
  - Singleton a nivel módulo, NO por request (recarga el WASM y leakea conexiones).
  - Cache opcional con `cacheStrategy: { ttl, swr }` por query.
- **`DIRECT_URL`** (directa a `db.prisma.io:5432`)
  - `schema.prisma` la usa como `directUrl`.
  - Migraciones (`prisma migrate dev/deploy`), `prisma db push/pull`, seeds, `prisma studio`. CLI-only, NUNCA en runtime de Workers.
- **`POOLED_URL`** (pooled sin Accelerate). Reserva, hoy NO se usa.

Mobile NO accede a DB directo — todo va por la API HTTP del web.

Nunca commitear el `.env`. Cambios de credenciales solo con permiso explícito.

## Auth — better-auth

- Una sola instancia de `betterAuth()` sirve cookies (web) y JWT (mobile) — sin branching de transporte.
- Adapter: `@better-auth/prisma-adapter` apuntando al `PrismaClient` con Accelerate.
- Plugin `jwt()` para emitir Bearer JWT al mobile.
- Hashing: **scrypt** por defecto (Web Crypto, edge-safe, sin WASM). NO meter argon2 hasta que surja necesidad real.
- Schema: User, Session, Account, Verification generados por `npx better-auth generate`. Campos extra en User: `schoolId`, `role` (parent/director/super-admin).
- JWT payload: inyectar `schoolId` + `role` vía `definePayload`.
- Email verification built-in (`requireEmailVerification: true`). El envío vía webhook a n8n.
- `auth.api.getSession({ headers })` resuelve cookies o Bearer indistintamente.

## Realtime — Pusher con NaCl secretbox

- **Server SDK `pusher` (npm) NO funciona en Workers** (usa Node `http`/`crypto`). Usar wrapper fetch-based propio:
  - `crypto.subtle.sign` para HMAC-SHA256 de la auth signature.
  - `@noble/hashes` para MD5 del body (Workers no expone MD5).
- Para `private-encrypted-*`:
  - `encryptForChannel(channelName, payload, masterKey)`:
    1. `channelKey = HMAC-SHA256(masterKey, channelName)` (32 bytes raw)
    2. `nonce = nacl.randomBytes(24)`
    3. `box = nacl.secretbox(plaintext, nonce, channelKey)`
    4. Enviar `{ nonce: base64(nonce), ciphertext: base64(box) }` como `data` al REST de Pusher.
  - `authorizeChannel()` en `/api/pusher/auth` devuelve `{ auth, shared_secret: base64(channelKey) }`.
- **Web client**: importar `pusher-js/with-encryption` (NUNCA `pusher-js` a secas — los `private-encrypted-*` se dropean silenciosamente).
- **Mobile client**: `@pusher/pusher-websocket-react-native` NO soporta `private-encrypted-*` nativo. Decrypt manual con `tweetnacl`: fetch del `shared_secret` al subscribe, decrypt cada evento entrante.
- Webhooks de Pusher: verificar `X-Pusher-Signature` con `crypto.subtle.verify` (NUNCA `crypto.createHmac`).
- `PUSHER_ENCRYPTION_MASTER_KEY`: 32 bytes random, Cloudflare Secret. Ortogonal al app secret de Pusher.

## Reglas que ya pagamos caras (no negociables)

- Mobile SIEMPRE pega a `www.[dominio]`, nunca al apex.
  Razón: el redirect 308 dropea el header `Authorization` cross-host.
- `EXPO_PUBLIC_*` es build-time → cambio de URL = rebuild EAS, no OTA.
- Sin namespace re-exports (`export * as foo`) en código que toca RSC.
- `expo-updates` atado a la versión exacta del SDK (SDK 54 → `~29.0.17`).
- Nunca importar `Prisma` ni tipos del schema en componentes cliente.
- `await` en TODO side-effect async. Nada de fire-and-forget.
- Migración Prisma corrida ANTES de deployar el cambio de schema.
- Contadores en hot path: campo denormalizado, no `count()` de la tabla.
- **Workers-specific**: nunca `export const runtime = 'nodejs'` en routes. Nunca `node:crypto`, `node:fs`, `node:net`. Solo `crypto.subtle`, `fetch`, Web APIs.

## Reglas específicas de Eez4us

- **Multi-tenant por `schoolId` en TODAS las queries, sin excepción.**
  Query sin filtro de `schoolId` que devuelva data de otro colegio = bug
  de seguridad crítico.
- Permisos de ubicación: "When In Use" en iOS, NUNCA "Always".
- Android Foreground Service obligatorio mientras hay tracking activo.
- Llamadas a Google Directions API SIEMPRE desde backend con cache + throttling.
  Recalcular solo si el padre se desvía >100m o cada 3 min.
- ETA y dead reckoning viven 100% en backend. El cliente solo manda
  lat/lng/heading/speed crudos cada 5s.
- Geofencing: server-side con `turf.booleanPointInPolygon`. NO usar Google Geofencing nativo (Android-only + exige `ACCESS_BACKGROUND_LOCATION`).
- API Keys de Google Maps: tres separadas (web con HTTP referrer, iOS con bundle ID, Android con package + SHA-1). Una cuarta key de backend para Directions.

## Deploy

- **Web admin**: Cloudflare Workers vía OpenNext.
  - `wrangler deploy` (manual o vía CI).
  - `wrangler.toml`: `compatibility_flags = ["nodejs_compat"]` obligatorio.
  - Secrets vía `wrangler secret put`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PUSHER_*`, `GOOGLE_MAPS_BACKEND_KEY`, etc.
  - Tier: Workers Paid (Unbound) por CPU time + tamaño de bundle (Prisma WASM ~3MB).
  - Cuenta de Cloudflare a usar (propia vs cliente): pendiente de definir, todo en boilerplate hasta entonces.
- **Mobile**: EAS Build + OTA con `expo-updates` para parches JS-only.
- Commits en español, cortos, imperativos, sin `Co-Authored-By`.
- Nunca tocar secrets de Cloudflare/EAS sin permiso explícito.

## NO hacer sin pedirlo

- Landing pública, marketing, SEO, sitemaps.
- Librerías "por las dudas" (analytics, i18n, state managers que no
  sean React Context o Zustand).
- Comentarios explicando QUÉ hace el código.
- README, docs, ni archivos .md más allá de `CLAUDE.md`.
- Soporte a "Niños con celular" (v2).
