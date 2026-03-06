import useSWR, { mutate as globalMutate } from "swr";
import { apiFetch } from "@/lib/api";

const fetcher = <T>(path: string) => apiFetch<T>(`${path}`);

export function useApi<T>(path: string) {
  const { data, error, isLoading, mutate } = useSWR<T>(path, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  return {
    data,
    loading: isLoading,
    error: error?.message ?? null,
    reload: mutate,
  };
}

export function invalidate(path: string) {
  globalMutate(path);
}
