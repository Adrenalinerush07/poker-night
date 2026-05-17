from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/games", tags=["games"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Passcode dependency ────────────────────────────────────────────────────────

def require_passcode(
    game_id: int,
    x_game_passcode: str = Header(..., description="Game passcode"),
    db: Session = Depends(get_db),
) -> models.Game:
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.passcode_hash and not pwd_context.verify(x_game_passcode, game.passcode_hash):
        raise HTTPException(status_code=403, detail="Invalid passcode")
    return game


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("", response_model=schemas.GameOut)
def create_game(payload: schemas.GameCreate, db: Session = Depends(get_db)):
    if len(payload.players) < 4:
        raise HTTPException(status_code=400, detail="At least 4 players required")
    if len(payload.passcode.strip()) < 4:
        raise HTTPException(status_code=400, detail="Passcode must be at least 4 characters")

    bankers = [p for p in payload.players if p.is_banker]
    if len(bankers) != 1:
        raise HTTPException(status_code=400, detail="Exactly one banker required")

    game = models.Game(
        buy_in_amount=payload.buy_in_amount,
        chips_per_buyin=payload.chips_per_buyin,
        passcode_hash=pwd_context.hash(payload.passcode.strip()),
    )
    db.add(game)
    db.flush()

    for p in payload.players:
        player = models.Player(
            game_id=game.id,
            name=p.name,
            avatar=p.avatar,
            is_banker=p.is_banker,
        )
        db.add(player)
        db.flush()
        db.add(models.BuyIn(player_id=player.id, game_id=game.id))

    db.commit()
    db.refresh(game)
    return game


@router.post("/{game_id}/verify")
def verify_passcode(game_id: int, payload: schemas.PasscodeVerify, db: Session = Depends(get_db)):
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.passcode_hash and not pwd_context.verify(payload.passcode.strip(), game.passcode_hash):
        raise HTTPException(status_code=403, detail="Invalid passcode")
    return {"status": "ok", "game_id": game_id, "game_status": game.status}


@router.get("/{game_id}", response_model=schemas.GameOut)
def get_game(game: models.Game = Depends(require_passcode)):
    return game


@router.post("/{game_id}/players/{player_id}/buyin", response_model=schemas.PlayerOut)
def add_buyin(
    player_id: int,
    game: models.Game = Depends(require_passcode),
    db: Session = Depends(get_db),
):
    if game.status == "ended":
        raise HTTPException(status_code=400, detail="Game has already ended")

    player = db.query(models.Player).filter(
        models.Player.id == player_id,
        models.Player.game_id == game.id,
    ).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    db.add(models.BuyIn(player_id=player_id, game_id=game.id))
    db.commit()
    db.refresh(player)
    return player


@router.delete("/{game_id}/players/{player_id}/buyin", response_model=schemas.PlayerOut)
def remove_last_buyin(
    player_id: int,
    game: models.Game = Depends(require_passcode),
    db: Session = Depends(get_db),
):
    if game.status == "ended":
        raise HTTPException(status_code=400, detail="Game has already ended")

    player = db.query(models.Player).filter(
        models.Player.id == player_id,
        models.Player.game_id == game.id,
    ).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if len(player.buy_ins) <= 1:
        raise HTTPException(status_code=400, detail="Cannot remove the initial buy-in")

    last = max(player.buy_ins, key=lambda b: b.id)
    db.delete(last)
    db.commit()
    db.refresh(player)
    return player


@router.post("/{game_id}/end", response_model=schemas.GameResults)
def end_game(
    payload: schemas.EndGameRequest,
    game: models.Game = Depends(require_passcode),
    db: Session = Depends(get_db),
):
    if game.status == "ended":
        raise HTTPException(status_code=400, detail="Game already ended")

    chips_map = {fc.player_id: fc.final_chips for fc in payload.final_chips}

    for player in game.players:
        if player.id not in chips_map:
            raise HTTPException(status_code=400, detail=f"Missing final chips for player {player.name}")
        player.final_chips = chips_map[player.id]

    total_distributed = sum(len(p.buy_ins) * game.chips_per_buyin for p in game.players)
    total_counted = sum(chips_map[p.id] for p in game.players)
    if total_counted != total_distributed:
        diff = total_counted - total_distributed
        raise HTTPException(
            status_code=400,
            detail=f"Chip count mismatch: {total_counted:,} counted but {total_distributed:,} in play (difference: {diff:+,})",
        )

    game.status = models.GameStatus.ended
    db.commit()
    db.refresh(game)
    return _build_results(game)


@router.get("/{game_id}/results", response_model=schemas.GameResults)
def get_results(game: models.Game = Depends(require_passcode)):
    if game.status != "ended":
        raise HTTPException(status_code=400, detail="Game has not ended yet")
    return _build_results(game)


def _build_results(game: models.Game) -> schemas.GameResults:
    chip_value = game.buy_in_amount / game.chips_per_buyin
    players = []

    for player in game.players:
        buy_in_count = len(player.buy_ins)
        chips_invested = buy_in_count * game.chips_per_buyin
        final = player.final_chips or 0
        profit_loss_chips = final - chips_invested
        profit_loss_inr = round(profit_loss_chips * chip_value, 2)

        players.append(schemas.PlayerResult(
            player_id=player.id,
            name=player.name,
            avatar=player.avatar,
            is_banker=player.is_banker,
            buy_in_count=buy_in_count,
            chips_invested=chips_invested,
            final_chips=final,
            profit_loss_chips=profit_loss_chips,
            profit_loss_inr=profit_loss_inr,
        ))

    return schemas.GameResults(
        game_id=game.id,
        buy_in_amount=game.buy_in_amount,
        chips_per_buyin=game.chips_per_buyin,
        players=players,
    )
