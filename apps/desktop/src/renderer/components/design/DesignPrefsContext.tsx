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
  getPage: (route: string) => CoodeenPage | undefined;
  updatePage: (route: string, partial: Partial<CoodeenPage>) => void;
  subscribe: (route: string, cb: () => void) => () => void;
}

const DesignPrefsContext = createContext<DesignPrefsApi>({
  getPage: () => undefined,
  updatePage: () => {},
  subscribe: () => () => {},
});

interface ProviderProps {
  initial: DesignBlock | null;
  onFlush: (next: DesignBlock) => void;
  children: ReactNode;
}

export function DesignPrefsProvider({
  initial,
  onFlush,
  children,
}: ProviderProps) {
  const stateRef = useRef<DesignBlock | null>(initial);
  const dirtyRef = useRef(false);
  const subsRef = useRef<Map<string, Set<() => void>>>(new Map());
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  useEffect(() => {
    stateRef.current = initial;
    dirtyRef.current = false;
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
