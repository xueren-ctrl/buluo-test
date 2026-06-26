"""
部落冲突升级提醒平台 - FastAPI 主入口
==========================================

启动方式:
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database.base import init_db
from app.routes.api import router
from app.scheduler.tasks import start_scheduler, stop_scheduler

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期: 启动 & 关闭"""
    # ---- 启动 ----
    logger.info("初始化数据库...")
    init_db()
    logger.info("数据库初始化完成")

    logger.info("启动定时调度器...")
    start_scheduler()

    yield

    # ---- 关闭 ----
    logger.info("关闭定时调度器...")
    stop_scheduler()


app = FastAPI(
    title="部落冲突升级提醒平台",
    description="上传 CoC JSON, 自动追踪升级进度, 到期推送通知",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由
app.include_router(router)


@app.get("/", tags=["health"])
def health_check():
    """健康检查"""
    return {"status": "ok", "service": "coc-upgrade-reminder"}
