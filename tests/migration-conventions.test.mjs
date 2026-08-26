import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const migrationDirectory = new URL('../supabase/migrations/', import.meta.url)
const migrationFiles = readdirSync(migrationDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()

const appliedMigrationChecksums = {
  '20260817154354_archflow_workspace.sql': 'a7e71f8c2bf02e38f23845dcdc834419d2f378b0f303ad7d4715845cf5142656',
  '20260817160016_lock_profile_trigger.sql': '60de1c99a2a0b5f504693e7045404398316ac8d4290fac8c5c389dd86bb4b72e',
  '20260817160935_persist_asset_results.sql': 'd184156f71afb826920035e16e254451579c01dd8822de2417d05232c9f13348',
  '20260819084426_expand_user_assets_for_4k.sql': '2f4c323ed1afa3460d6ea51163eaea8e8193aadf3deb3abe6a12eb38ff11eb16',
  '20260820125953_image_generation_tasks.sql': '94629f4b50d5c753db76beeaee6d933714e0c99b6b9ce8de2121859e45af8036',
}

test('migration filenames use unique Supabase timestamps', () => {
  assert.ok(migrationFiles.length > 0, 'at least one migration is required')

  for (const file of migrationFiles) {
    assert.match(
      file,
      /^\d{14}_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/,
      `${file} must use <YYYYMMDDHHMMSS>_<snake_case_name>.sql`,
    )
  }

  const versions = migrationFiles.map((file) => file.slice(0, 14))
  assert.equal(new Set(versions).size, versions.length, 'migration versions must be unique')
})

test('already-applied migrations remain immutable', () => {
  for (const [file, expectedChecksum] of Object.entries(appliedMigrationChecksums)) {
    assert.ok(migrationFiles.includes(file), `${file} must not be renamed or deleted`)

    const sql = readFileSync(new URL(file, migrationDirectory), 'utf8')
      .replaceAll('\r\n', '\n')
      .trim()
    const checksum = createHash('sha256').update(sql).digest('hex')

    assert.equal(checksum, expectedChecksum, `${file} has already been applied and must not be edited`)
  }
})
