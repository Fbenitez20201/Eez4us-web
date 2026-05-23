import { md5 } from '@noble/hashes/legacy';
import { bytesToHex } from '@noble/hashes/utils';

const pusherHost = (cluster: string) => `api-${cluster}.pusher.com`;

async function hmacSHA256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface PusherCredentials {
  appId: string;
  key: string;
  secret: string;
  cluster: string;
}

export interface TriggerArgs extends PusherCredentials {
  channel: string;
  event: string;
  data: unknown;
}

export async function pusherTrigger({
  appId,
  key,
  secret,
  cluster,
  channel,
  event,
  data,
}: TriggerArgs): Promise<Response> {
  const body = JSON.stringify(data);
  const bodyMd5 = bytesToHex(md5(new TextEncoder().encode(body)));
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const queryString = `auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
  const toSign = ['POST', `/apps/${appId}/events`, queryString].join('\n');
  const authSignature = await hmacSHA256Hex(secret, toSign);

  const url = `https://${pusherHost(cluster)}/apps/${appId}/events?${queryString}&auth_signature=${authSignature}`;

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: event, channel, data: body }),
  });
}

export async function verifyPusherWebhook(req: Request, secret: string): Promise<boolean> {
  const signature = req.headers.get('X-Pusher-Signature') ?? '';
  const body = await req.clone().text();
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBytes = Uint8Array.from(
    signature.replace(/^sha256=/, '').match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? [],
  );
  return crypto.subtle.verify('HMAC', cryptoKey, sigBytes, enc.encode(body));
}

export function readPusherEnv(): PusherCredentials {
  return {
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER ?? 'mt1',
  };
}
