"""
MÓDULO 4 — Value Proposition Engine.

Genera la propuesta de valor personalizada por tipo de cliente, cuantifica el
ahorro/impacto y produce la narrativa comercial (cuerpo de email).

La narrativa se genera de forma determinista (plantilla) y, si hay
`ANTHROPIC_API_KEY`, se puede enriquecer con Claude para un tono más natural.
"""

from __future__ import annotations

from typing import Any

from . import catalog
from .config import settings
from .models import Prospecto
from .util import log, pct, uf, usd

_SALUDO_DEFAULT = "equipo"


def _resumen_situacion(prospecto: Prospecto, web: dict[str, Any], fin: dict[str, Any]) -> list[str]:
    return [
        f"~{web.get('volumen_entradas_mes_estimado')} entradas/mes "
        f"(~{fin.get('volumen_estimado_anual')} al año)",
        f"Sistema actual: {web.get('ticketera_actual')}",
        f"Comisión estimada: {pct(fin.get('comision_actual_pct'))} "
        f"(~{uf(fin.get('comision_actual_anual_uf'))}/año)",
    ]


def construir_narrativa(
    prospecto: Prospecto,
    web: dict[str, Any],
    fin: dict[str, Any],
    nombre_contacto: str | None = None,
) -> str:
    """Cuerpo de email determinista, fiel a la plantilla del Prompt Maestro."""
    nombre = nombre_contacto or _SALUDO_DEFAULT
    ahorro = uf(fin.get("ahorro_comisiones_anual_uf"))
    impacto = usd(fin.get("roi_estimado_anual_usd"))
    com_xperti = pct(fin.get("comision_xperticket_pct"))
    com_actual = pct(fin.get("comision_actual_pct"))

    lineas = [
        f"Hola {nombre},",
        "",
        "Somos Xperticket, plataforma SaaS chilena de venta y gestión de entradas.",
        "",
        f"Analicé la operación de {prospecto.nombre_institucion}:",
        "",
        "📊 Situación actual:",
    ]
    lineas += [f"- {s}" for s in _resumen_situacion(prospecto, web, fin)]
    lineas += [
        "",
        "🎯 Oportunidad con Xperticket:",
        f"- Bajar la comisión de {com_actual} a {com_xperti} "
        f"(ahorro estimado: {ahorro}/año)",
        "- Acceso 100% a los datos de tus clientes (CRM propio)",
        "- Reportes automáticos en tiempo real",
        f"- {prospecto.tipo}: " + _gancho_segmento(prospecto.tipo),
        "",
        f"💰 Impacto estimado: ~{impacto}/año en ahorro + eficiencia.",
        "",
        "¿Podemos tomar 20 minutos para explorar cómo aplicaría a tu operación?",
        "",
        "Saludos,",
        "Ernesto Domínguez — Director Comercial GovTech, Proexsi S.A.",
        "Xperticket.cl",
    ]
    return "\n".join(lineas)


def _gancho_segmento(tipo: str) -> str:
    perfil = catalog.perfil_de(tipo)
    return perfil.oportunidades[0] if perfil.oportunidades else "solución a tu medida"


def construir_narrativa_claude(
    prospecto: Prospecto,
    web: dict[str, Any],
    fin: dict[str, Any],
    nombre_contacto: str | None = None,
) -> str | None:
    """Enriquece la narrativa con Claude. Devuelve None si no hay API key/falla."""
    if not settings.claude_disponible:
        return None
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        sistema = (
            "Eres Ernesto Domínguez, Director Comercial GovTech de Proexsi S.A., "
            "vendiendo Xperticket (SaaS chileno de venta y gestión de entradas) a "
            "instituciones culturales y de entretenimiento. Escribes emails de "
            "outreach en español de Chile: cercanos, concretos, sin clichés "
            "corporativos, orientados a conseguir una reunión de 20 minutos. "
            "Usas los datos que te entregan sin inventar cifras."
        )
        datos = (
            f"Institución: {prospecto.nombre_institucion} ({prospecto.tipo}, "
            f"{prospecto.ciudad}, {prospecto.region}).\n"
            f"Sistema actual: {web.get('ticketera_actual')}.\n"
            f"Pain points: {', '.join(web.get('pain_points_detectados', [])[:4])}.\n"
            f"Volumen anual estimado: {fin.get('volumen_estimado_anual')} entradas.\n"
            f"Comisión actual ~{fin.get('comision_actual_pct')}% vs Xperticket "
            f"{fin.get('comision_xperticket_pct')}%.\n"
            f"Ahorro comisiones ~{fin.get('ahorro_comisiones_anual_uf')} UF/año.\n"
            f"ROI total estimado ~US${fin.get('roi_estimado_anual_usd')}/año.\n"
            f"Contacto: {nombre_contacto or 'equipo'}."
        )
        prompt = (
            "Redacta el cuerpo de un email de primer contacto (120-180 palabras) "
            "para esta institución, con un gancho personalizado, la situación "
            "actual, la oportunidad concreta y un cierre que pida 20 minutos. "
            "Devuelve solo el email, sin asunto ni explicaciones.\n\n" + datos
        )
        msg = client.messages.create(
            model=settings.claude_model,
            max_tokens=700,
            system=[{"type": "text", "text": sistema, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception as exc:  # noqa: BLE001
        log(f"proposals.claude: fallo, uso plantilla. {exc}")
        return None


def generar_propuesta(
    prospecto: Prospecto,
    web: dict[str, Any],
    fin: dict[str, Any],
    nombre_contacto: str | None = None,
    usar_claude: bool = False,
) -> dict[str, Any]:
    """Construye la propuesta de valor completa (Módulo 4)."""
    perfil = catalog.perfil_de(prospecto.tipo)

    narrativa = None
    if usar_claude:
        narrativa = construir_narrativa_claude(prospecto, web, fin, nombre_contacto)
    fuente_narrativa = "claude" if narrativa else "plantilla"
    if not narrativa:
        narrativa = construir_narrativa(prospecto, web, fin, nombre_contacto)

    propuesta = {
        "prospecto": prospecto.nombre_institucion,
        "tipo": prospecto.tipo,
        "dolor_actual": web.get("pain_points_detectados", list(perfil.dolores)),
        "propuesta_xperticket": web.get("oportunidades_xperticket", list(perfil.oportunidades)),
        "roi_resumen": {
            "ahorro_comisiones_anual_uf": fin.get("ahorro_comisiones_anual_uf"),
            "beneficios_intangibles_anual_usd": fin.get("beneficios_intangibles_anual_usd"),
            "roi_estimado_anual_usd": fin.get("roi_estimado_anual_usd"),
            "payback_meses": fin.get("payback_meses"),
        },
        "narrativa_email": narrativa,
        "fuente_narrativa": fuente_narrativa,
    }
    log(f"proposals.generar: {prospecto.id} narrativa={fuente_narrativa}")
    return propuesta
