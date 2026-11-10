-- =====================================================================
--  DATABASE SCHEMA — HTML Project Judging System
--  AI For All Hackathon 2026
--
--  Run this script ONCE in the Neon SQL Editor for a fresh database.
--  If you already created the old tables, see the MIGRATION section at
--  the bottom to upgrade to the new weighted parameters.
--
--  Tables are prefixed "pj_" so they do not clash with other apps that
--  share the same Neon database.
-- =====================================================================

-- Extension for UUIDs (unique identity per project)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. PROJECTS (works)
--    Each project has a unique "code" (short slug) + a UUID id so that
--    scores from all judges can be tied to a single project.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pjt_works (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT UNIQUE NOT NULL,            -- unique code, e.g. "KARYA-01"
    team_name     TEXT NOT NULL,                   -- team / participant name
    project_title TEXT NOT NULL,                   -- project title
    category      TEXT,                            -- category / theme (optional)
    html_content  TEXT NOT NULL,                   -- the project's HTML content
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pjt_works_created ON pjt_works (created_at DESC);

-- ---------------------------------------------------------------------
-- 2. JUDGES
--    Judge accounts are created by the admin. Passwords stored as bcrypt hash.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pjt_judges (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    username      TEXT UNIQUE NOT NULL,            -- used to log in
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 3. SCORES
--    One row = one judge scoring one project.
--    UNIQUE(work_id, judge_id) ensures a judge scores a project only once
--    (updatable via upsert, never duplicated).
--
--    5 weighted parameters, each on a 1-100 scale:
--      problem      Problem & Impact          weight 25%
--      solution     Solution Fit & Insight    weight 25%
--      evidence     Evidence & Consistency    weight 15%
--      feasibility  Feasibility & Risk Honesty weight 15%
--      ux           Visual & User Experience  weight 20%
--
--    weighted = (problem*25 + solution*25 + evidence*15 + feasibility*15 + ux*20) / 100
--             -> final score on a 0-100 scale, used for ranking.
--    total    = raw sum of the 5 parameters (kept for reference).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pjt_scores (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id        UUID NOT NULL REFERENCES pjt_works(id) ON DELETE CASCADE,
    judge_id       UUID NOT NULL REFERENCES pjt_judges(id) ON DELETE CASCADE,

    -- 5 weighted parameters (1-100)
    problem        INTEGER NOT NULL,   -- Problem & Impact (25%)
    solution       INTEGER NOT NULL,   -- Solution Fit & Insight (25%)
    evidence       INTEGER NOT NULL,   -- Evidence & Consistency (15%)
    feasibility    INTEGER NOT NULL,   -- Feasibility & Risk Honesty (15%)
    ux             INTEGER NOT NULL,   -- Visual & User Experience (20%)

    comment        TEXT,                        -- optional judge note
    weighted       NUMERIC(6,2) NOT NULL,       -- weighted final score (0-100)
    total          INTEGER NOT NULL,            -- raw sum of the 5 params
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (work_id, judge_id)
);

CREATE INDEX IF NOT EXISTS idx_pjt_scores_work  ON pjt_scores (work_id);
CREATE INDEX IF NOT EXISTS idx_pjt_scores_judge ON pjt_scores (judge_id);

-- ---------------------------------------------------------------------
-- 4. ADMINS (optional — you can also use ENV credentials)
--    Passwords stored as bcrypt hash.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pjt_admins (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
--  EXAMPLE RANKING QUERY (weighted average across all judges):
--
--    SELECT w.code, w.team_name, w.project_title,
--           COUNT(s.id)                 AS judge_count,
--           COALESCE(AVG(s.weighted),0) AS avg_weighted
--    FROM pjt_works w
--    LEFT JOIN pjt_scores s ON s.work_id = w.id
--    GROUP BY w.id
--    ORDER BY avg_weighted DESC;
-- =====================================================================


-- =====================================================================
--  MIGRATION (run ONLY if you already have the OLD pjt_scores table with
--  columns: innovation, functionality, design, impact, technical).
--
--  This drops the old score rows because the parameters changed meaning,
--  then adds the new columns. Judges simply re-score. If you prefer to
--  keep old data, map columns manually instead.
--
--    -- 1) Clear old scores (parameters changed, cannot be mapped 1:1)
--    DELETE FROM pjt_scores;
--
--    -- 2) Drop old parameter columns
--    ALTER TABLE pjt_scores
--      DROP COLUMN IF EXISTS innovation,
--      DROP COLUMN IF EXISTS functionality,
--      DROP COLUMN IF EXISTS design,
--      DROP COLUMN IF EXISTS impact,
--      DROP COLUMN IF EXISTS technical;
--
--    -- 3) Add new weighted parameter columns
--    ALTER TABLE pjt_scores
--      ADD COLUMN IF NOT EXISTS problem     INTEGER NOT NULL DEFAULT 1,
--      ADD COLUMN IF NOT EXISTS solution    INTEGER NOT NULL DEFAULT 1,
--      ADD COLUMN IF NOT EXISTS evidence    INTEGER NOT NULL DEFAULT 1,
--      ADD COLUMN IF NOT EXISTS feasibility INTEGER NOT NULL DEFAULT 1,
--      ADD COLUMN IF NOT EXISTS ux          INTEGER NOT NULL DEFAULT 1,
--      ADD COLUMN IF NOT EXISTS weighted    NUMERIC(6,2) NOT NULL DEFAULT 0;
--
--    -- 4) (Optional) remove the temporary defaults
--    ALTER TABLE pjt_scores
--      ALTER COLUMN problem     DROP DEFAULT,
--      ALTER COLUMN solution    DROP DEFAULT,
--      ALTER COLUMN evidence    DROP DEFAULT,
--      ALTER COLUMN feasibility DROP DEFAULT,
--      ALTER COLUMN ux          DROP DEFAULT,
--      ALTER COLUMN weighted    DROP DEFAULT;
-- =====================================================================
