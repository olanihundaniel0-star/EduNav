import { useEffect } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

type UseRealtimeParams = {
  table: string;
  filterIds?: string[];
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
};

export const useRealtime = ({ table, filterIds, onChange }: UseRealtimeParams) => {
  const filterString = filterIds && filterIds.length > 0 ? `id=in.(${filterIds.join(',')})` : undefined;

  useEffect(() => {
    const channelConfig: any = { event: '*', schema: 'public', table };
    if (filterString) {
      channelConfig.filter = filterString;
    }

    const channel = supabase
      .channel(`realtime-${table}-${filterString || 'all'}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        channelConfig,
        (payload) => onChange(payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onChange, table, filterString]);
};
