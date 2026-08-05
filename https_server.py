import http.server
import ssl
import os

CACHE_SECONDS = 3600  # 1 hour browser cache for heavy assets

class SmartHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # silent

    def do_GET(self):
        clean_path = self.path.split('?')[0]

        # For GLB/FBX: serve pre-compressed .gz if available, else fallback to raw
        if clean_path.endswith('.glb') or clean_path.endswith('.fbx'):
            file_path = self.translate_path(clean_path)
            gz_path   = file_path + '.gz'

            accept_encoding = self.headers.get('Accept-Encoding', '')

            if 'gzip' in accept_encoding and os.path.isfile(gz_path):
                # Serve pre-compressed file instantly (no CPU overhead)
                try:
                    size = os.path.getsize(gz_path)
                    with open(gz_path, 'rb') as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'model/gltf-binary')
                    self.send_header('Content-Encoding', 'gzip')
                    self.send_header('Content-Length', str(size))
                    self.send_header('Cache-Control', f'public, max-age={CACHE_SECONDS}')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(content)
                    return
                except Exception as e:
                    pass  # fall through to normal serving

        # Default serving with cache headers for all other files
        super().do_GET()

    def end_headers(self):
        # Add cache header to all responses (short cache for HTML/JS, long for assets)
        path = self.path.split('?')[0]
        if path.endswith(('.html', '.js', '.css')):
            self.send_header('Cache-Control', 'no-cache')
        elif path.endswith(('.glb', '.fbx', '.png', '.jpg', '.webp')):
            self.send_header('Cache-Control', f'public, max-age={CACHE_SECONDS}')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


server_address = ('0.0.0.0', 8443)
httpd = http.server.HTTPServer(server_address, SmartHTTPRequestHandler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile='server.pem', keyfile='server.pem')
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print("HTTPS Server on https://0.0.0.0:8443 — pre-gzip + Cache-Control enabled")
httpd.serve_forever()

