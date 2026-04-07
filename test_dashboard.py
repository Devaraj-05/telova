import asyncio
from telova_api.db import get_session
from telova_api.main import build_orchestrator

async def test():
    try:
        db_gen = get_session()
        db = await anext(db_gen)
        orchestrator = build_orchestrator(db)
        res = await orchestrator.get_dashboard("demo-user")
        print(res)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(test())
