import { env } from "@ppal/env/server";
import { drizzle } from "drizzle-orm/d1";

export const createDb = () => drizzle(env.DB);
