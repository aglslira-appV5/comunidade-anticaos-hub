from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.neuro_sinapses import NeuroSinapse
from src.services.neuro.aulas import OBRIGATORIAS_POR_KIT


async def sinapses_faltantes(db: AsyncSession, user_id: int, kit: str) -> list[int]:
    """
    Devolve, na ordem de OBRIGATORIAS_POR_KIT[kit], as aulas que ainda não possuem sinapse acesa.
    Se o kit não tiver lista de obrigatórias cadastrada, devolve [].
    """
    kit_norm = kit.lower().strip()
    obrigatorias = OBRIGATORIAS_POR_KIT.get(kit_norm)
    if not obrigatorias:
        return []

    stmt = select(NeuroSinapse.aula).where(
        NeuroSinapse.user_id == user_id,
        NeuroSinapse.aula.in_(obrigatorias),
    )
    res = await db.execute(stmt)
    acesas = set(res.scalars().all())

    return [aula for aula in obrigatorias if aula not in acesas]
