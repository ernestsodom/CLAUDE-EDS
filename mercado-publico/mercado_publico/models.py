"""Normalización de las respuestas crudas de la API a registros planos."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from .api_client import ESTADOS_CODIGO
from .perfil import es_municipalidad, identificar_empresa, PROEXSI
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


def proveedores_adjudicados(detalle: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Extrae los proveedores ganadores desde la adjudicación por ítem.
    Devuelve una lista de {rut, nombre, monto} agregada por proveedor.
    """
    listado = _safe(detalle, "Items", "Listado", default=[]) or []
    acum: dict[str, dict[str, Any]] = {}
    for item in listado:
        adj = item.get("Adjudicacion") or {}
        rut = adj.get("RutProveedor")
        nombre = adj.get("NombreProveedor")
        if not (rut or nombre):
            continue
        clave = str(rut or nombre)
        monto = adj.get("MontoUnitario") or 0
        cant = adj.get("Cantidad") or 0
        try:
            total = float(monto) * float(cant)
        except (TypeError, ValueError):
            total = 0.0
        if clave not in acum:
            acum[clave] = {"rut": rut, "nombre": nombre, "monto": 0.0}
        acum[clave]["monto"] += total
    return sorted(acum.values(), key=lambda x: x["monto"], reverse=True)


def _parse_fecha(valor: Any) -> datetime | None:
    if not valor:
        return None
    txt = str(valor)
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(txt[: len(fmt) + 2] if "T" in txt else txt, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(txt)
    except ValueError:
        return None


def estimar_termino_contrato(detalle: dict[str, Any]) -> str | None:
    """
    Estima la fecha de término del contrato para detectar 'contratos por terminar'.

    Usa, en orden: una fecha final explícita; o la fecha de adjudicación más la
    duración declarada del contrato (días / meses / años).
    """
    # 1) Fecha final explícita si existe.
    for clave in ("FechaFinal", "FechaFinContrato", "FechaTermino"):
        f = _safe(detalle, "Fechas", clave) or detalle.get(clave)
        if f:
            return str(f)

    # 2) Fecha de adjudicación + duración declarada.
    base = _parse_fecha(
        _safe(detalle, "Adjudicacion", "Fecha")
        or _safe(detalle, "Fechas", "FechaAdjudicacion")
    )
    if not base:
        return None

    tiempo = detalle.get("TiempoDuracionContrato") or _safe(
        detalle, "Contrato", "TiempoDuracionContrato"
    )
    tipo = (detalle.get("TipoDuracionContrato") or _safe(
        detalle, "Contrato", "TipoDuracionContrato"
    ) or "").lower()
    try:
        tiempo = int(tiempo)
    except (TypeError, ValueError):
        return None

    if "año" in tipo or "anual" in tipo or "year" in tipo:
        dias = tiempo * 365
    elif "mes" in tipo or "month" in tipo:
        dias = tiempo * 30
    elif "día" in tipo or "dia" in tipo or "day" in tipo:
        dias = tiempo
    else:
        return None
    return (base + timedelta(days=dias)).strftime("%Y-%m-%dT00:00:00")


def normalizar_licitacion(detalle: dict[str, Any]) -> dict[str, Any]:
    """Convierte el detalle crudo de una licitación en un registro plano."""
    cod_estado = detalle.get("CodigoEstado")
    estado = ESTADOS_CODIGO.get(cod_estado, detalle.get("Estado") or "Desconocido")
    segmentos = rubros_de_items(detalle)

    comprador = _safe(detalle, "Comprador", "NombreOrganismo")
    provs = proveedores_adjudicados(detalle)
    principal = provs[0] if provs else {}
    competidor = identificar_empresa(principal.get("rut"), principal.get("nombre"))
    ganada_proexsi = any(
        PROEXSI.coincide(p.get("rut"), p.get("nombre")) for p in provs
    )

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
        "comprador": comprador,
        "es_municipalidad": int(es_municipalidad(comprador)),
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
        "fecha_termino_contrato": estimar_termino_contrato(detalle),
        # Adjudicación (proveedor ganador)
        "n_oferentes": _safe(detalle, "Adjudicacion", "NumeroOferentes"),
        "monto_adjudicado": _safe(detalle, "Adjudicacion", "MontoTotal"),
        "proveedor_adjudicado": principal.get("nombre"),
        "rut_adjudicado": principal.get("rut"),
        "proveedores_adjudicados": " | ".join(
            f"{p.get('nombre')}" for p in provs if p.get("nombre")
        ),
        "competidor": competidor or "",
        "ganada_proexsi": int(ganada_proexsi),
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
