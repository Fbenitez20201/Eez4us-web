import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

export async function deriveChannelKey(
  masterKey: Uint8Array,
  channelName: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(channelName));
  return new Uint8Array(sig);
}

export async function encryptForChannel(
  channelName: string,
  payload: unknown,
  masterKey: Uint8Array,
): Promise<{ nonce: string; ciphertext: string }> {
  const channelKey = await deriveChannelKey(masterKey, channelName);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(plaintext, nonce, channelKey);

  return {
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(box),
  };
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function readEncryptionMasterKey(): Uint8Array {
  return base64ToBytes(process.env.PUSHER_ENCRYPTION_MASTER_KEY!);
}
