function clean(text) {
  if (typeof text !== "string") return "";

  return text
    .toLowerCase()
    .replace(/[^\w\s]|_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a, b) {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);

  const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
    Array(a.length + 1).fill(0)
  );

  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

export function checkBrandMention(modelOutput, brand) {
  try {
    if (!brand || typeof brand !== "string" || brand.trim().length === 0) {
      return {
        mentioned: false,
        position: null,
        error: "Brand name is missing or invalid.",
      };
    }

    if (!modelOutput || typeof modelOutput !== "string") {
      return {
        mentioned: false,
        position: null,
        error: "Model output is missing or invalid.",
      };
    }

    const text = clean(modelOutput);
    const brandCleaned = clean(brand);

    if (!text) {
      return {
        mentioned: false,
        position: null,
        error: "Model output contains no usable text.",
      };
    }

    const words = text.split(" ").filter(Boolean);

    // Avoid processing extreme length input (> 2000 words = API hallucination)
    if (words.length > 2000) {
      return {
        mentioned: false,
        position: null,
        error: "Text too long to analyze safely.",
      };
    }

    // Levenshtein threshold (dynamic)
    let threshold = 2;
    if (brandCleaned.length <= 4) threshold = 1; // avoid false positives
    if (brandCleaned.length >= 10) threshold = 3;

    let positions = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      if (word.length <= 1) continue; // ignore useless words (a, i, etc.)

      const dist = levenshtein(word, brandCleaned);

      if (dist <= threshold) {
        positions.push(i + 1);
      }
    }

    return {
      mentioned: positions.length > 0,
      position: positions.length > 0 ? positions[0] : null,
      error: null,
    };
  } catch (err) {
    console.error("Brand mention check failed:", err);
    return {
      mentioned: false,
      position: null,
      error: "Internal error while checking brand mention.",
    };
  }
}
