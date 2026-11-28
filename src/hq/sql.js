export const HQ_SCHEMA = `CREATE TABLE IF NOT EXISTS hq_command (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  owner_slug TEXT NOT NULL,
  division TEXT NOT NULL,
  created_at TEXT NOT NULL,
  body TEXT NOT NULL
)`;

export const HQ_INDEX = "CREATE INDEX IF NOT EXISTS hq_command_lookup ON hq_command (status, owner_slug, division, created_at)";

export const HQ_SELECT = `SELECT body FROM hq_command
  WHERE (? = '' OR status = ?)
    AND (? = '' OR owner_slug = ?)
    AND (? = '' OR division = ?)
  ORDER BY created_at DESC
  LIMIT 200`;

export const HQ_INSERT = "INSERT INTO hq_command (id, status, owner_slug, division, created_at, body) VALUES (?, ?, ?, ?, ?, ?)";

export const HQ_UPDATE = "UPDATE hq_command SET status = ?, owner_slug = ?, division = ?, body = ? WHERE id = ?";

export const HQ_MISSION_SCHEMA = `CREATE TABLE IF NOT EXISTS hq_mission (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  owner_slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  body TEXT NOT NULL
)`;

export const HQ_MISSION_INDEX = "CREATE INDEX IF NOT EXISTS hq_mission_lookup ON hq_mission (status, owner_slug, created_at)";

export const HQ_MISSION_SELECT = "SELECT body FROM hq_mission ORDER BY created_at DESC LIMIT 100";

export const HQ_MISSION_INSERT = "INSERT INTO hq_mission (id, status, owner_slug, created_at, body) VALUES (?, ?, ?, ?, ?)";

export const HQ_MISSION_UPDATE = "UPDATE hq_mission SET status = ?, owner_slug = ?, body = ? WHERE id = ?";

export function hqSelectBindings(filter = {}) {
  const status = String(filter.status || "");
  const ownerSlug = String(filter.ownerSlug || "");
  const division = String(filter.division || "");
  return [status, status, ownerSlug, ownerSlug, division, division];
}

// Lot 2 : journal d'audit en ajout seul. Nouvelle table (aucune table existante modifiée) ;
// les déclencheurs refusent toute modification ou suppression, y compris depuis le code.
export const HQ_AUDIT_SCHEMA = `CREATE TABLE IF NOT EXISTS hq_audit (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  body TEXT NOT NULL
)`;
export const HQ_AUDIT_GUARDS = [
  "CREATE TRIGGER IF NOT EXISTS hq_audit_no_update BEFORE UPDATE ON hq_audit BEGIN SELECT RAISE(ABORT, 'journal d''audit en ajout seul'); END",
  "CREATE TRIGGER IF NOT EXISTS hq_audit_no_delete BEFORE DELETE ON hq_audit BEGIN SELECT RAISE(ABORT, 'journal d''audit en ajout seul'); END",
];
export const HQ_AUDIT_INSERT = "INSERT INTO hq_audit (at, body) VALUES (?, ?)";
export const HQ_AUDIT_SELECT = "SELECT seq, body FROM hq_audit ORDER BY seq DESC LIMIT ?";
