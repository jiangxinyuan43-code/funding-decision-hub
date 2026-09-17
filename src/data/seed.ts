import type {
  BuildComponents,
  Countdown,
  FinancialPlan,
  PCBuild,
  PurchaseChecklistItem,
  PurchaseGoal,
  UserSettings,
} from '../types/models'

const field = (value: string, confidence = 1): BuildComponents['cpu'] => ({
  value,
  confidence,
  source: 'manual',
  confirmed: confidence >= 0.75,
})

export const defaultSettings: UserSettings = {
  id: 'primary',
  appName: '我的资金 & 购机助手',
  aiProvider: 'OpenAI Compatible',
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  visionModel: 'gpt-4o-mini',
  theme: 'system',
  hasSeenWelcome: false,
}

export const defaultFinance: FinancialPlan = {
  id: 'primary',
  currentBalance: 10_000,
  monthlyIncome: 4_956,
  monthlyFixedExpense: 2_000,
  monthlySaving: 2_000,
  extraIncome: 1_000,
  housingFund: 1_500,
  targetBudget: 17_000,
  targetDate: '2026-11-01',
  updatedAt: new Date().toISOString(),
}

export const defaultCountdowns: Countdown[] = [
  {
    id: 'countdown_double_11',
    name: '双十一',
    targetDate: '2026-11-11',
    targetTime: '00:00',
    note: '现货兜底日',
    pinned: true,
    showOnHome: true,
  },
  {
    id: 'countdown_decision',
    name: '购机决策截止',
    targetDate: '2026-10-31',
    targetTime: '20:00',
    note: '完成候选收敛和未知项确认',
    pinned: false,
    showOnHome: true,
  },
]

export const defaultGoals: PurchaseGoal[] = [
  { id: 'goal_pc', name: '双十一电脑主机', category: '电脑', budget: 15_500, targetDate: '2026-11-11', active: true },
  { id: 'goal_display', name: '显示器 + 音箱', category: '显示器', budget: 1_600, targetDate: '2026-11-11', active: true },
]

const checklist = (): PurchaseChecklistItem[] =>
  ['CPU 型号确认', 'GPU 型号确认', '显存确认', '主板型号确认', '内存容量确认', 'SSD 型号确认', '电源型号确认', '散热确认', '店铺售后确认', '最终价格确认'].map(
    (label, index) => ({ id: `check_${index}`, label, done: index < 4 }),
  )

const now = new Date().toISOString()

export const defaultBuilds: PCBuild[] = [
  {
    id: 'build_9800x3d_5070',
    title: '9800X3D + RTX 5070 主推方案',
    platform: '京东',
    store: '品牌自营整机店',
    url: '',
    price: 14_299,
    status: 'priority',
    favorite: true,
    tags: ['9800X3D', 'RTX 5070', '64GB', '2TB', '配置透明'],
    completeness: 100,
    components: {
      cpu: field('AMD Ryzen 7 9800X3D'),
      gpu: field('NVIDIA GeForce RTX 5070'),
      vram: field('12GB GDDR7'),
      motherboard: field('B850 Wi-Fi（具体型号待确认）', 0.68),
      ram: field('64GB DDR5（32GB × 2）'),
      ramSpeed: field('6000MHz CL30'),
      ssd: field('2TB PCIe 4.0 NVMe TLC'),
      psu: field('750W ATX 3.1 80 PLUS 金牌'),
      cooler: field('双塔风冷'),
      case: field('高风道中塔机箱'),
    },
    images: [],
    priceHistory: [
      { id: 'price_a1', price: 14_999, recordedAt: '2026-09-04T10:00:00.000Z' },
      { id: 'price_a2', price: 14_599, recordedAt: '2026-09-10T10:00:00.000Z' },
      { id: 'price_a3', price: 14_299, recordedAt: now },
    ],
    snapshots: [],
    analysis: {
      summary: 'CPU 与显卡更适合 2K 高刷竞技游戏，电源规格清晰，主板仍需确认具体型号。',
      advantages: ['高帧游戏 CPU 余量更充足', 'RTX 5070 更适合 2K 高刷', '电源标准明确'],
      risks: ['主板具体品牌与型号未明确'],
      unknowns: ['主板完整型号', 'SSD 具体品牌'],
      upgradeConsiderations: ['AM5 平台仍有升级空间', '750W ATX 3.1 可覆盖当前显卡功耗'],
      confidence: 0.92,
      generatedAt: now,
    },
    checklist: checklist(),
    note: '目标总价控制在 14,500 元以内。',
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: now,
  },
  {
    id: 'build_7800x3d_5060ti',
    title: '7800X3D + RTX 5060 Ti 控预算方案',
    platform: '天猫',
    store: 'DIY 装机旗舰店',
    url: '',
    price: 11_899,
    status: 'candidate',
    favorite: true,
    tags: ['7800X3D', 'RTX 5060 Ti', '16GB 显存', '价格较低', '电源待确认'],
    completeness: 75,
    components: {
      cpu: field('AMD Ryzen 7 7800X3D'),
      gpu: field('NVIDIA GeForce RTX 5060 Ti'),
      vram: field('16GB GDDR7'),
      motherboard: field('B650M（型号未明确）', 0.62),
      ram: field('32GB DDR5（16GB × 2）'),
      ramSpeed: field('6000MHz'),
      ssd: field('2TB PCIe 4.0 NVMe'),
      psu: field('750W（型号未明确）', 0.58),
      cooler: field('双塔风冷'),
      case: field('', 0),
    },
    images: [],
    priceHistory: [
      { id: 'price_b1', price: 12_399, recordedAt: '2026-09-05T10:00:00.000Z' },
      { id: 'price_b2', price: 11_899, recordedAt: now },
    ],
    snapshots: [],
    analysis: {
      summary: '总价更低且显存更大，但显卡性能与配置透明度弱于主推方案。',
      advantages: ['价格低 2,400 元', '16GB 显存更宽裕'],
      risks: ['电源型号未明确', '主板型号未明确', '机箱信息缺失'],
      unknowns: ['电源品牌与型号', '主板品牌与型号', '机箱兼容性'],
      upgradeConsiderations: ['购买前确认电源是否有原生 12V-2x6 线'],
      confidence: 0.84,
      generatedAt: now,
    },
    checklist: checklist().map((item, index) => ({ ...item, done: index < 3 })),
    note: '只有与 9800X3D 方案保持明显价差时才考虑。',
    createdAt: '2026-09-05T10:00:00.000Z',
    updatedAt: now,
  },
]
