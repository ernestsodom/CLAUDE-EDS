"""Cliente reutilizable para Supabase usando requests.

Uso:
    from supabase_client import SupabaseClient

    client = SupabaseClient()
    data = client.select('usuarios')
    client.insert('usuarios', {'nombre': 'Juan', 'email': 'juan@example.com'})
"""

import os
import json
import requests
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")


class SupabaseClient:
    """Cliente simple de Supabase usando REST API."""

    def __init__(self, url: Optional[str] = None, key: Optional[str] = None):
        """Inicializa el cliente de Supabase.

        Args:
            url: URL del proyecto Supabase (usa SUPABASE_URL por defecto)
            key: Clave API de Supabase (usa SUPABASE_KEY por defecto)

        Raises:
            ValueError: Si faltan las credenciales
        """
        self.url = url or SUPABASE_URL
        self.key = key or SUPABASE_KEY

        if not self.url or not self.key:
            raise ValueError(
                "Faltan credenciales de Supabase. "
                "Asegúrate de que SUPABASE_URL y SUPABASE_KEY están en .env"
            )

        self.base_url = f"{self.url}/rest/v1"
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    def select(
        self,
        table: str,
        columns: str = "*",
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
    ) -> List[Dict]:
        """Selecciona datos de una tabla.

        Args:
            table: Nombre de la tabla
            columns: Columnas a seleccionar (default: "*")
            filters: Diccionario de filtros (ej: {'id': 1})
            limit: Límite de resultados (default: 100)

        Returns:
            Lista de diccionarios con los datos
        """
        url = f"{self.base_url}/{table}?select={columns}&limit={limit}"

        if filters:
            for key, value in filters.items():
                url += f"&{key}=eq.{value}"

        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def insert(self, table: str, data: Dict[str, Any]) -> Dict:
        """Inserta un registro en una tabla.

        Args:
            table: Nombre de la tabla
            data: Diccionario con los datos a insertar

        Returns:
            Diccionario con los datos insertados
        """
        url = f"{self.base_url}/{table}"
        response = requests.post(url, json=data, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def update(self, table: str, data: Dict[str, Any], where: Dict[str, Any]) -> Dict:
        """Actualiza registros en una tabla.

        Args:
            table: Nombre de la tabla
            data: Diccionario con los datos a actualizar
            where: Condiciones de actualización (ej: {'id': 1})

        Returns:
            Diccionario con los datos actualizados
        """
        url = f"{self.base_url}/{table}"

        for key, value in where.items():
            url += f"?{key}=eq.{value}"

        response = requests.patch(url, json=data, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def delete(self, table: str, where: Dict[str, Any]) -> bool:
        """Elimina registros de una tabla.

        Args:
            table: Nombre de la tabla
            where: Condiciones de eliminación (ej: {'id': 1})

        Returns:
            True si la operación fue exitosa
        """
        url = f"{self.base_url}/{table}"

        for key, value in where.items():
            url += f"?{key}=eq.{value}"

        response = requests.delete(url, headers=self.headers)
        response.raise_for_status()
        return True


def get_supabase_client() -> SupabaseClient:
    """Obtiene una instancia del cliente de Supabase."""
    return SupabaseClient()


# Ejemplos de uso
if __name__ == "__main__":
    try:
        client = get_supabase_client()
        print("✅ Cliente de Supabase inicializado correctamente")
        print(f"🌐 URL: {client.url}")
        print("\n💡 Próximos pasos:")
        print("1. Crea tablas en el dashboard de Supabase")
        print("2. Usa este cliente para insertar/actualizar datos")
        print("3. Prueba con: python -c \"from supabase_client import get_supabase_client; c = get_supabase_client(); print(c.select('info'))\"")
    except ValueError as e:
        print(f"❌ Error: {e}")
