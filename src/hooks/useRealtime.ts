import { useEffect } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

type UseRealtimeParams = {
  table: string;
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
};

export const useRealtime = ({ table, onChange }: UseRealtimeParams) => {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => onChange(payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onChange, table]);
};
