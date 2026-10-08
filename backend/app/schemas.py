from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PlayerCreate(BaseModel):
    name: str
    avatar: str
    is_banker: bool = False
    phone: Optional[str] = None


class PlayerJoinCreate(BaseModel):
    """A player joining an already active table receives one initial buy-in."""

    name: str = Field(min_length=1, max_length=20)
    phone: str = Field(min_length=1, max_length=30)


class BuyInCreate(BaseModel):
    amount: float = Field(gt=0)


class GameCreate(BaseModel):
    buy_in_amount: float
    chips_per_buyin: int
    passcode: str
    players: list[PlayerCreate]


class PasscodeVerify(BaseModel):
    passcode: str


class BuyInOut(BaseModel):
    id: int
    player_id: int
    amount: float
    chips: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PlayerOut(BaseModel):
    id: int
    name: str
    avatar: str
    is_banker: bool
    phone: Optional[str] = None
    final_chips: Optional[int] = None
    buy_ins: list[BuyInOut] = []

    model_config = {"from_attributes": True}


class GameOut(BaseModel):
    id: int
    status: str
    buy_in_amount: float
    chips_per_buyin: int
    created_at: datetime
    players: list[PlayerOut]

    model_config = {"from_attributes": True}


class FinalChips(BaseModel):
    player_id: int
    final_chips: int


class EndGameRequest(BaseModel):
    final_chips: list[FinalChips]


class PlayerResult(BaseModel):
    player_id: int
    name: str
    avatar: str
    is_banker: bool
    phone: Optional[str] = None
    buy_in_count: int
    amount_invested: float
    chips_invested: int
    final_chips: int
    profit_loss_chips: int
    profit_loss_inr: float


class GameResults(BaseModel):
    game_id: int
    buy_in_amount: float
    chips_per_buyin: int
    players: list[PlayerResult]


class LeaderboardPlayer(BaseModel):
    name: str
    games_played: int
    wins: int
    losses: int
    breakeven: int
    net_winnings: float
    average_per_game: float
    win_rate: float
    experience_score: float
    overall_rank: int
    regular_rank: Optional[int] = None


class LeaderboardOut(BaseModel):
    genuine_games: int
    minimum_games_for_regular_rank: int
    players: list[LeaderboardPlayer]
