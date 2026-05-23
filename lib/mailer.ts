import { sendEmailInvitationViaN8n } from './n8n';

export interface InvitationEmailArgs {
  email: string;
  link: string;
  parentName: string;
  studentNames: string[];
}

export async function sendInvitationEmail(args: InvitationEmailArgs): Promise<void> {
  await sendEmailInvitationViaN8n(args);
}
