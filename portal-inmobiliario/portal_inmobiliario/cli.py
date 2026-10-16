"""CLI para extraer avisos de Portal Inmobiliario según filtros y generar el informe."""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from statistics import median

import click
import requests

from . import analisis, reporte
from .cliente import BarreraLogin, ClientePortal, buscar as buscar_avisos, iniciar_sesion
from .config import SALIDA_DIR, settings
from .filtros import CARACTERISTICAS, ORDENES, Filtros
from .indicadores import valor_uf
from .parser import parsear_pagina


def opciones_filtro(f):
    """Opciones de filtro compartidas por `url` y `buscar`."""
    opciones = [
        click.option("--operacion", default="venta", show_default=True,
                     help="venta | arriendo | arriendo-de-temporada"),
        click.option("--tipo", default="departamento", show_default=True,
                     help="departamento | casa | oficina | terreno | parcela | local-comercial…"),
        click.option("--comuna", help='Nombre de la comuna, p. ej. "Las Condes" o "Ñuñoa".'),
        click.option("--region", default="metropolitana", show_default=True,
                     help="Región de la comuna (slug del sitio: valparaiso, biobio…)."),
        click.option("--ubicacion", help="Slug libre del sitio (barrios), reemplaza comuna/región."),
        click.option("--condicion", type=click.Choice(["nuevo", "usado"]), help="Proyectos nuevos o usados."),
        click.option("--dormitorios", type=int, help="Dormitorios exactos (0 = monoambiente)."),
        click.option("--dormitorios-min", type=int),
        click.option("--dormitorios-max", type=int),
        click.option("--banos-min", type=int),
        click.option("--estacionamientos-min", type=int),
        click.option("--precio-min", type=float),
        click.option("--precio-max", type=float),
        click.option("--moneda", type=click.Choice(["UF", "CLP"], case_sensitive=False),
                     default="UF", show_default=True, help="Moneda de --precio-min/--precio-max."),
        click.option("--m2-min", "superficie_util_min", type=float, help="Superficie útil mínima (m²)."),
        click.option("--m2-max", "superficie_util_max", type=float, help="Superficie útil máxima (m²)."),
        click.option("--m2-total-min", "superficie_total_min", type=float),
        click.option("--m2-total-max", "superficie_total_max", type=float),
        click.option("--antiguedad-max", type=int, help="Años de antigüedad máximos (0 = a estrenar)."),
        click.option("--gastos-comunes-max", type=int, help="Gastos comunes máximos (CLP)."),
        click.option("--con", "caracteristicas", multiple=True,
                     type=click.Choice(sorted(CARACTERISTICAS)), help="Característica (repetible)."),
        click.option("--publica", "publicador", type=click.Choice(["profesional", "particular"])),
        click.option("--publicados-hoy", is_flag=True),
        click.option("--orden", type=click.Choice(list(ORDENES)), default="relevancia", show_default=True),
    ]
    for opcion in reversed(opciones):
        f = opcion(f)
    return f


def _filtros(kw: dict) -> Filtros:
    dorm = kw.pop("dormitorios", None)
    if dorm is not None:
        kw["dormitorios_min"] = kw["dormitorios_max"] = dorm
    kw["caracteristicas"] = list(kw.get("caracteristicas") or [])
    try:
        return Filtros(**kw)
    except ValueError as exc:
        raise click.BadParameter(str(exc)) from exc


def _uf(fecha: date | None = None):
    uf = valor_uf(fecha)
    if uf is None:
        click.echo("⚠️  No se pudo obtener el valor UF (mindicador.cl ni boostr.cl). Un precio en UF "
                   "se filtrará solo en local; para fijarlo define PI_VALOR_UF.")
    return uf


@click.group()
def cli() -> None:
    """Extrae avisos de Portal Inmobiliario según filtros y genera un informe."""


@cli.command()
@opciones_filtro
def url(**kw) -> None:
    """Muestra la URL de búsqueda que corresponde a los filtros (sin conectarse)."""
    filtros = _filtros(kw)
    uf = _uf() if filtros.moneda == "UF" and (filtros.precio_min or filtros.precio_max) else None
    click.echo(filtros.url(valor_uf=uf[0] if uf else None))


def _comun_salida(f):
    for opcion in reversed([
        click.option("--salida", type=click.Path(path_type=Path), default=SALIDA_DIR,
                     show_default=True, help="Carpeta de salida."),
        click.option("--nombre", help="Nombre base de los archivos (sin extensión)."),
        click.option("--titulo", help="Título del informe (por defecto, el de la búsqueda)."),
        click.option("--aviso", "nota", help="Nota destacada al inicio del informe."),
        click.option("--artefacto", is_flag=True,
                     help="Además guarda una versión sin <html>/<body> para publicarla."),
    ]):
        f = opcion(f)
    return f


def _miles(valor: float, decimales: int = 0) -> str:
    return f"{valor:,.{decimales}f}".replace(",", "_").replace(".", ",").replace("_", ".")


def _mostrar_salida(rutas: dict[str, Path], datos: dict) -> None:
    filas, mon = datos["avisos"], datos["moneda"]
    precios = [f["precio_a"] for f in filas if f["precio_a"] is not None]
    por_m2 = [f["precio_m2"] for f in filas if f["precio_m2"] is not None]
    total = f" de {_miles(datos['total_sitio'])} en el sitio" if datos["total_sitio"] else ""
    click.echo(f"\n✅ {len(filas)} avisos{total}")
    if precios:
        click.echo(f"   Precio mediano: {mon} {_miles(median(precios))}")
    if por_m2:
        click.echo(f"   {mon}/m² útil mediano: {_miles(median(por_m2), 1)}")
    for tipo, ruta in rutas.items():
        click.echo(f"   {tipo:10s} {ruta}")


@cli.command()
@opciones_filtro
@click.option("--url", "url_busqueda", help="URL de búsqueda copiada del sitio (en vez de filtros).")
@click.option("--paginas", type=int, default=None, help=f"Máximo de páginas (por defecto {settings.max_paginas}).")
@click.option("--navegador", is_flag=True, help="Descargar con Chromium (Playwright) en vez de HTTP.")
@click.option("--visible", is_flag=True, help="Con --navegador, mostrar la ventana.")
@click.option("--sin-verificar", is_flag=True, help="No re-verificar localmente los filtros numéricos.")
@_comun_salida
def buscar(url_busqueda, paginas, navegador, visible, sin_verificar,
           salida, nombre, titulo, nota, artefacto, **kw) -> None:
    """Descarga los resultados, extrae los avisos y genera el informe."""
    filtros = None if url_busqueda else _filtros(kw)
    uf = _uf()
    try:
        with ClientePortal(navegador=navegador, visible=visible) as cliente:
            click.echo("Sesión: " + ("con cookies de sesión" if cliente.con_sesion else "anónima"))
            res = buscar_avisos(cliente, filtros=filtros, url=url_busqueda, max_paginas=paginas,
                                valor_uf=uf[0] if uf else None, progreso=click.echo)
    except BarreraLogin as exc:
        raise click.ClickException(str(exc)) from exc
    except (requests.RequestException, RuntimeError) as exc:  # red o Playwright ausente
        raise click.ClickException(f"No se pudo completar la búsqueda: {exc}") from exc

    avisos, descartados = res.avisos, 0
    if filtros is not None and not sin_verificar:
        avisos, descartados = analisis.filtrar(avisos, filtros, uf[0] if uf else None)
    datos = reporte.armar_datos(
        avisos, titulo=titulo or res.titulo or "Búsqueda en Portal Inmobiliario",
        url=res.url, paginas=res.paginas, fecha_datos=datetime.now(),
        total_sitio=res.total_sitio, filtros_sitio=res.filtros_sitio,
        filtros_pedidos=filtros.describir() if filtros else [], uf=uf, aviso=nota,
        advertencias=res.advertencias, descartados=descartados,
    )
    _mostrar_salida(reporte.guardar(datos, salida, nombre, artefacto), datos)


@cli.command("desde-html")
@click.argument("archivos", nargs=-1, required=True, type=click.Path(exists=True, path_type=Path))
@click.option("--url", "url_origen", default="", help="URL de la búsqueda de la que vienen las páginas.")
@click.option("--fecha-datos", help="Fecha de las páginas (AAAA-MM-DD); por defecto, hoy.")
@_comun_salida
def desde_html(archivos, url_origen, fecha_datos, salida, nombre, titulo, nota, artefacto) -> None:
    """Genera el informe desde páginas guardadas con el navegador (Ctrl+S)."""
    fecha = datetime.fromisoformat(fecha_datos) if fecha_datos else datetime.now()
    avisos, vistos = [], set()
    primera = None
    for archivo in archivos:
        pagina = parsear_pagina(archivo.read_text(encoding="utf-8", errors="replace"))
        if pagina.bloqueada:
            raise click.ClickException(f"{archivo} es la página de inicio de sesión, no resultados.")
        primera = primera or pagina
        for aviso in pagina.avisos:
            if aviso.id not in vistos:
                vistos.add(aviso.id)
                aviso.posicion = len(avisos) + 1
                avisos.append(aviso)
        click.echo(f"{archivo.name}: {len(pagina.avisos)} avisos")
    uf = _uf(fecha.date() if fecha_datos else None)
    datos = reporte.armar_datos(
        avisos, titulo=titulo or primera.titulo or "Búsqueda en Portal Inmobiliario",
        url=url_origen or primera.canonical or "", paginas=[str(a.name) for a in archivos],
        fecha_datos=fecha, total_sitio=primera.total, filtros_sitio=primera.filtros_sitio,
        uf=uf, aviso=nota,
    )
    _mostrar_salida(reporte.guardar(datos, salida, nombre, artefacto), datos)


@cli.command()
@click.option("--navegador", is_flag=True, help="Probar también con Chromium (Playwright).")
def diagnostico(navegador) -> None:
    """Comprueba si este equipo puede leer resultados del sitio."""
    prueba = Filtros(operacion="venta", tipo="departamento", comuna="Providencia").url()
    with ClientePortal(navegador=navegador, pausa=0) as cliente:
        click.echo(f"Probando {prueba}\nSesión: {'con cookies' if cliente.con_sesion else 'anónima'}")
        try:
            html, final = cliente.obtener(prueba)
        except BarreraLogin:
            raise click.ClickException(
                "El sitio pidió iniciar sesión (barrera anti-bots). Opciones: ejecutar desde una "
                "conexión de hogar/oficina, `python pi.py login`, o definir PI_COOKIES."
            )
        except Exception as exc:  # red, DNS, proxy…
            raise click.ClickException(f"No se pudo conectar: {exc}")
    pagina = parsear_pagina(html, final)
    click.echo(f"✅ Acceso OK: {len(pagina.avisos)} avisos en la primera página "
               f"de {pagina.total or '?'} resultados ({pagina.titulo}).")


@cli.command()
@click.option("--destino", type=click.Path(path_type=Path), default=settings.sesion, show_default=True)
def login(destino) -> None:
    """Abre un navegador para iniciar sesión una vez y guarda la sesión."""
    iniciar_sesion(destino)
    click.echo(f"✅ Sesión guardada en {destino}. `buscar` la usará automáticamente.")


@cli.command("exportar-sesion")
@click.option("--sesion", type=click.Path(exists=True, path_type=Path), default=settings.sesion)
def exportar_sesion(sesion) -> None:
    """Imprime la sesión guardada en formato PI_COOKIES (para un secreto de entorno)."""
    datos = json.loads(sesion.read_text(encoding="utf-8"))
    cookies = [c for c in datos.get("cookies", [])
               if any(d in c.get("domain", "") for d in ("portalinmobiliario", "mercadolibre"))]
    click.echo("; ".join(f"{c['name']}={c['value']}" for c in cookies))
    click.echo("\n⚠️  Esto da acceso a tu cuenta: guárdalo solo como secreto, nunca en el repo ni en un chat.",
               err=True)


if __name__ == "__main__":
    cli()
