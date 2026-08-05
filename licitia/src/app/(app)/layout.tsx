import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";

/** Shell autenticado: sidebar + contenido. Server Component. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <AppSidebar userEmail={user.email ?? ""} />
      <main className="flex-1 overflow-x-hidden p-6">{children}</main>
    </div>
  );
}
