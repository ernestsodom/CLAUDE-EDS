"""
Extractor de avisos de Portal Inmobiliario (Chile) según filtros.

Arma la URL de búsqueda a partir de filtros (operación, tipo, comuna, precio,
dormitorios, superficie, características…), descarga las páginas de
resultados, extrae cada aviso y genera un informe HTML autónomo más CSV/JSON.
"""

__version__ = "0.1.0"
