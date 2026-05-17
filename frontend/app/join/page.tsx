"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { savePasscode } from "@/lib/passcode";

export default function JoinPage() {
  const router = useRouter();
  const [gameId, setGameId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const valid = gameId.trim() !== "" && passcode.trim() !== "";

  const handleJoin = async () => {
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.verifyPasscode(parseInt(gameId), passcode.trim());
      savePasscode(parseInt(gameId), passcode.trim());
      if (res.game_status === "ended") {
        router.push(`/game/${gameId}/results`);
      } else {
        router.push(`/game/${gameId}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to join";
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        setError("Game not found. Check the Game ID.");
      } else if (msg.includes("403") || msg.toLowerCase().includes("invalid")) {
        setError("Wrong passcode. Try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 fade-in">
      <div className="mb-8 text-center">
        <div className="text-4xl mb-3">🃏</div>
        <h1 className="text-2xl font-bold text-gold">Join a Table</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Enter the Game ID and passcode from the host
        </p>
      </div>

      <div className="card p-6 w-full max-w-sm space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
            Game ID
          </label>
          <input
            type="number"
            placeholder="e.g. 42"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
            Passcode
          </label>
          <input
            type="password"
            placeholder="Enter passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          className="btn btn-gold w-full"
          disabled={!valid || loading}
          onClick={handleJoin}
        >
          {loading ? "Joining..." : "Join Table ♠"}
        </button>
      </div>

      <button
        className="btn btn-ghost mt-4 text-sm"
        onClick={() => router.push("/")}
      >
        ← Back
      </button>
    </main>
  );
}
