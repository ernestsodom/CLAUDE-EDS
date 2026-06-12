"""
Dataset semilla de instituciones culturales / de entretenimiento en Chile.

Sirve para arrancar la base de prospectos sin depender de APIs de pago (Google
Places, etc.). Es un punto de partida amplio y representativo, NO una base
verificada:

    ⚠️  Los sitios web son de conocimiento público y de mejor esfuerzo (se dejan
        en blanco cuando no hay certeza, para no propagar URLs erróneas). Los
        emails y teléfonos se dejan vacíos a propósito para enriquecerse con el
        Módulo 2 (web_intel) o cargarse desde tu propia lista.
        VALIDA cada sitio y contacto antes de cualquier outreach.

Para complementar con tu propia data: usa `xperti importar tu_lista.csv`.
"""

from __future__ import annotations

from .models import Prospecto

# (nombre, tipo, region, ciudad, sitio_web)
_SEMILLA: list[tuple[str, str, str, str, str]] = [
    # ===================== TEATROS ===================================== #
    ("Teatro Municipal de Santiago", "Teatro", "Metropolitana", "Santiago", "https://municipal.cl"),
    ("Teatro Municipal de Las Condes", "Teatro", "Metropolitana", "Las Condes", "https://www.tmlascondes.cl"),
    ("Teatro Universidad de Chile", "Teatro", "Metropolitana", "Santiago", "https://teatro.uchile.cl"),
    ("Teatro Nescafé de las Artes", "Teatro", "Metropolitana", "Providencia", "https://teatro-nescafe-delasartes.cl"),
    ("Teatro Mori", "Teatro", "Metropolitana", "Santiago", "https://www.teatromori.cl"),
    ("Teatro San Ginés", "Teatro", "Metropolitana", "Providencia", "https://www.sangines.cl"),
    ("Teatro del Puente", "Teatro", "Metropolitana", "Santiago", ""),
    ("Teatro Caupolicán", "Centro de Eventos", "Metropolitana", "Santiago", ""),
    ("Teatro Coliseo", "Centro de Eventos", "Metropolitana", "Santiago", ""),
    ("Teatro Municipal de Ñuñoa", "Teatro", "Metropolitana", "Ñuñoa", ""),
    ("Teatro Municipal de Viña del Mar", "Teatro", "Valparaíso", "Viña del Mar", ""),
    ("Teatro Municipal de Valparaíso", "Teatro", "Valparaíso", "Valparaíso", ""),
    ("Teatro Pompeya", "Teatro", "Valparaíso", "Villa Alemana", ""),
    ("Teatro Biobío", "Teatro", "Biobío", "Concepción", "https://www.teatrobiobio.cl"),
    ("Teatro Universidad de Concepción", "Teatro", "Biobío", "Concepción", "https://www.teatroudec.cl"),
    ("Teatro Regional del Maule", "Teatro", "Maule", "Talca", "https://www.teatroregionaldelmaule.cl"),
    ("Teatro Regional de Rancagua", "Teatro", "O'Higgins", "Rancagua", ""),
    ("Teatro del Lago", "Teatro", "Los Lagos", "Frutillar", "https://www.teatrodellago.cl"),
    ("Teatro Municipal de Temuco", "Teatro", "Araucanía", "Temuco", ""),
    ("Teatro Municipal de Iquique", "Teatro", "Tarapacá", "Iquique", ""),
    ("Teatro Municipal de Antofagasta", "Teatro", "Antofagasta", "Antofagasta", ""),
    ("Teatro Municipal de Calama", "Teatro", "Antofagasta", "Calama", ""),
    ("Teatro Municipal de La Serena", "Teatro", "Coquimbo", "La Serena", ""),
    ("Teatro Municipal de Ovalle", "Teatro", "Coquimbo", "Ovalle", ""),
    ("Teatro Municipal de Chillán", "Teatro", "Ñuble", "Chillán", ""),
    ("Teatro Cervantes de Valdivia", "Teatro", "Los Ríos", "Valdivia", ""),
    ("Teatro Municipal José Bohr", "Teatro", "Magallanes", "Punta Arenas", ""),
    ("Teatro Diego Rivera", "Centro Cultural", "Los Lagos", "Puerto Montt", ""),

    # ===================== MUSEOS ====================================== #
    ("Museo Nacional de Bellas Artes", "Museo", "Metropolitana", "Santiago", "https://www.mnba.gob.cl"),
    ("Museo de Arte Contemporáneo (MAC)", "Museo", "Metropolitana", "Santiago", "https://www.mac.uchile.cl"),
    ("Museo Interactivo Mirador (MIM)", "Museo", "Metropolitana", "La Granja", "https://www.mim.cl"),
    ("Museo de la Memoria y los Derechos Humanos", "Museo", "Metropolitana", "Santiago", "https://web.museodelamemoria.cl"),
    ("Museo Chileno de Arte Precolombino", "Museo", "Metropolitana", "Santiago", "https://precolombino.cl"),
    ("Museo Histórico Nacional", "Museo", "Metropolitana", "Santiago", "https://www.mhn.gob.cl"),
    ("Museo Nacional de Historia Natural", "Museo", "Metropolitana", "Santiago", "https://www.mnhn.gob.cl"),
    ("Museo Artequin", "Museo", "Metropolitana", "Santiago", "https://www.artequin.cl"),
    ("Museo de la Moda", "Museo", "Metropolitana", "Vitacura", "https://www.museodelamoda.cl"),
    ("Museo Ralli", "Museo", "Metropolitana", "Vitacura", ""),
    ("Museo de la Merced", "Museo", "Metropolitana", "Santiago", ""),
    ("Museo Ferroviario de Santiago", "Museo", "Metropolitana", "Santiago", ""),
    ("Museo Violeta Parra", "Museo", "Metropolitana", "Santiago", ""),
    ("Museo del Carmen de Maipú", "Museo", "Metropolitana", "Maipú", ""),
    ("Museo Fonck", "Museo", "Valparaíso", "Viña del Mar", "https://www.museofonck.cl"),
    ("Museo Marítimo Nacional", "Museo", "Valparaíso", "Valparaíso", ""),
    ("Palacio Baburizza (Museo de Bellas Artes de Valparaíso)", "Museo", "Valparaíso", "Valparaíso", ""),
    ("Museo de Historia Natural de Valparaíso", "Museo", "Valparaíso", "Valparaíso", ""),
    ("Museo Artequin Viña del Mar", "Museo", "Valparaíso", "Viña del Mar", ""),
    ("Pinacoteca Universidad de Concepción", "Museo", "Biobío", "Concepción", "https://pinacoteca.udec.cl"),
    ("Museo de Historia Natural de Concepción", "Museo", "Biobío", "Concepción", ""),
    ("Museo Mapuche de Cañete", "Museo", "Biobío", "Cañete", ""),
    ("Museo Regional de Antofagasta", "Museo", "Antofagasta", "Antofagasta", ""),
    ("Museo Arqueológico de La Serena", "Museo", "Coquimbo", "La Serena", ""),
    ("Museo Gabriela Mistral de Vicuña", "Museo", "Coquimbo", "Vicuña", ""),
    ("Museo del Limarí", "Museo", "Coquimbo", "Ovalle", ""),
    ("Museo O'Higginiano y de Bellas Artes de Talca", "Museo", "Maule", "Talca", ""),
    ("Museo Regional de la Araucanía", "Museo", "Araucanía", "Temuco", ""),
    ("Museo Histórico y Antropológico Maurice van de Maele", "Museo", "Los Ríos", "Valdivia", ""),
    ("Museo Regional de Ancud", "Museo", "Los Lagos", "Ancud", ""),
    ("Museo Regional de Magallanes", "Museo", "Magallanes", "Punta Arenas", ""),
    ("Museo Nao Victoria", "Museo", "Magallanes", "Punta Arenas", ""),
    ("Museo Antropológico Padre Sebastián Englert", "Museo", "Valparaíso", "Isla de Pascua", ""),

    # =============== PLANETARIOS / OBSERVATORIOS ======================= #
    ("Planetario Chile (USACH)", "Planetario", "Metropolitana", "Santiago", "https://www.planetariochile.cl"),
    ("Observatorio Mamalluca", "Planetario", "Coquimbo", "Vicuña", "https://www.observatoriomamalluca.cl"),
    ("Observatorio Cruz del Sur", "Planetario", "Coquimbo", "Combarbalá", ""),
    ("Observatorio Collowara", "Planetario", "Coquimbo", "Andacollo", "https://www.collowara.cl"),
    ("Observatorio del Pangue", "Planetario", "Coquimbo", "Vicuña", ""),

    # =============== CENTROS CULTURALES / CORPORACIONES ================ #
    ("Centro Cultural Gabriela Mistral (GAM)", "Centro Cultural", "Metropolitana", "Santiago", "https://gam.cl"),
    ("Matucana 100", "Centro Cultural", "Metropolitana", "Santiago", "https://www.m100.cl"),
    ("Centro Cultural La Moneda", "Centro Cultural", "Metropolitana", "Santiago", "https://www.cclm.cl"),
    ("Centro Cultural Estación Mapocho", "Centro de Eventos", "Metropolitana", "Santiago", "https://www.estacionmapocho.cl"),
    ("Fundación CorpArtes", "Corporación Cultural", "Metropolitana", "Las Condes", "https://www.corpartes.cl"),
    ("Corporación Cultural de Las Condes", "Corporación Cultural", "Metropolitana", "Las Condes", "https://www.culturallascondes.cl"),
    ("Corporación Cultural de Ñuñoa", "Corporación Cultural", "Metropolitana", "Ñuñoa", "https://www.ccn.cl"),
    ("Balmaceda Arte Joven", "Centro Cultural", "Metropolitana", "Santiago", ""),
    ("Centro Cultural de España", "Centro Cultural", "Metropolitana", "Santiago", ""),
    ("Centro Cultural Montecarmelo", "Centro Cultural", "Metropolitana", "Providencia", ""),
    ("Centro Cultural Aldea del Encuentro", "Centro Cultural", "Metropolitana", "La Reina", ""),
    ("Centro Cultural Espacio Matta", "Centro Cultural", "Metropolitana", "La Granja", ""),
    ("Centro de Extensión UC", "Centro Cultural", "Metropolitana", "Santiago", ""),
    ("Corporación Cultural de Maipú", "Corporación Cultural", "Metropolitana", "Maipú", ""),
    ("Corporación Cultural de Puente Alto", "Corporación Cultural", "Metropolitana", "Puente Alto", ""),
    ("Corporación Cultural de Peñalolén", "Corporación Cultural", "Metropolitana", "Peñalolén", ""),
    ("Parque Cultural de Valparaíso", "Centro Cultural", "Valparaíso", "Valparaíso", "https://www.pcdv.cl"),
    ("Corporación Cultural Artistas del Acero", "Corporación Cultural", "Biobío", "Concepción", "https://www.artistasdelacero.cl"),
    ("Centro Cultural de Antofagasta", "Centro Cultural", "Antofagasta", "Antofagasta", ""),

    # ===================== CINES ======================================= #
    ("Centro Arte Alameda", "Cine", "Metropolitana", "Santiago", "https://www.centroartealameda.cl"),
    ("Cine Arte Normandie", "Cine", "Metropolitana", "Santiago", ""),
    ("Cineteca Nacional de Chile", "Cine", "Metropolitana", "Santiago", ""),
    ("Cine UC", "Cine", "Metropolitana", "Santiago", ""),
    ("El Biógrafo", "Cine", "Metropolitana", "Santiago", ""),
    ("Insomnia Teatro Condell", "Cine", "Valparaíso", "Valparaíso", ""),
    ("Cine Arte de Viña del Mar", "Cine", "Valparaíso", "Viña del Mar", ""),

    # =============== TRAMPOLINE PARKS ================================== #
    ("Urbatrap", "Trampoline Park", "Metropolitana", "Santiago", "https://www.urbatrap.cl"),
    ("Trampoline Park", "Trampoline Park", "Metropolitana", "Las Condes", "https://www.trampolinepark.cl"),
    ("Jumper Park", "Trampoline Park", "Metropolitana", "Santiago", "https://jumperpark.cl"),
    ("GoJump", "Trampoline Park", "Metropolitana", "Santiago", "https://gojump.cl"),

    # =============== PARQUES TEMÁTICOS / ENTRETENIMIENTO =============== #
    ("Fantasilandia", "Parque Temático", "Metropolitana", "Santiago", "https://www.fantasilandia.cl"),
    ("Buin Zoo", "Parque Temático", "Metropolitana", "Buin", "https://www.buinzoo.cl"),
    ("Happyland", "Parque Temático", "Metropolitana", "Santiago", "https://www.happyland.cl"),
    ("KidZania Santiago", "Parque Temático", "Metropolitana", "Santiago", ""),
    ("Zoológico Nacional (Parquemet)", "Parque Temático", "Metropolitana", "Santiago", "https://www.parquemet.cl"),
    ("Parque Safari", "Parque Temático", "O'Higgins", "Rancagua", ""),
    ("Parque Farellones", "Parque Temático", "Metropolitana", "Lo Barnechea", ""),

    # =============== CENTROS DE EVENTOS / ARENAS ====================== #
    ("Movistar Arena", "Centro de Eventos", "Metropolitana", "Santiago", "https://www.movistararena.cl"),
    ("Espacio Riesco", "Centro de Eventos", "Metropolitana", "Huechuraba", ""),
    ("Casa Piedra", "Centro de Eventos", "Metropolitana", "Vitacura", ""),
    ("Centro Parque", "Centro de Eventos", "Metropolitana", "Las Condes", ""),
    ("Gran Arena Monticello", "Centro de Eventos", "O'Higgins", "Mostazal", ""),
    ("Aula Magna Universidad de La Frontera", "Centro de Eventos", "Araucanía", "Temuco", ""),
]


def prospectos_semilla() -> list[Prospecto]:
    """Construye los objetos Prospecto a partir de la lista semilla."""
    out: list[Prospecto] = []
    for nombre, tipo, region, ciudad, web in _SEMILLA:
        out.append(
            Prospecto(
                nombre_institucion=nombre,
                tipo=tipo,
                region=region,
                ciudad=ciudad,
                sitio_web=web,
                fuente="seed",
            )
        )
    return out
