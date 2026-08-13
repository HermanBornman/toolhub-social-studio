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
  { id: "happy", displayName: "Happy", assetPath: "/mascots/happy.svg", thumbnailPath: "/mascots/happy.svg", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
  { id: "excited", displayName: "Excited", assetPath: "/mascots/excited.svg", thumbnailPath: "/mascots/excited.svg", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
  { id: "wow", displayName: "WOW", assetPath: "/mascots/wow.svg", thumbnailPath: "/mascots/wow.svg", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
  { id: "wink", displayName: "Wink", assetPath: "/mascots/wink.svg", thumbnailPath: "/mascots/wink.svg", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
  { id: "thumbs_up", displayName: "Thumbs Up", assetPath: "/mascots/thumbs-up.svg", thumbnailPath: "/mascots/thumbs-up.svg", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
  { id: "smile", displayName: "Smile", assetPath: "/mascots/smile.svg", thumbnailPath: "/mascots/smile.svg", active: true, defaultScale: 1, xPosition: 0, yPosition: 0 },
];

export const DEFAULT_MOOD = MASCOT_MOODS.find((mood) => mood.id === "thumbs_up")!;

