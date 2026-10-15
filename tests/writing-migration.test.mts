import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const migrationPath = path.resolve(
  "supabase/migrations/20260805090637_writing_studio_operations.sql",
);

test("migration do Estúdio mantém RLS e identidade do chamador", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /writing_chapters_user_id_idx[\s\S]*\(user_id\)/i);
  assert.equal((sql.match(/security invoker/gi) ?? []).length, 4);
  assert.equal((sql.match(/set search_path = ''/gi) ?? []).length, 3);
  assert.equal((sql.match(/v_user_id uuid := auth\.uid\(\)/gi) ?? []).length, 3);
  assert.doesNotMatch(sql, /security definer/i);
  assert.match(sql, /c\.user_id = v_user_id/);
  assert.match(sql, /from public\.profiles[\s\S]*p\.id = v_user_id/i);
  assert.match(sql, /get diagnostics v_updated = row_count/i);
  assert.match(sql, /revoke all on function public\.move_writing_chapter[\s\S]*from public, anon/i);
  assert.match(sql, /grant execute on function public\.move_writing_chapter[\s\S]*to authenticated/i);
});
