import http.server
import socketserver
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

socketserver.TCPServer.allow_reuse_address = True
http.server.HTTPServer.allow_reuse_address = True

host = os.environ.get("HOST", "127.0.0.1")
port = int(os.environ.get("PORT", "8080"))

with http.server.ThreadingHTTPServer(
    (host, port), http.server.SimpleHTTPRequestHandler
) as httpd:
    print(f"Server running on http://{host}:{port}", flush=True)
    httpd.serve_forever()
