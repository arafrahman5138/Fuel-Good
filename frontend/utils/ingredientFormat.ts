export function formatIngredientDisplayLine(ingredient: {
  quantity?: string | number;
  unit?: string;
  name?: string;
}) {
  const rawLine = [
    ingredient.quantity == null ? '' : String(ingredient.quantity).trim(),
    ingredient.unit == null ? '' : String(ingredient.unit).trim(),
    ingredient.name == null ? '' : String(ingredient.name).trim(),
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const firstLetterIndex = rawLine.search(/[A-Za-z]/);
  if (firstLetterIndex === -1) return rawLine;

  return (
    rawLine.slice(0, firstLetterIndex)
    + rawLine.charAt(firstLetterIndex).toUpperCase()
    + rawLine.slice(firstLetterIndex + 1)
  );
}
