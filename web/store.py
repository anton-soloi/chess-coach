"""Baza locală a exercițiilor.

Aceeași structură ca în schema PostgreSQL (exercise, exercise_key,
exercise_hint, attempt_session, attempt): FEN, competență, nivel 1–5,
linie de soluție, motiv, indicii și cel mult 3 încercări.
Fișierul stă în data/, nu în folderul servit de site.
"""

import re
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / 'data' / 'chesscoach.sqlite'

LEVELS = {
    1: 'Începător',
    2: 'Începător+',
    3: 'Intermediar',
    4: 'Avansat',
    5: 'Avansat+',
}

COMPETENCIES = [
    ('T.01', 'tabla', 'Orientarea tablei și câmpurile'),
    ('T.02', 'tabla', 'Fișiere, ranguri, diagonale'),
    ('T.03', 'tabla', 'Notația și identificarea câmpurilor'),
    ('T.04', 'tabla', 'Culoarea unui câmp'),
    ('T.05', 'tabla', 'Poziția inițială'),
    ('T.06', 'tabla', 'Patul și reguli fundamentale'),
    ('P.01', 'pion', 'Mutările pieselor și regulile de bază'),
    ('P.02', 'pion', 'Valoarea relativă a pieselor'),
    ('P.03', 'pion', 'Șah, mat și apărarea împotriva șahului'),
    ('P.04', 'pion', 'Maturi simple'),
    ('P.05', 'pion', 'Legalitatea mutării'),
    ('P.06', 'pion', 'Principii de deschidere'),
    ('P.07', 'pion', 'Elemente de final'),
    ('P.08', 'pion', 'Repetarea poziției'),
    ('P.09', 'pion', 'Ceasul: bullet, blitz, clasic'),
    ('P.10', 'pion', 'Ordinea gândirii'),
    ('C.SAC', 'cal', 'Sacrificiul tactic'),
    ('C.01', 'cal', 'Atacul dublu / furculița'),
    ('C.02', 'cal', 'Atacul sau șahul prin descoperire'),
    ('N.28', 'nebun', 'Mutarea intermediară'),
    ('N.29', 'nebun', 'Contraatacul'),
    ('N.30', 'nebun', 'Prinderea unei piese valoroase'),
    ('N.31', 'nebun', 'Atacul prin raze X'),
]

MOTIFS = [
    ('fork', 'Atac dublu / furculiță'),
    ('discovered', 'Atac prin descoperire'),
    ('pin', 'Legătură'),
    ('remove_defender', 'Eliminarea apărătorului'),
    ('back_rank', 'Slăbiciunea ultimei linii'),
    ('overload', 'Supraîncărcare'),
    ('deflection', 'Deflecția apărătorului'),
    ('double_check', 'Șah dublu'),
    ('sacrifice', 'Sacrificiu'),
    ('zwischenzug', 'Mutare intermediară'),
    ('counterattack', 'Contraatac'),
    ('trapped_piece', 'Piesă prinsă'),
    ('xray', 'Atac prin raze X'),
]

EXERCISE_FEN = '6b1/3k2p1/1p1b1p1p/1K3P1P/2B3P1/2P3B1/8/8 w - - 0 37'


class StoreError(Exception):
    pass


@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init():
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS person (
          id text PRIMARY KEY,
          role text NOT NULL,
          display_name text NOT NULL
        );
        CREATE TABLE IF NOT EXISTS competency (
          id text PRIMARY KEY,
          code text NOT NULL UNIQUE,
          belt_code text NOT NULL,
          title text NOT NULL
        );
        CREATE TABLE IF NOT EXISTS motif (
          id text PRIMARY KEY,
          code text NOT NULL UNIQUE,
          title_ro text NOT NULL
        );
        CREATE TABLE IF NOT EXISTS exercise (
          id text PRIMARY KEY,
          code text NOT NULL UNIQUE,
          ui_code text,
          competency_id text NOT NULL REFERENCES competency(id),
          title text NOT NULL,
          prompt_ro text NOT NULL,
          fen text NOT NULL,
          side_to_move text NOT NULL,
          difficulty integer NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
          max_attempts integer NOT NULL DEFAULT 3,
          is_published integer NOT NULL DEFAULT 0,
          created_by text REFERENCES person(id),
          updated_at text NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS exercise_key (
          exercise_id text PRIMARY KEY REFERENCES exercise(id) ON DELETE CASCADE,
          accepted_moves text NOT NULL,
          solution_line text NOT NULL,
          motif_code text NOT NULL,
          required_concepts text NOT NULL
        );
        CREATE TABLE IF NOT EXISTS exercise_hint (
          id text PRIMARY KEY,
          exercise_id text NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
          seq integer NOT NULL,
          body_ro text NOT NULL,
          UNIQUE (exercise_id, seq)
        );
        CREATE TABLE IF NOT EXISTS attempt_session (
          id text PRIMARY KEY,
          exercise_id text NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
          try_count integer NOT NULL DEFAULT 0,
          ended_at text,
          verdict text
        );
        CREATE TABLE IF NOT EXISTS attempt (
          id text PRIMARY KEY,
          session_id text NOT NULL REFERENCES attempt_session(id) ON DELETE CASCADE,
          try_no integer NOT NULL,
          move_san text,
          explanation text,
          motif_code text,
          move_ok integer,
          motif_ok integer,
          explain_ok integer,
          verdict text NOT NULL,
          hint_ro text,
          created_at text NOT NULL DEFAULT (datetime('now')),
          UNIQUE (session_id, try_no)
        );
        """)
        _seed(db)


def _seed(db):
    if db.execute("SELECT 1 FROM person WHERE role = 'teacher'").fetchone() is None:
        db.execute(
            "INSERT INTO person (id, role, display_name) VALUES (?, 'teacher', 'Profesor')",
            (str(uuid.uuid4()),),
        )
        db.execute(
            "INSERT INTO person (id, role, display_name) VALUES (?, 'child', 'Elev')",
            (str(uuid.uuid4()),),
        )
    for code, belt, title in COMPETENCIES:
        db.execute(
            "INSERT OR IGNORE INTO competency (id, code, belt_code, title) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), code, belt, title),
        )
    for code, title in MOTIFS:
        db.execute(
            "INSERT OR IGNORE INTO motif (id, code, title_ro) VALUES (?, ?, ?)",
            (str(uuid.uuid4()), code, title),
        )
    if db.execute("SELECT 1 FROM exercise WHERE code = 'EX-002'").fetchone() is None:
        competency = db.execute("SELECT id FROM competency WHERE code = 'C.SAC'").fetchone()
        teacher = db.execute("SELECT id FROM person WHERE role = 'teacher'").fetchone()
        exercise_id = str(uuid.uuid4())
        db.execute(
            """
            INSERT INTO exercise (
              id, code, ui_code, competency_id, title, prompt_ro, fen,
              side_to_move, difficulty, max_attempts, is_published, created_by
            ) VALUES (?, 'EX-002', 'N3', ?, ?, ?, ?, 'w', 3, 3, 1, ?)
            """,
            (
                exercise_id,
                competency['id'],
                'Exercițiul 2 — sacrificiu',
                'Introdu mutarea, explică alegerea și selectează motivul tactic.',
                EXERCISE_FEN,
                teacher['id'],
            ),
        )
        db.execute(
            """
            INSERT INTO exercise_key (exercise_id, accepted_moves, solution_line, motif_code, required_concepts)
            VALUES (?, ?, 'Be6+', 'sacrifice', ?)
            """,
            (exercise_id, 'Be6+\nBe6\nc4e6', 'sacrific\nșah'),
        )
        for seq, body in (
            (1, 'Ce mutare dă șah și oferă un nebun?'),
            (2, 'Dacă adversarul ia nebunul, ce recaptură dă șah imediat?'),
            (3, 'Urmărește pionul care reia pe câmpul șahului.'),
        ):
            db.execute(
                "INSERT INTO exercise_hint (id, exercise_id, seq, body_ro) VALUES (?, ?, ?, ?)",
                (str(uuid.uuid4()), exercise_id, seq, body),
            )


def catalog():
    with connect() as db:
        competencies = [
            {'code': row['code'], 'belt': row['belt_code'], 'title': row['title']}
            for row in db.execute('SELECT code, belt_code, title FROM competency ORDER BY code')
        ]
        motifs = [
            {'code': row['code'], 'title': row['title_ro']}
            for row in db.execute('SELECT code, title_ro FROM motif ORDER BY title_ro')
        ]
    return {
        'competencies': competencies,
        'motifs': motifs,
        'levels': [{'value': n, 'label': label} for n, label in LEVELS.items()],
    }


def _split_lines(text):
    return [part.strip() for part in (text or '').splitlines() if part.strip()]


def _join_lines(items):
    return '\n'.join(items)


def norm_move(text):
    cleaned = re.sub(r'\s+', '', (text or '').strip().lower())
    return cleaned.rstrip('+#')


_RO_PIECE = {'c': 'n', 't': 'r', 'd': 'q'}


def _map_piece(letter):
    return _RO_PIECE.get(letter.lower(), letter)


def to_international(text):
    raw = re.sub(r'[×:]', 'x', (text or '').strip())
    if not raw or re.fullmatch(r'(?i:O-O|O-O-O|0-0|0-0-0)', raw):
        return raw
    body = raw
    suffix = ''
    while body and body[-1] in '+#?!':
        suffix = body[-1] + suffix
        body = body[:-1]
    promo = ''
    promo_match = re.search(r'=([A-Za-z])$', body)
    if promo_match:
        promo = '=' + _map_piece(promo_match.group(1))
        body = body[:-2]
    dest_match = re.search(r'([a-h][1-8])$', body, flags=re.I)
    if not dest_match:
        return raw
    dest = dest_match.group(1).lower()
    body = body[:-2]
    capture = ''
    if body.lower().endswith('x'):
        capture = 'x'
        body = body[:-1]
    piece = ''
    disambiguation = body
    if body:
        head = body[0]
        rest = body[1:]
        upper = head.upper()
        known = upper in 'CTD'
        file_letter = head.lower() in 'abcdefgh'
        pawn_capture = capture and file_letter and not rest and head.islower()
        if known and not pawn_capture:
            piece = _map_piece(head).upper()
            disambiguation = rest
    return f'{piece}{disambiguation.lower()}{capture}{dest}{promo}{suffix}'


def moves_equivalent(left, right):
    if norm_move(left) == norm_move(right):
        return True
    return norm_move(to_international(left)) == norm_move(right) or norm_move(left) == norm_move(to_international(right))


def san_tokens(text):
    cleaned = re.sub(r'\{[^}]*\}|\([^)]*\)', ' ', text or '')
    tokens = []
    for token in cleaned.split():
        if re.fullmatch(r'\d+\.+', token) or token.lower() == 'sau':
            continue
        token = token.strip('.,')
        if token:
            tokens.append(token)
    return tokens


def move_for_active_color(fen, text):
    raw = text or ''
    tokens = san_tokens(raw)
    if not tokens:
        return ''
    side = _side(fen)
    starts_white = re.match(r'\s*\d+\.(?!\.)', raw) is not None
    starts_black = re.search(r'\d+\.\.\.', raw) is not None
    if starts_white and not starts_black and side == 'b' and len(tokens) > 1:
        return tokens[1]
    return tokens[0]


def parse_solution(text, fen=''):
    raw = (text or '').strip()
    if not raw:
        return [], ''
    if re.search(r',|/|\bsau\b', raw, flags=re.I):
        parts = [part.strip() for part in re.split(r'\s*(?:,|/|\bsau\b)\s*', raw, flags=re.I)]
        moves = []
        for part in parts:
            move = move_for_active_color(fen, part)
            if move and move not in moves:
                moves.append(move)
        return moves, raw
    move = move_for_active_color(fen, raw)
    return ([move] if move else []), raw


def _side(fen):
    parts = fen.split()
    return 'b' if len(parts) > 1 and parts[1] == 'b' else 'w'


def _valid_fen(fen):
    parts = fen.strip().split()
    if len(parts) < 2 or parts[1] not in ('w', 'b'):
        return False
    ranks = parts[0].split('/')
    if len(ranks) != 8:
        return False
    for rank in ranks:
        count = 0
        for symbol in rank:
            if symbol in '12345678':
                count += int(symbol)
            elif symbol.lower() in 'pnbrqk':
                count += 1
            else:
                return False
        if count != 8:
            return False
    return True


def _hints_leak(hints, moves):
    folded = [norm_move(move) for move in moves if norm_move(move)]
    for hint in hints:
        compact = re.sub(r'\s+', '', hint.lower())
        for move in folded:
            if move and move in compact:
                return True
    return False


def _next_code(db):
    rows = db.execute("SELECT code FROM exercise WHERE code LIKE 'EX-%'").fetchall()
    numbers = []
    for row in rows:
        match = re.fullmatch(r'EX-(\d+)', row['code'])
        if match:
            numbers.append(int(match.group(1)))
    return f'EX-{(max(numbers) if numbers else 0) + 1:03d}'


def _public_exercise(row, hints, session, attempts):
    if session is not None and session['ended_at'] is None:
        tries_used = session['try_count']
        tries_left = row['max_attempts'] - session['try_count']
    elif session is not None:
        tries_used = session['try_count']
        tries_left = 0
    else:
        tries_used = 0
        tries_left = row['max_attempts']
    return {
        'id': row['id'],
        'code': row['code'],
        'uiCode': row['ui_code'],
        'title': row['title'],
        'prompt': row['prompt_ro'],
        'fen': row['fen'],
        'side': row['side_to_move'],
        'difficulty': row['difficulty'],
        'level': LEVELS[row['difficulty']],
        'competencyCode': row['competency_code'],
        'competencyTitle': row['competency_title'],
        'maxAttempts': row['max_attempts'],
        'published': bool(row['is_published']),
        'triesUsed': tries_used,
        'triesLeft': tries_left,
        'closed': bool(session and session['ended_at']),
        'lastVerdict': session['verdict'] if session else None,
        'canRetry': bool(session and session['ended_at']),
        'hintCount': len(hints),
    }


def display_solution(accepted, solution_line):
    if len(accepted) > 1:
        return ' sau '.join(accepted)
    return solution_line or (accepted[0] if accepted else '')


def _teacher_exercise(row, hints, session, attempts):
    payload = _public_exercise(row, hints, session, attempts)
    payload.update({
        'solution': display_solution(_split_lines(row['accepted_moves']), row['solution_line']),
        'acceptedMoves': _split_lines(row['accepted_moves']),
        'motifCode': row['motif_code'],
        'concepts': _split_lines(row['required_concepts']),
        'hints': [hint['body_ro'] for hint in hints],
        'attempts': [
            {
                'tryNo': item['try_no'],
                'move': item['move_san'],
                'explanation': item['explanation'],
                'motifCode': item['motif_code'],
                'verdict': item['verdict'],
            }
            for item in attempts
        ],
    })
    return payload


def _load(db, exercise_id):
    row = db.execute(
        """
        SELECT e.*, c.code AS competency_code, c.title AS competency_title,
               k.accepted_moves, k.solution_line, k.motif_code, k.required_concepts
        FROM exercise e
        JOIN competency c ON c.id = e.competency_id
        JOIN exercise_key k ON k.exercise_id = e.id
        WHERE e.id = ?
        """,
        (exercise_id,),
    ).fetchone()
    if row is None:
        return None
    hints = db.execute(
        "SELECT seq, body_ro FROM exercise_hint WHERE exercise_id = ? ORDER BY seq",
        (exercise_id,),
    ).fetchall()
    session = db.execute(
        """
        SELECT * FROM attempt_session
        WHERE exercise_id = ?
        ORDER BY rowid DESC
        LIMIT 1
        """,
        (exercise_id,),
    ).fetchone()
    attempts = db.execute(
        """
        SELECT a.*
        FROM attempt a
        JOIN attempt_session s ON s.id = a.session_id
        WHERE s.exercise_id = ?
        ORDER BY a.created_at
        """,
        (exercise_id,),
    ).fetchall()
    return row, hints, session, attempts


def list_exercises(role):
    with connect() as db:
        rows = db.execute(
            """
            SELECT e.id
            FROM exercise e
            WHERE ? = 'teacher' OR e.is_published = 1
            ORDER BY e.code
            """,
            (role,),
        ).fetchall()
        items = []
        for row in rows:
            loaded = _load(db, row['id'])
            if role == 'teacher':
                items.append(_teacher_exercise(*loaded))
            else:
                items.append(_public_exercise(*loaded))
    return items


def get_exercise(exercise_id, role):
    with connect() as db:
        loaded = _load(db, exercise_id)
        if loaded is None:
            raise StoreError('Exercițiul nu există.')
        row = loaded[0]
        if role != 'teacher' and not row['is_published']:
            raise StoreError('Exercițiul nu este publicat.')
        if role == 'teacher':
            return _teacher_exercise(*loaded)
        return _public_exercise(*loaded)


def save_exercise(data, exercise_id=None):
    title = (data.get('title') or '').strip()
    prompt = (data.get('prompt') or '').strip()
    fen = (data.get('fen') or '').strip()
    competency_code = (data.get('competencyCode') or '').strip()
    motif_code = (data.get('motifCode') or '').strip()
    try:
        difficulty = int(data.get('difficulty') or 0)
    except (TypeError, ValueError):
        difficulty = 0
    accepted, solution_line = parse_solution(data.get('solution') or '', fen)
    concepts = [part.strip() for part in re.split(r'[,;\n]+', data.get('concepts') or '') if part.strip()]
    hints = [part.strip() for part in (data.get('hints') or []) if str(part).strip()][:3]
    published = 1 if data.get('published', True) else 0

    if not title or not prompt:
        raise StoreError('Titlul și enunțul sunt obligatorii.')
    if not _valid_fen(fen):
        raise StoreError('FEN-ul nu descrie o poziție completă.')
    if not accepted:
        raise StoreError('Linia de soluție este obligatorie.')
    if difficulty not in LEVELS:
        raise StoreError('Nivelul trebuie să fie între 1 și 5.')
    if _hints_leak(hints, accepted):
        raise StoreError('Indiciul nu poate conține mutarea-soluție.')

    with connect() as db:
        competency = db.execute(
            'SELECT id FROM competency WHERE code = ?', (competency_code,)
        ).fetchone()
        if competency is None:
            raise StoreError('Competența aleasă nu există.')
        motif = db.execute('SELECT code FROM motif WHERE code = ?', (motif_code,)).fetchone()
        if motif is None:
            raise StoreError('Motivul tactic ales nu există.')
        teacher = db.execute("SELECT id FROM person WHERE role = 'teacher'").fetchone()

        if exercise_id is None:
            exercise_id = str(uuid.uuid4())
            code = _next_code(db)
            db.execute(
                """
                INSERT INTO exercise (
                  id, code, ui_code, competency_id, title, prompt_ro, fen,
                  side_to_move, difficulty, max_attempts, is_published, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 3, ?, ?)
                """,
                (
                    exercise_id, code, f'N{difficulty}', competency['id'], title, prompt,
                    fen, _side(fen), difficulty, published, teacher['id'],
                ),
            )
        else:
            updated = db.execute(
                """
                UPDATE exercise
                SET ui_code = ?, competency_id = ?, title = ?, prompt_ro = ?, fen = ?,
                    side_to_move = ?, difficulty = ?, is_published = ?,
                    updated_at = datetime('now')
                WHERE id = ?
                """,
                (
                    f'N{difficulty}', competency['id'], title, prompt, fen, _side(fen),
                    difficulty, published, exercise_id,
                ),
            )
            if updated.rowcount == 0:
                raise StoreError('Exercițiul nu există.')

        db.execute(
            """
            INSERT INTO exercise_key (exercise_id, accepted_moves, solution_line, motif_code, required_concepts)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (exercise_id) DO UPDATE SET
              accepted_moves = excluded.accepted_moves,
              solution_line = excluded.solution_line,
              motif_code = excluded.motif_code,
              required_concepts = excluded.required_concepts
            """,
            (exercise_id, _join_lines(accepted), solution_line, motif_code, _join_lines(concepts)),
        )
        db.execute('DELETE FROM exercise_hint WHERE exercise_id = ?', (exercise_id,))
        for seq, body in enumerate(hints, start=1):
            db.execute(
                "INSERT INTO exercise_hint (id, exercise_id, seq, body_ro) VALUES (?, ?, ?, ?)",
                (str(uuid.uuid4()), exercise_id, seq, body),
            )
    return get_exercise(exercise_id, 'teacher')


def delete_exercise(exercise_id):
    with connect() as db:
        deleted = db.execute('DELETE FROM exercise WHERE id = ?', (exercise_id,))
        if deleted.rowcount == 0:
            raise StoreError('Exercițiul nu există.')


def open_session(exercise_id):
    with connect() as db:
        row = db.execute(
            'SELECT id, is_published, max_attempts FROM exercise WHERE id = ?',
            (exercise_id,),
        ).fetchone()
        if row is None or not row['is_published']:
            raise StoreError('Exercițiul nu este publicat.')
        current = db.execute(
            """
            SELECT * FROM attempt_session
            WHERE exercise_id = ? AND ended_at IS NULL
            """,
            (exercise_id,),
        ).fetchone()
        if current is not None:
            raise StoreError('Există deja o încercare deschisă.')
        db.execute(
            "INSERT INTO attempt_session (id, exercise_id, try_count) VALUES (?, ?, 0)",
            (str(uuid.uuid4()), exercise_id),
        )
    return get_exercise(exercise_id, 'child')


def fold(text):
    folded = (text or '').strip().lower()
    for source, target in (
        ('ă', 'a'), ('â', 'a'), ('î', 'i'),
        ('ș', 's'), ('ş', 's'), ('ț', 't'), ('ţ', 't'),
    ):
        folded = folded.replace(source, target)
    return re.sub(r'\s+', ' ', folded)


def _concepts_covered(explanation, concepts):
    if not concepts:
        return bool((explanation or '').strip())
    folded = fold(explanation)
    if not folded:
        return False
    return all(fold(concept) in folded for concept in concepts)


def _feedback(move_ok, motif_ok, explain_ok, hint):
    if move_ok and motif_ok and explain_ok:
        return 'Mutarea, motivul și explicația sunt corecte.'
    parts = []
    if not move_ok:
        parts.append('Mutarea nu este cea din soluție.')
    else:
        parts.append('Mutarea este corectă.')
        if not motif_ok:
            parts.append('Motivul ales nu descrie ideea poziției.')
        if not explain_ok:
            parts.append('Explicația încă nu spune ce piesă se oferă și ce urmează imediat.')
    if hint:
        parts.append(hint)
    return ' '.join(parts)


def submit_attempt(exercise_id, move, explanation, motif_code):
    move = (move or '').strip()
    explanation = (explanation or '').strip()
    motif_code = (motif_code or '').strip()
    if not move:
        raise StoreError('Scrie mutarea sau joac-o pe tablă.')
    if not explanation:
        raise StoreError('Scrie o propoziție: de ce ai ales mutarea.')
    if not motif_code:
        raise StoreError('Alege motivul tactic din listă.')

    with connect() as db:
        loaded = _load(db, exercise_id)
        if loaded is None:
            raise StoreError('Exercițiul nu există.')
        row, hints, session, _attempts = loaded
        if not row['is_published']:
            raise StoreError('Exercițiul nu este publicat.')
        if session is not None and session['ended_at'] is not None:
            raise StoreError('Cele 3 încercări s-au încheiat. Poți începe din nou.')
        if session is None:
            session_id = str(uuid.uuid4())
            db.execute(
                "INSERT INTO attempt_session (id, exercise_id, try_count) VALUES (?, ?, 0)",
                (session_id, exercise_id),
            )
            session = db.execute(
                'SELECT * FROM attempt_session WHERE id = ?', (session_id,)
            ).fetchone()
        if session['try_count'] >= row['max_attempts']:
            raise StoreError('Cele 3 încercări s-au încheiat.')

        motif = db.execute('SELECT code FROM motif WHERE code = ?', (motif_code,)).fetchone()
        if motif is None:
            raise StoreError('Motivul tactic ales nu există.')

        accepted = _split_lines(row['accepted_moves'])
        side_move = move_for_active_color(row['fen'], row['solution_line'])
        if side_move:
            accepted = [*accepted, side_move]
        move_ok = any(moves_equivalent(move, item) for item in accepted)
        motif_ok = motif_code == row['motif_code']
        explain_ok = _concepts_covered(explanation, _split_lines(row['required_concepts']))
        if move_ok and motif_ok and explain_ok:
            verdict = 'pass'
        elif move_ok or motif_ok or explain_ok:
            verdict = 'partial'
        else:
            verdict = 'fail'

        try_no = session['try_count'] + 1
        tries_left = row['max_attempts'] - try_no
        hint = ''
        if verdict != 'pass' and tries_left > 0:
            match = next((item['body_ro'] for item in hints if item['seq'] == try_no), '')
            hint = match
        feedback = _feedback(move_ok, motif_ok, explain_ok, hint)
        closed = verdict == 'pass' or tries_left <= 0
        attempt_id = str(uuid.uuid4())
        db.execute(
            """
            INSERT INTO attempt (
              id, session_id, try_no, move_san, explanation, motif_code,
              move_ok, motif_ok, explain_ok, verdict, hint_ro
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                attempt_id, session['id'], try_no, move, explanation, motif_code,
                int(move_ok), int(motif_ok), int(explain_ok), verdict, hint,
            ),
        )
        db.execute(
            """
            UPDATE attempt_session
            SET try_count = ?,
                ended_at = CASE WHEN ? THEN datetime('now') ELSE NULL END,
                verdict = CASE WHEN ? THEN ? ELSE NULL END
            WHERE id = ?
            """,
            (try_no, int(closed), int(closed), verdict if closed else None, session['id']),
        )

    return {
        'attemptId': attempt_id,
        'verdict': verdict,
        'tryNo': try_no,
        'triesLeft': max(tries_left, 0),
        'closed': closed,
        'moveOk': move_ok,
        'motifOk': motif_ok,
        'explainOk': explain_ok,
        'hint': hint,
        'feedback': feedback,
    }
