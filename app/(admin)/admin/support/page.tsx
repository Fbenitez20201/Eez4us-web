import { redirect } from 'next/navigation';

import { SupportBoard } from '@/components/admin/support-board';
import { getCurrentSession } from '@/lib/session';

export default async function SupportPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Soporte</h1>
        <p className="text-sm text-muted-foreground">Reportá un bug, una mejora o pedí ayuda.</p>
      </div>
      <SupportBoard scope="mine" canAdmin={false} />
    </div>
  );
}
