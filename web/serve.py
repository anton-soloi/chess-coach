"""Pornește aplicația și API-ul exercițiilor.

.wasm trebuie servit ca application/wasm, altfel Stockfish nu pornește.
Exercițiile se citesc și se scriu în data/chesscoach.sqlite.
Lecțiile complete se scriu în lessons/<lessonId>.json.
Exercițiile adăugate din panoul de Profesor se scriu în web/curriculum/train-authored.json.
Secțiunile noi din Train se scriu în web/curriculum/train-sections.json.
Exercițiile de catalog scoase din listă se notează în web/curriculum/train-removed.json.
Pozițiile și partidele adăugate la maeștri se scriu în web/curriculum/masters-authored.json.
"""

import json
import re
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import store

ROOT = Path(__file__).resolve().parent.parent
WEB = Path(__file__).resolve().parent
LESSONS_DIR = ROOT / 'lessons'
AUTHORED_PATH = WEB / 'curriculum' / 'train-authored.json'
SECTIONS_PATH = WEB / 'curriculum' / 'train-sections.json'
REMOVED_PATH = WEB / 'curriculum' / 'train-removed.json'
MASTERS_PATH = WEB / 'curriculum' / 'masters-authored.json'
LESSON_ID = re.compile(r'[A-Za-z0-9_-]{1,80}')
SAFE_ID = re.compile(r'^[A-Za-z0-9_-]{1,80}$')
CODE_NUM = re.compile(r'^CX-(\d+)$')
SECTION_NUM = re.compile(r'^section-(\d+)$')
MX_NUM = re.compile(r'^MX-(\d+)$')
MOVE_TOKEN = re.compile(r'^[A-Za-z0-9+#=xO-]{1,16}$')
_authored_lock = threading.Lock()
_sections_lock = threading.Lock()
_removed_lock = threading.Lock()
_masters_lock = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).resolve().parent), **kwargs)

    def guess_type(self, path):
        if str(path).endswith('.wasm'):
            return 'application/wasm'
        return super().guess_type(path)

    def end_headers(self):
        path = urlparse(self.path).path
        if path in ('/', '') or path.endswith(('.html', '.js', '.css', '.json')) or path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith('/api/'):
            self._api('GET', parsed)
            return
        super().do_GET()

    def do_POST(self):
        self._api('POST', urlparse(self.path))

    def do_PUT(self):
        self._api('PUT', urlparse(self.path))

    def do_DELETE(self):
        self._api('DELETE', urlparse(self.path))

    def _api(self, method, parsed):
        parts = [part for part in parsed.path.split('/') if part]
        try:
            body = self._read_json() if method in ('POST', 'PUT') else {}
            payload = self._route(method, parts, body)
            status = 200
        except store.StoreError as err:
            payload = {'error': str(err)}
            status = 400
        except Exception as err:
            payload = {'error': 'Nu am putut salva exercițiul.'}
            status = 500
            self.log_error('api %s', err)
        raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self):
        length = int(self.headers.get('Content-Length') or 0)
        if length == 0:
            return {}
        limit = 1_000_000 if urlparse(self.path).path == '/api/save-lesson' else 100_000
        if length > limit:
            raise store.StoreError('Cererea este prea mare.')
        try:
            return json.loads(self.rfile.read(length).decode('utf-8'))
        except json.JSONDecodeError as err:
            raise store.StoreError('JSON invalid.') from err

    def _route(self, method, parts, body):
        if parts == ['api', 'save-lesson'] and method == 'POST':
            return save_lesson(body)
        if parts == ['api', 'list-lessons'] and method == 'GET':
            return list_lessons()
        if len(parts) == 3 and parts[:2] == ['api', 'lesson'] and method == 'GET':
            return read_lesson(parts[2])
        if parts == ['api', 'train-authored'] and method == 'GET':
            return read_authored()
        if parts == ['api', 'train-authored'] and method == 'POST':
            return save_authored(body)
        if len(parts) == 3 and parts[:2] == ['api', 'train-authored'] and method == 'DELETE':
            return delete_authored(parts[2])
        if parts == ['api', 'train-sections'] and method == 'GET':
            return read_sections()
        if parts == ['api', 'train-sections'] and method == 'POST':
            return save_section(body)
        if len(parts) == 3 and parts[:2] == ['api', 'train-sections'] and method == 'DELETE':
            return delete_section(parts[2])
        if parts == ['api', 'train-removed'] and method == 'GET':
            return read_removed()
        if parts == ['api', 'train-removed'] and method == 'POST':
            return hide_train_drill(body)
        if parts == ['api', 'masters-authored'] and method == 'GET':
            return read_masters()
        if parts == ['api', 'masters-authored'] and method == 'POST':
            return save_master(body)
        if len(parts) == 3 and parts[:2] == ['api', 'masters-authored'] and method == 'DELETE':
            return delete_master(parts[2])
        if parts == ['api', 'catalog'] and method == 'GET':
            return store.catalog()
        if parts == ['api', 'exercises'] and method == 'GET':
            role = 'teacher' if 'teacher' in self.path else 'child'
            return {'exercises': store.list_exercises(role)}
        if parts == ['api', 'exercises'] and method == 'POST':
            return store.save_exercise(body)
        if len(parts) == 3 and parts[:2] == ['api', 'exercises'] and method == 'GET':
            role = 'teacher' if 'role=teacher' in self.path else 'child'
            return store.get_exercise(parts[2], role)
        if len(parts) == 3 and parts[:2] == ['api', 'exercises'] and method == 'PUT':
            return store.save_exercise(body, parts[2])
        if len(parts) == 3 and parts[:2] == ['api', 'exercises'] and method == 'DELETE':
            store.delete_exercise(parts[2])
            return {'deleted': True}
        if len(parts) == 4 and parts[:2] == ['api', 'exercises'] and parts[3] == 'attempt' and method == 'POST':
            return store.submit_attempt(
                parts[2],
                body.get('move'),
                body.get('explanation'),
                body.get('motifCode'),
            )
        if len(parts) == 4 and parts[:2] == ['api', 'exercises'] and parts[3] == 'retry' and method == 'POST':
            return store.open_session(parts[2])
        raise store.StoreError('Adresa nu există.')


def lesson_file(lesson_id):
    name = str(lesson_id or 'lectie_temp')
    if not LESSON_ID.fullmatch(name):
        raise store.StoreError('Identificatorul lecției nu este valid.')
    return LESSONS_DIR / f'{name}.json'


def save_lesson(body):
    if not isinstance(body, dict):
        raise store.StoreError('Lecția trebuie să fie un obiect JSON.')
    lesson_id = body.get('lessonId') or 'lectie_temp'
    path = lesson_file(lesson_id)
    LESSONS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(body, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'status': 'success', 'message': f'Lecția {lesson_id} a fost salvată!'}


def read_lesson(lesson_id):
    path = lesson_file(lesson_id)
    if not path.is_file():
        raise store.StoreError('Lecția nu există.')
    return json.loads(path.read_text(encoding='utf-8'))


def clean_text(value, limit):
    text = value if isinstance(value, str) else ''
    return text.replace('\x00', '').strip()[:limit]


def clean_id(value):
    text = clean_text(value, 80)
    return text if SAFE_ID.fullmatch(text) else ''


def read_authored():
    if not AUTHORED_PATH.is_file():
        return {'exercises': []}
    try:
        data = json.loads(AUTHORED_PATH.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return {'exercises': []}
    exercises = data.get('exercises') if isinstance(data, dict) else None
    if not isinstance(exercises, list):
        return {'exercises': []}
    return {'exercises': [item for item in exercises if isinstance(item, dict)]}


def write_authored(data):
    AUTHORED_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = AUTHORED_PATH.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(AUTHORED_PATH)


def next_authored_code(exercises):
    numbers = []
    for item in exercises:
        match = CODE_NUM.fullmatch(str(item.get('code') or ''))
        if match:
            numbers.append(int(match.group(1)))
    return f'CX-{(max(numbers) if numbers else 0) + 1:03d}'


def save_authored(body):
    if not isinstance(body, dict):
        raise store.StoreError('Exercițiul trebuie să fie un obiect JSON.')
    title = clean_text(body.get('title'), 160)
    fen = clean_text(body.get('fen'), 240)
    if not title:
        raise store.StoreError('Titlul este obligatoriu.')
    if fen.count('/') < 7:
        raise store.StoreError('FEN-ul nu descrie o poziție.')
    ancestors = []
    for value in body.get('ancestors') or []:
        ident = clean_id(value)
        if ident and ident not in ancestors:
            ancestors.append(ident)
        if len(ancestors) == 8:
            break
    with _authored_lock:
        data = read_authored()
        exercises = data['exercises']
        incoming_id = clean_id(body.get('id'))
        record = next((item for item in exercises if item.get('id') == incoming_id), None) if incoming_id else None
        if record is None:
            code = clean_text(body.get('code'), 40) or next_authored_code(exercises)
            ident = clean_id(body.get('id')) or clean_id(code.lower()) or 'cx'
            used = {item.get('id') for item in exercises}
            base = ident
            suffix = 2
            while ident in used:
                ident = f'{base}-{suffix}'
                suffix += 1
            record = {'id': ident, 'code': code}
            exercises.append(record)
        goal = clean_text(body.get('goal'), 16)
        record.update({
            'parentId': clean_id(body.get('parentId')),
            'afterId': clean_id(body.get('afterId')),
            'ancestors': ancestors,
            'title': title,
            'section': clean_text(body.get('section'), 240),
            'fen': fen,
            'prompt': clean_text(body.get('prompt'), 4000),
            'note': clean_text(body.get('note'), 4000),
            'move': clean_text(body.get('move'), 500),
            'pgn': clean_text(body.get('pgn'), 20000),
            'goal': goal if goal in ('mate', 'advantage') else '',
        })
        write_authored({'exercises': exercises})
        stored = dict(record)
    return {'exercise': stored, 'exercises': exercises}


def read_sections():
    if not SECTIONS_PATH.is_file():
        return {'sections': []}
    try:
        data = json.loads(SECTIONS_PATH.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return {'sections': []}
    sections = data.get('sections') if isinstance(data, dict) else None
    if not isinstance(sections, list):
        return {'sections': []}
    return {'sections': [item for item in sections if isinstance(item, dict)]}


def write_sections(data):
    SECTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = SECTIONS_PATH.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(SECTIONS_PATH)


def next_section_id(sections):
    numbers = []
    for item in sections:
        match = SECTION_NUM.fullmatch(str(item.get('id') or ''))
        if match:
            numbers.append(int(match.group(1)))
    return f'section-{(max(numbers) if numbers else 0) + 1:03d}'


def save_section(body):
    if not isinstance(body, dict):
        raise store.StoreError('Secțiunea trebuie să fie un obiect JSON.')
    title = clean_text(body.get('title'), 160)
    parent = clean_id(body.get('parentId'))
    if not title:
        raise store.StoreError('Titlul secțiunii este obligatoriu.')
    if not parent:
        raise store.StoreError('Capitolul secțiunii lipsește.')
    with _sections_lock:
        data = read_sections()
        sections = data['sections']
        incoming = clean_id(body.get('id'))
        record = next((item for item in sections if item.get('id') == incoming), None) if incoming else None
        if record is None:
            record = {'id': next_section_id(sections)}
            sections.append(record)
        record.update({
            'title': title,
            'parentId': parent,
            'afterId': clean_id(body.get('afterId')),
        })
        write_sections({'sections': sections})
        stored = dict(record)
    return {'section': stored, 'sections': sections}


def delete_section(section_id):
    ident = clean_id(section_id)
    if not ident:
        raise store.StoreError('Secțiunea nu există.')
    with _sections_lock:
        data = read_sections()
        sections = [item for item in data['sections'] if item.get('id') != ident]
        if len(sections) == len(data['sections']):
            raise store.StoreError('Secțiunea nu există.')
        write_sections({'sections': sections})
    return {'deleted': True, 'sections': sections}


def delete_authored(exercise_id):
    ident = clean_id(exercise_id)
    if not ident:
        raise store.StoreError('Exercițiul nu există.')
    with _authored_lock:
        data = read_authored()
        exercises = [item for item in data['exercises'] if item.get('id') != ident]
        if len(exercises) == len(data['exercises']):
            raise store.StoreError('Exercițiul nu există.')
        write_authored({'exercises': exercises})
    return {'deleted': True, 'exercises': exercises}


def read_removed():
    if not REMOVED_PATH.is_file():
        return {'ids': []}
    try:
        data = json.loads(REMOVED_PATH.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return {'ids': []}
    ids = data.get('ids') if isinstance(data, dict) else None
    if not isinstance(ids, list):
        return {'ids': []}
    clean = []
    for value in ids:
        ident = clean_id(value)
        if ident and ident not in clean:
            clean.append(ident)
    return {'ids': clean}


def write_removed(data):
    REMOVED_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = REMOVED_PATH.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(REMOVED_PATH)


def hide_train_drill(body):
    ident = clean_id(body.get('id') if isinstance(body, dict) else '')
    if not ident:
        raise store.StoreError('Exercițiul nu există.')
    with _removed_lock:
        data = read_removed()
        ids = data['ids']
        if ident not in ids:
            ids.append(ident)
        write_removed({'ids': ids})
    return {'ids': ids}


def read_masters():
    if not MASTERS_PATH.is_file():
        return {'exercises': []}
    try:
        data = json.loads(MASTERS_PATH.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return {'exercises': []}
    exercises = data.get('exercises') if isinstance(data, dict) else None
    if not isinstance(exercises, list):
        return {'exercises': []}
    return {'exercises': [item for item in exercises if isinstance(item, dict)]}


def write_masters(data):
    MASTERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = MASTERS_PATH.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(MASTERS_PATH)


def next_master_code(exercises):
    numbers = []
    for item in exercises:
        match = MX_NUM.fullmatch(str(item.get('code') or ''))
        if match:
            numbers.append(int(match.group(1)))
    return f'MX-{(max(numbers) if numbers else 0) + 1:03d}'


def clean_moves(values):
    moves = []
    for value in values or []:
        token = clean_text(value, 16)
        if not token:
            continue
        if not MOVE_TOKEN.fullmatch(token):
            raise store.StoreError('Mutarea din partidă nu este recunoscută.')
        moves.append(token)
        if len(moves) == 400:
            break
    return moves


def save_master(body):
    if not isinstance(body, dict):
        raise store.StoreError('Exercițiul trebuie să fie un obiect JSON.')
    title = clean_text(body.get('title'), 160)
    fen = clean_text(body.get('fen'), 240)
    master_id = clean_id(body.get('masterId'))
    if not title:
        raise store.StoreError('Titlul este obligatoriu.')
    if not master_id:
        raise store.StoreError('Maestrul nu este ales.')
    if fen.count('/') < 7:
        raise store.StoreError('FEN-ul nu descrie o poziție.')
    moves = clean_moves(body.get('moves'))
    correct = clean_text(body.get('correctMove'), 16)
    if correct and not MOVE_TOKEN.fullmatch(correct):
        raise store.StoreError('Mutarea maestrului nu este recunoscută.')
    if not moves and not correct:
        raise store.StoreError('Adaugă mutarea diagramei sau un PGN.')
    learner = 'b' if clean_text(body.get('learner'), 1) == 'b' else 'w'
    with _masters_lock:
        data = read_masters()
        exercises = data['exercises']
        incoming_id = clean_id(body.get('id'))
        record = next((item for item in exercises if item.get('id') == incoming_id), None) if incoming_id else None
        if record is None:
            code = next_master_code(exercises)
            ident = clean_id(code.lower()) or 'mx'
            used = {item.get('id') for item in exercises}
            while ident in used:
                ident = f'{ident}-2'
            record = {'id': ident, 'code': code}
            exercises.append(record)
        record.update({
            'masterId': master_id,
            'title': title,
            'fen': fen,
            'moves': moves or ([correct] if correct else []),
            'correctMove': correct or (moves[0] if moves else ''),
            'learner': learner,
            'question': clean_text(body.get('question'), 500),
            'goldenRule': clean_text(body.get('goldenRule'), 500),
            'pgn': clean_text(body.get('pgn'), 20000),
        })
        write_masters({'exercises': exercises})
        stored = dict(record)
    return {'exercise': stored, 'exercises': exercises}


def delete_master(exercise_id):
    ident = clean_id(exercise_id)
    if not ident:
        raise store.StoreError('Exercițiul nu există.')
    with _masters_lock:
        data = read_masters()
        exercises = [item for item in data['exercises'] if item.get('id') != ident]
        if len(exercises) == len(data['exercises']):
            raise store.StoreError('Exercițiul nu există.')
        write_masters({'exercises': exercises})
    return {'deleted': True, 'exercises': exercises}


def list_lessons():
    if not LESSONS_DIR.is_dir():
        return {'lessons': []}
    names = sorted(path.stem for path in LESSONS_DIR.glob('*.json') if path.is_file())
    return {'lessons': names}


if __name__ == '__main__':
    LESSONS_DIR.mkdir(parents=True, exist_ok=True)
    store.init()
    server = ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
    print('http://127.0.0.1:8765')
    server.serve_forever()
