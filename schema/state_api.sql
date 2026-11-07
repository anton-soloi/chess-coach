-- Chess Coach — API de stare
-- Se încarcă DUPĂ chesscoach.sql.
-- Sursa de adevăr pentru notare, porți, remediere și centuri.
-- Stratul HTTP doar apelează aceste funcții; nu recalculează progresul.

-- API public:
--   cc_enroll_child(child_id)
--   cc_start_session(child_id, exercise_id, used_for_gate)
--   cc_submit_attempt(session_id, move_san, explanation, motif_id, identify_label, engine_ok)
--   cc_abandon_session(session_id)
--   cc_review_explanation(attempt_id, teacher_id, explain_ok)
--   cc_record_ai_event(attempt_id, kind, payload_ro)
--   cc_start_belt_exam(child_id, exam_id)
--   cc_complete_belt_exam(exam_session_id, passed)
--   cc_get_child_state(child_id)

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cc_norm(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')));
$$;

CREATE OR REPLACE FUNCTION cc_norm_move(p_move text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(cc_norm(p_move), '[+#]+$', '');
$$;

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

CREATE OR REPLACE FUNCTION cc_belt_unlocked(p_child uuid, p_belt belt_code)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT unlocked_at IS NOT NULL
  FROM belt_progress
  WHERE child_id = p_child AND belt_code = p_belt;
$$;

-- ---------------------------------------------------------------------------
-- Înscriere + reîmprospătare status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cc_refresh_competency_status(p_child uuid, p_competency uuid)
RETURNS competency_progress
LANGUAGE plpgsql
AS $$
DECLARE
  r competency_progress;
  c competency;
  belt_open boolean;
  gates_met boolean;
  open_rem boolean;
BEGIN
  SELECT * INTO c FROM competency WHERE id = p_competency;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'competență inexistentă';
  END IF;

  INSERT INTO competency_progress (child_id, competency_id, status)
  VALUES (p_child, p_competency, 'locked')
  ON CONFLICT (child_id, competency_id) DO NOTHING;

  SELECT * INTO r
  FROM competency_progress
  WHERE child_id = p_child AND competency_id = p_competency
  FOR UPDATE;

  belt_open := coalesce(cc_belt_unlocked(p_child, c.belt_code), false);

  SELECT NOT EXISTS (
    SELECT 1
    FROM competency_stage_gate g
    WHERE g.competency_id = p_competency
      AND (
        CASE g.stage
          WHEN 'recognize' THEN r.recognize_pass
          WHEN 'explain'    THEN r.explain_pass
          WHEN 'perform'    THEN r.perform_pass
          WHEN 'transfer'   THEN r.transfer_pass
        END
      ) < g.min_passing_items
  ) INTO gates_met;

  SELECT EXISTS (
    SELECT 1 FROM remediation
    WHERE child_id = p_child
      AND competency_id = p_competency
      AND closed_at IS NULL
  ) INTO open_rem;

  IF NOT belt_open OR NOT c.is_active THEN
    r.status := 'locked';
  ELSIF gates_met THEN
    r.status := 'demonstrated';
    r.demonstrated_at := coalesce(r.demonstrated_at, now());
  ELSIF open_rem THEN
    r.status := 'remediation';
  ELSIF r.recognize_pass + r.explain_pass + r.perform_pass + r.transfer_pass > 0
        OR r.fail_streak > 0 THEN
    r.status := 'in_progress';
  ELSE
    r.status := 'available';
  END IF;

  r.updated_at := now();
  UPDATE competency_progress
  SET status = r.status,
      demonstrated_at = r.demonstrated_at,
      updated_at = r.updated_at
  WHERE child_id = p_child AND competency_id = p_competency;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION cc_enroll_child(p_child uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  b belt_level;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM person WHERE id = p_child AND role = 'child') THEN
    RAISE EXCEPTION 'persoana nu este copil';
  END IF;

  FOR b IN SELECT * FROM belt_level ORDER BY sort_order LOOP
    INSERT INTO belt_progress (child_id, belt_code, exam_status, unlocked_at)
    VALUES (
      p_child,
      b.code,
      'not_attempted',
      CASE WHEN b.code = 'tabla' THEN now() ELSE NULL END
    )
    ON CONFLICT (child_id, belt_code) DO NOTHING;
  END LOOP;

  INSERT INTO competency_progress (child_id, competency_id, status)
  SELECT p_child, c.id, 'locked'
  FROM competency c
  ON CONFLICT DO NOTHING;

  PERFORM cc_refresh_competency_status(p_child, c.id)
  FROM competency c;
END;
$$;

CREATE OR REPLACE FUNCTION cc_on_person_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'child' THEN
    PERFORM cc_enroll_child(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cc_enroll_child ON person;
CREATE TRIGGER trg_cc_enroll_child
AFTER INSERT ON person
FOR EACH ROW
EXECUTE FUNCTION cc_on_person_insert();

CREATE OR REPLACE FUNCTION cc_unlock_next_belt(p_child uuid, p_passed belt_code)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  next_code belt_code;
BEGIN
  SELECT n.code INTO next_code
  FROM belt_level cur
  JOIN belt_level n ON n.sort_order = cur.sort_order + 1
  WHERE cur.code = p_passed;

  IF next_code IS NULL THEN
    RETURN;
  END IF;

  UPDATE belt_progress
  SET unlocked_at = coalesce(unlocked_at, now())
  WHERE child_id = p_child AND belt_code = next_code;

  PERFORM cc_refresh_competency_status(p_child, c.id)
  FROM competency c
  WHERE c.belt_code = next_code;
END;
$$;

CREATE OR REPLACE FUNCTION cc_pick_remediation_items(p_competency uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(array_agg(id), '{}')
  FROM (
    SELECT id
    FROM exercise
    WHERE competency_id = p_competency
      AND is_published
      AND stage IN ('recognize', 'explain')
    ORDER BY stage, code
    LIMIT 3
  ) s;
$$;

CREATE OR REPLACE FUNCTION cc_open_remediation(p_child uuid, p_competency uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM remediation
    WHERE child_id = p_child AND competency_id = p_competency AND closed_at IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO remediation (child_id, competency_id, reason, assigned_exercise_ids)
  VALUES (p_child, p_competency, p_reason, cc_pick_remediation_items(p_competency));
END;
$$;

CREATE OR REPLACE FUNCTION cc_close_remediation(p_child uuid, p_competency uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE remediation
  SET closed_at = now()
  WHERE child_id = p_child
    AND competency_id = p_competency
    AND closed_at IS NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Notare (fără a expune cheia)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cc_grade_attempt(
  p_exercise uuid,
  p_move text,
  p_explanation text,
  p_motif uuid,
  p_label text,
  p_engine_ok boolean
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  e exercise;
  k exercise_key;
  move_ok boolean := false;
  motif_ok boolean := false;
  explain_ok boolean;
  identify_ok boolean := false;
  required_ok boolean;
  verdict attempt_verdict;
  needs_move boolean;
  needs_motif boolean;
  needs_explain boolean;
  needs_label boolean;
BEGIN
  SELECT * INTO e FROM exercise WHERE id = p_exercise;
  SELECT * INTO k FROM exercise_key WHERE exercise_id = p_exercise;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'exercițiul nu are cheie de corectare';
  END IF;

  needs_move := e.item_type IN ('make_move', 'composite');
  needs_motif := e.item_type = 'composite';
  needs_label := e.item_type IN ('identify', 'judge_legal');
  needs_explain := e.item_type IN ('explain_text', 'composite')
                   AND e.explanation_eval IN ('keyword_rubric', 'teacher_review');

  IF needs_move THEN
    IF p_move IS NOT NULL AND EXISTS (
      SELECT 1 FROM unnest(k.accepted_moves) m
      WHERE cc_norm_move(m) = cc_norm_move(p_move)
    ) THEN
      move_ok := true;
    ELSIF k.accept_equivalent_line AND coalesce(p_engine_ok, false) THEN
      move_ok := true;
    END IF;
  END IF;

  IF needs_motif THEN
    motif_ok := p_motif IS NOT NULL AND p_motif = ANY (k.accepted_motif_ids);
  END IF;

  IF needs_label THEN
    identify_ok := cc_norm(p_label) = cc_norm(k.expected_label);
  END IF;

  IF e.item_type IN ('explain_text', 'composite') THEN
    IF e.explanation_eval = 'none' THEN
      explain_ok := NULL;
      needs_explain := false;
    ELSIF e.explanation_eval = 'ai_advisory' THEN
      explain_ok := cc_concepts_covered(p_explanation, k.required_concepts);
      needs_explain := false; -- nu închide competența / sesiunea
    ELSIF e.explanation_eval = 'keyword_rubric' THEN
      explain_ok := cc_concepts_covered(p_explanation, k.required_concepts);
    ELSIF e.explanation_eval = 'teacher_review' THEN
      explain_ok := NULL;
    END IF;
  END IF;

  required_ok :=
    (NOT needs_move OR move_ok)
    AND (NOT needs_motif OR motif_ok)
    AND (NOT needs_label OR identify_ok)
    AND (NOT needs_explain OR coalesce(explain_ok, false)
         OR e.explanation_eval = 'teacher_review');

  IF e.explanation_eval = 'teacher_review'
     AND needs_explain
     AND (NOT needs_move OR move_ok)
     AND (NOT needs_motif OR motif_ok)
     AND (NOT needs_label OR identify_ok) THEN
    verdict := 'pending_review';
  ELSIF required_ok AND (NOT needs_explain OR explain_ok) THEN
    verdict := 'pass';
  ELSIF (needs_move AND move_ok)
     OR (needs_motif AND motif_ok)
     OR (needs_label AND identify_ok)
     OR coalesce(explain_ok, false) THEN
    verdict := 'partial';
  ELSE
    verdict := 'fail';
  END IF;

  RETURN jsonb_build_object(
    'move_ok', move_ok,
    'motif_ok', motif_ok,
    'explain_ok', explain_ok,
    'identify_ok', identify_ok,
    'verdict', verdict
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Aplicarea unei sesiuni încheiate asupra progresului
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cc_apply_session_progress(p_session uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  s attempt_session;
  e exercise;
  p competency_progress;
  credited boolean := false;
  stage_col text;
BEGIN
  SELECT * INTO s FROM attempt_session WHERE id = p_session;
  SELECT * INTO e FROM exercise WHERE id = s.exercise_id;

  p := cc_refresh_competency_status(s.child_id, e.competency_id);

  IF NOT s.used_for_gate OR p.status = 'locked' THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', CASE WHEN NOT s.used_for_gate THEN 'practice' ELSE 'locked' END,
      'progress', to_jsonb(p)
    );
  END IF;

  -- Demonstrat rămâne demonstrat; nu redeschidem remediere.
  IF p.status = 'demonstrated' THEN
    IF s.verdict = 'pass' THEN
      PERFORM cc_close_remediation(s.child_id, e.competency_id);
    END IF;
    p := cc_refresh_competency_status(s.child_id, e.competency_id);
    RETURN jsonb_build_object('applied', false, 'reason', 'already_demonstrated', 'progress', to_jsonb(p));
  END IF;

  IF s.verdict = 'pending_review' OR s.verdict = 'abandoned' THEN
    RETURN jsonb_build_object('applied', false, 'reason', s.verdict, 'progress', to_jsonb(p));
  END IF;

  IF s.verdict = 'pass' THEN
    INSERT INTO exercise_credit (child_id, exercise_id, session_id)
    VALUES (s.child_id, s.exercise_id, s.id)
    ON CONFLICT (child_id, exercise_id) DO NOTHING;

    SELECT EXISTS (
      SELECT 1 FROM exercise_credit
      WHERE child_id = s.child_id AND exercise_id = s.exercise_id AND session_id = s.id
    ) INTO credited;

    IF credited THEN
      stage_col := e.stage::text;
      EXECUTE format(
        'UPDATE competency_progress
         SET %I = %I + 1,
             fail_streak = 0,
             updated_at = now()
         WHERE child_id = $1 AND competency_id = $2',
        stage_col || '_pass', stage_col || '_pass'
      ) USING s.child_id, e.competency_id;
    ELSE
      UPDATE competency_progress
      SET fail_streak = 0, updated_at = now()
      WHERE child_id = s.child_id AND competency_id = e.competency_id;
    END IF;

    PERFORM cc_close_remediation(s.child_id, e.competency_id);

  ELSIF s.verdict IN ('fail', 'partial') THEN
    -- Sesiune epuizată fără pass: contează ca eșec de poartă.
    UPDATE competency_progress
    SET fail_streak = fail_streak + 1, updated_at = now()
    WHERE child_id = s.child_id AND competency_id = e.competency_id
    RETURNING fail_streak INTO p.fail_streak;

    IF p.fail_streak >= 2 THEN
      PERFORM cc_open_remediation(
        s.child_id,
        e.competency_id,
        'fail_streak=' || p.fail_streak::text
      );
    END IF;
  END IF;

  p := cc_refresh_competency_status(s.child_id, e.competency_id);

  RETURN jsonb_build_object(
    'applied', true,
    'credited', credited,
    'progress', to_jsonb(p)
  );
END;
$$;

CREATE OR REPLACE FUNCTION cc_close_session(p_session uuid, p_verdict attempt_verdict)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  s attempt_session;
  applied jsonb;
BEGIN
  UPDATE attempt_session
  SET ended_at = now(),
      verdict = p_verdict
  WHERE id = p_session
    AND ended_at IS NULL
  RETURNING * INTO s;

  IF NOT FOUND THEN
    SELECT * INTO s FROM attempt_session WHERE id = p_session;
    RETURN jsonb_build_object('session', to_jsonb(s), 'already_closed', true);
  END IF;

  applied := cc_apply_session_progress(p_session);
  SELECT * INTO s FROM attempt_session WHERE id = p_session;

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id,
      'verdict', s.verdict,
      'try_count', s.try_count,
      'ended_at', s.ended_at
    ),
    'progress_delta', applied
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Sesiuni / încercări
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cc_start_session(
  p_child uuid,
  p_exercise uuid,
  p_used_for_gate boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  e exercise;
  p competency_progress;
  sid uuid;
BEGIN
  SELECT * INTO e FROM exercise WHERE id = p_exercise;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'exercițiu inexistent';
  END IF;
  IF NOT e.is_published THEN
    RAISE EXCEPTION 'exercițiul nu este publicat';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM person WHERE id = p_child AND role = 'child') THEN
    RAISE EXCEPTION 'persoana nu este copil';
  END IF;

  p := cc_refresh_competency_status(p_child, e.competency_id);
  IF p.status = 'locked' AND p_used_for_gate THEN
    RAISE EXCEPTION 'competența este blocată';
  END IF;

  IF EXISTS (
    SELECT 1 FROM attempt_session
    WHERE child_id = p_child AND exercise_id = p_exercise AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'există deja o sesiune deschisă pentru acest exercițiu';
  END IF;

  INSERT INTO attempt_session (child_id, exercise_id, used_for_gate)
  VALUES (p_child, p_exercise, coalesce(p_used_for_gate, true))
  RETURNING id INTO sid;

  RETURN sid;
END;
$$;

CREATE OR REPLACE FUNCTION cc_submit_attempt(
  p_session uuid,
  p_move text DEFAULT NULL,
  p_explanation text DEFAULT NULL,
  p_motif uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_engine_ok boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  s attempt_session;
  e exercise;
  grade jsonb;
  attempt_id uuid;
  try_no smallint;
  v attempt_verdict;
  hint_body text;
  hint_seq smallint;
  closed jsonb := NULL;
  tries_left integer;
BEGIN
  SELECT * INTO s FROM attempt_session WHERE id = p_session FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sesiune inexistentă';
  END IF;
  IF s.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'sesiunea este închisă';
  END IF;

  SELECT * INTO e FROM exercise WHERE id = s.exercise_id;
  IF s.try_count >= e.max_attempts THEN
    RAISE EXCEPTION 'nu mai sunt încercări';
  END IF;

  grade := cc_grade_attempt(e.id, p_move, p_explanation, p_motif, p_label, p_engine_ok);
  v := (grade->>'verdict')::attempt_verdict;
  try_no := s.try_count + 1;

  INSERT INTO attempt (
    session_id, try_no, move_san, explanation, motif_id, identify_label,
    move_ok, motif_ok, explain_ok, identify_ok, verdict
  )
  VALUES (
    p_session, try_no, p_move, p_explanation, p_motif, p_label,
    (grade->>'move_ok')::boolean,
    (grade->>'motif_ok')::boolean,
    CASE WHEN grade->>'explain_ok' IS NULL OR grade->>'explain_ok' = 'null'
         THEN NULL ELSE (grade->>'explain_ok')::boolean END,
    (grade->>'identify_ok')::boolean,
    v
  )
  RETURNING id INTO attempt_id;

  UPDATE attempt_session SET try_count = try_no WHERE id = p_session;
  tries_left := e.max_attempts - try_no;

  IF v = 'pass' OR v = 'pending_review' OR tries_left <= 0 THEN
    closed := cc_close_session(
      p_session,
      CASE WHEN v = 'pass' THEN 'pass'
           WHEN v = 'pending_review' THEN 'pending_review'
           WHEN v IN ('partial', 'fail') THEN 'fail'
           ELSE v END
    );
  END IF;

  IF v IN ('fail', 'partial') AND tries_left > 0 THEN
    hint_seq := try_no;
    SELECT body_ro INTO hint_body
    FROM exercise_hint
    WHERE exercise_id = e.id AND seq = hint_seq;
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', attempt_id,
    'try_no', try_no,
    'verdict', v,
    'components', jsonb_build_object(
      'move_ok', grade->'move_ok',
      'motif_ok', grade->'motif_ok',
      'explain_ok', grade->'explain_ok',
      'identify_ok', grade->'identify_ok'
    ),
    'session', jsonb_build_object(
      'id', p_session,
      'closed', closed IS NOT NULL,
      'tries_left', GREATEST(tries_left, 0),
      'verdict', CASE WHEN closed IS NULL THEN NULL ELSE closed->'session'->>'verdict' END
    ),
    'hint', CASE WHEN hint_body IS NULL THEN NULL
                 ELSE jsonb_build_object('seq', hint_seq, 'body_ro', hint_body) END,
    'progress_delta', closed->'progress_delta'
  );
END;
$$;

CREATE OR REPLACE FUNCTION cc_abandon_session(p_session uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN cc_close_session(p_session, 'abandoned');
END;
$$;

CREATE OR REPLACE FUNCTION cc_review_explanation(
  p_attempt uuid,
  p_teacher uuid,
  p_explain_ok boolean
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  a attempt;
  s attempt_session;
  new_verdict attempt_verdict;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM person WHERE id = p_teacher AND role IN ('teacher', 'admin')) THEN
    RAISE EXCEPTION 'doar profesorul poate valida explicația';
  END IF;

  SELECT * INTO a FROM attempt WHERE id = p_attempt;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'încercare inexistentă';
  END IF;

  SELECT * INTO s FROM attempt_session WHERE id = a.session_id FOR UPDATE;
  IF s.verdict IS DISTINCT FROM 'pending_review' THEN
    RAISE EXCEPTION 'sesiunea nu așteaptă recenzie';
  END IF;

  new_verdict := CASE WHEN p_explain_ok THEN 'pass' ELSE 'fail' END;

  UPDATE attempt
  SET explain_ok = p_explain_ok,
      verdict = new_verdict
  WHERE id = p_attempt;

  -- Reaplicăm progresul: sesiunea era pending, deci nu a crescut porțile.
  UPDATE attempt_session
  SET verdict = new_verdict
  WHERE id = s.id;

  RETURN jsonb_build_object(
    'attempt_id', p_attempt,
    'verdict', new_verdict,
    'progress_delta', cc_apply_session_progress(s.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION cc_record_ai_event(
  p_attempt uuid,
  p_kind ai_event_kind,
  p_payload text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  eid uuid;
  moves text[];
  m text;
BEGIN
  SELECT k.accepted_moves INTO moves
  FROM attempt a
  JOIN attempt_session s ON s.id = a.session_id
  JOIN exercise_key k ON k.exercise_id = s.exercise_id
  WHERE a.id = p_attempt;

  FOREACH m IN ARRAY coalesce(moves, '{}') LOOP
    IF cc_norm_move(m) <> '' AND cc_norm(p_payload) LIKE '%' || cc_norm_move(m) || '%' THEN
      RAISE EXCEPTION 'indiciul nu poate conține mutarea-soluție';
    END IF;
  END LOOP;

  INSERT INTO attempt_ai_event (attempt_id, kind, payload_ro)
  VALUES (p_attempt, p_kind, p_payload)
  RETURNING id INTO eid;

  RETURN eid;
END;
$$;

-- ---------------------------------------------------------------------------
-- Examen de centură
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cc_start_belt_exam(p_child uuid, p_exam uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  ex belt_exam;
  undone integer;
  sid uuid;
BEGIN
  SELECT * INTO ex FROM belt_exam WHERE id = p_exam AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'examen inexistent sau inactiv';
  END IF;

  IF NOT cc_belt_unlocked(p_child, ex.belt_code) THEN
    RAISE EXCEPTION 'centura nu este deblocată';
  END IF;

  SELECT count(*) INTO undone
  FROM competency c
  LEFT JOIN competency_progress p
    ON p.competency_id = c.id AND p.child_id = p_child
  WHERE c.belt_code = ex.belt_code
    AND c.is_active
    AND coalesce(p.status, 'locked') IS DISTINCT FROM 'demonstrated';

  IF undone > 0 THEN
    RAISE EXCEPTION 'nu toate competențele centurii sunt demonstrate (% rămase)', undone;
  END IF;

  IF EXISTS (
    SELECT 1 FROM belt_exam_session
    WHERE exam_id = p_exam AND child_id = p_child AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'examen deja în curs';
  END IF;

  INSERT INTO belt_exam_session (exam_id, child_id)
  VALUES (p_exam, p_child)
  RETURNING id INTO sid;

  UPDATE belt_progress
  SET exam_status = 'in_progress'
  WHERE child_id = p_child AND belt_code = ex.belt_code;

  RETURN sid;
END;
$$;

CREATE OR REPLACE FUNCTION cc_complete_belt_exam(p_exam_session uuid, p_passed boolean)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  es belt_exam_session;
  ex belt_exam;
BEGIN
  SELECT * INTO es FROM belt_exam_session WHERE id = p_exam_session FOR UPDATE;
  IF es.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'examenul este deja închis';
  END IF;
  SELECT * INTO ex FROM belt_exam WHERE id = es.exam_id;

  UPDATE belt_exam_session
  SET ended_at = now(), passed = p_passed
  WHERE id = p_exam_session;

  UPDATE belt_progress
  SET exam_status = CASE WHEN p_passed THEN 'passed' ELSE 'failed' END,
      passed_at = CASE WHEN p_passed THEN now() ELSE passed_at END
  WHERE child_id = es.child_id AND belt_code = ex.belt_code;

  IF p_passed THEN
    PERFORM cc_unlock_next_belt(es.child_id, ex.belt_code);
  END IF;

  RETURN jsonb_build_object(
    'exam_session_id', p_exam_session,
    'belt', ex.belt_code,
    'passed', p_passed
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Snapshot pentru UI
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cc_get_child_state(p_child uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN jsonb_build_object(
    'child_id', p_child,
    'belts', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'code', b.code,
        'title', bl.title,
        'exam_status', b.exam_status,
        'unlocked', b.unlocked_at IS NOT NULL,
        'passed_at', b.passed_at
      ) ORDER BY bl.sort_order), '[]'::jsonb)
      FROM belt_progress b
      JOIN belt_level bl ON bl.code = b.belt_code
      WHERE b.child_id = p_child
    ),
    'competencies', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'code', c.code,
        'title', c.title,
        'belt', c.belt_code,
        'status', p.status,
        'recognize_pass', p.recognize_pass,
        'explain_pass', p.explain_pass,
        'perform_pass', p.perform_pass,
        'transfer_pass', p.transfer_pass,
        'fail_streak', p.fail_streak,
        'demonstrated_at', p.demonstrated_at
      ) ORDER BY c.belt_code, c.sort_order), '[]'::jsonb)
      FROM competency_progress p
      JOIN competency c ON c.id = p.competency_id
      WHERE p.child_id = p_child
    ),
    'open_sessions', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'exercise_id', s.exercise_id,
        'exercise_code', e.code,
        'try_count', s.try_count,
        'max_attempts', e.max_attempts
      )), '[]'::jsonb)
      FROM attempt_session s
      JOIN exercise e ON e.id = s.exercise_id
      WHERE s.child_id = p_child AND s.ended_at IS NULL
    ),
    'open_remediations', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id,
        'competency_id', r.competency_id,
        'reason', r.reason,
        'assigned_exercise_ids', to_jsonb(r.assigned_exercise_ids)
      )), '[]'::jsonb)
      FROM remediation r
      WHERE r.child_id = p_child AND r.closed_at IS NULL
    )
  );
END;
$$;
