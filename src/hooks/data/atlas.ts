import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { AtlasMessage } from '../../lib/types';
import { useUserId } from '../useAuth';

export const atlasKey = (uid: string) => ['atlas_messages', uid];

/** The most recent 50 messages, oldest first. */
export function useAtlasMessages(enabled = true) {
  const uid = useUserId();
  return useQuery({
    queryKey: atlasKey(uid),
    enabled: !!uid && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('atlas_messages').select('*').order('id', { ascending: false }).limit(50);
      if (error) throw error;
      return (data as AtlasMessage[]).reverse();
    },
  });
}
