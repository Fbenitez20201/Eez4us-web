import type Stripe from 'stripe';

import { prisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

const STATUS_MAP: Record<string, 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED'> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  unpaid: 'PAST_DUE',
  canceled: 'CANCELED',
  incomplete_expired: 'CANCELED',
  paused: 'PAUSED',
  incomplete: 'TRIALING',
};

function toDate(unix: number | null | undefined): Date | null {
  if (!unix) return null;
  return new Date(unix * 1000);
}

async function upsertFromSubscription(sub: Stripe.Subscription): Promise<void> {
  const schoolId = sub.metadata?.schoolId;
  if (!schoolId) {
    console.error('webhook: subscription missing schoolId metadata', sub.id);
    return;
  }
  const status = STATUS_MAP[sub.status] ?? 'TRIALING';
  const item = sub.items.data[0];
  const unitAmountUsd =
    item && typeof item.price.unit_amount === 'number' ? item.price.unit_amount / 100 : 10;
  const periodStart = toDate(item?.current_period_start ?? null);
  const periodEnd = toDate(item?.current_period_end ?? null);

  await prisma.subscription.upsert({
    where: { schoolId },
    create: {
      schoolId,
      stripeSubscriptionId: sub.id,
      status,
      pricePerStudent: unitAmountUsd,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAt: toDate(sub.cancel_at),
    },
    update: {
      stripeSubscriptionId: sub.id,
      status,
      pricePerStudent: unitAmountUsd,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAt: toDate(sub.cancel_at),
    },
  });
}

async function markPastDueByCustomer(customerId: string): Promise<void> {
  const school = await prisma.school.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!school) return;
  await prisma.subscription.updateMany({
    where: { schoolId: school.id },
    data: { status: 'PAST_DUE' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('missing signature', { status: 400 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response('webhook secret not configured', { status: 500 });

  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (err) {
    console.error('webhook signature verification failed', err);
    return new Response('invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await upsertFromSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('webhook: invoice paid', {
          id: invoice.id,
          customer: invoice.customer,
          amount: invoice.amount_paid,
        });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (typeof invoice.customer === 'string') {
          await markPastDueByCustomer(invoice.customer);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('webhook handler error', { type: event.type, err });
    return new Response('handler error', { status: 500 });
  }

  return Response.json({ received: true });
}
