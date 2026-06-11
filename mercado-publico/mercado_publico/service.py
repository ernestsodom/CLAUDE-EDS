"""
Capa de orquestación: descarga desde la API, normaliza y cachea.

Une el cliente HTTP, los modelos y el almacenamiento para ofrecer operaciones
de alto nivel que consume la interfaz (Streamlit o CLI).
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from typing import Any, Callable

from . import storage
from .api_client import MercadoPublicoClient
from .models import normalizar_licitacion, normalizar_resumen


def _rango_fechas(desde: date, hasta: date) -> list[date]:
    dias = (hasta - desde).days
    return [desde + timedelta(days=i) for i in range(dias + 1)]


# Cliente por hilo: requests.Session no se comparte entre hilos.
_local = threading.local()


def _client_hilo(ticket: str | None) -> MercadoPublicoClient:
    cli = getattr(_local, "cli", None)
    if cli is None:
        # delay=0: en modo paralelo la concurrencia ya espacia las llamadas.
        cli = MercadoPublicoClient(ticket=ticket, delay=0)
        _local.cli = cli
    return cli


def sincronizar_licitaciones(
    desde: date,
    hasta: date,
    estado: str | None = None,
    enriquecer: bool = True,
    limite_detalle: int = 400,
    progreso: Callable[[float, str], None] | None = None,
    ticket: str | None = None,
    workers: int = 8,
    saltar_cacheadas: bool = True,
    rubros_filtro: list[str] | None = None,
    proveedor_filtro: str | None = None,
) -> dict[str, Any]:
    """
    Descarga licitaciones en un rango de fechas y las guarda en el caché.

    - `estado`: filtra por estado EN ORIGEN (activas, desierta, adjudicada, ...).
    - `enriquecer`: si True, descarga el detalle (rubros, comprador, adjudicación).
    - `limite_detalle`: tope de detalles a descargar.
    - `workers`: nº de descargas de detalle en paralelo.
    - `saltar_cacheadas`: omite las que ya están en caché.
    - `rubros_filtro`: lista de segmentos (ej. ['43','81']); sólo guarda las que
      tengan alguno de esos rubros. Requiere `enriquecer=True`.
    - `proveedor_filtro`: texto; sólo guarda las adjudicadas a ese proveedor.
    Devuelve un resumen de la operación.
    """
    client = MercadoPublicoClient(ticket=ticket)
    dias = _rango_fechas(desde, hasta)

    resumenes: dict[str, dict[str, Any]] = {}
    for i, dia in enumerate(dias):
        if progreso:
            progreso(i / max(len(dias), 1) * 0.3, f"Listando {dia.isoformat()}…")
        try:
            for r in client.listar_licitaciones(fecha=dia, estado=estado):
                cod = r.get("CodigoExterno")
                if cod:
                    resumenes[cod] = r
        except Exception as exc:  # noqa: BLE001 - se reporta, no se aborta todo
            if progreso:
                progreso(i / max(len(dias), 1) * 0.3, f"⚠ {dia}: {exc}")

    registros: list[dict[str, Any]] = []
    detalles_ok = 0

    if not enriquecer:
        registros = [normalizar_resumen(r) for r in resumenes.values()]
        guardados = storage.guardar_licitaciones(registros)
        if progreso:
            progreso(1.0, "Listo (carga rápida sin detalle)")
        return {
            "encontradas": len(resumenes), "detalles_descargados": 0,
            "guardadas": guardados, "omitidas_cache": 0,
            "total_en_cache": storage.contar(),
        }

    codigos = list(resumenes.keys())
    omitidas = 0
    if saltar_cacheadas:
        ya = storage.codigos_cacheados()
        nuevos = [c for c in codigos if c not in ya]
        omitidas = len(codigos) - len(nuevos)
        codigos = nuevos
    codigos = codigos[:limite_detalle]
    total = max(len(codigos), 1)

    def _bajar(cod: str) -> dict[str, Any]:
        try:
            detalle = _client_hilo(ticket).detalle_licitacion(cod)
            if detalle:
                return normalizar_licitacion(detalle)
        except Exception:  # noqa: BLE001
            pass
        return normalizar_resumen(resumenes[cod])

    rubros_set = set(rubros_filtro) if rubros_filtro else None
    prov_lower = proveedor_filtro.lower() if proveedor_filtro else None

    def _coincide(reg: dict[str, Any]) -> bool:
        if rubros_set:
            segs = set((reg.get("rubros") or "").split(","))
            if not (segs & rubros_set):
                return False
        if prov_lower:
            campos = f"{reg.get('proveedores_adjudicados','')} {reg.get('proveedor_adjudicado','')}".lower()
            if prov_lower not in campos:
                return False
        return True

    # Descarga de detalles en paralelo (gran salto de velocidad).
    hechos = 0
    descartadas = 0
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futuros = {pool.submit(_bajar, cod): cod for cod in codigos}
        for fut in as_completed(futuros):
            reg = fut.result()
            hechos += 1
            if reg.get("rubros") is not None or reg.get("comprador"):
                detalles_ok += 1
            if _coincide(reg):
                registros.append(reg)
            else:
                descartadas += 1
            if progreso and (hechos % 10 == 0 or hechos == total):
                progreso(0.3 + hechos / total * 0.7,
                         f"Detalle {hechos}/{total} (×{workers} en paralelo)")

    guardados = storage.guardar_licitaciones(registros)
    if progreso:
        progreso(1.0, "Listo")

    return {
        "encontradas": len(resumenes),
        "detalles_descargados": detalles_ok,
        "omitidas_cache": omitidas,
        "descartadas_filtro": descartadas,
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
