import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

async function fetchModelsApi(baseUrl?: string) {
  const url = baseUrl ? `/api/openrouter/models?baseUrl=${encodeURIComponent(baseUrl)}` : '/api/openrouter/models';
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch OpenRouter models');
  return res.json();
}

export function useOpenRouterModels(baseUrl?: string) {
  return useQuery({
    queryKey: ['openrouter','models', baseUrl],
    queryFn: () => fetchModelsApi(baseUrl),
    staleTime: 1000 * 60 * 2,
    retry: 1
  });
}

export function useRefreshOpenRouterModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ baseUrl }: { baseUrl?: string }) => {
      const res = await fetch('/api/openrouter/refresh-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl })
      });
      if (!res.ok) throw new Error('Refresh failed');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['openrouter','models', (variables as any)?.baseUrl] });
    }
  });
}

export function useOpenRouterFavorites() {
  const qc = useQueryClient();
  const get = async () => {
    const res = await fetch('/api/openrouter/favorites');
    if (!res.ok) throw new Error('Failed to get favorites');
    return res.json();
  };
  const setFav = async (favorites: string[]) => {
    const res = await fetch('/api/openrouter/favorites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorites })
    });
    if (!res.ok) throw new Error('Failed to save favorites');
    const json = await res.json();
    qc.invalidateQueries({ queryKey: ['openrouter','favorites'] });
    return json;
  };

  return { useQueryGet: () => useQuery({ queryKey: ['openrouter','favorites'], queryFn: get }), save: setFav };
}
