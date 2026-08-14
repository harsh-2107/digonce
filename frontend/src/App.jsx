import React, {useEffect, useState} from 'react'

export default function App(){
  const [status, setStatus] = useState('loading')

  useEffect(()=>{
    fetch('/api/health')
      .then(r=>r.json())
      .then(d=>setStatus(d.status))
      .catch(()=>setStatus('error'))
  },[])

  return (
    <div style={{padding:20}}>
      <h1>React + FastAPI</h1>
      <p>Backend health: {status}</p>
    </div>
  )
}
