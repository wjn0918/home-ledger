import random
from sqlalchemy import func, or_
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User, Family, FamilyMember, FamilyJoinRequest, Bill
from app.schemas.dto import LoginByCodeIn, LoginOut, AccountRegisterIn, AccountLoginIn, FamilyCreateIn, FamilyMemberIn, BillCreateIn, BillUpdateIn, BillOut, JoinRequestOut, JoinRequestReviewIn
from app.services.auth import get_or_create_user_by_wechat_code, register_by_account, login_by_account, create_token

router = APIRouter()


@router.post("/auth/register", response_model=LoginOut)
def auth_register(payload: AccountRegisterIn, db: Session = Depends(get_db)):
    user = register_by_account(payload.account, payload.password, payload.nickname, db)
    return LoginOut(token=create_token(user.id), user_id=user.id)


@router.post("/auth/login", response_model=LoginOut)
def auth_login(payload: AccountLoginIn, db: Session = Depends(get_db)):
    user = login_by_account(payload.account, payload.password, db)
    return LoginOut(token=create_token(user.id), user_id=user.id)


@router.post("/auth/wechat", response_model=LoginOut)
async def auth_wechat(payload: LoginByCodeIn, db: Session = Depends(get_db)):
    user = await get_or_create_user_by_wechat_code(payload.code, db)
    return LoginOut(token=create_token(user.id), user_id=user.id, nickname=user.nickname)


@router.put("/users/me")
def update_my_profile(nickname: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.nickname = nickname
    db.commit()
    return {"ok": True, "nickname": user.nickname}


@router.post("/families")
def create_family(payload: FamilyCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family_id = random.randint(100000, 999999)
    while db.query(Family).filter(Family.id == family_id).first():
        family_id = random.randint(100000, 999999)

    family = Family(id=family_id, name=payload.name, owner_user_id=user.id)
    db.add(family)
    db.flush()
    db.add(FamilyMember(family_id=family.id, user_id=user.id, role="owner"))
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

    bill = Bill(**payload.model_dump(), user_id=user.id)
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


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

    bill.amount = payload.amount
    bill.category = payload.category
    bill.bill_date = payload.bill_date
    bill.is_shared = payload.is_shared
    db.commit()
    db.refresh(bill)
    return bill


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
            
    for bill in bills:
        bill.amount = payload.amount
        bill.category = payload.category
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
    query = db.query(Bill, User.nickname).join(User, User.id == Bill.user_id).filter(Bill.family_id == family_id)
    if scope == "self":
        query = query.filter(Bill.user_id == user.id)
    else:
        query = query.filter(or_(Bill.is_shared == True, Bill.user_id == user.id))

    rows = query.order_by(Bill.bill_date.desc()).all()
    result = []
    for bill, nickname in rows:
        item = BillOut.model_validate(bill).model_dump()
        item["creator_nickname"] = nickname
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

    rows = db.query(Bill.category, func.sum(Bill.amount)).filter(Bill.family_id == family_id).group_by(Bill.category).all()
    return [{"category": c, "amount": float(a)} for c, a in rows]
