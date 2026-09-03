"use client";

import { useState, useEffect, use, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, Game, Player } from "@/lib/api";
import { avatarUrl } from "@/lib/avatars";
import { getPasscode, clearPasscode } from "@/lib/passcode";
import PasscodeGate from "@/components/PasscodeGate";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const gameId = parseInt(id);
  const router = useRouter();

  const [passcode, setPasscode] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPlayer, setActionPlayer] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [addPlayerDialogOpen, setAddPlayerDialogOpen] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [customBuyInPlayer, setCustomBuyInPlayer] = useState<Player | null>(null);

  // On mount, check sessionStorage for a saved passcode
  useEffect(() => {
    const saved = getPasscode(gameId);
    if (saved) setPasscode(saved);
    else setLoading(false);
  }, [gameId]);

  // Once we have a passcode, load the game
  useEffect(() => {
    if (!passcode) return;
    setLoading(true);
    api.getGame(gameId, passcode)
      .then(setGame)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("403")) {
          clearPasscode(gameId);
          setPasscode(null);
        } else {
          setError("Game not found");
        }
      })
      .finally(() => setLoading(false));
  }, [passcode, gameId]);

  const updatePlayer = (updated: Player) =>
    setGame((prev) =>
      prev ? { ...prev, players: prev.players.map((p) => (p.id === updated.id ? updated : p)) } : prev
    );

  const handleBuyIn = async (player: Player) => {
    if (!game || !passcode || actionPlayer !== null) return;
    if (player.buy_ins.length >= 2) {
      setCustomBuyInPlayer(player);
      return;
    }
    setActionPlayer(player.id);
    try {
      updatePlayer(await api.addBuyIn(game.id, player.id, passcode));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add buy-in");
    } finally {
      setActionPlayer(null);
    }
  };

  const handleCustomBuyIn = async (player: Player, amount: number) => {
    if (!game || !passcode || actionPlayer !== null) return;
    setActionPlayer(player.id);
    try {
      updatePlayer(await api.addBuyIn(game.id, player.id, passcode, amount));
      setCustomBuyInPlayer(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add buy-in");
      throw e;
    } finally {
      setActionPlayer(null);
    }
  };

  const handleRemoveBuyIn = async (player: Player) => {
    if (!game || !passcode || actionPlayer !== null) return;
    setActionPlayer(player.id);
    try {
      updatePlayer(await api.removeBuyIn(game.id, player.id, passcode));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cannot remove buy-in");
    } finally {
      setActionPlayer(null);
    }
  };

  const handleAddPlayer = async (name: string, phone: string) => {
    if (!game || !passcode || addingPlayer) return;
    setAddingPlayer(true);
    setError("");
    try {
      const player = await api.addPlayer(game.id, { name, phone }, passcode);
      setGame((prev) => prev ? { ...prev, players: [...prev.players, player] } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add player");
      throw e;
    } finally {
      setAddingPlayer(false);
    }
  };

  // No passcode yet — show gate
  if (!passcode) return <PasscodeGate gameId={gameId} onVerified={setPasscode} />;

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-gold text-5xl animate-pulse">♠</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <p className="text-red-400">{error || "Game not found"}</p>
      </div>
    );
  }

  if (game.status === "ended") {
    router.replace(`/game/${id}/results`);
    return null;
  }

  const banker = game.players.find((p) => p.is_banker);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "var(--bg)" }}>
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 50%, rgba(26,58,42,0.8) 0%, transparent 70%)",
        }}
      />

      {/* Compact header leaves room for the table on small screens. */}
      <div
        className="absolute top-3 left-1/2 z-30 flex max-w-[calc(100%-24px)] items-center gap-2 rounded-full px-3 py-2 sm:top-4 sm:gap-3 sm:px-4"
        style={{
          transform: "translateX(-50%)",
          background: "rgba(21,43,30,0.9)",
          border: "1px solid var(--border)",
          backdropFilter: "blur(8px)",
          whiteSpace: "nowrap",
        }}
      >
        <span className="text-xs font-bold text-gold">Game #{game.id}</span>
        <span style={{ color: "var(--border)" }}>·</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          ₹{game.buy_in_amount} / {game.chips_per_buyin} chips
        </span>
        <span className="hidden sm:inline" style={{ color: "var(--border)" }}>·</span>
        <span className="hidden text-xs sm:inline" style={{ color: "var(--muted)" }}>👑 {banker?.name}</span>
      </div>

      {error && (
        <div
          className="absolute top-16 left-1/2 z-40 px-4 py-2 rounded-lg text-xs text-red-300"
          style={{
            transform: "translateX(-50%)",
            background: "rgba(192,57,43,0.2)",
            border: "1px solid rgba(192,57,43,0.4)",
          }}
        >
          {error}
        </div>
      )}

      <PokerTable
        game={game}
        onBuyIn={handleBuyIn}
        onRemoveBuyIn={handleRemoveBuyIn}
        actionPlayer={actionPlayer}
      />

      {/* A single bottom dock prevents primary actions from colliding on phones. */}
      <div className="absolute inset-x-3 bottom-3 z-30 flex gap-2 sm:inset-x-auto sm:bottom-8 sm:left-5">
        <button
          onClick={() => setAddPlayerDialogOpen(true)}
          disabled={addingPlayer}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold sm:flex-none sm:rounded-full sm:px-4"
          style={{
            background: "rgba(39,174,96,0.9)",
            border: "1px solid rgba(39,174,96,0.65)",
            color: "white",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          <span>＋</span> Add player
        </button>
        <button
          onClick={() => router.push(`/game/${id}/end`)}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold sm:flex-none sm:rounded-full sm:px-6"
          style={{
            background: "rgba(192,57,43,0.85)",
            border: "1px solid rgba(192,57,43,0.6)",
            color: "white",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            whiteSpace: "nowrap",
          }}
        >
          <span>🏁</span><span className="sm:hidden">End game</span><span className="hidden sm:inline">End Game &amp; Count Chips</span>
        </button>
      </div>

      {addPlayerDialogOpen && (
        <AddPlayerDialog
          buyInAmount={game.buy_in_amount}
          submitting={addingPlayer}
          onClose={() => setAddPlayerDialogOpen(false)}
          onSubmit={async (name, phone) => {
            await handleAddPlayer(name, phone);
            setAddPlayerDialogOpen(false);
          }}
        />
      )}

      {customBuyInPlayer && (
        <CustomBuyInDialog
          player={customBuyInPlayer}
          game={game}
          submitting={actionPlayer === customBuyInPlayer.id}
          onClose={() => setCustomBuyInPlayer(null)}
          onSubmit={(amount) => handleCustomBuyIn(customBuyInPlayer, amount)}
        />
      )}
    </div>
  );
}

function CustomBuyInDialog({
  player, game, submitting, onClose, onSubmit,
}: {
  player: Player;
  game: Game;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const numericAmount = Number(amount);
  const chips = Number.isFinite(numericAmount) && numericAmount > 0
    ? Math.round(numericAmount * game.chips_per_buyin / game.buy_in_amount)
    : 0;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || chips <= 0) {
      setError("Enter a valid buy-in amount.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(numericAmount);
    } catch {
      setError("Could not add the buy-in. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "#152b1e", border: "1px solid var(--border)", boxShadow: "0 12px 36px rgba(0,0,0,0.55)" }}
      >
        <div>
          <h2 className="font-bold text-lg text-gold">Custom buy-in</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {player.name}&apos;s third and later buy-ins use the game&apos;s original rate.
          </p>
        </div>
        <label className="block text-sm" style={{ color: "var(--muted)" }}>
          Amount (₹)
          <input
            autoFocus
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1"
            placeholder={`e.g. ${game.buy_in_amount}`}
          />
        </label>
        {chips > 0 && (
          <div className="rounded-lg p-3 text-sm" style={{ background: "var(--felt)", color: "var(--muted)" }}>
            ₹{numericAmount.toLocaleString()} gives {chips.toLocaleString()} chips
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={saving || submitting} className="btn btn-ghost flex-1">Cancel</button>
          <button type="submit" disabled={saving || submitting} className="btn btn-gold flex-1">{saving || submitting ? "Adding…" : "Add buy-in"}</button>
        </div>
      </form>
    </div>
  );
}

function AddPlayerDialog({
  buyInAmount, submitting, onClose, onSubmit,
}: {
  buyInAmount: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (name: string, phone: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Enter the player's name and phone number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(name.trim(), phone.trim());
    } catch {
      setError("Could not add the player. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "#152b1e", border: "1px solid var(--border)", boxShadow: "0 12px 36px rgba(0,0,0,0.55)" }}
      >
        <div>
          <h2 className="font-bold text-lg text-gold">Add player</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            They will join with one ₹{buyInAmount.toLocaleString()} buy-in at this table's current rate.
          </p>
        </div>
        <label className="block text-sm" style={{ color: "var(--muted)" }}>
          Name
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={20} className="mt-1" placeholder="Player name" />
        </label>
        <label className="block text-sm" style={{ color: "var(--muted)" }}>
          Phone number
          <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} className="mt-1" placeholder="Phone number" />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={saving || submitting} className="btn btn-ghost flex-1">Cancel</button>
          <button type="submit" disabled={saving || submitting} className="btn btn-gold flex-1">{saving || submitting ? "Adding…" : "Add to table"}</button>
        </div>
      </form>
    </div>
  );
}

function PokerTable({
  game, onBuyIn, onRemoveBuyIn, actionPlayer,
}: {
  game: Game;
  onBuyIn: (p: Player) => void;
  onRemoveBuyIn: (p: Player) => void;
  actionPlayer: number | null;
}) {
  const players = game.players;
  const count = players.length;

  const positions = players.map((_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    return { x: 50 + 40 * Math.cos(angle), y: 50 + 35 * Math.sin(angle) };
  });

  return (
    <div className="absolute inset-x-0 top-[72px] bottom-[76px] flex items-center justify-center sm:inset-0">
      {/* Oval table */}
      <div className="relative w-[76vw] max-w-[360px] flex-shrink-0 sm:w-[62vw] sm:max-w-[300px]" style={{ aspectRatio: "16/10" }}>
        <div
          className="absolute inset-0 rounded-[50%]"
          style={{
            background: "linear-gradient(145deg, #6b4423, #3d2610)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        />
        <div
          className="absolute rounded-[50%]"
          style={{ inset: "7px", background: "linear-gradient(145deg, #4a2e14, #2a1a08)" }}
        />
        <div
          className="absolute rounded-[50%] flex items-center justify-center"
          style={{
            inset: "16px",
            background: "radial-gradient(ellipse at 40% 35%, #245237 0%, #1a3a2a 60%, #122a1e 100%)",
          }}
        >
          <span
            className="select-none font-bold"
            style={{ fontSize: "clamp(20px, 5vw, 36px)", color: "rgba(255,255,255,0.06)" }}
          >
            ♠
          </span>
        </div>
      </div>

      {players.map((player, i) => {
        const pos = positions[i];
        const buyInCount = player.buy_ins.length;
        const totalInvested = player.buy_ins.reduce((sum, buyIn) => sum + buyIn.amount, 0);
        return (
          <div
            key={player.id}
            className="absolute"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)", zIndex: 10 }}
          >
            <PlayerCard
              player={player}
              buyInCount={buyInCount}
              totalInvested={totalInvested}
              onBuyIn={() => onBuyIn(player)}
              onRemoveBuyIn={() => onRemoveBuyIn(player)}
              loading={actionPlayer === player.id}
            />
          </div>
        );
      })}
    </div>
  );
}

function PlayerCard({
  player, buyInCount, totalInvested, onBuyIn, onRemoveBuyIn, loading,
}: {
  player: Player;
  buyInCount: number;
  totalInvested: number;
  onBuyIn: () => void;
  onRemoveBuyIn: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="flex w-[66px] flex-col items-center gap-1 rounded-xl px-2 py-2 sm:w-[72px]"
      style={{
        background: "rgba(15,34,24,0.75)",
        border: `1px solid ${player.is_banker ? "rgba(212,175,55,0.5)" : "rgba(36,82,55,0.6)"}`,
        backdropFilter: "blur(6px)",
        boxShadow: player.is_banker ? "0 0 12px rgba(212,175,55,0.2)" : "0 2px 12px rgba(0,0,0,0.4)",
      }}
    >
      <div
        className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
        style={{ border: `2px solid ${player.is_banker ? "var(--gold)" : "var(--border)"}` }}
      >
        <img src={avatarUrl(player.avatar)} alt={player.name} className="w-full h-full" />
      </div>
      <span
        className="text-center leading-tight font-medium"
        style={{ fontSize: 10, color: player.is_banker ? "var(--gold)" : "var(--text)", maxWidth: 64, wordBreak: "break-word", lineHeight: 1.2 }}
      >
        {player.is_banker ? "👑 " : ""}{player.name}
      </span>
      <span style={{ fontSize: 9, color: "var(--muted)" }}>₹{totalInvested.toLocaleString()}</span>
      <div className="flex items-center gap-1 w-full">
        {buyInCount > 1 && (
          <button
            onClick={onRemoveBuyIn}
            disabled={loading}
            style={{
              width: 18, height: 18, borderRadius: 4, fontSize: 13, lineHeight: 1, flexShrink: 0,
              background: "rgba(192,57,43,0.25)", border: "1px solid rgba(192,57,43,0.4)",
              color: "#e74c3c", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >−</button>
        )}
        <button
          onClick={onBuyIn}
          disabled={loading}
          style={{
            flex: 1, padding: "3px 4px", fontSize: 9, fontWeight: 700, borderRadius: 5,
            background: loading ? "rgba(39,174,96,0.3)" : "linear-gradient(135deg, #27ae60, #1e8449)",
            color: "white", border: "none", cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap",
          }}
        >
          {loading ? "…" : buyInCount >= 2 ? "Custom +" : `+1  ×${buyInCount}`}
        </button>
      </div>
    </div>
  );
}
