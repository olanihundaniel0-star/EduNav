import React, { memo, useMemo } from 'react';
import type { tsSpace } from '../../types';
import { type AmenityKey, getAmenityStatus, useAmenityVotes } from '../../hooks/useAmenityVotes';
import { getSpaceStatus } from '../../lib/utils';

const amenityKeys: AmenityKey[] = ['wifi', 'power', 'quiet'];

const statusColorClasses: Record<
  'green' | 'yellow' | 'red',
  { badge: string; bar: string }
> = {
  green: { badge: 'bg-[#0F9D58] text-white ring-1 ring-green-200', bar: 'bg-[#0F9D58]' },
  yellow: { badge: 'bg-[#F4B400] text-black ring-1 ring-yellow-200', bar: 'bg-[#F4B400]' },
  red: { badge: 'bg-[#DB4437] text-white ring-1 ring-red-200', bar: 'bg-[#DB4437]' },
};

const getCapacityPercent = (space: tsSpace) => {
  if (!space.capacity_verified || space.total_capacity <= 0) return 0;
  return Math.min(100, Math.round((space.current_count / space.total_capacity) * 100));
};

const ThumbIcon = ({ direction }: { direction: 'up' | 'down' }) => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
    <path
      d={
        direction === 'up'
          ? 'M14 10V4a2 2 0 00-2-2l-1 5-3 4v9h9a2 2 0 002-1.8l1-6.2A2 2 0 0018 10h-4zM8 11H5a1 1 0 00-1 1v8a1 1 0 001 1h3'
          : 'M10 14v6a2 2 0 002 2l1-5 3-4V4H7a2 2 0 00-2 1.8L4 12a2 2 0 002 2h4zM16 13h3a1 1 0 011 1v8a1 1 0 01-1 1h-3'
      }
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type SpaceCardProps = {
  space: tsSpace;
  checkedIn: boolean;
  onCheckin: (spaceId: string) => Promise<void>;
};

const SpaceCard = ({ space, checkedIn, onCheckin }: SpaceCardProps) => {
  const { votes, userVotes, castVote } = useAmenityVotes(space.id);

  const computedAmenities = useMemo(() => {
    return amenityKeys.reduce<Record<AmenityKey, boolean>>(
      (acc, amenity) => {
        acc[amenity] = getAmenityStatus(votes, amenity, Boolean(space.amenities?.[amenity]));
        return acc;
      },
      { wifi: false, power: false, quiet: false },
    );
  }, [space.amenities, votes]);

  const status = getSpaceStatus(space);
  const statusClasses = statusColorClasses[status.color];
  const showCapacity = space.capacity_verified && space.total_capacity > 0;
  const capacityPercent = getCapacityPercent(space);

  const handleVote = async (amenity: AmenityKey, working: boolean) => {
    try {
      await castVote(amenity, working);
    } catch {
      // Silent for now so voting remains lightweight.
    }
  };

  return (
    <article className="rounded-2xl border border-black/10 bg-white p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold">{space.name}</h3>
          <p className="text-sm text-black/55">{space.location}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${statusClasses.badge}`}>
          {status.label}
        </span>
      </div>
      {showCapacity && (
        <div className="mt-4 h-1.5 w-full rounded-full bg-black/10">
          <div className={`h-1.5 rounded-full ${statusClasses.bar}`} style={{ width: `${capacityPercent}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs">
        {showCapacity
          ? `${space.current_count} / ${space.total_capacity} students`
          : `${space.current_count} checked in`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {amenityKeys.map((amenity) => (
          <span
            key={amenity}
            className={`rounded-full border px-3 py-1 text-xs ${
              computedAmenities[amenity] ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-500'
            }`}
          >
            {amenity.toUpperCase()}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
        <span>Are these accurate?</span>
        {amenityKeys.map((amenity) => (
          <div key={`vote-${amenity}`} className="flex items-center gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">{amenity}</span>
            <button
              type="button"
              onClick={() => void handleVote(amenity, true)}
              className={`cursor-pointer p-0.5 transition-colors duration-150 ${
                userVotes[amenity] === true ? 'text-[#4285F4]' : 'text-gray-400 hover:text-blue-500'
              }`}
              aria-label={`Mark ${amenity.toUpperCase()} as working`}
            >
              <ThumbIcon direction="up" />
            </button>
            <button
              type="button"
              onClick={() => void handleVote(amenity, false)}
              className={`cursor-pointer p-0.5 transition-colors duration-150 ${
                userVotes[amenity] === false ? 'text-[#DB4437]' : 'text-gray-400 hover:text-red-500'
              }`}
              aria-label={`Mark ${amenity.toUpperCase()} as not working`}
            >
              <ThumbIcon direction="down" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void onCheckin(space.id)}
        className={`mt-4 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
          checkedIn
            ? 'border border-black bg-white text-black hover:border-red-500 hover:bg-red-50 hover:text-red-700'
            : 'bg-[#4285F4] text-white hover:bg-blue-600 active:bg-blue-700'
        }`}
      >
        {checkedIn ? 'Check Out' : 'Check In'}
      </button>
    </article>
  );
};

export default memo(SpaceCard);
