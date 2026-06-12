"""Almacenamiento local en SQLite: prospectos, análisis y preferencias."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Iterable

from .config import DB_PATH
from .models import Prospecto

_CAMPOS_PROSPECTO = [
    "id", "nombre_institucion", "tipo", "region", "ciudad", "sitio_web",
    "email_publico", "telefono", "linkedin_url", "facebook", "instagram",
    "anio_fundacion", "descripcion_breve", "ticketera_identificada",
    "estado_prospectable", "fuente",
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
            CREATE TABLE IF NOT EXISTS prospectos (
                id TEXT PRIMARY KEY,
                nombre_institucion TEXT,
                tipo TEXT,
                region TEXT,
                ciudad TEXT,
                sitio_web TEXT,
                email_publico TEXT,
                telefono TEXT,
                linkedin_url TEXT,
                facebook TEXT,
                instagram TEXT,
                anio_fundacion TEXT,
                descripcion_breve TEXT,
                ticketera_identificada TEXT,
                estado_prospectable TEXT,
                fuente TEXT,
                creado_en TEXT,
                actualizado_en TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_prosp_tipo ON prospectos(tipo);
            CREATE INDEX IF NOT EXISTS idx_prosp_region ON prospectos(region);

            CREATE TABLE IF NOT EXISTS analisis (
                prospecto_id TEXT PRIMARY KEY,
                ticketera TEXT,
                eventos_mes REAL,
                volumen_anual REAL,
                comision_actual REAL,
                ahorro_uf REAL,
                roi_usd REAL,
                score INTEGER,
                prioridad INTEGER,
                payload TEXT,
                actualizado_en TEXT,
                FOREIGN KEY (prospecto_id) REFERENCES prospectos(id)
            );

            CREATE INDEX IF NOT EXISTS idx_analisis_score ON analisis(score);

            CREATE TABLE IF NOT EXISTS preferencias (
                clave TEXT PRIMARY KEY,
                valor TEXT
            );
            """
        )


# --------------------------------------------------------------------------- #
# Prospectos
# --------------------------------------------------------------------------- #
def guardar_prospectos(prospectos: Iterable[Prospecto]) -> int:
    """Inserta o actualiza prospectos. Conserva creado_en si ya existían."""
    init_db()
    ahora = _ahora()
    existentes = ids_existentes()
    placeholders = ",".join("?" for _ in _CAMPOS_PROSPECTO) + ",?,?"
    filas = []
    for p in prospectos:
        d = p.to_dict()
        creado = ahora if p.id not in existentes else None
        valores = [d.get(c) for c in _CAMPOS_PROSPECTO]
        filas.append(tuple(valores) + (creado, ahora))

    if not filas:
        return 0

    with _conn() as conn:
        # COALESCE conserva creado_en previo si la fila ya existía.
        conn.executemany(
            f"""
            INSERT INTO prospectos ({','.join(_CAMPOS_PROSPECTO)}, creado_en, actualizado_en)
            VALUES ({placeholders})
            ON CONFLICT(id) DO UPDATE SET
                {', '.join(f'{c}=excluded.{c}' for c in _CAMPOS_PROSPECTO if c != 'id')},
                actualizado_en=excluded.actualizado_en
            """,
            filas,
        )
    return len(filas)


def cargar_prospectos() -> list[Prospecto]:
    init_db()
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM prospectos ORDER BY nombre_institucion").fetchall()
    return [Prospecto.from_dict(dict(r)) for r in rows]


def obtener_prospecto(prospecto_id: str) -> Prospecto | None:
    init_db()
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM prospectos WHERE id = ?", (prospecto_id,)
        ).fetchone()
    return Prospecto.from_dict(dict(row)) if row else None


def ids_existentes() -> set[str]:
    init_db()
    with _conn() as conn:
        rows = conn.execute("SELECT id FROM prospectos").fetchall()
    return {r["id"] for r in rows}


def contar_prospectos() -> int:
    init_db()
    with _conn() as conn:
        return conn.execute("SELECT COUNT(*) AS n FROM prospectos").fetchone()["n"]


# --------------------------------------------------------------------------- #
# Análisis (resultado del pipeline: módulos 2-5)
# --------------------------------------------------------------------------- #
def guardar_analisis(prospecto_id: str, payload: dict[str, Any]) -> None:
    """Guarda el análisis completo (JSON) y desnormaliza métricas clave."""
    init_db()
    fin = payload.get("finanzas", {})
    web = payload.get("web_intel", {})
    contacto = payload.get("contacto", {})
    with _conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO analisis (
                prospecto_id, ticketera, eventos_mes, volumen_anual,
                comision_actual, ahorro_uf, roi_usd, score, prioridad,
                payload, actualizado_en
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                prospecto_id,
                web.get("ticketera_actual"),
                web.get("eventos_mes_estimado"),
                fin.get("volumen_estimado_anual"),
                fin.get("comision_actual_pct"),
                fin.get("ahorro_comisiones_anual_uf"),
                fin.get("roi_estimado_anual_usd"),
                contacto.get("score"),
                contacto.get("prioridad"),
                json.dumps(payload, ensure_ascii=False),
                _ahora(),
            ),
        )


def obtener_analisis(prospecto_id: str) -> dict[str, Any] | None:
    init_db()
    with _conn() as conn:
        row = conn.execute(
            "SELECT payload, actualizado_en FROM analisis WHERE prospecto_id = ?",
            (prospecto_id,),
        ).fetchone()
    if not row:
        return None
    data = json.loads(row["payload"])
    data["_actualizado_en"] = row["actualizado_en"]
    return data


def cargar_analisis() -> list[dict[str, Any]]:
    """Todos los análisis (payload completo) como lista de dicts."""
    init_db()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT prospecto_id, payload, actualizado_en FROM analisis"
        ).fetchall()
    out = []
    for r in rows:
        d = json.loads(r["payload"])
        d["_actualizado_en"] = r["actualizado_en"]
        out.append(d)
    return out


def contar_analisis() -> int:
    init_db()
    with _conn() as conn:
        return conn.execute("SELECT COUNT(*) AS n FROM analisis").fetchone()["n"]


# --------------------------------------------------------------------------- #
# Preferencias
# --------------------------------------------------------------------------- #
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
