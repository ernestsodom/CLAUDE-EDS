"""CLI del motor de prospección Xperticket."""

from __future__ import annotations

import click

from . import analytics, discovery, export, pipeline, report, storage
from .config import settings


@click.group()
def cli() -> None:
    """Motor de inteligencia y prospección comercial para Xperticket."""


# --------------------------------------------------------------------------- #
# Módulo 1 — Discovery
# --------------------------------------------------------------------------- #
@cli.command()
def sembrar() -> None:
    """Carga el dataset semilla de instituciones culturales de Chile."""
    n = discovery.sembrar()
    click.echo(f"✅ {n} prospectos semilla cargados (total: {storage.contar_prospectos()}).")


@cli.command()
@click.argument("path")
def importar(path: str) -> None:
    """Importa tu lista de prospectos desde un CSV o JSON."""
    if path.lower().endswith(".json"):
        n = discovery.importar_json(path)
    else:
        n = discovery.importar_csv(path)
    click.echo(f"✅ {n} prospectos importados (total: {storage.contar_prospectos()}).")


@cli.command()
@click.option("--salida", default="plantilla_prospectos.csv", help="Archivo de salida.")
def plantilla(salida: str) -> None:
    """Genera una plantilla CSV para cargar tu propia lista."""
    with open(salida, "w", encoding="utf-8-sig", newline="") as f:
        f.write(discovery.plantilla_csv())
    click.echo(f"✅ Plantilla escrita en {salida}")


@cli.command()
def validar() -> None:
    """Marca prospectos como prospectable / incompleto según su contacto."""
    conteo = discovery.validar()
    click.echo(f"Prospectable: {conteo['prospectable']} · Incompleto: {conteo['incompleto']}")


@cli.command()
@click.option("--tipo", help="Filtrar por tipo de cliente.")
@click.option("--region", help="Filtrar por región.")
@click.option("--estado", help="prospectable / incompleto.")
def listar(tipo, region, estado) -> None:
    """Lista los prospectos en la base."""
    prospectos = discovery.listar(tipo=tipo, region=region, estado=estado)
    for p in prospectos:
        marca = "●" if p.estado_prospectable == "prospectable" else "○"
        tk = f" [{p.ticketera_identificada}]" if p.ticketera_identificada else ""
        click.echo(f"{marca} {p.nombre_institucion} · {p.tipo} · {p.region}{tk}")
    click.echo(f"\nTotal: {len(prospectos)}")


# --------------------------------------------------------------------------- #
# Módulos 2-5 — Análisis
# --------------------------------------------------------------------------- #
@cli.command()
@click.option("--id", "prospecto_id", help="Analizar un solo prospecto por id.")
@click.option("--todos", is_flag=True, help="Analizar todos los prospectos (batch).")
@click.option("--comision", type=float, help="Comisión Xperticket a proponer (%).")
@click.option("--claude", is_flag=True, help="Usar Claude para la narrativa (requiere API key).")
@click.option("--forzar", is_flag=True, help="Re-analizar aunque haya análisis reciente.")
@click.option("--limite", type=int, help="Máx. prospectos a procesar (batch).")
def analizar(prospecto_id, todos, comision, claude, forzar, limite) -> None:
    """Ejecuta el análisis (módulos 2-5) de uno o todos los prospectos."""
    if claude and not settings.claude_disponible:
        click.echo("⚠ Sin ANTHROPIC_API_KEY: se usará la narrativa de plantilla.")

    if prospecto_id:
        p = storage.obtener_prospecto(prospecto_id)
        if not p:
            raise click.ClickException(f"No existe el prospecto '{prospecto_id}'.")
        payload = pipeline.analizar_prospecto(
            p, comision_xperticket_pct=comision, usar_claude=claude
        )
        pipeline.reprioritizar()
        _imprimir_ficha(payload)
        return

    if not todos:
        raise click.UsageError("Usa --id ID o --todos.")

    def cb(pr: float, txt: str) -> None:
        click.echo(f"[{pr*100:5.1f}%] {txt}")

    res = pipeline.analizar_todos(
        comision_xperticket_pct=comision, usar_claude=claude,
        forzar=forzar, limite=limite, progreso=cb,
    )
    click.echo(
        f"\n✅ Analizados: {res['analizados']} · "
        f"Saltados (frescos): {res['saltados_por_frescura']} · "
        f"Total con análisis: {res['total_con_analisis']}"
    )


@cli.command()
@click.argument("prospecto_id")
def ficha(prospecto_id: str) -> None:
    """Muestra el análisis completo de un prospecto."""
    payload = storage.obtener_analisis(prospecto_id)
    if not payload:
        raise click.ClickException(
            f"No hay análisis para '{prospecto_id}'. Corre: xperti analizar --id {prospecto_id}"
        )
    _imprimir_ficha(payload)


@cli.command()
@click.option("--top", default=30, help="Cuántos prospectos mostrar.")
def ranking(top: int) -> None:
    """Ranking de prospectos por score (Top N)."""
    df = analytics.analisis_df(storage.cargar_analisis())
    if df.empty:
        click.echo("No hay análisis aún. Corre: xperti analizar --todos")
        return
    cols = ["prioridad", "score", "prospecto", "tipo", "ticketera", "ahorro_uf_anual", "roi_usd_anual"]
    click.echo(df[cols].head(top).to_string(index=False))


@cli.command()
@click.option("--que", type=click.Choice(["prospectos", "analisis", "propuestas"]), default="analisis")
@click.option("--salida", default="export.csv", help="Archivo (.csv/.xlsx/.json).")
def exportar(que, salida) -> None:
    """Exporta prospectos / análisis / propuestas a CSV, Excel o JSON."""
    if que == "prospectos":
        df = analytics.prospectos_df(storage.cargar_prospectos())
        data = _serializar(df, salida)
    elif que == "propuestas":
        payloads = storage.cargar_analisis()
        if salida.endswith(".json"):
            data = export.a_json(payloads)
        else:
            filas = [
                {
                    "prospecto": a.get("prospecto"),
                    "tipo": a.get("tipo"),
                    "score": a.get("contacto", {}).get("score"),
                    "narrativa_email": a.get("propuesta", {}).get("narrativa_email"),
                }
                for a in payloads
            ]
            import pandas as pd

            df = pd.DataFrame(filas)
            data = _serializar(df, salida)
    else:  # analisis
        payloads = storage.cargar_analisis()
        if salida.endswith(".json"):
            data = export.a_json(payloads)
        else:
            df = analytics.analisis_df(payloads)
            data = _serializar(df, salida)

    export.guardar(data, salida)
    click.echo(f"✅ Exportado ({que}) a {salida}")


@cli.command()
@click.option("--salida", default="xperticket_reporte.html", help="Archivo HTML de salida.")
def reporte(salida: str) -> None:
    """Genera un reporte web autocontenido (HTML) para abrir con doble clic."""
    if storage.contar_analisis() == 0:
        raise click.ClickException("No hay análisis. Corre primero: xperti analizar --todos")
    n = report.guardar_html(salida)
    click.echo(f"✅ Reporte con {n} prospectos escrito en {salida}")
    click.echo("   Ábrelo con doble clic en tu navegador (no requiere internet).")


@cli.command()
def estado() -> None:
    """Muestra el estado de la base (prospectos y análisis)."""
    click.echo(f"Prospectos: {storage.contar_prospectos()}")
    click.echo(f"Con análisis: {storage.contar_analisis()}")
    click.echo(f"Claude disponible: {'sí' if settings.claude_disponible else 'no'}")
    click.echo(f"1 UF ≈ US$ {settings.uf_to_usd:.1f}")


# --------------------------------------------------------------------------- #
# Helpers de presentación
# --------------------------------------------------------------------------- #
def _serializar(df, salida: str) -> bytes:
    if salida.endswith(".xlsx"):
        return export.a_excel(df)
    return export.a_csv(df)


def _imprimir_ficha(payload: dict) -> None:
    web = payload.get("web_intel", {})
    fin = payload.get("finanzas", {})
    prop = payload.get("propuesta", {})
    con = payload.get("contacto", {})

    click.echo("\n" + "=" * 70)
    click.echo(f"  {payload.get('prospecto')}  ·  {payload.get('tipo')}  ·  {payload.get('region')}")
    click.echo("=" * 70)
    click.echo(f"Score: {con.get('score')}  (prioridad: {con.get('prioridad')})")
    click.echo(f"Ticketera: {web.get('ticketera_actual')}  ·  Fuente datos: {web.get('fuente_datos')}")
    click.echo(f"Volumen anual: {fin.get('volumen_estimado_anual')} entradas")
    click.echo(
        f"Comisión actual: {fin.get('comision_actual_pct')}% → Xperticket "
        f"{fin.get('comision_xperticket_pct')}%"
    )
    click.echo(
        f"Ahorro: {fin.get('ahorro_comisiones_anual_uf')} UF/año  ·  "
        f"ROI: US$ {fin.get('roi_estimado_anual_usd')}/año  ·  "
        f"Payback: {fin.get('payback_meses')} meses"
    )
    click.echo("\nPain points:")
    for d in web.get("pain_points_detectados", [])[:6]:
        click.echo(f"  - {d}")
    click.echo("\n— Email de contacto —")
    click.echo(prop.get("narrativa_email", ""))


if __name__ == "__main__":
    cli()
