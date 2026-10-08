"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Leaderboard, LeaderboardPlayer } from "@/lib/api";

type SortKey = "overall" | "regular" | "winRate";

const money = (value: number) => `${value >= 0 ? "+" : "-"}₹${Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("regular");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    api.getLeaderboard().then(setLeaderboard).catch((err) => setError(err.message));
  }, []);

  const players = useMemo(() => {
    if (!leaderboard) return [];
    const list = [...leaderboard.players];
    if (sortKey === "regular") return list.filter((player) => player.regular_rank !== null).sort((a, b) => (a.regular_rank ?? 999) - (b.regular_rank ?? 999));
    if (sortKey === "winRate") return list.sort((a, b) => b.win_rate - a.win_rate || b.games_played - a.games_played);
    return list;
  }, [leaderboard, sortKey]);

  if (error) return <main className="min-h-screen flex items-center justify-center px-6 text-red-400">{error}</main>;
  if (!leaderboard) return <main className="min-h-screen flex items-center justify-center text-gold">Loading leaderboard…</main>;

  const leader = leaderboard.players[0];
  return (
    <main className="min-h-screen px-4 py-7 sm:px-6 fade-in">
      <div className="mx-auto max-w-3xl">
        <button className="text-sm mb-5" style={{ color: "var(--muted)" }} onClick={() => router.push("/")}>← Back to table</button>
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">♛</div>
          <h1 className="text-3xl font-bold text-gold">Poker Night Leaderboard</h1>
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>{leaderboard.genuine_games} genuine games recorded</p>
        </div>

        <section className="card p-5 mb-5 text-center border-yellow-600/40">
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>Overall leader</p>
          <p className="text-2xl font-bold mt-1">{leader.name}</p>
          <p className="text-gold font-semibold mt-1">{money(leader.net_winnings)} total winnings</p>
        </section>

        <section className="card p-4 mb-5">
          <p className="font-semibold">Fair-play ranking</p>
          <p className="text-xs mt-1 leading-5" style={{ color: "var(--muted)" }}>
            Regular rank requires at least {leaderboard.minimum_games_for_regular_rank} games. It uses average profit per game, moderated for smaller samples so a one-night result cannot outrank a long record.
          </p>
        </section>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Tab active={sortKey === "regular"} onClick={() => setSortKey("regular")}>Regular rank</Tab>
          <Tab active={sortKey === "overall"} onClick={() => setSortKey("overall")}>Total winnings</Tab>
          <Tab active={sortKey === "winRate"} onClick={() => setSortKey("winRate")}>Win rate</Tab>
        </div>

        <div className="space-y-3">
          {players.map((player, index) => <PlayerCard key={player.name} player={player} position={sortKey === "regular" ? player.regular_rank ?? index + 1 : index + 1} mode={sortKey} />)}
        </div>
      </div>
    </main>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-lg px-2 py-2 text-xs font-semibold ${active ? "bg-yellow-500 text-slate-950" : "card"}`}>{children}</button>;
}

function PlayerCard({ player, position, mode }: { player: LeaderboardPlayer; position: number; mode: SortKey }) {
  const positive = player.net_winnings >= 0;
  return (
    <article className="card p-4 flex gap-3 items-center">
      <div className={`w-9 h-9 shrink-0 rounded-full grid place-items-center font-bold ${position <= 3 ? "bg-yellow-500 text-slate-950" : "bg-emerald-950 text-emerald-200"}`}>#{position}</div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-3 items-baseline"><h2 className="font-semibold truncate">{player.name}</h2><span className={positive ? "text-emerald-300 font-semibold" : "text-red-300 font-semibold"}>{money(player.net_winnings)}</span></div>
        <div className="grid grid-cols-3 gap-2 mt-2 text-xs" style={{ color: "var(--muted)" }}>
          <span><b className="text-white">{player.games_played}</b> games</span>
          <span><b className="text-white">{player.wins}–{player.losses}</b> W–L</span>
          <span><b className="text-white">{player.win_rate}%</b> wins</span>
        </div>
        {mode === "regular" && <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>Fair score: {money(player.experience_score)} · Avg/game: {money(player.average_per_game)}</p>}
      </div>
    </article>
  );
}
