-- Openpay (México) como segundo proveedor de cobro junto a Stripe, ruteado por país/moneda.
-- Todo aditivo con default backfilleado: el Worker viejo sigue andando entre migrar y deployar.

-- Cliente Openpay de la escuela (paralelo a stripeCustomerId).
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "openpayCustomerId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "schools_openpayCustomerId_key" ON "schools"("openpayCustomerId");

-- Proveedor + handles de tarjeta archivada en la suscripción. Las filas viejas quedan en 'stripe'.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "openpayCardId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "openpayDeviceSessionId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "nextChargeAt" TIMESTAMP(3);

-- Proveedor + idempotencia del cargo Openpay en las facturas.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "openpayChargeId" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_openpayChargeId_key" ON "invoices"("openpayChargeId");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_idempotencyKey_key" ON "invoices"("idempotencyKey");
