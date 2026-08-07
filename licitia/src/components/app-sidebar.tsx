"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, FileText, Upload, MessageSquare, GitCompare,
  MailWarning, Search, ChevronLeft, ChevronRight, LogOut, Moon, Sun, FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// «Documentos» incluye las carpetas por cliente: son la misma cosa vista de
// dos maneras, y tenerlas en dos opciones separadas confundía más que ayudaba.
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/upload", label: "Subir", icon: Upload },
  { href: "/chat", label: "Chat IA", icon: MessageSquare },
  { href: "/compare", label: "Comparador", icon: GitCompare },
  { href: "/claims", label: "Reclamos", icon: MailWarning },
  { href: "/search", label: "Búsqueda", icon: Search },
];

/** Navegación lateral colapsable con selector de tema y cierre de sesión. */
export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col border-r bg-card transition-all",
        collapsed ? "w-14" : "w-60"
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FileSearch className="h-4 w-4" />
        </div>
        {!collapsed && <span className="font-semibold">LicitIA</span>}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Colapsar menú"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && label}
          </Link>
        ))}
      </nav>

      <div className="space-y-1 border-t p-2">
        {!collapsed && (
          <p className="truncate px-3 py-1 text-xs text-muted-foreground">{userEmail}</p>
        )}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Sun className="h-4 w-4 shrink-0 dark:hidden" />
          <Moon className="hidden h-4 w-4 shrink-0 dark:block" />
          {!collapsed && "Cambiar tema"}
        </button>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}
