import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  PUBLIC_SYSTEM_SETTINGS_QUERY_KEY,
  fetchPublicSystemSettings,
} from "@/lib/publicSystemSettings";

export function usePublicSystemSettings(): UseQueryResult<Record<string, unknown> | null> {
  return useQuery({
    queryKey: PUBLIC_SYSTEM_SETTINGS_QUERY_KEY,
    queryFn: fetchPublicSystemSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}
