import type { tsSpace } from '../types';

export type SpaceRecommendation = {
  name: string;
  reason: string;
  status: string;
};

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const model = 'gemini-2.5-flash-lite';
const matcherEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const maxRetryAttempts = 2;
const matcherRateLimitUntilKey = 'edunav_gemini_matcher_rate_limit_until';
const defaultRateLimitCooldownMs = 75_000;
let inMemoryRateLimitUntil = 0;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

type GeminiErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

const buildPrompt = (request: string, spaces: tsSpace[]) => `You are a campus study space assistant. Based on the student's request and the current space data below, recommend the top 3 best matching spaces. Return a JSON array of { name, reason, status }.

Important: "capacity_verified" tells you if "total_capacity" is reliable. If capacity_verified is false, treat total_capacity as unknown and reason using current_count instead.

Student request: ${request}
Current spaces: ${JSON.stringify(spaces)}`;

const safeParseRecommendations = (raw: string): SpaceRecommendation[] => {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as SpaceRecommendation[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (item) =>
          typeof item?.name === 'string' &&
          typeof item?.reason === 'string' &&
          typeof item?.status === 'string',
      )
      .slice(0, 3);
  } catch {
    return [];
  }
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getStoredRateLimitUntil = (): number => {
  if (typeof window === 'undefined') {
    return inMemoryRateLimitUntil;
  }

  const raw = window.localStorage.getItem(matcherRateLimitUntilKey);
  if (!raw) {
    return inMemoryRateLimitUntil;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    window.localStorage.removeItem(matcherRateLimitUntilKey);
    return inMemoryRateLimitUntil;
  }

  return parsed;
};

const setRateLimitUntil = (until: number) => {
  inMemoryRateLimitUntil = until;

  if (typeof window === 'undefined') {
    return;
  }

  if (until <= 0) {
    window.localStorage.removeItem(matcherRateLimitUntilKey);
    return;
  }

  window.localStorage.setItem(matcherRateLimitUntilKey, String(until));
};

const getEffectiveRateLimitUntil = (): number => {
  const stored = getStoredRateLimitUntil();
  const effective = Math.max(inMemoryRateLimitUntil, stored);
  if (effective <= Date.now()) {
    setRateLimitUntil(0);
    return 0;
  }
  return effective;
};

const readRetryDelayMs = (response: Response, message: string): number | null => {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const asNumber = Number(retryAfter);
    if (!Number.isNaN(asNumber) && asNumber > 0) {
      return asNumber * 1000;
    }
  }

  const match = message.match(/retry in ([\d.]+)s/i);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 1000);
};

const getSpaceStatusLabel = (space: tsSpace): string => {
  if (space.capacity_verified && space.total_capacity > 0) {
    const ratio = space.current_count / space.total_capacity;
    if (ratio < 0.5) return 'QUIET';
    if (ratio < 0.8) return 'MODERATE';
    return 'BUSY';
  }

  const count = Math.max(0, space.current_count);
  if (count <= 10) return 'QUIET';
  if (count <= 30) return 'MODERATE';
  return 'BUSY';
};

const getFallbackRecommendations = (request: string, spaces: tsSpace[]): SpaceRecommendation[] => {
  const query = request.toLowerCase();
  const tokens = query.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);

  const wantsPower = /\b(power|socket|outlet|charge|charging|electricity)\b/.test(query);
  const wantsWifi = /\b(wifi|wi-fi|internet)\b/.test(query);
  const wantsQuiet = /\b(quiet|silent|silence)\b/.test(query);
  const wantsAvailable = /\b(available|free|empty|less\s*crowded|not\s*busy)\b/.test(query);

  const ranked = spaces
    .map((space) => {
      let score = 0;
      const reasonParts: string[] = [];
      const haystack = `${space.name} ${space.location}`.toLowerCase();

      for (const token of tokens) {
        if (haystack.includes(token)) {
          score += 2;
        }
      }

      if (wantsPower && space.amenities?.power) {
        score += 4;
        reasonParts.push('has power');
      }

      if (wantsWifi && space.amenities?.wifi) {
        score += 3;
        reasonParts.push('has WiFi');
      }

      if (wantsQuiet && space.amenities?.quiet) {
        score += 4;
        reasonParts.push('quiet amenity reported');
      }

      if (wantsAvailable) {
        if (space.capacity_verified && space.total_capacity > 0) {
          const freeRatio = 1 - space.current_count / space.total_capacity;
          score += freeRatio * 5;
          if (freeRatio > 0.5) {
            reasonParts.push('plenty of free seats');
          }
        } else {
          const loadPenalty = Math.min(space.current_count, 50) / 10;
          score += Math.max(0, 5 - loadPenalty);
        }
      }

      if (reasonParts.length === 0) {
        reasonParts.push('best keyword + occupancy match available');
      }

      return {
        name: space.name,
        reason: `Fallback match: ${reasonParts.join(', ')}.`,
        status: getSpaceStatusLabel(space),
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, 3).map(({ name, reason, status }) => ({ name, reason, status }));
};

const getFriendlyGeminiError = (status: number, message: string): string => {
  if (status === 429 || /resource_exhausted|quota|too many requests/i.test(message)) {
    return 'Gemini is rate-limited right now. Showing best available matches instead.';
  }

  if (status === 401 || status === 403) {
    return 'Gemini API key is invalid or restricted. Check VITE_GEMINI_API_KEY settings.';
  }

  return message || 'Failed to fetch recommendations from Gemini.';
};

const fetchGeminiText = async (prompt: string): Promise<string> => {
  const cooldownUntil = getEffectiveRateLimitUntil();
  if (cooldownUntil > Date.now()) {
    throw new Error('Gemini is rate-limited right now. Showing best available matches instead.');
  }

  let attempt = 0;

  while (attempt <= maxRetryAttempts) {
    const response = await fetch(matcherEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey ?? '',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    const rawBody = await response.text();

    if (response.ok) {
      const data = JSON.parse(rawBody) as GeminiResponse;
      setRateLimitUntil(0);
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    }

    let message = 'Failed to fetch recommendations from Gemini.';
    try {
      const parsedError = JSON.parse(rawBody) as GeminiErrorPayload;
      message = parsedError.error?.message ?? message;
    } catch {
      // Keep default message when Gemini does not return JSON.
    }

    const retryDelay = readRetryDelayMs(response, message);
    if (response.status === 429) {
      const cooldownMs = Math.max(30_000, Math.min(retryDelay ?? defaultRateLimitCooldownMs, 15 * 60_000));
      setRateLimitUntil(Date.now() + cooldownMs);
    }

    const shouldRetry = response.status === 429 || response.status >= 500;
    const canRetry = attempt < maxRetryAttempts;

    if (shouldRetry && canRetry) {
      const backoff = Math.min(4000, 700 * (attempt + 1));
      const waitMs = Math.max(350, Math.min(retryDelay ?? backoff, 5000));
      await wait(waitMs);
      attempt += 1;
      continue;
    }

    throw new Error(getFriendlyGeminiError(response.status, message));
  }

  throw new Error('Failed to fetch recommendations from Gemini.');
};

export const getGeminiRecommendations = async (
  request: string,
  spaces: tsSpace[],
): Promise<SpaceRecommendation[]> => {
  if (!apiKey) {
    throw new Error('Missing VITE_GEMINI_API_KEY in .env');
  }

  try {
    const text = await fetchGeminiText(buildPrompt(request, spaces));
    const parsed = safeParseRecommendations(text);
    if (parsed.length > 0) {
      return parsed;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!/rate-limited/i.test(message)) {
      throw error;
    }
  }

  return getFallbackRecommendations(request, spaces);
};

export const matchSpaces = getGeminiRecommendations;
