"""
数据库模型定义
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.database.base import Base


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    player_tag = Column(String(64), index=True, nullable=True)
    player_name = Column(String(128), nullable=True)
    wspusher_uid = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    villages = relationship("Village", back_populates="user", cascade="all, delete-orphan")
    upgrades = relationship("Upgrade", back_populates="user", cascade="all, delete-orphan")


class Village(Base):
    """村庄快照表 (每次上传的原始JSON)"""
    __tablename__ = "villages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    raw_json = Column(Text, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="villages")


class Upgrade(Base):
    """升级项目表"""
    __tablename__ = "upgrades"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String(32), nullable=False)      # building / spell / hero / pet / equipment
    item_name = Column(String(128), nullable=False)
    item_level = Column(Integer, nullable=False)
    finish_time = Column(DateTime, nullable=False)
    timer_seconds = Column(Integer, nullable=True)
    notified = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="upgrades")
