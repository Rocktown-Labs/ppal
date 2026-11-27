import { sql } from "drizzle-orm";
import { bigint } from "drizzle-orm/pg-core";

export const epochMsNowSql = sql`(extract(epoch from now()) * 1000)::bigint`;

export const createdAtColumn = () =>
  bigint("created_at", { mode: "number" }).default(epochMsNowSql).notNull();

export const updatedAtColumn = () =>
  bigint("updated_at", { mode: "number" })
    .default(epochMsNowSql)
    .$onUpdate(() => Date.now())
    .notNull();
