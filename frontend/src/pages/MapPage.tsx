import { useState } from 'react'
import { Layers } from 'lucide-react'
import { MapContainer, TileLayer } from 'react-leaflet'
import { useAuth } from '@/context/AuthContext'
import { useGis } from '@/context/GisContext'
import type { UtilityType } from '@/context/GisContext'
import { GeoJsonLayer } from '@/components/GeoJsonLayer'
import { TopNav } from '@/components/TopNav'
import 'leaflet/dist/leaflet.css'
import '@/App.css'

const layers: { id: UtilityType; label: string; color: string }[] = [
  { id: 'water', label: 'Water supply', color: '#2383d5' }, { id: 'sewage', label: 'Sewage', color: '#8257d3' }, { id: 'drainage', label: 'Drainage', color: '#e09b16' }, { id: 'natural-gas', label: 'Natural gas', color: '#e05d48' }, { id: 'fibre', label: 'Fibre network', color: '#14a683' },
]
const allLayerIds = layers.map(layer => layer.id)

export function MapPage() {
  const { user } = useAuth(); const { layers: gisLayers, loading, error } = useGis()
  const [active, setActive] = useState<UtilityType[]>(() => user?.department === 'super-admin' ? allLayerIds : [user?.department as UtilityType ?? 'water'])
  if (!user) return null
  const toggle = (id: UtilityType) => setActive(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const reset = () => setActive(user.department === 'super-admin' ? allLayerIds : [user.department as UtilityType])
  return <main className="map-page"><TopNav/><div className="map-layout"><aside className="layer-panel"><div className="panel-title"><Layers size={18}/><div><b>Network layers</b><small>Toggle department data</small></div></div>{layers.map(layer => <button className={`layer-toggle ${active.includes(layer.id) ? 'enabled' : ''}`} onClick={() => toggle(layer.id)} key={layer.id}><i style={{background:layer.color}}/>{layer.label}<span>{gisLayers[layer.id] ? `${gisLayers[layer.id]?.features.length} loaded` : loading ? 'Loading…' : 'No data'}</span></button>)}<div className="map-note"><b>How it works</b><p>Layers are fetched once from PostGIS, then visibility changes locally without additional requests.</p></div></aside><section className="map-workspace"><div className="map-toolbar"><div><b>Nagpur, Maharashtra</b><span>{loading ? 'Loading network data…' : error ?? `${active.length} layer${active.length === 1 ? '' : 's'} visible`}</span></div><button onClick={reset}>Reset filters</button></div><MapContainer center={[21.1458, 79.0882]} zoom={14} className="leaflet-map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{layers.filter(layer => active.includes(layer.id) && gisLayers[layer.id]).map(layer => <GeoJsonLayer key={layer.id} data={gisLayers[layer.id]!} color={layer.color} label={layer.label}/>)}</MapContainer></section></div></main>
}
