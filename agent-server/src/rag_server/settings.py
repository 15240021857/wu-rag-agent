from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RAG_", extra="ignore")

    host: str = "127.0.0.1"
    port: int = 8001
    reload: bool = True
    max_upload_bytes: int = 8 * 1024 * 1024


settings = Settings()
