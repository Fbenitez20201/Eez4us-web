import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';

import { prisma } from './db';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      schoolId: { type: 'string', required: false },
      role: {
        type: 'string',
        defaultValue: 'parent',
        input: false,
      },
      phoneE164: { type: 'string', required: false },
    },
  },
  plugins: [
    jwt({
      jwt: {
        definePayload: ({ user }) => ({
          sub: user.id,
          schoolId: (user as { schoolId?: string | null }).schoolId ?? null,
          role: (user as { role?: string }).role ?? 'parent',
        }),
      },
    }),
  ],
});

export type Auth = typeof auth;
