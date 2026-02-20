import {
  mysqlTable,
  varchar,
  int,
  bigint,
  decimal,
  boolean,
  timestamp,
  text,
  json,
  index,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  name: varchar("name", { length: 100 }),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const accounts = mysqlTable("accounts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("accounts_user_idx").on(t.userId),
  providerIdx: index("accounts_provider_idx").on(t.provider, t.providerAccountId),
}));

export const apiKeys = mysqlTable("api_keys", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  keyHash: varchar("key_hash", { length: 255 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 10 }).notNull(),
  name: varchar("name", { length: 100 }),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("api_keys_user_idx").on(t.userId),
}));

export const balances = mysqlTable("balances", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().unique().references(() => users.id),
  balance: decimal("balance", { precision: 18, scale: 6 }).notNull().default("0"),
  subscriptionCredits: decimal("subscription_credits", { precision: 18, scale: 6 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const subscriptions = mysqlTable("subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  plan: varchar("plan", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  monthlyCredits: decimal("monthly_credits", { precision: 18, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  userIdx: index("subscriptions_user_idx").on(t.userId),
}));

export const models = mysqlTable("models", {
  id: varchar("id", { length: 100 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  inputPricePerMToken: decimal("input_price_per_m_token", { precision: 10, scale: 6 }).notNull(),
  outputPricePerMToken: decimal("output_price_per_m_token", { precision: 10, scale: 6 }).notNull(),
  contextWindow: int("context_window"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const usageLogs = mysqlTable("usage_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  apiKeyId: varchar("api_key_id", { length: 36 }).references(() => apiKeys.id),
  model: varchar("model", { length: 100 }).notNull(),
  inputTokens: int("input_tokens").notNull().default(0),
  outputTokens: int("output_tokens").notNull().default(0),
  cost: decimal("cost", { precision: 18, scale: 6 }).notNull().default("0"),
  statusCode: int("status_code").notNull(),
  durationMs: int("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("usage_logs_user_idx").on(t.userId),
  modelIdx: index("usage_logs_model_idx").on(t.model),
  createdAtIdx: index("usage_logs_created_at_idx").on(t.createdAt),
}));

export const billingTransactions = mysqlTable("billing_transactions", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  keyHash: varchar("key_hash", { length: 64 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  estimatedTokens: int("estimated_tokens").notNull(),
  actualTokens: int("actual_tokens").notNull().default(0),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 6 }).notNull(),
  actualCost: decimal("actual_cost", { precision: 10, scale: 6 }).notNull().default("0"),
  status: mysqlEnum("status", ["pending", "settled", "cancelled"]).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  userIdx: index("billing_transactions_user_idx").on(t.userId),
}));

export const auditLogs = mysqlTable("audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 100 }),
  resourceId: varchar("resource_id", { length: 100 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("audit_logs_user_idx").on(t.userId),
  actionIdx: index("audit_logs_action_idx").on(t.action),
  createdAtIdx: index("audit_logs_created_at_idx").on(t.createdAt),
}));
