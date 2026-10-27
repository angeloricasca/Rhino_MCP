# Rhino_MCP

Controla y genera modelos 3D en **Rhinoceros 8** directamente desde tu navegador web usando **ChatGPT**, **Google Gemini** o **Claude**, sin escribir codigo ni abrir terminales complejas.

---

## Que necesitas antes de empezar

1. Tener **Rhinoceros 8** instalado en tu computadora (Windows o Mac).
2. Tener **Node.js** instalado (descargalo gratis desde [nodejs.org](https://nodejs.org/)).
3. Tener **Google Chrome** con la extension **MCP SuperAssistant** instalada:
   - Descarga la extension gratis desde la Chrome Web Store buscando "MCP SuperAssistant" (o en [mcpsuperassistant.ai](https://mcpsuperassistant.ai/)).

---

## Instalacion Inicial (Solo se hace una vez)

Abre tu terminal, pega estas tres lineas y presiona Enter:

```bash
git clone https://github.com/angeloricasca/Rhino_MCP.git
cd Rhino_MCP
npm install
```

*(Todo viene preconfigurado con valores por defecto listos para usar sin necesidad de configurar archivos adicionales).*

---

## Como Usar el Programa (Guia en 3 Pasos)

### Paso 1: Activar el receptor dentro de Rhino 8

1. Abre tu programa **Rhino 8**.
2. En la barra superior de comandos de Rhino, escribe:
   ```text
   _ScriptEditor
   ```
3. En la ventana que se abre, ve a **Archivo > Abrir** y selecciona el archivo `rhino_panel.py` (o `rhino_nexus_listener.py`) dentro de la carpeta descargada.
4. Presiona el boton verde de **Play / Run**.
5. Verifica la linea de comandos de Rhino:
   - Resultado esperado: `[AI Architect] Listener activo en puerto 9877 ✅`
   - Si no aparece: `Rhino no responde ❌` (cierra y vuelve a presionar Play).

*(Deja Rhino abierto y continua al paso 2).*

---

### Paso 2: Iniciar el puente de conexion

Ve a la carpeta del proyecto en tu computadora:

- **Si usas Mac:** Haz doble clic sobre el archivo `start_mac.command`.
- **Si usas Windows:** Haz doble clic sobre el archivo `START_NEXUS_RHINO.bat`.

Se abrira una ventana que se mantendra abierta. Observa el texto en la ventana:
- Resultado esperado: `[Rhino] Conectado exitosamente al socket de Rhino 8 en 127.0.0.1:9877 ✅`
- Si no conecta: `No se pudo conectar a Rhino ❌` (asegurate de haber completado el Paso 1 en Rhino primero).

*(Deja esa ventana abierta mientras estes usando la IA).*

---

### Paso 3: Conectar la IA en tu navegador

1. Abre tu navegador Chrome y entra a tu IA habitual: [ChatGPT](https://chatgpt.com), [Google Gemini](https://gemini.google.com) o [Claude](https://claude.ai).
2. Abre la ventana de la extension **MCP SuperAssistant**:
   - Haz clic en la seccion de Settings (icono de engranaje).
   - Asegurate de que el puerto sea `3000`.
   - Haz clic en el boton **Save & Reconnect**.
3. Confirma el estado en la extension:
   - Estado correcto: `Server Connected ✅`
   - Herramientas detectadas: `Available Tools: 6 of 6 tools enabled ✅`
   - Si no conecta: `Server Disconnected ❌` (verifica que la ventana del Paso 2 continue abierta).

---

## Como Crear Modelos 3D

Tienes dos formas faciles de usarlo:

### Forma A: Escribiendo en el Chat (Recomendado)
1. En la caja de texto donde hablas con ChatGPT o Gemini, haz clic en el boton **MCP** y luego en **Attach**.
2. Escribe lo que deseas disenar en espanol normal. Por ejemplo:
   > *"Configura la escena en metros y genera un pabellon parametrico ondulado con columnas de 4 metros."*
3. La IA pensara unos segundos y la geometria aparecera directamente en la pantalla de Rhino 8.

### Forma B: Ejecutar herramientas con un solo clic
Dentro de la ventana de la extension **MCP SuperAssistant**, ve a la seccion **Available Tools**. Veras la lista de acciones disponibles con un boton llamado **Run**:

| Herramienta | Que hace al presionar Run |
| :--- | :--- |
| `setup_architectural_scene` | Cambia las unidades a metros y crea las capas de arquitectura con colores CAD. |
| `create_parametric_pavilion` | Genera una cubierta ondulada con sus columnas estructurales. |
| `create_building_massing` | Crea una torre volumetrica con todas sus losas de entrepiso. |
| `get_scene_inventory` | Te muestra una lista con todas las capas y objetos actuales de tu modelo. |
| `clear_scene` | Borra todo el modelo actual para empezar uno nuevo en blanco. |
| `execute_python` | Permite a la IA escribir cualquier codigo personalizado para geometrias complejas. |

---

## Que hacer si algo no funciona

- **El texto dice `Server Disconnected ❌`:**
  Asegurate de no haber cerrado la ventana del Paso 2 (`start_mac.command` o `START_NEXUS_RHINO.bat`). Luego presiona el boton de refrescar en la extension.

- **La IA responde en la web pero no dibuja nada en Rhino `❌`:**
  Asegurate de haber ejecutado el Paso 1 dentro de Rhino antes de pedirle el diseno a la IA. En la ventana del Paso 2 debe decir `Conectado exitosamente ✅`.

- **Aparece un error de puerto ocupado `❌`:**
  Cierra cualquier ventana negra que haya quedado abierta anteriormente y vuelve a hacer doble clic en `start_mac.command` o `START_NEXUS_RHINO.bat`.
