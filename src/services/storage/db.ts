import Dexie, { type EntityTable } from 'dexie'
import type { Countdown, FinancialPlan, PCBuild, PurchaseGoal, UserSettings } from '../../types/models'
import { defaultBuilds, defaultCountdowns, defaultFinance, defaultGoals, defaultSettings } from '../../data/seed'

class FundingDatabase extends Dexie {
  settings!: EntityTable<UserSettings, 'id'>
  financePlans!: EntityTable<FinancialPlan, 'id'>
  countdowns!: EntityTable<Countdown, 'id'>
  goals!: EntityTable<PurchaseGoal, 'id'>
  builds!: EntityTable<PCBuild, 'id'>

  constructor() {
    super('funding-decision-hub')
    this.version(1).stores({
      settings: 'id',
      financePlans: 'id, targetDate',
      countdowns: 'id, targetDate, pinned, showOnHome',
      goals: 'id, category, targetDate, active',
      builds: 'id, status, favorite, price, createdAt, updatedAt, *tags',
    })
  }
}

export const db = new FundingDatabase()

export async function initializeDatabase() {
  await db.transaction('rw', db.settings, db.financePlans, db.countdowns, db.goals, db.builds, async () => {
    if ((await db.settings.count()) === 0) await db.settings.add(defaultSettings)
    if ((await db.financePlans.count()) === 0) await db.financePlans.add(defaultFinance)
    if ((await db.countdowns.count()) === 0) await db.countdowns.bulkAdd(defaultCountdowns)
    if ((await db.goals.count()) === 0) await db.goals.bulkAdd(defaultGoals)
    if ((await db.builds.count()) === 0) await db.builds.bulkAdd(defaultBuilds)
  })
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  return response.blob()
}

export async function exportAllData() {
  const [settings, financePlans, countdowns, goals, builds] = await Promise.all([
    db.settings.toArray(),
    db.financePlans.toArray(),
    db.countdowns.toArray(),
    db.goals.toArray(),
    db.builds.toArray(),
  ])

  const portableBuilds = await Promise.all(
    builds.map(async (build) => ({
      ...build,
      images: await Promise.all(
        build.images.map(async (image) => ({
          ...image,
          original: await blobToDataUrl(image.original),
        })),
      ),
    })),
  )

  const portableSettings = settings.map((setting) => ({ ...setting, apiKey: '' }))

  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { settings: portableSettings, financePlans, countdowns, goals, builds: portableBuilds },
    },
    null,
    2,
  )
}

export async function importAllData(raw: string) {
  const parsed = JSON.parse(raw) as {
    version?: number
    data?: {
      settings?: UserSettings[]
      financePlans?: FinancialPlan[]
      countdowns?: Countdown[]
      goals?: PurchaseGoal[]
      builds?: Array<Omit<PCBuild, 'images'> & { images: Array<Omit<PCBuild['images'][number], 'original'> & { original: string }> }>
    }
  }
  if (parsed.version !== 1 || !parsed.data) throw new Error('备份文件版本不受支持')

  const builds = await Promise.all(
    (parsed.data.builds ?? []).map(async (build) => ({
      ...build,
      images: await Promise.all(
        (build.images ?? []).map(async (image) => ({ ...image, original: await dataUrlToBlob(image.original) })),
      ),
    })),
  )

  await db.transaction('rw', db.settings, db.financePlans, db.countdowns, db.goals, db.builds, async () => {
    if (parsed.data?.settings?.length) {
      const currentSettings = await db.settings.get('primary')
      await db.settings.bulkPut(parsed.data.settings.map((setting) => ({ ...setting, apiKey: currentSettings?.apiKey ?? '' })))
    }
    if (parsed.data?.financePlans?.length) await db.financePlans.bulkPut(parsed.data.financePlans)
    if (parsed.data?.countdowns?.length) await db.countdowns.bulkPut(parsed.data.countdowns)
    if (parsed.data?.goals?.length) await db.goals.bulkPut(parsed.data.goals)
    if (builds.length) await db.builds.bulkPut(builds)
  })
}
