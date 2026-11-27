import { describe, expect, test } from "bun:test";

import { translateSqlForPostgres } from "@ppal/db";

describe("translateSqlForPostgres", () => {
  test("converts positional ? placeholders to $1..$n outside string literals", () => {
    const sql =
      "SELECT id FROM tickets WHERE user_id = ? AND status = '?' AND title != 'it''s ? ok' AND version = ?";
    expect(translateSqlForPostgres(sql)).toBe(
      "SELECT id FROM tickets WHERE user_id = $1 AND status = '?' AND title != 'it''s ? ok' AND version = $2"
    );
  });

  test("quotes reserved unquoted user table identifiers without touching strings or columns", () => {
    const sql =
      "SELECT u.id FROM user u JOIN profiles p ON p.user_id = u.id WHERE u.email = ? AND p.bio != 'from user test'";
    expect(translateSqlForPostgres(sql)).toBe(
      "SELECT u.id FROM \"user\" u JOIN profiles p ON p.user_id = u.id WHERE u.email = $1 AND p.bio != 'from user test'"
    );
  });

  test("handles UPDATE and INSERT INTO user statements", () => {
    expect(
      translateSqlForPostgres(
        "UPDATE user SET phone_number = ?, updated_at = ? WHERE id = ?"
      )
    ).toBe(
      'UPDATE "user" SET phone_number = $1, updated_at = $2 WHERE id = $3'
    );

    expect(
      translateSqlForPostgres("INSERT INTO user (id, email) VALUES (?, ?)")
    ).toBe('INSERT INTO "user" (id, email) VALUES ($1, $2)');
  });
});
