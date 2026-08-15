import { Bell, MapPin } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { TopNav } from '@/components/TopNav'
import '@/App.css'

const notifications = [
  { departments: ['water', 'fibre'], title: 'Potential excavation overlap', text: 'Water main renewal and fibre ducting overlap on Central Avenue by 8 days.', location: 'Central Avenue · Ward 32', priority: 'urgent' },
  { departments: ['drainage'], title: 'New project in your corridor', text: 'A planned road restoration is scheduled around your drainage upgrade.', location: 'Hingna Road · Ward 18', priority: 'new' },
  { departments: ['sewage', 'natural-gas'], title: 'Coordination window available', text: 'A matching work window is available for joint scheduling.', location: 'Manish Nagar · Ward 41', priority: 'info' },
]
export function NotificationsPage() { const { user } = useAuth(); if (!user) return null; const visible = user.department === 'super-admin' ? notifications : notifications.filter(item => item.departments.includes(user.department)); return <main className="app-page"><TopNav/><section className="page-content"><p className="eyebrow">{user.department === 'super-admin' ? 'CITY-WIDE' : user.department.toUpperCase()}</p><h1>Notifications</h1><p className="page-intro">Coordination alerts and updates relevant to your department.</p><div className="notification-list">{visible.length ? visible.map((notice, index) => <article className="notification-card" key={notice.title}><span className={`notice-icon ${notice.priority}`}><Bell size={18}/></span><div><div className="notice-heading"><h3>{notice.title}</h3><small>{index === 0 ? 'Today' : 'Yesterday'}</small></div><p>{notice.text}</p><span className="location"><MapPin size={14}/>{notice.location}</span></div></article>) : <div className="empty-state">No notifications for your department right now.</div>}</div></section></main> }
