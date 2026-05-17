"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [playerCount, setPlayerCount] = useState("4");
  const router = useRouter();

  const num = parseInt(playerCount);
  const valid = !isNaN(num) && num >= 4 && num <= 12;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 fade-in">
      {/* Logo */}
      <div className="mb-12 text-center">
        <div className="text-6xl mb-4">♠</div>
        <h1 className="text-4xl font-bold text-gold tracking-wide">Poker Night</h1>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
          Home game helper
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Create Game */}
        <div className="card p-6">
          <h2 className="font-semibold mb-1">Create Game</h2>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Start a new table and set it up
          </p>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
            Number of players
          </label>
          <input
            type="number"
            min={4}
            max={12}
            value={playerCount}
            onChange={(e) => setPlayerCount(e.target.value)}
            placeholder="Min 4, max 12"
          />
          {playerCount && !valid && (
            <p className="text-xs mt-1.5 text-red-400">
              {num < 4 ? "Minimum 4 players" : "Maximum 12 players"}
            </p>
          )}
          <button
            className="btn btn-gold w-full mt-4"
            disabled={!valid}
            onClick={() => router.push(`/setup?players=${num}`)}
          >
            Set Up Table →
          </button>
        </div>

        {/* Join Game */}
        <div className="card p-6">
          <h2 className="font-semibold mb-1">Join Game</h2>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Enter an existing table with a game ID and passcode
          </p>
          <button
            className="btn btn-ghost w-full"
            onClick={() => router.push("/join")}
          >
            Join Table →
          </button>
        </div>
      </div>
    </main>
  );
}
