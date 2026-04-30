import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { supabase } from '../lib/supabase';
import type { tsSpace } from '../types';

type UseSpacesResult = {
  spaces: tsSpace[];
  setSpaces: Dispatch<SetStateAction<tsSpace[]>>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const normalizeSpace = (space: tsSpace): tsSpace => ({
  ...space,
  capacity_verified: Boolean(space.capacity_verified),
  amenities: {
    wifi: Boolean(space.amenities?.wifi),
    power: Boolean(space.amenities?.power),
    quiet: Boolean(space.amenities?.quiet),
  },
});

export const useSpaces = (): UseSpacesResult => {
  const [spaces, setSpaces] = useState<tsSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('spaces')
      .select('id,name,location,total_capacity,capacity_verified,peak_count,current_count,amenities,status')
      .order('name', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setError(null);
    setSpaces((data ?? []).map((space) => normalizeSpace(space as tsSpace)));
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return { spaces, setSpaces, loading, error, refresh };
};
