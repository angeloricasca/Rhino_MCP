# Rhino_MCP

Puente de Model Context Protocol (MCP) para conectar modelos de inteligencia artificial (ChatGPT, Gemini, Claude) a traves de la extension **MCP SuperAssistant** directamente con **Rhinoceros 8** (Windows y macOS) para generacion y control de geometria 3D en tiempo real.

---

## Flujo de Trabajo

1. El usuario interactua en la pagina web de su IA preferida (ChatGPT, Google Gemini o Claude).
2. La extension de navegador **MCP SuperAssistant** se comunica mediante Server-Sent Events (SSE) con el servidor local Node.js.
3. El servidor traduce las herramientas MCP a comandos de socket TCP.
4. Rhinoceros 8 recibe las instrucciones en su hilo principal de interfaz y genera la geometria en el documento activo.

---

## Requisitos Previos

- **Rhinoceros 8** instalado (Windows o macOS).
- **Node.js** v18 o superior.
- Navegador Google Chrome con la extension **MCP SuperAssistant** instalada.

---

## Instalacion y Configuracion

### 1. Clonar el repositorio e instalar dependencias

```bash
git clone https://github.com/angeloricasca/Rhino_MCP.git
cd Rhino_MCP
npm install
```

### 2. Variables de Entorno (.env)

Copia el archivo de ejemplo para generar tu archivo de configuracion local:

```bash
cp .env.example .env
```

Contenido del archivo `.env`:

```ini
PORT=3000
RHINO_HOST=127.0.0.1
RHINO_PORT=9877
```

- `PORT`: Puerto donde se expone el servidor SSE para MCP SuperAssistant (por defecto: 3000).
- `RHINO_HOST`: Direccion del listener local de Rhino (por defecto: 127.0.0.1).
- `RHINO_PORT`: Puerto del socket de escucha de Rhino 8 (por defecto: 9877).

---

## Guia de Inicio Rapido (Setup)

### Paso 1: Iniciar el receptor en Rhinoceros 8

1. Abre **Rhinoceros 8**.
2. En la barra de comandos de Rhino, escribe `_ScriptEditor` (o `EditPythonScript`).
3. Abre el archivo `rhino_panel.py` (o `rhino_nexus_listener.py`) y presiona el boton **Play / Run**.
4. Verifica la salida en la consola de comandos de Rhino:
   - Estado esperado: `[AI Architect] Listener activo en puerto 9877 ✅`
   - Si no se ejecuta: `Rhino no responde ❌`

---

### Paso 2: Iniciar el servidor puente

- **En macOS:**
  Haz doble clic en `start_mac.command` o ejecuta en la terminal:
  ```bash
  npm start
  ```

- **En Windows:**
  Haz doble clic en `START_NEXUS_RHINO.bat` o ejecuta en la terminal:
  ```cmd
  npm start
  ```

Salida esperada en consola:
```text
[Rhino] Conectado exitosamente al socket de Rhino 8 en 127.0.0.1:9877 ✅
NEXUS RHINO BRIDGE & MCP SERVER ESTAN ACTIVOS
Endpoint MCP (SSE): http://localhost:3000/sse
```

---

### Paso 3: Conectar MCP SuperAssistant en el navegador

1. Abre [ChatGPT](https://chatgpt.com), [Google Gemini](https://gemini.google.com) o [Claude](https://claude.ai) en Google Chrome.
2. Abre la ventana de la extension **MCP SuperAssistant**:
   - Ingresa en la seccion de Settings.
   - Configura el puerto del servidor en `3000` (URL: `http://localhost:3000/sse`).
   - Presiona el boton **Save & Reconnect**.
3. Confirma el estado de conexion:
   - Conexion correcta: `Server Connected ✅`
   - Herramientas detectadas: `Available Tools: 6 of 6 tools enabled ✅`
   - Si dice desconectado: `Server Disconnected ❌` (Revisar que el servidor de Node este en ejecucion).
4. En el chat de la IA, presiona el boton **Attach** para inyectar el contexto de herramientas.
5. Escribe tu solicitud de modelado en lenguaje natural:
   > *"Configura la escena con unidades en metros y crea una torre parametrica de 8 pisos con losas cada 3.5 metros."*

El modelo aparecera automaticamente en el viewport de Rhino 8.

---

## Herramientas MCP Disponibles

| Herramienta | Descripcion |
| :--- | :--- |
| `execute_python` | Ejecuta codigo Python arbitrario en Rhino 8 mediante `rhinoscriptsyntax` y `RhinoCommon`. |
| `setup_architectural_scene` | Establece unidades en metros y genera capas estandar (`01_EJES`, `02_COLUMNAS`, `03_MUROS`, `04_LOSAS`, `05_CUBIERTA`, `06_MOBILIARIO`). |
| `create_parametric_pavilion` | Genera una cubierta ondulada parametrica con columnas cilindricas. |
| `create_building_massing` | Modela una volumetria conceptual con niveles y losas interiores. |
| `get_scene_inventory` | Retorna el reporte de capas, objetos y unidades del modelo activo. |
| `clear_scene` | Elimina los objetos visibles en la escena para iniciar un nuevo proyecto. |

---

## Diagnostico y Solucion de Problemas

- **Problema:** MCP SuperAssistant muestra `Server Disconnected ❌`.
  - **Solucion:** Comprueba que la terminal de `start_mac.command` (o `npm start`) continue abierta y que el puerto configurado en la extension sea 3000. Presiona el boton de refrescar en la extension.

- **Problema:** La extension conecta pero no dibuja geometria en Rhino `❌`.
  - **Solucion:** Asegurate de haber ejecutado `rhino_panel.py` en Rhino antes de enviar el comando. En la terminal del servidor debe figurar `[Rhino] Conectado exitosamente ✅`.

- **Problema:** Conflicto de puerto (`Address already in use: 3000` `❌`).
  - **Solucion:** El script `start_mac.command` libera automaticamente cualquier proceso huerfano en el puerto 3000 antes de iniciar.
