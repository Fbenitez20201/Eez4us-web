import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

import { BroadcastForm } from './broadcast-form';

export default async function MessagesPage() {
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');
  const schoolId = session.user.schoolId;

  const conversations = await prisma.conversation.findMany({
    where: { schoolId },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      parent: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, senderType: true },
      },
    },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Mensajería</h1>
          <p className="text-sm text-muted-foreground">
            Conversaciones con padres del colegio y broadcasts.
          </p>
        </div>
      </div>

      <BroadcastForm />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Conversaciones ({conversations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay conversaciones. Mandá un broadcast o esperá a que un padre escriba.
            </p>
          ) : (
            <ul className="divide-y">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/messages/${c.id}`}
                    className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-secondary/50 -mx-2 px-2 rounded-2xl"
                  >
                    <div>
                      <p className="font-bold">{c.parent.name ?? c.parent.email}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {c.messages[0]
                          ? `${c.messages[0].senderType === 'PARENT' ? '↩' : '➜'} ${c.messages[0].body}`
                          : c.subject ?? 'Sin mensajes'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {c.unreadStaff > 0 && (
                        <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">
                          {c.unreadStaff}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.lastMessageAt).toLocaleString('es-MX', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
