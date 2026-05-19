from datetime import datetime, timedelta

import httpx
from fastapi import HTTPException
from passlib.context import CryptContext
from jose import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import User

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
BCRYPT_PASSWORD_MAX_BYTES = 72


def create_token(user_id: int):
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


async def get_or_create_user_by_wechat_code(code: str, db: Session):
    if not settings.wechat_appid or not settings.wechat_secret:
        raise HTTPException(status_code=500, detail="请先配置微信 AppID/Secret")

    url = "https://api.weixin.qq.com/sns/jscode2session"
    params = {
        "appid": settings.wechat_appid,
        "secret": settings.wechat_secret,
        "js_code": code,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
    data = resp.json()

    openid = data.get("openid")
    if not openid:
        raise HTTPException(status_code=400, detail=f"微信登录失败: {data}")

    user = db.query(User).filter(User.openid == openid).first()
    if not user:
        user = User(openid=openid)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def normalize_password(password: str) -> str:
    password = (password or "").strip()
    if not password:
        raise HTTPException(status_code=400, detail="密码不能为空")
    if len(password.encode("utf-8")) > BCRYPT_PASSWORD_MAX_BYTES:
        raise HTTPException(status_code=400, detail="密码过长，请控制在72字节以内")
    return password


def hash_password(password: str) -> str:
    normalized = normalize_password(password)
    # Use pbkdf2_sha256 as default scheme to avoid bcrypt 72-byte hard-limit runtime issues.
    # Keep bcrypt in context for backward compatibility when verifying historical hashes.
    return pwd_context.hash(normalized, scheme="pbkdf2_sha256")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        normalized = normalize_password(password)
    except HTTPException:
        return False
    return pwd_context.verify(normalized, password_hash)


def register_by_account(account: str, password: str, nickname: str, db: Session):
    account = (account or "").strip()
    if not account:
        raise HTTPException(status_code=400, detail="账号不能为空")
    exists = db.query(User).filter(User.account == account).first()
    if exists:
        raise HTTPException(status_code=400, detail="账号已存在")
    user = User(account=account, password_hash=hash_password(password), nickname=nickname)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login_by_account(account: str, password: str, db: Session):
    user = db.query(User).filter(User.account == account).first()
    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=400, detail="账号或密码错误")
    return user
