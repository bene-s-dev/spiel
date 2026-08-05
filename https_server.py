import http.server
import ssl
import os
import threading

CACHE_SECONDS = 3600  # 1 hour browser cache for heavy assets

class SmartHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    # Enabled logging for diagnostics
    pass

    def do_GET(self):
        clean_path = self.path.split('?')[0]

        # For GLB/FBX: serve pre-compressed .gz if available, else fallback to raw
        if clean_path.endswith('.glb') or clean_path.endswith('.fbx'):
            file_path = self.translate_path(clean_path)
            gz_path   = file_path + '.gz'

            accept_encoding = self.headers.get('Accept-Encoding', '')

            if 'gzip' in accept_encoding and os.path.isfile(gz_path):
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
                    pass

        super().do_GET()

    def end_headers(self):
        path = getattr(self, 'path', '').split('?')[0]
        if path:
            if path.endswith(('.html', '.js', '.css')):
                self.send_header('Cache-Control', 'no-cache')
            elif path.endswith(('.glb', '.fbx', '.png', '.jpg', '.webp')):
                self.send_header('Cache-Control', f'public, max-age={CACHE_SECONDS}')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def start_http_server(port):
    try:
        server_address = ('0.0.0.0', port)
        httpd = http.server.ThreadingHTTPServer(server_address, SmartHTTPRequestHandler)
        print(f"✅ HTTP Server (No SSL warnings) active on http://0.0.0.0:{port}")
        httpd.serve_forever()
    except Exception as e:
        print(f"⚠️ HTTP Port {port} error: {e}")

def start_https_server(port):
    try:
        server_address = ('0.0.0.0', port)
        httpd = http.server.ThreadingHTTPServer(server_address, SmartHTTPRequestHandler)

        context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        context.load_cert_chain(certfile='server.pem', keyfile='server.pem')
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

        print(f"✅ HTTPS Server (Gyro sensor) active on https://0.0.0.0:{port}")
        httpd.serve_forever()
    except Exception as e:
        print(f"⚠️ HTTPS Port {port} error: {e}")

if __name__ == '__main__':
    print("🚀 Starting Tri-Port Server (HTTP 8000 + HTTPS 8080 & 8443)...")
    t0 = threading.Thread(target=start_http_server, args=(8000,), daemon=True)
    t1 = threading.Thread(target=start_https_server, args=(8080,), daemon=True)
    t2 = threading.Thread(target=start_https_server, args=(8443,), daemon=True)
    t0.start()
    t1.start()
    t2.start()
    
    t0.join()
    t1.join()
    t2.join()
