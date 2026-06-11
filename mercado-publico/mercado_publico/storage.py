"""Caché local en SQLite de licitaciones normalizadas y preferencias del usuario."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Any, Iterable

from .config import DB_PATH


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Crea las tablas si no existen."""
    with _conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS licitaciones (
                codigo TEXT PRIMARY KEY,
                nombre TEXT,
                descripcion TEXT,
                estado TEXT,
                codigo_estado INTEGER,
                tipo TEXT,
                moneda TEXT,
                monto_estimado REAL,
                comprador TEXT,
                es_municipalidad INTEGER,
                unidad_compra TEXT,
                rut_comprador TEXT,
                region TEXT,
                comuna TEXT,
                fecha_publicacion TEXT,
                fecha_cierre TEXT,
                fecha_adjudicacion TEXT,
                fecha_termino_contrato TEXT,
                n_oferentes INTEGER,
                monto_adjudicado REAL,
                proveedor_adjudicado TEXT,
                rut_adjudicado TEXT,
                proveedores_adjudicados TEXT,
                competidor TEXT,
                ganada_proexsi INTEGER,
                rubros TEXT,
                rubros_nombres TEXT,
                n_items INTEGER,
                actualizado_en TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_lic_estado ON licitaciones(estado);
            CREATE INDEX IF NOT EXISTS idx_lic_region ON licitaciones(region);
            CREATE INDEX IF NOT EXISTS idx_lic_comprador ON licitaciones(comprador);
            CREATE INDEX IF NOT EXISTS idx_lic_muni ON licitaciones(es_municipalidad);
            CREATE INDEX IF NOT EXISTS idx_lic_competidor ON licitaciones(competidor);

            CREATE TABLE IF NOT EXISTS preferencias (
                clave TEXT PRIMARY KEY,
                valor TEXT
            );
            """
        )


def guardar_licitaciones(registros: Iterable[dict[str, Any]]) -> int:
    """Inserta o reemplaza registros normalizados de licitaciones."""
    init_db()
    columnas = [
        "codigo", "nombre", "descripcion", "estado", "codigo_estado", "tipo",
        "moneda", "monto_estimado", "comprador", "es_municipalidad",
        "unidad_compra", "rut_comprador", "region", "comuna", "fecha_publicacion",
        "fecha_cierre", "fecha_adjudicacion", "fecha_termino_contrato",
        "n_oferentes", "monto_adjudicado", "proveedor_adjudicado", "rut_adjudicado",
        "proveedores_adjudicados", "competidor", "ganada_proexsi", "rubros",
        "rubros_nombres", "n_items", "actualizado_en",
    ]
    placeholders = ",".join("?" for _ in columnas)
    ahora = datetime.utcnow().isoformat()

    filas = []
    for r in registros:
        if not r.get("codigo"):
            continue
        r = {**r, "actualizado_en": ahora}
        filas.append(tuple(r.get(c) for c in columnas))

    if not filas:
        return 0

    with _conn() as conn:
        conn.executemany(
            f"INSERT OR REPLACE INTO licitaciones ({','.join(columnas)}) "
            f"VALUES ({placeholders})",
            filas,
        )
    return len(filas)


def cargar_licitaciones() -> list[dict[str, Any]]:
    """Devuelve todas las licitaciones cacheadas como diccionarios."""
    init_db()
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM licitaciones").fetchall()
    return [dict(r) for r in rows]


def codigos_cacheados() -> set[str]:
    init_db()
    with _conn() as conn:
        rows = conn.execute("SELECT codigo FROM licitaciones").fetchall()
    return {r["codigo"] for r in rows}


def contar() -> int:
    init_db()
    with _conn() as conn:
        return conn.execute("SELECT COUNT(*) AS n FROM licitaciones").fetchone()["n"]


# ---------------------------------------------------------------------- #
# Preferencias del usuario (ticket, filtros guardados, etc.)
# ---------------------------------------------------------------------- #
def set_pref(clave: str, valor: Any) -> None:
    init_db()
    with _conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO preferencias (clave, valor) VALUES (?, ?)",
            (clave, json.dumps(valor)),
        )


def get_pref(clave: str, default: Any = None) -> Any:
    init_db()
    with _conn() as conn:
        row = conn.execute(
            "SELECT valor FROM preferencias WHERE clave = ?", (clave,)
        ).fetchone()
    return json.loads(row["valor"]) if row else default
