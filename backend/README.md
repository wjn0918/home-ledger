## 后端启动

1. 复制 `.env.example` 为 `.env` 并填写 MySQL 与微信小程序配置。
2. 安装依赖：
```bash
pip install -r requirements.txt
```
3. 启动：
```bash
uvicorn app.main:app --reload --port 8000
```

## 核心能力
- 微信登录（code -> openid）并签发 JWT。
- 家庭账本：创建家庭、添加成员、成员权限校验。
- 账单 CRUD（示例提供创建+查询）与分类图表汇总。
