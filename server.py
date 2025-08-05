#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
import re
from urllib.parse import parse_qs, urlparse
import cgi

class AdminHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/update-content':
            self.handle_update_content()
        elif self.path == '/api/upload-logo':
            self.handle_upload_logo()
        else:
            self.send_error(404)
    
    def handle_update_content(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            
            # Read current index.html
            with open('index.html', 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # Update hero title
            if 'heroTitle' in data:
                html_content = re.sub(
                    r'<h1 class="hero-title">.*?</h1>',
                    f'<h1 class="hero-title">{data["heroTitle"]}</h1>',
                    html_content
                )
            
            # Update hero subtitle
            if 'heroSubtitle' in data:
                html_content = re.sub(
                    r'<p class="hero-subtitle">.*?</p>',
                    f'<p class="hero-subtitle">{data["heroSubtitle"]}</p>',
                    html_content
                )
            
            # Update origin title
            if 'originTitle' in data:
                html_content = re.sub(
                    r'<h2>🎯 ORIGIN</h2>',
                    f'<h2>{data["originTitle"]}</h2>',
                    html_content
                )
            
            # Update origin content
            if 'originContent' in data:
                html_content = re.sub(
                    r'<p>In the chaos of the crypto world.*?</p>',
                    f'<p>{data["originContent"]}</p>',
                    html_content
                )
            
            # Update moon title
            if 'moonTitle' in data:
                html_content = re.sub(
                    r'<h2>🌙 TO THE MOON</h2>',
                    f'<h2>{data["moonTitle"]}</h2>',
                    html_content
                )
            
            # Update moon content
            if 'moonContent' in data:
                html_content = re.sub(
                    r'<p>There\'s only one goal.*?</p>',
                    f'<p>{data["moonContent"]}</p>',
                    html_content
                )
            
            # Write updated content back to file
            with open('index.html', 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'message': 'Content updated successfully'}).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode())
    
    def handle_upload_logo(self):
        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST'}
            )
            
            if 'logo' in form:
                fileitem = form['logo']
                if fileitem.filename:
                    # Save to assets/images/fuddoge.png
                    with open('assets/images/fuddoge.png', 'wb') as f:
                        f.write(fileitem.file.read())
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True, 'message': 'Logo uploaded successfully'}).encode())
                else:
                    raise Exception('No file uploaded')
            else:
                raise Exception('No logo field found')
                
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == "__main__":
    PORT = 8000
    
    with socketserver.TCPServer(("", PORT), AdminHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        print("Admin panel: http://localhost:8000/admin.html")
        print("Main site: http://localhost:8000")
        httpd.serve_forever() 