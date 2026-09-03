"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, useNeonClient } from "@/lib/supabase/client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSearch } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Sin try/catch, un fallo de red (baseURL mal puesta, CORS, DNS) tira
    // una excepción que nunca cae en el "if (failed)" de abajo: el botón se
    // queda en "Ingresando…" para siempre, sin ningún error visible — nada
    // que ver con contraseña incorrecta, que sí resuelve {error} normal.
    try {
      const failed = useNeonClient()
        ? (await authClient.signIn.email({ email, password })).error
        : (await createClient().auth.signInWithPassword({ email, password })).error;

      if (failed) {
        setError("Credenciales inválidas. Verifica tu correo y contraseña.");
        setLoading(false);
        return;
      }
      router.push(searchParams.get("next") ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo conectar con el servidor de autenticación: ${err.message}`
          : "No se pudo conectar con el servidor de autenticación."
      );
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FileSearch className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">LicitIA</CardTitle>
          <CardDescription>Inteligencia documental para licitaciones y contratos</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="correo@empresa.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
