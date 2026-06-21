-- Multi-país: timezone + moneda por escuela, y tipo de documento por país.
-- Todo aditivo con default backfilleado: el Worker viejo sigue andando entre migrar y deployar.

-- Zona horaria IANA + moneda de cobro por escuela.
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City';
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';

-- Moneda de la suscripción (copia de School.currency al crear).
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';

-- Tipo de documento del país en familiares autorizados y autorizaciones temporales.
ALTER TABLE "authorized_families" ADD COLUMN IF NOT EXISTS "documentType" TEXT;
ALTER TABLE "temporary_authorizations" ADD COLUMN IF NOT EXISTS "documentType" TEXT;
