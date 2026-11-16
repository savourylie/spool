"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  removeFromSelection,
  setPageSelected,
  togglePost,
  type PostSelection,
  type SelectedPost,
} from "@/lib/post-selection";

interface PostSelectionContextValue {
  selection: PostSelection;
  toggle(post: SelectedPost): void;
  setPage(page: SelectedPost[], selected: boolean): void;
  remove(ids: Iterable<string>): void;
  clear(): void;
}

const PostSelectionContext = createContext<PostSelectionContextValue | null>(
  null,
);

// Holds the Posts page selection. It is mounted by the posts layout, which
// stays mounted while the page, sort, or filters change, so the selection
// carries across all of them.
//
// Every action updates from the previous selection and keeps its identity
// across renders, so callers can use them in effects without re-running them.
export function PostSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selection, setSelection] = useState<PostSelection>(() => new Map());

  const toggle = useCallback((post: SelectedPost) => {
    setSelection((prev) => togglePost(prev, post));
  }, []);

  const setPage = useCallback((page: SelectedPost[], selected: boolean) => {
    setSelection((prev) => setPageSelected(prev, page, selected));
  }, []);

  const remove = useCallback((ids: Iterable<string>) => {
    // React can run an updater more than once, and a one-shot iterable such as
    // map.keys() would be empty the second time. Read the ids up front.
    const idList = Array.from(ids);
    setSelection((prev) => removeFromSelection(prev, idList));
  }, []);

  const clear = useCallback(() => {
    setSelection(new Map());
  }, []);

  const value = useMemo(
    () => ({ selection, toggle, setPage, remove, clear }),
    [selection, toggle, setPage, remove, clear],
  );

  return (
    <PostSelectionContext.Provider value={value}>
      {children}
    </PostSelectionContext.Provider>
  );
}

export function usePostSelection(): PostSelectionContextValue {
  const context = useContext(PostSelectionContext);
  if (!context) {
    throw new Error(
      "usePostSelection must be used within a PostSelectionProvider",
    );
  }
  return context;
}
