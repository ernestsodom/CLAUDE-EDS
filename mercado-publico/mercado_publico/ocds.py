"""
Obtención de documentos (bases, anexos, actas) de una licitación vía la API
OCDS de ChileCompra (estándar Open Contracting).

A diferencia de la API REST clásica —que no expone los adjuntos— el estándar
OCDS publica, para cada licitación, un arreglo `documents` con la URL descargable
de cada documento (bases administrativas/técnicas, anexos, aclaraciones, acta de
adjudicación, etc.).

Endpoint por licitación:
    https://api.mercadopublico.cl/APISOCDS/OCDS/tender/{codigo}

No requiere ticket. Si el host está bloqueado por red, la función lo informa y la
app cae al enlace de la ficha oficial.
"""

from __future__ import annotations

from typing import Any

import requests

OCDS_BASE = "https://api.mercadopublico.cl/APISOCDS/OCDS"

# Traducción de los tipos de documento OCDS a etiquetas legibles.
TIPO_DOC = {
    "biddingDocuments": "Bases de licitación",
    "technicalSpecifications": "Especificaciones técnicas",
    "evaluationCriteria": "Criterios de evaluación",
    "clarifications": "Aclaraciones / respuestas",
    "awardNotice": "Resolución de adjudicación",
    "contractSigned": "Contrato firmado",
    "contractGuarantees": "Garantías",
    "tenderNotice": "Llamado a licitación",
    "x_actaAdjudicacion": "Acta de adjudicación",
}


class OCDSError(RuntimeError):
    pass


def _recolectar_documentos(obj: Any, acc: list[dict[str, Any]]) -> None:
    """Recorre recursivamente el JSON OCDS recolectando documentos con URL."""
    if isinstance(obj, dict):
        # Un documento OCDS típico tiene 'url' y ('documentType' o 'title').
        if "url" in obj and ("documentType" in obj or "title" in obj):
            acc.append(obj)
        for v in obj.values():
            _recolectar_documentos(v, acc)
    elif isinstance(obj, list):
        for v in obj:
            _recolectar_documentos(v, acc)


def documentos_licitacion(
    codigo: str, timeout: int = 25
) -> list[dict[str, Any]]:
    """
    Devuelve los documentos de una licitación: [{titulo, tipo, url, fecha, formato}].
    Lanza OCDSError si no se puede consultar la API OCDS.
    """
    url = f"{OCDS_BASE}/tender/{codigo}"
    try:
        resp = requests.get(url, timeout=timeout,
                            headers={"User-Agent": "claude-eds-mp/0.1"})
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        raise OCDSError(f"No se pudo consultar la API OCDS: {exc}") from exc

    crudos: list[dict[str, Any]] = []
    _recolectar_documentos(data, crudos)

    # Normalizar y deduplicar por URL.
    vistos: set[str] = set()
    docs: list[dict[str, Any]] = []
    for d in crudos:
        u = d.get("url")
        if not u or u in vistos:
            continue
        vistos.add(u)
        tipo = d.get("documentType") or ""
        docs.append({
            "titulo": d.get("title") or TIPO_DOC.get(tipo, tipo or "Documento"),
            "tipo": TIPO_DOC.get(tipo, tipo or "—"),
            "url": u,
            "fecha": (d.get("datePublished") or "").replace("T", " "),
            "formato": d.get("format") or "",
        })
    return docs
