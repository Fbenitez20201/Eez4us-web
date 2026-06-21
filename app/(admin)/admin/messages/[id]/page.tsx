import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

import { ReplyForm } from './reply-form';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');

  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true, email: true, phoneE164: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  if (!conv || conv.schoolId !== session.user.schoolId) notFound();

  await prisma.conversation.update({ where: { id }, data: { unreadStaff: 0 } });

  return (
    <div className="space-y-6">
      <Link
        href="/admin/messages"
        className="text-sm font-bold text-primary hover:underline"
      >
        ← Volver a Mensajería
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {conv.parent.name ?? conv.parent.email}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {conv.parent.email}
            {conv.parent.phoneE164 ? ` · ${conv.parent.phoneE164}` : ''}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {conv.messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.senderType === 'PARENT'
                    ? 'flex justify-start'
                    : m.senderType === 'STAFF'
                      ? 'flex justify-end'
                      : 'flex justify-center'
                }
              >
                <div
                  className={
                    'max-w-[75%] rounded-2xl px-4 py-2 text-sm ' +
                    (m.senderType === 'PARENT'
                      ? 'bg-secondary text-foreground'
                      : m.senderType === 'STAFF'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground text-xs italic')
                  }
                >
                  <p>{m.body}</p>
                  <p className="mt-1 text-[10px] opacity-70">
                    {m.sender?.name ?? m.senderType} ·{' '}
                    {new Date(m.createdAt).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            {conv.messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">Sin mensajes todavía.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <ReplyForm conversationId={conv.id} />
    </div>
  );
}
