"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [count, setCount] = useState<string>("4");
  const router = useRouter();

  const num = parseInt(count);
  const valid = !isNaN(num) && num >= 4 && num <= 12;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 fade-in">
      {/* Logo / Header */}
      <div className="mb-12 text-center">
        <div className="text-6xl mb-4">♠</div>
        <h1 className="text-4xl font-bold text-gold tracking-wide">Poker Night</h1>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
          Home game helper
        </p>
      </div>

      <div className="card p-8 w-full max-w-sm">
        <label className="block text-sm font-medium mb-2" style={{ color: "var(--muted)" }}>
          Number of players
        </label>
        <input
          type="number"
          min={4}
          max={12}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          placeholder="Min 4, max 12"
        />
        {count && !valid && (
          <p className="text-xs mt-2 text-red-400">
            {num < 4 ? "Minimum 4 players required" : "Maximum 12 players"}
          </p>
        )}

        <button
          className="btn btn-gold w-full mt-6"
          disabled={!valid}
          onClick={() => router.push(`/setup?players=${num}`)}
        >
          Set Up Players →
        </button>
      </div>

      <p className="text-xs mt-8" style={{ color: "var(--muted)", opacity: 0.6 }}>
        Minimum 4 players required
      </p>
    </main>
  );
}
