"""
API 路由
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.base import get_db
from app.models.models import User, Village, Upgrade
from app.parser.coc_parser import (
    parse_coc_json,
    extract_player_info,
    calculate_idle_times,
    UpgradeItem as ParserUpgradeItem,
)
from app.routes.schemas import (
    UploadJsonRequest,
    UploadJsonResponse,
    UpgradeResponse,
    UpgradesListResponse,
    ManualRefreshResponse,
    PlayerInfoResponse,
)
from app.services.wspusher import WsPusherService

router = APIRouter(prefix="/api", tags=["coc-reminder"])


@router.post("/upload-json", response_model=UploadJsonResponse)
def upload_json(req: UploadJsonRequest, db: Session = Depends(get_db)):
    """上传 CoC JSON 数据"""
    # 1. 查找或创建用户
    user = db.query(User).filter(User.wspusher_uid == req.wspusher_uid).first()
    if not user:
        user = User(
            player_tag=req.player_tag or None,
            player_name=req.player_name or None,
            wspusher_uid=req.wspusher_uid,
        )
        db.add(user)
        db.flush()
    else:
        if req.player_tag:
            user.player_tag = req.player_tag
        if req.player_name:
            user.player_name = req.player_name

    # 2. 从 JSON 提取玩家信息
    player_info = extract_player_info(req.json_data)
    if not user.player_tag and player_info.get("player_tag"):
        user.player_tag = player_info["player_tag"]
    if not user.player_name and player_info.get("player_name"):
        user.player_name = player_info["player_name"]

    # 3. 保存原始 JSON 快照
    village = Village(user_id=user.id, raw_json=req.json_data)
    db.add(village)

    # 4. 删除旧未通知升级项 (新上传覆盖)
    db.query(Upgrade).filter(
        Upgrade.user_id == user.id, Upgrade.notified == False
    ).delete(synchronize_session=False)

    # 5. 解析 JSON
    try:
        upgrade_items = parse_coc_json(req.json_data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"JSON 解析失败: {e}")

    # 6. 保存升级项目
    new_upgrades: list[Upgrade] = []
    for item in upgrade_items:
        u = Upgrade(
            user_id=user.id,
            category=item.category,
            item_name=item.item_name,
            item_level=item.item_level,
            timer_seconds=item.timer_seconds,
            finish_time=item.finish_time,
            notified=False,
        )
        db.add(u)
        new_upgrades.append(u)

    db.commit()
    db.refresh(user)
    db.refresh(village)
    for u in new_upgrades:
        db.refresh(u)

    # 7. 计算空闲时间
    idle_times = calculate_idle_times(upgrade_items)

    # 8. 构造返回
    player_resp = PlayerInfoResponse(
        player_tag=user.player_tag or "",
        player_name=user.player_name or "",
        town_hall_level=player_info.get("town_hall_level"),
        builder_count=player_info.get("builder_count"),
        active_upgrades=len(new_upgrades),
    )

    return UploadJsonResponse(
        success=True,
        user_id=user.id,
        village_id=village.id,
        upgrades=[UpgradeResponse.model_validate(u) for u in new_upgrades],
        idle_times=idle_times,
        player_info=player_resp,
    )


@router.get("/upgrades", response_model=UpgradesListResponse)
def get_upgrades(wspusher_uid: str, db: Session = Depends(get_db)):
    """获取升级列表 (带玩家信息)"""
    user = db.query(User).filter(User.wspusher_uid == wspusher_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在, 请先上传 JSON")

    upgrades = (
        db.query(Upgrade)
        .filter(Upgrade.user_id == user.id)
        .order_by(Upgrade.finish_time.asc())
        .all()
    )

    # 空闲时间
    from app.parser.coc_parser import UpgradeItem as ParserUpgradeItem
    items_for_idle = [
        ParserUpgradeItem(
            category=u.category,
            item_name=u.item_name,
            item_level=u.item_level,
            timer_seconds=int((u.finish_time - datetime.now(timezone.utc)).total_seconds()),
            finish_time=u.finish_time,
        )
        for u in upgrades
    ]
    idle_times = calculate_idle_times(items_for_idle)

    # 玩家信息 + 最后上传时间
    last_village = (
        db.query(Village)
        .filter(Village.user_id == user.id)
        .order_by(Village.uploaded_at.desc())
        .first()
    )

    return UpgradesListResponse(
        success=True,
        user_id=user.id,
        upgrades=[UpgradeResponse.model_validate(u) for u in upgrades],
        idle_times=idle_times,
        player_info=PlayerInfoResponse(
            player_tag=user.player_tag or "",
            player_name=user.player_name or "",
            active_upgrades=len(upgrades),
        ),
        last_upload_at=last_village.uploaded_at.isoformat() if last_village else None,
    )


@router.post("/manual-refresh", response_model=ManualRefreshResponse)
def manual_refresh(wspusher_uid: str, db: Session = Depends(get_db)):
    """手动触发通知检测"""
    user = db.query(User).filter(User.wspusher_uid == wspusher_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    now = datetime.now(timezone.utc)
    due = (
        db.query(Upgrade)
        .filter(
            Upgrade.user_id == user.id,
            Upgrade.notified == False,
            Upgrade.finish_time <= now,
        )
        .all()
    )

    pusher = WsPusherService()
    notified = 0
    for upg in due:
        msg = (
            f"【部落冲突升级提醒】\n"
            f"{upg.item_name} Lv{upg.item_level} 已升级完成！"
        )
        ok = pusher.send(user.wspusher_uid, msg)
        if ok:
            upg.notified = True
            notified += 1

    db.commit()

    return ManualRefreshResponse(
        success=True,
        message=f"检测完成, 已通知 {notified} 项",
        notified_count=notified,
    )
