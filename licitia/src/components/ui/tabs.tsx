"use client";

import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

const TabsContext = createContext<{ value: string; setValue: (v: string) => void } | null>(null);

export function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm transition-colors",
        active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  if (ctx.value !== value) return null;
  return <div className="mt-4">{children}</div>;
}
