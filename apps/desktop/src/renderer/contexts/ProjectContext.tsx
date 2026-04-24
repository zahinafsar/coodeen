import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ProjectContextType {
  projectDir: string;
  setProjectDir: (dir: string) => void;
  modelId: string;
  setModelId: (id: string) => void;
  providerId: string;
  setProviderId: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectDir, setProjectDir] = useState("");
  const [modelId, setModelId] = useState("");
  const [providerId, setProviderId] = useState("");

  const handleSetProjectDir = useCallback((dir: string) => {
    setProjectDir(dir);
  }, []);

  const handleSetModelId = useCallback((id: string) => {
    setModelId(id);
  }, []);

  const handleSetProviderId = useCallback((id: string) => {
    setProviderId(id);
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        projectDir,
        setProjectDir: handleSetProjectDir,
        modelId,
        setModelId: handleSetModelId,
        providerId,
        setProviderId: handleSetProviderId,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return context;
}
