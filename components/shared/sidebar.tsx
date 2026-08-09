'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/cn';
import { NAVIGATION } from '@/lib/navigation';
import { moduleVisible } from '@/lib/permissions';
import type { SessionProject } from '@/types/database.types';
import { ProjectSwitcher } from './project-switcher';

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const Cmp = (Icons as unknown as Record<string, Icons.LucideIcon>)[name];
  if (!Cmp) return <Icons.Circle size={size} />;
  return <Cmp size={size} strokeWidth={1.75} />;
}

export function Sidebar({
  project,
  projects,
  alertCount,
  taskCount,
}: {
  project: SessionProject;
  projects: SessionProject[];
  alertCount: number;
  taskCount: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const groups = NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => moduleVisible(project, item.module)),
  })).filter((group) => group.items.length > 0);

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-accent">
          <Icons.Zap size={16} className="text-black" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold tracking-tight">PADEL BUSINESS</span>
      </div>

      <div className="px-3 pb-3">
        <ProjectSwitcher current={project} projects={projects} />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {groups.map((group, gi) => (
          <div key={group.label ?? `g${gi}`} className="mb-4">
            {group.label ? (
              <p className="px-2 pb-1.5 pt-1 text-2xs font-semibold uppercase tracking-widest text-content-muted">
                {group.label}
              </p>
            ) : null}

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const href = `/${project.code}${item.href}`;
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                const badge =
                  item.badge === 'alerts' ? alertCount : item.badge === 'tasks' ? taskCount : 0;

                return (
                  <li key={item.href}>
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-accent/10 font-medium text-accent'
                          : 'text-content-secondary hover:bg-elevated hover:text-content',
                      )}
                    >
                      <span className={cn(active ? 'text-accent' : 'text-content-muted')}>
                        <Icon name={item.icon} />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge > 0 ? (
                        <span
                          className={cn(
                            'tabular rounded px-1.5 py-0.5 text-2xs font-semibold',
                            item.badge === 'alerts'
                              ? 'bg-critical/20 text-critical'
                              : 'bg-elevated text-content-secondary',
                          )}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line px-4 py-3">
        <p className="text-2xs text-content-muted">
          {project.name} · {project.role ?? 'sin rol'}
        </p>
      </div>
    </nav>
  );

  return (
    <>
      {/* Movil */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="btn-ghost fixed left-3 top-3 z-40 lg:hidden"
        aria-label="Abrir menu"
      >
        <Icons.Menu size={18} />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-line bg-surface">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="btn-ghost absolute right-2 top-3"
              aria-label="Cerrar menu"
            >
              <Icons.X size={18} />
            </button>
            {nav}
          </aside>
        </div>
      ) : null}

      {/* Escritorio */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface lg:block">
        <div className="sticky top-0 h-screen">{nav}</div>
      </aside>
    </>
  );
}
