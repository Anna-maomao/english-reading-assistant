export interface WordPopupState {
  word: string
  meaning: string
  sentence: string
  position: { x: number; y: number }
}

export interface AnalysisResult {
  structure: string
  phrases: { phrase: string; meaning: string }[]
  notes: string
  translation: string
}

export interface AnalysisState {
  sentence: string
  result: AnalysisResult | null
  loading: boolean
}

// ── 持久化模型 ──────────────────────────────────────────────────────────────
// 所有记录使用 uuid 主键 + updatedAt 时间戳，未来接 Supabase 同步时
// 可直接按 updatedAt 做增量上行，无需迁移主键。

export type BookFormat = 'epub' | 'pdf' | 'md'

export interface Book {
  id: string
  title: string
  author: string
  format: BookFormat // 缺省视为 'epub'（v3 之前导入的旧书）
  file: Blob
  cover: Blob | null
  location: string | null // EPUB：CFI；PDF：`page:N`；MD：`scroll:<0-1>`（滚动百分比）续读定位
  progress: number | null // 0-1
  addedAt: number
  lastReadAt: number
  updatedAt: number
}

export interface SrsFields {
  step: number // 间隔阶梯下标，失败归零
  due: number // 下次复习时间戳
  streak: number // 连续记得次数
  reps: number // 总复习次数
}

export interface SavedWord extends SrsFields {
  id: string
  word: string // 规范化小写
  display: string // 原文形态
  meaning: string
  sentence: string // 遇到该词时的原句
  bookId: string
  bookTitle: string
  addedAt: number
  updatedAt: number
}

export interface Bookmark {
  id: string
  bookId: string
  cfi: string // EPUB CFI，精确跳回位置
  chapter: string // 所在章节标题
  excerpt: string // 该位置附近的正文片段，便于辨认
  percentage: number | null // 全书进度，用于判断当前是否处于此书签
  createdAt: number
  updatedAt: number
}

export interface TocItem {
  label: string
  href: string
  depth: number
}

export interface SavedSentence extends SrsFields {
  id: string
  sentence: string
  analysis: AnalysisResult
  graduated: boolean // 连续看懂后毕业，不再排期
  bookId: string
  bookTitle: string
  addedAt: number
  updatedAt: number
}
