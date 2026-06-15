# English Reading Assistant · EPUB / PDF AI Reader

> Read the original · Ask only when stuck · Words & sentences saved automatically

[中文 README](./README.md) · **English**

An AI-powered reader for people learning English by reading real books. Import an EPUB / PDF, double-click any word you don't know to get its meaning in context, and select any tough sentence to have the AI break down its structure. Every word you look up and every sentence you analyze is automatically added to a spaced-repetition (SRS) queue, so they actually stick.

All data lives in your own browser — no accounts, no server database. **Works out of the box.**

---

## Features

- **Reads EPUB and PDF** — drag in or click to import; title, author and cover are extracted automatically
- **Double-click lookup** — double-click any word and the AI gives its meaning *in this sentence*, not a generic dictionary entry
- **Select to analyze** — highlight a long sentence and the AI breaks down its structure, key phrases, tricky points and a full translation
- **Vocabulary book + sentence library** — everything you look up is saved automatically
- **Spaced repetition (SRS)** — scheduled on a 1 / 3 / 7 / 14 / 30 / 60 day ladder; a sentence card "graduates" after you understand it 3 times in a row
- **Reading experience** — table of contents, bookmarks, resume-where-you-left-off, reading progress; PDFs use lazy paging (hundreds of pages stay smooth)
- **Local-first data** — everything is stored in the browser's IndexedDB; it does not sync across devices (a design trade-off, not a bug)

## Quick start

Requires [Node.js](https://nodejs.org) 18+.

```bash
git clone https://github.com/martinachain/english-reading-assistant.git
cd english-reading-assistant
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first launch a dialog asks for your **DeepSeek API Key** — fill it in and you're ready.

> No `.env` file needed — the key is entered in the UI and stored only in your local browser.

### Getting a DeepSeek API Key

Word lookup and sentence analysis call [DeepSeek](https://platform.deepseek.com) (cheap, and strong with Chinese):

1. Sign up and log in at [platform.deepseek.com](https://platform.deepseek.com)
2. Create a key on the [API Keys](https://platform.deepseek.com/api_keys) page (looks like `sk-...`)
3. Top up a small balance (a sentence analysis costs a fraction of a cent)
4. Paste the key into the app's settings dialog

The key is stored only in your browser's `localStorage`. Each request is forwarded to DeepSeek through this app's own backend and is never sent to any third party.

## Tech stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router + Turbopack), React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Local storage**: [Dexie](https://dexie.org) (an IndexedDB wrapper)
- **E-book parsing**: [epub.js](https://github.com/futurepress/epub.js), [pdf.js](https://mozilla.github.io/pdf.js/)
- **AI**: OpenAI SDK with `baseURL` pointed at DeepSeek (the `deepseek-chat` model)

## Project structure

```
app/
  page.tsx              Bookshelf (import, review entry, API key settings)
  read/[bookId]/        Reader (lookup, sentence analysis, bookmarks, TOC)
  review/               Spaced-repetition review
  library/              Vocabulary book
  api/word/             Word-definition endpoint
  api/analyze/          Sentence-analysis endpoint
components/             Reader, dialogs, panels, etc.
lib/                    Database, SRS algorithm, pdf/epub parsing, API key management
types/                  Shared types
```

## Notes & limitations

- **Data is stored locally in the browser**: clearing browser data / switching browsers = books and records are gone. The types reserve an `updatedAt` field, so cloud sync (e.g. Supabase) could be added later.
- **Best for local self-hosting**: each person runs their own copy with their own key. If you deploy it as a public shared URL, the "key in browser + forwarded through the backend" model is no longer safe (the backend becomes an open proxy) — you'd need to add authentication and rate limiting.
- The backend endpoints **only accept a key supplied by the user via request headers**; there is no `DEEPSEEK_API_KEY` environment-variable fallback — this prevents a public deployment from being abused as a free DeepSeek proxy.

## License

MIT
