import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import init_db
from app.api import chat, analytics, admin, handoff, websocket
from app.rasa_client import rasa_client

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESULTS_DIR = os.path.join(PROJECT_DIR, "results")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="NLP-Powered Customer Support Chatbot API",
        version="1.0.0",
    )

    # Serve evaluation results (confusion matrix images, reports)
    os.makedirs(RESULTS_DIR, exist_ok=True)
    app.mount("/results", StaticFiles(directory=RESULTS_DIR), name="results")

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
    app.include_router(handoff.router)
    app.include_router(websocket.router)

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
