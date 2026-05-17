from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect
from .database import engine, Base
from .routes import games

Base.metadata.create_all(bind=engine)

# Add passcode_hash column to existing games table if it doesn't exist
with engine.connect() as conn:
    cols = [c["name"] for c in inspect(engine).get_columns("games")]
    if "passcode_hash" not in cols:
        conn.execute(text("ALTER TABLE games ADD COLUMN passcode_hash VARCHAR"))
        conn.commit()

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
