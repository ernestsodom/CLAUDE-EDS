import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Formato del Excel de control" };

const COLUMNS: Array<[string, boolean, string, string]> = [
  ["Sistema", true, "Texto libre", "Agrupa las funcionalidades. Puedes escribirlo solo en la primera fila del grupo y dejarlo en blanco en las siguientes."],
  ["Funcionalidad", true, "Texto libre", "Lo que se entregó, en una línea. Es la columna con la que se emparejan las funcionalidades del documento base."],
  ["Estado", false, "Entregado · En desarrollo · Pendiente", "Determina el % de cumplimiento. Si se deja vacío se asume Pendiente."],
  ["Fecha entrega", false, "AAAA-MM-DD o fecha de Excel", "Cuándo se entregó."],
  ["Plazo comprometido", false, "Texto libre («60 días desde la firma»)", "Solo informativo; si está vacío se usa el plazo del documento base."],
  ["Adicional", false, "Sí / No", "Marca el trabajo que NO estaba comprometido."],
  ["Sin costo", false, "Sí / No", "Marca el trabajo entregado sin cobro al cliente."],
  ["Observaciones", false, "Texto libre", "Contexto, número de acta, quién lo pidió, etc."],
];

const EXAMPLE = [
  ["Portal de Atención Ciudadana", "Emitir certificado de residencia en PDF", "Entregado", "2026-03-14", "60 días desde la firma", "No", "No", ""],
  ["Portal de Atención Ciudadana", "Pago en línea con Webpay", "En desarrollo", "", "", "No", "No", "A la espera de credenciales"],
  ["Portal de Atención Ciudadana", "Notificación por WhatsApp", "Entregado", "2026-04-02", "", "Sí", "Sí", "Pedido en reunión del 12-03, sin cobro"],
  ["Módulo de Tesorería", "Conciliación bancaria automática", "Pendiente", "", "", "No", "No", ""],
];

/** Documentación del formato predeterminado del Excel de control de entregas. */
export default function ExcelFormatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Formato del Excel de control de entregas</h1>
        <p className="text-sm text-muted-foreground">
          El comparador enfrenta el checklist de sistemas del documento técnico contra un archivo
          Excel donde tu equipo lleva el control de lo realmente entregado. Para que la comparación
          sea exacta —y no dependa de la interpretación de un modelo de IA— ese Excel debe seguir
          este formato.
        </p>
      </div>

      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-4 text-sm">
          <span className="font-medium">Atajo recomendado:</span> en el{" "}
          <Link href="/compare" className="text-primary underline">comparador</Link>, elige el
          documento base y pulsa <span className="font-medium">“Descargar plantilla Excel”</span>.
          Obtendrás este mismo formato ya pre-llenado con todos los sistemas y funcionalidades del
          documento — solo completas las columnas de la derecha y agregas al final lo que entregaste
          de más.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Hoja y columnas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            La tabla debe estar en la hoja llamada{" "}
            <span className="font-medium text-foreground">Control de entregas</span>. Si el archivo
            tiene una sola hoja con otro nombre, también se lee. Puede haber filas de título por
            encima de la tabla: el sistema busca la fila que contiene «Sistema» y «Funcionalidad».
          </p>
          <Table>
            <THead>
              <TR><TH>Columna</TH><TH>Obligatoria</TH><TH>Valores</TH><TH>Para qué sirve</TH></TR>
            </THead>
            <TBody>
              {COLUMNS.map(([name, required, values, purpose]) => (
                <TR key={name}>
                  <TD className="font-medium">{name}</TD>
                  <TD>
                    {required ? <Badge variant="danger">Sí</Badge> : <Badge variant="secondary">No</Badge>}
                  </TD>
                  <TD className="text-muted-foreground">{values}</TD>
                  <TD className="text-muted-foreground">{purpose}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Cualquier otra columna que agregues se ignora sin dar error.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ejemplo</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                {COLUMNS.map(([name]) => <TH key={name}>{name}</TH>)}
              </TR>
            </THead>
            <TBody>
              {EXAMPLE.map((row, i) => (
                <TR key={i}>
                  {row.map((cell, j) => <TD key={j}>{cell || "—"}</TD>)}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cómo se compara</CardTitle></CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Cada funcionalidad del documento base busca su mejor coincidencia entre las filas del
              Excel. El emparejamiento es por <span className="font-medium">similitud de palabras</span>,
              no por texto idéntico: «Emitir certificado de residencia en PDF» empareja con
              «Emisión de certificados de residencia (PDF)».
            </li>
            <li>
              Si no encuentra coincidencia, la funcionalidad se marca{" "}
              <Badge variant="danger">Ausente</Badge> — está comprometida y no aparece en tu control.
            </li>
            <li>
              Las filas del Excel que no se emparejaron con ninguna funcionalidad exigida se listan
              aparte y <span className="font-medium">se destacan</span> como trabajo adicional,
              señalando cuáles se hicieron sin costo.
            </li>
            <li>
              El % de cumplimiento se calcula sobre las funcionalidades del documento base en estado
              «Entregado». Lo adicional se cuenta aparte: no infla el porcentaje.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Errores frecuentes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR><TH>Mensaje</TH><TH>Causa</TH><TH>Solución</TH></TR>
            </THead>
            <TBody>
              <TR>
                <TD>«Formato no reconocido: falta la fila de encabezados…»</TD>
                <TD>La hoja no tiene las columnas Sistema y Funcionalidad.</TD>
                <TD>Descarga la plantilla desde el comparador.</TD>
              </TR>
              <TR>
                <TD>«No se encontró ninguna fila con funcionalidad»</TD>
                <TD>La columna Funcionalidad está vacía en todas las filas.</TD>
                <TD>Completa al menos esa columna.</TD>
              </TR>
              <TR>
                <TD>«No se pudo leer el archivo»</TD>
                <TD>El archivo es .xls antiguo, .csv o está dañado.</TD>
                <TD>Guárdalo como .xlsx desde Excel o Google Sheets.</TD>
              </TR>
              <TR>
                <TD>El documento base aparece sin sistemas</TD>
                <TD>No se ha procesado, o su análisis no detectó sistemas.</TD>
                <TD>Procésalo y revisa la pestaña «Sistemas» de su ficha.</TD>
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
