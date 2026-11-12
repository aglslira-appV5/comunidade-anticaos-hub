from fastapi import HTTPException
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession


async def check_database_health(db_session: AsyncSession) -> bool:
    # A Result object is always truthy, so the previous `if not result` was dead
    # code and an actual DB outage raised an uncaught exception (500) instead of
    # being reported as unhealthy. Materialize the scalar and fail closed.
    try:
        result = await db_session.execute(text("SELECT 1"))
        value = result.scalar()
    except Exception:
        return False

    return value == 1


def check_redis_health() -> bool:
    try:
        from src.core.redis import get_redis_client
        client = get_redis_client()
        if client is None:
            # If Redis connection string is configured in LH_CONFIG, None means failure to connect/build pool
            from config.config import get_learnhouse_config
            conn_string = get_learnhouse_config().redis_config.redis_connection_string
            if conn_string:
                return False
            return True
        return bool(client.ping())
    except Exception:
        return False


async def check_health(db_session: AsyncSession) -> bool:
    # Check database health
    database_healthy = await check_database_health(db_session)
    if not database_healthy:
        raise HTTPException(status_code=503, detail="Database is not healthy")

    # Check redis health
    redis_healthy = check_redis_health()
    if not redis_healthy:
        raise HTTPException(status_code=503, detail="Redis is not healthy")

    return True
