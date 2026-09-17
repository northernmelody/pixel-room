"""Local preview with cache disabled so edited ES modules stay consistent."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2]
    print('Preview: http://127.0.0.1:8138/portrait/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8138), partial(PreviewHandler, directory=str(root))).serve_forever()
