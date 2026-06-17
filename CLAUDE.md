# Eez4us — Reglas duras del proyecto

Sistema de coordinación de recogida vehicular en zonas escolares.
Padre (mobile) presiona "voy en camino", colegio ve el ETA en tiempo real,
geofence dispara "Llegué" automático al entrar al colegio.

## Stack

El stack web (Workers + better-auth + Pusher + Google Maps + Prisma) está
definido por el team leader en `eez4us-web-arquitecture.md` y es ley.
El stack mobile (RN + Expo + react-native-maps + Pusher RN + tweetnacl) es
decisión técnica del proyecto, no del jefe, pero ya está endosada.

- **Dos repos separados** (NO monorepo): `eez4us-web` y `eez4us-mobile`
- **Web admin**: Next 15 App Router + **OpenNext en Cloudflare Workers** + Tailwind + shadcn/ui
- **Mobile**: Expo SDK 54 + expo-router + NativeWind v4 + Nunito
- **DB**: Prisma + **Prisma Postgres** + **Accelerate** (NO Neon)
- **Auth**: **better-auth** (NO Auth.js). Cookies para web + Bearer JWT para mobile (plugin `jwt()`). Solo email+password, NO OAuth/social
- **Mapas**: **Google Maps** (NO Mapbox). Web: `@vis.gl/react-google-maps`. Mobile: `react-native-maps`
- **Realtime**: **Pusher Channels** (NO Supabase Realtime). Canales `private-encrypted-*` con NaCl secretbox vía `tweetnacl`
- Stripe para cobro recurrente **a las escuelas** (modelo B2B2C, ver Identidad)
- n8n self-hosted (VPS Hetzner ~$5/mes) para WhatsApp (Meta API), facturas, citas
- Turf.js en backend para distancias geoespaciales (`turf.distance` para geofence circular)
- Tracking background mobile: `react-native-background-geolocation` (Transistor, $399 STARTER no se compra hasta /goal 4)

## Identidad del producto

- Mobile-first puro. Web SOLO panel admin.
- CERO landing pública. CERO versión web del producto para usuarios finales.
- "/" del web NO es navegable salvo login admin.
- **Modelo B2B2C**: Eez4us le cobra a las escuelas ($10 USD/alumno/mes vía Stripe). Las escuelas suman ~$40 USD a la colegiatura al padre. **Los padres NUNCA pagan directo a Eez4us** — solo a la escuela.
- **Cinco roles** (todos en `User.role`):
  - **`parent`** (mobile): claimea invitación → vehículos + familiares autorizados → "voy en camino"
  - **`director`** (web): configurar escuela, pickup points en Google Maps, alta/baja alumnos+grados+padres, subir Excel para invitations, dashboard, Stripe, reportes
  - **`support_staff`** (web — profesores/auxiliares): tablero, filtros, **finalizar manualmente "Entrega del niño"** (geofence trigger es aviso, NO es prueba de entrega)
  - **`vendor`** (web): crear escuelas, comisiones, tickets
  - **`super_admin`** (web): todo lo anterior + n8n, facturación global, soporte
- v2 NO se toca ahora: "Niños con celular".

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

## Auth — better-auth + Invitations

- Una sola instancia de `betterAuth()` sirve cookies (web) y JWT (mobile) — sin branching de transporte.
- Adapter: `@better-auth/prisma-adapter` apuntando al `PrismaClient` con Accelerate.
- Plugin `jwt()` para emitir Bearer JWT al mobile.
- Hashing: **scrypt** por defecto (Web Crypto, edge-safe, sin WASM). NO meter argon2 hasta que surja necesidad real.
- Campos extra en User: `schoolId`, `role`, `phoneE164`.
- JWT payload: inyectar `schoolId` + `role` vía `definePayload`.
- `auth.api.getSession({ headers })` resuelve cookies o Bearer indistintamente.

### Flujo de onboarding (Excel-driven, NO self-signup tradicional)

1. **Director** sube Excel desde panel web con padres + alumnos + contactos (email/whatsapp).
2. Backend crea una `Invitation` por padre con:
   - `token` (unique, cuid)
   - `channel = EMAIL` si tiene email; sino `WHATSAPP` si tiene phone. **Email prioritario sobre WhatsApp siempre.**
   - `studentIds[]` con los alumnos que se le asignarán al claim
3. Envío:
   - `EMAIL` → Resend (o el provider que usemos via n8n) con link `https://www.tu-dominio.tld/invite/{token}`
   - `WHATSAPP` → POST a webhook n8n con `{ phone, link, name, studentNames }`. n8n llama a Meta Cloud API.
4. Padre claimea:
   - Deep link al mobile (`eez4us://invite/{token}`) o web → `POST /api/auth/claim-invitation { token, password, name, phoneE164? }`
   - Backend valida token, crea User con `role=parent`, vincula `ParentStudent[]`, marca `Invitation.claimedAt`.
   - Mobile guarda el JWT en SecureStore y entra al app principal.
5. Self-signup tradicional (`/api/auth/sign-up/email`) **está deshabilitado** o restringido — solo entran vía Invitation.

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

### Convención de nombres de canales

- **`private-encrypted-school-{schoolId}-pickup-{pickupPointId}`**
  Para staff de la escuela (director + support_staff). Recibe la lista **ranked por ETA** de todos los `Trip`s activos hacia ese pickup point. `authorizeChannel` valida `session.user.schoolId === schoolId` y `session.user.role IN (director, support_staff, super_admin)`.
- **`private-encrypted-trip-{tripId}`**
  Solo el padre dueño del Trip. Recibe su propia posición echo + ETA. `authorizeChannel` valida `session.user.id === trip.parentId`.
- **Privacidad NO negociable**: el padre NUNCA recibe data de otros padres. Solo staff de la escuela ve el ranking global.

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
- **Pickup points por escuela**: una escuela puede tener varios (puerta principal, lateral, etc.). El director los configura con marker en Google Maps + radio en metros.
- **Geofence = CÍRCULO**, no polígono. Stored como `{ centerLat, centerLng, radiusMeters }`. Server-side check con `turf.distance(point, center) < radiusMeters` (Haversine). NO usar `turf.booleanPointInPolygon`, NO usar Google Geofencing nativo (Android-only + exige `ACCESS_BACKGROUND_LOCATION`).
- **"Entrega del niño" se finaliza MANUALMENTE** por `support_staff` o `director`. El evento `ARRIVED_GEOFENCE` es solo aviso al staff, NO es prueba de entrega.
- Permisos de ubicación: "When In Use" en iOS, NUNCA "Always".
- Android Foreground Service obligatorio mientras hay tracking activo.
- Llamadas a Google Directions API SIEMPRE desde backend con cache + throttling.
  Recalcular solo si el padre se desvía >100m o cada 3 min.
- ETA y dead reckoning viven 100% en backend. El cliente solo manda
  lat/lng/heading/speed crudos cada 5s.
- API Keys de Google Maps: tres separadas (web con HTTP referrer, iOS con bundle ID, Android con package + SHA-1). Una cuarta key de backend para Directions.

## Deploy

- **Web admin**: Cloudflare Workers vía OpenNext.
  - `wrangler deploy` (manual o vía CI).
  - `wrangler.toml`: `compatibility_flags = ["nodejs_compat"]` obligatorio.
  - Secrets vía `wrangler secret put`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PUSHER_*`, `GOOGLE_MAPS_BACKEND_KEY`, `N8N_WEBHOOK_URL`, `STRIPE_SECRET_KEY`, etc.
  - Tier: Workers Paid (Unbound) por CPU time + tamaño de bundle (Prisma WASM ~3MB).
  - Cuenta de Cloudflare a usar (propia vs cliente): pendiente de definir, todo en boilerplate hasta entonces.
- **Mobile**: EAS Build + OTA con `expo-updates` para parches JS-only.
- Commits en español, cortos, imperativos, sin `Co-Authored-By`.
- Nunca tocar secrets de Cloudflare/EAS sin permiso explícito.

## Órdenes directas

Cuando das una orden imperativa (ej: "haz push", "deploya", "corre los tests"), 
ejecútala sin pedir confirmación adicional. Las confirmaciones de seguridad solo 
aplican a órdenes ambiguas o si algo se ve roto.

## NO hacer sin pedirlo

- Landing pública, marketing, SEO, sitemaps.
- Librerías "por las dudas" (analytics, i18n, state managers que no
  sean React Context o Zustand).
- Comentarios explicando QUÉ hace el código.
- README, docs, ni archivos .md más allá de `CLAUDE.md`.
- Soporte a "Niños con celular" (v2).
- AI Match para importación de Excel (v2 — v1 = template fijo).
