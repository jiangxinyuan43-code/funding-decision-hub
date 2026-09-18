import Dexie, { type EntityTable } from 'dexie'
import type { Countdown, FinancialPlan, PCBuild, PurchaseGoal, UserSettings } from '../../types/models'
import { defaultBuilds, defaultCountdowns, defaultFinance, defaultGoals, defaultSettings } from '../../data/seed'
import { parseBackupV1 } from './backup'

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

function currentMonthEndDate() {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export async function initializeDatabase() {
  await db.transaction('rw', db.settings, db.financePlans, db.countdowns, db.goals, db.builds, async () => {
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
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error('备份中的图片格式无效')
  if (blob.size > 20 * 1024 * 1024) throw new Error('备份中的单张图片超过 20MB')
  return blob
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
  const parsed = parseBackupV1(raw)

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
    if (parsed.data?.financePlans?.length) {
      await db.financePlans.bulkPut(parsed.data.financePlans.map((plan) => ({ ...plan, extraIncomeDate: plan.extraIncomeDate ?? currentMonthEndDate() })))
    }
    if (parsed.data?.countdowns?.length) await db.countdowns.bulkPut(parsed.data.countdowns)
    if (parsed.data?.goals?.length) await db.goals.bulkPut(parsed.data.goals)
    if (builds.length) await db.builds.bulkPut(builds)
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
  await db.transaction('rw', db.financePlans, db.countdowns, db.goals, db.builds, async () => {
    await Promise.all([db.countdowns.clear(), db.goals.clear(), db.builds.clear()])
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
