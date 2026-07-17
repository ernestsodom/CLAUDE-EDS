"""Almacenamiento local en SQLite de los negocios/leads del panel comercial."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any

from .config import DB_PATH
from .models import Negocio

_CAMPOS_NEGOCIO = [
    "id", "cliente", "negocio", "contacto", "email", "telefono",
    "valor_estimado", "moneda", "etapa", "probabilidad", "fuente",
    "fecha_cierre_estimada", "proxima_accion", "fecha_proxima_accion", "notas",
]


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    """Crea las tablas si no existen."""
    with _conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS negocios (
                id TEXT PRIMARY KEY,
                cliente TEXT,
                negocio TEXT,
                contacto TEXT,
                email TEXT,
                telefono TEXT,
                valor_estimado REAL,
                moneda TEXT,
                etapa TEXT,
                probabilidad INTEGER,
                fuente TEXT,
                fecha_cierre_estimada TEXT,
                proxima_accion TEXT,
                fecha_proxima_accion TEXT,
                notas TEXT,
                creado_en TEXT,
                actualizado_en TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_neg_etapa ON negocios(etapa);
            CREATE INDEX IF NOT EXISTS idx_neg_cliente ON negocios(cliente);
            """
        )


def guardar_negocio(negocio: Negocio) -> None:
    """Inserta o actualiza un negocio. Conserva creado_en si ya existía."""
    init_db()
    existente = obtener_negocio(negocio.id)
    ahora = _ahora()
    creado = existente["creado_en"] if existente else ahora
    d = negocio.to_dict()
    valores = [d.get(c) for c in _CAMPOS_NEGOCIO] + [creado, ahora]
    placeholders = ",".join("?" for _ in _CAMPOS_NEGOCIO) + ",?,?"
    with _conn() as conn:
        conn.execute(
            f"""
            INSERT INTO negocios ({','.join(_CAMPOS_NEGOCIO)}, creado_en, actualizado_en)
            VALUES ({placeholders})
            ON CONFLICT(id) DO UPDATE SET
                {', '.join(f'{c}=excluded.{c}' for c in _CAMPOS_NEGOCIO if c != 'id')},
                actualizado_en=excluded.actualizado_en
            """,
            valores,
        )


def eliminar_negocio(negocio_id: str) -> None:
    init_db()
    with _conn() as conn:
        conn.execute("DELETE FROM negocios WHERE id = ?", (negocio_id,))


def obtener_negocio(negocio_id: str) -> dict[str, Any] | None:
    init_db()
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM negocios WHERE id = ?", (negocio_id,)
        ).fetchone()
    return dict(row) if row else None


def cargar_negocios() -> list[dict[str, Any]]:
    init_db()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM negocios ORDER BY actualizado_en DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def contar_negocios() -> int:
    init_db()
    with _conn() as conn:
        return conn.execute("SELECT COUNT(*) AS n FROM negocios").fetchone()["n"]
