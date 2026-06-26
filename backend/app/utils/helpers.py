"""
工具函数
"""
from datetime import datetime, timezone


def utc_now() -> datetime:
    """获取当前 UTC 时间"""
    return datetime.now(timezone.utc)


def format_remaining(seconds: int) -> str:
    """
    将剩余秒数格式化为可读字符串
    例如: 289397 -> "3天 7小时 23分"
    """
    if seconds <= 0:
        return "已完成"

    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    minutes = (seconds % 3600) // 60

    parts = []
    if days > 0:
        parts.append(f"{days}天")
    if hours > 0:
        parts.append(f"{hours}小时")
    if minutes > 0:
        parts.append(f"{minutes}分")

    return " ".join(parts) if parts else "即将完成"


def format_finish_time(dt: datetime) -> str:
    """格式化完成时间为本地可读格式"""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # 转为东八区
    from datetime import timedelta
    cn_time = dt.astimezone(timezone(timedelta(hours=8)))
    return cn_time.strftime("%Y-%m-%d %H:%M")
