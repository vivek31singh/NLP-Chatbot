from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.api import chat, analytics, admin
from app.rasa_client import rasa_client


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="NLP-Powered Customer Support Chatbot API",
        version="1.0.0",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(chat.router)
    app.include_router(analytics.router)
    app.include_router(admin.router)

    @app.on_event("startup")
    async def startup():
        init_db()

    @app.on_event("shutdown")
    async def shutdown():
        await rasa_client.close()

    @app.get("/health")
    async def health_check():
        rasa_ok = await rasa_client.health_check()
        return {
            "status": "healthy" if rasa_ok else "degraded",
            "rasa_connected": rasa_ok,
        }

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
