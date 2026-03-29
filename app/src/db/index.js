import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'

PouchDB.plugin(PouchDBFind)

// Lokale DB — primäre Datenquelle, läuft immer offline
const db = new PouchDB('timerec')

// Indizes für häufige Abfragen
db.createIndex({ index: { fields: ['type', 'date'] } })
db.createIndex({ index: { fields: ['type'] } })

export default db
