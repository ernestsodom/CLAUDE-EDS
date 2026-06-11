"""
Importación masiva de licitaciones desde los archivos de Datos Abiertos de
ChileCompra (CSV mensual, separado por ';', desde 2007).

Es el camino MÁS rápido para cargar historial completo: un archivo mensual trae
miles de licitaciones de una sola vez, sin llamadas una-por-una ni límite de cuota.

Descarga los archivos en:
    https://datos-abiertos.chilecompra.cl/descargas
y súbelos a la app (o pásalos por la CLI). El archivo trae UNA FILA POR ÍTEM, así
que aquí se agrupan por código de licitación.

El mapeo de columnas es flexible: los nombres cambian entre años, por eso se
normalizan los encabezados y se buscan por varios alias.
"""

from __future__ import annotations

import io
import unicodedata
import zipfile
from typing import Any, IO

import pandas as pd

from . import storage
from .perfil import es_municipalidad, identificar_empresa, PROEXSI
from .rubros import nombre_rubro, segmento_de_codigo


def _norm(texto: Any) -> str:
    """Normaliza un encabezado: sin acentos, minúsculas, sólo alfanumérico."""
    s = unicodedata.normalize("NFKD", str(texto))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return "".join(ch for ch in s.lower() if ch.isalnum())


# Alias (ya normalizados) de cada campo que nos interesa.
ALIAS: dict[str, list[str]] = {
    "codigo": ["codigoexterno", "codigo", "codigolicitacion", "tenderid"],
    "nombre": ["nombre", "nombrelicitacion", "nombreadquisicion", "tendertitle"],
    "estado": ["estado", "estadolicitacion", "tenderstatus"],
    "comprador": ["nombreorganismo", "comprador", "organismo", "institucion",
                  "entidad", "razonsocialorganismo"],
    "unidad_compra": ["nombreunidad", "unidaddecompra", "unidadcompra", "unidad"],
    "rut_comprador": ["rutunidad", "rutorganismo", "rutcomprador"],
    "region": ["regionunidad", "region", "regionorganismo"],
    "comuna": ["comunaunidad", "comuna"],
    "monto_estimado": ["montoestimado", "montoestimadolicitacion",
                       "montototalestimado", "monto"],
    "fecha_publicacion": ["fechapublicacion", "fechapublicada", "fechacreacion",
                          "fechaenvio"],
    "fecha_cierre": ["fechacierre", "fechacierrelicitacion"],
    "fecha_adjudicacion": ["fechaadjudicacion", "fechaadjudicada"],
    "n_oferentes": ["cantidadoferentes", "numerooferentes", "noferentes",
                    "cantidaddeoferentes"],
    "monto_adjudicado": ["montoadjudicado", "montototaladjudicado"],
    "rut_adjudicado": ["rutproveedor", "rutadjudicado", "rutproveedoradjudicado"],
    "proveedor_adjudicado": ["nombreproveedor", "proveedoradjudicado",
                             "razonsocialproveedor", "nombreproveedoradjudicado"],
    "categoria": ["codigocategoria", "categoria", "rubro", "codigorubro",
                  "rubro1", "rubron", "codigoproducto"],
}


def _mapear_columnas(df: pd.DataFrame) -> dict[str, str]:
    """Devuelve {campo_interno: nombre_real_columna} según los alias encontrados."""
    norm_a_real = {_norm(c): c for c in df.columns}
    mapping: dict[str, str] = {}
    for campo, alias in ALIAS.items():
        for a in alias:
            if a in norm_a_real:
                mapping[campo] = norm_a_real[a]
                break
    return mapping


def _leer_csv(origen: str | bytes | IO[bytes]) -> pd.DataFrame:
    """Lee el CSV (o el primer .csv dentro de un ZIP), tolerante a codificación."""
    data: bytes
    if isinstance(origen, str):
        with open(origen, "rb") as f:
            data = f.read()
    elif isinstance(origen, bytes):
        data = origen
    else:
        data = origen.read()

    # Si es un ZIP, extraer el primer CSV.
    if data[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            nombre = next((n for n in z.namelist() if n.lower().endswith(".csv")), None)
            if not nombre:
                raise ValueError("El ZIP no contiene ningún archivo .csv")
            data = z.read(nombre)

    for enc in ("utf-8-sig", "latin-1"):
        try:
            return pd.read_csv(
                io.BytesIO(data), sep=";", dtype=str, encoding=enc,
                on_bad_lines="skip", low_memory=False,
            )
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue
    raise ValueError("No se pudo leer el CSV (codificación o separador no soportado).")


def importar(
    origen: str | bytes | IO[bytes],
    progreso: Any = None,
) -> dict[str, Any]:
    """
    Importa un archivo de Datos Abiertos y lo guarda en el caché.

    Devuelve un resumen {filas, licitaciones, guardadas, total_en_cache, columnas}.
    """
    if progreso:
        progreso(0.1, "Leyendo archivo…")
    df = _leer_csv(origen)
    if df.empty:
        return {"filas": 0, "licitaciones": 0, "guardadas": 0,
                "total_en_cache": storage.contar(), "columnas": []}

    m = _mapear_columnas(df)
    if "codigo" not in m:
        raise ValueError(
            "No se encontró la columna de código de licitación. "
            f"Columnas detectadas: {list(df.columns)[:15]}…"
        )

    if progreso:
        progreso(0.4, f"Procesando {len(df):,} filas…")

    # Renombrar a nombres internos y quedarnos con lo necesario.
    df = df.rename(columns={v: k for k, v in m.items()})
    df = df[df["codigo"].notna()]

    def primero(serie: pd.Series) -> Any:
        s = serie.dropna()
        return s.iloc[0] if len(s) else None

    def juntar_rubros(serie: pd.Series) -> str:
        segs: set[str] = set()
        for v in serie.dropna():
            seg = segmento_de_codigo(v)
            if seg:
                segs.add(seg)
        return ",".join(sorted(segs))

    agg: dict[str, Any] = {}
    for campo in m:
        if campo in ("codigo", "categoria"):
            continue
        agg[campo] = (campo, primero)
    if "categoria" in m:
        agg["rubros"] = ("categoria", juntar_rubros)

    grupos = df.groupby("codigo").agg(**agg).reset_index()
    # Saneo: NaN -> None para no arrastrar floats en campos de texto.
    grupos = grupos.astype(object).where(pd.notna(grupos), None)

    if progreso:
        progreso(0.8, "Normalizando…")

    registros: list[dict[str, Any]] = []
    for row in grupos.to_dict("records"):
        rubros = row.get("rubros", "") or ""
        comprador = row.get("comprador")
        prov = row.get("proveedor_adjudicado")
        rut = row.get("rut_adjudicado")
        competidor = identificar_empresa(rut, prov) or ""
        registros.append({
            "codigo": row.get("codigo"),
            "nombre": row.get("nombre"),
            "descripcion": None,
            "estado": (row.get("estado") or "Desconocido").title(),
            "codigo_estado": None,
            "tipo": None,
            "moneda": None,
            "monto_estimado": row.get("monto_estimado"),
            "comprador": comprador,
            "es_municipalidad": int(es_municipalidad(comprador)),
            "unidad_compra": row.get("unidad_compra"),
            "rut_comprador": row.get("rut_comprador"),
            "region": row.get("region"),
            "comuna": row.get("comuna"),
            "fecha_publicacion": row.get("fecha_publicacion"),
            "fecha_cierre": row.get("fecha_cierre"),
            "fecha_adjudicacion": row.get("fecha_adjudicacion"),
            "fecha_termino_contrato": None,
            "n_oferentes": row.get("n_oferentes"),
            "monto_adjudicado": row.get("monto_adjudicado"),
            "proveedor_adjudicado": prov,
            "rut_adjudicado": rut,
            "proveedores_adjudicados": prov or "",
            "competidor": competidor,
            "ganada_proexsi": int(PROEXSI.coincide(rut, prov)),
            "rubros": rubros,
            "rubros_nombres": " | ".join(
                nombre_rubro(s) for s in rubros.split(",") if s
            ),
            "n_items": None,
        })

    guardadas = storage.guardar_licitaciones(registros)
    if progreso:
        progreso(1.0, "Listo")
    return {
        "filas": len(df),
        "licitaciones": len(grupos),
        "guardadas": guardadas,
        "total_en_cache": storage.contar(),
        "columnas_detectadas": m,
    }
