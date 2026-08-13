export type Mood = "happy" | "excited" | "wow" | "wink" | "thumbs_up" | "smile";

export type MascotMoodRecord = {
  id: Mood;
  displayName: string;
  assetPath: string;
  thumbnailPath: string;
  active: boolean;
  defaultScale: number;
  xPosition: number;
  yPosition: number;
};

export const MASCOT_MOODS: MascotMoodRecord[] = [
  { id: "happy", displayName: "Happy", assetPath: "/mascots/happy.png", thumbnailPath: "/mascots/happy.png", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
  { id: "excited", displayName: "Excited", assetPath: "/mascots/excited.png", thumbnailPath: "/mascots/excited.png", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
  { id: "wow", displayName: "WOW", assetPath: "/mascots/wow.png", thumbnailPath: "/mascots/wow.png", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
  { id: "wink", displayName: "Wink", assetPath: "/mascots/wink.png", thumbnailPath: "/mascots/wink.png", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
  { id: "thumbs_up", displayName: "Thumbs Up", assetPath: "/mascots/thumbs-up.png", thumbnailPath: "/mascots/thumbs-up.png", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
  { id: "smile", displayName: "Smile", assetPath: "/mascots/smile.png", thumbnailPath: "/mascots/smile.png", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
];

export const DEFAULT_MOOD = MASCOT_MOODS.find((mood) => mood.id === "thumbs_up")!;