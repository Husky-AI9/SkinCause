export const tokens = {
  color: {
    ink: "#102f33",
    inkSoft: "#496467",
    teal: "#0f766e",
    tealDark: "#095b56",
    seaGlass: "#dcefeb",
    aqua: "#b8ddd7",
    paper: "#fffdf8",
    canvas: "#f3f3ec",
    coral: "#e66f51",
    amber: "#d99b34",
    line: "#d6dfdb",
    white: "#ffffff"
  },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 64 },
  radius: { sm: 4, md: 8, round: 999 },
  type: {
    body: "var(--font-body)",
    display: "var(--font-display)"
  },
  motion: { fast: 150, standard: 240 }
} as const;
