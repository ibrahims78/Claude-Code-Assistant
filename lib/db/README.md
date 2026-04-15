# @workspace/db

مكتبة قاعدة البيانات المشتركة — PostgreSQL + Drizzle ORM + pgvector.

## الاستخدام

```typescript
import { db, usersTable, contentChunksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// مثال استعلام
const users = await db.select().from(usersTable).where(eq(usersTable.isActive, true));
```

## الجداول المصدّرة

```typescript
export {
  usersTable,
  whatsappSessionsTable,
  messagesTable,
  apiKeysTable,
  auditLogsTable,
  settingsTable,
  conversationsTable,
  chatMessagesTable,
  contentChunksTable,
  userProgressTable,
  resourcesTable,
  resourceTranslationsTable,
  resourceSuggestionsTable,
  telegramUsersTable,
  telegramConversationsTable,
}
```

## الأوامر

```bash
# رفع المخطط لقاعدة البيانات
pnpm --filter @workspace/db run push

# توليد migration files
pnpm --filter @workspace/db run generate
```

→ [توثيق قاعدة البيانات الكامل](../../docs/database.md)
