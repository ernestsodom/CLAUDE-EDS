"""
Descarga de páginas de resultados de Portal Inmobiliario.

Dos modos de descarga:

- HTTP simple (``requests``): rápido y suficiente desde una conexión
  residencial, donde el sitio carga sin pedir cuenta.
- Navegador real (Playwright + Chromium): ejecuta JavaScript como un usuario.

Desde servidores en la nube (IP de datacenter) MercadoLibre responde a todo con
la barrera "¡Hola! Para continuar, ingresa a tu cuenta". Pasarla requiere una
sesión iniciada: cookies en ``PI_COOKIES`` o el archivo que guarda
``pi.py login``.
"""

from __future__ import annotations

import json
import os
import random
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import requests

from .config import BASE_URL, settings
from .filtros import POR_PAGINA, Filtros, paginar_url
from .parser import Aviso, es_barrera, parsear_pagina

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-CL,es;q=0.9,en;q=0.6",
}
DOMINIOS_SESION = (".portalinmobiliario.com", ".mercadolibre.cl", ".mercadolibre.com")


class BarreraLogin(RuntimeError):
    """El sitio exige iniciar sesión para mostrar resultados."""

    def __init__(self, url: str):
        super().__init__(
            "Portal Inmobiliario pidió iniciar sesión (barrera anti-bots de "
            f"MercadoLibre) al abrir {url}. Desde una conexión de hogar/oficina "
            "normalmente no ocurre; si te pasa, ejecuta `python pi.py login` una vez. "
            "En la nube define PI_COOKIES con la cookie de una sesión iniciada."
        )


def _cookies_de_texto(texto: str) -> list[dict]:
    """'a=1; b=2' -> cookies para todos los dominios de la sesión."""
    pares = [p.strip().split("=", 1) for p in texto.split(";") if "=" in p]
    return [
        {"name": k.strip(), "value": v.strip(), "domain": d, "path": "/"}
        for k, v in pares
        for d in DOMINIOS_SESION
    ]


def _cookies_de_sesion(ruta: Path) -> list[dict]:
    """Cookies del archivo storage-state que guarda `pi.py login`."""
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    return [c for c in datos.get("cookies", []) if c.get("name")]


class ClientePortal:
    """Obtiene el HTML de páginas del sitio con pausas entre solicitudes."""

    def __init__(self, navegador: bool = False, visible: bool = False,
                 cookies: str | None = None, sesion: Path | None = None,
                 pausa: float | None = None):
        self.navegador = navegador
        self.visible = visible
        self.pausa = settings.pausa if pausa is None else pausa
        self.sesion = sesion or settings.sesion
        texto = settings.cookies if cookies is None else cookies
        self.cookies = _cookies_de_texto(texto) if texto else []
        if self.sesion.exists():
            self.cookies += _cookies_de_sesion(self.sesion)
        self._ultima = 0.0
        self._http: requests.Session | None = None
        self._pw = self._browser = self._contexto = None

    @property
    def con_sesion(self) -> bool:
        return bool(self.cookies)

    # ------------------------------------------------------------------ #
    def obtener(self, url: str) -> tuple[str, str]:
        """Devuelve (html, url_final). Lanza BarreraLogin si el sitio pide cuenta."""
        espera = self.pausa + random.uniform(0, self.pausa / 2) - (time.time() - self._ultima)
        if self._ultima and espera > 0:
            time.sleep(espera)
        try:
            html, final = self._chromium(url) if self.navegador else self._requests(url)
        finally:
            self._ultima = time.time()
        if es_barrera(html, final):
            raise BarreraLogin(url)
        return html, final

    def _requests(self, url: str) -> tuple[str, str]:
        if self._http is None:
            self._http = requests.Session()
            self._http.headers.update(HEADERS)
            for c in self.cookies:
                self._http.cookies.set(c["name"], c["value"], domain=c["domain"],
                                       path=c.get("path", "/"))
        resp = self._http.get(url, timeout=settings.timeout)
        if resp.status_code >= 400 and not es_barrera(resp.text, resp.url):
            resp.raise_for_status()
        return resp.text, resp.url

    def _chromium(self, url: str) -> tuple[str, str]:
        if self._contexto is None:
            self._abrir_navegador()
        pagina = self._contexto.new_page()
        try:
            pagina.goto(url, wait_until="domcontentloaded", timeout=settings.timeout * 1000)
            try:
                pagina.wait_for_selector(".poly-card, .ui-search-rescue", timeout=8000)
            except Exception:  # sin resultados o barrera: se evalúa el HTML igual
                pass
            return pagina.content(), pagina.url
        finally:
            pagina.close()

    def _abrir_navegador(self) -> None:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:  # dependencia opcional
            raise RuntimeError(
                "El modo navegador necesita Playwright: "
                "pip install playwright && python -m playwright install chromium"
            ) from exc
        proxy = os.getenv("HTTPS_PROXY") or os.getenv("https_proxy")
        sin_proxy = os.getenv("NO_PROXY") or os.getenv("no_proxy")
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=not self.visible,
            proxy={"server": proxy, "bypass": sin_proxy} if proxy else None,
            args=["--disable-blink-features=AutomationControlled"],
        )
        self._contexto = self._browser.new_context(
            storage_state=str(self.sesion) if self.sesion.exists() else None,
            locale="es-CL", timezone_id="America/Santiago", user_agent=UA,
            viewport={"width": 1366, "height": 900},
        )
        if self.cookies and not self.sesion.exists():
            self._contexto.add_cookies(self.cookies)

    def cerrar(self) -> None:
        for recurso in (self._contexto, self._browser):
            if recurso is not None:
                recurso.close()
        if self._pw is not None:
            self._pw.stop()
        if self._http is not None:
            self._http.close()

    def __enter__(self) -> "ClientePortal":
        return self

    def __exit__(self, *exc) -> None:
        self.cerrar()


def iniciar_sesion(destino: Path, url: str = BASE_URL) -> None:
    """Abre un Chromium visible para que la persona inicie sesión y guarda las cookies."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        contexto = browser.new_context(locale="es-CL", timezone_id="America/Santiago")
        pagina = contexto.new_page()
        pagina.goto(url)
        input(
            "\nInicia sesión en la ventana del navegador (si no te lo pide, navega "
            "a cualquier búsqueda). Cuando veas resultados, vuelve aquí y presiona Enter… "
        )
        contexto.storage_state(path=str(destino))
        browser.close()


# ---------------------------------------------------------------------- #
# Búsqueda con paginación
# ---------------------------------------------------------------------- #
@dataclass
class Busqueda:
    """Avisos reunidos de una o más páginas de resultados."""

    url: str
    avisos: list[Aviso] = field(default_factory=list)
    paginas: list[str] = field(default_factory=list)
    total_sitio: int | None = None
    titulo: str | None = None
    filtros_sitio: list[str] = field(default_factory=list)
    advertencias: list[str] = field(default_factory=list)


def buscar(cliente: ClientePortal, *, filtros: Filtros | None = None,
           url: str | None = None, max_paginas: int | None = None,
           valor_uf: float | None = None,
           progreso: Callable[[str], None] = print) -> Busqueda:
    """Recorre páginas de resultados hasta juntar todo o llegar a `max_paginas`."""
    if (filtros is None) == (url is None):
        raise ValueError("Indica filtros o una URL de búsqueda (solo uno).")
    max_paginas = max_paginas or settings.max_paginas

    def url_de(pagina: int, por_pagina: int) -> str:
        if filtros is not None:
            return filtros.url(pagina, por_pagina, valor_uf)
        return paginar_url(url, pagina, por_pagina)

    res = Busqueda(url=url_de(1, POR_PAGINA))
    vistos: set[str] = set()
    por_pagina = POR_PAGINA
    for numero in range(1, max_paginas + 1):
        destino = url_de(numero, por_pagina)
        html, final = cliente.obtener(destino)
        pagina = parsear_pagina(html, final)
        res.paginas.append(destino)
        if numero == 1:
            res.total_sitio = pagina.total
            res.titulo = pagina.titulo
            res.filtros_sitio = pagina.filtros_sitio
            por_pagina = len(pagina.avisos) or POR_PAGINA
            if filtros is not None and filtros.orden != "relevancia" \
                    and pagina.orden_sitio in (None, "relevance"):
                res.advertencias.append(
                    "El sitio no confirmó el orden pedido; los avisos quedan en orden de relevancia."
                )
        elif pagina.offset is not None and pagina.offset == 0:
            res.advertencias.append(
                f"La página {numero} devolvió los primeros resultados otra vez; "
                "se detuvo la paginación."
            )
            break

        nuevos = [a for a in pagina.avisos if a.id not in vistos]
        for aviso in nuevos:
            vistos.add(aviso.id)
            aviso.posicion = len(res.avisos) + 1
            res.avisos.append(aviso)
        progreso(f"Página {numero}: {len(nuevos)} avisos nuevos (acumulado {len(res.avisos)}"
                 + (f" de {res.total_sitio})" if res.total_sitio else ")"))
        if not nuevos or len(pagina.avisos) < por_pagina:
            break
        if res.total_sitio and len(res.avisos) >= res.total_sitio:
            break
    return res
