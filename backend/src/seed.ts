import cloudbase from '@cloudbase/node-sdk'

const envId = process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV || process.env.SCF_NAMESPACE || ''
const app: any = cloudbase.init({ env: envId })
const db: any = app.database()

const collections = [
  'profiles',
  'process_types',
  'materials',
  'curing_agents',
  'experiments',
  'records',
  'audit_events',
]

const processTypes = ['挤出', '压延', '模压']

async function ensureCollection(name: string) {
  await db.createCollection(name).catch(() => null)
}

async function seedProcessTypes() {
  const now = new Date().toISOString()
  for (const [index, name] of processTypes.entries()) {
    const id = index + 1
    const exists = await db.collection('process_types').where({ id }).limit(1).get()
    if ((exists.data ?? []).length > 0) continue
    await db.collection('process_types').add({
      id,
      name,
      created_at: now,
      updated_at: now,
    })
  }
}

async function main() {
  if (!envId) throw new Error('Missing CLOUDBASE_ENV_ID')
  for (const name of collections) await ensureCollection(name)
  await seedProcessTypes()
  console.log(`Seeded CloudBase environment ${envId}`)
}

void main()
