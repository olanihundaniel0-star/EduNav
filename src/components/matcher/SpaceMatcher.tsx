import { matchSpaces, type SpaceRecommendation } from '../../lib/gemini';
import type { tsSpace } from '../../types';

export default function SpaceMatcher() {
  const runSpaceMatcher = (
    userQuery: string,
    spaces: tsSpace[],
  ): Promise<SpaceRecommendation[]> => matchSpaces(userQuery, spaces);

  void runSpaceMatcher;
  return null;
}

