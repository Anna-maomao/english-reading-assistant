'use client'

import type { TocItem, Bookmark } from '@/types'

interface ReaderDrawerProps {
  tab: 'toc' | 'bookmarks'
  toc: TocItem[]
  bookmarks: Bookmark[]
  currentHref: string // 当前所在章节 href，用于高亮目录
  onTabChange: (tab: 'toc' | 'bookmarks') => void
  onGoTo: (target: string) => void
  onDeleteBookmark: (id: string) => void
  onClose: () => void
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

export default function ReaderDrawer({
  tab,
  toc,
  bookmarks,
  currentHref,
  onTabChange,
  onGoTo,
  onDeleteBookmark,
  onClose,
}: ReaderDrawerProps) {
  return (
    <>
      {/* 背景遮罩 */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/20 z-40 animate-[drawerFadeIn_150ms_ease-out]"
      />

      {/* 左侧抽屉 */}
      <aside className="fixed left-0 top-0 bottom-0 w-80 bg-[#FBF7EF] shadow-2xl z-50 flex flex-col animate-[drawerSlideIn_180ms_ease-out]">
        {/* 头部 tab 切换 */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-amber-100 shrink-0">
          <button
            onClick={() => onTabChange('toc')}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              tab === 'toc'
                ? 'bg-amber-600 text-white'
                : 'text-amber-700 hover:bg-amber-100'
            }`}
          >
            目录
          </button>
          <button
            onClick={() => onTabChange('bookmarks')}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              tab === 'bookmarks'
                ? 'bg-amber-600 text-white'
                : 'text-amber-700 hover:bg-amber-100'
            }`}
          >
            书签 {bookmarks.length > 0 && <span className="opacity-80">{bookmarks.length}</span>}
          </button>
          <button
            onClick={onClose}
            className="ml-auto text-gray-300 hover:text-gray-600 text-xl leading-none px-1 transition-colors"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'toc' ? (
            <nav className="py-2">
              {toc.length === 0 ? (
                <p className="text-amber-300 text-sm text-center py-16">这本书没有目录信息</p>
              ) : (
                toc.map((item, i) => {
                  const active = currentHref && item.href.split('#')[0] === currentHref
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        onGoTo(item.href)
                        onClose()
                      }}
                      style={{ paddingLeft: `${16 + item.depth * 16}px` }}
                      className={`w-full text-left pr-4 py-2.5 text-sm transition-colors ${
                        active
                          ? 'bg-amber-100 text-amber-900 font-semibold'
                          : 'text-gray-700 hover:bg-amber-50'
                      }`}
                    >
                      {item.label || '（无标题）'}
                    </button>
                  )
                })
              )}
            </nav>
          ) : (
            <div className="py-2 px-3 space-y-2">
              {bookmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center gap-3 text-amber-300 select-none py-16">
                  <span className="text-4xl">🔖</span>
                  <p className="text-sm px-6">点右上角的书签图标，<br />把当前位置存下来</p>
                </div>
              ) : (
                bookmarks.map(b => (
                  <div
                    key={b.id}
                    className="group relative bg-white rounded-lg border border-amber-100 hover:border-amber-200 transition-colors"
                  >
                    <button
                      onClick={() => {
                        onGoTo(b.cfi)
                        onClose()
                      }}
                      className="w-full text-left px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {b.chapter && (
                          <span className="text-[11px] text-amber-600 font-semibold truncate">{b.chapter}</span>
                        )}
                        {b.percentage != null && (
                          <span className="text-[10px] text-amber-300 shrink-0 ml-auto">
                            {Math.round(b.percentage * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 leading-snug line-clamp-2">
                        {b.excerpt || '（已保存此处位置）'}
                      </p>
                      <p className="text-[10px] text-gray-300 mt-1">{timeAgo(b.createdAt)}</p>
                    </button>
                    <button
                      onClick={() => onDeleteBookmark(b.id)}
                      className="absolute opacity-0 group-hover:opacity-100 transition-opacity top-2 right-2 text-gray-300 hover:text-red-400 text-xs"
                      title="删除书签"
                    >
                      删除
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
