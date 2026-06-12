"""
MÓDULO 3 — Financial & Commission Analysis.

Estima volumen, comisión actual y comisión Xperticket, y calcula el ahorro y el
ROI anual de migrar. Todos los supuestos viven en `catalog.py` y los tipos de
cambio en `config.py` (ACTUALIZAR periódicamente).

Definición de payback usada:
    payback_meses = (costo anual de Xperticket) / (ROI mensual)
    = en cuántos meses el valor generado cubre lo que cuesta Xperticket.
"""

from __future__ import annotations

from typing import Any

from . import catalog
from .config import settings
from .models import Prospecto
from .util import log

# Comisión actual estimada cuando no se puede determinar la ticketera.
COMISION_DESCONOCIDA_PCT = 10.0
# Comisión efectiva de quien vende directo (pasarela + mantención), sin ticketera.
COMISION_DIRECTA_PCT = 3.5


def comision_actual_pct(ticketera: str) -> tuple[float, bool]:
    """
    Devuelve (comisión %, es_estimada) según la ticketera detectada.
    `es_estimada` indica que el % es un supuesto y no un dato leído.
    """
    if ticketera in catalog.TICKETERAS:
        return catalog.TICKETERAS[ticketera].comision_media, True
    if ticketera == catalog.TICKETERA_MANUAL:
        return catalog.COSTO_INEFICIENCIA_MANUAL, True
    if ticketera == catalog.TICKETERA_DIRECTA:
        return COMISION_DIRECTA_PCT, True
    return COMISION_DESCONOCIDA_PCT, True


def analizar_finanzas(
    prospecto: Prospecto,
    web_intel: dict[str, Any],
    comision_xperticket_pct: float | None = None,
    ticket_promedio_uf: float | None = None,
    volumen_anual: int | None = None,
) -> dict[str, Any]:
    """Calcula el caso financiero (Módulo 3) para un prospecto."""
    perfil = catalog.perfil_de(prospecto.tipo)

    # Volumen anual (entradas/año).
    if volumen_anual is None:
        vol_mes = web_intel.get("volumen_entradas_mes_estimado") or round(
            (perfil.entradas_mes_min + perfil.entradas_mes_max) / 2
        )
        volumen_anual = int(vol_mes * 12)

    ticket = ticket_promedio_uf or perfil.ticket_promedio_uf
    ingresos_anuales_uf = round(volumen_anual * ticket, 1)

    # Comisiones.
    com_actual, actual_estimada = comision_actual_pct(web_intel.get("ticketera_actual", ""))
    com_xperti = (
        comision_xperticket_pct
        if comision_xperticket_pct is not None
        else catalog.XPERTICKET_COMISION_DEFAULT
    )

    comision_actual_uf = round(ingresos_anuales_uf * com_actual / 100, 1)
    comision_xperti_uf = round(ingresos_anuales_uf * com_xperti / 100, 1)
    ahorro_uf = round(comision_actual_uf - comision_xperti_uf, 1)

    # Conversión a USD.
    uf_usd = settings.uf_to_usd
    ahorro_usd = round(ahorro_uf * uf_usd)
    intangibles_usd = perfil.intangibles_usd_anual
    roi_usd = ahorro_usd + intangibles_usd

    # Payback.
    roi_mensual = roi_usd / 12 if roi_usd else 0
    comision_xperti_usd = comision_xperti_uf * uf_usd
    payback_meses = round(comision_xperti_usd / roi_mensual, 1) if roi_mensual > 0 else None

    resultado = {
        "prospecto": prospecto.nombre_institucion,
        "volumen_estimado_anual": volumen_anual,
        "ticket_promedio_uf": ticket,
        "ingresos_anuales_uf": ingresos_anuales_uf,
        "comision_actual_pct": com_actual,
        "comision_actual_es_estimada": actual_estimada,
        "comision_xperticket_pct": com_xperti,
        "comision_actual_anual_uf": comision_actual_uf,
        "comision_xperticket_anual_uf": comision_xperti_uf,
        "ahorro_comisiones_anual_uf": ahorro_uf,
        "ahorro_comisiones_anual_usd": ahorro_usd,
        "beneficios_intangibles_anual_usd": intangibles_usd,
        "roi_estimado_anual_usd": roi_usd,
        "payback_meses": payback_meses,
        "tipo_cambio_uf_usd": round(uf_usd, 1),
    }
    log(
        f"finance.analizar: {prospecto.id} vol={volumen_anual} "
        f"com_act={com_actual}% ahorro={ahorro_uf}UF roi=${roi_usd}"
    )
    return resultado
