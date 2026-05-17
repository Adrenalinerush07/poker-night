"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api, Game } from "@/lib/api";
import { avatarUrl } from "@/lib/avatars";
import { getPasscode, clearPasscode } from "@/lib/passcode";
import PasscodeGate from "@/components/PasscodeGate";

const DENOMINATIONS = [
  { key: "black", label: "Black", value: 100, color: "#2c2c2c", border: "#555" },
  { key: "green", label: "Green", value: 50,  color: "#1e7a3e", border: "#27ae60" },
  { key: "red",   label: "Red",   value: 20,  color: "#922b21", border: "#e74c3c" },
  { key: "white", label: "White", value: 10,  color: "#c8c8c8", border: "#fff" },
  { key: "blue",  label: "Blue",  value: 5,   color: "#1a5fa8", border: "#3498db" },
] as const;

type DenomKey = (typeof DENOMINATIONS)[number]["key"];
type ChipCounts = Record<DenomKey, string>;

function emptyChipCounts(): ChipCounts {
  return { black: "", green: "", red: "", white: "", blue: "" };
}

function calcTotal(counts: ChipCounts): number {
  return DENOMINATIONS.reduce((sum, d) => {
    const n = parseInt(counts[d.key]);
    return sum + (isNaN(n) ? 0 : n * d.value);
  }, 0);
}

// Empty field = 0 chips of that denomination, which is valid.
// Only invalid if the field has a non-numeric value.
function isComplete(counts: ChipCounts): boolean {
  return DENOMINATIONS.every((d) => {
    const v = counts[d.key].trim();
    if (v === "") return true;
    const n = parseInt(v);
    return !isNaN(n) && n >= 0;
  });
}

export default function EndGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const gameId = parseInt(id);
  const router = useRouter();

  const [passcode, setPasscode] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [chips, setChips] = useState<Record<number, ChipCounts>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = getPasscode(gameId);
    if (saved) setPasscode(saved);
    else setLoading(false);
  }, [gameId]);

  useEffect(() => {
    if (!passcode) return;
    setLoading(true);
    api.getGame(gameId, passcode)
      .then((g) => {
        setGame(g);
        const initial: Record<number, ChipCounts> = {};
        g.players.forEach((p) => { initial[p.id] = emptyChipCounts(); });
        setChips(initial);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("403")) { clearPasscode(gameId); setPasscode(null); }
        else setError("Game not found");
      })
      .finally(() => setLoading(false));
  }, [passcode, gameId]);

  if (!passcode) return <PasscodeGate gameId={gameId} onVerified={setPasscode} />;
  if (loading) return <Spinner />;
  if (!game) return <ErrorMsg msg={error} />;

  const chipValue = game.buy_in_amount / game.chips_per_buyin;
  const totalDistributed = game.players.reduce(
    (sum, p) => sum + p.buy_ins.length * game.chips_per_buyin, 0
  );
  const totalCounted = game.players.reduce((sum, p) => sum + calcTotal(chips[p.id] ?? emptyChipCounts()), 0);
  const allFilled = game.players.every((p) => isComplete(chips[p.id] ?? emptyChipCounts()));
  const diff = totalCounted - totalDistributed;
  const chipsMatch = allFilled && diff === 0;

  const setPlayerDenom = (playerId: number, denom: DenomKey, value: string) => {
    setChips((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [denom]: value },
    }));
  };

  const handleSubmit = async () => {
    if (!game || !chipsMatch) return;
    setSubmitting(true);
    setError("");
    try {
      await api.endGame(
        game.id,
        game.players.map((p) => ({
          player_id: p.id,
          final_chips: calcTotal(chips[p.id]),
        })),
        passcode
      );
      router.push(`/game/${id}/results`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to end game");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-6 max-w-lg mx-auto fade-in pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => router.back()}>
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-gold leading-tight">Count Your Chips</h1>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Enter chips by denomination — totals are calculated automatically
          </p>
        </div>
      </div>

      {/* Chip legend */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl mb-5 flex-wrap"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {DENOMINATIONS.map((d) => (
          <div key={d.key} className="flex items-center gap-1.5">
            <ChipDot color={d.color} border={d.border} size={14} />
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {d.label} = {d.value}
            </span>
          </div>
        ))}
      </div>

      {/* Chip tally bar */}
      <ChipTally
        totalCounted={totalCounted}
        totalDistributed={totalDistributed}
        allFilled={allFilled}
        diff={diff}
      />

      {/* Player cards */}
      <div className="space-y-4 mt-5">
        {game.players.map((player) => {
          const counts = chips[player.id] ?? emptyChipCounts();
          const total = calcTotal(counts);
          const chipsInvested = player.buy_ins.length * game.chips_per_buyin;
          const delta = isComplete(counts) ? total - chipsInvested : null;
          const inr = delta !== null ? delta * chipValue : null;

          return (
            <div key={player.id} className="card overflow-hidden">
              {/* Player header */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div
                  className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2"
                  style={{ borderColor: player.is_banker ? "var(--gold)" : "var(--border)" }}
                >
                  <img src={avatarUrl(player.avatar)} alt={player.name} className="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-sm truncate">{player.name}</span>
                    {player.is_banker && <span className="text-xs flex-shrink-0">👑</span>}
                  </div>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {player.buy_ins.length}× buy-in · {chipsInvested.toLocaleString()} chips in
                  </span>
                </div>
                {/* Live total + P&L */}
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-gold">
                    {total > 0 ? total.toLocaleString() : "—"}
                  </div>
                  {inr !== null && (
                    <div
                      className="text-xs font-semibold"
                      style={{ color: inr >= 0 ? "#27ae60" : "#e74c3c" }}
                    >
                      {inr >= 0 ? "+" : ""}₹{inr.toFixed(0)}
                    </div>
                  )}
                </div>
              </div>

              {/* Denomination inputs */}
              <div className="px-4 py-3 space-y-2">
                {DENOMINATIONS.map((d) => {
                  const count = parseInt(counts[d.key]);
                  const subtotal = !isNaN(count) && counts[d.key] !== "" ? count * d.value : null;
                  return (
                    <div key={d.key} className="flex items-center gap-3">
                      {/* Chip visual */}
                      <div className="flex items-center gap-2 w-20 flex-shrink-0">
                        <ChipDot color={d.color} border={d.border} size={22} label={String(d.value)} />
                        <span style={{ fontSize: 11, color: "var(--muted)", width: 28 }}>
                          ×{d.value}
                        </span>
                      </div>

                      {/* Count input */}
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={counts[d.key]}
                        onChange={(e) => setPlayerDenom(player.id, d.key, e.target.value)}
                        style={{ width: 72, textAlign: "center", padding: "6px 8px", fontSize: 15 }}
                      />

                      {/* Subtotal */}
                      <span
                        className="flex-1 text-right text-sm"
                        style={{ color: subtotal ? "var(--text)" : "var(--border)" }}
                      >
                        {subtotal !== null ? `= ${subtotal.toLocaleString()}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-red-400 text-sm mt-4 text-center">{error}</p>
      )}

      <button
        className="btn btn-gold w-full mt-6"
        disabled={!chipsMatch || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Calculating..." : "Calculate Results ♠"}
      </button>

      {allFilled && !chipsMatch && (
        <p className="text-xs text-center mt-2" style={{ color: "var(--muted)" }}>
          Fix the chip counts above before submitting.
        </p>
      )}
    </main>
  );
}

function ChipDot({
  color,
  border,
  size,
  label,
}: {
  color: string;
  border: string;
  size: number;
  label?: string;
}) {
  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center font-bold"
      style={{
        width: size,
        height: size,
        background: color,
        border: `2px solid ${border}`,
        fontSize: size * 0.35,
        color: "#fff",
        boxShadow: `0 0 6px ${color}55`,
      }}
    >
      {label}
    </div>
  );
}

function ChipTally({
  totalCounted,
  totalDistributed,
  allFilled,
  diff,
}: {
  totalCounted: number;
  totalDistributed: number;
  allFilled: boolean;
  diff: number;
}) {
  const isMatch = allFilled && diff === 0;
  const isWrong = allFilled && diff !== 0;

  const statusColor = isMatch ? "#27ae60" : isWrong ? "#e74c3c" : "var(--border)";
  const bgColor = isMatch
    ? "rgba(39,174,96,0.08)"
    : isWrong
    ? "rgba(231,76,60,0.08)"
    : "var(--surface)";

  return (
    <div
      className="rounded-xl p-4 border transition-all"
      style={{ borderColor: statusColor, background: bgColor }}
    >
      <div className="flex items-end justify-between gap-3">
        {/* Counted */}
        <div>
          <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>Chips counted</p>
          <p className="text-2xl font-bold" style={{ color: allFilled ? statusColor : "var(--text)" }}>
            {totalCounted.toLocaleString()}
          </p>
        </div>

        {/* Divider */}
        <p className="text-xl pb-1" style={{ color: "var(--muted)" }}>/</p>

        {/* Expected */}
        <div className="text-right">
          <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>Expected</p>
          <p className="text-2xl font-bold text-gold">{totalDistributed.toLocaleString()}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="mt-3 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(100, totalDistributed > 0 ? (totalCounted / totalDistributed) * 100 : 0)}%`,
            background: isMatch ? "#27ae60" : isWrong ? "#e74c3c" : "var(--gold)",
          }}
        />
      </div>

      {/* Status message */}
      {isMatch && (
        <p className="text-xs mt-2 font-medium" style={{ color: "#27ae60" }}>
          ✓ All chips accounted for
        </p>
      )}
      {isWrong && (
        <p className="text-xs mt-2 font-medium" style={{ color: "#e74c3c" }}>
          ✗ {Math.abs(diff).toLocaleString()} chips {diff > 0 ? "too many" : "missing"} — recount
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gold text-4xl animate-pulse">♠</div>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-red-400">
      {msg || "Something went wrong"}
    </div>
  );
}
