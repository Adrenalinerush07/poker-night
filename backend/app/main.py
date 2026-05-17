from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routes import games

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Poker Night API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games.router)


@app.get("/health")
def health():
    return {"status": "ok"}
