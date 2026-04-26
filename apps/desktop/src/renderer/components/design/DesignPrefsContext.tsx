import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CoodeenPage } from "../../lib/types";

type DesignBlock = {
  host: string;
  pages: CoodeenPage[];
};

interface DesignPrefsApi {
  /** Read the current entry for a route (mutable mirror of coodeen.json's design.pages[*]). */
  getPage: (route: string) => CoodeenPage | undefined;
  /** Patch a page's fields. Marks state dirty; notifies that route's subscribers. */
  updatePage: (route: string, partial: Partial<CoodeenPage>) => void;
  /** Subscribe to changes for a single route. */
  subscribe: (route: string, cb: () => void) => () => void;
}

const DesignPrefsContext = createContext<DesignPrefsApi>({
  getPage: () => undefined,
  updatePage: () => {},
  subscribe: () => () => {},
});

interface ProviderProps {
  /** Initial design block (e.g. config.design from disk). null when missing. */
  initial: DesignBlock | null;
  /** Called once on unmount / projectDir change if any updates were made. */
  onFlush: (next: DesignBlock) => void;
  children: ReactNode;
}

export function DesignPrefsProvider({
  initial,
  onFlush,
  children,
}: ProviderProps) {
  // Mutable mirror — same shape as coodeen.json's `design` block.
  const stateRef = useRef<DesignBlock | null>(initial);
  const dirtyRef = useRef(false);
  const subsRef = useRef<Map<string, Set<() => void>>>(new Map());
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  // Re-seed when `initial` reference changes (project switch / config reload).
  useEffect(() => {
    stateRef.current = initial;
    dirtyRef.current = false;
    // Wake up every subscriber so they re-read after re-seed.
    for (const set of subsRef.current.values()) {
      for (const cb of set) cb();
    }
  }, [initial]);

  const api = useMemo<DesignPrefsApi>(
    () => ({
      getPage: (route) => stateRef.current?.pages.find((p) => p.route === route),
      updatePage: (route, partial) => {
        const cur = stateRef.current;
        if (!cur) return;
        const idx = cur.pages.findIndex((p) => p.route === route);
        if (idx < 0) return;
        cur.pages[idx] = { ...cur.pages[idx], ...partial };
        dirtyRef.current = true;
        subsRef.current.get(route)?.forEach((cb) => cb());
      },
      subscribe: (route, cb) => {
        let set = subsRef.current.get(route);
        if (!set) {
          set = new Set();
          subsRef.current.set(route, set);
        }
        set.add(cb);
        return () => {
          set!.delete(cb);
        };
      },
    }),
    [],
  );

  // Flush dirty state to disk on unmount or when `initial` is replaced.
  useEffect(() => {
    return () => {
      if (dirtyRef.current && stateRef.current) {
        onFlushRef.current(stateRef.current);
      }
    };
  }, [initial]);

  return (
    <DesignPrefsContext.Provider value={api}>
      {children}
    </DesignPrefsContext.Provider>
  );
}

/** Subscribe to a single route's page entry — re-renders only that consumer. */
export function useDesignPage(route: string): CoodeenPage | undefined {
  const ctx = useContext(DesignPrefsContext);
  return useSyncExternalStore(
    (cb) => ctx.subscribe(route, cb),
    () => ctx.getPage(route),
  );
}

export function useDesignPrefs() {
  return useContext(DesignPrefsContext);
}
