"""
Cliente para la API oficial de Mercado Público (ChileCompra).

Documentación: https://api.mercadopublico.cl/modules/api/
Todas las llamadas requieren un `ticket` gratuito que se obtiene en el portal
de desarrolladores de Mercado Público.
"""

from __future__ import annotations

import time
from datetime import date
from typing import Any

import requests

from .config import API_BASE, settings


class MercadoPublicoError(RuntimeError):
    """Error al consultar la API de Mercado Público."""


# Códigos de estado que devuelve la API en el detalle de cada licitación.
ESTADOS_CODIGO = {
    5: "Publicada",
    6: "Cerrada",
    7: "Desierta",
    8: "Adjudicada",
    18: "Revocada",
    19: "Suspendida",
}

# Valores aceptados por el parámetro `estado` al listar licitaciones.
ESTADOS_FILTRO = [
    "activas",
    "publicada",
    "cerrada",
    "desierta",
    "adjudicada",
    "revocada",
    "suspendida",
]


class MercadoPublicoClient:
    """Wrapper con reintentos y manejo de errores sobre la API REST."""

    def __init__(self, ticket: str | None = None, delay: float | None = None):
        self.ticket = ticket or settings.ticket
        # Pausa por llamada; en modo paralelo se pasa delay=0 (la concurrencia
        # ya espacia las peticiones).
        self.delay = settings.request_delay if delay is None else delay
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "claude-eds-mp/0.1"})

    # ------------------------------------------------------------------ #
    # Infraestructura de red
    # ------------------------------------------------------------------ #
    def _get(self, recurso: str, params: dict[str, Any]) -> dict[str, Any]:
        """GET con reintentos exponenciales. Devuelve el JSON decodificado."""
        params = {k: v for k, v in params.items() if v is not None}
        params["ticket"] = self.ticket
        url = f"{API_BASE}/{recurso}"

        ultimo_error: Exception | None = None
        for intento in range(settings.max_retries):
            try:
                resp = self.session.get(url, params=params, timeout=settings.timeout)
                # La API responde 401/403 cuando el ticket es inválido o sin cuota.
                if resp.status_code in (401, 403):
                    raise MercadoPublicoError(
                        "Ticket inválido o sin cuota disponible. "
                        "Verifica tu ticket de la API de Mercado Público."
                    )
                resp.raise_for_status()
                if self.delay:
                    time.sleep(self.delay)
                return resp.json()
            except MercadoPublicoError:
                raise
            except (requests.RequestException, ValueError) as exc:
                ultimo_error = exc
                espera = 2 ** (intento + 1)
                time.sleep(espera)

        raise MercadoPublicoError(
            f"No se pudo consultar {recurso} tras {settings.max_retries} intentos: {ultimo_error}"
        )

    @staticmethod
    def _fecha(d: date | str | None) -> str | None:
        """Formatea una fecha como ddmmyyyy, que es lo que espera la API."""
        if d is None:
            return None
        if isinstance(d, str):
            return d
        return d.strftime("%d%m%Y")

    # ------------------------------------------------------------------ #
    # Licitaciones
    # ------------------------------------------------------------------ #
    def listar_licitaciones(
        self,
        fecha: date | str | None = None,
        estado: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Lista resúmenes de licitaciones.

        - Sin parámetros: publicadas en el día de hoy.
        - `fecha`: publicadas en esa fecha (ddmmyyyy).
        - `estado`: una de ESTADOS_FILTRO.
        Devuelve la lista de resúmenes (CodigoExterno, Nombre, CodigoEstado, FechaCierre).
        """
        params: dict[str, Any] = {"fecha": self._fecha(fecha)}
        if estado:
            params["estado"] = estado
        data = self._get("licitaciones.json", params)
        return data.get("Listado", []) or []

    def detalle_licitacion(self, codigo: str) -> dict[str, Any] | None:
        """Detalle completo de una licitación por su CodigoExterno."""
        data = self._get("licitaciones.json", {"codigo": codigo})
        listado = data.get("Listado", []) or []
        return listado[0] if listado else None

    # ------------------------------------------------------------------ #
    # Órdenes de compra (compras históricas / compras similares)
    # ------------------------------------------------------------------ #
    def listar_ordenes_compra(
        self, fecha: date | str | None = None, estado: str | None = None
    ) -> list[dict[str, Any]]:
        """Lista resúmenes de órdenes de compra (por fecha o estado)."""
        params: dict[str, Any] = {"fecha": self._fecha(fecha)}
        if estado:
            params["estado"] = estado
        data = self._get("ordenesdecompra.json", params)
        return data.get("Listado", []) or []

    def detalle_orden_compra(self, codigo: str) -> dict[str, Any] | None:
        """Detalle de una orden de compra por su código."""
        data = self._get("ordenesdecompra.json", {"codigo": codigo})
        listado = data.get("Listado", []) or []
        return listado[0] if listado else None
