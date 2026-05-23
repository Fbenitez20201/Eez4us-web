import { encodeBase64 } from 'tweetnacl-util';

import { canAccessChannel } from '@/lib/pusher-channels';
import { deriveChannelKey, readEncryptionMasterKey } from '@/lib/pusher-encrypt';
import { getSessionFromRequest } from '@/lib/session';

export const runtime = 'edge';

async function hmacSHA256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(req: Request): Promise<Response> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const form = await req.formData();
  const socketId = form.get('socket_id');
  const channelName = form.get('channel_name');

  if (typeof socketId !== 'string' || typeof channelName !== 'string') {
    return new Response('Bad Request', { status: 400 });
  }

  const allowed = await canAccessChannel(channelName, session);
  if (!allowed) {
    return new Response('Forbidden', { status: 403 });
  }

  const authSig = await hmacSHA256Hex(process.env.PUSHER_SECRET!, `${socketId}:${channelName}`);
  const authPayload = `${process.env.PUSHER_KEY}:${authSig}`;

  const response: { auth: string; shared_secret?: string } = { auth: authPayload };

  if (channelName.startsWith('private-encrypted-')) {
    const channelKey = await deriveChannelKey(readEncryptionMasterKey(), channelName);
    response.shared_secret = encodeBase64(channelKey);
  }

  return Response.json(response);
}
