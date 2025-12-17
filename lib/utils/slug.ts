const adjectives = [
  "swift",
  "bold",
  "calm",
  "bright",
  "clever",
  "cosmic",
  "daring",
  "eager",
  "fierce",
  "gentle",
  "happy",
  "jolly",
  "keen",
  "lively",
  "merry",
  "noble",
  "proud",
  "quick",
  "rapid",
  "sharp",
  "sunny",
  "vivid",
  "witty",
  "zesty",
]

const nouns = [
  "falcon",
  "tiger",
  "phoenix",
  "dragon",
  "panda",
  "eagle",
  "wolf",
  "bear",
  "lion",
  "hawk",
  "raven",
  "cobra",
  "shark",
  "whale",
  "dolphin",
  "panther",
  "jaguar",
  "leopard",
  "cheetah",
  "lynx",
  "otter",
  "fox",
  "owl",
  "crane",
]

const usernameAdjectives = [
  "Happy",
  "Clever",
  "Swift",
  "Brave",
  "Calm",
  "Eager",
  "Gentle",
  "Kind",
  "Wise",
  "Jolly",
  "Lucky",
  "Mighty",
  "Noble",
  "Proud",
  "Quick",
  "Sharp",
  "Sunny",
  "Witty",
  "Zesty",
  "Cool",
]

const usernameNouns = [
  "Panda",
  "Tiger",
  "Eagle",
  "Dolphin",
  "Fox",
  "Owl",
  "Bear",
  "Wolf",
  "Hawk",
  "Raven",
  "Koala",
  "Otter",
  "Penguin",
  "Rabbit",
  "Falcon",
  "Phoenix",
  "Dragon",
  "Lion",
  "Shark",
  "Whale",
]

export function generateSlug(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${adj}-${noun}-${num}`
}

export function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export function generateRandomUsername(): string {
  const adj = usernameAdjectives[Math.floor(Math.random() * usernameAdjectives.length)]
  const noun = usernameNouns[Math.floor(Math.random() * usernameNouns.length)]
  return `${adj}${noun}`
}
