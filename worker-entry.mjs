// Wrapper around the OpenNext-generated worker that adds a `scheduled` handler
// so Cloudflare Cron Triggers can drive /api/cron/check-alerts.
//
// The fetch handler is delegated 1:1 to OpenNext; we only intercept `scheduled`.
import openNextDefault from './.open-next/worker.js';

export default {
  async fetch(request, env, ctx) {
    return openNextDefault.fetch(request, env, ctx);
  },
  async scheduled(_event, env, ctx) {
    const baseUrl = env.BETTER_AUTH_URL || 'https://eez4us.com';
    const url = `${baseUrl.replace(/\/$/, '')}/api/cron/check-alerts`;
    const secret = env.CRON_SECRET ?? '';
    const req = new Request(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });
    ctx.waitUntil(
      openNextDefault.fetch(req, env, ctx).then(async (res) => {
        if (!res.ok) {
          // log to Workers tail
          // eslint-disable-next-line no-console
          console.error('check-alerts cron failed', res.status, await res.text());
        }
      }),
    );
  },
};
