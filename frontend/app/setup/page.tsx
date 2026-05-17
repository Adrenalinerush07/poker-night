"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { avatarUrl, randomAnimal } from "@/lib/avatars";
import { api } from "@/lib/api";

interface PlayerEntry {
  name: string;
  avatar: string;
  is_banker: boolean;
}

function SetupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const count = parseInt(params.get("players") || "4");

  const [step, setStep] = useState<"players" | "buyin">("players");
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [buyInAmount, setBuyInAmount] = useState<string>("500");
  const [chipsPerBuyin, setChipsPerBuyin] = useState<string>("5000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const assigned: string[] = [];
    const initial = Array.from({ length: count }, () => {
      const animal = randomAnimal(assigned);
      assigned.push(animal);
      return { name: "", avatar: animal, is_banker: false };
    });
    initial[0].is_banker = true;
    setPlayers(initial);
  }, [count]);

  const setBanker = (index: number) => {
    setPlayers((prev) =>
      prev.map((p, i) => ({ ...p, is_banker: i === index }))
    );
  };

  const updateName = (index: number, name: string) => {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, name } : p)));
  };

  const playersValid = players.every((p) => p.name.trim().length > 0);
  const buyInValid =
    parseFloat(buyInAmount) > 0 && parseInt(chipsPerBuyin) > 0;

  const handleStart = async () => {
    setLoading(true);
    setError("");
    try {
      const game = await api.createGame({
        buy_in_amount: parseFloat(buyInAmount),
        chips_per_buyin: parseInt(chipsPerBuyin),
        players: players.map((p) => ({
          name: p.name.trim(),
          avatar: p.avatar,
          is_banker: p.is_banker,
        })),
      });
      router.push(`/game/${game.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create game");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => router.push("/")}>
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gold">Game Setup</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        <StepDot active={step === "players"} done={step === "buyin"} label="Players" />
        <div className="flex-1 h-px" style={{ background: step === "buyin" ? "var(--gold)" : "var(--border)" }} />
        <StepDot active={step === "buyin"} done={false} label="Buy-in" />
      </div>

      {step === "players" && (
        <div className="fade-in">
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Enter player names. Tap the crown to set the banker.
          </p>
          <div className="space-y-3">
            {players.map((player, i) => (
              <div key={i} className="card p-4 flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="relative flex-shrink-0 w-12 h-12 rounded-full overflow-hidden border-2 cursor-pointer"
                  style={{ borderColor: player.is_banker ? "var(--gold)" : "var(--border)" }}
                  onClick={() => setBanker(i)}
                >
                  <img
                    src={avatarUrl(player.avatar)}
                    alt={player.avatar}
                    className="w-full h-full"
                  />
                </div>

                {/* Name input */}
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={`Player ${i + 1}`}
                    value={player.name}
                    onChange={(e) => updateName(i, e.target.value)}
                    maxLength={20}
                  />
                </div>

                {/* Banker badge */}
                <button
                  onClick={() => setBanker(i)}
                  className="flex-shrink-0 text-lg transition-all"
                  title="Set as banker"
                  style={{ opacity: player.is_banker ? 1 : 0.3 }}
                >
                  👑
                </button>
              </div>
            ))}
          </div>

          <button
            className="btn btn-gold w-full mt-6"
            disabled={!playersValid}
            onClick={() => setStep("buyin")}
          >
            Next: Buy-in →
          </button>
        </div>
      )}

      {step === "buyin" && (
        <div className="fade-in">
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            Set the buy-in amount and chip value for the game.
          </p>

          <div className="card p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--muted)" }}>
                Buy-in amount (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 500"
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--muted)" }}>
                Chips per buy-in
              </label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={chipsPerBuyin}
                onChange={(e) => setChipsPerBuyin(e.target.value)}
              />
            </div>

            {buyInValid && (
              <div
                className="rounded-lg p-3 text-sm"
                style={{ background: "var(--felt)", color: "var(--muted)" }}
              >
                1 chip = ₹{(parseFloat(buyInAmount) / parseInt(chipsPerBuyin)).toFixed(4)}
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          <div className="flex gap-3 mt-6">
            <button className="btn btn-ghost flex-1" onClick={() => setStep("players")}>
              ← Back
            </button>
            <button
              className="btn btn-gold flex-1"
              disabled={!buyInValid || loading}
              onClick={handleStart}
            >
              {loading ? "Starting..." : "Start Game ♠"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
        style={{
          borderColor: active || done ? "var(--gold)" : "var(--border)",
          background: active ? "var(--gold)" : done ? "var(--felt)" : "transparent",
          color: active ? "var(--felt-dark)" : "var(--gold)",
        }}
      >
        {done ? "✓" : active ? "●" : "○"}
      </div>
      <span className="text-xs" style={{ color: active ? "var(--gold)" : "var(--muted)" }}>
        {label}
      </span>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense>
      <SetupForm />
    </Suspense>
  );
}
