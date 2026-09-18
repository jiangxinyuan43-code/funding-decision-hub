export type BuildStatus = 'pending' | 'watching' | 'candidate' | 'priority' | 'rejected' | 'purchased'
export type DataSource = 'ai' | 'manual' | 'url' | 'ocr'
export type ThemeMode = 'light' | 'dark' | 'system'
export type Platform = '京东' | '淘宝' | '天猫' | '抖音' | '其他'

export interface FieldValue {
  value: string
  confidence: number
  source: DataSource
  confirmed: boolean
}

export type ComponentKey =
  | 'cpu'
  | 'gpu'
  | 'vram'
  | 'motherboard'
  | 'ram'
  | 'ramSpeed'
  | 'ssd'
  | 'psu'
  | 'cooler'
  | 'case'

export type BuildComponents = Record<ComponentKey, FieldValue>

export interface StoredImage {
  id: string
  name: string
  type: string
  size: number
  original?: Blob
  compressedDataUrl: string
  createdAt: string
}

export interface PricePoint {
  id: string
  price: number
  recordedAt: string
}

export interface BuildSnapshot {
  id: string
  price: number
  components: BuildComponents
  imageIds: string[]
  url: string
  createdAt: string
}

export interface BuildAnalysis {
  summary: string
  advantages: string[]
  risks: string[]
  unknowns: string[]
  upgradeConsiderations: string[]
  confidence: number
  generatedAt: string
}

export interface PurchaseChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface PCBuild {
  id: string
  title: string
  platform: Platform
  store: string
  url: string
  price: number
  status: BuildStatus
  favorite: boolean
  tags: string[]
  completeness: number
  components: BuildComponents
  images: StoredImage[]
  priceHistory: PricePoint[]
  snapshots: BuildSnapshot[]
  analysis?: BuildAnalysis
  checklist: PurchaseChecklistItem[]
  note: string
  createdAt: string
  updatedAt: string
}

export interface FinancialPlan {
  id: 'primary'
  currentBalance: number
  monthlyIncome: number
  monthlyFixedExpense: number
  monthlySaving: number
  extraIncome: number
  extraIncomeDate?: string
  housingFund: number
  targetBudget: number
  targetDate: string
  updatedAt: string
}

export interface PurchaseGoal {
  id: string
  name: string
  category: '电脑' | '手机' | '显示器' | '其他'
  budget: number
  targetDate: string
  active: boolean
}

export interface Countdown {
  id: string
  name: string
  targetDate: string
  targetTime: string
  note: string
  pinned: boolean
  showOnHome: boolean
}

export interface UserSettings {
  id: 'primary'
  appName: string
  aiProvider: string
  apiBaseUrl: string
  apiKey: string
  model: string
  visionModel: string
  theme: ThemeMode
  hasSeenWelcome: boolean
}

export interface ComparisonAnalysis {
  coreDifferences: string[]
  risks: Record<string, string[]>
  priceNotes: string[]
  usageNotes: string[]
  unknowns: string[]
  source?: 'local' | 'hybrid'
}

export const componentLabels: Record<ComponentKey, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  vram: '显存',
  motherboard: '主板',
  ram: '内存',
  ramSpeed: '内存频率',
  ssd: 'SSD',
  psu: '电源',
  cooler: '散热',
  case: '机箱',
}

export const emptyComponents = (): BuildComponents =>
  Object.fromEntries(
    (Object.keys(componentLabels) as ComponentKey[]).map((key) => [
      key,
      { value: '', confidence: 0, source: 'manual' as DataSource, confirmed: false },
    ]),
  ) as BuildComponents
