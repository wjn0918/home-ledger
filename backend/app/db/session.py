from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

mysql_user = quote_plus(settings.mysql_user)
mysql_password = quote_plus(settings.mysql_password)

DATABASE_URL = (
    f"mysql+pymysql://{mysql_user}:{mysql_password}"
    f"@{settings.mysql_host}:{settings.mysql_port}/{settings.mysql_db}?charset=utf8mb4"
)


class Base(DeclarativeBase):
    pass


engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
