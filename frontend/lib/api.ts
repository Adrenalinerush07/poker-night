const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export interface PlayerCreate {
  name: string;
  avatar: string;
  is_banker: boolean;
}

export interface GameCreate {
  buy_in_amount: number;
  chips_per_buyin: number;
  players: PlayerCreate[];
}

export interface BuyIn {
  id: number;
  player_id: number;
  created_at: string;
}

export interface Player {
  id: number;
  name: string;
  avatar: string;
  is_banker: boolean;
  final_chips: number | null;
  buy_ins: BuyIn[];
}

export interface Game {
  id: number;
  status: "active" | "ended";
  buy_in_amount: number;
  chips_per_buyin: number;
  created_at: string;
  players: Player[];
}

export interface PlayerResult {
  player_id: number;
  name: string;
  avatar: string;
  is_banker: boolean;
  buy_in_count: number;
  chips_invested: number;
  final_chips: number;
  profit_loss_chips: number;
  profit_loss_inr: number;
}

export interface GameResults {
  game_id: number;
  buy_in_amount: number;
  chips_per_buyin: number;
  players: PlayerResult[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  createGame: (data: GameCreate) =>
    request<Game>("/games", { method: "POST", body: JSON.stringify(data) }),

  getGame: (id: number) => request<Game>(`/games/${id}`),

  addBuyIn: (gameId: number, playerId: number) =>
    request<Player>(`/games/${gameId}/players/${playerId}/buyin`, { method: "POST" }),

  removeBuyIn: (gameId: number, playerId: number) =>
    request<Player>(`/games/${gameId}/players/${playerId}/buyin`, { method: "DELETE" }),

  endGame: (gameId: number, finalChips: { player_id: number; final_chips: number }[]) =>
    request<GameResults>(`/games/${gameId}/end`, {
      method: "POST",
      body: JSON.stringify({ final_chips: finalChips }),
    }),

  getResults: (gameId: number) => request<GameResults>(`/games/${gameId}/results`),
};
