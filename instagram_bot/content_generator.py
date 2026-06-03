"""AI content generation using Claude with prompt caching."""

import anthropic
from .growth_strategies import get_hashtags, get_cta


class ContentGenerator:
    def __init__(self, api_key: str, brand_name: str, brand_niche: str, brand_voice: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.brand_name = brand_name
        self.brand_niche = brand_niche
        self.brand_voice = brand_voice
        self._system_prompt = self._build_system_prompt()

    def _build_system_prompt(self) -> str:
        return (
            f"Eres el community manager experto de {self.brand_name}, una marca del nicho de {self.brand_niche}. "
            f"Tu estilo de comunicación es {self.brand_voice}. "
            "Escribes en español a menos que se indique lo contrario. "
            "Tus captions de Instagram son auténticos, generan engagement real y conectan emocionalmente con la audiencia. "
            "Nunca uses lenguaje corporativo ni clichés vacíos. "
            "Siempre incluyes un elemento de storytelling o valor real para el lector. "
            "Conoces a fondo las mejores prácticas de Instagram: longitud óptima de captions, uso de emojis estratégico, "
            "estructura (gancho → desarrollo → CTA), y cómo usar los primeros 125 caracteres para captar atención."
        )

    def generate_caption(
        self,
        topic: str,
        post_type: str = "photo",
        include_cta: bool = True,
        include_hashtags: bool = True,
        hashtag_count: int = 25,
    ) -> dict[str, str]:
        """Generate a complete Instagram caption with hashtags."""
        cta = get_cta() if include_cta else ""
        hashtags = " ".join(get_hashtags(self.brand_niche, count=hashtag_count)) if include_hashtags else ""

        prompt = (
            f"Crea un caption de Instagram para un post de tipo '{post_type}' sobre: {topic}.\n\n"
            f"Estructura requerida:\n"
            f"1. Gancho en la primera línea (máx 125 caracteres, sin hashtags)\n"
            f"2. Desarrollo del mensaje (2-4 párrafos con emojis estratégicos)\n"
            f"3. CTA: '{cta}'\n\n"
            f"El caption completo (sin hashtags) debe tener entre 150 y 300 palabras.\n"
            f"Devuelve SOLO el caption, sin explicaciones adicionales."
        )

        message = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": self._system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": prompt}],
        )

        caption = message.content[0].text.strip()

        if include_hashtags and hashtags:
            full_post = f"{caption}\n\n.\n.\n.\n{hashtags}"
        else:
            full_post = caption

        return {
            "caption": caption,
            "hashtags": hashtags,
            "full_post": full_post,
            "topic": topic,
            "tokens_used": message.usage.input_tokens + message.usage.output_tokens,
        }

    def generate_content_calendar(self, days: int = 7, posts_per_day: int = 1) -> list[dict]:
        """Generate a weekly/monthly content calendar."""
        prompt = (
            f"Crea un calendario de contenido para Instagram de {days} días "
            f"con {posts_per_day} post(s) por día para una marca de {self.brand_niche}.\n\n"
            "Para cada post incluye:\n"
            "- Día y hora sugerida de publicación\n"
            "- Tipo de contenido (foto, carrusel, reel, story)\n"
            "- Tema/idea del post\n"
            "- Objetivo (engagement, alcance, conversión, comunidad)\n\n"
            "Formatea como lista numerada. Varía los formatos y objetivos."
        )

        message = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=[
                {
                    "type": "text",
                    "text": self._system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()
        return [{"day": i + 1, "content": line.strip()}
                for i, line in enumerate(raw.split("\n")) if line.strip()]

    def generate_hashtag_strategy(self, specific_topic: str = "") -> dict[str, list[str]]:
        """Generate a custom hashtag strategy for a specific post."""
        topic_context = f" para un post sobre '{specific_topic}'" if specific_topic else ""
        prompt = (
            f"Genera una estrategia de hashtags{topic_context} para una cuenta de {self.brand_niche}.\n\n"
            "Devuelve exactamente en este formato JSON (sin markdown):\n"
            '{"high_reach": ["hashtag1", ...], "medium": ["hashtag1", ...], "niche": ["hashtag1", ...]}\n\n'
            "- high_reach: 5 hashtags con +1M posts (amplio alcance)\n"
            "- medium: 10 hashtags con 100K-1M posts (balance alcance/competencia)\n"
            "- niche: 15 hashtags con <100K posts (alta tasa de engagement)\n"
            "Todos deben ser relevantes para el nicho y el tema. Solo el JSON, sin explicaciones."
        )

        message = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            system=[
                {
                    "type": "text",
                    "text": self._system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        try:
            result = json.loads(message.content[0].text.strip())
        except json.JSONDecodeError:
            result = get_hashtags(self.brand_niche)
        return result

    def suggest_post_ideas(self, count: int = 10) -> list[str]:
        """Generate post ideas for the brand's niche."""
        prompt = (
            f"Dame {count} ideas originales de posts para Instagram de una marca de {self.brand_niche}.\n"
            "Mezcla entre: educativo, entretenimiento, behind-the-scenes, testimonios, "
            "tendencias, motivacional, producto/servicio, comunidad.\n"
            "Formato: una idea por línea, sin numeración. Solo las ideas, concisas y accionables."
        )

        message = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            system=[
                {
                    "type": "text",
                    "text": self._system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": prompt}],
        )

        lines = message.content[0].text.strip().split("\n")
        return [line.strip() for line in lines if line.strip()][:count]
