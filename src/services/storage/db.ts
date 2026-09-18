import Dexie, { type EntityTable } from 'dexie'
import type { Countdown, FinancialPlan, PCBuild, PurchaseGoal, UserSettings } from '../../types/models'
import { defaultBuilds, defaultCountdowns, defaultFinance, defaultGoals, defaultSettings } from '../../data/seed'
import { parseBackupV1 } from './backup'
import { buildSchemeNameMap } from '../../features/pc-build/buildNames'

type StoredBuildImage = Omit<PCBuild['images'][number], 'original'> & { buildId: string }

class FundingDatabase extends Dexie {
  settings!: EntityTable<UserSettings, 'id'>
  financePlans!: EntityTable<FinancialPlan, 'id'>
  countdowns!: EntityTable<Countdown, 'id'>
  goals!: EntityTable<PurchaseGoal, 'id'>
  builds!: EntityTable<PCBuild, 'id'>
  buildImages!: EntityTable<StoredBuildImage, 'id'>

  constructor() {
    super('funding-decision-hub')
    this.version(1).stores({
      settings: 'id',
      financePlans: 'id, targetDate',
      countdowns: 'id, targetDate, pinned, showOnHome',
      goals: 'id, category, targetDate, active',
      builds: 'id, status, favorite, price, createdAt, updatedAt, *tags',
    })
    this.version(2).stores({
      buildImages: 'id, buildId, createdAt',
    }).upgrade(async (transaction) => {
      const buildTable = transaction.table<PCBuild>('builds')
      const imageTable = transaction.table<StoredBuildImage>('buildImages')
      const buildIds = await buildTable.toCollection().primaryKeys()
      for (const id of buildIds) {
        const build = await buildTable.get(id)
        if (!build) continue
        const images = build.images.map(({ original: _original, ...image }) => ({ ...image, buildId: build.id }))
        if (images.length) await imageTable.bulkPut(images)
        await buildTable.put({ ...build, images: [] })
      }
    })
    this.version(3).stores({}).upgrade(async (transaction) => {
      const buildTable = transaction.table<PCBuild>('builds')
      const builds = await buildTable.toArray()
      const names = buildSchemeNameMap(builds)
      await buildTable.bulkPut(builds.map((build) => ({ ...build, schemeName: names[build.id] })))
    })
  }
}

export const db = new FundingDatabase()

function currentMonthEndDate() {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export async function initializeDatabase() {
  await db.transaction('rw', [db.settings, db.financePlans, db.countdowns, db.goals, db.builds, db.buildImages], async () => {
    const counts = await Promise.all([db.settings.count(), db.financePlans.count(), db.countdowns.count(), db.goals.count(), db.builds.count()])
    const isFirstLaunch = counts.every((count) => count === 0)
    if (counts[0] === 0) await db.settings.add(defaultSettings)
    if ((await db.financePlans.count()) === 0) await db.financePlans.add(defaultFinance)
    if (isFirstLaunch && (await db.countdowns.count()) === 0) await db.countdowns.bulkAdd(defaultCountdowns)
    if (isFirstLaunch && (await db.goals.count()) === 0) await db.goals.bulkAdd(defaultGoals)
    if (isFirstLaunch && (await db.builds.count()) === 0) await db.builds.bulkAdd(defaultBuilds)
    const finance = await db.financePlans.get('primary')
    if (finance && !finance.extraIncomeDate) await db.financePlans.update('primary', { extraIncomeDate: currentMonthEndDate() })
  })
}

function lightweightBuild(build: PCBuild): PCBuild {
  return { ...build, images: [] }
}

function storedImages(build: PCBuild): StoredBuildImage[] {
  return build.images.map(({ original: _original, ...image }) => ({ ...image, buildId: build.id }))
}

export async function getBuildImages(buildId: string): Promise<PCBuild['images']> {
  const images = await db.buildImages.where('buildId').equals(buildId).sortBy('createdAt')
  return images.map(({ buildId: _buildId, ...image }) => image)
}

export async function putBuild(build: PCBuild) {
  await db.transaction('rw', db.builds, db.buildImages, async () => {
    await db.builds.put(lightweightBuild(build))
    const existingIds = await db.buildImages.where('buildId').equals(build.id).primaryKeys()
    if (existingIds.length) await db.buildImages.bulkDelete(existingIds)
    const images = storedImages(build)
    if (images.length) await db.buildImages.bulkPut(images)
  })
}

export async function deleteBuild(buildId: string) {
  await db.transaction('rw', db.builds, db.buildImages, async () => {
    await db.builds.delete(buildId)
    await db.buildImages.where('buildId').equals(buildId).delete()
  })
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
      images: (await getBuildImages(build.id)).map((image) => ({ ...image, original: image.compressedDataUrl })),
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
  const parsed = parseBackupV1(raw)

  const builds = (parsed.data.builds ?? []).map((build) => ({
    ...build,
    images: (build.images ?? []).map(({ original: _original, ...image }) => image),
  }))
  const currentBuilds = await db.builds.toArray()
  const importedIds = new Set(builds.map((build) => build.id))
  const names = buildSchemeNameMap([...currentBuilds.filter((build) => !importedIds.has(build.id)), ...builds])

  await db.transaction('rw', [db.settings, db.financePlans, db.countdowns, db.goals, db.builds, db.buildImages], async () => {
    if (parsed.data?.settings?.length) {
      const currentSettings = await db.settings.get('primary')
      await db.settings.bulkPut(parsed.data.settings.map((setting) => ({ ...setting, apiKey: currentSettings?.apiKey ?? '' })))
    }
    if (parsed.data?.financePlans?.length) {
      await db.financePlans.bulkPut(parsed.data.financePlans.map((plan) => ({ ...plan, extraIncomeDate: plan.extraIncomeDate ?? currentMonthEndDate() })))
    }
    if (parsed.data?.countdowns?.length) await db.countdowns.bulkPut(parsed.data.countdowns)
    if (parsed.data?.goals?.length) await db.goals.bulkPut(parsed.data.goals)
    if (builds.length) {
      await db.builds.bulkPut(builds.map((build) => lightweightBuild({ ...build, schemeName: names[build.id] })))
      const buildIds = builds.map((build) => build.id)
      await db.buildImages.where('buildId').anyOf(buildIds).delete()
      const images = builds.flatMap(storedImages)
      if (images.length) await db.buildImages.bulkPut(images)
    }
  })

  return {
    builds: builds.length,
    countdowns: parsed.data.countdowns?.length ?? 0,
    goals: parsed.data.goals?.length ?? 0,
  }
}

export async function clearUserData() {
  const now = new Date().toISOString()
  const today = new Date()
  const targetYear = today > new Date(today.getFullYear(), 10, 11, 23, 59, 59) ? today.getFullYear() + 1 : today.getFullYear()
  await db.transaction('rw', db.financePlans, db.countdowns, db.goals, db.builds, db.buildImages, async () => {
    await Promise.all([db.countdowns.clear(), db.goals.clear(), db.builds.clear(), db.buildImages.clear()])
    await db.financePlans.put({
      ...defaultFinance,
      currentBalance: 0,
      monthlyIncome: 0,
      monthlyFixedExpense: 0,
      monthlySaving: 0,
      extraIncome: 0,
      housingFund: 0,
      targetBudget: 0,
      extraIncomeDate: currentMonthEndDate(),
      targetDate: `${targetYear}-11-11`,
      updatedAt: now,
    })
  })
}
