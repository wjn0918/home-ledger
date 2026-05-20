from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, Integer, DECIMAL, UniqueConstraint, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    openid: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)
    nickname: Mapped[str] = mapped_column(String(50), default="微信用户")
    avatar_url: Mapped[str] = mapped_column(String(255), default="")
    account: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Family(Base):
    __tablename__ = "families"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FamilyMember(Base):
    __tablename__ = "family_members"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(20), default="member")


class FamilyJoinRequest(Base):
    __tablename__ = "family_join_requests"
    __table_args__ = (
        UniqueConstraint("family_id", "applicant_user_id", "status", name="uq_family_applicant_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), index=True)
    applicant_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Bill(Base):
    __tablename__ = "bills"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(20))
    category_id: Mapped[int] = mapped_column(ForeignKey("family_categories.id"), index=True)
    amount: Mapped[float] = mapped_column(DECIMAL(10, 2))
    note: Mapped[str] = mapped_column(String(255), default="")
    is_shared: Mapped[bool] = mapped_column(Boolean, default=True)
    bill_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FamilyCategory(Base):
    __tablename__ = "family_categories"
    __table_args__ = (
        UniqueConstraint("family_id", "name", name="uq_family_category_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
