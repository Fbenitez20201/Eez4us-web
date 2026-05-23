import type { Invitation, InvitationChannel } from '@prisma/client';
import { customAlphabet } from 'nanoid';

import { auth } from './auth';
import { prisma } from './db';

const TOKEN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateToken = customAlphabet(TOKEN_ALPHABET, 24);

const DEFAULT_EXPIRY_DAYS = 14;

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
