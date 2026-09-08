#!/usr/bin/env python3
"""Static dev server that refuses to cache — including the ES module graph.

`no-store` alone is NOT enough, which cost this project many rounds of
debugging across several sessions. Browsers keep an instantiated module graph
per origin and reuse it across reloads and even across new tabs, so an edited
module can keep running its old code while the server is plainly sending the
new one. The classic symptom is a SyntaxError about a missing export that is
right there in the file:

    SyntaxError: The requested module './masks.js' does not provide an
    export named 'spriteMaskHit'

The other symptom is worse, because it looks like your change simply had no
effect.

THE FIX: version every module URL, per page load.

  * a request for an .html file gets `?v=<timestamp>` injected into its
    <script type="module" src="..."> tags
  * a request for a .js file carrying `?v=T` has that same `?v=T` appended to
    every relative import specifier inside it

The version therefore propagates through the whole graph from one entry point,
so every module on a given page load is a URL the browser has never seen and
must fetch and instantiate afresh. Two page loads never share a module.

This is a DEV server only; nothing here ships.
"""

import os
import re
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# `from './x.js'`, `from "../y/z.js"`, `import('./w.js')` — relative only, so
# bare specifiers and absolute URLs are left alone.
IMPORT_RE = re.compile(
    r"""(?P<pre>\b(?:from|import)\s*\(?\s*)(?P<q>['"])(?P<spec>\.{1,2}/[^'"]+?)(?P=q)"""
)
SCRIPT_RE = re.compile(
    r"""(?P<pre><script[^>]*\btype\s*=\s*["']module["'][^>]*\bsrc\s*=\s*)(?P<q>['"])(?P<src>[^'"]+)(?P=q)"""
)


def version_imports(text: str, version: str) -> str:
    def sub(m):
        spec = m.group("spec")
        joiner = "&" if "?" in spec else "?"
        return f'{m.group("pre")}{m.group("q")}{spec}{joiner}v={version}{m.group("q")}'

    return IMPORT_RE.sub(sub, text)


def version_scripts(text: str, version: str) -> str:
    def sub(m):
        src = m.group("src")
        joiner = "&" if "?" in src else "?"
        return f'{m.group("pre")}{m.group("q")}{src}{joiner}v={version}{m.group("q")}'

    return SCRIPT_RE.sub(sub, text)


class DevServer(ThreadingHTTPServer):
    """ThreadingHTTPServer that cannot accumulate threads.

    MEASURED, and it is the whole reason this class exists. A page here pulls
    ~1,660 sprite frames per load, and a browser abandons a lot of them on every
    navigation -- each abandoned one raises ConnectionAbortedError out of
    `copyfile`, unwinding a thread that ThreadingHTTPServer, with
    `daemon_threads` at its default False, then JOINS at shutdown and keeps a
    handle on meanwhile. After a few hours of reloads the process had thousands
    of them and had slowed to a crawl:

        long-running devserver.py   2015 ms per 800-byte PNG
        freshly started, same code    17 ms
        plain python -m http.server   19 ms

    That is ~106x, and it read as "the game takes forever to load" or, with the
    canvas still black, as the page failing to boot entirely. It is the server,
    not the assets: the sprites total 0.9 MB across 1,205 files, averaging 800
    bytes each, so per-request cost is the entire story.

    `daemon_threads` lets a finished connection's thread go immediately, and
    `handle_error` below stops a client hanging up mid-file from printing a
    traceback per abandoned request.
    """

    daemon_threads = True

    def handle_error(self, request, client_address):
        """A browser hanging up mid-response is NORMAL here, not an error.

        Navigating away from a page with hundreds of images in flight aborts
        every one of them. The default handler prints a full traceback for each,
        which buries the 404s and errors that actually matter -- the log was
        thousands of ConnectionAbortedError frames and nothing else.
        """
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionAbortedError, ConnectionResetError, BrokenPipeError)):
            return
        super().handle_error(request, client_address)


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_text(self, body: bytes, ctype: str):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        query = self.path.split("?", 1)[1] if "?" in self.path else ""
        version = None
        for part in query.split("&"):
            if part.startswith("v="):
                version = part[2:]

        fs = self.translate_path(path)

        if path.endswith(".html") or path.endswith("/"):
            try:
                with open(fs, "rb") as fh:
                    text = fh.read().decode("utf-8")
            except OSError:
                return super().do_GET()
            # A fresh version per page load: this is what guarantees the whole
            # graph is refetched.
            stamp = str(int(time.time() * 1000))
            self.send_text(version_scripts(text, stamp).encode("utf-8"), "text/html; charset=utf-8")
            return

        if path.endswith(".js") and version:
            try:
                with open(fs, "rb") as fh:
                    text = fh.read().decode("utf-8")
            except OSError:
                return super().do_GET()
            body = version_imports(text, version).encode("utf-8")
            self.send_text(body, "text/javascript; charset=utf-8")
            return

        return super().do_GET()

    def log_message(self, fmt, *args):
        # One line per request is noise; errors still surface via stderr.
        if not args or not str(args[1]).startswith("2"):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    # SERVE THE REPO, NOT THE CALLER'S CWD. The preview pane launches this
    # with its own working directory (the home dir, when the config lives in
    # ~/.claude/launch.json), which would otherwise serve the wrong tree
    # entirely. Running it by hand from the repo root is unaffected.
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    # $PORT first so a launcher that assigns the port (Claude Code's preview
    # pane does) is obeyed; then an explicit argv port; then the default.
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8177))
    print(f"serving with no-store + per-load module versioning on http://localhost:{port}", flush=True)
    DevServer(("", port), NoCacheHandler).serve_forever()
