// The browser build's engine: Pyodide (Python in WebAssembly) running sim.web.api in a worker,
// so the bots think without freezing the page. pyodide.js talks to it.
"use strict";

importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js");

const ready = (async () => {
  const py = await loadPyodide();
  const zip = await fetch("retcon.zip?v=" + self.name).then((r) => {
    if (!r.ok) throw new Error("couldn't load retcon.zip");
    return r.arrayBuffer();
  });
  py.unpackArchive(zip, "zip", { extractDir: "/retcon" });
  py.runPython(`
import json, sys
from pathlib import Path
sys.path.insert(0, "/retcon")
from sim.web.api import handle

HOLDER = {"game": None}

def call(path, body):
    code, data = handle(HOLDER, path, None if body is None else json.loads(body), "/games")
    saved = data.get("saved") if isinstance(data, dict) else None
    if saved:                            # no folder to save to here: hand the log to the page
        data["saved_text"] = Path(saved).read_text(encoding="utf-8")
        data["saved"] = Path(saved).name
    return json.dumps({"code": code, "data": data})
`);
  return py.globals.get("call");
})();

self.onmessage = async (e) => {
  const { id, path, body } = e.data;
  try {
    const call = await ready;
    const out = JSON.parse(call(path, body === undefined ? null : JSON.stringify(body)));
    self.postMessage({ id, ...out });
  } catch (err) {
    self.postMessage({ id, code: 500, data: { error: String(err.message || err) } });
  }
};
