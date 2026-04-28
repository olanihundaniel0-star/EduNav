import type { tsSpace } from '../types';

export type SpaceRecommendation = {
  name: string;
  reason: string;
  status: string;
};

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const model = 'gemini-1.5-flash';

const buildPrompt = (request: string, spaces: tsSpace[]) => `You are a campus study space assistant. Based on the student's request and the current space data below, recommend the top 3 best matching spaces. Return a JSON array of { name, reason, status }.

Student request: ${request}
Current spaces: ${JSON.stringify(spaces)}`;

const safeParseRecommendations = (raw: string): SpaceRecommendation[] => {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned) as SpaceRecommendation[];
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.slice(0, 3);
};

export const getGeminiRecommendations = async (
  request: string,
  spaces: tsSpace[],
): Promise<SpaceRecommendation[]> => {
  if (!apiKey) {
    throw new Error('Missing VITE_GEMINI_API_KEY in .env');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(request, spaces) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  );

  if (!response.ok) {
    throw new Error('Failed to fetch recommendations from Gemini.');
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  return safeParseRecommendations(text);
};
