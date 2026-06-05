export function safeJsonParse(
  text: string,
) {
  try {
    return JSON.parse(text);
  } catch (e) {
    // fallback: extract JSON block

    const match =
      text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error(
        'No valid JSON found',
      );
    }

    try {
      return JSON.parse(match[0]);
    } catch (err) {
      throw new Error(
        'Failed to parse extracted JSON',
      );
    }
  }
}