# 英语阅读助手 · EPUB / PDF AI Reader

> 直接读原文 · 卡住才求助 · 生词句子自动沉淀

**中文** · [English](./README.en.md)

🔗 **在线体验：[english-reading.zeabur.app](https://english-reading.zeabur.app)**（自带 DeepSeek key 即可使用）

一个面向中文学习者的英语原版书阅读器。导入 EPUB / PDF，遇到不懂的单词双击查意思，遇到看不懂的长句划选让 AI 拆结构。查过的词、拆过的句会自动进入间隔重复（SRS）队列，帮你把生词和难句真正记住。

所有数据都存在你自己的浏览器里，没有账号、没有服务器数据库，**开箱即用**。

---

## 功能

- **读 EPUB 和 PDF** —— 拖入或点击导入，自动提取书名、作者、封面
- **双击查词** —— 双击任意单词，AI 结合上下文给出本句中的中文释义
- **划选拆句** —— 选中一个长句，AI 拆出句子结构、关键短语、难点注解和完整翻译
- **生词本 + 句子库** —— 查过的词、拆过的句自动入库
- **间隔重复复习（SRS）** —— 按 1 / 3 / 7 / 14 / 30 / 60 天的阶梯排期，句卡连续看懂 3 次后「毕业」
- **阅读体验** —— 目录跳转、书签、续读定位、阅读进度，PDF 支持懒加载分页（几百页也不卡）
- **数据本地化** —— 全部存浏览器 IndexedDB，换设备不同步（这是设计取舍，不是 bug）

## 快速开始

需要 [Node.js](https://nodejs.org) 18+。

```bash
git clone https://github.com/martinachain/english-reading-assistant.git
cd english-reading-assistant
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，第一次进会弹出配置框，填入你的 **DeepSeek API Key** 即可开始。

> 不需要创建 `.env` 文件——key 在界面里填，只存你本地浏览器。

### 申请 DeepSeek API Key

AI 查词和拆句调用的是 [DeepSeek](https://platform.deepseek.com)（便宜、对中文友好）：

1. 注册并登录 [platform.deepseek.com](https://platform.deepseek.com)
2. 在 [API Keys](https://platform.deepseek.com/api_keys) 页面创建一个 key（形如 `sk-...`）
3. 充值少量额度（拆句一次几厘钱）
4. 把 key 填进应用的配置框

key 只保存在你的浏览器 `localStorage`，每次请求由你的浏览器**直接发送给 DeepSeek 官方接口**，不经过本应用的任何服务器，也不会上传到任何第三方。

## 技术栈

- **框架**：[Next.js 16](https://nextjs.org)（App Router + Turbopack）、React 19、TypeScript
- **样式**：Tailwind CSS v4
- **本地存储**：[Dexie](https://dexie.org)（IndexedDB 封装）
- **电子书解析**：[epub.js](https://github.com/futurepress/epub.js)、[pdf.js](https://mozilla.github.io/pdf.js/)
- **AI**：浏览器用 `fetch` 直连 DeepSeek 官方接口（`deepseek-chat` 模型），无服务端代理

## 项目结构

```
app/
  page.tsx              书架（导入、复习入口、API Key 配置）
  read/[bookId]/        阅读页（查词、拆句、书签、目录）
  review/               间隔重复复习
  library/              生词本
components/             阅读器、弹框、面板等
lib/
  deepseek.ts           浏览器直连 DeepSeek（查词 / 拆句）
  db.ts、srs.ts 等       数据库、SRS 算法、pdf/epub 解析、API Key 管理
types/                  共享类型
```

## 说明与边界

- **数据存在浏览器本地**：清空浏览器数据 / 换浏览器 = 书和记录都没了。类型里预留了 `updatedAt` 字段，未来可接 Supabase 等做云同步。
- **可以放心公开部署**：本应用是纯前端，没有后端、不持有任何密钥。每个用户用自己浏览器里的 key 直连 DeepSeek，所以即使部署成公开网址，也不会变成「免费 DeepSeek 代理」被人白嫖——这正是改用浏览器直连、删掉服务端代理的原因。
- **key 安全**：你的 key 只存在你自己的浏览器、只发给 DeepSeek 官方接口，本应用的服务器全程接触不到它。

## License

MIT
