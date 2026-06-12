"""
Dataset semilla de instituciones culturales / de entretenimiento en Chile.

Sirve para arrancar la base de prospectos sin depender de APIs de pago (Google
Places, etc.). Es un punto de partida representativo, NO una base verificada:

    ⚠️  Los sitios web son de conocimiento público y de mejor esfuerzo, pero
        DEBEN validarse antes de cualquier contacto. Los emails y teléfonos se
        dejan vacíos a propósito para enriquecerse con el Módulo 2 (web_intel)
        o cargarse desde tu propia lista (discovery.importar_csv).

Para tu lista real de 100-200 instituciones: usa `xperti importar tu_lista.csv`.
"""

from __future__ import annotations

from .models import Prospecto

# (nombre, tipo, region, ciudad, sitio_web)
_SEMILLA: list[tuple[str, str, str, str, str]] = [
    # --- Región Metropolitana -------------------------------------------- #
    ("Teatro Municipal de Santiago", "Teatro", "Metropolitana", "Santiago", "https://municipal.cl"),
    ("Teatro Municipal de Las Condes", "Teatro", "Metropolitana", "Las Condes", "https://www.tmlascondes.cl"),
    ("Centro Cultural Gabriela Mistral (GAM)", "Centro Cultural", "Metropolitana", "Santiago", "https://gam.cl"),
    ("Teatro Nescafé de las Artes", "Teatro", "Metropolitana", "Providencia", "https://teatro-nescafe-delasartes.cl"),
    ("Matucana 100", "Centro Cultural", "Metropolitana", "Santiago", "https://www.m100.cl"),
    ("Centro Cultural La Moneda", "Centro Cultural", "Metropolitana", "Santiago", "https://www.cclm.cl"),
    ("Teatro Universidad de Chile", "Teatro", "Metropolitana", "Santiago", "https://teatro.uchile.cl"),
    ("Fundación CorpArtes", "Corporación Cultural", "Metropolitana", "Las Condes", "https://www.corpartes.cl"),
    ("Centro Cultural Estación Mapocho", "Centro de Eventos", "Metropolitana", "Santiago", "https://www.estacionmapocho.cl"),
    ("Movistar Arena", "Centro de Eventos", "Metropolitana", "Santiago", "https://www.movistararena.cl"),
    ("Museo Nacional de Bellas Artes", "Museo", "Metropolitana", "Santiago", "https://www.mnba.gob.cl"),
    ("Museo de Arte Contemporáneo (MAC)", "Museo", "Metropolitana", "Santiago", "https://www.mac.uchile.cl"),
    ("Museo Interactivo Mirador (MIM)", "Museo", "Metropolitana", "La Granja", "https://www.mim.cl"),
    ("Museo de la Memoria y los Derechos Humanos", "Museo", "Metropolitana", "Santiago", "https://web.museodelamemoria.cl"),
    ("Museo Artequin", "Museo", "Metropolitana", "Santiago", "https://www.artequin.cl"),
    ("Planetario Chile (USACH)", "Planetario", "Metropolitana", "Santiago", "https://www.planetariochile.cl"),
    ("Fantasilandia", "Parque Temático", "Metropolitana", "Santiago", "https://www.fantasilandia.cl"),
    ("Buin Zoo", "Parque Temático", "Metropolitana", "Buin", "https://www.buinzoo.cl"),
    ("Centro Arte Alameda", "Cine", "Metropolitana", "Santiago", "https://www.centroartealameda.cl"),
    ("Cine Arte Normandie", "Cine", "Metropolitana", "Santiago", "https://www.normandie.cl"),
    ("Teatro Mori", "Teatro", "Metropolitana", "Santiago", "https://www.teatromori.cl"),
    ("Corporación Cultural de Las Condes", "Corporación Cultural", "Metropolitana", "Las Condes", "https://www.culturallascondes.cl"),
    ("Corporación Cultural de Ñuñoa", "Corporación Cultural", "Metropolitana", "Ñuñoa", "https://www.ccn.cl"),
    ("Urbatrap", "Trampoline Park", "Metropolitana", "Santiago", "https://www.urbatrap.cl"),

    # --- Región de Valparaíso -------------------------------------------- #
    ("Teatro Municipal de Viña del Mar", "Teatro", "Valparaíso", "Viña del Mar", "https://www.teatromunicipalvalpo.cl"),
    ("Parque Cultural de Valparaíso", "Centro Cultural", "Valparaíso", "Valparaíso", "https://www.pcdv.cl"),
    ("Museo Fonck", "Museo", "Valparaíso", "Viña del Mar", "https://www.museofonck.cl"),
    ("Museo Marítimo Nacional", "Museo", "Valparaíso", "Valparaíso", "https://www.museomaritimo.cl"),
    ("Teatro Condell (Insomnia)", "Cine", "Valparaíso", "Valparaíso", "https://www.insomniavalparaiso.cl"),

    # --- Región del Biobío ----------------------------------------------- #
    ("Teatro Biobío", "Teatro", "Biobío", "Concepción", "https://www.teatrobiobio.cl"),
    ("Teatro Universidad de Concepción", "Teatro", "Biobío", "Concepción", "https://www.teatroudec.cl"),
    ("Corporación Cultural Artistas del Acero", "Corporación Cultural", "Biobío", "Concepción", "https://www.artistasdelacero.cl"),
    ("Pinacoteca Universidad de Concepción", "Museo", "Biobío", "Concepción", "https://pinacoteca.udec.cl"),

    # --- Región de La Araucanía ------------------------------------------ #
    ("Teatro Municipal de Temuco", "Teatro", "Araucanía", "Temuco", "https://www.culturatemuco.cl"),
    ("Aula Magna Universidad de La Frontera", "Centro de Eventos", "Araucanía", "Temuco", "https://www.ufro.cl"),

    # --- Otras regiones --------------------------------------------------- #
    ("Teatro Regional del Maule", "Teatro", "Maule", "Talca", "https://www.teatroregionaldelmaule.cl"),
    ("Teatro Regional Cervantes", "Teatro", "Coquimbo", "Ovalle", "https://www.teatrocervantes.cl"),
    ("Teatro del Lago", "Teatro", "Los Lagos", "Frutillar", "https://www.teatrodellago.cl"),
    ("Museo de Arte Precolombino", "Museo", "Metropolitana", "Santiago", "https://precolombino.cl"),
    ("Museo Marítimo y Ballenero", "Museo", "Antofagasta", "Mejillones", ""),
    ("Centro Cultural de Antofagasta", "Centro Cultural", "Antofagasta", "Antofagasta", ""),
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
