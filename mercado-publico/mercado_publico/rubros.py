"""
Catálogo de rubros (segmentos) de Mercado Público.

Mercado Público clasifica los productos/servicios de cada ítem de una licitación
según el estándar UNSPSC. El primer par de dígitos del código de categoría
identifica el "segmento" o rubro principal. Aquí mapeamos esos segmentos a un
nombre legible para poder filtrar licitaciones por rubro.
"""

from __future__ import annotations

# segmento UNSPSC (2 primeros dígitos) -> nombre del rubro
RUBROS: dict[str, str] = {
    "10": "Animales vivos, productos agrícolas y forestales",
    "11": "Materias primas (minerales, textiles, vegetales, animales)",
    "12": "Productos químicos",
    "13": "Materiales de caucho y plástico",
    "14": "Papel y productos de papel",
    "15": "Combustibles, aditivos y lubricantes",
    "20": "Maquinaria y accesorios de minería y perforación",
    "21": "Maquinaria agrícola, forestal y de jardín",
    "22": "Maquinaria de construcción y edificación",
    "23": "Maquinaria y accesorios industriales",
    "24": "Manejo, acondicionamiento y almacenaje de materiales",
    "25": "Vehículos comerciales, militares y transporte",
    "26": "Maquinaria de generación y distribución de energía",
    "27": "Herramientas y maquinaria general",
    "30": "Componentes y suministros de construcción",
    "31": "Componentes y suministros de fabricación",
    "32": "Componentes y suministros electrónicos",
    "39": "Equipos, suministros y componentes eléctricos e iluminación",
    "40": "Sistemas de distribución y acondicionamiento ambiental",
    "41": "Equipos de laboratorio, medición y testeo",
    "42": "Equipamiento y suministros médicos",
    "43": "Difusión de tecnologías de información y comunicación",
    "44": "Equipos, accesorios y suministros de oficina",
    "45": "Equipos de imprenta, fotografía y audiovisuales",
    "46": "Equipos de defensa, orden público y seguridad",
    "47": "Equipos y suministros de limpieza",
    "48": "Maquinaria y equipos de servicio y comercio",
    "49": "Equipos y accesorios deportivos y recreativos",
    "50": "Alimentos, bebidas y tabaco",
    "51": "Medicamentos y productos farmacéuticos",
    "52": "Artículos domésticos y electrodomésticos",
    "53": "Vestuario, maletas y productos de aseo personal",
    "54": "Relojes y joyería",
    "55": "Productos publicados (libros, mapas, multimedia)",
    "56": "Muebles y mobiliario",
    "60": "Instrumentos musicales, artes y manualidades",
    "70": "Servicios de agricultura, pesca, forestal y fauna",
    "71": "Servicios de minería, petróleo y gas",
    "72": "Servicios de construcción y mantención",
    "73": "Servicios de producción industrial y manufactura",
    "76": "Servicios de limpieza industrial y tratamiento de residuos",
    "77": "Servicios medioambientales",
    "78": "Servicios de transporte, almacenaje y correo",
    "80": "Servicios de gestión, profesionales y administrativos",
    "81": "Servicios de ingeniería, investigación y tecnología",
    "82": "Servicios editoriales, de diseño y de comunicación",
    "83": "Servicios públicos (electricidad, agua, telecomunicaciones)",
    "84": "Servicios financieros y de seguros",
    "85": "Servicios de salud",
    "86": "Servicios educativos y de capacitación",
    "90": "Servicios de viajes, alimentación, hospedaje y entretención",
    "91": "Servicios personales y domésticos",
    "92": "Servicios de defensa, orden público y seguridad",
    "93": "Servicios políticos y de asuntos cívicos",
    "94": "Organizaciones y clubes",
    "95": "Terrenos, edificios, estructuras y vías",
}


def segmento_de_codigo(codigo_categoria: str | int | None) -> str | None:
    """Devuelve el segmento (2 dígitos) de un código de categoría UNSPSC."""
    if codigo_categoria is None:
        return None
    texto = str(codigo_categoria).strip()
    if len(texto) < 2 or not texto[:2].isdigit():
        return None
    return texto[:2]


def nombre_rubro(codigo_categoria: str | int | None) -> str:
    """Nombre legible del rubro a partir de un código de categoría."""
    seg = segmento_de_codigo(codigo_categoria)
    if seg is None:
        return "Sin clasificar"
    return RUBROS.get(seg, f"Rubro {seg}")


def opciones_rubros() -> list[tuple[str, str]]:
    """Lista de (codigo_segmento, etiqueta) ordenada para selectores de UI."""
    return [(cod, f"{cod} · {nombre}") for cod, nombre in sorted(RUBROS.items())]
