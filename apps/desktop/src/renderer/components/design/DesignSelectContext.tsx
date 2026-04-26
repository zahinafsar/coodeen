import { createContext, useContext } from "react";
import type { ElementInfo } from "../preview/SelectionOverlay";

export type DesignMode = "preview" | "interact" | "select";

interface DesignSelectContextValue {
  mode: DesignMode;
  onSelected: (info: ElementInfo) => void;
}

export const DesignSelectContext = createContext<DesignSelectContextValue>({
  mode: "preview",
  onSelected: () => {},
});

export function useDesignSelect() {
  return useContext(DesignSelectContext);
}
