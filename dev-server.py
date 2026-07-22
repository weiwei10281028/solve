import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


server = ThreadingHTTPServer(('', 18080), NoCacheHandler)
webbrowser.open_new_tab('http://127.0.0.1:18080/')
server.serve_forever()
