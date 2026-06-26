"""
配置管理模块
从环境变量 / .env 文件读取配置
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# 加载 .env
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings(BaseSettings):
    """全局配置"""

    # 数据库
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./coc_reminder.db")

    # WxPusher (文档: https://wxpusher.zjiecode.com/docs/)
    WSPUSHER_API_URL: str = os.getenv(
        "WSPUSHER_API_URL",
        "https://wxpusher.zjiecode.com/api/send/message",
    )
    # 从 WxPusher 管理后台获取的 appToken
    WSPUSHER_APP_TOKEN: str = os.getenv("WSPUSHER_APP_TOKEN", "")

    # CORS
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,https://coc-reminder.vercel.app",
    )

    # 调度器
    SCHEDULER_INTERVAL_SECONDS: int = int(
        os.getenv("SCHEDULER_INTERVAL_SECONDS", "60")
    )

    # 时区
    TZ: str = os.getenv("TZ", "Asia/Shanghai")

    @property
    def cors_list(self) -> list[str]:
        """CORS 列表"""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        """是否 SQLite"""
        return self.DATABASE_URL.startswith("sqlite")

    class Config:
        env_file = ".env"


settings = Settings()
