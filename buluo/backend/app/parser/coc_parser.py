"""
CoC JSON 解析器
================

解析逻辑:
  - JSON 中每个对象如果有 "timer" 字段, 且值 > 0, 则说明正在升级
  - 对 helpers 类别, 使用 "helper_cooldown" 字段而非 "timer"
  - finish_time = 当前时间 + timer (秒)
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# ID 映射缓存: { "buildings": {"1000007": {...}}, "spells": {...}, ... }
_map_cache: dict[str, dict[str, dict]] | None = None
_MAP_PATH = Path(__file__).resolve().parent.parent / "assets" / "building_map.json"


def load_id_map() -> dict[str, dict[str, dict]]:
    """加载 ID 映射表 (带缓存), 返回按 category 分层的嵌套 dict"""
    global _map_cache
    if _map_cache is not None:
        return _map_cache

    with open(_MAP_PATH, "r", encoding="utf-8") as f:
        _map_cache = json.load(f)
    return _map_cache


def resolve_name(category: str, data_id: Any) -> str:
    """根据 category + data_id 查名称"""
    id_map = load_id_map()
    key = str(data_id)

    # 1. 精确 category 查找
    cat_map = id_map.get(category)
    if cat_map and key in cat_map:
        return cat_map[key].get("name", f"{data_id}")

    # 2. 跨 category 搜索 (equipment 特殊: 可能在不同 category 中同名)
    for cat, items in id_map.items():
        if key in items and cat != category:
            return items[key].get("name", f"{data_id}")

    return f"{data_id}"


class UpgradeItem:
    """解析后的单个升级项"""

    def __init__(
        self,
        category: str,
        item_name: str,
        item_level: int,
        timer_seconds: int,
        finish_time: datetime,
        data_id: int | None = None,
    ):
        self.category = category
        self.item_name = item_name
        self.item_level = item_level
        self.timer_seconds = timer_seconds
        self.finish_time = finish_time
        self.data_id = data_id


def _get_timer(item: dict) -> int | None:
    """从字典中获取有效的计时器值"""
    timer = item.get("timer")
    if timer is not None and isinstance(timer, (int, float)) and timer > 0:
        return int(timer)

    cooldown = item.get("helper_cooldown")
    if cooldown is not None and isinstance(cooldown, (int, float)) and cooldown > 0:
        return int(cooldown)

    return None


def _get_level(item: dict) -> int:
    """从字典中获取等级, 兼容 lvl / cnt / level 等字段名"""
    for field in ("lvl", "level"):
        val = item.get(field)
        if val is not None:
            try:
                return int(val)
            except (TypeError, ValueError):
                continue
    return 1


def _parse_category_with_timer(raw_list: list, category: str) -> list[UpgradeItem]:
    """解析使用 timer/helper_cooldown 字段的单个分类"""
    results: list[UpgradeItem] = []
    now = datetime.now(timezone.utc)

    for item in raw_list:
        if not isinstance(item, dict):
            continue

        timer = _get_timer(item)
        if timer is None:
            continue

        data_id = item.get("data")
        lvl = _get_level(item)
        name = resolve_name(category, data_id)
        finish = now + timedelta(seconds=timer)

        results.append(UpgradeItem(
            category=category,
            item_name=name,
            item_level=lvl,
            timer_seconds=timer,
            finish_time=finish,
            data_id=data_id,
        ))

    return results


def parse_coc_json(raw_json: str | dict) -> list[UpgradeItem]:
    """
    解析 CoC 导出的 JSON 字符串或已解析的 dict

    支持所有升级类别:
      - buildings / spells / heroes / pets / equipment / units / helpers
      - buildings2 / heroes2 / units2 / siege_machines
    """
    if isinstance(raw_json, str):
        data = json.loads(raw_json)
    else:
        data = raw_json

    all_upgrades: list[UpgradeItem] = []

    timer_categories = [
        "buildings", "spells", "heroes", "pets", "equipment", "units",
        "helpers",
        "buildings2", "heroes2", "units2", "siege_machines",
    ]
    for cat in timer_categories:
        sub = data.get(cat)
        if sub and isinstance(sub, list):
            all_upgrades.extend(_parse_category_with_timer(sub, cat))

    return all_upgrades


def extract_player_info(raw_json: str | dict) -> dict:
    """提取玩家信息"""
    if isinstance(raw_json, str):
        try:
            data = json.loads(raw_json)
        except Exception:
            return {}
    else:
        data = raw_json

    # 提取玩家标签/名称
    player_tag = data.get("playerTag") or data.get("tag") or ""
    player_name = data.get("playerName") or data.get("name") or ""

    # 提取大本等级
    town_hall_level = None
    for bld in data.get("buildings", []):
        if isinstance(bld, dict) and bld.get("data") == 1000001:
            town_hall_level = bld.get("lvl", 0)
            break

    # 提取 Builder 数量 (从 builder_hut 1000015 的 cnt)
    builder_count = 0
    for bld in data.get("buildings", []):
        if isinstance(bld, dict) and bld.get("data") == 1000015:
            builder_count += bld.get("cnt", 0)

    return {
        "player_tag": player_tag,
        "player_name": player_name,
        "town_hall_level": town_hall_level,
        "builder_count": max(builder_count, 5) if builder_count == 0 else builder_count,
    }


def calculate_idle_times(upgrades: list[UpgradeItem]) -> dict:
    """计算工人/实验室空闲时间"""
    result = {
        "builder_idle_at": None,
        "lab_idle_at": None,
        "builder_busy_count": 0,
        "lab_busy_count": 0,
        "builder_total": None,
    }

    # 需要从原始 JSON 获取 builders 总数, 这里用占位
    building_items = [u for u in upgrades if u.category == "buildings"]
    spell_items = [u for u in upgrades if u.category == "spells"]

    if building_items:
        latest = max(building_items, key=lambda x: x.finish_time)
        result["builder_idle_at"] = latest.finish_time.isoformat()
        result["builder_busy_count"] = len(building_items)

    if spell_items:
        latest = max(spell_items, key=lambda x: x.finish_time)
        result["lab_idle_at"] = latest.finish_time.isoformat()
        result["lab_busy_count"] = len(spell_items)

    return result
