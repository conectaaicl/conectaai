from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ===============================
    # CORE / DATABASE
    # ===============================
    DATABASE_URL: str

    # ===============================
    # AUTH / JWT
    # ===============================
    JWT_SECRET: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ===============================
    # GOOGLE CALENDAR
    # ===============================
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    GOOGLE_REDIRECT_URI: str | None = None

    # ===============================
    # WHATSAPP CLOUD API
    # ===============================
    WHATSAPP_TOKEN: str | None = None
    WHATSAPP_PHONE_ID: str | None = None
    WHATSAPP_VERIFY_TOKEN: str | None = None

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
