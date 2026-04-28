import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

type CheckinMap = Record<string, boolean>;

export const useCheckin = () => {
  const [checkedInBySpace, setCheckedInBySpace] = useState<CheckinMap>({});

  useEffect(() => {
    let active = true;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from('checkins')
        .select('space_id,type,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!active || error) {
        return;
      }

      const nextMap: CheckinMap = {};
      for (const row of data ?? []) {
        const item = row as { space_id: string; type: 'in' | 'out' };
        if (nextMap[item.space_id] === undefined) {
          nextMap[item.space_id] = item.type === 'in';
        }
      }
      setCheckedInBySpace(nextMap);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const toggleCheckin = useCallback(
    async (spaceId: string) => {
      const current = Boolean(checkedInBySpace[spaceId]);
      const nextType: 'in' | 'out' = current ? 'out' : 'in';
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You must be signed in to check in.');
      }

      const { error } = await supabase.from('checkins').insert({
        user_id: user.id,
        space_id: spaceId,
        type: nextType,
      });

      if (error) {
        throw new Error(error.message);
      }

      setCheckedInBySpace((prev) => ({ ...prev, [spaceId]: !current }));
      return nextType;
    },
    [checkedInBySpace],
  );

  return { checkedInBySpace, toggleCheckin };
};
