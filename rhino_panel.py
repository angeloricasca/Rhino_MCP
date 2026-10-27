"""
AI Architect - Panel Nativo Integrado para Rhinoceros 8 (Windows & macOS)
========================================================================
Este script se ejecuta dentro de Rhino 8.
1. Inicia en segundo plano el listener TCP (puerto 9877) para ejecutar geometría de forma segura.
2. Abre la ventana/panel nativo 'AI Architect' embebido con Eto.Forms.WebView
   conectado al servidor local (http://localhost:3000).

Para usar:
- Escribe _ScriptEditor en Rhino 8 y ejecuta este archivo, o escribe:
  -_RunPythonScript "/Users/angeloricasca/Server/Rhino/prototype_01/rhino_panel.py"
"""

import socket
import threading
import json
import sys
import io
import traceback
import time

try:
    import Rhino
    import rhinoscriptsyntax as rs
    import scriptcontext as sc
    import Eto.Forms as forms
    import Eto.Drawing as drawing
    import System
except ImportError:
    print("[ERROR] Este script debe ejecutarse dentro de Rhinoceros 8.")
    sys.exit(1)

try:
    from System import Action
except ImportError:
    Action = None

HOST = "127.0.0.1"
PORT = 9877
WEB_PANEL_URL = "http://localhost:3000"

# ============================================================================
# 1. SERVIDOR SOCKET LOCAL EN SEGUNDO PLANO
# ============================================================================
class RhinoMCPServer:
    def __init__(self, host=HOST, port=PORT):
        self.host = host
        self.port = port
        self.running = False
        self.server_socket = None
        self.thread = None

    def start(self):
        if self.running:
            return

        prev = sc.sticky.get("rhino_nexus_server")
        if prev and prev != self:
            try:
                prev.stop()
            except Exception:
                pass

        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(5)
            self.server_socket.settimeout(1.0)
            self.running = True

            sc.sticky["rhino_nexus_server"] = self

            self.thread = threading.Thread(target=self._listen_loop)
            self.thread.daemon = True
            self.thread.start()

            Rhino.RhinoApp.WriteLine(f"[AI Architect] Listener activo en puerto {self.port} ✅")

        except Exception as e:
            Rhino.RhinoApp.WriteLine(f"[AI Architect] Error socket: {e}")
            self.stop()

    def stop(self):
        self.running = False
        if self.server_socket:
            try:
                self.server_socket.close()
            except Exception:
                pass
            self.server_socket = None
        sc.sticky["rhino_nexus_server"] = None

    def _listen_loop(self):
        while self.running:
            try:
                try:
                    client, addr = self.server_socket.accept()
                except socket.timeout:
                    continue
                except Exception:
                    break

                client_thread = threading.Thread(target=self._handle_client, args=(client,))
                client_thread.daemon = True
                client_thread.start()

            except Exception:
                if not self.running:
                    break
                time.sleep(0.1)

    def _handle_client(self, client):
        client.settimeout(None)
        buffer = b""

        try:
            while self.running:
                chunk = client.recv(16384)
                if not chunk:
                    break

                buffer += chunk

                while b"\n" in buffer:
                    line, buffer = buffer.split(b"\n", 1)
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        cmd = json.loads(line.decode("utf-8"))
                        response = self._dispatch_command(cmd)
                        resp_bytes = (json.dumps(response) + "\n").encode("utf-8")
                        client.sendall(resp_bytes)
                    except json.JSONDecodeError as jde:
                        err_resp = {"status": "error", "message": f"JSON inválido: {jde}"}
                        client.sendall((json.dumps(err_resp) + "\n").encode("utf-8"))
                    except Exception as cmd_err:
                        err_resp = {"status": "error", "message": f"Error ejecutando comando: {cmd_err}"}
                        client.sendall((json.dumps(err_resp) + "\n").encode("utf-8"))

        except Exception as e:
            print(f"[AI Architect Socket Handler Error]: {traceback.format_exc()}")
        finally:
            try:
                client.close()
            except Exception:
                pass

    def _dispatch_command(self, cmd):
        cmd_type = cmd.get("type", "")
        params = cmd.get("params", {})

        if cmd_type == "ping":
            return {
                "status": "success",
                "result": "pong",
                "rhino_version": str(Rhino.RhinoApp.Version)
            }
        elif cmd_type == "execute_code":
            code = params.get("code", "")
            return self._execute_python_code(code)
        elif cmd_type == "get_scene_info":
            return self._get_scene_info()
        elif cmd_type == "clear_scene":
            return self._clear_scene()
        else:
            return {"status": "error", "message": f"Comando no reconocido: '{cmd_type}'"}

    def _execute_python_code(self, code):
        capture = io.StringIO()
        res_container = {"output": "", "error": None}

        def run_code():
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            sys.stdout = capture
            sys.stderr = capture

            local_scope = {
                "rs": rs,
                "Rhino": Rhino,
                "sc": sc,
                "__name__": "__main__"
            }

            try:
                exec(code, local_scope)
            except Exception:
                res_container["error"] = traceback.format_exc()
            finally:
                sys.stdout = old_stdout
                sys.stderr = old_stderr

            try:
                sc.doc.Views.Redraw()
                Rhino.RhinoApp.Wait()
            except Exception:
                pass

            res_container["output"] = capture.getvalue()

        if Action and hasattr(Rhino.RhinoApp, "InvokeOnUiThread"):
            Rhino.RhinoApp.InvokeOnUiThread(Action(run_code))
        else:
            run_code()

        if res_container["error"]:
            return {"status": "error", "error": res_container["error"], "output": res_container["output"]}
        else:
            return {"status": "success", "result": {"output": res_container["output"] or "Geometría creada con éxito."}}

    def _get_scene_info(self):
        res = {}
        def get_info():
            try:
                layers = rs.LayerNames() or []
                obj_count = len(rs.AllObjects() or [])
                units = rs.UnitSystemName(abbreviate=False) or "Meters"
                res["data"] = {
                    "document_name": sc.doc.Name or "Sin Título",
                    "units": units,
                    "total_objects": obj_count,
                    "layers": layers
                }
            except Exception as e:
                res["error"] = str(e)

        if Action and hasattr(Rhino.RhinoApp, "InvokeOnUiThread"):
            Rhino.RhinoApp.InvokeOnUiThread(Action(get_info))
        else:
            get_info()

        if "error" in res:
            return {"status": "error", "message": res["error"]}
        return {"status": "success", "result": res.get("data", {})}

    def _clear_scene(self):
        res = {"deleted": 0}
        def do_clear():
            try:
                all_objs = rs.AllObjects() or []
                if all_objs:
                    rs.DeleteObjects(all_objs)
                sc.doc.Views.Redraw()
                res["deleted"] = len(all_objs)
            except Exception as e:
                res["error"] = str(e)

        if Action and hasattr(Rhino.RhinoApp, "InvokeOnUiThread"):
            Rhino.RhinoApp.InvokeOnUiThread(Action(do_clear))
        else:
            do_clear()

        if "error" in res:
            return {"status": "error", "message": res["error"]}
        return {"status": "success", "result": {"message": f"Escena limpiada. Se eliminaron {res['deleted']} objetos."}}


# ============================================================================
# 2. PANEL NATIVO ETO.FORMS CON WEBVIEW
# ============================================================================
class RhinoAIWindow(forms.Form):
    def __init__(self):
        super(RhinoAIWindow, self).__init__()
        self.Title = "🏛️ AI Architect - Rhino 8"
        self.ClientSize = drawing.Size(420, 700)
        self.MinimumSize = drawing.Size(320, 480)
        self.Padding = drawing.Padding(0)
        self.Topmost = True
        self.ShowInTaskbar = True

        # Vincular con la ventana principal de Rhino
        try:
            if hasattr(Rhino.UI.RhinoEtoApp, "MainWindow"):
                self.Owner = Rhino.UI.RhinoEtoApp.MainWindow
        except Exception as e:
            pass

        # Control WebView que carga el panel de Node.js
        try:
            self.webview = forms.WebView()
            self.webview.Url = System.Uri(WEB_PANEL_URL)
            self.Content = self.webview
        except Exception as e:
            layout = forms.DynamicLayout()
            layout.Add(forms.Label(Text=f"No se pudo cargar WebView: {e}\nVisita: {WEB_PANEL_URL}"))
            self.Content = layout

        self.Closed += self.OnFormClosed

    def OnFormClosed(self, sender, e):
        sc.sticky["rhino_ai_window"] = None


def open_panel():
    # 1. Asegurar que el socket listener esté activo
    server = RhinoMCPServer()
    server.start()

    # 2. En Rhino 8, las ventanas de interfaz en macOS DEBEN crearse en el hilo principal de UI
    def _create_and_show():
        try:
            existing = sc.sticky.get("rhino_ai_window")
            if existing:
                try:
                    existing.BringToFront()
                    existing.Focus()
                    Rhino.RhinoApp.WriteLine("[AI Architect] Panel ya está abierto y traído al frente.")
                    return
                except Exception:
                    sc.sticky["rhino_ai_window"] = None

            window = RhinoAIWindow()
            sc.sticky["rhino_ai_window"] = window
            window.Show()
            Rhino.RhinoApp.WriteLine("[AI Architect] ¡Panel integrado abierto con éxito! ✨")
        except Exception as err:
            Rhino.RhinoApp.WriteLine(f"[AI Architect] Error al abrir ventana: {err}")
            print(f"[AI Architect Error]: {traceback.format_exc()}")

    # Invocar siempre en el hilo de UI de Rhino para evitar que macOS AppKit descarte la ventana
    if Action and hasattr(Rhino.RhinoApp, "InvokeOnUiThread"):
        Rhino.RhinoApp.InvokeOnUiThread(Action(_create_and_show))
    else:
        _create_and_show()


if __name__ == "__main__" or __name__ == "<module>":
    open_panel()
