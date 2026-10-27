import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import net from "net";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno desde .env si existe
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...vals] = trimmed.split("=");
        if (key && vals.length > 0) {
            const val = vals.join("=").trim().replace(/^["']|["']$/g, "");
            if (!process.env[key.trim()]) {
                process.env[key.trim()] = val;
            }
        }
    }
}

// CONFIGURACIÓN DE CONEXIÓN
const RHINO_HOST = process.env.RHINO_HOST || "127.0.0.1";
const RHINO_PORT = parseInt(process.env.RHINO_PORT || "9877", 10);
const BRIDGE_PORT = parseInt(process.env.PORT || "3000", 10);

class RhinoClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.buffer = "";
    }

    async connect() {
        if (this.isConnected && this.client) return true;

        return new Promise((resolve) => {
            this.client = new net.Socket();
            this.client.connect(RHINO_PORT, RHINO_HOST, () => {
                console.log(`[Rhino] Conectado exitosamente al socket de Rhino 8 en ${RHINO_HOST}:${RHINO_PORT}`);
                this.isConnected = true;
                resolve(true);
            });

            this.client.on("error", (err) => {
                this.isConnected = false;
                resolve(false);
            });

            this.client.on("close", () => {
                console.log("[Rhino] Conexión cerrada con Rhino 8");
                this.isConnected = false;
                this.client = null;
            });
        });
    }

    async sendCommand(type, params = {}) {
        const ok = await this.connect();
        if (!ok) {
            return {
                status: "error",
                message: "Rhino 8 no está conectado. Abre Rhino 8 y ejecuta 'rhino_nexus_listener.py' o abre el panel."
            };
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Tiempo de espera agotado esperando respuesta de Rhino 8 (timeout 30s)"));
            }, 30000);

            const onData = (data) => {
                try {
                    const raw = data.toString("utf-8");
                    const lines = raw.split("\n").filter(l => l.trim().length > 0);
                    if (lines.length > 0) {
                        clearTimeout(timeout);
                        this.client.removeListener("data", onData);
                        const response = JSON.parse(lines[0]);
                        resolve(response);
                    }
                } catch (e) {
                    clearTimeout(timeout);
                    this.client.removeListener("data", onData);
                    reject(new Error(`Respuesta inválida de Rhino: ${e.message}`));
                }
            };

            this.client.on("data", onData);
            const requestPayload = JSON.stringify({ type, params }) + "\n";
            this.client.write(requestPayload);
        });
    }
}

const rhino = new RhinoClient();

// EJECUTOR CENTRAL DE HERRAMIENTAS ARQUITECTÓNICAS
async function executeTool(name, args = {}) {
    switch (name) {
        case "execute_python": {
            const response = await rhino.sendCommand("execute_code", { code: args.code });
            if (response.status === "success") {
                return {
                    status: "success",
                    output: response.result?.output || "Código ejecutado con éxito en Rhino 8."
                };
            } else {
                return {
                    status: "error",
                    error: response.error || response.message
                };
            }
        }

        case "setup_architectural_scene": {
            const unitSystem = args.units || "Meters";
            const unitCode = unitSystem === "Meters" ? 4 : (unitSystem === "Millimeters" ? 2 : 3);
            const setupScript = `
import rhinoscriptsyntax as rs
import System.Drawing.Color as Color

rs.UnitSystem(${unitCode}, False, True)

layers = [
    ("01_EJES", (150, 150, 150)),
    ("02_COLUMNAS", (220, 50, 50)),
    ("03_MUROS", (50, 120, 220)),
    ("04_LOSAS", (120, 120, 120)),
    ("05_CUBIERTA", (240, 180, 40)),
    ("06_MOBILIARIO", (80, 180, 80)),
    ("07_TERRENO", (100, 160, 90))
]

for name, color in layers:
    if not rs.IsLayer(name):
        rs.AddLayer(name, Color.FromArgb(*color))

rs.CurrentLayer("02_COLUMNAS")
print("✅ Escena configurada en ${unitSystem} con capas arquitectónicas listas.")
`;
            const response = await rhino.sendCommand("execute_code", { code: setupScript });
            return {
                status: "success",
                output: response.result?.output || `Entorno arquitectónico en ${unitSystem} configurado correctamente.`
            };
        }

        case "create_parametric_pavilion": {
            const L = Number(args.length) || 20.0;
            const W = Number(args.width) || 12.0;
            const H = Number(args.height) || 4.5;
            const amp = Number(args.wave_amplitude) || 1.2;

            const pavilionScript = `
import rhinoscriptsyntax as rs
import math

if not rs.IsLayer("05_CUBIERTA"): rs.AddLayer("05_CUBIERTA")
if not rs.IsLayer("02_COLUMNAS"): rs.AddLayer("02_COLUMNAS")

L, W, H, amp = ${L}, ${W}, ${H}, ${amp}

curves = []
u_steps = 8
for i in range(u_steps + 1):
    x = (float(i) / u_steps) * L
    pts = []
    v_steps = 10
    for j in range(v_steps + 1):
        y = (float(j) / v_steps) * W
        z = H + amp * math.sin(x * 0.4) * math.cos(y * 0.5)
        pts.append((x, y, z))
    crv = rs.AddInterpCurve(pts)
    curves.append(crv)

rs.CurrentLayer("05_CUBIERTA")
roof = rs.AddLoftSrf(curves)
rs.DeleteObjects(curves)

rs.CurrentLayer("02_COLUMNAS")
col_coords = [
    (2.0, 2.0),
    (L - 2.0, 2.0),
    (2.0, W - 2.0),
    (L - 2.0, W - 2.0),
    (L / 2.0, W / 2.0)
]

for cx, cy in col_coords:
    col_z = H + amp * math.sin(cx * 0.4) * math.cos(cy * 0.5)
    plane = rs.PlaneFromNormal((cx, cy, 0), (0, 0, 1))
    col = rs.AddCylinder(plane, col_z, 0.25)

print(f"✅ Pabellón paramétrico generado con éxito ({L}x{W}m, altura {H}m).")
`;
            const response = await rhino.sendCommand("execute_code", { code: pavilionScript });
            return {
                status: "success",
                output: response.result?.output || "Pabellón paramétrico modelado en Rhino."
            };
        }

        case "create_building_massing": {
            const W = Number(args.width) || 25.0;
            const L = Number(args.length) || 35.0;
            const floors = Number(args.floors) || 6;
            const fHeight = Number(args.floor_height) || 3.5;
            const style = args.style || "orthogonal";

            const massingScript = `
import rhinoscriptsyntax as rs

if not rs.IsLayer("03_MUROS"): rs.AddLayer("03_MUROS")
if not rs.IsLayer("04_LOSAS"): rs.AddLayer("04_LOSAS")

W, L, floors, fHeight = ${W}, ${L}, ${floors}, ${fHeight}
total_h = floors * fHeight

pts = [(0, 0, 0), (L, 0, 0), (L, W, 0), (0, W, 0), (0, 0, 0)]
base_crv = rs.AddPolyline(pts)

rs.CurrentLayer("03_MUROS")
mass = rs.ExtrudeCurveStraight(base_crv, (0, 0, 0), (0, 0, total_h))
rs.CapPlanarHoles(mass)

rs.CurrentLayer("04_LOSAS")
for f in range(floors + 1):
    z = f * fHeight
    floor_pts = [(0, 0, z), (L, 0, z), (L, W, z), (0, W, z), (0, 0, z)]
    crv_f = rs.AddPolyline(floor_pts)
    srf = rs.AddPlanarSrf(crv_f)
    rs.DeleteObject(crv_f)

print(f"✅ Volumetría arquitectónica creada ({floors} pisos de {fHeight}m = {total_h}m altura).")
`;
            const response = await rhino.sendCommand("execute_code", { code: massingScript });
            return {
                status: "success",
                output: response.result?.output || `Torre de ${floors} pisos modelada en Rhino.`
            };
        }

        case "get_scene_inventory": {
            const response = await rhino.sendCommand("get_scene_info");
            return {
                status: "success",
                output: JSON.stringify(response.result || response, null, 2)
            };
        }

        case "clear_scene": {
            const response = await rhino.sendCommand("clear_scene");
            return {
                status: "success",
                output: response.result?.message || "Escena limpiada correctamente."
            };
        }

        default:
            throw new Error(`Herramienta '${name}' no reconocida.`);
    }
}

// ============================================================================
// SERVIDOR MCP (Model Context Protocol) PARA CONEXIONES SSE (MCP SuperAssistant)
// ============================================================================
function createMCPServer() {
    const srv = new Server(
        { name: "Nexus-Rhino-Bridge", version: "1.0.0" },
        { capabilities: { tools: {} } }
    );

    srv.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "execute_python",
                    description: "Ejecuta código Python arbitrario en Rhinoceros 8.",
                    inputSchema: {
                        type: "object",
                        properties: { code: { type: "string" } },
                        required: ["code"]
                    }
                },
                {
                    name: "setup_architectural_scene",
                    description: "Configura Rhino 8 para proyecto arquitectónico (metros y capas estándar).",
                    inputSchema: {
                        type: "object",
                        properties: { units: { type: "string", enum: ["Meters", "Millimeters", "Centimeters"], default: "Meters" } }
                    }
                },
                {
                    name: "create_parametric_pavilion",
                    description: "Genera un pabellón ondulado paramétrico.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            length: { type: "number", default: 20 },
                            width: { type: "number", default: 12 },
                            height: { type: "number", default: 4.5 },
                            wave_amplitude: { type: "number", default: 1.2 }
                        }
                    }
                },
                {
                    name: "create_building_massing",
                    description: "Crea un volumen de edificio conceptual con losas.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            width: { type: "number", default: 25 },
                            length: { type: "number", default: 35 },
                            floors: { type: "number", default: 6 },
                            floor_height: { type: "number", default: 3.5 }
                        }
                    }
                },
                {
                    name: "get_scene_inventory",
                    description: "Obtiene información detallada de capas y objetos.",
                    inputSchema: { type: "object", properties: {} }
                },
                {
                    name: "clear_scene",
                    description: "Elimina todos los objetos de la escena de Rhino.",
                    inputSchema: { type: "object", properties: {} }
                }
            ]
        };
    });

    srv.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args = {} } = request.params;
        try {
            const res = await executeTool(name, args);
            if (res.status === "success") {
                return { content: [{ type: "text", text: res.output }] };
            } else {
                return { content: [{ type: "text", text: `Error: ${res.error}` }], isError: true };
            }
        } catch (e) {
            return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
    });

    return srv;
}

// APLICACIÓN EXPRESS (PANEL WEB + REST API + MCP SSE)
const app = express();
app.use(cors());
// express.json solo para rutas /api, NO para /message (SSEServerTransport requiere el stream intacto)
app.use("/api", express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const sseTransports = new Map();

// Endpoint SSE para Clientes MCP (MCP SuperAssistant, Cursor, etc.)
app.get("/sse", async (req, res) => {
    console.log("[Bridge] Nueva conexión SSE entrante desde MCP SuperAssistant / IA...");
    try {
        const mcpServer = createMCPServer();
        const transport = new SSEServerTransport("/message", res);

        await mcpServer.connect(transport);
        sseTransports.set(transport.sessionId, { transport, mcpServer });

        res.on("close", () => {
            console.log(`[Bridge] Conexión SSE cerrada (Sesión: ${transport.sessionId})`);
            sseTransports.delete(transport.sessionId);
        });

        console.log(`✅ [Bridge] Conexión SSE establecida con éxito con MCP SuperAssistant.`);
    } catch (e) {
        console.error("❌ [Bridge] Error al conectar SSE:", e.message);
        res.status(500).send(e.message);
    }
});

app.post("/message", async (req, res) => {
    const sessionId = req.query.sessionId;
    let target = null;

    if (sessionId && sseTransports.has(sessionId)) {
        target = sseTransports.get(sessionId).transport;
    } else if (sseTransports.size > 0) {
        target = Array.from(sseTransports.values()).pop().transport;
    }

    if (target) {
        try {
            await target.handlePostMessage(req, res);
        } catch (e) {
            console.error("❌ [Bridge] Error procesando mensaje POST:", e.message);
            res.status(500).send(e.message);
        }
    } else {
        res.status(400).send("No hay sesión SSE activa.");
    }
});

// REST API para el Panel Web integrado en Rhino
app.get("/api/status", async (req, res) => {
    const isRhinoActive = await rhino.connect();
    res.json({
        status: "ok",
        rhino_socket_connected: isRhinoActive,
        port: BRIDGE_PORT
    });
});

app.post("/api/tools/:toolName", async (req, res) => {
    const { toolName } = req.params;
    const args = req.body || {};
    try {
        const result = await executeTool(toolName, args);
        res.json(result);
    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    }
});

app.post("/api/execute", async (req, res) => {
    const { code } = req.body;
    try {
        const result = await executeTool("execute_python", { code });
        res.json(result);
    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    }
});

// LLM Chat Endpoint (Conecta con Gemini o OpenAI para procesar lenguaje natural)
app.post("/api/chat", async (req, res) => {
    const { prompt, provider = "gemini", apiKey } = req.body;

    if (!prompt) {
        return res.status(400).json({ status: "error", message: "Falta el prompt." });
    }

    let systemPrompt = "";
    try {
        const skillsPath = path.join(__dirname, "SYSTEM_PROMPT_SKILLS.txt");
        if (fs.existsSync(skillsPath)) {
            systemPrompt = fs.readFileSync(skillsPath, "utf-8");
        }
    } catch (e) {}

    try {
        let aiResponseText = "";

        if (provider === "gemini") {
            if (!apiKey) {
                return res.status(400).json({ status: "error", message: "Configura tu API Key de Gemini en Ajustes (⚙️)." });
            }

            const body = {
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
            };

            // Reintentos automáticos con espera para superar picos temporales de alta demanda (503)
            let success = false;
            let lastError = null;
            const maxRetries = 4;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
                    console.log(`[Gemini] Enviando solicitud (intento ${attempt}/${maxRetries})...`);
                    
                    const response = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body)
                    });

                    if (response.ok) {
                        const data = await response.json();
                        aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (aiResponseText) {
                            success = true;
                            console.log(`[Gemini] ¡Respuesta recibida con éxito en el intento ${attempt}!`);
                            break;
                        }
                    } else {
                        const errData = await response.json().catch(() => ({}));
                        lastError = errData.error?.message || `HTTP ${response.status}`;
                        console.warn(`[Gemini intento ${attempt}] Aviso: ${lastError}`);
                        
                        // Si es error de alta demanda (503 / 429), esperar 1.5s antes del siguiente intento
                        if (attempt < maxRetries) {
                            await new Promise(r => setTimeout(r, 1500 * attempt));
                        }
                    }
                } catch (fetchErr) {
                    lastError = fetchErr.message;
                    if (attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 1500 * attempt));
                    }
                }
            }

            if (!success) {
                throw new Error(lastError || "Google Gemini está saturado temporalmente. Puedes usar la web directa de ChatGPT/Gemini con MCP SuperAssistant mientras tanto.");
            }

        } else if (provider === "claude") {
            if (!apiKey) {
                return res.status(400).json({ status: "error", message: "Configura tu API Key de Claude en Ajustes (⚙️)." });
            }

            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01"
                },
                body: JSON.stringify({
                    model: "claude-3-7-sonnet-20250219",
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: [
                        { role: "user", content: prompt }
                    ]
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `Error Claude: ${response.statusText}`);
            }

            const data = await response.json();
            aiResponseText = data.content?.[0]?.text || "";

        } else if (provider === "openai" || provider === "chatgpt") {
            if (!apiKey) {
                return res.status(400).json({ status: "error", message: "Configura tu API Key de OpenAI/ChatGPT en Ajustes (⚙️)." });
            }

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.2
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `Error OpenAI: ${response.statusText}`);
            }

            const data = await response.json();
            aiResponseText = data.choices?.[0]?.message?.content || "";
        } else {
            return res.status(400).json({ status: "error", message: "Proveedor no soportado." });
        }

        // Buscar bloques de código Python en la respuesta para ejecutarlos en Rhino
        const codeBlockRegex = /```(?:python)?\s*([\s\S]*?)```/i;
        const match = aiResponseText.match(codeBlockRegex);

        let executed = false;
        let execOutput = "";

        if (match && match[1]) {
            const pythonCode = match[1].trim();
            console.log("[Bridge] Código Python detectado en respuesta de la IA. Ejecutando en Rhino 8...");
            const execResult = await executeTool("execute_python", { code: pythonCode });
            executed = true;
            execOutput = execResult.output || "";
        }

        res.json({
            status: "success",
            response: aiResponseText,
            executed: executed,
            execution_output: execOutput
        });

    } catch (e) {
        console.error("[Bridge Chat Error]:", e.message);
        res.status(500).json({ status: "error", message: e.message });
    }
});

// INICIAR SERVIDOR
app.listen(BRIDGE_PORT, () => {
    console.log("\n=======================================================");
    console.log("🚀 NEXUS RHINO BRIDGE & WEB PANEL ESTÁN ACTIVOS");
    console.log("=======================================================");
    console.log(`🌐 Panel Web Integrado: http://localhost:${BRIDGE_PORT}`);
    console.log(`📍 Endpoint MCP (SSE): http://localhost:${BRIDGE_PORT}/sse`);
    console.log(`🔍 Diagnóstico:        http://localhost:${BRIDGE_PORT}/api/status`);
    console.log("=======================================================\n");
});
