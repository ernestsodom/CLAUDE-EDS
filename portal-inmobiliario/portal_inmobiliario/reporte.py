"""Informe HTML autónomo (más CSV y JSON) a partir de los avisos extraídos."""

from __future__ import annotations

import csv
import html
import json
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path

from .analisis import moneda_de_analisis, precio_en
from .filtros import slug
from .parser import Aviso

PLANTILLA = Path(__file__).with_name("plantilla_informe.html")
MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre")


def _fecha_texto(momento: datetime) -> str:
    texto = f"{momento.day} de {MESES[momento.month - 1]} de {momento.year}"
    if momento.hour or momento.minute:
        texto += f", {momento:%H:%M}"
    return texto


def _fila(aviso: Aviso, moneda: str, valor_uf: float | None) -> dict:
    fila = asdict(aviso)
    fila["es_proyecto"] = aviso.es_proyecto
    precio = precio_en(aviso, moneda, valor_uf)
    unico = aviso.superficie_util_min if (
        aviso.superficie_util_min and aviso.superficie_util_min == aviso.superficie_util_max
    ) else None
    fila["precio_a"] = precio
    fila["m2"] = unico
    fila["precio_m2"] = (precio / unico) if (precio is not None and unico and not aviso.es_proyecto) else None
    return fila


def armar_datos(avisos: list[Aviso], *, titulo: str, url: str, paginas: list[str],
                fecha_datos: datetime, total_sitio: int | None = None,
                filtros_sitio: list[str] | None = None,
                filtros_pedidos: list[str] | None = None,
                uf: tuple[float, date] | None = None, aviso: str | None = None,
                advertencias: list[str] | None = None, descartados: int = 0) -> dict:
    """Estructura que consume la plantilla (y que se guarda como JSON)."""
    moneda = moneda_de_analisis(avisos)
    valor_uf = uf[0] if uf else None
    return {
        "titulo": titulo,
        "url": url,
        "paginas": paginas,
        "fecha_datos": fecha_datos.isoformat(timespec="minutes"),
        "fecha_datos_texto": _fecha_texto(fecha_datos),
        "total_sitio": total_sitio,
        "filtros_sitio": filtros_sitio or [],
        "filtros_pedidos": filtros_pedidos or [],
        "moneda": moneda,
        "valor_uf": valor_uf,
        "fecha_uf": uf[1].isoformat() if uf else None,
        "aviso": aviso,
        "advertencias": advertencias or [],
        "descartados": descartados,
        "avisos": [_fila(a, moneda, valor_uf) for a in avisos],
    }


def generar_html(datos: dict, artefacto: bool = False) -> str:
    """HTML del informe. Con `artefacto=True` omite <html>/<head>/<body> (para publicarlo)."""
    cabeza, cuerpo = PLANTILLA.read_text(encoding="utf-8").split("<!--CUERPO-->", 1)
    incrustado = (
        json.dumps(datos, ensure_ascii=False)
        .replace("</", "<\\/")
        .replace("<!--", "<\\!--")
    )
    cabeza = cabeza.replace("{{TITULO}}", html.escape(datos["titulo"]))
    cuerpo = cuerpo.replace("{{DATOS_JSON}}", incrustado)
    if artefacto:
        return cabeza + cuerpo
    return (
        '<!doctype html>\n<html lang="es-CL">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + cabeza + "</head>\n<body>\n" + cuerpo + "</body>\n</html>\n"
    )


def _csv(datos: dict, ruta: Path) -> None:
    """CSV con ';' y coma decimal (Excel en español) y BOM UTF-8."""
    moneda = datos["moneda"].lower()
    columnas = ["posicion", "id", "titulo", "encabezado", "precio", "moneda", "precio_desde",
                "precio_anterior", f"precio_{moneda}", "superficie_util_min",
                "superficie_util_max", "superficie_total_min", "dormitorios_min",
                "dormitorios_max", "banos_min", "banos_max", f"precio_m2_{moneda}",
                "ubicacion", "publicador", "etiqueta", "url"]

    def celda(v):
        if isinstance(v, bool):
            return "sí" if v else ""
        if isinstance(v, float):
            return f"{v:.2f}".rstrip("0").rstrip(".").replace(".", ",")
        return "" if v is None else v

    with ruta.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(columnas)
        for fila in datos["avisos"]:
            fila = dict(fila, **{f"precio_{moneda}": fila["precio_a"],
                                 f"precio_m2_{moneda}": fila["precio_m2"]})
            w.writerow([celda(fila.get(c)) for c in columnas])


def guardar(datos: dict, carpeta: Path, nombre: str | None = None,
            artefacto: bool = False) -> dict[str, Path]:
    """Escribe informe .html, .csv y .json en `carpeta`. Devuelve las rutas."""
    carpeta.mkdir(parents=True, exist_ok=True)
    base = nombre or f"{slug(datos['titulo'])[:60]}_{datetime.now():%Y%m%d-%H%M}"
    rutas = {
        "html": carpeta / f"{base}.html",
        "csv": carpeta / f"{base}.csv",
        "json": carpeta / f"{base}.json",
    }
    rutas["html"].write_text(generar_html(datos), encoding="utf-8")
    if artefacto:
        rutas["artefacto"] = carpeta / f"{base}.artefacto.html"
        rutas["artefacto"].write_text(generar_html(datos, artefacto=True), encoding="utf-8")
    _csv(datos, rutas["csv"])
    rutas["json"].write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    return rutas
