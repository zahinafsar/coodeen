import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface RightPanelContextValue {
  open: boolean;
  toggle: () => void;
}

const RightPanelContext = createContext<RightPanelContextValue>({
  open: false,
  toggle: () => {},
});

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <RightPanelContext.Provider value={{ open, toggle }}>
      {children}
    </RightPanelContext.Provider>
  );
}

export function useRightPanel() {
  return useContext(RightPanelContext);
}
