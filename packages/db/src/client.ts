import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export interface SqlResult<T = Record<string, unknown>> {
  meta: {
    changes: number;
  };
  results: T[];
  success: boolean;
}

export interface SqlPreparedStatement {
  all: <T = Record<string, unknown>>() => Promise<SqlResult<T>>;
  bind: (...values: unknown[]) => SqlPreparedStatement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<SqlResult>;
}

export interface SqlDatabase {
  batch: <T = Record<string, unknown>>(
    statements: readonly SqlPreparedStatement[]
  ) => Promise<SqlResult<T>[]>;
  prepare: (query: string) => SqlPreparedStatement;
}

const RESERVED_USER_TABLE_PATTERN =
  /\b(?<clause>FROM|JOIN|INTO|UPDATE)\s+user\b/giu;

/**
 * Translate SQLite-style `?` placeholders and unquoted `user` table names into
 * PostgreSQL-compatible SQL while leaving single-quoted string literals intact.
 */
export const translateSqlForPostgres = (sqlText: string): string => {
  let out = "";
  let paramIndex = 0;
  let inSingleQuote = false;
  let segmentStart = 0;

  const flushCodeSegment = (segment: string): void => {
    out += segment.replace(RESERVED_USER_TABLE_PATTERN, '$<clause> "user"');
  };

  for (let i = 0; i < sqlText.length; i += 1) {
    const ch = sqlText[i];
    if (inSingleQuote) {
      if (ch === "'") {
        if (sqlText[i + 1] === "'") {
          i += 1;
        } else {
          inSingleQuote = false;
          out += sqlText.slice(segmentStart, i + 1);
          segmentStart = i + 1;
        }
      }
      continue;
    }

    if (ch === "'") {
      flushCodeSegment(sqlText.slice(segmentStart, i));
      inSingleQuote = true;
      segmentStart = i;
    } else if (ch === "?") {
      flushCodeSegment(sqlText.slice(segmentStart, i));
      paramIndex += 1;
      out += `$${paramIndex}`;
      segmentStart = i + 1;
    }
  }

  if (segmentStart < sqlText.length) {
    if (inSingleQuote) {
      out += sqlText.slice(segmentStart);
    } else {
      flushCodeSegment(sqlText.slice(segmentStart));
    }
  }

  return out;
};

const createRawPostgresClient = (connectionString: string) =>
  postgres(connectionString, {
    fetch_types: false,
    idle_timeout: 2,
    max: 2,
    prepare: false,
    types: {
      bigint: {
        from: [20],
        parse: Number,
        serialize: String,
        to: 20,
      },
      numeric: {
        from: [1700],
        parse: Number,
        serialize: String,
        to: 1700,
      },
    },
  });

const resolveConnectionStringSync = (
  source?: { HYPERDRIVE?: Hyperdrive } | string
): string => {
  if (typeof source === "string") {
    return source;
  }
  const hyperdrive = source?.HYPERDRIVE;
  if (!hyperdrive?.connectionString) {
    throw new Error("HYPERDRIVE binding is not configured");
  }
  return hyperdrive.connectionString;
};

const resolveConnectionStringAsync = async (
  source?: { HYPERDRIVE?: Hyperdrive } | string
): Promise<string> => {
  if (typeof source === "string") {
    return source;
  }
  if (source?.HYPERDRIVE?.connectionString) {
    return source.HYPERDRIVE.connectionString;
  }
  const { env } = await import("@ppal/env/server");
  if (!env.HYPERDRIVE?.connectionString) {
    throw new Error("HYPERDRIVE binding is not configured");
  }
  return env.HYPERDRIVE.connectionString;
};

export const createPostgresClient = (
  source: { HYPERDRIVE?: Hyperdrive } | string
) => createRawPostgresClient(resolveConnectionStringSync(source));

/**
 * Returns a lazy Drizzle PostgreSQL proxy so `createAuth()` can be constructed
 * in Worker global scope without touching `env.HYPERDRIVE.connectionString`
 * (which Cloudflare forbids outside a request handler) and without sharing
 * Hyperdrive TCP sockets across separate Worker invocations.
 */
export const createDb = (source: { HYPERDRIVE?: Hyperdrive } | string) => {
  type DrizzleClient = ReturnType<typeof drizzle>;
  return new Proxy({} as DrizzleClient, {
    get: (_target, prop) => {
      const instance = drizzle(createPostgresClient(source));
      const value = Reflect.get(instance, prop, instance);
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
};

interface BoundStatement extends SqlPreparedStatement {
  readonly params: unknown[];
  readonly query: string;
}

const isBoundStatement = (
  statement: SqlPreparedStatement
): statement is BoundStatement => "query" in statement && "params" in statement;

const normalizeParam = (value: unknown): postgres.ParameterOrJSON<never> => {
  if (value === undefined) {
    return null;
  }
  return value as postgres.ParameterOrJSON<never>;
};

export const createSqlDatabase = (
  source?: { HYPERDRIVE?: Hyperdrive } | string
): SqlDatabase => {
  const executeSingle = async <T>(
    query: string,
    params: unknown[]
  ): Promise<SqlResult<T>> => {
    const client = createRawPostgresClient(
      await resolveConnectionStringAsync(source)
    );
    try {
      const pgQuery = translateSqlForPostgres(query);
      const rows = await client.unsafe<T[]>(
        pgQuery,
        params.map(normalizeParam)
      );
      return {
        meta: { changes: rows.count ?? rows.length },
        results: [...rows],
        success: true,
      };
    } finally {
      try {
        await client.end({ timeout: 2 });
      } catch {
        // Best-effort cleanup of per-operation Hyperdrive client.
      }
    }
  };

  const makeStatement = (query: string, params: unknown[]): BoundStatement => ({
    all: <T = Record<string, unknown>>() => executeSingle<T>(query, params),
    bind: (...values: unknown[]) => makeStatement(query, values),
    first: async <T = Record<string, unknown>>() => {
      const result = await executeSingle<T>(query, params);
      return result.results[0] ?? null;
    },
    params,
    query,
    run: () => executeSingle(query, params),
  });

  return {
    batch: async <T = Record<string, unknown>>(
      statements: readonly SqlPreparedStatement[]
    ): Promise<SqlResult<T>[]> => {
      if (statements.length === 0) {
        return [];
      }
      const client = createRawPostgresClient(
        await resolveConnectionStringAsync(source)
      );
      try {
        const results = await client.begin(async (tx) => {
          const out: SqlResult<T>[] = [];
          for (const statement of statements) {
            if (!isBoundStatement(statement)) {
              throw new Error(
                "SqlDatabase.batch requires statements created by prepare()"
              );
            }
            const pgQuery = translateSqlForPostgres(statement.query);
            // oxlint-disable-next-line no-await-in-loop -- Transactional batch executes statements sequentially.
            const rows = await tx.unsafe<T[]>(
              pgQuery,
              statement.params.map(normalizeParam)
            );
            out.push({
              meta: { changes: rows.count ?? rows.length },
              results: [...rows],
              success: true,
            });
          }
          return out;
        });
        return results;
      } finally {
        try {
          await client.end({ timeout: 2 });
        } catch {
          // Best-effort cleanup of per-operation Hyperdrive client.
        }
      }
    },
    prepare: (query: string) => makeStatement(query, []),
  };
};
