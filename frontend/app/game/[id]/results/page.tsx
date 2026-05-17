"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api, GameResults, PlayerResult } from "@/lib/api";
import { avatarUrl } from "@/lib/avatars";
import { getPasscode, clearPasscode } from "@/lib/passcode";
import PasscodeGate from "@/components/PasscodeGate";

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
          Game #{id} · Buy-in ₹{results.buy_in_amount}
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

      {/* WhatsApp sharing */}
      <WhatsAppShare results={results} />

      <button className="btn btn-gold w-full mt-4" onClick={() => router.push("/")}>
        New Game ♠
      </button>
    </main>
  );
}

function buildMessage(results: GameResults): string {
  const sorted = [...results.players].sort((a, b) => b.profit_loss_inr - a.profit_loss_inr);
  const banker = results.players.find((p) => p.is_banker);
  const settlements = results.players.filter((p) => !p.is_banker && p.profit_loss_inr > 0);
  const medals = ["🥇", "🥈", "🥉"];

  // Result rows — padded with spaces for rough alignment
  const resultLines = sorted.map((p, i) => {
    const pl = p.profit_loss_inr;
    const medal = pl > 0 && i < 3 ? medals[i] : "  ";
    const plStr =
      pl > 0 ? `+₹${pl.toFixed(0)} ✅` : pl < 0 ? `-₹${Math.abs(pl).toFixed(0)} ❌` : `₹0 —`;
    const crown = p.is_banker ? " 👑" : "";
    return `${medal} *${p.name}*${crown}   ${plStr}`;
  });

  // Settlement rows
  const settlementLines =
    settlements.length > 0 && banker
      ? [
          ``,
          `💸 *Settlement*`,
          ...settlements.map(
            (p) => `${banker.name} pays *${p.name}* ₹${p.profit_loss_inr.toFixed(0)}`
          ),
        ]
      : [];

  const divider = `━━━━━━━━━━━━━━━━━`;

  return [
    `♠ *POKER NIGHT — GAME #${results.game_id}*`,
    ``,
    `Buy-in: ₹${results.buy_in_amount}  |  ${results.chips_per_buyin} chips`,
    divider,
    `*🏆 FINAL RESULTS*`,
    divider,
    ``,
    ...resultLines,
    ...settlementLines,
    ``,
    divider,
    `_Poker Night_ ♠`,
  ].join("\n");
}

function whatsappUrl(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

function WhatsAppShare({ results }: { results: GameResults }) {
  const playersWithPhone = results.players.filter((p) => p.phone);
  if (playersWithPhone.length === 0) return null;

  const message = buildMessage(results);

  return (
    <div className="card p-4 mb-4">
      <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
        <span>💬</span> Send Results via WhatsApp
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
        Tap to open WhatsApp with the results pre-filled
      </p>
      <div className="space-y-2">
        {playersWithPhone.map((player) => {
          const pl = player.profit_loss_inr;
          return (
            <a
              key={player.player_id}
              href={whatsappUrl(player.phone!, message)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-all"
              style={{
                background: "rgba(37,211,102,0.08)",
                border: "1px solid rgba(37,211,102,0.25)",
                textDecoration: "none",
              }}
            >
              <div className="flex items-center gap-2">
                <img
                  src={avatarUrl(player.avatar)}
                  alt={player.name}
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {player.name}
                    {player.is_banker && " 👑"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {player.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className="text-sm font-bold"
                  style={{ color: pl >= 0 ? "#27ae60" : "#e74c3c" }}
                >
                  {pl >= 0 ? "+" : ""}₹{pl.toFixed(0)}
                </span>
                <span className="text-lg">↗</span>
              </div>
            </a>
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
