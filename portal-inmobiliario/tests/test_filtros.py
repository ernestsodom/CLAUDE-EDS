"""Las URLs generadas deben coincidir con las que produce el propio sitio."""

import unittest

from portal_inmobiliario.filtros import Filtros, paginar_url, slug

BASE = "https://www.portalinmobiliario.com"

# (filtros, URL que el sitio generó para esa búsqueda en agosto de 2026)
CASOS_REALES = [
    (dict(comuna="Las Condes", caracteristicas=["terraza"]),
     "/venta/departamento/las-condes-metropolitana/_HAS*TERRACE_242085"),
    (dict(tipo="casa", dormitorios_min=3, dormitorios_max=3, comuna="Peñalolén",
          gastos_comunes_min=3000, gastos_comunes_max=10000),
     "/venta/casa/3-dormitorios/penalolen-metropolitana/_MAINTENANCE*FEE_3000CLP-10000CLP"),
    (dict(ubicacion="antofagasta/antofagasta/parque-juan-lopez", precio_max=100000000, moneda="CLP"),
     "/venta/departamento/antofagasta/antofagasta/parque-juan-lopez/_PriceRange_0CLP-100000000CLP"),
    (dict(condicion="nuevo", comuna="Providencia"),
     "/venta/departamento/proyectos/providencia-metropolitana"),
    (dict(operacion="arriendo", condicion="usado", ubicacion="alto-las-condes-santiago-metropolitana"),
     "/arriendo/departamento/propiedades-usadas/alto-las-condes-santiago-metropolitana"),
    (dict(operacion="arriendo", tipo="oficina", condicion="usado", comuna="Huechuraba"),
     "/arriendo/oficina/propiedades-usadas/huechuraba-metropolitana"),
    (dict(operacion="arriendo", condicion="nuevo", dormitorios_min=1, dormitorios_max=1, comuna="Santiago"),
     "/arriendo/departamento/proyectos/1-dormitorio/santiago-metropolitana"),
    (dict(comuna="Las Condes", superficie_util_min=80, superficie_util_max=150, caracteristicas=["terraza"]),
     "/venta/departamento/las-condes-metropolitana/_COVERED*AREA_80m%C2%B2-150m%C2%B2_HAS*TERRACE_242085"),
    (dict(comuna="Las Condes", antiguedad_min=15, antiguedad_max=30, caracteristicas=["terraza"]),
     "/venta/departamento/las-condes-metropolitana/_HAS*TERRACE_242085_PROPERTY*AGE_15a%C3%B1os-30a%C3%B1os"),
    (dict(comuna="Las Condes", banos_min=3, caracteristicas=["terraza"]),
     "/venta/departamento/las-condes-metropolitana/_FULL*BATHROOMS_3-*_HAS*TERRACE_242085"),
    (dict(comuna="Las Condes", estacionamientos_min=2, caracteristicas=["terraza"]),
     "/venta/departamento/las-condes-metropolitana/_HAS*TERRACE_242085_PARKING*LOTS_2-*"),
    (dict(comuna="Las Condes", dormitorios_min=4, caracteristicas=["terraza"]),
     "/venta/departamento/mas-de-4-dormitorios/las-condes-metropolitana/_HAS*TERRACE_242085"),
    (dict(comuna="Las Condes", dormitorios_min=0, dormitorios_max=0, caracteristicas=["terraza"]),
     "/venta/departamento/sin-dormitorios/las-condes-metropolitana/_HAS*TERRACE_242085"),
    (dict(comuna="Las Condes", publicador="particular", caracteristicas=["terraza"]),
     "/venta/departamento/particular/las-condes-metropolitana/_HAS*TERRACE_242085"),
    (dict(comuna="Las Condes", precio_max=350000000, moneda="CLP", caracteristicas=["terraza"]),
     "/venta/departamento/las-condes-metropolitana/_PriceRange_0CLP-350000000CLP_HAS*TERRACE_242085"),
    (dict(comuna="Las Condes", publicados_hoy=True, caracteristicas=["terraza"]),
     "/venta/departamento/las-condes-metropolitana/_PublishedToday_YES_HAS*TERRACE_242085"),
    (dict(comuna="Las Condes", caracteristicas=["terraza", "amoblado"]),
     "/venta/departamento/las-condes-metropolitana/_FURNISHED_242085_HAS*TERRACE_242085"),
    (dict(comuna="Las Condes", superficie_total_max=90, caracteristicas=["terraza"]),
     "/venta/departamento/las-condes-metropolitana/_HAS*TERRACE_242085_TOTAL*AREA_*-90m%C2%B2"),
]


class TestFiltros(unittest.TestCase):
    def test_urls_identicas_a_las_del_sitio(self):
        for kw, ruta in CASOS_REALES:
            with self.subTest(ruta=ruta):
                self.assertEqual(Filtros(**kw).url(), BASE + ruta)

    def test_precio_en_uf_se_convierte_a_pesos(self):
        f = Filtros(comuna="Ñuñoa", precio_min=4000, precio_max=6000)
        self.assertEqual(
            f.url(valor_uf=40000),
            BASE + "/venta/departamento/nunoa-metropolitana/_PriceRange_160000000CLP-240000000CLP",
        )

    def test_busqueda_con_varios_filtros(self):
        f = Filtros(comuna="Las Condes", dormitorios_min=3, banos_min=2, superficie_util_min=100,
                    precio_max=8900, caracteristicas=["terraza", "jardin", "piscina"])
        self.assertEqual(
            f.url(valor_uf=40000),
            BASE + "/venta/departamento/las-condes-metropolitana/_PriceRange_0CLP-356000000CLP"
            "_BEDROOMS_3-*_COVERED*AREA_100m%C2%B2-*_FULL*BATHROOMS_2-*_HAS*GARDEN_242085"
            "_HAS*SWIMMING*POOL_242085_HAS*TERRACE_242085",
        )
        self.assertEqual(
            set(f.claves_sitio(valor_uf=40000)),
            {"price", "BEDROOMS", "FULL_BATHROOMS", "COVERED_AREA", "HAS_GARDEN",
             "HAS_SWIMMING_POOL", "HAS_TERRACE"},
        )

    def test_sin_valor_uf_el_precio_queda_fuera_de_la_url(self):
        f = Filtros(comuna="Ñuñoa", precio_max=6000, caracteristicas=["terraza"])
        self.assertEqual(f.url(), BASE + "/venta/departamento/nunoa-metropolitana/_HAS*TERRACE_242085")

    def test_paginacion_y_orden(self):
        f = Filtros(comuna="Ñuñoa", orden="precio-asc")
        self.assertEqual(
            f.url(pagina=3),
            BASE + "/venta/departamento/nunoa-metropolitana/_Desde_97_OrderId_PRICE_NoIndex_True",
        )

    def test_paginar_url_copiada_del_sitio(self):
        url = BASE + "/venta/departamento/las-condes-metropolitana/_HAS*TERRACE_242085?filter=group_1"
        self.assertEqual(
            paginar_url(url, 2),
            BASE + "/venta/departamento/las-condes-metropolitana/"
            "_Desde_49_HAS*TERRACE_242085_NoIndex_True?filter=group_1",
        )
        self.assertEqual(paginar_url(paginar_url(url, 2), 2), paginar_url(url, 2))
        self.assertEqual(paginar_url(BASE + "/venta/casa/la-reina-metropolitana", 2),
                         BASE + "/venta/casa/la-reina-metropolitana/_Desde_49_NoIndex_True")

    def test_slug(self):
        self.assertEqual(slug("Peñalolén"), "penalolen")
        self.assertEqual(slug("Parque O'Higgins"), "parque-ohiggins")
        self.assertEqual(slug("Estación Central"), "estacion-central")

    def test_valida_opciones(self):
        with self.assertRaises(ValueError):
            Filtros(caracteristicas=["helipuerto"])
        with self.assertRaises(ValueError):
            Filtros(moneda="USD")

    def test_describir(self):
        f = Filtros(comuna="Ñuñoa", dormitorios_min=2, precio_max=6000, caracteristicas=["terraza"])
        self.assertEqual(
            f.describir(),
            ["Departamento", "venta", "Ñuñoa", "2+ dormitorios", "Hasta UF 6.000", "Con terraza"],
        )


if __name__ == "__main__":
    unittest.main()
