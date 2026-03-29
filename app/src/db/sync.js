import db from './index'

// CouchDB läuft auf demselben Host via nginx-Proxy unter /db/
const REMOTE_URL = `${window.location.origin}/db/timerec`

let syncHandler = null
let statusListeners = []

export function onSyncStatus(fn) {
  statusListeners.push(fn)
  return () => { statusListeners = statusListeners.filter(l => l !== fn) }
}

function emit(status) {
  statusListeners.forEach(fn => fn(status))
}

export function startSync() {
  if (syncHandler) return

  syncHandler = db.sync(REMOTE_URL, {
    live: true,
    retry: true,
  })
    .on('change',  () => emit('syncing'))
    .on('paused',  () => emit('idle'))
    .on('active',  () => emit('syncing'))
    .on('error',   () => emit('error'))
    .on('denied',  () => emit('error'))

  emit('idle')
}

export function stopSync() {
  if (syncHandler) {
    syncHandler.cancel()
    syncHandler = null
  }
}
