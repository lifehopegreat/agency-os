import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BUILTIN_PROMPTS,
  type PromptCategoryId,
  type PromptTemplate,
  type UserPrompt,
} from '../data/promptLibrary';

const STORAGE_KEY = 'agency_os_prompt_library_v1';

type Stored = {
  userPrompts: UserPrompt[];
  favorites: string[]; // builtin or user ids
};

type PromptLibraryContextValue = {
  builtins: PromptTemplate[];
  userPrompts: UserPrompt[];
  favorites: Set<string>;
  addUserPrompt: (input: {
    title: string;
    body: string;
    category?: PromptCategoryId | 'custom';
  }) => UserPrompt | null;
  removeUserPrompt: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
};

const PromptLibraryContext = createContext<PromptLibraryContextValue | null>(null);

function loadStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { userPrompts: [], favorites: [] };
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      userPrompts: Array.isArray(parsed.userPrompts) ? parsed.userPrompts : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    };
  } catch {
    return { userPrompts: [], favorites: [] };
  }
}

function makeId() {
  return `UP-${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .toUpperCase()
    .padStart(6, '0')}`;
}

export function PromptLibraryProvider({ children }: { children: React.ReactNode }) {
  const [userPrompts, setUserPrompts] = useState<UserPrompt[]>(() =>
    typeof window === 'undefined' ? [] : loadStored().userPrompts,
  );
  const [favorites, setFavorites] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : loadStored().favorites,
  );

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ userPrompts, favorites } satisfies Stored),
    );
  }, [userPrompts, favorites]);

  const addUserPrompt = useCallback(
    (input: {
      title: string;
      body: string;
      category?: PromptCategoryId | 'custom';
    }) => {
      const title = input.title.trim();
      const body = input.body.trim();
      if (!body) return null;
      const next: UserPrompt = {
        id: makeId(),
        title: title || body.slice(0, 28),
        body,
        category: input.category ?? 'custom',
        createdAt: Date.now(),
      };
      setUserPrompts((list) => [next, ...list].slice(0, 100));
      return next;
    },
    [],
  );

  const removeUserPrompt = useCallback((id: string) => {
    setUserPrompts((list) => list.filter((p) => p.id !== id));
    setFavorites((fav) => fav.filter((f) => f !== id));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((fav) =>
      fav.includes(id) ? fav.filter((f) => f !== id) : [id, ...fav],
    );
  }, []);

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const isFavorite = useCallback((id: string) => favSet.has(id), [favSet]);

  const value = useMemo(
    () => ({
      builtins: BUILTIN_PROMPTS,
      userPrompts,
      favorites: favSet,
      addUserPrompt,
      removeUserPrompt,
      toggleFavorite,
      isFavorite,
    }),
    [
      userPrompts,
      favSet,
      addUserPrompt,
      removeUserPrompt,
      toggleFavorite,
      isFavorite,
    ],
  );

  return (
    <PromptLibraryContext.Provider value={value}>
      {children}
    </PromptLibraryContext.Provider>
  );
}

export function usePromptLibrary() {
  const ctx = useContext(PromptLibraryContext);
  if (!ctx) {
    throw new Error('usePromptLibrary must be used within PromptLibraryProvider');
  }
  return ctx;
}
