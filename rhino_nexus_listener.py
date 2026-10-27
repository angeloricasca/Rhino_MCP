"""
Nexus Rhino Bridge - Listener en segundo plano para Rhino 8 (Windows & macOS)
=============================================================================
Este script se ejecuta DENTRO de Rhinoceros 8.
Abre un socket TCP local en el puerto 9877 para recibir comandos desde el
servidor MCP (Node.js) y ejecutarlos en el hilo principal de Rhino de forma segura.

Para iniciar:
1. Abre Rhino 8.
2. Abre el Editor de Python (_ScriptEditor o EditPythonScript).
3. Pega este script y dale al botón de Play / Run (o escribe -_RunPythonScript "ruta/a/este_archivo.py").
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
except ImportError:
    print("[ERROR] Este script debe ejecutarse dentro de Rhinoceros 3D.")
    sys.exit(1)

# Compatibilidad con .NET Action para el hilo de UI de Rhino
try:
    from System import Action
except ImportError:
    Action = None

HOST = "127.0.0.1"
PORT = 9877

class RhinoMCPServer:
    def __init__(self, host=HOST, port=PORT):
        self.host = host
        self.port = port
        self.running = False
        self.server_socket = None
        self.thread = None

    def start(self):
        if self.running:
            print("[Nexus Rhino] El servidor ya se encuentra en ejecución.")
            return

        # Detener servidor previo si existía en sc.sticky
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

            print("=" * 60)
            print("🚀 [Nexus Rhino Bridge] Servidor iniciado correctamente")
            print(f"📍 Escuchando en: {self.host}:{self.port}")
            print("💡 Ya puedes iniciar el puente Node.js y conectar tu IA")
            print("=" * 60)
            Rhino.RhinoApp.WriteLine(f"[Nexus Rhino Bridge] Conectado en puerto {self.port} ✅")

        except Exception as e:
            print(f"[Nexus Rhino] Error al iniciar socket en puerto {self.port}: {e}")
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
        print("[Nexus Rhino] Servidor detenido.")
        Rhino.RhinoApp.WriteLine("[Nexus Rhino Bridge] Servidor detenido 🛑")

    def _listen_loop(self):
        while self.running:
            try:
                try:
                    client, addr = self.server_socket.accept()
                except socket.timeout:
                    continue
                except Exception:
                    break

                # Manejar cliente en hilo separado
                client_thread = threading.Thread(target=self._handle_client, args=(client,))
                client_thread.daemon = True
                client_thread.start()

            except Exception as e:
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

                # Procesar mensajes delimitados por salto de línea o buffers JSON completos
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

        except Exception as e:
            pass
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
                "rhino_version": str(Rhino.RhinoApp.Version),
                "document": sc.doc.Name if sc.doc else "Sin título"
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
        """Ejecuta código Python en el hilo principal de Rhino para garantizar refresco de vista"""
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
                "__name__": "__main__",
                "__doc__": None
            }

            try:
                exec(code, local_scope)
            except Exception as ex:
                res_container["error"] = traceback.format_exc()
            finally:
                sys.stdout = old_stdout
                sys.stderr = old_stderr

            # Forzar actualización de la vista 3D
            try:
                sc.doc.Views.Redraw()
                Rhino.RhinoApp.Wait()
            except Exception:
                pass

            res_container["output"] = capture.getvalue()

        # Invocar en hilo de UI si está disponible en Rhino .NET
        if Action and hasattr(Rhino.RhinoApp, "InvokeOnUiThread"):
            Rhino.RhinoApp.InvokeOnUiThread(Action(run_code))
        else:
            run_code()

        if res_container["error"]:
            return {
                "status": "error",
                "error": res_container["error"],
                "output": res_container["output"]
            }
        else:
            return {
                "status": "success",
                "result": {
                    "output": res_container["output"] or "Código ejecutado correctamente en Rhino 8."
                }
            }

    def _get_scene_info(self):
        """Obtiene información arquitectónica de la escena actual"""
        res = {}
        def get_info():
            try:
                layers = rs.LayerNames() or []
                obj_count = len(rs.AllObjects() or [])
                units = rs.UnitSystemName(abbreviate=False) or "Meters"
                layer_data = []
                for l in layers:
                    objs = rs.ObjectsByLayer(l) or []
                    layer_data.append({
                        "name": l,
                        "objects_count": len(objs),
                        "visible": rs.IsLayerVisible(l),
                        "color": rs.LayerColor(l)
                    })
                res["data"] = {
                    "document_name": sc.doc.Name or "Sin Título",
                    "units": units,
                    "total_objects": obj_count,
                    "layers": layer_data
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
        """Limpia todos los objetos geométricos visibles en el documento"""
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
        return {
            "status": "success",
            "result": {
                "message": f"Escena limpiada con éxito. Se eliminaron {res['deleted']} objetos.",
                "deleted_count": res["deleted"]
            }
        }


# Función para iniciar fácilmente desde consola o botón
def start():
    server = RhinoMCPServer()
    server.start()

def stop():
    prev = sc.sticky.get("rhino_nexus_server")
    if prev:
        prev.stop()
    else:
        print("[Nexus Rhino] No hay ningún servidor activo registrado.")

# Auto-ejecución al correr el script
if __name__ == "__main__" or __name__ == "<module>":
    start()
