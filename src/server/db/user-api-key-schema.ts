import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Stores user-owned, AES-256-GCM encrypted API keys for AI question generation.
 * The plaintext key is NEVER stored — only the ciphertext, IV, and auth tag.
 * maskedKey is derived from the plaintext before encryption and is display-only.
 */
export const userApiKey = pgTable(
  "user_api_key",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // User-provided nickname
    provider: text("provider").notNull().default("gemini"), // "gemini" for now
    encryptedKey: text("encrypted_key").notNull(), // AES-256-GCM ciphertext (hex)
    iv: text("iv").notNull(), // Initialization vector (hex)
    authTag: text("auth_tag").notNull(), // Authentication tag (hex)
    maskedKey: text("masked_key").notNull(), // Display preview, e.g. AIza••••3f1a
    lastUsedAt: timestamp("last_used_at"), // Updated on each generation
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_api_key_user_id_idx").on(table.userId),
  ]
);

export const userApiKeyRelations = relations(userApiKey, ({ one }) => ({
  user: one(user, {
    fields: [userApiKey.userId],
    references: [user.id],
  }),
}));
