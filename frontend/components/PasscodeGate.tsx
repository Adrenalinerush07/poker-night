"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { savePasscode } from "@/lib/passcode";

interface Props {
  gameId: number;
  onVerified: (passcode: string) => void;
}

export default function PasscodeGate({ gameId, onVerified }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.verifyPasscode(gameId, input.trim());
      savePasscode(gameId, input.trim());
      onVerified(input.trim());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        setError("Game not found.");
      } else {
        setError("Wrong passcode. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-sm fade-in">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-xl font-bold text-gold">Table Locked</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Game #{gameId} · Enter the passcode to continue
          </p>
        </div>

        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
              Passcode
            </label>
            <input
              type="password"
              placeholder="Enter passcode"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            className="btn btn-gold w-full"
            disabled={!input.trim() || loading}
            onClick={handleSubmit}
          >
            {loading ? "Verifying..." : "Enter Table ♠"}
          </button>
        </div>
      </div>
    </div>
  );
}
