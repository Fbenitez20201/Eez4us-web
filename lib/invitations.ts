import type { Invitation, InvitationChannel } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { z } from 'zod';

import { auth } from './auth';
import { prisma } from './db';
import { sendInvitationEmail } from './mailer';
import { sendWhatsAppInvitation } from './n8n';
import { validatePhoneForCountry } from './phone';

const TOKEN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateToken = customAlphabet(TOKEN_ALPHABET, 24);

const DEFAULT_EXPIRY_DAYS = 14;

const nullableEmail = z
  .string()
  .trim()
  .email()
  .max(160)
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

const nullablePhone = z
  .string()
  .trim()
  .min(5)
  .max(20)
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

export const representativeSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: nullableEmail,
    phoneE164: nullablePhone,
  })
  .refine((r) => Boolean(r.email) || Boolean(r.phoneE164), {
    message: 'REP_NEEDS_CONTACT',
  });

export type RepresentativeInput = z.infer<typeof representativeSchema>;

export interface CreateInvitationArgs {
  schoolId: string;
  parent: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phoneE164?: string | null;
  };
  studentIds: string[];
  channel: InvitationChannel;
  expiresInDays?: number;
}

export async function createInvitation({
  schoolId,
  parent,
  studentIds,
  channel,
  expiresInDays = DEFAULT_EXPIRY_DAYS,
}: CreateInvitationArgs): Promise<Invitation> {
  const contactValue = channel === 'EMAIL' ? parent.email : parent.phoneE164;
  if (!contactValue) {
    throw new Error(
      `createInvitation: missing ${channel === 'EMAIL' ? 'email' : 'phoneE164'} for ${parent.firstName} ${parent.lastName}`,
    );
  }

  const recipientName = `${parent.firstName} ${parent.lastName}`.trim();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  return prisma.invitation.create({
    data: {
      schoolId,
      token: generateToken(),
      channel,
      contactValue,
      recipientName: recipientName || null,
      studentIds,
      expiresAt,
    },
  });
}

export function pickChannel(contact: {
  email?: string | null;
  phoneE164?: string | null;
}): InvitationChannel | null {
  if (contact.email && contact.email.trim()) return 'EMAIL';
  if (contact.phoneE164 && contact.phoneE164.trim()) return 'WHATSAPP';
  return null;
}

export function inviteLink(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? '';
  return `${base.replace(/\/$/, '')}/invite/${token}`;
}

interface DispatchInvitationArgs {
  channel: InvitationChannel;
  contactValue: string;
  link: string;
  parentName: string;
  studentNames: string[];
}

export async function dispatchInvitation({
  channel,
  contactValue,
  link,
  parentName,
  studentNames,
}: DispatchInvitationArgs): Promise<void> {
  if (channel === 'EMAIL') {
    await sendInvitationEmail({ email: contactValue, link, parentName, studentNames });
  } else {
    await sendWhatsAppInvitation({ phone: contactValue, link, parentName, studentNames });
  }
}

interface SendInvitationArgs {
  invitationId: string;
  channel: InvitationChannel;
  contactValue: string;
  token: string;
  parentName: string;
  studentNames: string[];
}

export async function sendInvitation({
  invitationId,
  channel,
  contactValue,
  token,
  parentName,
  studentNames,
}: SendInvitationArgs): Promise<void> {
  await dispatchInvitation({
    channel,
    contactValue,
    link: inviteLink(token),
    parentName,
    studentNames,
  });
  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: 'SENT', sentAt: new Date() },
  });
}

export interface InviteRepresentativesResult {
  createdCount: number;
  sentCount: number;
  repErrors: Array<{ rep: string; reason: string }>;
}

export async function inviteRepresentatives({
  schoolId,
  studentIds,
  studentNames,
  representatives,
}: {
  schoolId: string;
  studentIds: string[];
  studentNames: string[];
  representatives: RepresentativeInput[];
}): Promise<InviteRepresentativesResult> {
  const repErrors: Array<{ rep: string; reason: string }> = [];
  const created: Array<{
    invitationId: string;
    channel: InvitationChannel;
    contactValue: string;
    token: string;
    parentName: string;
  }> = [];

  // País de la escuela para validar el teléfono por prefijo+longitud (E.164 si es desconocido).
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { country: true },
  });

  for (const rep of representatives) {
    const repName = `${rep.firstName} ${rep.lastName}`.trim();
    if (rep.phoneE164 && !validatePhoneForCountry(rep.phoneE164, school?.country).valid) {
      repErrors.push({ rep: repName, reason: 'PHONE_INVALID' });
      continue;
    }
    const channel = pickChannel(rep);
    if (!channel) {
      repErrors.push({ rep: repName, reason: 'REP_NEEDS_CONTACT' });
      continue;
    }
    try {
      const invitation = await createInvitation({
        schoolId,
        parent: {
          firstName: rep.firstName,
          lastName: rep.lastName,
          email: rep.email ?? null,
          phoneE164: rep.phoneE164 ?? null,
        },
        studentIds,
        channel,
      });
      created.push({
        invitationId: invitation.id,
        channel,
        contactValue: invitation.contactValue,
        token: invitation.token,
        parentName: repName,
      });
    } catch (err) {
      repErrors.push({ rep: repName, reason: err instanceof Error ? err.message : 'unknown' });
    }
  }

  const sendResults = await Promise.allSettled(
    created.map((c) =>
      sendInvitation({
        invitationId: c.invitationId,
        channel: c.channel,
        contactValue: c.contactValue,
        token: c.token,
        parentName: c.parentName,
        studentNames,
      }),
    ),
  );
  sendResults.forEach((r, i) => {
    if (r.status === 'rejected') {
      repErrors.push({ rep: created[i].parentName, reason: `send: ${String(r.reason)}` });
    }
  });

  return {
    createdCount: created.length,
    sentCount: sendResults.filter((r) => r.status === 'fulfilled').length,
    repErrors,
  };
}

export interface ClaimInvitationArgs {
  token: string;
  password: string;
  name: string;
  phoneE164?: string | null;
}

export interface ClaimInvitationResult {
  userId: string;
  schoolId: string;
  sessionToken: string | null;
  setCookie: string | null;
}

function syntheticEmailFromPhone(phoneE164: string): string {
  return `${phoneE164.replace(/[^\d]/g, '')}@whatsapp.eez4us.local`;
}

export async function claimInvitation({
  token,
  password,
  name,
  phoneE164,
}: ClaimInvitationArgs): Promise<ClaimInvitationResult> {
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) {
    throw new Error('INVITATION_NOT_FOUND');
  }
  if (invitation.status !== 'PENDING' && invitation.status !== 'SENT') {
    throw new Error('INVITATION_ALREADY_USED');
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    throw new Error('INVITATION_EXPIRED');
  }

  // El padre puede tipear su teléfono al claimear: validarlo contra el país de la escuela.
  if (phoneE164) {
    const school = await prisma.school.findUnique({
      where: { id: invitation.schoolId },
      select: { country: true },
    });
    if (!validatePhoneForCountry(phoneE164, school?.country).valid) {
      throw new Error('PHONE_INVALID');
    }
  }

  const email =
    invitation.channel === 'EMAIL'
      ? invitation.contactValue
      : syntheticEmailFromPhone(invitation.contactValue);

  const phone =
    phoneE164 ?? (invitation.channel === 'WHATSAPP' ? invitation.contactValue : null);

  const signUpResponse = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name,
      schoolId: invitation.schoolId,
      phoneE164: phone ?? undefined,
    },
    returnHeaders: true,
  });

  const setCookie =
    (signUpResponse.headers instanceof Headers
      ? signUpResponse.headers.get('set-cookie')
      : null) ?? null;

  const sessionToken =
    (signUpResponse.response as { token?: string | null } | null)?.token ?? null;
  const userId =
    (signUpResponse.response as { user?: { id?: string } } | null)?.user?.id ?? null;

  if (!userId) {
    throw new Error('SIGNUP_FAILED');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { role: 'parent', schoolId: invitation.schoolId },
    }),
    ...invitation.studentIds.map((studentId) =>
      prisma.parentStudent.upsert({
        where: { parentId_studentId: { parentId: userId, studentId } },
        create: { parentId: userId, studentId },
        update: {},
      }),
    ),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'CLAIMED', claimedAt: new Date(), claimedByUserId: userId },
    }),
  ]);

  return {
    userId,
    schoolId: invitation.schoolId,
    sessionToken,
    setCookie,
  };
}
