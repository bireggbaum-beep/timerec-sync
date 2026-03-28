import { useEffect, useState } from 'react'
import { onSyncStatus } from '../db/sync'

const labels = {
  idle:    { text: 'Sync',    color: 'bg-green-400' },
  syncing: { text: 'Sync...',  color: 'bg-yellow-400 animate-pulse' },
  error:   { text: 'Offline', color: 'bg-red-400' },
}

export default function SyncIndicator() {
  const [status, setStatus] = useState('idle')

  useEffect(() => onSyncStatus(setStatus), [])

  const { text, color } = labels[status] ?? labels.idle
  return (
    <div className="flex items-center gap-1.5 text-xs text-white/80">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {text}
    </div>
  )
}
