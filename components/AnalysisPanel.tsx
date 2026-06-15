'use client'

import type { AnalysisState } from '@/types'

interface AnalysisPanelProps {
  items: AnalysisState[]
  onClear: () => void
}

function AnalysisCard({ item }: { item: AnalysisState }) {
  const { sentence, result, loading } = item
  return (
    <div className="border border-amber-100 rounded-xl overflow-hidden">
      {/* Sentence quote */}
      <div className="px-4 py-3 bg-amber-50">
        <p className="text-sm text-amber-900 leading-relaxed italic line-clamp-3">
          &ldquo;{sentence}&rdquo;
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-amber-500 text-sm">
            <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            AI 分析中…
          </div>
        )}

        {result && (
          <>
            <section>
              <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1.5">句子结构</h3>
              <p className="text-sm text-gray-800 leading-relaxed bg-amber-50 rounded-lg px-3 py-2">{result.structure}</p>
            </section>

            {result.phrases?.length > 0 && (
              <section>
                <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1.5">关键短语</h3>
                <div className="space-y-2">
                  {result.phrases.map((p, i) => (
                    <div key={i} className="text-sm border-l-2 border-amber-100 pl-2.5">
                      <p className="font-semibold text-amber-800">{p.phrase}</p>
                      <p className="text-gray-600 leading-snug">{p.meaning}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {result.notes && (
              <section>
                <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1.5">难点注解</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{result.notes}</p>
              </section>
            )}

            <section>
              <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1.5">中文翻译</h3>
              <p className="text-sm text-gray-800 leading-relaxed bg-amber-50 rounded-lg px-3 py-2 font-medium">{result.translation}</p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default function AnalysisPanel({ items, onClear }: AnalysisPanelProps) {
  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 shrink-0">
        <h2 className="font-bold text-amber-900 text-sm tracking-wide">句子拆解</h2>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            清空
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-amber-300 select-none">
            <span className="text-4xl">✍️</span>
            <p className="text-sm">划选句子开始分析</p>
          </div>
        ) : (
          items.map((item, i) => <AnalysisCard key={i} item={item} />)
        )}
      </div>
    </div>
  )
}
