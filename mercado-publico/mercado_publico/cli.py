"""CLI para sincronizar y exportar licitaciones sin abrir el navegador."""

from __future__ import annotations

from datetime import date, datetime, timedelta

import click

from . import analytics, export, storage
from .service import sincronizar_licitaciones, verificar_ticket


def _parse(d: str) -> date:
    return datetime.strptime(d, "%Y-%m-%d").date()


@click.group()
def cli() -> None:
    """Herramienta de línea de comandos para licitaciones de Mercado Público."""


@cli.command()
@click.option("--ticket", help="Ticket de la API de Mercado Público.")
def verificar(ticket: str | None) -> None:
    """Comprueba que tu ticket funciona."""
    from .config import settings

    ok, msg = verificar_ticket(ticket or settings.ticket)
    click.echo(("✅ " if ok else "❌ ") + msg)


@cli.command()
@click.option("--desde", help="Fecha inicio YYYY-MM-DD (por defecto: hace 7 días).")
@click.option("--hasta", help="Fecha fin YYYY-MM-DD (por defecto: hoy).")
@click.option("--estado", help="Estado: " + "activas/desierta/adjudicada/…")
@click.option("--sin-detalle", is_flag=True, help="Carga rápida: sólo resumen.")
@click.option("--limite", default=600, help="Máx. detalles a descargar.")
@click.option("--workers", default=8, help="Descargas de detalle en paralelo.")
@click.option("--rehacer", is_flag=True, help="No saltar las ya cacheadas.")
@click.option("--ticket", help="Ticket de la API.")
def sincronizar(desde, hasta, estado, sin_detalle, limite, workers, rehacer, ticket) -> None:
    """Descarga licitaciones y las guarda en el caché local."""
    d = _parse(desde) if desde else date.today() - timedelta(days=7)
    h = _parse(hasta) if hasta else date.today()

    def cb(p: float, txt: str) -> None:
        click.echo(f"[{p*100:5.1f}%] {txt}")

    res = sincronizar_licitaciones(
        desde=d, hasta=h, estado=estado,
        enriquecer=not sin_detalle, limite_detalle=limite,
        workers=workers, saltar_cacheadas=not rehacer,
        progreso=cb, ticket=ticket,
    )
    click.echo(
        f"\nEncontradas: {res['encontradas']} · "
        f"Detalles: {res['detalles_descargados']} · "
        f"Saltadas: {res.get('omitidas_cache', 0)} · "
        f"Caché total: {res['total_en_cache']}"
    )


@cli.command()
@click.option("--rubro", multiple=True, help="Segmento(s) de rubro (ej: 42 85).")
@click.option("--estado", multiple=True, help="Estado(s) a incluir.")
@click.option("--salida", default="licitaciones.xlsx", help="Archivo de salida (.csv/.xlsx).")
def exportar(rubro, estado, salida) -> None:
    """Exporta el caché filtrado a CSV o Excel."""
    df = analytics.a_dataframe(storage.cargar_licitaciones())
    df = analytics.filtrar(
        df, rubros=list(rubro) or None, estados=list(estado) or None
    )
    if salida.endswith(".csv"):
        data = export.a_csv(df)
    else:
        data = export.a_excel(df)
    with open(salida, "wb") as f:
        f.write(data)
    click.echo(f"Exportadas {len(df)} licitaciones a {salida}")


@cli.command()
def estado() -> None:
    """Muestra cuántas licitaciones hay en el caché."""
    click.echo(f"Licitaciones en caché: {storage.contar()}")


if __name__ == "__main__":
    cli()
