-- =====================================================================
--  DATABASE SCHEMA — Demo Day Judging (Top 20 -> Top 5)
--  AI For All Hackathon 2026
--
--  Fresh install: run this whole file once in the Neon SQL Editor.
--  Tables use the "pjt_" prefix so they do not clash with other apps
--  that share the same Neon database.
--
--  Existing install (old HTML-file version): see MIGRATION at the bottom.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. PROJECTS
--    A project is a live web link (project_url). The admin sets the
--    presentation order (position 1..20).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pjt_works (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT UNIQUE NOT NULL,            -- e.g. "KARYA-01"
    team_name     TEXT NOT NULL,
    project_title TEXT NOT NULL,
    category      TEXT,
    project_url   TEXT,                            -- live web link of the prototype
    position      INTEGER,                         -- presentation order 1..20
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pjt_works_position ON pjt_works (position);

-- ---------------------------------------------------------------------
-- 2. JUDGES (created by the admin, bcrypt password hash)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pjt_judges (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 3. SCORES  (one judge x one project, upserted)
--    Demo Day criteria, each scored 1-100:
--      prototype    Working prototype        30%
--      problem      Problem & Impact         20%
--      solution     Solution Fit & Insight   20%
--      feasibility  Feasibility & Risk       15%
--      pitch        Pitch & Team             15%
--    weighted = (prototype*30 + problem*20 + solution*20 + feasibility*15 + pitch*15) / 100
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pjt_scores (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id        UUID NOT NULL REFERENCES pjt_works(id) ON DELETE CASCADE,
    judge_id       UUID NOT NULL REFERENCES pjt_judges(id) ON DELETE CASCADE,

    prototype      INTEGER NOT NULL,
    problem        INTEGER NOT NULL,
    solution       INTEGER NOT NULL,
    feasibility    INTEGER NOT NULL,
    pitch          INTEGER NOT NULL,

    comment        TEXT,
    weighted       NUMERIC(6,2) NOT NULL,
    total          INTEGER NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (work_id, judge_id)
);

CREATE INDEX IF NOT EXISTS idx_pjt_scores_work  ON pjt_scores (work_id);
CREATE INDEX IF NOT EXISTS idx_pjt_scores_judge ON pjt_scores (judge_id);

-- ---------------------------------------------------------------------
-- 4. ADMINS (optional, ENV credentials also work)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pjt_admins (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
--  MIGRATION from the old HTML-file version (clears all test data!)
--
--    DELETE FROM pjt_scores;
--    DELETE FROM pjt_works;
--    DELETE FROM pjt_judges;
--    ALTER TABLE pjt_works  ADD COLUMN IF NOT EXISTS project_url TEXT,
--                           ADD COLUMN IF NOT EXISTS position INTEGER,
--                           DROP COLUMN IF EXISTS html_content;
--    ALTER TABLE pjt_scores DROP COLUMN IF EXISTS evidence,
--                           DROP COLUMN IF EXISTS ux,
--                           ADD COLUMN IF NOT EXISTS prototype INTEGER NOT NULL DEFAULT 1,
--                           ADD COLUMN IF NOT EXISTS pitch INTEGER NOT NULL DEFAULT 1;
--    ALTER TABLE pjt_scores ALTER COLUMN prototype DROP DEFAULT,
--                           ALTER COLUMN pitch DROP DEFAULT;
-- =====================================================================
