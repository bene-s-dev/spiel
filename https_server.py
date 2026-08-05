import http.server
import ssl
import gzip
import io

class GzipHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        # Serve FBX and GLB with live GZIP compression for instant mobile loading
        clean_path = self.path.split('?')[0]
        if clean_path.endswith('.fbx') or clean_path.endswith('.glb'):
            filePath = self.translate_path(clean_path)
            try:
                with open(filePath, 'rb') as f:
                    content = f.read()
                
                accept_encoding = self.headers.get('Accept-Encoding', '')
                if 'gzip' in accept_encoding:
                    out = io.BytesIO()
                    with gzip.GzipFile(fileobj=out, mode='wb', compresslevel=6) as gz:
                        gz.write(content)
                    compressed = out.getvalue()

                    self.send_response(200)
                    self.send_header('Content-Type', 'application/octet-stream')
                    self.send_header('Content-Encoding', 'gzip')
                    self.send_header('Content-Length', str(len(compressed)))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(compressed)
                    return
            except Exception as e:
                pass

        super().do_GET()

server_address = ('0.0.0.0', 8443)
httpd = http.server.HTTPServer(server_address, GzipHTTPRequestHandler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile='server.pem', keyfile='server.pem')
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print("HTTPS Server listening on https://0.0.0.0:8443 with GZIP Compression")
httpd.serve_forever()
