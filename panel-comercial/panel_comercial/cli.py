"""CLI para registrar y consultar negocios sin abrir el navegador."""

from __future__ import annotations

import click

from . import analytics, export, storage
from .config import ETAPAS
from .models import Negocio


@click.group()
def cli() -> None:
    """Herramienta de línea de comandos del panel comercial."""


@cli.command()
@click.option("--cliente", required=True, help="Nombre del cliente o empresa.")
@click.option("--negocio", default="", help="Título breve del negocio/oportunidad.")
@click.option("--contacto", default="", help="Persona de contacto.")
@click.option("--email", default="", help="Email de contacto.")
@click.option("--telefono", default="", help="Teléfono de contacto.")
@click.option("--valor", default=0.0, type=float, help="Valor estimado del negocio.")
@click.option("--moneda", default="CLP", help="CLP / USD / UF.")
@click.option("--etapa", default="Nuevo", type=click.Choice(ETAPAS), help="Etapa del pipeline.")
@click.option("--fuente", default="", help="De dónde vino el lead (referido, web, etc.).")
@click.option("--notas", default="", help="Notas libres.")
def agregar(cliente, negocio, contacto, email, telefono, valor, moneda, etapa, fuente, notas) -> None:
    """Registra un nuevo negocio/lead."""
    n = Negocio(
        cliente=cliente, negocio=negocio, contacto=contacto, email=email,
        telefono=telefono, valor_estimado=valor, moneda=moneda, etapa=etapa,
        fuente=fuente, notas=notas,
    )
    storage.guardar_negocio(n)
    click.echo(f"✅ Negocio registrado: {n.id}")


@cli.command()
@click.argument("negocio_id")
@click.option("--etapa", required=True, type=click.Choice(ETAPAS), help="Nueva etapa.")
def mover(negocio_id, etapa) -> None:
    """Cambia la etapa de un negocio existente."""
    d = storage.obtener_negocio(negocio_id)
    if not d:
        click.echo(f"❌ No existe el negocio {negocio_id}")
        return
    n = Negocio.from_dict(d)
    n.etapa = etapa
    storage.guardar_negocio(n)
    click.echo(f"✅ {negocio_id} → {etapa}")


@cli.command()
def listar() -> None:
    """Lista todos los negocios registrados."""
    df = analytics.a_dataframe(storage.cargar_negocios())
    if df.empty:
        click.echo("Sin negocios registrados todavía.")
        return
    for _, fila in df.iterrows():
        click.echo(
            f"[{fila['etapa']:<18}] {fila['cliente']} — {fila['negocio'] or '(sin título)'} "
            f"· {fila['moneda']} {fila['valor_estimado']:,.0f} · id={fila['id']}"
        )


@cli.command()
@click.option("--salida", default="negocios.xlsx", help="Archivo de salida (.csv/.xlsx).")
def exportar(salida) -> None:
    """Exporta todos los negocios a CSV o Excel."""
    df = analytics.a_dataframe(storage.cargar_negocios())
    data = export.a_csv(df) if salida.endswith(".csv") else export.a_excel(df)
    with open(salida, "wb") as f:
        f.write(data)
    click.echo(f"Exportados {len(df)} negocios a {salida}")


@cli.command()
def estado() -> None:
    """Muestra cuántos negocios hay registrados."""
    click.echo(f"Negocios registrados: {storage.contar_negocios()}")


if __name__ == "__main__":
    cli()
