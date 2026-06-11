"""
Extracción de la ficha completa de una licitación desde el detalle crudo de la API.

Replica la información que muestra una ficha tipo LicitaLab: datos del comprador,
fechas clave, ítems, montos, adjudicatarios y enlaces a documentos/acta.

Nota: la API pública NO entrega los archivos adjuntos (bases, anexos) para la
mayoría de los tickets, por lo que para esos documentos se enlaza a la ficha
oficial de Mercado Público y al acta de adjudicación cuando está disponible.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import pandas as pd

from .models import _safe, proveedores_adjudicados


# Fechas relevantes con su etiqueta legible.
FECHAS_LABELS = [
    ("FechaPublicacion", "Publicación"),
    ("FechaInicio", "Inicio de preguntas"),
    ("FechaFinal", "Fin de preguntas"),
    ("FechaPubRespuestas", "Publicación de respuestas"),
    ("FechaActoAperturaTecnica", "Apertura técnica"),
    ("FechaActoAperturaEconomica", "Apertura económica"),
    ("FechaCierre", "Cierre de ofertas"),
    ("FechaEstimadaAdjudicacion", "Adjudicación estimada"),
    ("FechaAdjudicacion", "Adjudicación"),
    ("FechaEntregaAntecedentes", "Entrega de antecedentes"),
    ("FechaVisitaTerreno", "Visita a terreno"),
]


def link_ficha_publica(codigo: str) -> str:
    """
    Enlace para abrir la ficha y documentos en Mercado Público.

    La API no permite construir la URL cifrada de la ficha directamente, así que
    se usa una búsqueda que aterriza en la ficha oficial (donde están las bases).
    """
    return f"https://www.google.com/search?q=mercadopublico+licitaci%C3%B3n+{quote(str(codigo))}"


def datos_generales(detalle: dict[str, Any]) -> dict[str, Any]:
    """Encabezado y datos principales de la licitación."""
    return {
        "codigo": detalle.get("CodigoExterno"),
        "nombre": detalle.get("Nombre"),
        "descripcion": detalle.get("Descripcion"),
        "estado": detalle.get("Estado"),
        "tipo": detalle.get("Tipo"),
        "moneda": detalle.get("Moneda"),
        "monto_estimado": detalle.get("MontoEstimado"),
        "modalidad_pago": detalle.get("ModalidadPago") or detalle.get("FormaPago"),
        "dias_cierre": detalle.get("DiasCierreLicitacion"),
        "tipo_convocatoria": detalle.get("TipoConvocatoria"),
        "contrato": detalle.get("Contrato"),
        "tiempo_duracion": detalle.get("TiempoDuracionContrato"),
        "tipo_duracion": detalle.get("TipoDuracionContrato"),
    }


def datos_comprador(detalle: dict[str, Any]) -> dict[str, Any]:
    c = detalle.get("Comprador") or {}
    return {
        "organismo": c.get("NombreOrganismo"),
        "unidad": c.get("NombreUnidad"),
        "rut_unidad": c.get("RutUnidad"),
        "direccion": c.get("DireccionUnidad"),
        "comuna": c.get("ComunaUnidad"),
        "region": c.get("RegionUnidad"),
        "usuario": c.get("NombreUsuario"),
        "cargo": c.get("CargoUsuario"),
    }


def fechas(detalle: dict[str, Any]) -> list[tuple[str, str]]:
    """Lista de (etiqueta, valor) de las fechas presentes."""
    f = detalle.get("Fechas") or {}
    out: list[tuple[str, str]] = []
    for clave, label in FECHAS_LABELS:
        valor = f.get(clave) or detalle.get(clave)
        if valor:
            out.append((label, str(valor).replace("T", " ")))
    return out


def items_df(detalle: dict[str, Any]) -> pd.DataFrame:
    """Tabla de ítems de la licitación (producto, rubro, cantidad, adjudicado)."""
    listado = _safe(detalle, "Items", "Listado", default=[]) or []
    filas = []
    for it in listado:
        adj = it.get("Adjudicacion") or {}
        filas.append({
            "Producto": it.get("NombreProducto"),
            "Categoría": it.get("Categoria") or it.get("CodigoCategoria"),
            "Cantidad": it.get("Cantidad"),
            "Unidad": it.get("UnidadMedida"),
            "Descripción": it.get("Descripcion"),
            "Adjudicado a": adj.get("NombreProveedor"),
            "Monto unitario": adj.get("MontoUnitario"),
        })
    return pd.DataFrame(filas)


def adjudicacion(detalle: dict[str, Any]) -> dict[str, Any]:
    """Datos de adjudicación: nº oferentes, monto, acta y proveedores ganadores."""
    adj = detalle.get("Adjudicacion") or {}
    return {
        "tipo": adj.get("Tipo"),
        "fecha": adj.get("Fecha"),
        "numero": adj.get("Numero"),
        "n_oferentes": adj.get("NumeroOferentes"),
        "monto_total": adj.get("MontoTotal"),
        "url_acta": adj.get("UrlActa") or adj.get("UrlActaAdjudicacion"),
        "proveedores": proveedores_adjudicados(detalle),
    }
