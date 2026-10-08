from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File
from sqlalchemy.orm import Session
import bcrypt
import os
import json
import re
import base64
import httpx
from collections import defaultdict
from datetime import timezone
from zoneinfo import ZoneInfo
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/games", tags=["games"])

IST = ZoneInfo("Asia/Kolkata")
CANONICAL_PLAYER_NAMES = {
    "dhruv": "Dhruv",
    "dhurv": "Dhruv",
    "rishi": "Rishi",
    "john wick": "Rishi",
    "jestin": "Jestin",
    "justin": "Jestin",
}


def _canonical_player_name(name: str) -> str:
    """Keep known aliases together in the historical leaderboard."""
    cleaned = name.strip()
    return CANONICAL_PLAYER_NAMES.get(cleaned.lower(), cleaned)


def _hash(passcode: str) -> str:
    return bcrypt.hashpw(passcode.encode(), bcrypt.gensalt()).decode()


def _verify(passcode: str, hashed: str) -> bool:
    return bcrypt.checkpw(passcode.encode(), hashed.encode())


# ── Passcode dependency ────────────────────────────────────────────────────────

def require_passcode(
    game_id: int,
    x_game_passcode: str = Header(..., description="Game passcode"),
    db: Session = Depends(get_db),
) -> models.Game:
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.passcode_hash and not _verify(x_game_passcode, game.passcode_hash):
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
        passcode_hash=_hash(payload.passcode.strip()),
    )
    db.add(game)
    db.flush()

    for p in payload.players:
        player = models.Player(
            game_id=game.id,
            name=_canonical_player_name(p.name),
            avatar=p.avatar,
            is_banker=p.is_banker,
            phone=p.phone or None,
        )
        db.add(player)
        db.flush()
        db.add(models.BuyIn(
            player_id=player.id,
            game_id=game.id,
            amount=game.buy_in_amount,
            chips=game.chips_per_buyin,
        ))

    db.commit()
    db.refresh(game)
    return game


@router.post("/{game_id}/verify")
def verify_passcode(game_id: int, payload: schemas.PasscodeVerify, db: Session = Depends(get_db)):
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.passcode_hash and not _verify(payload.passcode.strip(), game.passcode_hash):
        raise HTTPException(status_code=403, detail="Invalid passcode")
    return {"status": "ok", "game_id": game_id, "game_status": game.status}


@router.get("/{game_id}", response_model=schemas.GameOut)
def get_game(game: models.Game = Depends(require_passcode)):
    return game


@router.post("/{game_id}/players", response_model=schemas.PlayerOut)
def add_player(
    payload: schemas.PlayerJoinCreate,
    game: models.Game = Depends(require_passcode),
    db: Session = Depends(get_db),
):
    """Seat a late-arriving player with the table's standard initial buy-in."""
    if game.status == "ended":
        raise HTTPException(status_code=400, detail="Game has already ended")

    name = _canonical_player_name(payload.name)
    phone = payload.phone.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Player name is required")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    player = models.Player(
        game_id=game.id,
        name=name,
        phone=phone,
        # DiceBear uses the seed for a deterministic avatar, so no client-side
        # avatar selection is needed when someone joins a live table.
        avatar=f"joined-{game.id}-{name.lower()}",
        is_banker=False,
    )
    db.add(player)
    db.flush()
    db.add(models.BuyIn(
        player_id=player.id,
        game_id=game.id,
        amount=game.buy_in_amount,
        chips=game.chips_per_buyin,
    ))
    db.commit()
    db.refresh(player)
    return player


@router.post("/{game_id}/players/{player_id}/buyin", response_model=schemas.PlayerOut)
def add_buyin(
    player_id: int,
    payload: schemas.BuyInCreate | None = None,
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

    # The initial buy-in happens when the player is seated. Their second
    # buy-in is always the table's standard amount. From the third onward,
    # the host chooses the amount and receives chips at the original rate.
    if len(player.buy_ins) < 2:
        amount = game.buy_in_amount
        chips = game.chips_per_buyin
    else:
        if payload is None:
            raise HTTPException(status_code=400, detail="Enter an amount for the third and later buy-ins")
        amount = payload.amount
        # Match the client preview: half a chip rounds up because only whole
        # poker chips can be issued.
        chips = int(amount * game.chips_per_buyin / game.buy_in_amount + 0.5)
        if chips <= 0:
            raise HTTPException(status_code=400, detail="Amount is too small for this table's chip rate")

    db.add(models.BuyIn(player_id=player_id, game_id=game.id, amount=amount, chips=chips))
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

    total_distributed = sum(sum(buy_in.chips for buy_in in p.buy_ins) for p in game.players)
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


@router.get("/{game_id}/public-results", response_model=schemas.GameResults)
def get_public_results(game_id: int, db: Session = Depends(get_db)):
    """Passcode-free results — only available once game is ended (for image card generation)."""
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.status != "ended":
        raise HTTPException(status_code=403, detail="Results not available yet")
    return _build_results(game)


@router.get("/stats/leaderboard", response_model=schemas.LeaderboardOut)
def get_leaderboard(db: Session = Depends(get_db)):
    """Public all-time leaderboard, excluding extra same-day test games."""
    ended_games = (
        db.query(models.Game)
        .filter(models.Game.status == models.GameStatus.ended)
        .order_by(models.Game.created_at.desc(), models.Game.id.desc())
        .all()
    )

    # Older testing sessions sometimes created several games in quick succession.
    # Keep the latest two completed games per India calendar date.
    games_per_day: dict[object, int] = defaultdict(int)
    genuine_games = []
    for game in ended_games:
        created_at = game.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        day = created_at.astimezone(IST).date()
        if games_per_day[day] < 2:
            genuine_games.append(game)
            games_per_day[day] += 1

    stats: dict[str, dict] = {}
    for game in genuine_games:
        chip_value = game.buy_in_amount / game.chips_per_buyin
        for player in game.players:
            name = _canonical_player_name(player.name)
            amount_invested = sum(buy_in.amount for buy_in in player.buy_ins)
            pnl = (player.final_chips or 0) * chip_value - amount_invested
            entry = stats.setdefault(name, {
                "name": name, "games_played": 0, "wins": 0, "losses": 0,
                "breakeven": 0, "net_winnings": 0.0,
            })
            entry["games_played"] += 1
            entry["net_winnings"] += pnl
            if pnl > 0:
                entry["wins"] += 1
            elif pnl < 0:
                entry["losses"] += 1
            else:
                entry["breakeven"] += 1

    players = []
    for entry in stats.values():
        games_played = entry["games_played"]
        average_per_game = entry["net_winnings"] / games_played
        # This moderates small samples: a one-game result counts as 25% of its
        # average, while a long-running record increasingly reflects its average.
        experience_score = average_per_game * games_played / (games_played + 3)
        players.append({
            **entry,
            "net_winnings": round(entry["net_winnings"], 2),
            "average_per_game": round(average_per_game, 2),
            "win_rate": round(entry["wins"] * 100 / games_played, 1),
            "experience_score": round(experience_score, 2),
            "overall_rank": 0,
            "regular_rank": None,
        })

    players.sort(key=lambda player: (-player["net_winnings"], -player["games_played"], player["name"]))
    for index, player in enumerate(players, start=1):
        player["overall_rank"] = index

    regulars = sorted(
        (player for player in players if player["games_played"] >= 3),
        key=lambda player: (-player["experience_score"], -player["games_played"], player["name"]),
    )
    for index, player in enumerate(regulars, start=1):
        player["regular_rank"] = index

    return schemas.LeaderboardOut(
        genuine_games=len(genuine_games),
        minimum_games_for_regular_rank=3,
        players=players,
    )


@router.post("/{game_id}/count-chips")
async def count_chips(game_id: int, image: UploadFile = File(...)):
    """Use Gemini Vision to count chips by colour from an uploaded photo."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="Chip counting not configured")

    image_bytes = await image.read()
    mime = image.content_type or "image/jpeg"
    b64_image = base64.b64encode(image_bytes).decode()
    print(f"[count-chips] received file: mime={mime} size={len(image_bytes)} bytes", flush=True)

    prompt = (
        "You are an expert at counting poker chips from photos.\n\n"
        "CHIP COLOURS AND VALUES:\n"
        "- Black chips = 100\n"
        "- Green chips = 50\n"
        "- Red chips = 20\n"
        "- White/grey chips = 10\n"
        "- Blue chips = 5\n\n"
        "INSTRUCTIONS:\n"
        "1. Count EVERY chip visible, including stacked chips (count each chip in a stack individually).\n"
        "2. For stacked chips, estimate the number of chips in the stack from the height.\n"
        "3. Identify chip colour by the dominant colour of the chip body, not the edge markings.\n"
        "4. If a colour is not present return 0.\n"
        "5. Double-check your count before responding.\n\n"
        "Respond with ONLY a raw JSON object — no markdown, no explanation, no code blocks:\n"
        '{"black": 0, "green": 0, "red": 0, "white": 0, "blue": 0}'
    )

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime, "data": b64_image}},
            ]
        }],
        "generationConfig": {
        "temperature": 1,
        "thinkingConfig": {"thinkingBudget": 1024},
    },
    }

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.post(url, params={"key": api_key}, json=payload)

    if resp.status_code != 200:
        print(f"[count-chips] Gemini error {resp.status_code}: {resp.text[:400]}", flush=True)
        raise HTTPException(status_code=502, detail=f"Gemini API error {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    candidates = data.get("candidates", [])
    if not candidates:
        raise HTTPException(status_code=422, detail=f"No candidates in response: {str(data)[:200]}")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        raise HTTPException(status_code=422, detail=f"No parts in candidate: {str(candidates[0])[:200]}")

    text = parts[0].get("text", "").strip()
    print(f"[count-chips] model raw response: {repr(text)}", flush=True)

    match = re.search(r'\{.*?\}', text, re.DOTALL)
    if not match:
        raise HTTPException(status_code=422, detail=f"Could not parse chip counts. Model said: {text[:200]}")

    try:
        counts = json.loads(match.group())
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Invalid JSON from vision model")

    return {k: max(0, int(counts.get(k, 0))) for k in ("black", "green", "red", "white", "blue")}


def _build_results(game: models.Game) -> schemas.GameResults:
    chip_value = game.buy_in_amount / game.chips_per_buyin
    players = []

    for player in game.players:
        buy_in_count = len(player.buy_ins)
        amount_invested = sum(buy_in.amount for buy_in in player.buy_ins)
        chips_invested = sum(buy_in.chips for buy_in in player.buy_ins)
        final = player.final_chips or 0
        profit_loss_chips = final - chips_invested
        profit_loss_inr = round(final * chip_value - amount_invested, 2)

        players.append(schemas.PlayerResult(
            player_id=player.id,
            name=player.name,
            avatar=player.avatar,
            is_banker=player.is_banker,
            phone=player.phone,
            buy_in_count=buy_in_count,
            amount_invested=amount_invested,
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
