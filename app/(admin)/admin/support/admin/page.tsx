import { redirect } from 'next/navigation';

import { SupportBoard } from '@/components/admin/support-board';
import { getCurrentSession } from '@/lib/session';

export default async function SupportAdminPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'super_admin') redirect('/admin/support');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Soporte — Admin</h1>
        <p className="text-sm text-muted-foreground">Todos los tickets reportados.</p>
      </div>
      <SupportBoard scope="all" canAdmin={true} />
    </div>
  );
}
