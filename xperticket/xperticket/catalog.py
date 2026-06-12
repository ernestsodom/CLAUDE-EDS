"""
Catálogo de conocimiento de dominio: tipos de cliente, regiones, benchmarks de
ticketeras y supuestos de volumen/ticket/intangibles por segmento.

Todos los números son *supuestos de partida* basados en el Prompt Maestro y se
ajustan con datos públicos cuando existen. Centralizarlos aquí permite calibrar
el motor sin tocar la lógica.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# --------------------------------------------------------------------------- #
# Tipos de cliente objetivo y regiones de Chile
# --------------------------------------------------------------------------- #
TIPOS_CLIENTE = [
    "Teatro",
    "Cine",
    "Museo",
    "Planetario",
    "Corporación Cultural",
    "Centro Cultural",
    "Trampoline Park",
    "Parque Temático",
    "Centro de Eventos",
]

REGIONES_CHILE = [
    "Arica y Parinacota",
    "Tarapacá",
    "Antofagasta",
    "Atacama",
    "Coquimbo",
    "Valparaíso",
    "Metropolitana",
    "O'Higgins",
    "Maule",
    "Ñuble",
    "Biobío",
    "Araucanía",
    "Los Ríos",
    "Los Lagos",
    "Aysén",
    "Magallanes",
]

# Regiones prioritarias para el outreach inicial (Prompt Maestro).
REGIONES_PRIORITARIAS = ["Metropolitana", "Valparaíso", "Biobío", "Araucanía"]


# --------------------------------------------------------------------------- #
# Benchmarks de ticketeras (comisión típica al cliente, en %)
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Ticketera:
    nombre: str
    comision_min: float  # %
    comision_max: float  # %
    # Firmas para detectar la ticketera en el HTML / enlaces de una web.
    firmas: tuple[str, ...] = ()

    @property
    def comision_media(self) -> float:
        return round((self.comision_min + self.comision_max) / 2, 1)


# Comisión "efectiva" estimada que paga el cliente (cargo por servicio + fee
# de gestión). Rango orientativo de mercado chileno; calibrar con datos reales.
TICKETERAS: dict[str, Ticketera] = {
    "Ticketek": Ticketera("Ticketek", 12, 15, ("ticketek",)),
    "PuntoTicket": Ticketera("PuntoTicket", 11, 14, ("puntoticket",)),
    "Passline": Ticketera("Passline", 9, 12, ("passline",)),
    "Ticketplus": Ticketera("Ticketplus", 9, 12, ("ticketplus", "ticket-plus")),
    "Entradium": Ticketera("Entradium", 10, 12, ("entradium",)),
    "Boletix": Ticketera("Boletix", 9, 11, ("boletix",)),
    "TuEntrada": Ticketera("TuEntrada", 8, 10, ("tuentrada", "tu-entrada")),
    "Ticketpro": Ticketera("Ticketpro", 9, 12, ("ticketpro",)),
    "Welcu": Ticketera("Welcu", 8, 11, ("welcu",)),
    "Daleticket": Ticketera("Daleticket", 8, 11, ("daleticket", "dale-ticket")),
    "Portaldisc": Ticketera("Portaldisc", 8, 12, ("portaldisc",)),
    "Eventbrite": Ticketera("Eventbrite", 8, 12, ("eventbrite",)),
}

# Categorías especiales (no son ticketeras de terceros).
TICKETERA_DESCONOCIDA = "Desconocida"
TICKETERA_DIRECTA = "Venta directa"  # vende en su propio sitio
TICKETERA_MANUAL = "Manual / Sin ticketera"  # boletería física, sin venta online

# Costo de ineficiencia operacional cuando NO hay ticketera (venta manual):
# equivale a perder ~7.5% entre horas-hombre, errores y reprocesos.
COSTO_INEFICIENCIA_MANUAL = 7.5  # %

# Pasarelas de pago detectables (señal de venta directa / integración).
PASARELAS_PAGO = {
    "Webpay": ("webpay", "transbank"),
    "Mercado Pago": ("mercadopago", "mercado pago", "mpago"),
    "Flow": ("flow.cl", "getflow"),
    "Khipu": ("khipu",),
    "Fintoc": ("fintoc",),
    "PayPal": ("paypal",),
    "Stripe": ("stripe",),
}

# CMS / plataformas web detectables.
CMS_FIRMAS = {
    "WordPress": ("wp-content", "wp-includes", "/wp-json"),
    "Wix": ("wix.com", "_wixcss", "wixstatic"),
    "Squarespace": ("squarespace",),
    "Shopify": ("cdn.shopify", "myshopify"),
    "Drupal": ("/sites/default/files", "drupal"),
    "Joomla": ("/media/jui/", "joomla"),
    "Webflow": ("webflow",),
}


# --------------------------------------------------------------------------- #
# Comisión que propone Xperticket
# --------------------------------------------------------------------------- #
# Comisión objetivo por defecto (Prompt Maestro: 2-5%). Se puede sobreescribir
# por prospecto.
XPERTICKET_COMISION_DEFAULT = 3.0  # %
XPERTICKET_COMISION_MIN = 2.0
XPERTICKET_COMISION_MAX = 5.0


# --------------------------------------------------------------------------- #
# Supuestos de volumen / ticket / intangibles por tipo de cliente
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class PerfilSegmento:
    """Supuestos de partida por tipo de cliente."""

    tipo: str
    entradas_mes_min: int
    entradas_mes_max: int
    ticket_promedio_uf: float  # valor medio de una entrada, en UF
    eventos_mes_tipico: int
    # Beneficios intangibles anuales estimados (USD) si migra a Xperticket.
    intangibles_usd_anual: int
    # Dolores típicos del segmento (Módulo 4).
    dolores: tuple[str, ...] = ()
    # Oportunidades / propuesta de valor de Xperticket (Módulo 4).
    oportunidades: tuple[str, ...] = ()


# 1 UF ≈ 39.000 CLP. Ticket promedio expresado en UF para independizarse de la
# inflación. Ej.: 0.5 UF ≈ $19.500 CLP.
PERFILES: dict[str, PerfilSegmento] = {
    "Teatro": PerfilSegmento(
        tipo="Teatro",
        entradas_mes_min=300,
        entradas_mes_max=600,
        ticket_promedio_uf=0.5,
        eventos_mes_tipico=8,
        intangibles_usd_anual=3600,
        dolores=(
            "Comisiones altas a ticketera de terceros",
            "Sin acceso a los datos de sus clientes (CRM)",
            "Reportes manuales y lentos para gestión y directorio",
            "Sin capacidad de venta dinámica por tipo de público",
        ),
        oportunidades=(
            "Reducir comisión a 2-5%",
            "Acceso 100% a datos de clientes (CRM propio)",
            "Reportes en tiempo real y automáticos",
            "Venta dinámica y abonos por temporada",
            "App móvil para venta en boletería",
            "Integración con su propio sitio web",
        ),
    ),
    "Cine": PerfilSegmento(
        tipo="Cine",
        entradas_mes_min=1000,
        entradas_mes_max=2000,
        ticket_promedio_uf=0.2,
        eventos_mes_tipico=120,
        intangibles_usd_anual=4800,
        dolores=(
            "Comisiones + integraciones complejas",
            "Falta de segmentación de público",
            "Venta reactiva, no proactiva",
            "Gestión de aforo y overbooking manual",
        ),
        oportunidades=(
            "Tarifa única y transparente",
            "Segmentación avanzada (VIP, niños, adultos, senior)",
            "Venta dinámica + recomendaciones",
            "Control de aforo automático por sala",
            "Programa de puntos / lealtad",
        ),
    ),
    "Museo": PerfilSegmento(
        tipo="Museo",
        entradas_mes_min=200,
        entradas_mes_max=400,
        ticket_promedio_uf=0.15,
        eventos_mes_tipico=4,
        intangibles_usd_anual=2400,
        dolores=(
            "Baja conversión de venta online",
            "Sin tracking del visitante",
            "Ticketera cara para volumen bajo",
            "Difícil manejar grupos y colegios",
        ),
        oportunidades=(
            "Fee plano (no comisión por %)",
            "CRM para colegios y grupos",
            "UX diseñada para visita de baja frecuencia",
            "Reportes de visitante y aforo",
        ),
    ),
    "Planetario": PerfilSegmento(
        tipo="Planetario",
        entradas_mes_min=400,
        entradas_mes_max=900,
        ticket_promedio_uf=0.2,
        eventos_mes_tipico=30,
        intangibles_usd_anual=3000,
        dolores=(
            "Funciones con horarios fijos difíciles de gestionar",
            "Demanda escolar concentrada en pocas fechas",
            "Sin venta anticipada eficiente",
        ),
        oportunidades=(
            "Venta por función y horario con control de aforo",
            "Reservas y cupos para colegios",
            "Venta anticipada y lista de espera",
            "Reportes de ocupación por función",
        ),
    ),
    "Corporación Cultural": PerfilSegmento(
        tipo="Corporación Cultural",
        entradas_mes_min=200,
        entradas_mes_max=700,
        ticket_promedio_uf=0.4,
        eventos_mes_tipico=10,
        intangibles_usd_anual=3600,
        dolores=(
            "Múltiples espacios y eventos sin sistema unificado",
            "Rendición y transparencia exigente (fondos públicos)",
            "Comisiones que erosionan presupuesto municipal",
        ),
        oportunidades=(
            "Plataforma única para todos sus espacios",
            "Reportes para rendición y transparencia",
            "Reducción de comisión y control presupuestario",
            "Abonos, gratuidades y cupos sociales",
        ),
    ),
    "Centro Cultural": PerfilSegmento(
        tipo="Centro Cultural",
        entradas_mes_min=250,
        entradas_mes_max=800,
        ticket_promedio_uf=0.4,
        eventos_mes_tipico=12,
        intangibles_usd_anual=3600,
        dolores=(
            "Agenda diversa (teatro, música, talleres) en sistemas distintos",
            "Sin datos consolidados de audiencia",
            "Comisiones altas en eventos masivos",
        ),
        oportunidades=(
            "Una sola plataforma para toda la programación",
            "CRM y datos consolidados de audiencia",
            "Comisión reducida y transparente",
            "Venta de talleres con cupos",
        ),
    ),
    "Trampoline Park": PerfilSegmento(
        tipo="Trampoline Park",
        entradas_mes_min=1500,
        entradas_mes_max=4000,
        ticket_promedio_uf=0.3,
        eventos_mes_tipico=0,  # acceso por franja horaria, no eventos
        intangibles_usd_anual=4800,
        dolores=(
            "Venta por franja horaria difícil de controlar",
            "Cumpleaños y grupos gestionados a mano",
            "Sobreventa de aforo en horas peak",
            "Sin upselling de extras (calcetines, snacks)",
        ),
        oportunidades=(
            "Venta por franja con control de aforo en tiempo real",
            "Paquetes de cumpleaños y grupos online",
            "Upselling de extras en el checkout",
            "Waivers / consentimientos digitales",
        ),
    ),
    "Parque Temático": PerfilSegmento(
        tipo="Parque Temático",
        entradas_mes_min=2000,
        entradas_mes_max=8000,
        ticket_promedio_uf=0.5,
        eventos_mes_tipico=0,
        intangibles_usd_anual=6000,
        dolores=(
            "Picos de demanda estacionales",
            "Colas en boletería física",
            "Sin precios dinámicos por temporada/día",
            "Pases anuales gestionados manualmente",
        ),
        oportunidades=(
            "Venta anticipada con precios dinámicos",
            "Pases anuales y multivisita con CRM",
            "Reducción de colas (entrada por QR)",
            "Bundles y promociones automáticas",
        ),
    ),
    "Centro de Eventos": PerfilSegmento(
        tipo="Centro de Eventos",
        entradas_mes_min=500,
        entradas_mes_max=2500,
        ticket_promedio_uf=0.6,
        eventos_mes_tipico=15,
        intangibles_usd_anual=4800,
        dolores=(
            "Eventos de terceros con ticketeras dispares",
            "Sin estandarización ni datos propios",
            "Comisiones negociadas evento a evento",
        ),
        oportunidades=(
            "Plataforma estándar para todos los productores",
            "Datos propios de cada evento (CRM del recinto)",
            "Comisión única y transparente",
            "Reportes consolidados por temporada",
        ),
    ),
}

# Perfil por defecto para tipos no catalogados.
PERFIL_DEFAULT = PerfilSegmento(
    tipo="Genérico",
    entradas_mes_min=300,
    entradas_mes_max=800,
    ticket_promedio_uf=0.4,
    eventos_mes_tipico=8,
    intangibles_usd_anual=3000,
    dolores=(
        "Comisiones de terceros",
        "Sin acceso a datos de clientes",
        "Procesos manuales",
    ),
    oportunidades=(
        "Comisión reducida (2-5%)",
        "CRM propio",
        "Reportes automáticos",
    ),
)


def perfil_de(tipo: str) -> PerfilSegmento:
    """Devuelve el perfil de supuestos para un tipo de cliente."""
    return PERFILES.get((tipo or "").strip(), PERFIL_DEFAULT)
