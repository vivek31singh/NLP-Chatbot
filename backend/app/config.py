import os


class Settings:
    app_name: str = "NLP Chatbot API"
    debug: bool = True
    database_url: str = os.environ.get("DATABASE_URL", "sqlite:///./chatbot.db")
    rasa_url: str = os.environ.get("RASA_URL", "http://localhost:5005")
    rasa_action_url: str = os.environ.get("RASA_ACTION_URL", "http://localhost:5055")
    jwt_secret_key: str = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    cors_origins: list = ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"]


settings = Settings()
