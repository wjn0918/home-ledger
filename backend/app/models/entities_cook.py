from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Boolean, UniqueConstraint
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class CookCategory(Base):
    __tablename__ = "cook_categories"
    __table_args__ = (
        UniqueConstraint("family_id", "name", name="uq_cook_category_family_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    icon: Mapped[str] = mapped_column(String(2048), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CookMenu(Base):
    __tablename__ = "cook_menus"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cook_categories.id"),
        index=True,
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(100))
    ingredients: Mapped[str] = mapped_column(Text, default="")
    steps: Mapped[str] = mapped_column(Text, default="")
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class CookMenuImages(Base):
    __tablename__ = "cook_menu_images"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("cook_menus.id"), index=True)
    image_url: Mapped[str] = mapped_column(LONGTEXT)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class CookBill(Base):
    __tablename__ = "cook_bills"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("cook_menus.id"), index=True)
    cooked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
