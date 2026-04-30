import type { tsSpace } from '../types';

type SpaceStatus = {
  label: 'QUIET' | 'MODERATE' | 'BUSY';
  color: 'green' | 'yellow' | 'red';
};

export function getSpaceStatus(space: tsSpace): SpaceStatus {
  if (space.capacity_verified && space.total_capacity > 0) {
    const pct = space.current_count / space.total_capacity;
    if (pct < 0.5) return { label: 'QUIET', color: 'green' };
    if (pct < 0.8) return { label: 'MODERATE', color: 'yellow' };
    return { label: 'BUSY', color: 'red' };
  }

  const count = Math.max(0, space.current_count);
  if (count <= 10) return { label: 'QUIET', color: 'green' };
  if (count <= 30) return { label: 'MODERATE', color: 'yellow' };
  return { label: 'BUSY', color: 'red' };
}
