const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export interface PlayerCreate {
  name: string;
  avatar: string;
  is_banker: boolean;
  phone?: string;
}

export interface GameCreate {
  buy_in_amount: number;
  chips_per_buyin: number;
  passcode: string;
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
  phone?: string | null;
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

async function request<T>(path: string, options?: RequestInit, passcode?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (passcode) headers["x-game-passcode"] = passcode;

  const res = await fetch(`${API}${path}`, { headers, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // No passcode needed — creates the game
  createGame: (data: GameCreate) =>
    request<Game>("/games", { method: "POST", body: JSON.stringify(data) }),

  // Verify passcode before accessing a game
  verifyPasscode: (gameId: number, passcode: string) =>
    request<{ status: string; game_id: number; game_status: string }>(
      `/games/${gameId}/verify`,
      { method: "POST", body: JSON.stringify({ passcode }) }
    ),

  // All below require passcode header
  getGame: (id: number, passcode: string) =>
    request<Game>(`/games/${id}`, {}, passcode),

  addBuyIn: (gameId: number, playerId: number, passcode: string) =>
    request<Player>(`/games/${gameId}/players/${playerId}/buyin`, { method: "POST" }, passcode),

  removeBuyIn: (gameId: number, playerId: number, passcode: string) =>
    request<Player>(`/games/${gameId}/players/${playerId}/buyin`, { method: "DELETE" }, passcode),

  endGame: (gameId: number, finalChips: { player_id: number; final_chips: number }[], passcode: string) =>
    request<GameResults>(
      `/games/${gameId}/end`,
      { method: "POST", body: JSON.stringify({ final_chips: finalChips }) },
      passcode
    ),

  getResults: (gameId: number, passcode: string) =>
    request<GameResults>(`/games/${gameId}/results`, {}, passcode),

  countChips: async (gameId: number, imageFile: File): Promise<Record<string, number>> => {
    const form = new FormData();
    form.append("image", imageFile);
    const res = await fetch(`${API}/games/${gameId}/count-chips`, { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to count chips");
    }
    return res.json();
  },
};
