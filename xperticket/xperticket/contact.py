"""
MÓDULO 5 — Contact Strategy & Prioritization.

Calcula el score del prospecto (0-100) con la rúbrica del Prompt Maestro, arma
el plan de contacto en 3 pasos y genera los templates de outreach (email
inicial, follow-up y guion de llamada).
"""

from __future__ import annotations

from typing import Any

from . import catalog
from .models import Prospecto
from .proposals import construir_narrativa
from .util import log, pct, uf, usd


# --------------------------------------------------------------------------- #
# Scoring (0-100)
# --------------------------------------------------------------------------- #
def _score_volumen(entradas_mes: float | None) -> int:
    v = entradas_mes or 0
    if v < 200:
        return 10
    if v <= 600:
        return 20
    if v <= 1500:
        return 25
    return 30


def _score_comision(ticketera: str, comision_pct: float | None) -> int:
    if ticketera == catalog.TICKETERA_MANUAL:
        return 20  # sin ticketera, opera manual
    c = comision_pct or 0
    if c > 10:
        return 30  # ticketera cara
    if c >= 5:
        return 20  # ticketera media
    return 10  # ticketera eficiente / venta directa


def _score_contacto(prospecto: Prospecto, web: dict[str, Any]) -> int:
    email = prospecto.email_publico or (web.get("emails_detectados") or [None])[0]
    if email and prospecto.sitio_web:
        return 20
    redes = web.get("redes", {}) or {}
    tiene_redes = any(redes.get(k) for k in ("facebook", "instagram", "linkedin"))
    if prospecto.telefono or tiene_redes or prospecto.sitio_web:
        return 15
    return 10


def _score_fit(web: dict[str, Any]) -> int:
    venta_online = web.get("venta_online")
    cms = web.get("cms")
    newsletter = web.get("newsletter")
    if venta_online and (newsletter or cms):
        return 20  # moderna / tech-friendly
    if web.get("url_analizada"):
        return 15  # tradicional pero con presencia
    return 10  # legacy


def calcular_score(prospecto: Prospecto, web: dict[str, Any], fin: dict[str, Any]) -> dict[str, Any]:
    a = _score_volumen(web.get("volumen_entradas_mes_estimado"))
    b = _score_comision(web.get("ticketera_actual", ""), fin.get("comision_actual_pct"))
    c = _score_contacto(prospecto, web)
    d = _score_fit(web)
    total = a + b + c + d
    return {
        "score": total,
        "desglose": {
            "volumen": a,
            "comision": b,
            "facilidad_contacto": c,
            "fit_cultural": d,
        },
    }


# --------------------------------------------------------------------------- #
# Templates de outreach
# --------------------------------------------------------------------------- #
def template_followup(prospecto: Prospecto, fin: dict[str, Any]) -> str:
    return "\n".join(
        [
            "Hola de nuevo,",
            "",
            f"Te escribí hace unos días sobre cómo Xperticket podría ayudar a "
            f"{prospecto.nombre_institucion} a reducir comisiones "
            f"(~{uf(fin.get('ahorro_comisiones_anual_uf'))}/año) y a tener el 100% "
            "de los datos de sus clientes.",
            "",
            "¿Tienes 20 minutos esta semana o la próxima? Me acomodo a tu agenda.",
            "",
            "Saludos,",
            "Ernesto Domínguez — Xperticket.cl",
        ]
    )


def template_llamada(prospecto: Prospecto, web: dict[str, Any], fin: dict[str, Any]) -> str:
    return "\n".join(
        [
            f"GUION DE LLAMADA — {prospecto.nombre_institucion}",
            "",
            "1. Apertura (15s): Soy Ernesto de Xperticket, plataforma chilena de "
            "venta de entradas. ¿Hablo con la persona a cargo de boletería/ventas?",
            "2. Gancho: Vi que usan "
            f"{web.get('ticketera_actual')}; con Xperticket bajarías la comisión a "
            f"{pct(fin.get('comision_xperticket_pct'))} y tendrías el CRM de tus clientes.",
            f"3. Dato de valor: estimamos un impacto de ~{usd(fin.get('roi_estimado_anual_usd'))}/año.",
            "4. Objetivo: agendar una demo de 20-45 min (tablet, en vivo).",
            "5. Manejo de objeción: 'Ya tenemos sistema' → justamente comparamos sin "
            "compromiso; muchos descubren cuánto pagan en comisiones ocultas.",
            "6. Cierre: ¿Te parece el martes o el jueves a media mañana?",
        ]
    )


# --------------------------------------------------------------------------- #
# Plan de contacto
# --------------------------------------------------------------------------- #
def _contactos(prospecto: Prospecto, web: dict[str, Any]) -> list[dict[str, str]]:
    emails = []
    if prospecto.email_publico:
        emails.append(prospecto.email_publico)
    for e in web.get("emails_detectados", []) or []:
        if e not in emails:
            emails.append(e)
    return [
        {
            "rol": "Contacto principal (validar: director/a administrativo o de públicos)",
            "email": emails[0] if emails else "",
            "emails_alternativos": ", ".join(emails[1:]) if len(emails) > 1 else "",
            "telefono": prospecto.telefono,
            "linkedin": prospecto.linkedin_url,
        }
    ]


def generar_plan(
    prospecto: Prospecto,
    web: dict[str, Any],
    fin: dict[str, Any],
    nombre_contacto: str | None = None,
) -> dict[str, Any]:
    """Plan de contacto completo (Módulo 5), incluyendo score y templates."""
    score = calcular_score(prospecto, web, fin)
    plantilla_tipo = f"propuesta_{(prospecto.tipo or 'general').lower().replace(' ', '_')}"

    plan = {
        "prospecto": prospecto.nombre_institucion,
        "score": score["score"],
        "score_desglose": score["desglose"],
        "prioridad": None,  # se asigna al priorizar el conjunto
        "estrategia_contacto": {
            "paso_1": {
                "accion": "Email a contacto administrativo / de públicos",
                "plantilla": plantilla_tipo,
                "timing": "lunes 10:00",
                "follow_up": "7 días si no responde",
            },
            "paso_2": {
                "accion": "Llamada telefónica",
                "objetivo": "Agendar reunión/demo",
                "timing": "2-3 días después del 2º email",
            },
            "paso_3": {
                "accion": "Reunión / demo en vivo",
                "duracion": "20-45 minutos",
                "llevar": "Tablet con demo de Xperticket en vivo",
            },
        },
        "contactos_identificados": _contactos(prospecto, web),
        "templates": {
            "email_inicial": construir_narrativa(prospecto, web, fin, nombre_contacto),
            "email_followup": template_followup(prospecto, fin),
            "guion_llamada": template_llamada(prospecto, web, fin),
        },
    }
    log(f"contact.generar_plan: {prospecto.id} score={score['score']}")
    return plan


def priorizar(analisis: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Asigna `prioridad` (1 = mejor) ordenando por score descendente."""
    ordenados = sorted(
        analisis,
        key=lambda a: a.get("contacto", {}).get("score", 0),
        reverse=True,
    )
    for i, a in enumerate(ordenados, start=1):
        a.setdefault("contacto", {})["prioridad"] = i
    return ordenados
