import Dexie, { type Table } from 'dexie'
import type { Book, BookFormat, SavedWord, SavedSentence, AnalysisResult, Bookmark } from '@/types'
import { newSrsFields } from './srs'

class ReaderDB extends Dexie {
  books!: Table<Book, string>
  words!: Table<SavedWord, string>
  sentences!: Table<SavedSentence, string>
  bookmarks!: Table<Bookmark, string>

  constructor() {
    super('epub-ai-reader')
    this.version(1).stores({
      books: 'id, lastReadAt, updatedAt',
      words: 'id, &word, due, bookId, updatedAt',
      sentences: 'id, due, bookId, updatedAt',
    })
    this.version(2).stores({
      books: 'id, lastReadAt, updatedAt',
      words: 'id, &word, due, bookId, updatedAt',
      sentences: 'id, due, bookId, updatedAt',
      bookmarks: 'id, bookId, createdAt, updatedAt',
    })
    // v3：引入 PDF 支持，给历史书籍补默认 format='epub'
    this.version(3)
      .stores({
        books: 'id, lastReadAt, updatedAt',
        words: 'id, &word, due, bookId, updatedAt',
        sentences: 'id, due, bookId, updatedAt',
        bookmarks: 'id, bookId, createdAt, updatedAt',
      })
      .upgrade(tx =>
        tx
          .table('books')
          .toCollection()
          .modify(b => {
            if (!b.format) b.format = 'epub'
          })
      )
  }
}

export const db = new ReaderDB()

export function normalizeWord(raw: string): string {
  return raw.trim().toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, '')
}

export async function addBook(
  file: Blob,
  meta: { title: string; author: string; cover: Blob | null; format: BookFormat }
): Promise<string> {
  const now = Date.now()
  const id = crypto.randomUUID()
  await db.books.add({
    id,
    title: meta.title,
    author: meta.author,
    format: meta.format,
    file,
    cover: meta.cover,
    location: null,
    progress: null,
    addedAt: now,
    lastReadAt: now,
    updatedAt: now,
  })
  return id
}

export async function saveLocation(bookId: string, location: string, progress: number | null) {
  const now = Date.now()
  await db.books.update(bookId, {
    location,
    ...(progress != null ? { progress } : {}),
    lastReadAt: now,
    updatedAt: now,
  })
}

export async function saveWord(input: {
  display: string
  meaning: string
  sentence: string
  bookId: string
  bookTitle: string
}): Promise<boolean> {
  const word = normalizeWord(input.display)
  if (!word) return false
  const existing = await db.words.where('word').equals(word).first()
  if (existing) return false
  const now = Date.now()
  await db.words.add({
    id: crypto.randomUUID(),
    word,
    display: input.display.trim(),
    meaning: input.meaning,
    sentence: input.sentence,
    bookId: input.bookId,
    bookTitle: input.bookTitle,
    addedAt: now,
    updatedAt: now,
    ...newSrsFields(),
  })
  return true
}

export async function saveSentence(input: {
  sentence: string
  analysis: AnalysisResult
  bookId: string
  bookTitle: string
}) {
  const existing = await db.sentences.filter(s => s.sentence === input.sentence).first()
  if (existing) return
  const now = Date.now()
  await db.sentences.add({
    id: crypto.randomUUID(),
    sentence: input.sentence,
    analysis: input.analysis,
    graduated: false,
    bookId: input.bookId,
    bookTitle: input.bookTitle,
    addedAt: now,
    updatedAt: now,
    ...newSrsFields(),
  })
}

export async function addBookmark(input: {
  bookId: string
  cfi: string
  chapter: string
  excerpt: string
  percentage: number | null
}): Promise<string> {
  const now = Date.now()
  const id = crypto.randomUUID()
  await db.bookmarks.add({
    id,
    bookId: input.bookId,
    cfi: input.cfi,
    chapter: input.chapter,
    excerpt: input.excerpt,
    percentage: input.percentage,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function deleteBookmark(id: string) {
  await db.bookmarks.delete(id)
}

export async function dueCounts(): Promise<{ words: number; sentences: number }> {
  const now = Date.now()
  const words = await db.words.where('due').belowOrEqual(now).count()
  const sentences = await db.sentences
    .where('due')
    .belowOrEqual(now)
    .filter(s => !s.graduated)
    .count()
  return { words, sentences }
}
