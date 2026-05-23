const MAX_RETRIES = 3;

async function postWithRetry(url: string, body: unknown): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 408 && res.status !== 429) {
        throw new Error(`n8n responded ${res.status}: ${await res.text()}`);
      }
      lastError = new Error(`n8n ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    const backoff = 250 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, backoff));
  }
  throw lastError ?? new Error('n8n: retries agotados');
}

export interface WhatsAppInvitationPayload {
  phone: string;
  link: string;
  parentName: string;
  studentNames: string[];
}

export async function sendWhatsAppInvitation(payload: WhatsAppInvitationPayload): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) {
    throw new Error('N8N_WEBHOOK_URL no configurado');
  }
  await postWithRetry(url, { kind: 'invitation_whatsapp', ...payload });
}

export interface EmailInvitationPayload {
  email: string;
  link: string;
  parentName: string;
  studentNames: string[];
}

export async function sendEmailInvitationViaN8n(payload: EmailInvitationPayload): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) {
    throw new Error('N8N_WEBHOOK_URL no configurado');
  }
  await postWithRetry(url, { kind: 'invitation_email', ...payload });
}
