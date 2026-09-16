from app.models.entities_cook import CookBill, CookCategory, CookMenu, CookMenuImages
from fastapi import FastAPI

from app.api.routes import router
from app.api.routes_cook import router as cook_router
from app.db.session import Base, engine

app = FastAPI(title="Home Ledger API")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


app.include_router(router, prefix="/api")
app.include_router(cook_router, prefix="/api")


@app.get("/")
def health():
    return {"status": "ok"}
