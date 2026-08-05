import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-green-500/15 text-green-600 dark:text-green-400",
        warning: "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400",
        danger: "border-transparent bg-red-500/15 text-red-600 dark:text-red-400",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Semáforo / estado → variante visual coherente en toda la app. */
export function statusVariant(status: string): BadgeProps["variant"] {
  const map: Record<string, BadgeProps["variant"]> = {
    procesado: "success", cumplido: "success", verde: "success", adjudicada: "success",
    procesando: "warning", parcial: "warning", amarillo: "warning", pendiente: "warning",
    subido: "secondary", no_aplica: "secondary",
    error: "danger", rojo: "danger", fuera_de_alcance: "danger", critico: "danger", alto: "danger",
    adicional: "default", medio: "warning", bajo: "secondary",
  };
  return map[status] ?? "secondary";
}
