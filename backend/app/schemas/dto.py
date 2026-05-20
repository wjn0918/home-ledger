from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class LoginByCodeIn(BaseModel):
    code: str


class LoginOut(BaseModel):
    token: str
    user_id: int
    nickname: str | None = None
    avatar_url: str | None = None


class AccountRegisterIn(BaseModel):
    account: str
    password: str
    nickname: str = "普通用户"


class AccountLoginIn(BaseModel):
    account: str
    password: str


class FamilyCreateIn(BaseModel):
    name: str


class FamilyMemberIn(BaseModel):
    user_id: int


class BillCreateIn(BaseModel):
    family_id: int
    type: str
    category: str
    amount: Decimal
    note: str = ""
    bill_date: datetime
    is_shared: bool = True


class BillUpdateIn(BaseModel):
    amount: Decimal
    category: str
    bill_date: datetime
    is_shared: bool = True


class BillOut(BaseModel):
    id: int
    family_id: int
    user_id: int
    type: str
    category: str
    amount: Decimal
    note: str
    bill_date: datetime
    is_shared: bool
    creator_nickname: str | None = None

    class Config:
        from_attributes = True


class JoinRequestOut(BaseModel):
    id: int
    family_id: int
    family_name: str
    applicant_user_id: int
    applicant_nickname: str
    status: str
    created_at: datetime


class JoinRequestReviewIn(BaseModel):
    approve: bool
