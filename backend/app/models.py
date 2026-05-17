from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class GameStatus(str, enum.Enum):
    active = "active"
    ended = "ended"


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(Enum(GameStatus), default=GameStatus.active, nullable=False)
    buy_in_amount = Column(Float, nullable=False)
    chips_per_buyin = Column(Integer, nullable=False)
    passcode_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    players = relationship("Player", back_populates="game", cascade="all, delete-orphan")


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)
    name = Column(String, nullable=False)
    avatar = Column(String, nullable=False)
    is_banker = Column(Boolean, default=False)
    phone = Column(String, nullable=True)
    final_chips = Column(Integer, nullable=True)

    game = relationship("Game", back_populates="players")
    buy_ins = relationship("BuyIn", back_populates="player", cascade="all, delete-orphan")


class BuyIn(Base):
    __tablename__ = "buy_ins"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    player = relationship("Player", back_populates="buy_ins")
