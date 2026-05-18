"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api, GameResults, PlayerResult } from "@/lib/api";
import { avatarUrl } from "@/lib/avatars";
import { getPasscode, clearPasscode } from "@/lib/passcode";
import PasscodeGate from "@/components/PasscodeGate";

const ADJECTIVES = ["Royal","Lucky","Wild","Golden","Blazing","Shadow","Thunder","Crimson","Midnight","Silver","Velvet","Rusty","Neon","Frozen","Stormy"];
const ANIMALS = ["Tiger","Wolf","Eagle","Lion","Shark","Cobra","Falcon","Bear","Fox","Panther","Jaguar","Raven","Viper","Lynx","Bison"];
function gameName(id: number): string {
  return `${ADJECTIVES[id % ADJECTIVES.length]} ${ANIMALS[Math.floor(id / ADJECTIVES.length) % ANIMALS.length]}`;
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const gameId = parseInt(id);
  const router = useRouter();
  const [passcode, setPasscode] = useState<string | null>(null);
  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = getPasscode(gameId);
    if (saved) setPasscode(saved);
    else setLoading(false);
  }, [gameId]);

  useEffect(() => {
    if (!passcode) return;
    setLoading(true);
    api.getResults(gameId, passcode)
      .then(setResults)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("403")) { clearPasscode(gameId); setPasscode(null); }
        else setError(msg);
      })
      .finally(() => setLoading(false));
  }, [passcode, gameId]);

  if (!passcode) return <PasscodeGate gameId={gameId} onVerified={setPasscode} />;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-gold text-4xl animate-pulse">♠</div></div>;
  if (!results) return <div className="min-h-screen flex items-center justify-center text-red-400">{error}</div>;

  const banker = results.players.find((p) => p.is_banker);
  const sorted = [...results.players].sort((a, b) => b.profit_loss_inr - a.profit_loss_inr);
  const winner = sorted[0];

  // Settlement: banker pays winners, receives from losers (all accounted through buy-ins already)
  // Banker's net = -(sum of all other players' profits)
  const settlements = results.players
    .filter((p) => !p.is_banker && p.profit_loss_inr > 0)
    .map((p) => ({ player: p, amount: p.profit_loss_inr }));

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">🏆</div>
        <h1 className="text-2xl font-bold text-gold">Game Over</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {gameName(gameId)} · Buy-in ₹{results.buy_in_amount}
        </p>
      </div>

      {/* Winner banner */}
      {winner && winner.profit_loss_inr > 0 && (
        <div
          className="rounded-xl p-4 mb-6 text-center border"
          style={{
            background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))",
            borderColor: "var(--gold)",
          }}
        >
          <img
            src={avatarUrl(winner.avatar)}
            alt={winner.name}
            className="w-14 h-14 rounded-full mx-auto mb-2 border-2"
            style={{ borderColor: "var(--gold)" }}
          />
          <p className="text-gold font-bold">{winner.name} wins!</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            +₹{winner.profit_loss_inr.toFixed(0)} profit
          </p>
        </div>
      )}

      {/* Results table */}
      <div className="card overflow-hidden mb-6">
        <div
          className="grid grid-cols-4 text-xs font-medium px-4 py-2"
          style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}
        >
          <span className="col-span-2">Player</span>
          <span className="text-right">Chips</span>
          <span className="text-right">P&L</span>
        </div>
        {sorted.map((player) => (
          <PlayerRow key={player.player_id} player={player} />
        ))}
      </div>

      {/* Settlement */}
      {banker && settlements.length > 0 && (
        <div className="card p-4 mb-6">
          <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--muted)" }}>
            💸 Settlement ({banker.name} pays)
          </h3>
          <div className="space-y-2">
            {settlements.map(({ player, amount }) => (
              <div key={player.player_id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <img
                    src={avatarUrl(player.avatar)}
                    alt={player.name}
                    className="w-7 h-7 rounded-full"
                  />
                  <span>{player.name}</span>
                </div>
                <span className="font-bold" style={{ color: "#27ae60" }}>
                  ₹{amount.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
          {banker.profit_loss_inr !== 0 && (
            <p className="text-xs mt-3 pt-3" style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
              {banker.name} net:{" "}
              <span style={{ color: banker.profit_loss_inr >= 0 ? "#27ae60" : "#e74c3c", fontWeight: 700 }}>
                {banker.profit_loss_inr >= 0 ? "+" : ""}₹{banker.profit_loss_inr.toFixed(0)}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Result card image */}
      <ResultCardShare gameId={gameId} />

      {/* WhatsApp sharing */}
      <WhatsAppShare results={results} gameId={gameId} />

      <button className="btn btn-gold w-full mt-4" onClick={() => router.push("/")}>
        New Game ♠
      </button>
    </main>
  );
}

function ResultCardShare({ gameId }: { gameId: number }) {
  return (
    <div className="card p-4 mb-4">
      <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--muted)" }}>
        Result Card
      </h3>
      <img
        src={`/api/result-card/${gameId}`}
        alt="Result card"
        className="w-full rounded-lg"
        style={{ border: "1px solid var(--border)" }}
      />
    </div>
  );
}

function WhatsAppShare({ results, gameId }: { results: GameResults; gameId: number }) {
  const playersWithPhone = results.players.filter((p) => p.phone);
  if (playersWithPhone.length === 0) return null;

  const [copiedId, setCopiedId] = useState<number | null>(null);

  async function sendTo(player: PlayerResult) {
    try {
      const blob = await fetch(`/api/result-card/${gameId}`).then((r) => r.blob());
      // Copy image to clipboard
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } catch {
      // clipboard write not supported — skip silently
    }
    // Open WhatsApp to this contact (image is now in clipboard — user just pastes)
    const phone = player.phone!.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}`, "_blank");
    setCopiedId(player.player_id);
    setTimeout(() => setCopiedId(null), 4000);
  }

  return (
    <div className="card p-4 mb-4">
      <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--muted)" }}>
        Share via WhatsApp
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
        Tap a player — image is copied to clipboard, WhatsApp opens. Just paste.
      </p>
      <div className="space-y-2">
        {playersWithPhone.map((player) => {
          const pl = player.profit_loss_inr;
          const copied = copiedId === player.player_id;
          return (
            <button
              key={player.player_id}
              onClick={() => sendTo(player)}
              className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 transition-all"
              style={{
                background: copied ? "rgba(37,211,102,0.18)" : "rgba(37,211,102,0.08)",
                border: `1px solid ${copied ? "rgba(37,211,102,0.6)" : "rgba(37,211,102,0.25)"}`,
                cursor: "pointer",
              }}
            >
              <div className="flex items-center gap-2">
                <img src={avatarUrl(player.avatar)} alt={player.name} className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {player.name}{player.is_banker && " 👑"}
                  </p>
                  {copied ? (
                    <p className="text-xs font-medium" style={{ color: "#25d366" }}>Copied! Paste in WhatsApp</p>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{player.phone}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-bold" style={{ color: pl >= 0 ? "#27ae60" : "#e74c3c" }}>
                  {pl >= 0 ? "+" : ""}₹{pl.toFixed(0)}
                </span>
                <span className="text-base" style={{ color: "#25d366" }}>{copied ? "✓" : "↗"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlayerRow({ player }: { player: PlayerResult }) {
  const profit = player.profit_loss_inr;
  const isPositive = profit > 0;
  const isNeutral = profit === 0;

  return (
    <div
      className="grid grid-cols-4 items-center px-4 py-3 border-b last:border-b-0"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="col-span-2 flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full overflow-hidden border flex-shrink-0"
          style={{ borderColor: player.is_banker ? "var(--gold)" : "var(--border)" }}
        >
          <img src={avatarUrl(player.avatar)} alt={player.name} className="w-full h-full" />
        </div>
        <div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">{player.name}</span>
            {player.is_banker && <span className="text-xs">👑</span>}
          </div>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {player.buy_in_count}× buy-in
          </span>
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm">{player.final_chips.toLocaleString()}</span>
      </div>
      <div className="text-right">
        <span
          className="text-sm font-bold"
          style={{
            color: isNeutral ? "var(--muted)" : isPositive ? "#27ae60" : "#e74c3c",
          }}
        >
          {isPositive ? "+" : ""}₹{profit.toFixed(0)}
        </span>
      </div>
    </div>
  );
}
