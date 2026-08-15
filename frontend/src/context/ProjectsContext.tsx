import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { Department } from '@/context/AuthContext'

export type Project = { id: string; title: string; department: Department; location: string; startDate: string; endDate: string; status: 'planned' | 'in-progress'; description: string }
type NewProject = Omit<Project, 'id' | 'status'>
type ProjectsContextValue = { projects: Project[]; addProject: (project: NewProject) => void }
const ProjectsContext = createContext<ProjectsContextValue | undefined>(undefined)
const initialProjects: Project[] = [
  { id: 'W-104', title: 'Central Avenue water main renewal', department: 'water', location: 'Central Avenue, Ward 32', startDate: '2026-09-10', endDate: '2026-09-18', status: 'planned', description: 'Replace ageing water pipeline.' },
  { id: 'F-221', title: 'Central Avenue fibre ducting', department: 'fibre', location: 'Central Avenue, Ward 32', startDate: '2026-09-12', endDate: '2026-09-20', status: 'planned', description: 'Install fibre conduit along the corridor.' },
  { id: 'E-078', title: 'Hingna Road drainage upgrade', department: 'drainage', location: 'Hingna Road, Ward 18', startDate: '2026-10-01', endDate: '2026-10-08', status: 'planned', description: 'Upgrade underground drainage pipe.' },
]
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => { const saved = sessionStorage.getItem('dig-once-projects'); return saved ? JSON.parse(saved) : initialProjects })
  function addProject(project: NewProject) { const next = [{ ...project, id: `P-${Date.now().toString().slice(-5)}`, status: 'planned' as const }, ...projects]; sessionStorage.setItem('dig-once-projects', JSON.stringify(next)); setProjects(next) }
  return <ProjectsContext.Provider value={{ projects, addProject }}>{children}</ProjectsContext.Provider>
}
export function useProjects() { const context = useContext(ProjectsContext); if (!context) throw new Error('useProjects must be used inside ProjectsProvider'); return context }
