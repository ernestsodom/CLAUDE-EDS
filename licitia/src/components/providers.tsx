"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";

/**
 * Providers globales: React Query + tema claro/oscuro.
 * El tema se persiste en localStorage y aplica la clase `dark` en <html>.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      })
  );

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", stored === "dark" || (!stored && prefersDark));
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
