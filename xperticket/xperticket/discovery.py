"""
MÓDULO 1 — Prospecting & Discovery.

Identifica y normaliza prospectos (instituciones culturales / de entretenimiento
en Chile), los deduplica y valida que tengan contacto público.

Fuentes soportadas:
- Dataset semilla incluido (`seed.py`).
- Importación de tu propia lista CSV/JSON (100-200 instituciones).
"""

from __future__ import annotations

import csv
import io
import json
from typing import Any, Iterable

from . import storage
from .models import COLUMNAS_PROSPECTO, Prospecto, slugify
from .seed import prospectos_semilla
from .util import log

# Mapeo flexible de encabezados de CSV externos → campos de Prospecto.
_ALIAS = {
    "nombre": "nombre_institucion",
    "nombre_institucion": "nombre_institucion",
    "institucion": "nombre_institucion",
    "institución": "nombre_institucion",
    "tipo": "tipo",
    "segmento": "tipo",
    "categoria": "tipo",
    "categoría": "tipo",
    "region": "region",
    "región": "region",
    "ciudad": "ciudad",
    "comuna": "ciudad",
    "sitio_web": "sitio_web",
    "web": "sitio_web",
    "sitio": "sitio_web",
    "url": "sitio_web",
    "website": "sitio_web",
    "email": "email_publico",
    "email_publico": "email_publico",
    "correo": "email_publico",
    "mail": "email_publico",
    "telefono": "telefono",
    "teléfono": "telefono",
    "fono": "telefono",
    "phone": "telefono",
    "linkedin": "linkedin_url",
    "linkedin_url": "linkedin_url",
    "facebook": "facebook",
    "instagram": "instagram",
    "anio_fundacion": "anio_fundacion",
    "año_fundacion": "anio_fundacion",
    "año": "anio_fundacion",
    "fundacion": "anio_fundacion",
    "descripcion": "descripcion_breve",
    "descripción": "descripcion_breve",
    "descripcion_breve": "descripcion_breve",
    "ticketera": "ticketera_identificada",
    "ticketera_identificada": "ticketera_identificada",
}


def sembrar() -> int:
    """Carga el dataset semilla en la base (idempotente)."""
    n = storage.guardar_prospectos(prospectos_semilla())
    log(f"discovery.sembrar: {n} prospectos semilla cargados")
    return n


def _normalizar_fila(fila: dict[str, Any]) -> dict[str, Any]:
    norm: dict[str, Any] = {}
    for clave, valor in fila.items():
        if clave is None:
            continue
        campo = _ALIAS.get(str(clave).strip().lower())
        if campo and valor is not None:
            norm[campo] = str(valor).strip()
    return norm


def importar_filas(filas: Iterable[dict[str, Any]], fuente: str = "import") -> int:
    """Importa filas (dicts) ya leídas, con mapeo flexible de encabezados."""
    prospectos: list[Prospecto] = []
    for fila in filas:
        norm = _normalizar_fila(fila)
        if not norm.get("nombre_institucion"):
            continue
        norm.setdefault("fuente", fuente)
        prospectos.append(Prospecto.from_dict(norm))
    prospectos = deduplicar(prospectos)
    n = storage.guardar_prospectos(prospectos)
    log(f"discovery.importar: {n} prospectos importados desde {fuente}")
    return n


def importar_csv(path: str) -> int:
    """Importa prospectos desde un CSV (encabezados flexibles, ver _ALIAS)."""
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        return importar_filas(csv.DictReader(f), fuente=f"csv:{path}")


def importar_json(path: str) -> int:
    """Importa prospectos desde un JSON (lista de objetos)."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get("prospectos") or data.get("data") or [data]
    return importar_filas(data, fuente=f"json:{path}")


def deduplicar(prospectos: list[Prospecto]) -> list[Prospecto]:
    """Quita duplicados por id (slug del nombre), conservando el más completo."""
    por_id: dict[str, Prospecto] = {}
    for p in prospectos:
        pid = p.id or slugify(p.nombre_institucion)
        if pid not in por_id:
            por_id[pid] = p
        else:
            # Conserva el que tenga más campos rellenos.
            actual = por_id[pid]
            if _completitud(p) > _completitud(actual):
                por_id[pid] = p
    return list(por_id.values())


def _completitud(p: Prospecto) -> int:
    return sum(1 for v in p.to_dict().values() if v)


def validar() -> dict[str, int]:
    """
    Marca cada prospecto como 'prospectable' (tiene email o sitio web) o
    'incompleto'. Devuelve el conteo por estado.
    """
    prospectos = storage.cargar_prospectos()
    conteo = {"prospectable": 0, "incompleto": 0}
    for p in prospectos:
        p.estado_prospectable = (
            "prospectable" if (p.email_publico or p.sitio_web) else "incompleto"
        )
        conteo[p.estado_prospectable] += 1
    storage.guardar_prospectos(prospectos)
    log(f"discovery.validar: {conteo}")
    return conteo


def listar(
    tipo: str | None = None,
    region: str | None = None,
    estado: str | None = None,
) -> list[Prospecto]:
    """Lista prospectos con filtros básicos."""
    prospectos = storage.cargar_prospectos()
    if tipo:
        prospectos = [p for p in prospectos if p.tipo == tipo]
    if region:
        prospectos = [p for p in prospectos if p.region == region]
    if estado:
        prospectos = [p for p in prospectos if p.estado_prospectable == estado]
    return prospectos


def plantilla_csv() -> str:
    """Devuelve una plantilla CSV con los encabezados esperados (para tu lista)."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([c for c in COLUMNAS_PROSPECTO if c != "id"])
    writer.writerow(
        [
            "Teatro Municipal Ejemplo", "Teatro", "Metropolitana", "Santiago",
            "https://ejemplo.cl", "contacto@ejemplo.cl", "+56 2 1234 5678",
            "", "", "", "1990", "Teatro municipal con temporada anual.",
            "", "prospectable", "manual",
        ]
    )
    return buffer.getvalue()
