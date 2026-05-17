export const ANIMALS = [
  "bear", "bull", "cat", "chicken", "cow", "crocodile",
  "dog", "duck", "elephant", "fox", "frog", "giraffe",
  "gorilla", "hippo", "horse", "koala", "lion", "monkey",
  "owl", "panda", "parrot", "penguin", "pig", "rabbit",
  "raccoon", "rhino", "shark", "sheep", "snake", "tiger",
  "turtle", "wolf", "zebra",
];

// Returns a DiceBear avatar URL for the given animal seed
export function avatarUrl(animal: string): string {
  return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${animal}&backgroundColor=1a3a2a`;
}

export function randomAnimal(exclude: string[] = []): string {
  const available = ANIMALS.filter((a) => !exclude.includes(a));
  return available[Math.floor(Math.random() * available.length)];
}
