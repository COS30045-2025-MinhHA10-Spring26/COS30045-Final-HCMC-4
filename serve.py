import http.server
import socketserver
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

socketserver.TCPServer.allow_reuse_address = True
http.server.HTTPServer.allow_reuse_address = True

with http.server.ThreadingHTTPServer(
    ("", 8080), http.server.SimpleHTTPRequestHandler
) as httpd:
    print("Server running on port 8080", flush=True)
    httpd.serve_forever()
