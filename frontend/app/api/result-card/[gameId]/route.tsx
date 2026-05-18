import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const INTERNAL_API = process.env.INTERNAL_API_URL || "http://localhost:8001";

const ADJECTIVES = ["Royal","Lucky","Wild","Golden","Blazing","Shadow","Thunder","Crimson","Midnight","Silver","Velvet","Rusty","Neon","Frozen","Stormy"];
const ANIMALS = ["Tiger","Wolf","Eagle","Lion","Shark","Cobra","Falcon","Bear","Fox","Panther","Jaguar","Raven","Viper","Lynx","Bison"];
function gameName(id: number): string {
  return `${ADJECTIVES[id % ADJECTIVES.length]} ${ANIMALS[Math.floor(id / ADJECTIVES.length) % ANIMALS.length]}`;
}

interface PlayerResult {
  player_id: number;
  name: string;
  is_banker: boolean;
  buy_in_count: number;
  profit_loss_inr: number;
}

interface GameResults {
  game_id: number;
  buy_in_amount: number;
  chips_per_buyin: number;
  players: PlayerResult[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const res = await fetch(`${INTERNAL_API}/games/${gameId}/public-results`);
  if (!res.ok) return new Response("Not found", { status: 404 });

  const results: GameResults = await res.json();
  const sorted = [...results.players].sort(
    (a, b) => b.profit_loss_inr - a.profit_loss_inr
  );

  const banker = results.players.find((p) => p.is_banker);
  const settlements = results.players.filter(
    (p) => !p.is_banker && p.profit_loss_inr > 0
  );

  const W = 600;
  const PLAYER_H = 68;
  const SETTLEMENT_H = settlements.length > 0 ? 44 + settlements.length * 36 : 0;
  const H = 260 + sorted.length * PLAYER_H + SETTLEMENT_H + 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, #0a1a11 0%, #0f2a1a 50%, #0d1f17 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: -100,
            left: "50%",
            transform: "translateX(-50%)",
            width: 500,
            height: 300,
            background: "radial-gradient(ellipse, rgba(26,58,42,0.8) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 36,
            paddingBottom: 24,
            position: "relative",
          }}
        >
          {/* Spade suit top-left */}
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 24,
              fontSize: 28,
              color: "rgba(212,175,55,0.3)",
              display: "flex",
            }}
          >
            ♠
          </div>
          <div
            style={{
              position: "absolute",
              top: 20,
              right: 24,
              fontSize: 28,
              color: "rgba(212,175,55,0.3)",
              display: "flex",
            }}
          >
            ♠
          </div>

          <div
            style={{
              fontSize: 13,
              letterSpacing: 6,
              color: "#d4af37",
              fontWeight: 700,
              marginBottom: 8,
              display: "flex",
            }}
          >
            POKER NIGHT
          </div>
          <div
            style={{
              fontSize: 38,
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1,
              marginBottom: 10,
              display: "flex",
            }}
          >
            {gameName(results.game_id).toUpperCase()}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#7cb88a",
              display: "flex",
              gap: 12,
            }}
          >
            <span>Buy-in: Rs.{results.buy_in_amount}</span>
            <span style={{ color: "#245237" }}>|</span>
            <span>{results.chips_per_buyin} chips</span>
          </div>
        </div>

        {/* Gold divider */}
        <div
          style={{
            height: 1,
            background: "linear-gradient(90deg, transparent, #d4af37, transparent)",
            marginLeft: 32,
            marginRight: 32,
            marginBottom: 20,
            display: "flex",
          }}
        />

        {/* Players */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingLeft: 24,
            paddingRight: 24,
          }}
        >
          {sorted.map((p, i) => {
            const pl = p.profit_loss_inr;
            const isWinner = i === 0 && pl > 0;
            const plColor = pl > 0 ? "#2ecc71" : pl < 0 ? "#e74c3c" : "#7cb88a";
            const plStr =
              pl > 0
                ? `+Rs.${pl.toFixed(0)}`
                : pl < 0
                ? `-Rs.${Math.abs(pl).toFixed(0)}`
                : `Rs.0`;

            return (
              <div
                key={p.player_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: isWinner
                    ? "linear-gradient(90deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))"
                    : "rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  border: `1px solid ${isWinner ? "rgba(212,175,55,0.5)" : "rgba(36,82,55,0.5)"}`,
                }}
              >
                {/* Rank badge */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: isWinner
                      ? "linear-gradient(135deg, #d4af37, #b8960c)"
                      : "rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    fontWeight: 800,
                    color: isWinner ? "#0d1f17" : "#7cb88a",
                    flexShrink: 0,
                    marginRight: 14,
                  }}
                >
                  {i + 1}
                </div>

                {/* Name + meta */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: isWinner ? "#f5d26e" : "#e8f5e9",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {p.name}
                    {p.is_banker && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#d4af37",
                          background: "rgba(212,175,55,0.15)",
                          border: "1px solid rgba(212,175,55,0.4)",
                          borderRadius: 4,
                          padding: "1px 6px",
                          display: "flex",
                        }}
                      >
                        BANKER
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#4a7a5a", display: "flex" }}>
                    {p.buy_in_count}x buy-in
                  </div>
                </div>

                {/* P&L */}
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: plColor,
                    display: "flex",
                  }}
                >
                  {plStr}
                </div>
              </div>
            );
          })}
        </div>

        {/* Settlement */}
        {settlements.length > 0 && banker && (
          <div
            style={{
              marginTop: 16,
              marginLeft: 24,
              marginRight: 24,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(36,82,55,0.6)",
              borderRadius: 12,
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: 3,
                color: "#7cb88a",
                fontWeight: 700,
                display: "flex",
              }}
            >
              SETTLEMENT
            </div>
            {settlements.map((p) => (
              <div
                key={p.player_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 14,
                  color: "#e8f5e9",
                }}
              >
                <span>
                  {banker.name} pays {p.name}
                </span>
                <span style={{ color: "#2ecc71", fontWeight: 700 }}>
                  Rs.{p.profit_loss_inr.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 16,
            paddingBottom: 20,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              height: 1,
              width: 60,
              background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4))",
              display: "flex",
            }}
          />
          <span style={{ fontSize: 13, color: "rgba(212,175,55,0.6)", letterSpacing: 3, display: "flex" }}>
            POKER NIGHT
          </span>
          <div
            style={{
              height: 1,
              width: 60,
              background: "linear-gradient(90deg, rgba(212,175,55,0.4), transparent)",
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
