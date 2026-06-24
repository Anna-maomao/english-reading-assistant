'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { reviewCard, GRADUATE_STREAK } from '@/lib/srs'
import { exportAllToAnki as buildAnkiExport } from '@/lib/anki'
import type { SavedWord, SavedSentence } from '@/types'

// 导出 Anki：拉全部生词 / 句子（不限于今天到期的），合并成单文件一次性下载
async function exportAllToAnki() {
  const [words, sentences] = await Promise.all([
    db.words.orderBy('updatedAt').reverse().toArray(),
    db.sentences.orderBy('updatedAt').reverse().toArray(),
  ])
  if (words.length === 0 && sentences.length === 0) {
    alert('还没有生词或句子可以导出')
    return
  }
  buildAnkiExport(words, sentences)
}

type Card =
  | { kind: 'word'; data: SavedWord }
  | { kind: 'sentence'; data: SavedSentence }

// 句子里高亮目标词
function SentenceWithWord({ sentence, word }: { sentence: string; word: string }) {
  if (!sentence) return null
  const re = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi')
  const parts = sentence.split(re)
  return (
    <p className="text-base text-gray-800 leading-relaxed">
      {parts.map((part, i) =>
        part.toLowerCase() === word.toLowerCase() ? (
          <strong key={i} className="text-amber-700 font-bold">{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  )
}

export default function ReviewPage() {
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [lastAnswerOk, setLastAnswerOk] = useState<boolean | null>(null)
  const [doneCount, setDoneCount] = useState(0)

  useEffect(() => {
    const now = Date.now()
    Promise.all([
      db.words.where('due').belowOrEqual(now).toArray(),
      db.sentences.where('due').belowOrEqual(now).filter(s => !s.graduated).toArray(),
    ]).then(([words, sentences]) => {
      const cards: Card[] = [
        ...words.map(w => ({ kind: 'word' as const, data: w })),
        ...sentences.map(s => ({ kind: 'sentence' as const, data: s })),
      ]
      // 词句穿插，避免连续大段句子
      cards.sort(() => Math.random() - 0.5)
      setQueue(cards)
    })
  }, [])

  const current = queue && index < queue.length ? queue[index] : null

  const answer = useCallback(async (remembered: boolean) => {
    if (!current || !queue) return
    const updated = reviewCard(current.data, remembered)

    if (current.kind === 'word') {
      await db.words.update(current.data.id, { ...updated, updatedAt: Date.now() })
    } else {
      const graduated = remembered && updated.streak >= GRADUATE_STREAK
      await db.sentences.update(current.data.id, {
        ...updated,
        graduated,
        updatedAt: Date.now(),
      })
    }

    if (current.kind === 'sentence') {
      // 句卡：作答后展示拆解再进入下一张
      setLastAnswerOk(remembered)
      setRevealed(true)
      if (!remembered) {
        setQueue(q => (q ? [...q, { ...current, data: { ...current.data, ...updated } } as Card] : q))
      }
      return
    }

    // 词卡：答错重新排队
    if (!remembered) {
      setQueue(q => (q ? [...q, { ...current, data: { ...current.data, ...updated } } as Card] : q))
    }
    setDoneCount(c => c + 1)
    setIndex(i => i + 1)
    setRevealed(false)
    setLastAnswerOk(null)
  }, [current, queue])

  const nextCard = useCallback(() => {
    setDoneCount(c => c + 1)
    setIndex(i => i + 1)
    setRevealed(false)
    setLastAnswerOk(null)
  }, [])

  const deleteCard = useCallback(async () => {
    if (!current) return
    if (!confirm('删除这张卡片？这会从生词本/句子里彻底移除，无法恢复。')) return
    if (current.kind === 'word') {
      await db.words.delete(current.data.id)
    } else {
      await db.sentences.delete(current.data.id)
    }
    // 清掉队列里这张卡之后的副本（答错重排进来的），避免再次出现
    setQueue(q => (q ? q.filter((c, i) => i <= index || c.data.id !== current.data.id) : q))
    setIndex(i => i + 1)
    setRevealed(false)
    setLastAnswerOk(null)
  }, [current, index])

  if (!queue) {
    return (
      <main className="min-h-screen bg-[#F7F2E9] flex items-center justify-center">
        <p className="text-amber-400 animate-pulse">加载中…</p>
      </main>
    )
  }

  // 完成
  if (!current) {
    return (
      <main className="min-h-screen bg-[#F7F2E9] flex flex-col items-center justify-center gap-6">
        <span className="text-6xl">🎉</span>
        <div className="text-center">
          <p className="text-xl font-bold text-amber-900">
            {queue.length === 0 ? '今天没有待复习的内容' : `复习完成，共 ${doneCount} 张卡片`}
          </p>
          <p className="text-amber-600 text-sm mt-1">
            {queue.length === 0 ? '去读书吧，生词会自动积累进来' : '继续保持，去读书吧'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportAllToAnki}
            title="把所有生词和句子导出为 Anki 可导入的文本"
            className="border border-amber-300 text-amber-700 hover:bg-amber-100 px-6 py-2.5 rounded-full text-sm font-semibold transition-colors"
          >
            导出 Anki
          </button>
          <Link
            href="/"
            className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-colors"
          >
            回到书架
          </Link>
        </div>
      </main>
    )
  }

  const remaining = queue.length - index

  return (
    <main className="min-h-screen bg-[#F7F2E9] flex flex-col">
      {/* Top bar */}
      <header className="h-12 flex items-center px-5 gap-4 shrink-0">
        <Link href="/" className="text-amber-700 hover:text-amber-900 text-sm transition-colors">
          ← 退出复习
        </Link>
        <span className="ml-auto text-xs text-amber-500">剩余 {remaining} 张</span>
        <button
          onClick={exportAllToAnki}
          title="把所有生词和句子导出为 Anki 可导入的文本"
          className="text-amber-500 hover:text-amber-700 text-xs font-medium transition-colors"
        >
          导出 Anki
        </button>
      </header>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg border border-amber-100 overflow-hidden">
          {current.kind === 'word' ? (
            <>
              <div className="px-8 pt-8 pb-6">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-4">
                  生词 · 还记得意思吗
                </p>
                <p className="text-3xl font-bold text-amber-900 mb-5">{current.data.display}</p>
                <SentenceWithWord sentence={current.data.sentence} word={current.data.word} />
                {current.data.bookTitle && (
                  <p className="text-xs text-amber-400 mt-3">——《{current.data.bookTitle}》</p>
                )}
              </div>

              {revealed ? (
                <>
                  <div className="px-8 py-4 bg-amber-50 border-t border-amber-100">
                    <p className="text-lg font-semibold text-gray-800">{current.data.meaning}</p>
                  </div>
                  <div className="grid grid-cols-3">
                    <button
                      onClick={deleteCard}
                      title="删除这张卡片（误加的）"
                      className="py-4 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors border-t border-amber-100"
                    >
                      删除
                    </button>
                    <button
                      onClick={() => answer(false)}
                      className="py-4 text-sm font-semibold text-orange-500 hover:bg-orange-50 transition-colors border-t border-l border-amber-100"
                    >
                      忘了
                    </button>
                    <button
                      onClick={() => answer(true)}
                      className="py-4 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors border-t border-l border-amber-100"
                    >
                      记得
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setRevealed(true)}
                  className="w-full py-4 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors border-t border-amber-100"
                >
                  显示释义
                </button>
              )}
            </>
          ) : (
            <>
              <div className="px-8 pt-8 pb-6">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-4">
                  句子 · 现在能直接看懂吗
                </p>
                <p className="text-lg text-gray-800 leading-relaxed italic">
                  &ldquo;{current.data.sentence}&rdquo;
                </p>
                {current.data.bookTitle && (
                  <p className="text-xs text-amber-400 mt-3">——《{current.data.bookTitle}》</p>
                )}
              </div>

              {revealed ? (
                <>
                  <div className="px-8 py-5 bg-amber-50 border-t border-amber-100 space-y-4 max-h-72 overflow-y-auto">
                    {lastAnswerOk === false && current.data.analysis.structure && (
                      <div>
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">句子结构</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{current.data.analysis.structure}</p>
                      </div>
                    )}
                    {lastAnswerOk === false && current.data.analysis.phrases?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">关键短语</p>
                        {current.data.analysis.phrases.map((p, i) => (
                          <p key={i} className="text-sm text-gray-700">
                            <span className="font-semibold text-amber-800">{p.phrase}</span>
                            <span className="text-amber-300 mx-1.5">—</span>
                            {p.meaning}
                          </p>
                        ))}
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">中文翻译</p>
                      <p className="text-sm text-gray-800 leading-relaxed font-medium">
                        {current.data.analysis.translation}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={nextCard}
                    className="w-full py-4 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors border-t border-amber-100"
                  >
                    下一张 →
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-3">
                  <button
                    onClick={deleteCard}
                    title="删除这张卡片（误加的）"
                    className="py-4 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors border-t border-amber-100"
                  >
                    删除
                  </button>
                  <button
                    onClick={() => answer(false)}
                    className="py-4 text-sm font-semibold text-orange-500 hover:bg-orange-50 transition-colors border-t border-l border-amber-100"
                  >
                    没看懂
                  </button>
                  <button
                    onClick={() => answer(true)}
                    className="py-4 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors border-t border-l border-amber-100"
                  >
                    看懂了
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
