"""
MÓDULO 2 — Web Intelligence & Competitive Analysis.

Para un prospecto con sitio web, hace fetch ético de su página (respeta
robots.txt, agrega delays, identifica el bot) y detecta:

- Ticketera actual (terceros / venta directa / manual).
- Pasarelas de pago integradas y CMS.
- Capacidad de compra online.
- Indicios de comisiones.
- Redes sociales y newsletter.
- Pain points (señales en la web + dolores típicos del segmento).

Degrada con elegancia: si no hay red o el sitio no responde, produce un análisis
heurístico basado en el perfil del segmento, marcando `fuente_datos` para que se
sepa que no se pudo leer la web.
"""

from __future__ import annotations

import re
import time
import urllib.robotparser
from typing import Any
from urllib.parse import urljoin, urlparse

import requests

from . import catalog
from .config import settings
from .models import Prospecto
from .util import log

try:
    from bs4 import BeautifulSoup  # type: ignore

    _BS4 = True
except Exception:  # noqa: BLE001
    _BS4 = False


# Palabras que delatan cobro de comisión / cargo por servicio al comprador.
_PALABRAS_COMISION = [
    "comisión", "comision", "cargo por servicio", "cargo de servicio",
    "service charge", "service fee", "costo de servicio", "fee de servicio",
    "tarifa de servicio", "recargo",
]

_PALABRAS_COMPRA = [
    "comprar entrada", "compra tu entrada", "comprar tickets", "comprar ticket",
    "compra de entradas", "boletería online", "boleteria online", "venta de entradas",
    "comprar aquí", "comprar ahora", "tickets", "entradas", "checkout", "carrito",
]

_PALABRAS_NEWSLETTER = [
    "newsletter", "suscríbete", "suscribete", "boletín", "boletin",
    "déjanos tu correo", "recibe novedades", "mailchimp",
]


# --------------------------------------------------------------------------- #
# Fetch ético
# --------------------------------------------------------------------------- #
def _robots_permite(url: str) -> bool:
    if not settings.respetar_robots:
        return True
    try:
        partes = urlparse(url)
        robots_url = f"{partes.scheme}://{partes.netloc}/robots.txt"
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(settings.user_agent, url)
    except Exception:  # noqa: BLE001 - ante la duda, se permite pero con cuidado
        return True


def _fetch(url: str) -> tuple[int | None, str]:
    """Descarga el HTML de una URL con reintentos. Devuelve (status, html)."""
    if not url:
        return None, ""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    if not _robots_permite(url):
        log(f"web_intel: robots.txt bloquea {url}")
        return None, ""

    headers = {"User-Agent": settings.user_agent, "Accept-Language": "es-CL,es"}
    ultimo: Exception | None = None
    for intento in range(settings.max_retries):
        try:
            resp = requests.get(
                url, headers=headers, timeout=settings.timeout, allow_redirects=True
            )
            time.sleep(settings.request_delay)  # scraping ético: no martillar
            # Solo tratamos como leído un 2xx; un 403/404/500 trae cuerpo de
            # error (o página de WAF) que NO debe analizarse como si fuera el sitio.
            if not resp.ok:
                log(f"web_intel: {url} respondió {resp.status_code} (no 2xx)")
                return resp.status_code, ""
            return resp.status_code, resp.text or ""
        except requests.RequestException as exc:
            ultimo = exc
            time.sleep(2 ** intento)
    log(f"web_intel: fallo al descargar {url}: {ultimo}")
    return None, ""


def _texto_y_enlaces(html: str, base_url: str) -> tuple[str, list[str]]:
    """Extrae texto plano y enlaces. Usa bs4 si está; si no, regex."""
    if _BS4:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        texto = soup.get_text(" ", strip=True)
        enlaces = [
            urljoin(base_url, a.get("href"))
            for a in soup.find_all("a", href=True)
        ]
        return texto, enlaces
    # Fallback sin bs4.
    texto = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S | re.I)
    texto = re.sub(r"<[^>]+>", " ", texto)
    texto = re.sub(r"\s+", " ", texto)
    enlaces = [urljoin(base_url, h) for h in re.findall(r'href=["\']([^"\']+)["\']', html, re.I)]
    return texto, enlaces


# --------------------------------------------------------------------------- #
# Detección
# --------------------------------------------------------------------------- #
def _detectar_en(firmas: tuple[str, ...], blob: str) -> bool:
    return any(f in blob for f in firmas)


def detectar_ticketera(blob: str) -> str:
    """Identifica la ticketera por firmas en el HTML/enlaces."""
    for nombre, t in catalog.TICKETERAS.items():
        if _detectar_en(t.firmas, blob):
            return nombre
    return ""


def detectar_pasarelas(blob: str) -> list[str]:
    return [n for n, firmas in catalog.PASARELAS_PAGO.items() if _detectar_en(firmas, blob)]


def detectar_cms(blob: str) -> str:
    for nombre, firmas in catalog.CMS_FIRMAS.items():
        if _detectar_en(firmas, blob):
            return nombre
    return ""


def _redes_de_enlaces(enlaces: list[str]) -> dict[str, str]:
    redes = {"facebook": "", "instagram": "", "linkedin": "", "youtube": "", "tiktok": ""}
    for e in enlaces:
        el = e.lower()
        if "facebook.com" in el and not redes["facebook"]:
            redes["facebook"] = e
        elif "instagram.com" in el and not redes["instagram"]:
            redes["instagram"] = e
        elif "linkedin.com" in el and not redes["linkedin"]:
            redes["linkedin"] = e
        elif "youtube.com" in el and not redes["youtube"]:
            redes["youtube"] = e
        elif "tiktok.com" in el and not redes["tiktok"]:
            redes["tiktok"] = e
    return redes


_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_FONO_RE = re.compile(r"\+?56[\s\-]?\d[\s\-]?\d{4}[\s\-]?\d{4}|\+?56\s?9\s?\d{4}\s?\d{4}")


def _extraer_comisiones(texto: str) -> str:
    """Busca menciones de comisión/cargo por servicio y devuelve un snippet."""
    bajo = texto.lower()
    for palabra in _PALABRAS_COMISION:
        idx = bajo.find(palabra)
        if idx != -1:
            snippet = texto[max(0, idx - 40): idx + 80].strip()
            return re.sub(r"\s+", " ", snippet)
    return ""


# --------------------------------------------------------------------------- #
# Análisis principal
# --------------------------------------------------------------------------- #
def analizar_web(prospecto: Prospecto) -> dict[str, Any]:
    """
    Ejecuta el análisis de inteligencia web de un prospecto.
    Devuelve el dict del Módulo 2 (ver SALIDA ESPERADA en el Prompt Maestro).
    """
    perfil = catalog.perfil_de(prospecto.tipo)
    status, html = _fetch(prospecto.sitio_web)
    leyo_web = bool(html)

    # Punto de partida heurístico (sirve también si no hay web).
    eventos_mes = perfil.eventos_mes_tipico
    volumen_mes = round((perfil.entradas_mes_min + perfil.entradas_mes_max) / 2)
    ticketera = prospecto.ticketera_identificada or ""
    pasarelas: list[str] = []
    cms = ""
    venta_online = False
    redes = {"facebook": prospecto.facebook, "instagram": prospecto.instagram,
             "linkedin": prospecto.linkedin_url, "youtube": "", "tiktok": ""}
    newsletter = False
    comision_snippet = ""
    emails: list[str] = []
    pains_detectados: list[str] = []

    if leyo_web:
        texto, enlaces = _texto_y_enlaces(html, prospecto.sitio_web)
        blob = (html + " " + " ".join(enlaces)).lower()

        ticketera_detectada = detectar_ticketera(blob)
        pasarelas = detectar_pasarelas(blob)
        cms = detectar_cms(blob)
        venta_online = (
            bool(ticketera_detectada)
            or bool(pasarelas)
            or any(p in blob for p in _PALABRAS_COMPRA)
        )
        redes_web = _redes_de_enlaces(enlaces)
        for k, v in redes_web.items():
            if v:
                redes[k] = v
        newsletter = any(p in blob for p in _PALABRAS_NEWSLETTER)
        comision_snippet = _extraer_comisiones(texto)
        emails = sorted(set(_EMAIL_RE.findall(texto)))

        # Clasificación de la ticketera.
        if ticketera_detectada:
            ticketera = ticketera_detectada
        elif venta_online and pasarelas:
            ticketera = catalog.TICKETERA_DIRECTA
        elif not venta_online:
            ticketera = catalog.TICKETERA_MANUAL
        else:
            ticketera = ticketera or catalog.TICKETERA_DESCONOCIDA

        # Pain points específicos detectados en la web.
        if not venta_online:
            pains_detectados.append("No vende entradas online (venta manual/presencial)")
        if comision_snippet:
            pains_detectados.append(f"Cobra cargo por servicio al comprador: «{comision_snippet}»")
        if ticketera_detectada:
            t = catalog.TICKETERAS[ticketera_detectada]
            pains_detectados.append(
                f"Depende de {ticketera_detectada} (comisión típica {t.comision_min:.0f}-{t.comision_max:.0f}%)"
            )
        if not newsletter:
            pains_detectados.append("Sin captura de correos / newsletter visible (datos en manos de terceros)")
        if cms == "Wix" or cms == "Squarespace":
            pains_detectados.append(f"Sitio en {cms}: integración de venta limitada")
    else:
        ticketera = ticketera or catalog.TICKETERA_DESCONOCIDA

    # Comisión identificada (texto): explícita de la web, o benchmark de la ticketera.
    if comision_snippet:
        comisiones_txt = "Mencionada en web: " + comision_snippet
    elif ticketera in catalog.TICKETERAS:
        t = catalog.TICKETERAS[ticketera]
        comisiones_txt = f"~{t.comision_media:.0f}% (estimada, benchmark {ticketera})"
    elif ticketera == catalog.TICKETERA_MANUAL:
        comisiones_txt = f"0% directo, pero ~{catalog.COSTO_INEFICIENCIA_MANUAL:.0f}% de ineficiencia operacional"
    else:
        comisiones_txt = "No determinada"

    # Pain points = detectados + dolores típicos del segmento (sin duplicar).
    pain_points = list(dict.fromkeys(pains_detectados + list(perfil.dolores)))

    ingresos_anual_uf = round(volumen_mes * 12 * perfil.ticket_promedio_uf, 1)

    resultado: dict[str, Any] = {
        "prospecto": prospecto.nombre_institucion,
        "url_analizada": prospecto.sitio_web,
        "fuente_datos": "web" if leyo_web else "heuristica_segmento",
        "http_status": status,
        "ticketera_actual": ticketera,
        "venta_online": venta_online,
        "cms": cms,
        "pasarelas_pago": pasarelas,
        "comisiones_identificadas": comisiones_txt,
        "eventos_mes_estimado": eventos_mes,
        "volumen_entradas_mes_estimado": volumen_mes,
        "ingresos_estimados_anual_uf": ingresos_anual_uf,
        "newsletter": newsletter,
        "redes": redes,
        "emails_detectados": emails,
        "pain_points_detectados": pain_points,
        "oportunidades_xperticket": list(perfil.oportunidades),
    }
    log(
        f"web_intel.analizar: {prospecto.id} ticketera={ticketera} "
        f"fuente={resultado['fuente_datos']} status={status}"
    )
    return resultado
