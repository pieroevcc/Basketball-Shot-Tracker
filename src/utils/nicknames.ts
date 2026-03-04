const ADJECTIVES = [
  'Speedy', 'Cool', 'Bold', 'Quick', 'Slick', 'Sharp', 'Wild', 'Smooth',
  'Fierce', 'Mighty', 'Blazing', 'Clever', 'Swift', 'Brave', 'Stellar',
  'Epic', 'Elite', 'Turbo', 'Hyper', 'Power', 'Ultra', 'Super', 'Mega',
  'Prime', 'Flash', 'Storm', 'Blaze', 'Ace', 'Pro', 'Legend',
];

const NOUNS = [
  'Hooper', 'Dunker', 'Sniper', 'Shooter', 'Hawk', 'Shark', 'Eagle',
  'Tiger', 'Wolf', 'Dragon', 'Phoenix', 'Viper', 'Falcon', 'Panther',
  'Comet', 'Rocket', 'Thunder', 'Lightning', 'Ranger', 'Champion',
];

export function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.random() < 0.4 ? String(Math.floor(Math.random() * 99) + 1) : '';
  return `${adj}${noun}${num}`;
}
