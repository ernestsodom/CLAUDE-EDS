"""Cliente reutilizable para Supabase.

Uso:
    from supabase_client import get_supabase_client

    client = get_supabase_client()
    data = client.table('usuarios').select('*').execute()
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


def get_supabase_client() -> Client:
    """Obtiene una instancia del cliente de Supabase.

    Returns:
        Client: Cliente autenticado de Supabase

    Raises:
        ValueError: Si faltan las credenciales de Supabase
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "Faltan credenciales de Supabase. "
            "Asegúrate de que SUPABASE_URL y SUPABASE_KEY están en .env"
        )

    return create_client(SUPABASE_URL, SUPABASE_KEY)


# Ejemplos de uso
if __name__ == "__main__":
    client = get_supabase_client()

    # Ejemplo 1: Consultar datos
    print("📊 Listando tablas disponibles...")
    try:
        # Intenta una consulta simple
        response = client.table('info').select('*').limit(1).execute()
        print(f"✅ Conexión exitosa a Supabase")
        print(f"Datos: {response.data}")
    except Exception as e:
        print(f"⚠️ Nota: {e}")
        print("(Es normal si aún no tienes tablas creadas)")

    print("\n💡 Próximos pasos:")
    print("1. Crea tablas en el dashboard de Supabase")
    print("2. Usa este cliente para insertar/actualizar datos")
    print("3. Migra datos de SQLite si es necesario")
