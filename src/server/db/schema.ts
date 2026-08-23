/**
 * Drizzle ORM schema entrypoint.
 *
 * Define your database tables here by exporting mysqlTable instances.
 *
 * Example:
 * export const users = mysqlTable('users', {
 *   id: int('id').primaryKey().autoincrement(),
 *   name: varchar('name', { length: 255 }).notNull(),
 *   email: varchar('email', { length: 255 }).notNull().unique(),
 *   createdAt: timestamp('created_at').defaultNow(),
 * });
 *
 * After modifying this file:
 * 1. Run: npx drizzle-kit generate
 * 2. Run: npx drizzle-kit migrate
 */
export {};
