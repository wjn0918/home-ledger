from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


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
    category_icon: str = ""
    amount: Decimal
    note: str = ""
    bill_date: datetime
    is_shared: bool = True
    is_posted: bool = True


class BillUpdateIn(BaseModel):
    amount: Decimal
    category: str
    category_icon: str = ""
    note: str = ""
    bill_date: datetime
    is_shared: bool = True
    is_posted: bool = True


class BillOut(BaseModel):
    id: int
    family_id: int
    user_id: int
    type: str
    category: str
    category_icon: str = ""
    amount: Decimal
    note: str
    bill_date: datetime
    is_shared: bool
    is_posted: bool
    creator_nickname: str | None = None

    class Config:
        from_attributes = True


class BillPostingIn(BaseModel):
    action: str
    bill_date: datetime | None = None


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


class FamilyCategoryCreateIn(BaseModel):
    name: str
    icon: str = ""


class CookCategoryCreateIn(BaseModel):
    name: str
    icon: str = ""


class CookMenuCreateIn(BaseModel):
    family_id: int
    category_id: int | None = None
    name: str
    ingredients: str = ""
    steps: str = ""
    is_public: bool = False
    image_urls: list[str] = Field(default_factory=list)


class CookMenuUpdateIn(BaseModel):
    category_id: int | None = None
    name: str | None = None
    ingredients: str | None = None
    steps: str | None = None
    is_public: bool | None = None
    image_urls: list[str] | None = None


class CookMenuImageCreateIn(BaseModel):
    image_url: str
    sort_order: int = 0
