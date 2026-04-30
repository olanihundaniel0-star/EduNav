import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

export type AmenityKey = 'ac' | 'wifi' | 'power' | 'quiet';

export type AmenityVote = {
  id: string;
  space_id: string;
  user_id: string;
  amenity: AmenityKey;
  working: boolean;
  created_at: string;
};

type UserVotes = Record<AmenityKey, boolean | null>;

type UseAmenityVotesResult = {
  votes: AmenityVote[];
  userVotes: UserVotes;
  castVote: (amenity: AmenityKey, working: boolean) => Promise<void>;
};

const amenityKeys: AmenityKey[] = ['ac', 'wifi', 'power', 'quiet'];
const twoHoursMs = 2 * 60 * 60 * 1000;
const emptyUserVotes: UserVotes = {
  ac: null,
  wifi: null,
  power: null,
  quiet: null,
};

const isAmenityKey = (value: unknown): value is AmenityKey => {
  return typeof value === 'string' && amenityKeys.includes(value as AmenityKey);
};

const toVote = (value: unknown): AmenityVote | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.space_id !== 'string' ||
    typeof row.user_id !== 'string' ||
    !isAmenityKey(row.amenity) ||
    typeof row.working !== 'boolean' ||
    typeof row.created_at !== 'string'
  ) {
    return null;
  }

  return {
    id: row.id,
    space_id: row.space_id,
    user_id: row.user_id,
    amenity: row.amenity,
    working: row.working,
    created_at: row.created_at,
  };
};

const upsertVoteInList = (prevVotes: AmenityVote[], nextVote: AmenityVote): AmenityVote[] => {
  const byUserAndAmenity = prevVotes.findIndex(
    (vote) => vote.user_id === nextVote.user_id && vote.amenity === nextVote.amenity,
  );

  if (byUserAndAmenity !== -1) {
    const next = [...prevVotes];
    next[byUserAndAmenity] = nextVote;
    return next;
  }

  const byId = prevVotes.findIndex((vote) => vote.id === nextVote.id);
  if (byId !== -1) {
    const next = [...prevVotes];
    next[byId] = nextVote;
    return next;
  }

  return [nextVote, ...prevVotes];
};

const removeVoteFromList = (
  prevVotes: AmenityVote[],
  oldRow: Record<string, unknown>,
): AmenityVote[] => {
  const oldId = typeof oldRow.id === 'string' ? oldRow.id : null;
  const oldUserId = typeof oldRow.user_id === 'string' ? oldRow.user_id : null;
  const oldAmenity = isAmenityKey(oldRow.amenity) ? oldRow.amenity : null;

  return prevVotes.filter((vote) => {
    if (oldId && vote.id === oldId) return false;
    if (oldUserId && oldAmenity && vote.user_id === oldUserId && vote.amenity === oldAmenity) return false;
    return true;
  });
};

export const getAmenityStatus = (
  votes: AmenityVote[],
  amenityKey: AmenityKey,
  seededDefault: boolean,
): boolean => {
  const cutoff = Date.now() - twoHoursMs;
  const recentVotes = votes.filter((vote) => {
    if (vote.amenity !== amenityKey) return false;
    const timestamp = new Date(vote.created_at).getTime();
    if (Number.isNaN(timestamp)) return false;
    return timestamp >= cutoff;
  });

  if (recentVotes.length === 0) {
    return seededDefault;
  }

  const workingCount = recentVotes.filter((vote) => vote.working).length;
  const workingRatio = workingCount / recentVotes.length;

  if (workingRatio >= 0.6) return true;
  if (1 - workingRatio >= 0.6) return false;
  return seededDefault;
};

export const useAmenityVotes = (spaceId: string): UseAmenityVotesResult => {
  const [votes, setVotes] = useState<AmenityVote[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadVotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('amenity_votes')
      .select('id,space_id,user_id,amenity,working,created_at')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false });

    if (error) {
      return;
    }

    const parsed = (data ?? []).map((row) => toVote(row)).filter((row): row is AmenityVote => row !== null);
    setVotes(parsed);
  }, [spaceId]);

  useEffect(() => {
    let active = true;
    let initialLoadTimeout: ReturnType<typeof setTimeout> | null = null;

    const load = async (hasRetried = false): Promise<void> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;
        setCurrentUserId(user?.id ?? null);
        await loadVotes();
      } catch (error) {
        if (hasRetried || !active) return;

        const errorName = error instanceof Error ? error.name : '';
        if (errorName === 'NavigatorLockAcquireTimeoutError' || errorName === 'AbortError') {
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (!active) return;
          await load(true);
        }
      }
    };

    initialLoadTimeout = setTimeout(() => {
      void load();
    }, 200);

    const channel = supabase
      .channel(`amenity-votes-${spaceId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'amenity_votes',
          filter: `space_id=eq.${spaceId}`,
        },
        (payload) => {
          const typedPayload = payload as RealtimePostgresChangesPayload<Record<string, unknown>>;
          if (typedPayload.eventType === 'DELETE') {
            setVotes((prev) => removeVoteFromList(prev, typedPayload.old));
            return;
          }

          const nextVote = toVote(typedPayload.new);
          if (!nextVote) return;
          setVotes((prev) => upsertVoteInList(prev, nextVote));
        },
      )
      .subscribe();

    return () => {
      active = false;
      if (initialLoadTimeout !== null) {
        clearTimeout(initialLoadTimeout);
      }
      void supabase.removeChannel(channel);
    };
  }, [loadVotes, spaceId]);

  const userVotes = useMemo(() => {
    if (!currentUserId) {
      return emptyUserVotes;
    }

    return votes.reduce<UserVotes>((acc, vote) => {
      if (vote.user_id === currentUserId) {
        acc[vote.amenity] = vote.working;
      }
      return acc;
    }, { ...emptyUserVotes });
  }, [currentUserId, votes]);

  const castVote = useCallback(
    async (amenity: AmenityKey, working: boolean) => {
      if (!currentUserId) {
        throw new Error('You must be signed in to vote.');
      }

      const optimisticVote: AmenityVote = {
        id: `optimistic-${spaceId}-${currentUserId}-${amenity}`,
        space_id: spaceId,
        user_id: currentUserId,
        amenity,
        working,
        created_at: new Date().toISOString(),
      };

      setVotes((prev) => upsertVoteInList(prev, optimisticVote));

      const { data, error } = await supabase
        .from('amenity_votes')
        .upsert(
          {
            space_id: spaceId,
            user_id: currentUserId,
            amenity,
            working,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'space_id,user_id,amenity' },
        )
        .select('id,space_id,user_id,amenity,working,created_at')
        .single();

      if (error) {
        await loadVotes();
        throw new Error(error.message);
      }

      const persistedVote = toVote(data);
      if (!persistedVote) {
        await loadVotes();
        return;
      }

      setVotes((prev) => upsertVoteInList(prev, persistedVote));
    },
    [currentUserId, loadVotes, spaceId],
  );

  return { votes, userVotes, castVote };
};
