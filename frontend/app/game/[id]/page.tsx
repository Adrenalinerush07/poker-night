"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api, Game, Player } from "@/lib/api";
import { avatarUrl } from "@/lib/avatars";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPlayer, setActionPlayer] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getGame(parseInt(id))
      .then(setGame)
      .catch(() => setError("Game not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const updatePlayer = (updated: Player) => {
    setGame((prev) =>
      prev
        ? { ...prev, players: prev.players.map((p) => (p.id === updated.id ? updated : p)) }
        : prev
    );
  };

  const handleBuyIn = async (player: Player) => {
    if (!game || actionPlayer !== null) return;
    setActionPlayer(player.id);
    try {
      updatePlayer(await api.addBuyIn(game.id, player.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add buy-in");
    } finally {
      setActionPlayer(null);
    }
  };

  const handleRemoveBuyIn = async (player: Player) => {
    if (!game || actionPlayer !== null) return;
    setActionPlayer(player.id);
    try {
      updatePlayer(await api.removeBuyIn(game.id, player.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cannot remove buy-in");
    } finally {
      setActionPlayer(null);
    }
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
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
    // One full-screen canvas — no header, no footer
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Felt texture across the whole bg */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 50%, rgba(26,58,42,0.8) 0%, transparent 70%)",
        }}
      />

      {/* Floating info pill — top center */}
      <div
        className="absolute top-4 left-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-full"
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
        <span style={{ color: "var(--border)" }}>·</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          👑 {banker?.name}
        </span>
      </div>

      {/* Error toast */}
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

      {/* Table + players — centered on screen */}
      <PokerTable
        game={game}
        onBuyIn={handleBuyIn}
        onRemoveBuyIn={handleRemoveBuyIn}
        actionPlayer={actionPlayer}
      />

      {/* End game — floating pill button at bottom center */}
      <div className="absolute bottom-8 left-1/2 z-30" style={{ transform: "translateX(-50%)" }}>
        <button
          onClick={() => router.push(`/game/${id}/end`)}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm"
          style={{
            background: "rgba(192,57,43,0.85)",
            border: "1px solid rgba(192,57,43,0.6)",
            color: "white",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            whiteSpace: "nowrap",
          }}
        >
          <span>🏁</span> End Game &amp; Count Chips
        </button>
      </div>
    </div>
  );
}

function PokerTable({
  game,
  onBuyIn,
  onRemoveBuyIn,
  actionPlayer,
}: {
  game: Game;
  onBuyIn: (p: Player) => void;
  onRemoveBuyIn: (p: Player) => void;
  actionPlayer: number | null;
}) {
  const players = game.players;
  const count = players.length;

  // Orbit radii as % of the container (which is the full viewport via fixed inset-0)
  // Tighter radii keep players away from screen edges
  const positions = players.map((_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    return {
      x: 50 + 40 * Math.cos(angle),
      y: 50 + 33 * Math.sin(angle),
    };
  });

  return (
    // Covers the full fixed parent
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Oval table — bigger, more prominent */}
      <div
        className="relative flex-shrink-0"
        style={{
          width: "min(62vw, 260px)",
          aspectRatio: "16 / 10",
        }}
      >
        {/* Outer wood rim */}
        <div
          className="absolute inset-0 rounded-[50%]"
          style={{
            background: "linear-gradient(145deg, #6b4423, #3d2610)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        />
        {/* Inner rail */}
        <div
          className="absolute rounded-[50%]"
          style={{
            inset: "7px",
            background: "linear-gradient(145deg, #4a2e14, #2a1a08)",
          }}
        />
        {/* Felt surface */}
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

      {/* Player cards — positioned around the table */}
      {players.map((player, i) => {
        const pos = positions[i];
        const buyInCount = player.buy_ins.length;
        return (
          <div
            key={player.id}
            className="absolute"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 10,
            }}
          >
            <PlayerCard
              player={player}
              buyInCount={buyInCount}
              totalInvested={buyInCount * game.buy_in_amount}
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
  player,
  buyInCount,
  totalInvested,
  onBuyIn,
  onRemoveBuyIn,
  loading,
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
      className="flex flex-col items-center gap-1 rounded-xl px-2 py-2"
      style={{
        width: 72,
        background: "rgba(15,34,24,0.75)",
        border: `1px solid ${player.is_banker ? "rgba(212,175,55,0.5)" : "rgba(36,82,55,0.6)"}`,
        backdropFilter: "blur(6px)",
        boxShadow: player.is_banker
          ? "0 0 12px rgba(212,175,55,0.2)"
          : "0 2px 12px rgba(0,0,0,0.4)",
      }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
        style={{
          border: `2px solid ${player.is_banker ? "var(--gold)" : "var(--border)"}`,
        }}
      >
        <img src={avatarUrl(player.avatar)} alt={player.name} className="w-full h-full" />
      </div>

      {/* Name */}
      <span
        className="text-center leading-tight font-medium"
        style={{
          fontSize: 10,
          color: player.is_banker ? "var(--gold)" : "var(--text)",
          maxWidth: 64,
          wordBreak: "break-word",
          lineHeight: 1.2,
        }}
      >
        {player.is_banker ? "👑 " : ""}
        {player.name}
      </span>

      {/* Amount */}
      <span style={{ fontSize: 9, color: "var(--muted)" }}>
        ₹{totalInvested.toLocaleString()}
      </span>

      {/* Buy-in controls */}
      <div className="flex items-center gap-1 w-full">
        {buyInCount > 1 && (
          <button
            onClick={onRemoveBuyIn}
            disabled={loading}
            title="Undo last buy-in"
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              fontSize: 13,
              lineHeight: 1,
              flexShrink: 0,
              background: "rgba(192,57,43,0.25)",
              border: "1px solid rgba(192,57,43,0.4)",
              color: "#e74c3c",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            −
          </button>
        )}
        <button
          onClick={onBuyIn}
          disabled={loading}
          style={{
            flex: 1,
            padding: "3px 4px",
            fontSize: 9,
            fontWeight: 700,
            borderRadius: 5,
            background: loading
              ? "rgba(39,174,96,0.3)"
              : "linear-gradient(135deg, #27ae60, #1e8449)",
            color: "white",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            letterSpacing: "0.3px",
          }}
        >
          {loading ? "…" : `+1  ×${buyInCount}`}
        </button>
      </div>
    </div>
  );
}
