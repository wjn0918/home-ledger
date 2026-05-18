from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mysql_host: str = "127.0.0.1"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = "123456"
    mysql_db: str = "home_ledger"

    jwt_secret_key: str = "replace_me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 43200

    wechat_appid: str = ""
    wechat_secret: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
