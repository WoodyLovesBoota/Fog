/** One place for every colour in the diorama, so the mood can be retuned in a single file. */
export const PALETTE = {
  // Page backdrop (Fog's lavender canvas)
  backdropTop: "#F1EFFB",
  backdropBottom: "#DCD8F0",
  ink: "#2C2F60",

  // Sea
  seaDeep: "#4F9FE2",
  seaMid: "#69B8EC",
  seaShallow: "#A6E3F0",

  // Ground
  sand: "#F8E8B8",
  sandWet: "#EDD79E",
  grass: ["#C6E78F", "#B6DF80", "#A7D774"],
  grassRim: "#93C766",
  bank: ["#C9A46C", "#DDBD85"],
  tuft: "#9CCB6C",
  forest: ["#8ACB70", "#77BC64"],
  peak: "#D3EBA2",
  urban: "#EEE3CB",
  urbanCore: "#F4ECDB",
  street: "#FCF7EA",
  industry: "#E2DFD9",
  airfield: "#CDE6A0",
  runway: "#B9BBC9",
  road: "#FFF9E8",
  river: "#8FD3EE",

  // Props
  treeRound: ["#5FAE5B", "#6DBB63", "#56A257", "#7CC66B", "#4F9A55"],
  treeCone: ["#4C9A6A", "#5AA872", "#438C61"],
  palm: ["#58B36B", "#6BC274", "#4DA862"],
  trunk: "#A9825A",
  wall: ["#FFFFFF", "#FFF1DC", "#FFDCC8", "#FFD0DA", "#D3E4FF", "#D6F1DF", "#FFEDB0"],
  glass: ["#BDD7F8", "#A6C9F5", "#D8E7FB", "#93BBF0", "#FFFFFF", "#C9C3F2"],
  shed: ["#E9ECF2", "#DCE3EE", "#F4F1EA", "#CFE0F4", "#F6DDB8"],
  roof: ["#F2A65A", "#E98B6D", "#E0739E", "#6E91EE", "#9E91E0", "#6FBF73"],
  cloud: "#FFFFFF",
} as const;

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
