"""
Capa de orquestación: descarga desde la API, normaliza y cachea.

Une el cliente HTTP, los modelos y el almacenamiento para ofrecer operaciones
de alto nivel que consume la interfaz (Streamlit o CLI).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Callable

from . import storage
from .api_client import MercadoPublicoClient
from .models import normalizar_licitacion, normalizar_resumen


def _rango_fechas(desde: date, hasta: date) -> list[date]:
    dias = (hasta - desde).days
    return [desde + timedelta(days=i) for i in range(dias + 1)]


def sincronizar_licitaciones(
    desde: date,
    hasta: date,
    estado: str | None = None,
    enriquecer: bool = True,
    limite_detalle: int = 400,
    progreso: Callable[[float, str], None] | None = None,
    ticket: str | None = None,
) -> dict[str, Any]:
    """
    Descarga licitaciones en un rango de fechas y las guarda en el caché.

    - `estado`: filtra por estado (activas, desierta, adjudicada, ...).
    - `enriquecer`: si True, descarga el detalle de cada licitación para obtener
      rubros, comprador, montos y adjudicación (necesario para filtrar por rubro).
    - `limite_detalle`: tope de detalles a descargar para proteger la cuota.
    Devuelve un resumen de la operación.
    """
    client = MercadoPublicoClient(ticket=ticket)
    dias = _rango_fechas(desde, hasta)

    resumenes: dict[str, dict[str, Any]] = {}
    for i, dia in enumerate(dias):
        if progreso:
            progreso(i / max(len(dias), 1) * 0.4, f"Listando {dia.isoformat()}…")
        try:
            for r in client.listar_licitaciones(fecha=dia, estado=estado):
                cod = r.get("CodigoExterno")
                if cod:
                    resumenes[cod] = r
        except Exception as exc:  # noqa: BLE001 - se reporta, no se aborta todo
            if progreso:
                progreso(i / max(len(dias), 1) * 0.4, f"⚠ {dia}: {exc}")

    registros: list[dict[str, Any]] = []
    detalles_ok = 0

    if enriquecer:
        codigos = list(resumenes.keys())[:limite_detalle]
        total = max(len(codigos), 1)
        for j, cod in enumerate(codigos):
            if progreso:
                progreso(0.4 + j / total * 0.6, f"Detalle {cod} ({j+1}/{len(codigos)})")
            try:
                detalle = client.detalle_licitacion(cod)
                if detalle:
                    registros.append(normalizar_licitacion(detalle))
                    detalles_ok += 1
            except Exception:  # noqa: BLE001
                registros.append(normalizar_resumen(resumenes[cod]))
    else:
        registros = [normalizar_resumen(r) for r in resumenes.values()]

    guardados = storage.guardar_licitaciones(registros)
    if progreso:
        progreso(1.0, "Listo")

    return {
        "encontradas": len(resumenes),
        "detalles_descargados": detalles_ok,
        "guardadas": guardados,
        "total_en_cache": storage.contar(),
    }


def detalle_completo(codigo: str, ticket: str | None = None) -> dict[str, Any] | None:
    """Detalle crudo de una licitación (para la vista de ficha individual)."""
    client = MercadoPublicoClient(ticket=ticket)
    return client.detalle_licitacion(codigo)


def verificar_ticket(ticket: str) -> tuple[bool, str]:
    """Comprueba que un ticket funciona haciendo una llamada mínima."""
    client = MercadoPublicoClient(ticket=ticket)
    try:
        client.listar_licitaciones()
        return True, "Ticket válido y con cuota disponible."
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)
