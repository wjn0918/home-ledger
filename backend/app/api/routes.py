import random
from sqlalchemy import func, or_
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User, Family, FamilyMember, FamilyJoinRequest, Bill, FamilyCategory
from app.schemas.dto import LoginByCodeIn, LoginOut, AccountRegisterIn, AccountLoginIn, FamilyCreateIn, FamilyMemberIn, BillCreateIn, BillUpdateIn, BillOut, JoinRequestOut, JoinRequestReviewIn, FamilyCategoryCreateIn
from app.services.auth import get_or_create_user_by_wechat_code, register_by_account, login_by_account, create_token

router = APIRouter()


def build_bill_out(bill: Bill, category: str, category_icon: str = "", creator_nickname: str | None = None) -> dict:
    return {
        "id": bill.id,
        "family_id": bill.family_id,
        "user_id": bill.user_id,
        "type": bill.type,
        "category": category,
        "category_icon": category_icon,
        "amount": bill.amount,
        "note": bill.note,
        "bill_date": bill.bill_date,
        "is_shared": bill.is_shared,
        "creator_nickname": creator_nickname,
    }


DEFAULT_CATEGORY_OPTIONS = [
    {"name": "餐饮", "icon": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23ff8f1f' d='M7 2v8a2 2 0 0 0 2 2v10h2V2H9v6H8V2Zm8 0c-2 0-4 2-4 5v7h3v8h2V2z'/></svg>"},
    {"name": "交通", "icon": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%234a90e2' d='M5 16a2 2 0 1 0 0 4a2 2 0 0 0 0-4m14 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4M5 4h14a2 2 0 0 1 2 2v9h-2a3 3 0 0 0-6 0H11a3 3 0 0 0-6 0H3V6a2 2 0 0 1 2-2'/></svg>"},
    {"name": "购物", "icon": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23ff5a7a' d='M6 7h12l-1 13H7zm3-3h6l1 2H8z'/></svg>"},
    {"name": "工资", "icon": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%2328c76f' d='M3 6h18v12H3zm9 2a3 3 0 0 0-3 3h2a1 1 0 1 1 1 1a3 3 0 0 0 0 6v1h2v-1a3 3 0 0 0 0-6a1 1 0 1 1 1-1h2a3 3 0 0 0-3-3V7h-2z'/></svg>"},
    {"name": "其他", "icon": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='%2399a2ad'/><circle cx='12' cy='8' r='1.5' fill='white'/><circle cx='12' cy='12' r='1.5' fill='white'/><circle cx='12' cy='16' r='1.5' fill='white'/></svg>"},
]


DEFAULT_CATEGORY_ICONS = [
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23ff8f1f' d='M7 2v8a2 2 0 0 0 2 2v10h2V2H9v6H8V2Zm8 0c-2 0-4 2-4 5v7h3v8h2V2z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23ff6f61' d='M7 3h10l-1 5H8Zm1 7h8l-1 11H9z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23ff4d6d' d='M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23f7b500' d='M4 10h16v10H4zM6 7h12v3H6z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%234a90e2' d='M5 16a2 2 0 1 0 0 4a2 2 0 0 0 0-4m14 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4M5 4h14a2 2 0 0 1 2 2v9h-2a3 3 0 0 0-6 0H11a3 3 0 0 0-6 0H3V6a2 2 0 0 1 2-2'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%235f6caf' d='M12 2l7 4v12l-7 4l-7-4V6z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%2300b8d9' d='M3 13l9-10l9 10h-4v8H7v-8z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%233495db' d='M5 11h14l-2 8H7zM7 8h10l1 3H6z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23ff5a7a' d='M6 7h12l-1 13H7zm3-3h6l1 2H8z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%238e44ad' d='M4 8h16l-1 12H5zM8 5h8v3H8z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23e91e63' d='M12 4a5 5 0 0 1 5 5v11H7V9a5 5 0 0 1 5-5'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='8' r='4' fill='%23ff9f43'/><path fill='%23ffbe76' d='M6 22a6 6 0 0 1 12 0z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%2328c76f' d='M3 6h18v12H3zm9 2a3 3 0 0 0-3 3h2a1 1 0 1 1 1 1a3 3 0 0 0 0 6v1h2v-1a3 3 0 0 0 0-6a1 1 0 1 1 1-1h2a3 3 0 0 0-3-3V7h-2z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%231abc9c' d='M12 3l8 5v8l-8 5l-8-5V8z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%2327ae60' d='M12 2l3 7h7l-5.5 4.5L18 21l-6-4l-6 4l1.5-7.5L2 9h7z'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='%2399a2ad'/><circle cx='12' cy='8' r='1.5' fill='white'/><circle cx='12' cy='12' r='1.5' fill='white'/><circle cx='12' cy='16' r='1.5' fill='white'/></svg>",
]


def get_or_create_family_category(db: Session, family_id: int, category_name: str, category_icon: str = "") -> FamilyCategory:
    category = db.query(FamilyCategory).filter(
        FamilyCategory.family_id == family_id,
        FamilyCategory.name == category_name
    ).first()
    if category:
        if category_icon and category.icon != category_icon:
            category.icon = category_icon
            db.flush()
        return category

    category = FamilyCategory(family_id=family_id, name=category_name, icon=category_icon)
    db.add(category)
    db.flush()
    return category


@router.post("/auth/register", response_model=LoginOut)
def auth_register(payload: AccountRegisterIn, db: Session = Depends(get_db)):
    user = register_by_account(payload.account, payload.password, payload.nickname, db)
    return LoginOut(token=create_token(user.id), user_id=user.id, nickname=user.nickname, avatar_url=user.avatar_url)


@router.post("/auth/login", response_model=LoginOut)
def auth_login(payload: AccountLoginIn, db: Session = Depends(get_db)):
    user = login_by_account(payload.account, payload.password, db)
    return LoginOut(token=create_token(user.id), user_id=user.id, nickname=user.nickname, avatar_url=user.avatar_url)


@router.post("/auth/wechat", response_model=LoginOut)
async def auth_wechat(payload: LoginByCodeIn, db: Session = Depends(get_db)):
    user = await get_or_create_user_by_wechat_code(payload.code, db)
    return LoginOut(token=create_token(user.id), user_id=user.id, nickname=user.nickname, avatar_url=user.avatar_url)


@router.post("/auth/logout")
def auth_logout(user: User = Depends(get_current_user)):
    # JWT 为无状态令牌，服务端无需持久化会话；该接口用于前端统一触发退出流程
    return {"ok": True, "message": "退出成功"}


@router.put("/users/me")
def update_my_profile(
    nickname: str | None = None,
    avatar_url: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if nickname is not None:
        user.nickname = nickname
    if avatar_url is not None:
        user.avatar_url = avatar_url
    db.commit()
    return {"ok": True, "nickname": user.nickname, "avatar_url": user.avatar_url}


@router.delete("/users/me")
def deregister_user(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # 1. 处理用户拥有的家庭
    owned_families = db.query(Family).filter(Family.owner_user_id == user.id).all()
    for family in owned_families:
        # 删除该家庭的所有账单
        db.query(Bill).filter(Bill.family_id == family.id).delete()
        # 删除该家庭的所有申请
        db.query(FamilyJoinRequest).filter(FamilyJoinRequest.family_id == family.id).delete()
        # 删除该家庭的所有成员记录
        db.query(FamilyMember).filter(FamilyMember.family_id == family.id).delete()
        # 删除该家庭的所有分类
        db.query(FamilyCategory).filter(FamilyCategory.family_id == family.id).delete()
        # 删除家庭本身
        db.delete(family)

    # 2. 处理用户作为普通成员的相关数据
    # 删除用户创建的所有账单（可能在别人的家庭里）
    db.query(Bill).filter(Bill.user_id == user.id).delete()
    # 删除用户发起的所有申请
    db.query(FamilyJoinRequest).filter(FamilyJoinRequest.applicant_user_id == user.id).delete()
    # 删除用户的所有家庭成员记录
    db.query(FamilyMember).filter(FamilyMember.user_id == user.id).delete()

    # 3. 最后删除用户记录
    db.delete(user)
    db.commit()
    return {"ok": True, "message": "注销成功"}


@router.post("/families")
def create_family(payload: FamilyCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family_id = random.randint(100000, 999999)
    while db.query(Family).filter(Family.id == family_id).first():
        family_id = random.randint(100000, 999999)

    family = Family(id=family_id, name=payload.name, owner_user_id=user.id)
    db.add(family)
    db.flush()
    db.add(FamilyMember(family_id=family.id, user_id=user.id, role="owner"))
    for item in DEFAULT_CATEGORY_OPTIONS:
        db.add(FamilyCategory(family_id=family.id, name=item["name"], icon=item["icon"]))
    db.commit()
    return {"id": family.id, "name": family.name}




@router.get("/families/mine")
def my_families(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(Family.id, Family.name)
        .join(FamilyMember, FamilyMember.family_id == Family.id)
        .filter(FamilyMember.user_id == user.id)
        .order_by(Family.id.desc())
        .all()
    )
    return [{"id": item.id, "name": item.name} for item in rows]



@router.post("/families/join")
def join_family(family_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    exists = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == user.id
    ).first()
    if exists:
        return {"ok": True, "message": "已加入该家庭"}

    pending = db.query(FamilyJoinRequest).filter(
        FamilyJoinRequest.family_id == family_id,
        FamilyJoinRequest.applicant_user_id == user.id,
        FamilyJoinRequest.status == "pending"
    ).first()
    if pending:
        return {"ok": True, "message": "申请已提交，等待家庭创建人处理"}

    db.add(FamilyJoinRequest(family_id=family_id, applicant_user_id=user.id, status="pending"))
    db.commit()
    return {"ok": True, "message": "申请已提交，等待家庭创建人同意"}


@router.get("/families/join-requests", response_model=list[JoinRequestOut])
def list_join_requests(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(FamilyJoinRequest, Family.name, User.nickname)
        .join(Family, Family.id == FamilyJoinRequest.family_id)
        .join(User, User.id == FamilyJoinRequest.applicant_user_id)
        .filter(Family.owner_user_id == user.id, FamilyJoinRequest.status == "pending")
        .order_by(FamilyJoinRequest.created_at.desc())
        .all()
    )

    return [
        JoinRequestOut(
            id=req.id,
            family_id=req.family_id,
            family_name=family_name,
            applicant_user_id=req.applicant_user_id,
            applicant_nickname=applicant_nickname,
            status=req.status,
            created_at=req.created_at
        )
        for req, family_name, applicant_nickname in rows
    ]


@router.post("/families/join-requests/{request_id}/review")
def review_join_request(request_id: int, payload: JoinRequestReviewIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    req = (
        db.query(FamilyJoinRequest)
        .join(Family, Family.id == FamilyJoinRequest.family_id)
        .filter(FamilyJoinRequest.id == request_id, Family.owner_user_id == user.id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="申请不存在")

    if req.status != "pending":
        return {"ok": True, "message": "该申请已处理"}

    if payload.approve:
        exists = db.query(FamilyMember).filter(
            FamilyMember.family_id == req.family_id,
            FamilyMember.user_id == req.applicant_user_id
        ).first()
        if not exists:
            db.add(FamilyMember(family_id=req.family_id, user_id=req.applicant_user_id, role="member"))
        req.status = "approved"
        message = "已同意加入申请"
    else:
        req.status = "rejected"
        message = "已拒绝加入申请"

    db.commit()
    return {"ok": True, "message": message}

@router.post("/families/{family_id}/members")
def add_member(family_id: int, payload: FamilyMemberIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="只有家庭拥有者可添加成员")

    exists = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == payload.user_id
    ).first()
    if exists:
        return {"ok": True, "message": "用户已在该家庭"}

    db.add(FamilyMember(family_id=family_id, user_id=payload.user_id, role="member"))
    db.commit()
    return {"ok": True, "message": "添加成员成功"}


@router.get("/families/{family_id}/members")
def list_family_members(family_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # 检查当前用户是否是该家庭成员
    membership = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="你不是该家庭成员")

    rows = (
        db.query(User.id, User.nickname, User.avatar_url, FamilyMember.role)
        .join(FamilyMember, FamilyMember.user_id == User.id)
        .filter(FamilyMember.family_id == family_id)
        .all()
    )
    return [
        {"id": item.id, "nickname": item.nickname, "avatar_url": item.avatar_url, "role": item.role}
        for item in rows
    ]


@router.delete("/families/{family_id}/members/{target_user_id}")
def remove_family_member(family_id: int, target_user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    # 权限校验：只有家庭拥有者可以移除其他成员，普通成员只能移除自己（退出家庭）
    if family.owner_user_id != user.id and user.id != target_user_id:
        raise HTTPException(status_code=403, detail="无权执行此操作")

    # 家庭拥有者不能移除自己（除非解散家庭，这里暂不支持直接移除 owner）
    if target_user_id == family.owner_user_id:
        raise HTTPException(status_code=400, detail="不能移除家庭创建人")

    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == target_user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="该用户不是家庭成员")

    db.delete(member)
    db.commit()
    return {"ok": True, "message": "移除成功"}


@router.post("/bills", response_model=BillOut)
def create_bill(payload: BillCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    membership = db.query(FamilyMember).filter(
        FamilyMember.family_id == payload.family_id,
        FamilyMember.user_id == user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="你不是该家庭成员")

    category = get_or_create_family_category(db, payload.family_id, payload.category, payload.category_icon)

    bill_data = payload.model_dump(exclude={"category", "category_icon"})
    bill = Bill(**bill_data, category_id=category.id, user_id=user.id)
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return build_bill_out(bill, category.name, category.icon)


@router.put("/bills/{bill_id}", response_model=BillOut)
def update_bill(bill_id: int, payload: BillUpdateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")

    membership = db.query(FamilyMember).filter(
        FamilyMember.family_id == bill.family_id,
        FamilyMember.user_id == user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="你不是该家庭成员")
    if bill.user_id != user.id:
        raise HTTPException(status_code=403, detail="只能修改自己创建的账单")

    category = get_or_create_family_category(db, bill.family_id, payload.category, payload.category_icon)

    bill.amount = payload.amount
    bill.category_id = category.id
    bill.bill_date = payload.bill_date
    bill.is_shared = payload.is_shared
    db.commit()
    db.refresh(bill)
    return build_bill_out(bill, category.name, category.icon)


@router.delete("/bills/{bill_id}")
def delete_bill(bill_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")

    membership = db.query(FamilyMember).filter(
        FamilyMember.family_id == bill.family_id,
        FamilyMember.user_id == user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="你不是该家庭成员")
    if bill.user_id != user.id:
        raise HTTPException(status_code=403, detail="只能删除自己创建的账单")

    db.delete(bill)
    db.commit()
    return {"ok": True}


@router.post("/bills/batch-delete")
def batch_delete_bills(bill_ids: list[int], db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bills = db.query(Bill).filter(Bill.id.in_(bill_ids)).all()
    
    # 权限校验：只能删除自己创建的账单
    for bill in bills:
        if bill.user_id != user.id:
            raise HTTPException(status_code=403, detail=f"无权删除账单 ID: {bill.id}")
    
    for bill in bills:
        db.delete(bill)
    db.commit()
    return {"ok": True, "count": len(bills)}


@router.put("/bills/batch-update")
def batch_update_bills(bill_ids: list[int], payload: BillUpdateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bills = db.query(Bill).filter(Bill.id.in_(bill_ids)).all()
    
    # 权限校验：只能修改自己创建的账单
    for bill in bills:
        if bill.user_id != user.id:
            raise HTTPException(status_code=403, detail=f"无权修改账单 ID: {bill.id}")
            
    category_cache = {}
    for bill in bills:
        family_category_key = (bill.family_id, payload.category)
        if family_category_key not in category_cache:
            category = get_or_create_family_category(db, bill.family_id, payload.category, payload.category_icon)
            category_cache[family_category_key] = category.id

        bill.amount = payload.amount
        bill.category_id = category_cache[family_category_key]
        bill.bill_date = payload.bill_date
        bill.is_shared = payload.is_shared
        
    db.commit()
    return {"ok": True, "count": len(bills)}


@router.get("/bills", response_model=list[BillOut])
def list_bills(family_id: int, scope: str = "family", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    membership = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="你不是该家庭成员")
    query = (
        db.query(Bill, User.nickname, FamilyCategory.name, FamilyCategory.icon)
        .join(User, User.id == Bill.user_id)
        .join(FamilyCategory, FamilyCategory.id == Bill.category_id)
        .filter(Bill.family_id == family_id)
    )
    if scope == "self":
        query = query.filter(Bill.user_id == user.id)
    else:
        query = query.filter(or_(Bill.is_shared == True, Bill.user_id == user.id))

    rows = query.order_by(Bill.bill_date.desc()).all()
    result = []
    for bill, nickname, category_name, category_icon in rows:
        item = build_bill_out(bill, category_name, category_icon, nickname)
        result.append(item)
    return result


@router.get("/charts/summary")
def chart_summary(family_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    membership = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="你不是该家庭成员")

    rows = (
        db.query(FamilyCategory.name, func.sum(Bill.amount))
        .join(Bill, Bill.category_id == FamilyCategory.id)
        .filter(Bill.family_id == family_id)
        .group_by(FamilyCategory.name)
        .all()
    )
    return [{"category": c, "amount": float(a)} for c, a in rows]


@router.get("/families/{family_id}/categories")
def list_family_categories(family_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    membership = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="你不是该家庭成员")

    categories = db.query(FamilyCategory).filter(FamilyCategory.family_id == family_id).order_by(FamilyCategory.id.asc()).all()
    return [{"id": c.id, "name": c.name, "icon": c.icon} for c in categories]


@router.post("/families/{family_id}/categories")
def create_family_category(family_id: int, payload: FamilyCategoryCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    membership = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="你不是该家庭成员")

    exists = db.query(FamilyCategory).filter(
        FamilyCategory.family_id == family_id,
        FamilyCategory.name == payload.name
    ).first()
    if exists:
        if payload.icon and payload.icon != exists.icon:
            exists.icon = payload.icon
            db.commit()
            db.refresh(exists)
        return {"id": exists.id, "name": exists.name, "icon": exists.icon}

    category = FamilyCategory(family_id=family_id, name=payload.name, icon=payload.icon)
    db.add(category)
    db.commit()
    db.refresh(category)
    return {"id": category.id, "name": category.name, "icon": category.icon}


@router.get("/categories/default-icons")
def list_default_category_icons(user: User = Depends(get_current_user)):
    return [{"icon": icon} for icon in DEFAULT_CATEGORY_ICONS]
