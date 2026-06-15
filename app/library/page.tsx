'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'

export default function LibraryPage() {
  const [tab, setTab] = useState<'words' | 'sentences'>('words')

  const words = useLiveQuery(() => db.words.orderBy('updatedAt').reverse().toArray(), [])
  const sentences = useLiveQuery(() => db.sentences.orderBy('updatedAt').reverse().toArray(), [])

  return (
    <main className="min-h-screen bg-[#F7F2E9] px-8 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-amber-700 hover:text-amber-900 text-sm transition-colors">
            ← 书架
          </Link>
          <h1 className="text-2xl font-bold text-amber-900">积累</h1>
          <div className="ml-auto flex bg-amber-100 rounded-full p-1">
            <button
              onClick={() => setTab('words')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                tab === 'words' ? 'bg-white text-amber-900 shadow-sm' : 'text-amber-600 hover:text-amber-800'
              }`}
            >
              生词 {words?.length ?? 0}
            </button>
            <button
              onClick={() => setTab('sentences')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                tab === 'sentences' ? 'bg-white text-amber-900 shadow-sm' : 'text-amber-600 hover:text-amber-800'
              }`}
            >
              句子 {sentences?.length ?? 0}
            </button>
          </div>
        </div>

        {tab === 'words' && (
          <div className="space-y-3">
            {words?.length === 0 && (
              <p className="text-amber-400 text-sm text-center py-16">
                还没有生词。读书时双击不认识的单词，点「＋收藏」就会出现在这里。
              </p>
            )}
            {words?.map(w => (
              <div key={w.id} className="bg-white rounded-xl border border-amber-100 px-5 py-4 group">
                <div className="flex items-baseline gap-3">
                  <span className="font-bold text-amber-900">{w.display}</span>
                  <span className="text-gray-600 text-sm">{w.meaning}</span>
                  <button
                    onClick={() => db.words.delete(w.id)}
                    className="ml-auto text-gray-200 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-all"
                    title="删除"
                  >
                    删除
                  </button>
                </div>
                {w.sentence && (
                  <p className="text-sm text-gray-400 mt-1.5 leading-relaxed italic">
                    &ldquo;{w.sentence}&rdquo;
                    {w.bookTitle && <span className="not-italic"> ——《{w.bookTitle}》</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'sentences' && (
          <div className="space-y-3">
            {sentences?.length === 0 && (
              <p className="text-amber-400 text-sm text-center py-16">
                还没有句子。读书时划选看不懂的句子，拆解后会自动积累在这里。
              </p>
            )}
            {sentences?.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-amber-100 px-5 py-4 group">
                <div className="flex items-start gap-3">
                  <p className="text-sm text-gray-800 leading-relaxed italic flex-1">
                    &ldquo;{s.sentence}&rdquo;
                  </p>
                  {s.graduated && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full shrink-0">
                      已掌握
                    </span>
                  )}
                  <button
                    onClick={() => db.sentences.delete(s.id)}
                    className="text-gray-200 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="删除"
                  >
                    删除
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">{s.analysis.translation}</p>
                {s.analysis.structure && (
                  <p className="text-xs text-amber-500 mt-1.5">{s.analysis.structure}</p>
                )}
                {s.bookTitle && (
                  <p className="text-xs text-amber-300 mt-1.5">《{s.bookTitle}》</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
