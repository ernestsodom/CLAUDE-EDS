"""
Orquestación: ejecuta los módulos 2-5 sobre un prospecto y persiste el análisis.

Une web_intel → finance → proposals → contact en un único `payload` por
prospecto y ofrece el procesamiento por lotes (batch) con caché por frescura.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from . import contact, finance, proposals, storage, web_intel
from .config import settings
from .models import Prospecto
from .util import log


def analizar_prospecto(
    prospecto: Prospecto,
    comision_xperticket_pct: float | None = None,
    nombre_contacto: str | None = None,
    usar_claude: bool = False,
) -> dict[str, Any]:
    """Ejecuta el análisis end-to-end (módulos 2-5) de un prospecto."""
    web = web_intel.analizar_web(prospecto)
    fin = finance.analizar_finanzas(
        prospecto, web, comision_xperticket_pct=comision_xperticket_pct
    )
    propuesta = proposals.generar_propuesta(
        prospecto, web, fin, nombre_contacto=nombre_contacto, usar_claude=usar_claude
    )
    plan = contact.generar_plan(prospecto, web, fin, nombre_contacto=nombre_contacto)

    payload = {
        "prospecto_id": prospecto.id,
        "prospecto": prospecto.nombre_institucion,
        "tipo": prospecto.tipo,
        "region": prospecto.region,
        "ciudad": prospecto.ciudad,
        "sitio_web": prospecto.sitio_web,
        "web_intel": web,
        "finanzas": fin,
        "propuesta": propuesta,
        "contacto": plan,
    }

    # Enriquecer el registro del prospecto con lo aprendido (ticketera, email).
    _retroalimentar_prospecto(prospecto, web)

    storage.guardar_analisis(prospecto.id, payload)
    log(f"pipeline.analizar_prospecto: {prospecto.id} OK")
    return payload


def _retroalimentar_prospecto(prospecto: Prospecto, web: dict[str, Any]) -> None:
    """Actualiza el prospecto con datos descubiertos durante el análisis."""
    cambios = False
    if web.get("ticketera_actual") and prospecto.ticketera_identificada != web["ticketera_actual"]:
        prospecto.ticketera_identificada = web["ticketera_actual"]
        cambios = True
    if not prospecto.email_publico:
        detectados = web.get("emails_detectados") or []
        if detectados:
            prospecto.email_publico = detectados[0]
            cambios = True
    redes = web.get("redes", {}) or {}
    for campo, clave in (("facebook", "facebook"), ("instagram", "instagram"), ("linkedin_url", "linkedin")):
        if not getattr(prospecto, campo) and redes.get(clave):
            setattr(prospecto, campo, redes[clave])
            cambios = True
    if cambios:
        prospecto.estado_prospectable = (
            "prospectable" if (prospecto.email_publico or prospecto.sitio_web) else "incompleto"
        )
        storage.guardar_prospectos([prospecto])


def _esta_fresco(prospecto_id: str) -> bool:
    """True si ya hay un análisis dentro de la ventana de re-análisis."""
    existente = storage.obtener_analisis(prospecto_id)
    if not existente:
        return False
    ts = existente.get("_actualizado_en")
    if not ts:
        return False
    try:
        fecha = datetime.fromisoformat(ts)
        if fecha.tzinfo is None:
            fecha = fecha.replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    limite = datetime.now(timezone.utc) - timedelta(days=settings.reanalisis_dias)
    return fecha > limite


def analizar_todos(
    comision_xperticket_pct: float | None = None,
    usar_claude: bool = False,
    forzar: bool = False,
    limite: int | None = None,
    progreso: Callable[[float, str], None] | None = None,
) -> dict[str, Any]:
    """
    Analiza todos los prospectos de la base (batch).

    - `forzar`: re-analiza aunque exista un análisis reciente.
    - `limite`: tope de prospectos a procesar en esta corrida.
    """
    prospectos = storage.cargar_prospectos()
    if limite:
        prospectos = prospectos[:limite]

    total = max(len(prospectos), 1)
    analizados = 0
    saltados = 0
    for i, p in enumerate(prospectos):
        if progreso:
            progreso(i / total, f"{p.nombre_institucion}")
        if not forzar and _esta_fresco(p.id):
            saltados += 1
            continue
        try:
            analizar_prospecto(
                p, comision_xperticket_pct=comision_xperticket_pct, usar_claude=usar_claude
            )
            analizados += 1
        except Exception as exc:  # noqa: BLE001 - se reporta y se sigue
            log(f"pipeline.analizar_todos: error en {p.id}: {exc}")

    reprioritizar()
    if progreso:
        progreso(1.0, "Listo")

    return {
        "analizados": analizados,
        "saltados_por_frescura": saltados,
        "total_con_analisis": storage.contar_analisis(),
    }


def reprioritizar() -> int:
    """Recalcula la prioridad global (por score) y la persiste."""
    analisis = storage.cargar_analisis()
    contact.priorizar(analisis)
    for a in analisis:
        pid = a.get("prospecto_id")
        if pid:
            a.pop("_actualizado_en", None)
            storage.guardar_analisis(pid, a)
    return len(analisis)
