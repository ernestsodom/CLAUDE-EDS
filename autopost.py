"""
Bot autónomo de Instagram — publica automáticamente en horarios programados.

Uso:
    python autopost.py                  # corre con horarios del .env
    python autopost.py --ahora          # publica un post inmediatamente (prueba)
    python autopost.py --tema "texto"   # publica sobre un tema específico ahora
"""

import time
import random
import argparse
import schedule
from datetime import datetime
from dotenv import load_dotenv
from rich.console import Console

load_dotenv()

console = Console()

# ── Temas predefinidos para publicación automática ────────────────────────────
# El bot elige uno diferente cada vez. Edita esta lista a tu gusto.
TEMAS_DEPORTES = [
    "los mejores goles de la historia del fútbol latinoamericano",
    "momentos históricos de la selección chilena",
    "los grandes delanteros del fútbol sudamericano de los 90s",
    "jugadas mágicas que cambiaron partidos históricos",
    "los arqueros más legendarios del fútbol chileno",
    "rivalidades históricas del fútbol chileno",
    "los mejores mediocampistas que dio Chile al mundo",
    "goles que hicieron llorar a todo un país",
    "historias de superación en el fútbol latinoamericano",
    "los técnicos que marcaron una época en el fútbol chileno",
    "curiosidades y datos increíbles del fútbol mundial",
    "los mundiales más emocionantes de la historia",
    "jugadores chilenos que brillaron en Europa",
    "el mejor fútbol de la Copa Libertadores en los 90s",
    "momentos inolvidables de Colo-Colo en torneos internacionales",
]

# Imágenes de fútbol que funcionan con Instagram/Zapier
IMAGENES_FUTBOL = [
    "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1080&q=80&fm=jpg",
    "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=1080&q=80&fm=jpg",
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1080&q=80&fm=jpg",
    "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=1080&q=80&fm=jpg",
    "https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=1080&q=80&fm=jpg",
]


def publicar_post(tema: str = "") -> bool:
    """Genera caption con IA y publica via Zapier."""
    from instagram_bot.config import load_config
    from instagram_bot.content_generator import ContentGenerator
    from instagram_bot.zapier_publisher import ZapierPublisher
    import os

    cfg = load_config()

    # Elegir tema
    if not tema:
        tema = random.choice(TEMAS_DEPORTES)

    console.print(f"\n[bold cyan]{datetime.now().strftime('%H:%M:%S')}[/bold cyan] Publicando sobre: [yellow]{tema}[/yellow]")

    # Generar caption con IA
    console.print("[dim]Generando caption con IA...[/dim]")
    generator = ContentGenerator(
        cfg.anthropic_api_key,
        cfg.brand_name,
        cfg.brand_niche,
        cfg.brand_voice,
    )
    result = generator.generate_caption(tema)
    caption = result["full_post"]

    # Elegir imagen aleatoria
    image_url = random.choice(IMAGENES_FUTBOL)

    # Publicar via Zapier webhook
    zapier_url = os.getenv("ZAPIER_WEBHOOK_URL", "")
    if not zapier_url:
        console.print("[red]Falta ZAPIER_WEBHOOK_URL en tu .env[/red]")
        return False

    publisher = ZapierPublisher(zapier_url)
    console.print("[dim]Publicando en Instagram via Zapier...[/dim]")
    res = publisher.publish_photo(image_url, caption)

    if res.success:
        console.print(f"[bold green]✓ Publicado![/bold green] (ID: {res.post_id})")
        return True
    else:
        console.print(f"[bold red]✗ Error:[/bold red] {res.error}")
        return False


def iniciar_scheduler():
    """Inicia el scheduler con los horarios configurados."""
    import os

    # Leer horarios del .env (formato: "09:00,18:00")
    horarios_raw = os.getenv("POST_SCHEDULE", "09:00,18:00")
    horarios = [h.strip() for h in horarios_raw.split(",")]

    console.print(f"\n[bold green]Bot autónomo iniciado[/bold green]")
    console.print(f"Cuenta: [cyan]{os.getenv('BRAND_NAME', 'Mi Marca')}[/cyan]")
    console.print(f"Publicaciones programadas: [yellow]{', '.join(horarios)}[/yellow]")
    console.print("Presiona [bold]Ctrl+C[/bold] para detener.\n")

    for horario in horarios:
        schedule.every().day.at(horario).do(publicar_post)
        console.print(f"  [dim]✓ Programado para las {horario} cada día[/dim]")

    console.print()

    try:
        while True:
            schedule.run_pending()
            time.sleep(30)
    except KeyboardInterrupt:
        console.print("\n[yellow]Bot detenido.[/yellow]")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bot autónomo de Instagram")
    parser.add_argument("--ahora",  action="store_true", help="Publica un post inmediatamente")
    parser.add_argument("--tema",   type=str, default="",  help="Tema específico para publicar")
    args = parser.parse_args()

    if args.ahora or args.tema:
        publicar_post(tema=args.tema)
    else:
        iniciar_scheduler()
