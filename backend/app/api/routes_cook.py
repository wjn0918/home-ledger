from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import FamilyMember, User
from app.models.entities_cook import CookBill, CookCategory, CookMenu, CookMenuImages
from app.schemas.dto import (
    CookCategoryCreateIn,
    CookBillCreateIn,
    CookBillUpdateIn,
    CookMenuCreateIn,
    CookMenuImageCreateIn,
    CookMenuUpdateIn,
)

router = APIRouter()


def require_family_member(db: Session, family_id: int, user: User) -> None:
    membership = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == user.id,
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="你不是该家庭成员")


def get_family_category(db: Session, family_id: int, category_id: int) -> CookCategory:
    category = db.query(CookCategory).filter(
        CookCategory.id == category_id,
        CookCategory.family_id == family_id,
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="菜谱分类不存在")
    return category


def get_menu_for_member(
    db: Session,
    menu_id: int,
    user: User,
    owner_only: bool = False,
) -> CookMenu:
    menu = db.query(CookMenu).filter(CookMenu.id == menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="菜谱不存在")

    require_family_member(db, menu.family_id, user)
    if owner_only and menu.user_id != user.id:
        raise HTTPException(status_code=403, detail="只能操作自己创建的菜谱")
    return menu


def add_menu_images(db: Session, menu_id: int, image_urls: list[str]) -> None:
    for sort_order, image_url in enumerate(image_urls):
        if image_url:
            db.add(CookMenuImages(
                menu_id=menu_id,
                image_url=image_url,
                sort_order=sort_order,
            ))


def build_menu_out(db: Session, menu: CookMenu) -> dict:
    category = None
    if menu.category_id is not None:
        category = db.query(CookCategory).filter(
            CookCategory.id == menu.category_id,
            CookCategory.family_id == menu.family_id,
        ).first()

    images = db.query(CookMenuImages).filter(
        CookMenuImages.menu_id == menu.id,
    ).order_by(CookMenuImages.sort_order.asc(), CookMenuImages.id.asc()).all()
    creator = db.query(User.nickname).filter(User.id == menu.user_id).scalar()

    return {
        "id": menu.id,
        "family_id": menu.family_id,
        "user_id": menu.user_id,
        "creator_nickname": creator,
        "category_id": menu.category_id,
        "category": {
            "id": category.id,
            "name": category.name,
            "icon": category.icon,
        } if category else None,
        "name": menu.name,
        "ingredients": menu.ingredients,
        "steps": menu.steps,
        "is_public": menu.is_public,
        "images": [
            {
                "id": image.id,
                "image_url": image.image_url,
                "sort_order": image.sort_order,
            }
            for image in images
        ],
        "created_at": menu.created_at,
        "updated_at": menu.updated_at,
    }


def get_cook_bill(
    db: Session,
    bill_id: int,
    user: User,
    owner_only: bool = False,
) -> CookBill:
    bill = db.query(CookBill).filter(CookBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="做菜记录不存在")
    require_family_member(db, bill.family_id, user)
    if owner_only and bill.user_id != user.id:
        raise HTTPException(status_code=403, detail="只能操作自己创建的做菜记录")
    return bill


def build_cook_bill_out(db: Session, bill: CookBill) -> dict:
    menu = db.query(CookMenu).filter(
        CookMenu.id == bill.menu_id,
        CookMenu.family_id == bill.family_id,
    ).first()
    return {
        "id": bill.id,
        "family_id": bill.family_id,
        "user_id": bill.user_id,
        "menu_id": bill.menu_id,
        "menu_name": menu.name if menu else "",
        "cooked_at": bill.cooked_at,
        "created_at": bill.created_at,
    }


@router.get("/cook/bills")
def list_cook_bills(
    family_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_family_member(db, family_id, user)
    bills = db.query(CookBill).filter(
        CookBill.family_id == family_id,
    ).order_by(CookBill.cooked_at.desc(), CookBill.id.desc()).all()
    return [build_cook_bill_out(db, bill) for bill in bills]


@router.get("/cook/bills/{bill_id}")
def get_cook_bill_detail(
    bill_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    bill = get_cook_bill(db, bill_id, user)
    return build_cook_bill_out(db, bill)


@router.post("/cook/bills")
def create_cook_bill(
    payload: CookBillCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_family_member(db, payload.family_id, user)
    menu = get_menu_for_member(db, payload.menu_id, user)
    if menu.family_id != payload.family_id:
        raise HTTPException(status_code=400, detail="菜单不属于当前家庭")

    bill = CookBill(
        family_id=payload.family_id,
        user_id=user.id,
        menu_id=payload.menu_id,
        cooked_at=payload.cooked_at or datetime.utcnow(),
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return build_cook_bill_out(db, bill)


@router.put("/cook/bills/{bill_id}")
def update_cook_bill(
    bill_id: int,
    payload: CookBillUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    bill = get_cook_bill(db, bill_id, user, owner_only=True)
    if payload.menu_id is not None:
        menu = get_menu_for_member(db, payload.menu_id, user)
        if menu.family_id != bill.family_id:
            raise HTTPException(status_code=400, detail="菜单不属于当前家庭")
        bill.menu_id = payload.menu_id
    if payload.cooked_at is not None:
        bill.cooked_at = payload.cooked_at
    db.commit()
    db.refresh(bill)
    return build_cook_bill_out(db, bill)


@router.delete("/cook/bills/{bill_id}")
def delete_cook_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    bill = get_cook_bill(db, bill_id, user, owner_only=True)
    db.delete(bill)
    db.commit()
    return {"ok": True}


@router.get("/cook/categories")
def list_cook_categories(
    family_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_family_member(db, family_id, user)
    categories = db.query(CookCategory).filter(
        CookCategory.family_id == family_id,
    ).order_by(CookCategory.id.asc()).all()
    return [
        {"id": category.id, "name": category.name, "icon": category.icon}
        for category in categories
    ]


@router.post("/cook/categories")
def create_cook_category(
    payload: CookCategoryCreateIn,
    family_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_family_member(db, family_id, user)
    category = db.query(CookCategory).filter(
        CookCategory.family_id == family_id,
        CookCategory.name == payload.name,
    ).first()
    if category:
        if payload.icon and category.icon != payload.icon:
            category.icon = payload.icon
            db.commit()
            db.refresh(category)
        return {"id": category.id, "name": category.name, "icon": category.icon}

    category = CookCategory(
        family_id=family_id,
        name=payload.name,
        icon=payload.icon,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return {"id": category.id, "name": category.name, "icon": category.icon}


@router.put("/cook/categories/{category_id}")
def update_cook_category(
    category_id: int,
    payload: CookCategoryCreateIn,
    family_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_family_member(db, family_id, user)
    category = get_family_category(db, family_id, category_id)
    conflict = db.query(CookCategory).filter(
        CookCategory.family_id == family_id,
        CookCategory.name == payload.name,
        CookCategory.id != category_id,
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail="菜谱分类名称已存在")

    category.name = payload.name
    category.icon = payload.icon
    db.commit()
    db.refresh(category)
    return {"id": category.id, "name": category.name, "icon": category.icon}


@router.delete("/cook/categories/{category_id}")
def delete_cook_category(
    category_id: int,
    family_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_family_member(db, family_id, user)
    category = get_family_category(db, family_id, category_id)
    db.query(CookMenu).filter(
        CookMenu.family_id == family_id,
        CookMenu.category_id == category_id,
    ).update({CookMenu.category_id: None}, synchronize_session=False)
    db.delete(category)
    db.commit()
    return {"ok": True}


@router.get("/cook/menus")
def list_cook_menus(
    family_id: int,
    scope: str = "family",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_family_member(db, family_id, user)
    query = db.query(CookMenu).filter(CookMenu.family_id == family_id)
    if scope == "self":
        query = query.filter(CookMenu.user_id == user.id)
    menus = query.order_by(CookMenu.updated_at.desc(), CookMenu.id.desc()).all()
    return [build_menu_out(db, menu) for menu in menus]


@router.get("/cook/menus/public")
def list_public_cook_menus(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    menus = db.query(CookMenu).filter(CookMenu.is_public == True).order_by(
        CookMenu.updated_at.desc(),
        CookMenu.id.desc(),
    ).all()
    return [build_menu_out(db, menu) for menu in menus]


@router.get("/cook/menus/{menu_id}")
def get_cook_menu(
    menu_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    menu = get_menu_for_member(db, menu_id, user)
    return build_menu_out(db, menu)


@router.post("/cook/menus")
def create_cook_menu(
    payload: CookMenuCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_family_member(db, payload.family_id, user)
    if payload.category_id is not None:
        get_family_category(db, payload.family_id, payload.category_id)

    menu = CookMenu(
        family_id=payload.family_id,
        user_id=user.id,
        category_id=payload.category_id,
        name=payload.name,
        ingredients=payload.ingredients,
        steps=payload.steps,
        is_public=payload.is_public,
    )
    db.add(menu)
    db.flush()
    add_menu_images(db, menu.id, payload.image_urls)
    db.commit()
    db.refresh(menu)
    return build_menu_out(db, menu)


@router.put("/cook/menus/{menu_id}")
def update_cook_menu(
    menu_id: int,
    payload: CookMenuUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    menu = get_menu_for_member(db, menu_id, user)
    changes = payload.model_dump(exclude_unset=True, exclude={"image_urls"})
    if payload.category_id is not None:
        get_family_category(db, menu.family_id, payload.category_id)
    for field, value in changes.items():
        setattr(menu, field, value)

    if payload.image_urls is not None:
        db.query(CookMenuImages).filter(
            CookMenuImages.menu_id == menu.id,
        ).delete(synchronize_session=False)
        add_menu_images(db, menu.id, payload.image_urls)

    db.commit()
    db.refresh(menu)
    return build_menu_out(db, menu)


@router.delete("/cook/menus/{menu_id}")
def delete_cook_menu(
    menu_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    menu = get_menu_for_member(db, menu_id, user)
    db.query(CookMenuImages).filter(
        CookMenuImages.menu_id == menu.id,
    ).delete(synchronize_session=False)
    db.delete(menu)
    db.commit()
    return {"ok": True}


@router.post("/cook/menus/{menu_id}/images")
def add_cook_menu_image(
    menu_id: int,
    payload: CookMenuImageCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    menu = get_menu_for_member(db, menu_id, user)
    image = CookMenuImages(
        menu_id=menu.id,
        image_url=payload.image_url,
        sort_order=payload.sort_order,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return {
        "id": image.id,
        "menu_id": image.menu_id,
        "image_url": image.image_url,
        "sort_order": image.sort_order,
    }


@router.delete("/cook/menus/{menu_id}/images/{image_id}")
def delete_cook_menu_image(
    menu_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    menu = get_menu_for_member(db, menu_id, user)
    image = db.query(CookMenuImages).filter(
        CookMenuImages.id == image_id,
        CookMenuImages.menu_id == menu.id,
    ).first()
    if not image:
        raise HTTPException(status_code=404, detail="菜谱图片不存在")
    db.delete(image)
    db.commit()
    return {"ok": True}
