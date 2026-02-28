import asyncio
import asyncpg

async def test_postgresql_connection(host, port, user, password, database):
    try:
        conn = await asyncio.wait_for(
            asyncpg.connect(
                user=user,
                password=password,
                database=database,
                host=host,
                port=port
            ),
            timeout=5.0
        )
        await conn.close()
        return True, "Connection successful"
    except Exception as e:
        return False, str(e)
