from fastapi import FastAPI

from app.api.routes import router
from app.db.session import Base, engine

app = FastAPI(title="Home Ledger API")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


app.include_router(router, prefix="/api")


@app.get("/")
def health():
    return {"status": "ok"}
