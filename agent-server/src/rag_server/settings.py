import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RAG_", extra="ignore")

    host: str = "127.0.0.1"
    port: int = 8001
    reload: bool = True
    max_upload_bytes: int = 8 * 1024 * 1024

    # 文件加载apikey
    mineru_api_key: str = os.getenv("MINERU_API_KEY")
    # 阿里千问apikey
    dashscope_api_key: str = os.getenv("DASHSCOPE_API_KEY")
    dashscope_base_url: str = os.getenv("DASHSCOPE_BASE_URL")
    # deepseek apikey
    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY")
    deepseek_base_url: str = os.getenv("DEEPSEEK_BASE_URL")



settings = Settings()
