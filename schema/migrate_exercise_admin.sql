-- Chess Coach — administrarea exercițiilor
-- Se încarcă DUPĂ chesscoach.sql și state_api.sql.
-- Adaugă nivelul 1–5, linia de soluție și funcțiile folosite de panoul profesorului.

ALTER TABLE exercise
  ADD COLUMN IF NOT EXISTS difficulty smallint NOT NULL DEFAULT 1
  CHECK (difficulty BETWEEN 1 AND 5);

ALTER TABLE exercise_key
  ADD COLUMN IF NOT EXISTS solution_line text NOT NULL DEFAULT '';

INSERT INTO motif (code, title_ro, belt_intro) VALUES
  ('pin',             'Legătură', 'cal'),
  ('remove_defender', 'Eliminarea apărătorului', 'cal')
ON CONFLICT (code) DO NOTHING;

UPDATE exercise SET difficulty = 3 WHERE code = 'EX-002' AND difficulty = 1;
UPDATE exercise_key
SET solution_line = 'Be6+'
WHERE solution_line = ''
  AND exercise_id = (SELECT id FROM exercise WHERE code = 'EX-002');

-- ---------------------------------------------------------------------------
-- Salvare: creează sau actualizează exercițiul, cheia și indiciile.
-- Indiciul nu poate conține mutarea-soluție.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cc_save_exercise(
  p_teacher uuid,
  p_id uuid,
  p_code text,
  p_title text,
  p_prompt text,
  p_fen text,
  p_competency_code text,
  p_difficulty smallint,
  p_accepted_moves text[],
  p_solution_line text,
  p_motif_code text,
  p_concepts text[],
  p_hints text[],
  p_published boolean
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  teacher_ok boolean;
  competency uuid;
  motif uuid;
  side char(1);
  new_id uuid;
  new_code text;
  hint text;
  move text;
  seq smallint;
BEGIN
  SELECT role IN ('teacher', 'admin') INTO teacher_ok
  FROM person WHERE id = p_teacher;
  IF NOT coalesce(teacher_ok, false) THEN
    RAISE EXCEPTION 'doar profesorul poate salva exerciții';
  END IF;

  IF coalesce(trim(p_title), '') = '' OR coalesce(trim(p_prompt), '') = '' THEN
    RAISE EXCEPTION 'titlul și enunțul sunt obligatorii';
  END IF;
  IF coalesce(trim(p_fen), '') = '' THEN
    RAISE EXCEPTION 'FEN-ul este obligatoriu';
  END IF;
  IF p_accepted_moves IS NULL OR cardinality(p_accepted_moves) = 0 THEN
    RAISE EXCEPTION 'linia de soluție este obligatorie';
  END IF;
  IF p_difficulty IS NULL OR p_difficulty < 1 OR p_difficulty > 5 THEN
    RAISE EXCEPTION 'nivelul trebuie să fie între 1 și 5';
  END IF;

  SELECT id INTO competency FROM competency WHERE code = p_competency_code;
  IF competency IS NULL THEN
    RAISE EXCEPTION 'competență inexistentă';
  END IF;
  SELECT id INTO motif FROM motif WHERE code = p_motif_code;
  IF motif IS NULL THEN
    RAISE EXCEPTION 'motiv inexistent';
  END IF;

  FOREACH hint IN ARRAY coalesce(p_hints, ARRAY[]::text[]) LOOP
    FOREACH move IN ARRAY p_accepted_moves LOOP
      IF cc_norm_move(move) <> '' AND cc_norm(hint) LIKE '%' || cc_norm_move(move) || '%' THEN
        RAISE EXCEPTION 'indiciul nu poate conține mutarea-soluție';
      END IF;
    END LOOP;
  END LOOP;

  side := CASE WHEN split_part(trim(p_fen), ' ', 2) = 'b' THEN 'b' ELSE 'w' END;

  IF p_id IS NULL THEN
    SELECT 'EX-' || lpad((coalesce(max(substring(code FROM 4)::int), 0) + 1)::text, 3, '0')
      INTO new_code
    FROM exercise
    WHERE code ~ '^EX-[0-9]+$';
    new_code := coalesce(nullif(trim(p_code), ''), new_code, 'EX-001');

    INSERT INTO exercise (
      code, ui_code, competency_id, stage, item_type, title, prompt_ro,
      fen, side_to_move, difficulty, max_attempts, explanation_eval,
      is_published, created_by
    )
    VALUES (
      new_code,
      'N' || p_difficulty::text,
      competency,
      'perform',
      'composite',
      trim(p_title),
      trim(p_prompt),
      trim(p_fen),
      side,
      p_difficulty,
      3,
      'keyword_rubric',
      coalesce(p_published, false),
      p_teacher
    )
    RETURNING id INTO new_id;
  ELSE
    new_id := p_id;
    UPDATE exercise
    SET competency_id = competency,
        ui_code = 'N' || p_difficulty::text,
        title = trim(p_title),
        prompt_ro = trim(p_prompt),
        fen = trim(p_fen),
        side_to_move = side,
        difficulty = p_difficulty,
        is_published = coalesce(p_published, false),
        updated_at = now()
    WHERE id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'exercițiu inexistent';
    END IF;
  END IF;

  INSERT INTO exercise_key (
    exercise_id, accepted_moves, solution_line, accepted_motif_ids, required_concepts
  )
  VALUES (
    new_id,
    p_accepted_moves,
    coalesce(p_solution_line, p_accepted_moves[1]),
    ARRAY[motif],
    coalesce(p_concepts, ARRAY[]::text[])
  )
  ON CONFLICT (exercise_id) DO UPDATE
  SET accepted_moves = EXCLUDED.accepted_moves,
      solution_line = EXCLUDED.solution_line,
      accepted_motif_ids = EXCLUDED.accepted_motif_ids,
      required_concepts = EXCLUDED.required_concepts;

  DELETE FROM exercise_hint WHERE exercise_id = new_id;
  seq := 0;
  FOREACH hint IN ARRAY coalesce(p_hints, ARRAY[]::text[]) LOOP
    IF coalesce(trim(hint), '') = '' THEN
      CONTINUE;
    END IF;
    seq := seq + 1;
    EXIT WHEN seq > 3;
    INSERT INTO exercise_hint (exercise_id, seq, body_ro)
    VALUES (new_id, seq, trim(hint));
  END LOOP;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION cc_delete_exercise(p_teacher uuid, p_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM person WHERE id = p_teacher AND role IN ('teacher', 'admin')
  ) THEN
    RAISE EXCEPTION 'doar profesorul poate șterge exerciții';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM exercise WHERE id = p_id) THEN
    RAISE EXCEPTION 'exercițiu inexistent';
  END IF;

  DELETE FROM exercise_credit WHERE exercise_id = p_id;
  DELETE FROM attempt_session WHERE exercise_id = p_id;
  DELETE FROM exercise WHERE id = p_id;
END;
$$;

-- Copilul poate scrie „sah” în loc de „șah”.
CREATE OR REPLACE FUNCTION cc_fold(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(cc_norm(p_text), 'ăâîșşțţ', 'aaisstt');
$$;

CREATE OR REPLACE FUNCTION cc_concepts_covered(p_explanation text, p_concepts text[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  c text;
BEGIN
  IF p_concepts IS NULL OR cardinality(p_concepts) = 0 THEN
    RETURN true;
  END IF;
  IF coalesce(trim(p_explanation), '') = '' THEN
    RETURN false;
  END IF;
  FOREACH c IN ARRAY p_concepts LOOP
    IF cc_fold(p_explanation) NOT LIKE '%' || cc_fold(c) || '%' THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;
