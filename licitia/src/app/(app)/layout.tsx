import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { UnauthorizedError } from "@/lib/errors";
import { AppSidebar } from "@/components/app-sidebar";

/** Shell autenticado: sidebar + contenido. Server Component. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let userEmail = "";
  try {
    const { user } = await requireUser();
    userEmail = user.email ?? "";
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar userEmail={userEmail} />
      <main className="flex-1 overflow-x-hidden p-6">{children}</main>
    </div>
  );
}
