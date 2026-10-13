import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, jsonBody, idempotency } from "../services/api";
export const useData = <T>(path: string, enabled = true) =>
  useQuery({
    queryKey: [path],
    queryFn: () => api<T>(path),
    enabled,
    retry: 1,
  });
export function useAction(onSuccess?: () => void) {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      method = "POST",
      data,
      headers,
    }: {
      path: string;
      method?: string;
      data?: unknown;
      headers?: Record<string, string>;
    }) =>
      api(path, {
        method,
        body: data === undefined ? undefined : jsonBody(data),
        headers: headers ?? idempotency(),
      }),
    onSuccess: () => {
      q.invalidateQueries();
      window.dispatchEvent(
        new CustomEvent("finsight-toast", { detail: "Thay đổi đã được lưu." }),
      );
      onSuccess?.();
    },
  });
}
