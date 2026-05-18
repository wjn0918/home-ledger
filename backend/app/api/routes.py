from sqlalchemy import func
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User, Family, FamilyMember, Bill
from app.schemas.dto import LoginByCodeIn, LoginOut, FamilyCreateIn, FamilyMemberIn, BillCreateIn, BillOut
from app.services.auth import get_or_create_user_by_wechat_code, create_token

router = APIRouter()


@router.post("/auth/wechat", response_model=LoginOut)
async def auth_wechat(payload: LoginByCodeIn, db: Session = Depends(get_db)):
    user = await get_or_create_user_by_wechat_code(payload.code, db)
    return LoginOut(token=create_token(user.id), user_id=user.id)


@router.post("/families")
def create_family(payload: FamilyCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family = Family(name=payload.name, owner_user_id=user.id)
    db.add(family)
    db.flush()
    db.add(FamilyMember(family_id=family.id, user_id=user.id, role="owner"))
    db.commit()
    return {"id": family.id, "name": family.name}


@router.post("/families/{family_id}/members")
def add_member(family_id: int, payload: FamilyMemberIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="只有家庭拥有者可添加成员")

    db.add(FamilyMember(family_id=family_id, user_id=payload.user_id, role="member"))
    db.commit()
    return {"ok": True}


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


@router.get("/bills", response_model=list[BillOut])
def list_bills(family_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    membership = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="你不是该家庭成员")
    return db.query(Bill).filter(Bill.family_id == family_id).order_by(Bill.bill_date.desc()).all()


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
