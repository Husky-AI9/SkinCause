export const dailyNutritionTargets = [
  {
    food: "Mixed berries",
    amount: "1 cup",
    serving: "Fresh or frozen, unsweetened"
  },
  {
    food: "Fresh vegetables",
    amount: "2 cups",
    serving: "Across meals; use a mix of colors"
  },
  {
    food: "Beans or lentils",
    amount: "1/2 cup",
    serving: "Cooked serving"
  },
  {
    food: "Steel-cut oats",
    amount: "1/2 cup",
    serving: "Cooked, unsweetened bowl"
  },
  {
    food: "Water",
    amount: "6–8 cups",
    serving: "About 1.5–2 L; adjust for heat and activity"
  }
] as const;

export function servingForFood(food: string) {
  const normalized = food.toLowerCase();
  if (normalized.includes("vegetable")) return "2 cups across the day";
  if (normalized.includes("bean") || normalized.includes("lentil")) return "1/2 cup cooked";
  if (normalized.includes("oat")) return "1/2 cup cooked";
  if (normalized.includes("berr")) return "1 cup";
  if (normalized.includes("orange")) return "1 medium";
  if (normalized.includes("kiwi")) return "2 kiwi";
  if (normalized.includes("walnut")) return "1 oz (28 g)";
  if (normalized.includes("chia") || normalized.includes("flax")) return "1 tbsp";
  return "1 standard serving";
}
