import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-3xl border bg-card p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-3xl font-black text-primary">EZ4us</h1>
          <p className="text-sm text-muted-foreground">Panel administrativo</p>
        </div>
        <Button className="w-full" size="lg">
          Entrar
        </Button>
      </div>
    </main>
  );
}
