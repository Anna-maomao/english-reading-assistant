'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'

interface VocabPanelProps {
  onClose: () => void
}

export default function VocabPanel({ onClose }: VocabPanelProps) {
  const words = useLiveQuery(() => db.words.orderBy('updatedAt').reverse().toArray(), [])

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 shrink-0">
        <h2 className="font-bold text-amber-900 text-sm tracking-wide">
          生词本 {(words?.length ?? 0) > 0 && <span className="text-amber-400 font-normal">{words?.length}</span>}
        </h2>
        <button
          onClick={onClose}
          title="收起生词本"
          className="text-gray-300 hover:text-gray-600 text-xl leading-none transition-colors"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {words?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-amber-300 select-none">
            <span className="text-4xl">📓</span>
            <p className="text-sm">双击生词 ＋收藏，会出现在这里</p>
          </div>
        ) : (
          words?.map(w => (
            <div
              key={w.id}
              className="group border border-amber-100 rounded-lg px-3 py-2.5 hover:border-amber-200 transition-colors"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-amber-900 text-sm">{w.display}</span>
                <span className="text-gray-600 text-sm">{w.meaning}</span>
                <button
                  onClick={() => db.words.delete(w.id)}
                  className="ml-auto text-gray-200 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="删除"
                >
                  删除
                </button>
              </div>
              {w.sentence && (
                <p className="text-xs text-gray-400 mt-1 leading-relaxed italic line-clamp-2">
                  &ldquo;{w.sentence}&rdquo;
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
