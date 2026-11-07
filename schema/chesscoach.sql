-- Chess Coach — model de date (MVP)
-- Scop: competențe verificabile, nu număr de exerciții.
-- Domeniu inițial: Tabla + Pion + fluxul Exercițiului 2.
-- Motor: PostgreSQL 16+

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumuri
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('child', 'teacher', 'admin');

CREATE TYPE belt_code AS ENUM (
  'tabla', 'pion', 'cal', 'nebun', 'turn', 'dama', 'rege'
);

-- Cele 4 trepte din documentul de proiect.
CREATE TYPE competency_stage AS ENUM (
  'recognize',  -- recunoaște
  'explain',    -- explică
  'perform',    -- realizează
  'transfer'    -- transferă (aceeași competență, poziție nouă)
);

-- Tipul de item decide CE se cere, nu doar pe ce treaptă e pus.
CREATE TYPE item_type AS ENUM (
  'identify',       -- câmp, culoare, piesă, motiv din listă
  'judge_legal',    -- mutarea e legală / ilegală
  'make_move',      -- una sau mai multe mutări
  'explain_text',   -- explicație în cuvinte
  'composite'       -- mutare + explicație + motiv (Exercițiul 2)
);

CREATE TYPE attempt_verdict AS ENUM (
  'pass',
  'partial',          -- ex. mutare corectă, motiv greșit
  'fail',
  'abandoned',
  'pending_review'    -- așteaptă profesorul la explicație
);

CREATE TYPE progress_status AS ENUM (
  'locked',
  'available',
  'in_progress',
  'remediation',
  'demonstrated'
);

CREATE TYPE level_exam_status AS ENUM (
  'not_attempted',
  'in_progress',
  'passed',
  'failed'
);

-- Cine decide „corect” la explicație. Mutarea și motivul sunt mereu deterministe.
CREATE TYPE explanation_eval_mode AS ENUM (
  'none',
  'keyword_rubric',   -- trece dacă acoperă conceptele cerute
  'teacher_review',   -- așteaptă profesorul; AI-ul poate propune
  'ai_advisory'       -- AI notează, dar NU închide competența singur
);

CREATE TYPE ai_event_kind AS ENUM (
  'hint',
  'socratic_question',
  'error_explanation',
  'difficulty_tag'
);

-- ---------------------------------------------------------------------------
-- Identitate (club intern; PII minim pentru copii)
-- ---------------------------------------------------------------------------

CREATE TABLE person (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role          user_role NOT NULL,
  display_name  text NOT NULL,
  login_name    text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Grupă / clasă: un profesor, mai mulți copii.
CREATE TABLE cohort (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  teacher_id  uuid NOT NULL REFERENCES person (id)
);

CREATE TABLE cohort_member (
  cohort_id  uuid NOT NULL REFERENCES cohort (id) ON DELETE CASCADE,
  child_id   uuid NOT NULL REFERENCES person (id) ON DELETE CASCADE,
  PRIMARY KEY (cohort_id, child_id)
);

-- ---------------------------------------------------------------------------
-- Curriculum
-- ---------------------------------------------------------------------------

CREATE TABLE belt_level (
  code         belt_code PRIMARY KEY,
  sort_order   smallint NOT NULL UNIQUE,
  title        text NOT NULL,
  is_defined   boolean NOT NULL DEFAULT false,
  -- Trecerea centurii cere examen, nu doar competențe demonstrate.
  exam_required boolean NOT NULL DEFAULT true
);

CREATE TABLE competency (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,          -- ex. T.04, P.10
  belt_code    belt_code NOT NULL REFERENCES belt_level (code),
  title        text NOT NULL,
  description  text,
  sort_order   smallint NOT NULL,
  -- Dacă false, competența există în catalog dar nu e încă în parcurs.
  is_active    boolean NOT NULL DEFAULT true,
  UNIQUE (belt_code, sort_order)
);

-- Câte demonstrații minime pe treaptă închid competența.
-- Transferul e separat ca să nu poți trece doar cu același FEN recunoscut.
CREATE TABLE competency_stage_gate (
  competency_id     uuid NOT NULL REFERENCES competency (id) ON DELETE CASCADE,
  stage             competency_stage NOT NULL,
  min_passing_items integer NOT NULL DEFAULT 1 CHECK (min_passing_items >= 1),
  PRIMARY KEY (competency_id, stage)
);

-- Catalog global de motive tactice (lista din UI).
CREATE TABLE motif (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,   -- fork, pin, sacrifice, back_rank, ...
  title_ro    text NOT NULL,
  belt_intro  belt_code NOT NULL REFERENCES belt_level (code)
);

CREATE TABLE competency_motif (
  competency_id uuid NOT NULL REFERENCES competency (id) ON DELETE CASCADE,
  motif_id      uuid NOT NULL REFERENCES motif (id) ON DELETE CASCADE,
  PRIMARY KEY (competency_id, motif_id)
);

-- ---------------------------------------------------------------------------
-- Exerciții (itemi)
-- Profesorul creează; copilul nu editează.
-- ---------------------------------------------------------------------------

CREATE TABLE exercise (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,       -- EX-002
  ui_code         text,                       -- "N3" din fluxul documentat
  competency_id   uuid NOT NULL REFERENCES competency (id),
  stage           competency_stage NOT NULL,
  item_type       item_type NOT NULL,
  title           text NOT NULL,
  prompt_ro       text NOT NULL,
  fen             text,                       -- NULL doar dacă itemul e pur conceptual
  side_to_move    char(1) CHECK (side_to_move IN ('w', 'b')),
  -- 1 Începător … 5 Avansat. Separat de treapta competenței.
  difficulty      smallint NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  max_attempts    smallint NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 5),
  explanation_eval explanation_eval_mode NOT NULL DEFAULT 'none',
  is_published    boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES person (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exercise_competency_stage_idx
  ON exercise (competency_id, stage)
  WHERE is_published;

-- Cheie de corectare — sursa de adevăr, nu AI-ul.
CREATE TABLE exercise_key (
  exercise_id            uuid PRIMARY KEY REFERENCES exercise (id) ON DELETE CASCADE,
  -- Mutări acceptate, SAN sau UCI; pentru linii scurte, mai multe variante.
  accepted_moves         text[] NOT NULL DEFAULT '{}',
  -- Linia completă, în SAN, spațiată. Prima mutare este cea notată la copil.
  solution_line          text NOT NULL DEFAULT '',
  -- Dacă true, orice mutare legală care dă mat/câștigă material după motorul intern.
  accept_equivalent_line boolean NOT NULL DEFAULT false,
  accepted_motif_ids     uuid[] NOT NULL DEFAULT '{}',
  -- Concepte care trebuie acoperite în explicație (rubrică).
  required_concepts      text[] NOT NULL DEFAULT '{}',
  -- Răspuns așteptat pentru identify / judge_legal (ex. "dark", "illegal", "e4").
  expected_label         text
);

-- Indicii progresive: nu conțin mutarea-soluție.
CREATE TABLE exercise_hint (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id  uuid NOT NULL REFERENCES exercise (id) ON DELETE CASCADE,
  seq          smallint NOT NULL,             -- 1, 2, 3
  body_ro      text NOT NULL,
  UNIQUE (exercise_id, seq)
);

-- Greșeli tipice → indiciu, nu soluție.
CREATE TABLE exercise_typical_error (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id  uuid NOT NULL REFERENCES exercise (id) ON DELETE CASCADE,
  move_san     text,
  motif_id     uuid REFERENCES motif (id),
  hint_id      uuid REFERENCES exercise_hint (id),
  note_ro      text
);

-- ---------------------------------------------------------------------------
-- Runtime copil
-- ---------------------------------------------------------------------------

-- O ședință pe un exercițiu: până la max_attempts încercări.
CREATE TABLE attempt_session (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES person (id),
  exercise_id   uuid NOT NULL REFERENCES exercise (id),
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  try_count     smallint NOT NULL DEFAULT 0,
  verdict       attempt_verdict,
  used_for_gate boolean NOT NULL DEFAULT true  -- false = antrenament liber, nu închide competența
);

CREATE INDEX attempt_session_child_ex_idx
  ON attempt_session (child_id, exercise_id, started_at DESC);

-- O singură sesiune deschisă per copil + exercițiu.
CREATE UNIQUE INDEX attempt_session_one_open_idx
  ON attempt_session (child_id, exercise_id)
  WHERE ended_at IS NULL;

CREATE TABLE attempt (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES attempt_session (id) ON DELETE CASCADE,
  try_no        smallint NOT NULL CHECK (try_no BETWEEN 1 AND 5),
  move_san      text,
  explanation   text,
  motif_id      uuid REFERENCES motif (id),
  identify_label text,
  move_ok       boolean,
  motif_ok      boolean,
  explain_ok    boolean,
  identify_ok   boolean,
  verdict       attempt_verdict NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, try_no)
);

-- AI-ul e tutore: logăm ce a spus, nu folosim asta ca notă oficială.
CREATE TABLE attempt_ai_event (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id  uuid NOT NULL REFERENCES attempt (id) ON DELETE CASCADE,
  kind        ai_event_kind NOT NULL,
  payload_ro  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Un exercițiu contribuie cel mult o dată la porțile unei competențe.
CREATE TABLE exercise_credit (
  child_id     uuid NOT NULL REFERENCES person (id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES exercise (id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES attempt_session (id),
  credited_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, exercise_id)
);

-- ---------------------------------------------------------------------------
-- Progres (derivat, dar stocat ca să nu recalculăm totul)
-- Actualizat după fiecare attempt_session încheiată.
-- ---------------------------------------------------------------------------

CREATE TABLE competency_progress (
  child_id        uuid NOT NULL REFERENCES person (id) ON DELETE CASCADE,
  competency_id   uuid NOT NULL REFERENCES competency (id) ON DELETE CASCADE,
  status          progress_status NOT NULL DEFAULT 'locked',
  recognize_pass  integer NOT NULL DEFAULT 0,
  explain_pass    integer NOT NULL DEFAULT 0,
  perform_pass    integer NOT NULL DEFAULT 0,
  transfer_pass   integer NOT NULL DEFAULT 0,
  fail_streak     integer NOT NULL DEFAULT 0,
  demonstrated_at timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, competency_id)
);

CREATE TABLE belt_progress (
  child_id     uuid NOT NULL REFERENCES person (id) ON DELETE CASCADE,
  belt_code    belt_code NOT NULL REFERENCES belt_level (code),
  exam_status  level_exam_status NOT NULL DEFAULT 'not_attempted',
  unlocked_at  timestamptz,
  passed_at    timestamptz,
  PRIMARY KEY (child_id, belt_code)
);

-- Remediere: se deschide când fail_streak >= 2 pe aceeași competență
-- (sesiuni eșuate, nu încercări în aceeași sesiune).
CREATE TABLE remediation (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        uuid NOT NULL REFERENCES person (id),
  competency_id   uuid NOT NULL REFERENCES competency (id),
  opened_at       timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz,
  reason          text NOT NULL,
  -- Itemi forțați: de obicei treapta recognize/explain înainte de perform.
  assigned_exercise_ids uuid[] NOT NULL DEFAULT '{}'
);

-- Examen de centură: set înghețat de itemi, separat de antrenament.
CREATE TABLE belt_exam (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belt_code   belt_code NOT NULL REFERENCES belt_level (code),
  title       text NOT NULL,
  exercise_ids uuid[] NOT NULL,
  pass_count  smallint NOT NULL,              -- câte itemi trebuie treceți
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE belt_exam_session (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     uuid NOT NULL REFERENCES belt_exam (id),
  child_id    uuid NOT NULL REFERENCES person (id),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  passed      boolean
);

-- ---------------------------------------------------------------------------
-- Reguli de stare (contract pentru aplicație, nu totul e CHECK SQL)
-- ---------------------------------------------------------------------------
-- 1. Mutare / motiv / identify: verdict determinist din exercise_key.
-- 2. Explicație: keyword_rubric poate da explain_ok; ai_advisory NU închide
--    competența; teacher_review lasă explain_ok NULL până la profesor.
-- 3. Sesiune PASS dacă ultimul attempt e pass, sau dacă toate componentele
--    cerute sunt ok (composite).
-- 4. După 3 fail în sesiune: verdict=fail, fail_streak += 1.
-- 5. fail_streak >= 2 => status=remediation + rând în remediation.
-- 6. Competență demonstrated când TOATE stage gates sunt atinse
--    (inclusiv transfer, dacă e definit).
-- 7. Centura se deblochează când cea anterioară are exam_status=passed.
-- 8. TRAIN folosește used_for_gate=false SAU itemi extra; examenul de centură
--    nu reciclează ultimele itemuri de antrenament 1:1 (evită antrenarea testului).
-- 9. Indiciul AI nu poate include accepted_moves.
-- 10. Întrebarea de control la orice coloană nouă:
--     ce competență formează sau verifică?

-- ---------------------------------------------------------------------------
-- Seed: centuri
-- ---------------------------------------------------------------------------

INSERT INTO belt_level (code, sort_order, title, is_defined) VALUES
  ('tabla', 1, 'Tabla', true),
  ('pion',  2, 'Pion',  true),
  ('cal',   3, 'Cal',   true),
  ('nebun', 4, 'Nebun', true),
  ('turn',  5, 'Turn',  false),
  ('dama',  6, 'Damă',  false),
  ('rege',  7, 'Rege',  false);

-- ---------------------------------------------------------------------------
-- Seed: competențe Tabla + Pion (MVP curricular)
-- ---------------------------------------------------------------------------

INSERT INTO competency (code, belt_code, title, sort_order) VALUES
  ('T.01', 'tabla', 'Orientarea tablei și câmpurile', 1),
  ('T.02', 'tabla', 'Fișiere, ranguri, diagonale', 2),
  ('T.03', 'tabla', 'Notația și identificarea câmpurilor', 3),
  ('T.04', 'tabla', 'Culoarea unui câmp', 4),
  ('T.05', 'tabla', 'Poziția inițială', 5),
  ('T.06', 'tabla', 'Patul și reguli fundamentale', 6),
  ('P.01', 'pion',  'Mutările pieselor și regulile de bază', 1),
  ('P.02', 'pion',  'Valoarea relativă a pieselor', 2),
  ('P.03', 'pion',  'Șah, mat și apărarea împotriva șahului', 3),
  ('P.04', 'pion',  'Maturi simple (D, 2T, T, 2N)', 4),
  ('P.05', 'pion',  'Legalitatea mutării proprii și a adversarului', 5),
  ('P.06', 'pion',  'Principii de deschidere', 6),
  ('P.07', 'pion',  'Elemente de final', 7),
  ('P.08', 'pion',  'Repetarea poziției', 8),
  ('P.09', 'pion',  'Ceasul: bullet, blitz, clasic', 9),
  ('P.10', 'pion',  'Ordinea gândirii: mat → șah → captură → amenințare → plan', 10);

-- Implicit: fiecare competență MVP cere 1 item pe treaptă.
INSERT INTO competency_stage_gate (competency_id, stage, min_passing_items)
SELECT id, stage, 1
FROM competency
CROSS JOIN (VALUES
  ('recognize'::competency_stage),
  ('explain'::competency_stage),
  ('perform'::competency_stage),
  ('transfer'::competency_stage)
) AS s(stage)
WHERE belt_code IN ('tabla', 'pion');

-- Motive necesare pentru Exercițiul 2 și Cal.
INSERT INTO motif (code, title_ro, belt_intro) VALUES
  ('fork',            'Atac dublu / furculiță', 'cal'),
  ('discovered',      'Atac / șah prin descoperire', 'cal'),
  ('back_rank',       'Slăbiciunea ultimei linii', 'cal'),
  ('overload',        'Supraîncărcare', 'cal'),
  ('deflection',      'Deflecția apărătorului', 'cal'),
  ('double_check',    'Șah dublu', 'cal'),
  ('sacrifice',       'Sacrificiu', 'cal'),
  ('zwischenzug',     'Mutare intermediară', 'nebun'),
  ('counterattack',   'Contraatac', 'nebun'),
  ('trapped_piece',   'Piesă prinsă', 'nebun'),
  ('xray',            'Atac prin raze X', 'nebun'),
  ('pin',             'Legătură', 'cal'),
  ('remove_defender', 'Eliminarea apărătorului', 'cal');

-- ---------------------------------------------------------------------------
-- Seed: Exercițiul 2 (fluxul din document)
-- Competența-gazdă: sacrificiu la Cal, treapta perform (composite).
-- Poziția dată: 6b1/3k2p1/1p1b1p1p/1K3P1P/2B3P1/2P3B1/8/8 w - - 0 37
-- Mutarea-cheie: Be6+ (c4e6). Sacrificiu de nebun; Bxg8 rămâne egal.
-- ---------------------------------------------------------------------------

INSERT INTO competency (code, belt_code, title, sort_order, is_active)
VALUES ('C.SAC', 'cal', 'Sacrificiul tactic', 90, true);

INSERT INTO competency_stage_gate (competency_id, stage, min_passing_items)
SELECT id, stage, 1
FROM competency
CROSS JOIN (VALUES
  ('recognize'::competency_stage),
  ('explain'::competency_stage),
  ('perform'::competency_stage),
  ('transfer'::competency_stage)
) AS s(stage)
WHERE code = 'C.SAC';

INSERT INTO exercise (
  code, ui_code, competency_id, stage, item_type, title, prompt_ro,
  fen, side_to_move, max_attempts, explanation_eval, is_published
)
SELECT
  'EX-002',
  'N3',
  c.id,
  'perform',
  'composite',
  'Exercițiul 2 — sacrificiu',
  'Introdu mutarea, explică alegerea și selectează motivul tactic.',
  '6b1/3k2p1/1p1b1p1p/1K3P1P/2B3P1/2P3B1/8/8 w - - 0 37',
  'w',
  3,
  'keyword_rubric',
  true
FROM competency c
WHERE c.code = 'C.SAC';

INSERT INTO exercise_key (
  exercise_id, accepted_moves, solution_line, accepted_motif_ids, required_concepts
)
SELECT
  e.id,
  ARRAY['Be6+', 'Be6', 'c4e6'],
  'Be6+',
  ARRAY[m.id],
  ARRAY['sacrific', 'șah']
FROM exercise e
JOIN motif m ON m.code = 'sacrifice'
WHERE e.code = 'EX-002';

UPDATE exercise SET difficulty = 3 WHERE code = 'EX-002';

INSERT INTO exercise_hint (exercise_id, seq, body_ro)
SELECT e.id, h.seq, h.body
FROM exercise e
CROSS JOIN (VALUES
  (1, 'Ce mutare dă șah și oferă un nebun?'),
  (2, 'Dacă adversarul ia nebunul, ce recaptură dă șah imediat?'),
  (3, 'Urmărește pionul care reia pe câmpul șahului.')
) AS h(seq, body)
WHERE e.code = 'EX-002';
