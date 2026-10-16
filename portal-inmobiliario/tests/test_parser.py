"""Extracción de avisos sobre un fixture con la estructura real de la página."""

import unittest
from datetime import date, datetime
from pathlib import Path

from portal_inmobiliario import analisis, reporte
from portal_inmobiliario.cliente import buscar
from portal_inmobiliario.filtros import Filtros
from portal_inmobiliario.parser import es_barrera, numero, parsear_pagina

FIXTURES = Path(__file__).parent / "fixtures"


def pagina():
    return parsear_pagina((FIXTURES / "resultados.html").read_text(encoding="utf-8"))


class TestParser(unittest.TestCase):
    def test_metadatos(self):
        p = pagina()
        self.assertFalse(p.bloqueada)
        self.assertEqual(p.total, 1234)
        self.assertEqual(p.titulo, "Departamento en Venta en Ñuñoa")
        self.assertEqual(p.filtros_sitio, ["Ñuñoa", "Con terraza", "Venta"])
        self.assertEqual(p.offset, 48)
        self.assertEqual(p.orden_sitio, "relevance")
        self.assertEqual(p.filtros_ids, {"HAS_TERRACE": "242085", "price": "*CLP-300000000CLP",
                                         "category": "MLC1459"})
        self.assertTrue(p.canonical.endswith("/nunoa-metropolitana/_HAS*TERRACE_242085"))
        self.assertEqual([a.id for a in p.avisos],
                         ["MLC1111111111", "MLC2222222222", "MLC3333333333", "MLC4444444444"])

    def test_aviso_en_uf_con_rebaja(self):
        a = pagina().avisos[0]
        self.assertEqual(a.url, "https://portalinmobiliario.com/MLC-1111111111-depto-ejemplo-uno-_JM")
        self.assertEqual((a.precio, a.moneda, a.precio_anterior), (7500.5, "UF", 8000))
        self.assertEqual((a.dormitorios_min, a.banos_min, a.superficie_util_min), (3, 2, 75))
        self.assertEqual(a.publicador, "Corredora Ejemplo")
        self.assertEqual(a.etiqueta, "PUBLICADO ESTA SEMANA")
        self.assertFalse(a.es_proyecto)

    def test_aviso_en_pesos(self):
        a = pagina().avisos[1]
        self.assertEqual((a.precio, a.moneda), (215000000, "CLP"))
        self.assertEqual(a.superficie_util_min, 42.5)

    def test_proyecto_con_rangos(self):
        a = pagina().avisos[2]
        self.assertTrue(a.precio_desde)
        self.assertEqual((a.dormitorios_min, a.dormitorios_max), (0, 2))
        self.assertEqual((a.banos_min, a.banos_max), (1, 2))
        self.assertEqual((a.superficie_util_min, a.superficie_util_max), (30, 55))
        self.assertTrue(a.es_proyecto)

    def test_oficina(self):
        a = pagina().avisos[3]
        self.assertEqual((a.precio, a.privados_min), (47.75, 3))
        self.assertEqual(a.otros_atributos, ["Con vista"])

    def test_barrera(self):
        html = (FIXTURES / "barrera.html").read_text(encoding="utf-8")
        self.assertTrue(es_barrera(html))
        self.assertTrue(parsear_pagina(html).bloqueada)
        self.assertTrue(es_barrera("", "https://www.portalinmobiliario.com/gz/account-verification?go=x"))

    def test_numero(self):
        self.assertEqual(numero("1.450.000"), 1450000)
        self.assertEqual(numero("47,75"), 47.75)
        self.assertEqual(numero("23.900"), 23900)
        self.assertEqual(numero("2.5"), 2.5)


class ClienteFalso:
    """Devuelve siempre el fixture, como si fuera la primera página de resultados."""

    def __init__(self):
        self.urls = []

    def obtener(self, url):
        self.urls.append(url)
        return (FIXTURES / "resultados.html").read_text(encoding="utf-8"), url


class TestBuscar(unittest.TestCase):
    def test_advierte_filtros_que_el_sitio_no_aplico(self):
        f = Filtros(comuna="Ñuñoa", precio_max=300000000, moneda="CLP",
                    caracteristicas=["terraza", "piscina"])
        cliente = ClienteFalso()
        res = buscar(cliente, filtros=f, max_paginas=3, progreso=lambda _: None)
        # La página 2 repite los mismos avisos: no se duplican y la paginación se detiene.
        self.assertEqual(len(cliente.urls), 2)
        self.assertIn("/_Desde_5_", cliente.urls[1])
        self.assertEqual(len(res.avisos), 4)
        self.assertEqual(len(res.advertencias), 1)
        faltantes = res.advertencias[0].split(":", 1)[1].split(".", 1)[0].strip()
        self.assertEqual(faltantes, "Con piscina")  # terraza y precio sí venían aplicados


class TestAnalisisYReporte(unittest.TestCase):
    def test_verificacion_local_convierte_monedas(self):
        avisos = pagina().avisos
        f = Filtros(precio_max=6000, moneda="UF")
        ok, descartados = analisis.filtrar(avisos, f, valor_uf=40000)
        # 7.500 UF queda fuera; $215.000.000 = 5.375 UF y el proyecto "desde 4.200" quedan.
        self.assertEqual([a.id for a in ok], ["MLC2222222222", "MLC3333333333", "MLC4444444444"])
        self.assertEqual(descartados, 1)

    def test_html_del_informe(self):
        p = pagina()
        datos = reporte.armar_datos(
            p.avisos, titulo=p.titulo, url=p.canonical, paginas=["resultados.html"],
            fecha_datos=datetime(2026, 8, 13, 10, 30), total_sitio=p.total,
            filtros_sitio=p.filtros_sitio, uf=(40000.0, date(2026, 8, 13)),
        )
        self.assertEqual(datos["moneda"], "UF")
        fila = datos["avisos"][1]
        self.assertAlmostEqual(fila["precio_a"], 5375)
        self.assertAlmostEqual(fila["precio_m2"], 5375 / 42.5)
        self.assertIsNone(datos["avisos"][2]["precio_m2"])  # proyecto

        completo = reporte.generar_html(datos)
        self.assertTrue(completo.startswith("<!doctype html>"))
        self.assertIn("<title>Departamento en Venta en Ñuñoa</title>", completo)
        artefacto = reporte.generar_html(datos, artefacto=True)
        self.assertNotIn("<body>", artefacto)
        self.assertNotIn("</script><", artefacto.split('id="datos-informe">')[1].split("</script>")[0])


if __name__ == "__main__":
    unittest.main()
