const key = (gameId: number) => `pn_passcode_${gameId}`;

export function savePasscode(gameId: number, passcode: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(key(gameId), passcode);
}

export function getPasscode(gameId: number): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(key(gameId));
}

export function clearPasscode(gameId: number) {
  if (typeof window !== "undefined") sessionStorage.removeItem(key(gameId));
}
