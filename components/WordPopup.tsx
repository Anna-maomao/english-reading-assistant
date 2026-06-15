'use client'

interface WordPopupProps {
  word: string
  meaning: string
  position: { x: number; y: number }
  onClose: () => void
  onSave: () => void
}

export default function WordPopup({ word, meaning, position, onClose, onSave }: WordPopupProps) {
  return (
    <div
      className="fixed z-50 pointer-events-auto"
      style={{
        left: position.x,
        top: position.y - 72,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-amber-100 px-4 py-3 min-w-[120px] max-w-[220px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-amber-800 text-sm truncate">{word}</p>
            <p className="text-gray-700 text-sm mt-0.5 min-h-[1.2em]">
              {meaning || <span className="text-gray-400 animate-pulse">查询中…</span>}
            </p>
          </div>
          <div className="flex gap-1 shrink-0 mt-0.5">
            {meaning && (
              <button
                onClick={onSave}
                title="收藏单词"
                className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50 transition-colors"
              >
                ＋收藏
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-gray-500 text-base leading-none px-1 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      </div>
      {/* Arrow */}
      <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-r border-b border-amber-100 rotate-45" />
    </div>
  )
}
