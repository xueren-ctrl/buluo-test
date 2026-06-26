"""
APScheduler 定时任务
=====================

每分钟检测到期的升级项, 通过 WsPusher 发送通知, 发送后标记 notified=True
"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings
from app.database.base import SessionLocal
from app.models.models import Upgrade, User
from app.services.wspusher import WsPusherService

logger = logging.getLogger(__name__)

# 全局调度器实例
_scheduler: BackgroundScheduler | None = None


def check_and_notify():
    """
    定时任务核心:
      1. 查询所有 finish_time <= now AND notified = False 的升级项
      2. 对每项通过 WsPusher 发送通知
      3. 成功后标记 notified = True
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        due_upgrades = (
            db.query(Upgrade)
            .filter(Upgrade.notified == False, Upgrade.finish_time <= now)
            .all()
        )

        if not due_upgrades:
            return

        logger.info(f"发现 {len(due_upgrades)} 项到期升级, 开始发送通知...")

        pusher = WsPusherService()
        notified_count = 0

        for upg in due_upgrades:
            user = db.query(User).filter(User.id == upg.user_id).first()
            if not user or not user.wspusher_uid:
                logger.warning(
                    f"升级项 {upg.id} 无对应用户/UID, 跳过 (user_id={upg.user_id})"
                )
                continue

            # 分类中文名
            category_cn = {
                "buildings": "建筑",
                "spells": "法术",
                "heroes": "英雄",
                "pets": "宠物",
                "equipment": "装备",
                "helpers": "助力",
                "units": "兵种",
                "buildings2": "建设者基地建筑",
                "heroes2": "建设者基地英雄",
                "units2": "建设者基地兵种",
                "siege_machines": "攻城训练营",
                "traps": "陷阱",
                "traps2": "建设者基地陷阱",
            }.get(upg.category, upg.category)

            message = (
                f"【部落冲突升级提醒】\n"
                f"━━━━━━━━━━━━━\n"
                f"{category_cn}: {upg.item_name}\n"
                f"等级: Lv{upg.item_level}\n"
                f"状态: ✅ 升级已完成！\n"
                f"━━━━━━━━━━━━━\n"
                f"快上线验收吧 🏰"
            )

            ok = pusher.send(user.wspusher_uid, message)
            if ok:
                upg.notified = True
                notified_count += 1
                logger.info(
                    f"通知成功: {upg.item_name} Lv{upg.item_level} -> uid={user.wspusher_uid}"
                )
            else:
                logger.error(
                    f"通知失败: {upg.item_name} Lv{upg.item_level} -> uid={user.wspusher_uid}"
                )

        db.commit()
        logger.info(f"本轮通知完成, 成功 {notified_count}/{len(due_upgrades)}")

    except Exception as e:
        logger.error(f"定时任务异常: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """启动后台调度器"""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    _scheduler = BackgroundScheduler(timezone=settings.TZ)

    _scheduler.add_job(
        check_and_notify,
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_INTERVAL_SECONDS),
        id="check_and_notify",
        name="检测到期升级并发送通知",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info(
        f"调度器已启动, 间隔 {settings.SCHEDULER_INTERVAL_SECONDS}s, 时区={settings.TZ}"
    )
    return _scheduler


def stop_scheduler():
    """停止调度器"""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("调度器已停止")
