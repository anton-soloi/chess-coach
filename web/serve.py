"""Pornește aplicația și API-ul exercițiilor.

.wasm trebuie servit ca application/wasm, altfel Stockfish nu pornește.
Exercițiile se citesc și se scriu în data/chesscoach.sqlite.
Lecțiile complete se scriu în lessons/<lessonId>.json.
"""

import json
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import store

ROOT = Path(__file__).resolve().parent.parent
LESSONS_DIR = ROOT / 'lessons'
LESSON_ID = re.compile(r'[A-Za-z0-9_-]{1,80}')


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
