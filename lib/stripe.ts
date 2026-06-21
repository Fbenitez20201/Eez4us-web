import Stripe from 'stripe';

import { prisma } from './db';

type ApiVersion = NonNullable<ConstructorParameters<typeof Stripe>[1]>['apiVersion'];

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!cached) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY missing');
    cached = new Stripe(key, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: '2024-11-20.acacia' as ApiVersion,
    });
  }
  return cached;
}

export function readPriceId(): string {
  const v = process.env.STRIPE_PRICE_ID;
  if (!v) throw new Error('STRIPE_PRICE_ID missing');
  return v;
}

// Precio de Stripe por moneda de la escuela. Un Price de Stripe lleva su moneda fija, así que
// el cobro en moneda local exige un Price por divisa: se setea STRIPE_PRICE_ID_<CCY> (ej.
// STRIPE_PRICE_ID_MXN). Si no existe el de esa moneda, cae al STRIPE_PRICE_ID global (USD).
export function priceIdForCurrency(currency?: string | null): string {
  const ccy = (currency ?? 'USD').toUpperCase();
  const specific = process.env[`STRIPE_PRICE_ID_${ccy}`];
  if (specific) return specific;
  return readPriceId();
}

export function readPortalReturnUrl(): string {
  return process.env.STRIPE_PORTAL_RETURN_URL ?? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/billing`;
}

interface SchoolForCustomer {
  id: string;
  name: string;
  directorEmail: string | null;
}

export async function createCustomer(school: SchoolForCustomer): Promise<string> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: school.name,
    email: school.directorEmail ?? undefined,
    metadata: { schoolId: school.id },
  });
  await prisma.school.update({
    where: { id: school.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

export async function createSubscription(
  schoolId: string,
  quantity: number,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { stripeCustomerId: true, currency: true },
  });
  if (!school?.stripeCustomerId) {
    throw new Error('SCHOOL_HAS_NO_CUSTOMER');
  }
  return stripe.subscriptions.create({
    customer: school.stripeCustomerId,
    items: [{ price: priceIdForCurrency(school.currency), quantity: Math.max(quantity, 1) }],
    proration_behavior: 'create_prorations',
    metadata: { schoolId, currency: school.currency },
  });
}

export async function updateSubscriptionQuantity(
  schoolId: string,
  newCount: number,
): Promise<void> {
  const stripe = getStripe();
  const sub = await prisma.subscription.findUnique({
    where: { schoolId },
    select: { stripeSubscriptionId: true },
  });
  if (!sub?.stripeSubscriptionId) return;

  const remote = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const item = remote.items.data[0];
  if (!item) return;
  if (item.quantity === newCount) return;

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items: [{ id: item.id, quantity: Math.max(newCount, 1) }],
    proration_behavior: 'create_prorations',
  });
}

export async function createCustomerPortalLink(
  schoolId: string,
  returnUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { stripeCustomerId: true },
  });
  if (!school?.stripeCustomerId) {
    throw new Error('SCHOOL_HAS_NO_CUSTOMER');
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: school.stripeCustomerId,
    return_url: returnUrl,
  });
  return session.url;
}
