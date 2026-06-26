"""
Pydantic 请求/响应 模型
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UploadJsonRequest(BaseModel):
    """上传 JSON 请求"""
    json_data: str = Field(..., description="CoC 导出的 JSON 字符串")
    wspusher_uid: str = Field(..., description="用户的 WsPusher UID")
    player_tag: Optional[str] = Field(None, description="玩家标签 (可选)")
    player_name: Optional[str] = Field(None, description="玩家名称 (可选)")


class UpgradeResponse(BaseModel):
    """单个升级项响应"""
    id: int
    category: str
    item_name: str
    item_level: int
    timer_seconds: Optional[int] = None
    finish_time: datetime
    notified: bool
    data_id: Optional[int] = None

    class Config:
        from_attributes = True


class PlayerInfoResponse(BaseModel):
    """玩家信息响应"""
    player_tag: str
    player_name: str
    town_hall_level: Optional[int] = None
    builder_count: Optional[int] = None
    active_upgrades: int = 0


class UploadJsonResponse(BaseModel):
    """上传 JSON 响应"""
    success: bool
    user_id: int
    village_id: int
    upgrades: list[UpgradeResponse]
    idle_times: dict
    player_info: Optional[PlayerInfoResponse] = None


class UpgradesListResponse(BaseModel):
    """升级列表响应"""
    success: bool
    user_id: int
    upgrades: list[UpgradeResponse]
    idle_times: dict
    player_info: Optional[PlayerInfoResponse] = None
    last_upload_at: Optional[str] = None


class ManualRefreshResponse(BaseModel):
    """手动刷新响应"""
    success: bool
    message: str
    notified_count: int = 0
