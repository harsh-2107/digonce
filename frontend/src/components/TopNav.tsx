import { Bell, FolderKanban, LogOut, MapPinned, Plus } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function TopNav() { const { user, logout } = useAuth(); const navigate = useNavigate(); return <header className="top-nav"><NavLink to="/map" className="brand"><div className="brand-mark"><MapPinned size={21}/></div><span>dig<span>once</span></span></NavLink><nav><NavLink to="/notifications"><Bell size={16}/> Notifications</NavLink><NavLink to="/projects"><FolderKanban size={16}/> Projects</NavLink><NavLink to="/projects/new" className="create-tab"><Plus size={17}/> Create project</NavLink></nav><div className="nav-user"><div><b>{user?.name}</b><small>{user?.role}</small></div><button onClick={() => { logout(); navigate('/login') }} title="Sign out"><LogOut size={18}/></button></div></header> }
