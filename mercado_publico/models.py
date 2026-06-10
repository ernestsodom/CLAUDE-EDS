"""Normalización de las respuestas crudas de la API a registros planos."""

from __future__ import annotations

from typing import Any

from .api_client import ESTADOS_CODIGO
from .rubros import nombre_rubro, segmento_de_codigo


def _safe(d: dict[str, Any] | None, *keys: str, default: Any = None) -> Any:
    """Acceso anidado tolerante a None."""
    cur: Any = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
    return cur if cur is not None else default


def rubros_de_items(detalle: dict[str, Any]) -> list[str]:
    """Conjunto de segmentos (rubros) presentes en los ítems de la licitación."""
    listado = _safe(detalle, "Items", "Listado", default=[]) or []
    segmentos: set[str] = set()
    for item in listado:
        cod = item.get("CodigoCategoria") or item.get("Categoria")
        seg = segmento_de_codigo(cod)
        if seg:
            segmentos.add(seg)
    return sorted(segmentos)


def normalizar_licitacion(detalle: dict[str, Any]) -> dict[str, Any]:
    """Convierte el detalle crudo de una licitación en un registro plano."""
    cod_estado = detalle.get("CodigoEstado")
    estado = ESTADOS_CODIGO.get(cod_estado, detalle.get("Estado") or "Desconocido")
    segmentos = rubros_de_items(detalle)

    return {
        "codigo": detalle.get("CodigoExterno"),
        "nombre": detalle.get("Nombre"),
        "descripcion": detalle.get("Descripcion"),
        "estado": estado,
        "codigo_estado": cod_estado,
        "tipo": detalle.get("Tipo"),
        "moneda": detalle.get("Moneda"),
        "monto_estimado": detalle.get("MontoEstimado"),
        # Comprador = cliente / organismo público
        "comprador": _safe(detalle, "Comprador", "NombreOrganismo"),
        "unidad_compra": _safe(detalle, "Comprador", "NombreUnidad"),
        "rut_comprador": _safe(detalle, "Comprador", "RutUnidad"),
        "region": _safe(detalle, "Comprador", "RegionUnidad"),
        "comuna": _safe(detalle, "Comprador", "ComunaUnidad"),
        # Fechas
        "fecha_publicacion": _safe(detalle, "Fechas", "FechaPublicacion")
        or detalle.get("FechaPublicacion"),
        "fecha_cierre": _safe(detalle, "Fechas", "FechaCierre")
        or detalle.get("FechaCierre"),
        "fecha_adjudicacion": _safe(detalle, "Fechas", "FechaAdjudicacion")
        or _safe(detalle, "Adjudicacion", "Fecha"),
        # Adjudicación (proveedor ganador)
        "n_oferentes": _safe(detalle, "Adjudicacion", "NumeroOferentes"),
        "monto_adjudicado": _safe(detalle, "Adjudicacion", "MontoTotal"),
        # Rubros
        "rubros": ",".join(segmentos),
        "rubros_nombres": " | ".join(nombre_rubro(s) for s in segmentos),
        "n_items": _safe(detalle, "Items", "Cantidad", default=0),
    }


def normalizar_resumen(resumen: dict[str, Any]) -> dict[str, Any]:
    """Registro plano a partir del resumen de listado (sin detalle)."""
    cod_estado = resumen.get("CodigoEstado")
    return {
        "codigo": resumen.get("CodigoExterno"),
        "nombre": resumen.get("Nombre"),
        "estado": ESTADOS_CODIGO.get(cod_estado, "Desconocido"),
        "codigo_estado": cod_estado,
        "fecha_cierre": resumen.get("FechaCierre"),
    }
