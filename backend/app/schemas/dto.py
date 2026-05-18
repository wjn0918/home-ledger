from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class LoginByCodeIn(BaseModel):
    code: str


class LoginOut(BaseModel):
    token: str
    user_id: int


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


class BillOut(BaseModel):
    id: int
    family_id: int
    user_id: int
    type: str
    category: str
    amount: Decimal
    note: str
    bill_date: datetime

    class Config:
        from_attributes = True
