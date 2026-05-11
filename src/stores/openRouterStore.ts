import create from 'zustand'

type OpenRouterState = {
  favorites: string[]
  setFavorites: (items: string[]) => void
}

export const useOpenRouterStore = create<OpenRouterState>((set) => ({
  favorites: [],
  setFavorites: (items) => set({ favorites: items })
}))
