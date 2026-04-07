import asyncio
from telova_api.db import get_session
from telova_api.config import get_settings
from telova_api.main import get_orchestrator

async def test():
    db = await anext(get_session())
    orchestrator = await anext(get_orchestrator(get_settings(), db))
    res = await orchestrator.get_dashboard("demo-user")
    print(res)

asyncio.run(test())
