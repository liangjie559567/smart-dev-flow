import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { users, accounts, apiKeys } from "./db/schema";
import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

async function redisSet(key: string, value: string, ex: number) {
  await fetch(`${process.env.REDIS_HTTP_URL}/set/${key}/${value}/ex/${ex}`, {
    headers: { Authorization: `Bearer ${process.env.REDIS_HTTP_TOKEN ?? ""}` },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
  }),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // 首次登录时自动生成 API Key
      if (!user.id) return true;
      const existing = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.userId, user.id))
        .limit(1);
      if (existing.length === 0) {
        const key = "sk-" + randomBytes(16).toString("hex"); // sk- + 32位十六进制
        const keyHash = createHash("sha256").update(key).digest("hex");
        await db.insert(apiKeys).values({
          id: uuidv4(),
          userId: user.id,
          keyHash,
          keyPrefix: key.slice(0, 10),
          name: "默认密钥",
        });
        await redisSet(`apikey:${keyHash}`, user.id, 86400 * 365);
      }
      return true;
    },
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
