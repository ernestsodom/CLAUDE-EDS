import { redirect } from "next/navigation";

/**
 * «Carpetas» dejó de ser una sección aparte: las carpetas viven ahora dentro
 * de Documentos, junto al listado completo. Esta ruta se conserva para no
 * romper enlaces guardados.
 */
export default function ProjectsPage() {
  redirect("/documents");
}
