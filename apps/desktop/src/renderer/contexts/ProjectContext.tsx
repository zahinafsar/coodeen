import { createContext, useContext, useState, ReactNode } from "react";

interface ProjectContextType {
  projectDir: string;
  setProjectDir: (dir: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectDir, setProjectDir] = useState("");

  return (
    <ProjectContext.Provider value={{ projectDir, setProjectDir }}>
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
