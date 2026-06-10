"""Click-based CLI with Rich output."""

import json
import sys
from datetime import datetime

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box

console = Console()


def _get_deps():
    """Lazy-load heavy dependencies to keep CLI startup fast."""
    from .config import load_config
    from .instagram_api import InstagramAPI
    from .content_generator import ContentGenerator
    from .scheduler import PostQueue, PostScheduler
    from .growth_strategies import get_hashtags, get_best_times, all_niches

    cfg = load_config()
    api = InstagramAPI(cfg.instagram_access_token, cfg.instagram_business_account_id)
    generator = ContentGenerator(
        cfg.anthropic_api_key, cfg.brand_name, cfg.brand_niche, cfg.brand_voice
    )
    queue = PostQueue()
    scheduler = PostScheduler(api, queue)

    return cfg, api, generator, queue, scheduler


@click.group()
def cli():
    """Instagram automation bot — powered by Claude AI."""
    pass


@cli.command()
@click.argument("image_url")
@click.option("--caption", "-c", default="", help="Custom caption (skips AI generation)")
@click.option("--topic", "-t", default="", help="Topic for AI-generated caption")
@click.option("--no-hashtags", is_flag=True, help="Skip hashtags")
def post(image_url, caption, topic, no_hashtags):
    """Publish a photo immediately."""
    cfg, api, generator, *_ = _get_deps()

    if not caption:
        if not topic:
            topic = click.prompt("Describe el tema del post")
        console.print("[cyan]Generando caption con IA...[/cyan]")
        result = generator.generate_caption(
            topic, include_hashtags=not no_hashtags
        )
        caption = result["full_post"]
        console.print(Panel(result["caption"], title="Caption generado", border_style="green"))

    console.print("[cyan]Publicando en Instagram...[/cyan]")
    result = api.publish_photo(image_url, caption)

    if result.success:
        console.print(f"[bold green]✓ Post publicado![/bold green] {result.permalink or result.post_id}")
    else:
        console.print(f"[bold red]✗ Error:[/bold red] {result.error}")
        sys.exit(1)


@cli.command()
@click.argument("image_url")
@click.option("--topic", "-t", default="", help="Topic for AI caption")
@click.option("--at", default="", help="Datetime ISO format: 2025-12-31T15:00")
@click.option("--daily", is_flag=True, help="Schedule as recurring daily post")
@click.option("--hour", default=12, help="Hour for daily post (0-23)")
@click.option("--minute", default=0, help="Minute for daily post (0-59)")
def schedule(image_url, topic, at, daily, hour, minute):
    """Add a post to the scheduled queue."""
    cfg, api, generator, queue, scheduler = _get_deps()

    if not topic:
        topic = click.prompt("Describe el tema del post")

    console.print("[cyan]Generando caption con IA...[/cyan]")
    gen_result = generator.generate_caption(topic)
    caption = gen_result["full_post"]
    console.print(Panel(gen_result["caption"], title="Caption generado", border_style="blue"))

    if daily:
        post_id = scheduler.schedule_daily(image_url, caption, hour=hour, minute=minute)
        console.print(f"[green]✓ Post recurrente programado diariamente a las {hour:02d}:{minute:02d}[/green] (ID: {post_id})")
    elif at:
        run_at = datetime.fromisoformat(at)
        post_id = scheduler.schedule_once(image_url, caption, run_at)
        console.print(f"[green]✓ Post programado para {run_at.strftime('%d/%m/%Y %H:%M')}[/green] (ID: {post_id})")
    else:
        run_at = datetime.fromisoformat(
            click.prompt("Fecha/hora de publicación (YYYY-MM-DDTHH:MM)")
        )
        post_id = scheduler.schedule_once(image_url, caption, run_at)
        console.print(f"[green]✓ Post programado para {run_at.strftime('%d/%m/%Y %H:%M')}[/green] (ID: {post_id})")


@cli.command()
@click.option("--topic", "-t", default="", help="Specific topic for the caption")
@click.option("--type", "post_type", default="photo",
              type=click.Choice(["photo", "carousel", "reel", "story"]),
              help="Post type")
@click.option("--ideas", is_flag=True, help="Generate post ideas instead of a caption")
@click.option("--calendar", default=0, type=int, metavar="DAYS",
              help="Generate a content calendar for N days")
@click.option("--hashtags", is_flag=True, help="Generate a custom hashtag strategy")
def generate(topic, post_type, ideas, calendar, hashtags):
    """Generate AI-powered content (captions, ideas, calendar, hashtags)."""
    cfg, _, generator, *_ = _get_deps()

    if ideas:
        console.print("[cyan]Generando ideas de contenido...[/cyan]")
        idea_list = generator.suggest_post_ideas(count=10)
        console.print(Panel(
            "\n".join(f"• {idea}" for idea in idea_list),
            title=f"Ideas para {cfg.brand_niche}",
            border_style="magenta",
        ))
        return

    if calendar > 0:
        console.print(f"[cyan]Generando calendario de {calendar} días...[/cyan]")
        entries = generator.generate_content_calendar(days=calendar, posts_per_day=cfg.default_post_frequency)
        table = Table("Entrada", "Contenido", box=box.ROUNDED, show_lines=True)
        for entry in entries[:calendar * cfg.default_post_frequency]:
            table.add_row(str(entry["day"]), entry["content"])
        console.print(table)
        return

    if hashtags:
        topic_input = topic or click.prompt("Tema del post (opcional, Enter para omitir)", default="")
        console.print("[cyan]Generando estrategia de hashtags...[/cyan]")
        strategy = generator.generate_hashtag_strategy(topic_input)
        if isinstance(strategy, dict):
            for tier, tags in strategy.items():
                console.print(f"\n[bold]{tier.upper()}:[/bold]")
                console.print("  " + "  ".join(tags))
        else:
            console.print(" ".join(strategy))
        return

    if not topic:
        topic = click.prompt("¿Sobre qué trata el post?")

    console.print("[cyan]Generando caption...[/cyan]")
    result = generator.generate_caption(topic, post_type=post_type)

    console.print(Panel(result["caption"], title="Caption", border_style="green"))
    console.print(f"\n[dim]Hashtags:[/dim] {result['hashtags'][:100]}...")
    console.print(f"\n[dim]Tokens usados: {result['tokens_used']}[/dim]")

    if click.confirm("\n¿Copiar el post completo al portapapeles?", default=False):
        try:
            import subprocess
            subprocess.run(["xclip", "-selection", "clipboard"], input=result["full_post"].encode(), check=True)
            console.print("[green]✓ Copiado al portapapeles[/green]")
        except Exception:
            console.print("[yellow]No se pudo copiar. Post completo:[/yellow]")
            console.print(result["full_post"])


@cli.command()
def status():
    """Show the post queue and scheduler status."""
    _, _, _, queue, _ = _get_deps()

    posts = queue.list_all()
    if not posts:
        console.print("[yellow]La cola de posts está vacía.[/yellow]")
        return

    table = Table("ID", "Estado", "Tipo", "Programado", "Resultado", box=box.ROUNDED)
    status_colors = {"pending": "yellow", "published": "green", "failed": "red"}

    for p in posts[-20:]:
        color = status_colors.get(p["status"], "white")
        result = ""
        if p.get("result", {}).get("permalink"):
            result = p["result"]["permalink"]
        elif p.get("error"):
            result = p["error"][:40]

        table.add_row(
            p["id"],
            f"[{color}]{p['status']}[/{color}]",
            p.get("type", "photo"),
            p.get("scheduled_at", "")[:16].replace("T", " "),
            result,
        )
    console.print(table)


@cli.command()
@click.option("--days", default=7, help="Number of days of data")
def insights(days):
    """Fetch and display account insights."""
    _, api, *_ = _get_deps()

    console.print("[cyan]Obteniendo insights de la cuenta...[/cyan]")

    account_data = api.get_account_insights()
    recent_posts = api.get_recent_posts(limit=5)

    if "error" not in account_data:
        data = account_data.get("data", [])
        table = Table("Métrica", "Valor", box=box.SIMPLE_HEAD)
        for metric in data:
            val = metric.get("values", [{}])[-1].get("value", "N/A")
            table.add_row(metric.get("name", ""), str(val))
        console.print(Panel(table, title="Métricas de cuenta"))
    else:
        console.print(f"[red]Error en insights: {account_data['error']}[/red]")

    if recent_posts:
        table = Table("ID", "Tipo", "Likes", "Comentarios", "Fecha", box=box.SIMPLE_HEAD)
        for p in recent_posts:
            table.add_row(
                p.get("id", "")[-8:],
                p.get("media_type", ""),
                str(p.get("like_count", 0)),
                str(p.get("comments_count", 0)),
                p.get("timestamp", "")[:10],
            )
        console.print(Panel(table, title="Posts recientes"))


@cli.command("post-reel")
@click.argument("video_path")
@click.option("--caption", "-c", default="", help="Caption personalizado (omite para generar con IA)")
@click.option("--topic", "-t", default="", help="Tema para generar caption con IA")
def post_reel(video_path, caption, topic):
    """Sube un video local a Cloudinary y lo publica como Reel en Instagram.

    VIDEO_PATH puede ser una ruta local (.mp4) o una URL pública ya alojada.
    """
    from .video_uploader import CloudinaryUploader

    cfg, api, generator, *_ = _get_deps()

    # Resolver URL pública del video
    if video_path.startswith("http://") or video_path.startswith("https://"):
        public_url = video_path
        console.print(f"[dim]Usando URL existente: {public_url}[/dim]")
    else:
        uploader = CloudinaryUploader()
        if not uploader.is_configured():
            console.print("[bold red]✗ Cloudinary no configurado.[/bold red]")
            console.print(
                "\nAgrega estas 3 líneas a tu [bold].env[/bold]:\n"
                "  [cyan]CLOUDINARY_CLOUD_NAME[/cyan]=tu_cloud_name\n"
                "  [cyan]CLOUDINARY_API_KEY[/cyan]=tu_api_key\n"
                "  [cyan]CLOUDINARY_API_SECRET[/cyan]=tu_api_secret\n"
                "\nCómo obtenerlas (es gratis):\n"
                "  1. Ve a [link=https://cloudinary.com]https://cloudinary.com[/link] → Sign Up Free\n"
                "  2. En el Dashboard copia Cloud Name, API Key y API Secret\n"
                "  3. Pégalos en el .env y vuelve a ejecutar este comando"
            )
            sys.exit(1)

        console.print(f"[cyan]Subiendo video a Cloudinary...[/cyan] {video_path}")
        try:
            public_url = uploader.upload(video_path, resource_type="video")
        except Exception as exc:
            console.print(f"[bold red]✗ Error subiendo video:[/bold red] {exc}")
            sys.exit(1)
        console.print(f"[green]✓ Video alojado:[/green] {public_url}")

    # Generar caption si no se proporcionó
    if not caption:
        if not topic:
            topic = click.prompt("Describe el tema del reel (para generar caption con IA)")
        console.print("[cyan]Generando caption con IA...[/cyan]")
        result = generator.generate_caption(topic, post_type="reel")
        caption = result["full_post"]
        console.print(Panel(result["caption"], title="Caption generado", border_style="green"))
        if not click.confirm("¿Publicar con este caption?", default=True):
            caption = click.edit(caption) or caption

    # Publicar
    console.print("[cyan]Publicando Reel en Instagram...[/cyan]")
    result = api.publish_reel(public_url, caption)

    if result.success:
        console.print(f"[bold green]✓ Reel publicado![/bold green]")
        if result.permalink:
            console.print(f"  [link={result.permalink}]{result.permalink}[/link]")
    else:
        console.print(f"[bold red]✗ Error:[/bold red] {result.error}")
        sys.exit(1)


@cli.command()
def run_scheduler():
    """Start the scheduler daemon — processes the queue every 15 minutes."""
    import time
    _, api, _, queue, scheduler = _get_deps()

    console.print("[bold green]Iniciando scheduler...[/bold green]")
    console.print("Presiona Ctrl+C para detener.\n")
    scheduler.start(check_interval_minutes=15)

    try:
        while True:
            pending = len([p for p in queue.list_all() if p["status"] == "pending"])
            console.print(f"[dim]{datetime.now().strftime('%H:%M:%S')} — {pending} posts pendientes[/dim]")
            time.sleep(60)
    except KeyboardInterrupt:
        scheduler.stop()
        console.print("\n[yellow]Scheduler detenido.[/yellow]")


@cli.command()
@click.option("--niche", default="", help="Niche to check")
def strategy(niche):
    """Show growth strategy: best posting times and hashtag tips."""
    from .growth_strategies import get_best_times, get_hashtags, all_niches, get_cta
    cfg, *_ = _get_deps()

    target_niche = niche or cfg.brand_niche

    # Best times
    times = get_best_times(target_niche)
    table = Table("Día", "Hora óptima", box=box.ROUNDED)
    for t in times:
        table.add_row(t["day"], f"{t['hour']:02d}:00")
    console.print(Panel(table, title=f"Mejores horarios — {target_niche}"))

    # Sample hashtags
    tags = get_hashtags(target_niche, count=30)
    console.print(Panel(
        " ".join(tags),
        title="Hashtags recomendados (30 principales)",
        border_style="blue",
    ))

    # CTA examples
    console.print("\n[bold]Ejemplos de CTAs:[/bold]")
    for _ in range(3):
        console.print(f"  • {get_cta()}")


@cli.command()
@click.option("--topic", "-t", default="", help="Tema del post")
@click.option("--query", "-q", default="", help="Palabras para buscar la imagen (por defecto usa el tema)")
@click.option("--count", default=5, help="Cuántas imágenes mostrar para elegir")
def preparar(topic, query, count):
    """Genera caption con IA Y busca/descarga una imagen automáticamente. Listo para publicar."""
    from .image_finder import ImageFinder
    cfg, _, generator, *_ = _get_deps()

    if not topic:
        topic = click.prompt("¿Sobre qué trata el post?")

    # 1) Buscar imágenes
    finder = ImageFinder()
    if not finder.is_configured():
        console.print("[red]Falta UNSPLASH_ACCESS_KEY en tu .env.[/red]")
        console.print("Consíguela gratis en [cyan]https://unsplash.com/developers[/cyan] "
                      "y agrégala como: UNSPLASH_ACCESS_KEY=tu_clave")
        sys.exit(1)

    search_term = query or topic
    console.print(f"[cyan]Buscando imágenes para:[/cyan] {search_term}")
    try:
        images = finder.search(search_term, count=count)
    except Exception as exc:
        console.print(f"[red]Error buscando imágenes: {exc}[/red]")
        sys.exit(1)

    if not images:
        console.print("[yellow]No se encontraron imágenes. Prueba con otras palabras (--query).[/yellow]")
        sys.exit(1)

    # Mostrar opciones
    table = Table("#", "Descripción", "Autor", box=box.ROUNDED)
    for i, img in enumerate(images, 1):
        table.add_row(str(i), (img["description"] or "")[:50], img["author"])
    console.print(table)

    choice = click.prompt(f"Elige una imagen (1-{len(images)})", type=int, default=1)
    selected = images[max(1, min(choice, len(images))) - 1]

    # 2) Descargar imagen
    console.print("[cyan]Descargando imagen...[/cyan]")
    path = finder.download(selected)
    console.print(f"[green]✓ Imagen guardada en:[/green] {path}")
    console.print(f"[dim]Foto por {selected['author']} en Unsplash[/dim]")

    # 3) Generar caption
    console.print("[cyan]Generando caption con IA...[/cyan]")
    result = generator.generate_caption(topic)
    console.print(Panel(result["caption"], title="Caption", border_style="green"))

    # 4) Guardar todo junto en un archivo de texto
    from pathlib import Path
    out_dir = Path("posts_listos")
    out_dir.mkdir(exist_ok=True)
    safe = "".join(c for c in topic[:30] if c.isalnum() or c in " -_").strip().replace(" ", "_") or "post"
    txt_path = out_dir / f"{safe}.txt"
    txt_path.write_text(
        f"TEMA: {topic}\n\nIMAGEN: {path}\nCrédito: Foto por {selected['author']} en Unsplash\n\n"
        f"--- CAPTION ---\n{result['full_post']}\n",
        encoding="utf-8",
    )

    console.print(f"\n[bold green]✓ Post listo![/bold green]")
    console.print(f"  • Imagen: [cyan]{path}[/cyan]")
    console.print(f"  • Texto:  [cyan]{txt_path}[/cyan]")
    console.print("\nAhora súbelo a Instagram (o Metricool): usa esa imagen y pega el caption del .txt.")
