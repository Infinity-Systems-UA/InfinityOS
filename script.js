setInterval(updateTime, 500);

let currentStrings = {};
let currentLang = 'en';
let dateLang = "en-US";
let currentKeyboardLayout = "mac";
let displayType = "oled";
let notificationAPI;
let apps = [];
let icons = [];
let desktopIcons = JSON.parse(localStorage.getItem('desktopIcons')) || [];
function detectMobile() {
    // 1. Modern Client Hints API (Chrome/Edge/Opera)
    if (navigator.userAgentData && navigator.userAgentData.mobile) {
        return true;
    }

    // 2. Touch Screen Pointer Check (iOS/Android/Tablets)
    if (window.matchMedia("(pointer: coarse)").matches) {
        return true;
    }

    // 3. Screen Width Threshold (Responsive Design Fallback)
    if (window.innerWidth <= 768) {
        return true;
    }

    // 4. Legacy User-Agent Regex Sniffing (Old Browsers)
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
        return true;
    }

    // Default to desktop if all checks pass
    return false;
}



let enableHotCorners = JSON.parse(localStorage.getItem("enableHotCorners") )|| false;
let cleanOnBoot = JSON.parse(localStorage.getItem("cleanOnBoot") ) || true; // Чистить пусті ключі диску конфігурацій при запуску.



let localeFormat = JSON.parse(localStorage.getItem("localeFormat")) || { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
let permissions = JSON.parse(localStorage.getItem("permissions") ) || {}
let allowScreenTime = JSON.parse(localStorage.getItem("allowScreenTime") )|| false;
let bgClock = JSON.parse(localStorage.getItem('backgroundClock')) ?? false;
let hideWinContentOnTransform = JSON.parse(localStorage.getItem("hideWinContentOnTransform") )|| false;
let styles;
let wbtheme; // Class name
const devices = [];
window.systemWorkers = []; // Реєстр для resmon

let filesSettings = JSON.parse(localStorage.getItem("config/files")) || { "filesCols": [], "showHidden": true };
let filesCols = filesSettings.filesCols || [];
let filesShowHidden = filesSettings.showHidden || false;

let currentDisk = null;



function movePanelWidg(w1,w2){
  itemToMove = document.getElementById(w1);
  referenceItem = document.getElementById(w2)
  container = document.querySelector('#panel .right');
  container.moveBefore(itemToMove, referenceItem);
}

let fonts = {active: '', installed: []};
const coreFonts = [ "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong"]
window.updateFonts = function(action, fontName) {
  try{
    if (action === 'add') {
        if (!fonts.installed.includes(fontName)) {
            fonts.installed.push(fontName);
        }
    } else if (action === 'delete') {
        fonts.installed = fonts.installed.filter(f => f !== fontName);
        if (fonts.active === fontName) fonts.active = "";
    } else if (action === 'set') {
        fonts.active = fontName;
    }

    localStorage.setItem("fonts", JSON.stringify(fonts));

    console.log(`Fonts updated:`, fonts);
  }catch (e){
    console.error(e.message)
  }
    

    
    setupFonts(); 
};
function getElementXPath(element) {
    if (element.id !== '') {
        return `//*[@id="${element.id}"]`;
    }
    if (element === document.body) {
        return '/html/body';
    }

    let ix = 0;
    const siblings = element.parentNode.childNodes;
    
    for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling === element) {
            return getElementXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
        }
    }
}
window.styles = '';

function applySystemConfig(iframeElement0) {
  if (!iframeElement0) return;
  
  // Перевірка: якщо це системне вікно файлового менеджера, скрипти не інжектуємо
  const shouldInjectScript = !iframeElement0.startsWith("fileWinBox-frame");

  const windowContainer = document.getElementById(iframeElement0);
  
  if (!windowContainer) return console.warn(`IFrame of app window with ID ${iframeElement0} not found.`);
  const themeColors = window.styles; 

  const iframeElement = windowContainer.querySelector("iframe");
  if (!iframeElement) return console.warn("No IFrame");
  PowerManager.startTracking(iframeElement);

  // --- СИНХРОННА ГЕНЕРАЦІЯ ШРИФТІВ І СТИЛІВ ---
// --- СИНХРОННА ГЕНЕРАЦІЯ ШРИФТІВ І СТИЛІВ ---
  const generateCssContent = () => {
    const activeFont = fonts.active || "sans-serif";

    let cssVariables = '';
    if (themeColors){
      for (const [key, value] of Object.entries(themeColors)) {
        if (value !== undefined && value !== null) {
          cssVariables += `  ${key}: ${value};\n`;
        }
      }
    }

    // Збираємо блок системних стилей
    let stylesText = `
      :root {
        --font: "${activeFont}", sans-serif;
      ${cssVariables}
      }
      
      /* Застосовуємо системний шрифт до всього */
      /* Default font for everything */
.use-app-font,
.use-app-font::before,
.use-app-font::after {
    font-family: var(--font);
}



/* Skip custom font */
.no-font,
.no-font * {
    font-family: inherit !important;
}


      * {
        -webkit-tap-highlight-color: transparent;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0); 
      }
      ::selection {
        background-color: var(--color-selection, blue);
        color: var(--color-selection-text) !important;
        filter: invert(100%);
      }
      ::-webkit-selection {
        background-color: var(--color-selection, blue) !important;
        color: var(--color-selection-text) !important;
      }

      input[type="color"] {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-color: transparent;
        cursor: pointer;
      }

      input[type="color"]::-webkit-color-swatch-wrapper {
        padding: 0;
      }

      img, a {
        -webkit-touch-callout: none;
      }
    `;
    
    // 1. Інжект активного системного шрифту
    if (window.currentFontBlobUrl) {
      stylesText = `
        @font-face {
          font-family: "${activeFont}";
          src: url("${window.currentFontBlobUrl}") format("truetype");
        }
      ` + stylesText;
    }

    // 2. Додаємо згенеровані динамічні шрифти з Infinity OS filesystem
    if (window.generatedFontFaceCSS) {
      stylesText = window.generatedFontFaceCSS + stylesText;
    }

    // 3. НОВЕ/СТАРЕ: Додатковий кеш, якщо є
    if (window.installedFontsCache) {
      let installedFontsCss = "";
      for (const [fontName, fontUrl] of Object.entries(window.installedFontsCache)) {
        if (fontName === activeFont) continue; 
        
        let format = "truetype";
        if (fontName.endsWith(".woff")) format = "woff";
        if (fontName.endsWith(".woff2")) format = "woff2";
        if (fontName.endsWith(".otf")) format = "opentype";

        const cleanFontFamily = fontName.split('.')[0];

        installedFontsCss += `
          @font-face {
            font-family: "${cleanFontFamily}";
            src: url("${fontUrl}") format("${format}");
          }
        `;
      }
      stylesText = installedFontsCss + stylesText;
    }

    return stylesText;
  };

  // Функція для інжекту системного JS всередину додатка
  const injectSystemScript = (iframeDoc) => {
    if (!shouldInjectScript) return;

    let scriptTag = iframeDoc.getElementById("infinity-os-script-injector");
    if (!scriptTag) {
      scriptTag = iframeDoc.createElement("script");
      scriptTag.id = "infinity-os-script-injector";
      
      // Скрипт, який виконуватиметься в контексті самого iframe
      scriptTag.textContent = `
fetch = (...a) => parent.fetch(...a);
        document.querySelectorAll('[title]').forEach(e => {
    parent.updateSystemPopover(e, e.title, true, true);
        parent.console.log("[Popover REG] PICK EL w/ TITLE.")
    });

document.querySelectorAll("*").forEach(el => {
    let p = el;
    while (p) {
        const tag = p.tagName?.toLowerCase() || "";
        const cls = p.className || "";

if (
    p.hasAttribute("has-trailing-icon") ||
    p.hasAttribute("trailing-icon")
) {
    return;
}

        if (
            tag === "i" ||
            tag.includes("icon") ||
            /\b(ic|icon|fa|fas|far|fab|fal|fat|fad|codicon)\b/.test(cls) ||
            /(icon-|fa-|codicon|material-icons|material-symbols)/.test(cls)
        ) {
            return; // Skip this element and everything inside it
        }

        p = p.parentElement;
    }

    el.classList.add("use-app-font");
});
      `;
      iframeDoc.head.appendChild(scriptTag);
    }
  };

  // Внутрішня функція безпосереднього нанесення контенту стилей та скриптів в DOM iframe
  const applyToIframe = (iframeDoc) => {
    iframeDoc.body.classList = document.body.classList;
    
    let styleTag = iframeDoc.getElementById("infinity-os-injector") || iframeDoc.getElementById("infinity-os-font-injector");
    if (!styleTag) {
      styleTag = iframeDoc.createElement("style");
      styleTag.id = "infinity-os-injector";
      iframeDoc.head.appendChild(styleTag);
    }
    styleTag.textContent = generateCssContent();
    injectSystemScript(iframeDoc);
  };


// --- ГОЛОВНИЙ АСИНХРОННИЙ МЕТОД ЗАВАНТАЖЕННЯ ШРИФТІВ ---
  const prepareAndApply = async () => {

    // Get fonts to load: exclude core fonts from filesystem search
    const fontsToLoad = (fonts.installed || []).filter(fontName => !coreFonts.includes(fontName));

    // Build font-face CSS by reading files one by one
    let fontFaceCSS = "";
    
    for (const fontName of fontsToLoad) {
      const fontFile = fs.find(f => f.name === fontName);
      
      if (fontFile && (fontFile instanceof Blob || fontFile instanceof File)) {
        try {
          // Create blob URL for this font
          const fontUrl = URL.createObjectURL(fontFile);
          
          // Determine format based on file extension
          let format = "truetype";
          if (fontName.endsWith(".woff")) format = "woff";
          else if (fontName.endsWith(".woff2")) format = "woff2";
          else if (fontName.endsWith(".otf")) format = "opentype";
          
          // Clean font name (e.g., "Roboto.ttf" -> "Roboto")
          const cleanFontFamily = fontName.split('.')[0];
          
          fontFaceCSS += `
          @font-face {
            font-family: "${cleanFontFamily}";
            src: url("${fontUrl}") format("${format}");
          }
        `;
          console.log(`Application is using system-wide font: "${fontName}"`);
        } catch (e) {
          console.warn(`Failed to load font "${fontName}":`, e);
        }
      }
    }
    
    // Store the generated font-face CSS for use in generateCssContent
    window.generatedFontFaceCSS = fontFaceCSS;

    // Apply to iframe
    try {
      const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow.document;
      if (iframeDoc && iframeDoc.body) {
        applyToIframe(iframeDoc);
      }
    } catch (e) {
      console.error("Помилка інжекту шрифтів:", e);
    }
  };

  // 1. Запускаємо підготовку шрифтів та негайне застосування
  if (fonts.active) prepareAndApply();

  // 2. Обробка повторного або відкладеного завантаження вікна (load event)
  iframeElement.addEventListener("load", () => {
    try {
      const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow.document;
      if (iframeDoc) {
        applyToIframe(iframeDoc);
      }
    } catch (e) {
      console.error("Помилка інжекту по load:", e.message);
    }
  });
}


let wm = WinBox;

function blur(id){
    const winboxElement = document.getElementById(id);
const winboxInstance = winboxElement ? (winboxElement.winbox || winboxElement._winbox) : null;
if (!winboxInstance) throw Error('Window not found.')
winboxInstance.blur();
console.log("Blur: "+id)
}

function fore(id,type) {
        const winboxElement = document.getElementById(id);
        const winboxInstance = winboxElement ? (winboxElement.winbox || winboxElement._winbox) : null;
        if (winboxInstance) winboxInstance.show(1);
}

function kill(id, type = 'winbox') {
    if (type == "winbox") {
        const winboxElement = document.getElementById(id);
        const winboxInstance = winboxElement ? (winboxElement.winbox || winboxElement._winbox) : null;
        if (winboxInstance) winboxInstance.close(1);
    } 
    
    if (type == "worker") {
        const workerEntry = window.systemWorkers.find(w => w.id === id);
        if (workerEntry && workerEntry.instance) {
            workerEntry.instance.terminate();
            console.log(`Worker ${id} killed.`);
        } else {
            console.error(`Worker with ID ${id} not found.`);
        }
    }
}

function getScreenDiagonalInches() {
    // This is what we calculated (wrong)
    const widthPx = window.screen.width * window.devicePixelRatio;
    const heightPx = window.screen.height * window.devicePixelRatio;
    const dpi = 96 * window.devicePixelRatio;
    const widthInches = widthPx / dpi;
    const heightInches = heightPx / dpi;
    const calculatedDiagonal = Math.sqrt(widthInches ** 2 + heightInches ** 2);
    
    // Correction: provide actual DPI if known
    const actualDPI = 96; // Change this to your real DPI (96 * 16/23.7 ≈ 65 in your case)
    
    return calculatedDiagonal * (actualDPI / (96 * window.devicePixelRatio));
}


 
async function buildDevProps() {

  const baseArch = navigator.platform.includes("64") || navigator.userAgent.includes("x86_64") || navigator.userAgent.includes("Win64") ? "x64" : "x86";
  const defaultChipStr = `${baseArch} (${navigator.hardwareConcurrency || 0} Cores)`;



if (navigator.maxTouchPoints > 0 || matchMedia("(any-pointer: coarse)").matches && !detectMobile()){
  deviceIcon = "assets/laptop.svg";
} else if ( detectMobile() ){
  deviceIcon = "assets/mobile.svg"
}else{
  let deviceIcon = "assets/pc.svg";
}

  const devProps = {
    model: '',
    inchRes: (getScreenDiagonalInches()-0.3).toFixed(1) + "-inch",
    relYear: '',
    chip: defaultChipStr, // Clean placeholder format
    memory: navigator.deviceMemory ? navigator.deviceMemory + " GB" : '',
    os: {
      name: "Infinity OS",
      version: "16072026" 
    },
    deviceIcon: deviceIcon
  };

  const scr = screen;
  scr.type = "screen";
  devices.push(scr);

  if (navigator.userAgentData) {
    try {
      const ua = await navigator.userAgentData.getHighEntropyValues([
        "model",
        "platform",
        "platformVersion",
        "architecture",
        "bitness"
      ]);

      if (ua.model) devProps.model = ua.model || _("unknown");


      const arch = ua.architecture ? ua.architecture : "x86";
      const bitness = ua.bitness ? `${ua.bitness}-bit` : "";
      const cores = navigator.hardwareConcurrency ? `(${navigator.hardwareConcurrency} Cores)` : "";
      
      devProps.chip = `${arch} ${bitness} ${cores}`.replace(/\s+/g, ' ').trim() || defaultChipStr;

      if (ua.platformVersion) {
        devProps.relYear = "Platform v" + ua.platformVersion;
      }

    } catch (e) {
      console.warn("UA entropy blocked:", e);
    }
  } else {

    devProps.model = navigator.userAgent;
  }

  devProps.cores = navigator.hardwareConcurrency || '';

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

    if (debugInfo) {
      devProps.gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).replaceAll("(", "").replaceAll(")", "").trim();
    } else {
      devProps.gpu = '';
    }
  } catch {
    devProps.gpu = '';
  }

  return devProps;
}
let devProps;
let maxLS;

window.icns = {

    files: "icons/files.svg",
    clock: "icons/clock.svg",
    calc: "icons/calc.svg",
    settings: "icons/settings.svg",
    term: "icons/terminal.svg",
    web: "icons/web.svg",
    tasks: "icons/tasks.svg",
    store: "icons/store.svg",

    textPlain: "icons/application-text.svg",
	 textRich: "icons/application-rtf.svg",
    imageGeneric: "icons/application-image.svg",
    audioGeneric: "icons/application-audio.svg",
    videoMp4: "icons/application-video.svg",
    archive: "icons/application-archive.svg",
    cdImage: "icons/application-x-cd-image.svg",
    pdf: "icons/application-pdf.svg",
    ms_theme: "icons/theme.svg",
    textHtml: "icons/text-html.svg",
    textJavascript: "icons/text-x-javascript.svg",
    textCss: "icons/text-css.svg",
    textCsv: "icons/text-csv.svg",
    font: "icons/font.svg",
    empty: "icons/application-blank.svg",
    folder: "icons/folder.svg",

    dialogInfo: 'icons/dialog-info.svg',
    dialogQues: 'icons/dialog-ques.svg',
    dialogErr: 'icons/dialog-err.svg',
    dialogWarn: 'icons/dialog-warn.svg',

    lsDrive: 'icons/drive-ls.svg',
    dbDrive: 'icons/drive-idb.svg',
    usbDrive: 'icons/drive-usb.svg',
};
let vol = 1;

window.sounds = {
  error: new Audio("sounds/error.ogg"),
  startup: new Audio(""),
  info: new Audio(""),
  question: new Audio(""),
  warn: new Audio(""),
  driveIn: new Audio("sounds/in.ogg"),
  driveOut: new Audio("sounds/out.ogg"),
  notify: new Audio(""),
  logout: new Audio(""),
  
  async play(aud) {
    let audio;
    let objectUrl = null;

    if (aud instanceof Blob) {
      objectUrl = URL.createObjectURL(aud);
      audio = new Audio(objectUrl);
    } 

    else if (typeof aud === "string" && aud.startsWith("data:audio")) {
      audio = new Audio(aud); // Браузер чудово вміє грати "data:audio/wav;base64,..." напряму!
    } 

    else if (typeof aud === "string") {
      if (!this[aud]) {
        console.error(`Sound "${aud}" not found.`);
        return;
      }
      audio = this[aud];
    } else {
      return; // Якщо передано щось невідоме
    }

    audio.volume = typeof vol !== "undefined" ? vol : 1;

    return new Promise((resolve) => {
      let finished = false;

      const done = () => {
        if (finished) return;
        finished = true;

        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }

        resolve();
      };

      audio.onended = done;
      audio.onerror = done;

      audio.play().catch((err) => {
        console.warn("Playback blocked:", err.message);
        done();
      });
    });
  }
};

async function safeShutdown({ restart = false } = {}) {
    console.log("Infinity OS: safe shutdown started");


    const winboxes = document.querySelectorAll(".winbox");
    winboxes.forEach(w => {
        try {
            if (w.winbox && typeof w.winbox.close === "function") {
                w.winbox.close(1);
            }
        } catch(e) { console.warn("WinBox close err:", e); }
    });

    try {
        
            const driveName = DB_NAME;

            if (dbInstances[driveName]) {
                await dbInstances[driveName].close();
            }

            console.log("UnMounted:" + driveName);
            delete dbInstances[driveName];

             DB_NAME = "";
             LAST_DB = "";
        
    } catch (e) {
        console.warn("Unmount error:", e);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    if (restart) {
        console.log("Restarting system...");
        location.reload();
    } else {
        console.log("Shutting down...");
        window.close();
    }
}





const updateDevices = (e, isConnecting) => {
    let dev;

    if (e.gamepad){
    const { gamepad } = e;
    dev = gamepad;
    if (isConnecting) {

                dev.type = "gamepad";
        devices.push(dev);
sounds.play("driveIn")
    } else {

        const index = devices.findIndex(d => d.index === gamepad.index);
        if (index !== -1) {
            sounds.play("driveOut")
            devices.splice(index, 1);
        }
    }
    }else{

    }
    new Notification(isConnecting ? _("device_connected"):_("device_disconnected"), {body: dev.type || "" , silent: true})
};

window.addEventListener("gamepadconnected", (e) => updateDevices(e, true));
window.addEventListener("gamepaddisconnected", (e) => updateDevices(e, false));


class ThemeParser {
    constructor() {
        this.colors = {};
    }

    winColorToCSS(winColor) {
        if (!winColor) return null;
        const parts = winColor.trim().split(/\s+/);
        if (parts.length === 3) {
            return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
        }
        return winColor;
    }

    parse(fileContent) {

    const lines = fileContent.split(/\r?\n/);
    let currentSection = "";
    const data = {};

    lines.forEach(line => {
        line = line.trim();

        if (!line || line.startsWith(';') || line.startsWith('#')) return;

        if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = line.toLowerCase(); // Залишаємо дужки для сумісності з вашим mapToInfinityVariables
            data[currentSection] = {};
        } 

        else if (line.includes('=') && currentSection) {
            const separatorIndex = line.indexOf('=');
            const key = line.substring(0, separatorIndex).trim();
            const value = line.substring(separatorIndex + 1).trim();
            
            if (key) {
                data[currentSection][key] = value;
            }
        }
    });

    return {
        styles: this.mapToInfinityVariables(data),
        name: this.getName(data),
		type: data['[visualstyles]'] && data['[visualstyles]']['ColorizationColor'] ? "win_aero" : "win_cla"
    };
}
parseColorization(hex) {

    const raw = hex.replace('0x', '');
    
    const a = parseInt(raw.substring(0, 2), 16); // 45 -> 69
    const r = parseInt(raw.substring(2, 4), 16); // 40 -> 64
    const g = parseInt(raw.substring(4, 6), 16); // 9e -> 158
    const b = parseInt(raw.substring(6, 8), 16); // fe -> 254

    const alpha = (a / 255).toFixed(2);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
mapToInfinityVariables(data) {
    const cpColors = data['[control panel\\colors]'] || {};
    const vs = data['[visualstyles]'] || {};

    const activeTitle = this.winColorToCSS(cpColors['ActiveTitle']) || '#0054e3';
    const gradActiveTitle = this.winColorToCSS(cpColors['GradientActiveTitle']) || activeTitle;
    const inactiveTitle = this.winColorToCSS(cpColors['InactiveTitle']) || '#76a1e8';
    const gradInactiveTitle = this.winColorToCSS(cpColors['GradientInactiveTitle']) || inactiveTitle;

    const colorization = vs['ColorizationColor'] || "";
    let md = 10; // Default radius
    let winActive, winInactive;

    if (colorization) {

        const cssAccent = this.parseColorization(colorization);
        winActive = cssAccent;


        winInactive = cssAccent.replace(/[\d.]+\)$/g, '0.4)'); 
        
        md = 10; 
    } else {
hideWinContentOnTransform = true;
localStorage.setItem("hideWinContentOnTransform", "true");
        winActive = `linear-gradient(90deg, ${activeTitle} 0%, ${gradActiveTitle} 100%)`;
        winInactive = `linear-gradient(90deg, ${inactiveTitle} 0%, ${gradInactiveTitle} 100%)`;
        md = 0; // Classic themes usually have sharp corners
    }

const infoWindow = this.winColorToCSS(cpColors['InfoWindow']);
const infoText = this.winColorToCSS(cpColors['InfoText']);

    const windowBg = this.winColorToCSS(cpColors['Window']) || '#ffffff';
    const windowText = this.winColorToCSS(cpColors['WindowText']) || '#000';

    const highlight = this.winColorToCSS(cpColors['Hilight']) || '#326ba8';
    const highlightText = this.winColorToCSS(cpColors['HilightText']) || '#326ba8';
    const buttonFace = this.winColorToCSS(cpColors['ButtonFace']) || '#f0f0f0';


    document.body.style.backgroundColor = this.winColorToCSS(cpColors['Background']) || '#000';



    const colors =  {

        '--color-win-act': winActive,
        '--color-win-ina': winInactive,

        '--accent-color': colorization ? this.parseColorization(colorization) : this.winColorToCSS(cpColors['activeTitle']),
        '--color-selection': highlight,
        '--color-selection-text': highlightText,
        '--bg-color': windowBg,
        '--bg-panel': colorization ? this.parseColorization(colorization) : buttonFace,
        '--bg-body': windowBg,
        '--bg-menu': colorization ? this.parseColorization(colorization) : windowBg,

        '--toolbar-bg': buttonFace,
'--button-bg': buttonFace,
    '--button-text': this.winColorToCSS(cpColors['ButtonText']) || '#000',
    '--button-light': this.winColorToCSS(cpColors['ButtonLight']) || '#c0c0c0',
    '--button-hilight': this.winColorToCSS(cpColors['ButtonHilight']) || '#fff',
    '--button-shadow': this.winColorToCSS(cpColors['ButtonShadow']) || '#808080',
    '--button-dk-shadow': this.winColorToCSS(cpColors['ButtonDkShadow']) || '#000',

    '--button-act-bg': this.winColorToCSS(cpColors['ButtonLight']) || '#c0c0c0',
    '--button-border': this.winColorToCSS(cpColors['ButtonShadow']) || '#808080',
    '--button-act-border': this.winColorToCSS(cpColors['ButtonDkShadow']) || '#000',

        '--color-text-primary': windowText,

        '--input-bg': windowBg,
        '--color-input-bg': windowBg,

        '--blur': colorization ? 'blur(10px)' : 'none',
        '--radius-md': md + 'px',
        '--color-win-btn-close': 'rgba(220, 20, 60, 0.6)',

    };
    if (infoWindow) colors['--info-bg'] = infoWindow;
if (infoText) colors['--info-text'] = infoText;

if (windowText){
    const isDark = (cpColors['Window'] || "255 255 255").split(/\s+/).reduce((a, b) => +a + +b) < 380;
colors['--color-text-secondary'] = isDark ? "#fff" : "#000";

}
if (colorization){
colors['--color-text-tretiary'] = "#fff"
}else{
colors['--color-text-tretiary'] = "#000"
}

return colors;
}

getName(data) {

    const vs = data['[visualstyles]'];
const thm = data["[Theme]"]
    if (thm && thm['DisplayName']) return thm['DisplayName'];
    return "unknown-theme";
}
    applyTheme(variables) {
        const root = document.documentElement;
        for (const [key, value] of Object.entries(variables)) {
            root.style.setProperty(key, value);
        }


    }
}


let theme = localStorage.getItem("theme") || null // Link to file here


function loadTheme() {
    const tmp = fs.find(f => f.name == theme);
    if (theme && tmp) {
        const reader = new FileReader();

reader.onload = function(e) {
        const text = reader.result;
 
        const parser = new ThemeParser();
        const result = parser.parse(text); 

        if (result && result.styles) {
            
            parser.applyTheme(result.styles);
            styles = result.styles;
            window.styles = styles;
			if (result.name) console.log("THM N: "+result.name)
            
            wbtheme = result.type;
            applyThemeToUI(wbtheme)
        } else {
            console.warn("THM: No styles found in file");
            wbtheme = "glass-theme";
        }

        
};
        
        reader.onerror = () => { wbtheme = "glass-theme";
localStorage.removeItem("theme");
console.error("THM ERR!");
applyThemeToUI(wbtheme);
        }
        reader.readAsText(tmp);
    } else {
        wbtheme = "glass-theme";
        localStorage.removeItem("theme");
        
        applyThemeToUI(wbtheme);
    }
}

function applyThemeToUI(name) {
    const safeName = name.replace(/[^\x20-\x7EА-яЁёІіЇїЄє]/g, "").trim();
    
    document.getElementById("panel").className = safeName;
    document.getElementById("sysmenu").className = safeName;

    document.body.classList.add(safeName)
    
    Array.from(document.getElementsByClassName("menu")).forEach(e => {
        e.className = "menu " + safeName;
    });

            if (hideWinContentOnTransform){
let activeBox = null;

// 1. Listen for pointerdown on both drag handles AND resize edges
window.addEventListener('pointerdown', (e) => {
if (e.target.closest('.wb-control, .min')) return;

    // Check if they clicked the header
    const header = e.target.closest('.winbox .wb-header');
    
    // Check if they clicked any of the directional resize edges/corners
    const resizeEdge = e.target.closest([
        '.winbox .wb-n', '.winbox .wb-e', 
        '.winbox .wb-s', '.winbox .wb-w',
        '.winbox .wb-nw', '.winbox .wb-ne', 
        '.winbox .wb-sw', '.winbox .wb-se'
    ].join(','));

    // If they clicked neither, pass through
    if (!header && !resizeEdge) return;

    // Find the parent window container from whichever element was hit
    const targetElement = header || resizeEdge;
    activeBox = targetElement.closest('.winbox');
    if (!activeBox) return;

    // Turn on the wireframe style instantly
    activeBox.classList.add('is-cont-hidden');
});



// 3. Clean drop (Clears the states for both dragging and resizing)
window.addEventListener('pointerup', () => {
    if (activeBox) {
        activeBox.classList.remove('is-cont-hidden');
        activeBox = null;
        
    }
});
}
}

/**
 * Finds and replaces a pattern in all visible text nodes within a target element.
 *
 * @param {RegExp|string} searchPattern The text or regex to search for.
 * @param {string} replacementString The string to replace the matches with.
 * @param {HTMLElement} [targetElement=document.body] The root element to search within.
 */
function replaceTextInElements(searchPattern, replacementString, targetElement = document.body) {


    const allElements = [targetElement, ...targetElement.querySelectorAll("*:not(script):not(noscript):not(style)")];

    allElements.forEach(element => {


        Array.from(element.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "")
            .forEach(textNode => {



                if (typeof searchPattern === 'string') {

                    textNode.textContent = textNode.textContent.replaceAll(searchPattern, replacementString);
                } else if (searchPattern instanceof RegExp) {

                    const globalPattern = new RegExp(searchPattern, searchPattern.flags.includes('g') ? searchPattern.flags : searchPattern.flags + 'g');
                    textNode.textContent = textNode.textContent.replace(globalPattern, replacementString);
                }
            });
    });
}
let tbConfig;

function setPanelConfig(config) {
    const panel = document.getElementById('panel'); // або ваш селектор
    if (config.pos){
    if (config.pos === 'top') {
        panel.style.top = '0';
        panel.style.bottom = 'auto';
    } else {
        panel.style.bottom = '0';
        panel.style.top = 'auto';
    }
const isTop = config.pos === "top";

    document.body.classList.toggle("panel-at-top", isTop);
}

if (config.size) document.documentElement.style.setProperty('--panel-height', config.size+"px");

    tbConfig = {...tbConfig, ...config};
    localStorage.setItem('panel-conf', JSON.stringify(tbConfig));	
}



let FILE_TYPES = {
// Group 1: fully openable and editable
    'txt':  { mime: 'text/plain', icon: icns.textPlain },
    'css':  { mime: 'text/css', icon: icns.textCss },
    'html': { mime: 'text/html', icon: icns.textHtml },
    'htm':  { mime: 'text/html', icon: icns.textHtml },
    'xml':  { mime: 'text/xml', icon: icns.textHtml },
    'js':   { mime: 'text/javascript', icon: icns.textJavascript },
    'md':   { mime: 'text/markdown', icon: icns.textRich },
    'rtf':  { mime: 'application/rtf', icon: icns.textRich },
    'csv':  { mime: 'text/csv', icon: icns.textCsv },
    'theme':{ mime: 'application/x-theme', icon: icns.ms_theme },
    'svg':  { mime: 'image/svg+xml', icon: icns.imageGeneric }, // Has resolution avaliable as Group 2 types.
    'docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', icon: icns.textRich },
// Group 2: viewable, but not editable. Resolution is available in 'Get Info'
    'jpg':  { mime: 'image/jpeg', icon: icns.imageGeneric },
    'jpeg': { mime: 'image/jpeg', icon: icns.imageGeneric },
    'png':  { mime: 'image/png', icon: icns.imageGeneric },
    'gif':  { mime: 'image/gif', icon: icns.imageGeneric },

    'webp': { mime: 'image/webp', icon: icns.imageGeneric },
    'avif': { mime: 'image/avif', icon: icns.imageGeneric },
    'apng': { mime: 'image/apng', icon: icns.imageGeneric },

// Group 3: viewable and listenable, but not editable
    'wav':  { mime: 'audio/wav', icon: icns.audioGeneric },
    'ogg':  { mime: 'audio/ogg', icon: icns.audioGeneric },    
    'mp3':  { mime: 'audio/mpeg', icon: icns.audioGeneric },
    'm4a':  { mime: 'audio/mp4', icon: icns.audioGeneric },
    'aac':  { mime: 'audio/aac', icon: icns.audioGeneric },
    'flac': { mime: 'audio/flac', icon: icns.audioGeneric },
    'opus': { mime: 'audio/ogg', icon: icns.audioGeneric },
    'weba': { mime: 'audio/webm', icon: icns.audioGeneric },
    'mp4':  { mime: 'video/mp4', icon: icns.videoMp4 },
    'webm': { mime: 'video/webm', icon: icns.videoMp4 },
// Group 4: viewable, but not on every device (see comments after each definition to get more info)
    'pdf':  { mime: 'application/pdf', icon: icns.pdf }, // Can be unavailable to open on mobile, fully supported on desktop
// Group 5: can be added, removed (in next versions rich text formats will be able to use fonts from user drive), currently can be set as UI font
'ttf':  { mime: 'font/ttf', icon: icns.font }, 
'otf':  { mime: 'font/otf', icon: icns.font }, 
'woff': { mime: 'font/woff', icon: icns.font },
'woff2':{ mime: 'font/woff2', icon: icns.font },
// Group 6: not openable by clicking (see comments after each definition to get more info) and application-registered (user) types
    'zip':  { mime: 'application/zip', icon: icns.archive }, // Can be unpacked via context menu, but opening doesn't work
};

let FILE_ASSOC =  JSON.parse(localStorage.getItem('config/exts')) || {};
let URL_ASSOC =  JSON.parse(localStorage.getItem('config/urls')) || {};

const lastBoot = Date.now();

function getFileTypes(){return FILE_TYPES;}
function getUrlAssoc(){return URL_ASSOC;}
function getMasterVolume(){return vol;}
function getKbrdLayout(){return currentKeyboardLayout;   }
function getNotification(){return notificationAPI;}
function getCurrLang(){return currentLang;}
function getCurrDisk(){return currentDisk;}
function getCurrDateLang(){return dateLang;}
function getDevProps(){return devProps;}
function getPerms(){return permissions}
function getDB(){return DB_NAME;}
function getFs(){return fs;}
function getIcns(){return icns;}
function getFonts(){return fonts;}
function getWM(){return wm;}
function getWBtheme(){return wbtheme;}
function getUpTime(){return Date.now()-lastBoot;}
function getSysWorkers(){return window.systemWorkers;}


function chKbrdLayout(layout){
    if (layout== "win"){
        replaceTextInElements("⌘", "CTRL");
        replaceTextInElements("⌥", "ALT");
        currentKeyboardLayout = 'win';
    }else{
        replaceTextInElements("CTRL", "⌘");
        replaceTextInElements("ALT", "⌥");
        currentKeyboardLayout = 'mac';
    }

    
    localStorage.setItem("currentKeyboardLayout", currentKeyboardLayout);
}




function overrideInFrame(frame, funcName, newFunc) {
    try {
        frame.contentWindow[funcName] = newFunc;
        console.log(`Функцію "${funcName}" перевизначено у фреймі:`, frame.src);
    } catch(e) {
        console.warn(`Не вдалося перевизначити "${funcName}" у фреймі:`, e);
    }
}

function regUrl(url, path){
    URL_ASSOC[url] = path;
    localStorage.setItem("config/urls", JSON.stringify(URL_ASSOC))
}


/**
 * Функція-обгортка для отримання перекладу.
 * @param {string} key Ключ перекладу
 * @returns {string} Перекладений рядок або ключ, якщо переклад не знайдено.
 */
function _(key) {
    return langs[currentLang][key] || key;
}



      document.getElementById("delete_item_btn").addEventListener("click", (e) => {
    e.stopPropagation();
    
    if (obj && obj.parentNode) {
        // Save references before we destroy/nullify them
        const elementToDelete = obj;
        const targetName = elementToDelete.getAttribute('name'); 

        if (!document.body.classList.contains('win_cla')) {
            elementToDelete.style.transition = "all 0.2s ease-out";
            elementToDelete.style.transform = "scale(0.8)";
        }
        elementToDelete.style.opacity = "0";

        setTimeout(() => {
            // 1. Remove from DOM
            elementToDelete.remove();
            
            // 2. Filter out the deleted icon (keep everything that is NOT the deleted item)
            icons = icons.filter(i => i.element !== elementToDelete);
            desktopIcons = desktopIcons.filter(i => i.name !== targetName);
            localStorage.setItem('desktopIcons', JSON.stringify(desktopIcons))
            
            // 3. Clear the global reference safely
            if (obj === elementToDelete) {
                obj = null;
            }
        }, 200);
    }
    document.getElementById("itemM").style.display = "none";
});

    document.getElementById("copy_name").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (obj) {
            const nameElement = obj.querySelector('p');
            if (nameElement) {
                const textToCopy = nameElement.innerText.trim();
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    
                } catch (err) {
                    if (typeof prompt !== 'undefined') await prompt("Copy text manually:", textToCopy);
                }
            }
        }
        document.getElementById("itemM").style.display = "none";
    });


function makeShortcut(){
  new wm('core.createApplicationAlias', {
          x: "center", y: "center",
      class: ["no-header", wbtheme, "no-max", 'no-resize'],
      height: 170,
      width: 260,  
      html: `
<div style="display: flex; flex-direction: column; gap: 8px; padding: 15px;">
  
  <!-- Name Input Row -->
<div style="display: flex; flex-direction: row; gap: 5px; align-items: center;">
  <label style="min-width: 60px;">${_('name')}:</label>
  <input id="name" type="text" style="width: 150px; box-sizing: border-box;" required>
</div>

<!-- Type Select Row -->
<div style="display: flex; flex-direction: row; gap: 5px; align-items: center;">
  <label style="min-width: 60px;">${_('type')}:</label>
  <select id="typeSel" style="width: 150px; box-sizing: border-box;">
    <option value="app">${_('app')}</option>
    <option value="file">${_('file')}</option>
  </select>
</div>

<!-- Dynamic App Selector Container -->
<div id="setup-app" style="display: flex; flex-direction: row; gap: 5px; align-items: center;">
  <label style="min-width: 60px;">${_('app')}:</label>
  <select id="apps" style="width: 150px; box-sizing: border-box; ">
  <option value="" disabled selected hidden> </option>
  </select>
</div>

  <!-- Action Buttons (Standard block alignment instead of absolute overlapping) -->
  <div >
    <button id="save1" style="padding: 4px 12px;" disabled>${_('ok')}</button>
    <button id="cancel1" style="padding: 4px 12px;">${_('cancel')}</button>
  </div>

</div>
        `, oncreate: function(){
          let appIns = null;
          let fileIns = null;
$ = (e) => document.querySelector(e);


$('select').onchange = async () =>{
  const r = $('select').value;
  if (r == 'app') {
    $('#setup-app').style.display='flex';
  }
  else {
    $('#setup-app').style.display='none';
$('#save1').disabled = true;
        const [fileHandle] = await window.showOpenFilePicker();
    
    // 2. Get the actual File object from the handle
    fileIns = await fileHandle.getFile();
    if (fileIns) $('#save1').disabled = false;

}
}

    apps.forEach(a=>{
      const el = document.createElement('option');
      el.value = apps.indexOf(a);
      el.innerText = _(a.name);
      $('#apps').appendChild(el);
    });
$('#apps').onchange = () => {
appIns = apps[$('#apps').value];
$('#name').value = _(appIns.name);
$('#save1').disabled = false;
}
$('#cancel1').onclick = ()=> this.close();
$('#save1').onclick = () => {
  if (!appIns && !fileIns) return;
console.log(appIns + " - " + fileIns)
let ev = null;
let ic = null;
let nm = $('#name').value.trim();
  if (appIns){
ev = () => openApp(appIns);
ic = appIns.icon;
nm = $('#name').value;
  } else if (fileIns){
    ev = () => Openf(fileIns.type, fileIns.name);
    ic = getIcon(fileIns)
    nm = ( $('#name').value.trim() != '') ?  $('#name').value.trim() : fileIns.name.split('/').pop();
  }
  const id = desktopIcons.length

      addIcon(($('#name').value.trim() == '' ? nm : $('#name').value.trim()), ic, ev);
      if (appIns) desktopIcons.push({id:id,name:nm, icon: ic, nameApp: (appIns.name || null)})
      if (fileIns) desktopIcons.push({id:id,name:nm, icon: ic, nameFile: (fileIns.name || null)})

        localStorage.setItem('desktopIcons', JSON.stringify(desktopIcons));

      this.close();
}


        }
  })
}


function addSystemApp(nameKey, iconUrl, onclickLogic, showApp = true){
  const logicStr = onclickLogic.toString();

    if (logicStr.match(/url:\s*["']([^"']+)["']/)) {
        const urlMatch = logicStr.match(/url:\s*["']([^"']+)["']/);
        
        if (urlMatch && urlMatch[1]) {
            const appUrl = urlMatch[1];

            const getVal = (key) => {
                const arrayMatch = logicStr.match(new RegExp(key + ':\\s*\\[([^\\]]+)\\]'));
                if (arrayMatch && arrayMatch[1]) {
                    return arrayMatch[1].split(',').map(s => s.replace(/["']/g, '').trim());
                }
                const m = logicStr.match(new RegExp(key + ':\\s*["\']?([^"\'\\s,}]+)["\']?'));
                return m ? m[1] : undefined;
            };
            const reader = new FileReader();
                            let searchParam = "";
            reader.addEventListener("load", () => {
                const content = reader.result;

                // --- 1. ПАРСИНГ ПАРАМЕТРІВ ТА РЕЄСТРАЦІЯ В МЕНЮ ---



                if (searchRegex.test(content)) {
                    const getParamRegex = /\.get\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
                    let match;
                    const argumentsFound = [];

                    while ((match = getParamRegex.exec(content)) !== null) {
                        argumentsFound.push(match[1]);
                    }

                    if (argumentsFound.includes('file')) {
                        searchParam = 'file';
                    } else if (argumentsFound.includes('path')) {
                        searchParam = 'path';
                    } else if (argumentsFound.length > 0) {
                        searchParam = argumentsFound[0];
                    }
                }
              });

            const appData = {
                name: nameKey,
                icon: iconUrl,
                path: appUrl,
                w:    getVal("width"),
                h:    getVal("height"),
                miw: getVal("minwidth"),
                mih: getVal("minheight"),
                maw: getVal("maxwidth"),
                mah: getVal("maxheight"),
                class: getVal("class"),
                system: true,
                openWithParam: searchParam,
            };

            if (showApp) addApp(appData);
        }
    } else {
        const appData = {name:nameKey, icon:iconUrl, onclick: onclickLogic, system: true};


    // Видаляємо "function() {", "() => {" або "async () => {" з початку рядка, а також зайві пробіли й переноси
    const bodyStart = logicStr
        .replace(/^(async\s+)?(function\s*\w*\s*\([^)]*\)\s*\{|\([^)]*\)\s*=>\s*\{?)/, '')
        .trim();
    if (showApp && (bodyStart.startsWith("new wm(") || bodyStart.startsWith("if (document.querySelector(") || bodyStart.startsWith("const unique") )) {
        addApp(appData);
    }
    }

}

 let obj = null;
function addIcon(nameKey, iconUrl, onclickLogic, isRequiredIcon = false) {  
    const desktopApps = document.getElementById("desktopApps") || document.body;

    const appContainer = document.createElement('div');
    appContainer.className = 'appIcon';
    appContainer.setAttribute('name', _(nameKey)); // Надійно пишемо в атрибут DOM
    appContainer.innerHTML = `
        <img src="${iconUrl}" style="width: 32px; height: 32px;" draggable="false">
        <p data-i18n="${nameKey}" style="margin: 0px; color: #fff; text-shadow: 1px 1px 1px rgba(0,0,0,0.5);">${_(nameKey)}</p>
    `;

    appContainer.addEventListener("contextmenu", (e)=>{
        e.preventDefault(); e.stopPropagation(); obj = appContainer;
        document.querySelectorAll(".menu").forEach(i => i.style.display="none");
        if (isRequiredIcon) document.getElementById("itemM").querySelector('#delete_item_btn').classList.add('disabled')
        document.getElementById("itemM").querySelectorAll("li > p").forEach(i => i.innerText = _(i.innerText));
        document.getElementById("itemM").style.display = "block";
        document.getElementById("itemM").style.left = e.clientX+"px";
        document.getElementById("itemM").style.top = e.clientY+"px";
    });

    appContainer.setAttribute('draggable', 'true');


    appContainer.onclick = onclickLogic;
    if (isRequiredIcon) addSystemApp(nameKey, iconUrl, onclickLogic);
    icons.push({name:nameKey, icon:iconUrl, onclick: onclickLogic, element: appContainer})
    desktopApps.appendChild(appContainer);
}

async function openApp(targ) {
    // 1. Спроба знайти та клікнути фізичну іконку на робочому столі
    if (typeof targ === "string" || !targ.path) {
        if (apps) {
            const expectedName = typeof targ === "string" ? targ : _(targ.name);

            const physicalIcon = Array.from(apps).find(icon => 
                icon.name == expectedName
            );

            if (physicalIcon && physicalIcon.onclick && apps.some(app => app.name === physicalIcon.name)) {
                physicalIcon.onclick(); 
                return true;
            }
        }
    }

    // 2. Визначення шляху та пошук сутності додатка в реєстрі
    const isString = typeof targ === "string";
    let appPath = (isString && targ.includes('.htm')) ? targ : (!isString ? targ.path : null); 
    let appEntry;

    if (isString) {
        // Шукаємо або за чистим шляхом (відсікаючи GET-параметри), або за назвою
        const cleanPath = targ.split('?')[0];
        appEntry = getApps().find(a => a.path === cleanPath || a.name === targ);
    } else {
        appEntry = targ;
        console.warn(targ)
    }

    let app = appEntry;

    if (!app) {
        console.error("App not found:", (isString ? targ : targ.name));
        return; 
    }

    // 3. Запуск системного додатка (вбудовані утиліти)
    if (app.system) {
      if (app.path){
        const appClasses = Array.isArray(app.class) ? app.class : [];
        new wm(_(app.name), {
            x: "center", y: "center",
            class: appClasses.map(c => c === "wbtheme" ? wbtheme : c).join(" ") || wbtheme,
            url: appPath,
            icon: app.icon,
            minwidth: app.miw, minheight: app.mih,
            width: app.w, height: app.h,
            maxwidth: app.maw, maxheight: app.mah,
            oncreate: function() {
                if (typeof applySystemConfig === "function") applySystemConfig(this.id);
            }
        });
      }else if (app.onclick){
        app.onclick();
      }
    } 
    // 4. Запуск стороннього додатка зі збереженням та перемиканням дисків
    else {
        const beforeDB = DB_NAME;
        try {
            if (currentDisk.name != startupDisk) {
                DB_NAME = startupDisk;
                idbWrapper.db = null;

                await idbWrapper.openDB();
                await loadFsFromDB();
                console.log(beforeDB + " -> " + DB_NAME);
            }

            // Передаємо шлях додатка в Openf для розгортання в iframe
            await Openf(getMimeType(app.path), app.path, false);
        } finally {
            // Повертаємо початкову базу даних, якщо вона була змінена
            if (DB_NAME == startupDisk && beforeDB != startupDisk) {
                console.log(beforeDB + " <- " + DB_NAME);
                DB_NAME = beforeDB;
                idbWrapper.db = null;
                await idbWrapper.openDB();
                await loadFsFromDB();
            }
        }
    }
}



function addApp(app){
    // Check by path if it exists, otherwise check by name
    const exists = apps.find(a => {
        if (app.path && a.path) {
            return a.path === app.path;
        }
        return a.name === app.name;
    });

    if (!exists) {
        apps.push(app);
    }
}

function folderExists(path) {

    const folderPath = path.endsWith('/') ? path : path + '/';
    
    return fs.some(file => file.name.startsWith(folderPath));
}



function openMenu(event) {
    const menu0 = document.getElementById("appmenu-sys");
    const menu1 = document.getElementById("appmenu-user");
    const menuList0 = document.getElementById("appmenu-list-sys");
    const menuList1 = document.getElementById("appmenu-list-user");
    document.querySelector("#sysmenu").style.display = document.querySelector("#sysmenu").style.display  === 'none' ? 'block' : 'none';
if (document.querySelector("#sysmenu").style.display  === 'none') return;

    menu0.innerHTML = "";
    menu1.innerHTML = "";

    const rect = sysmenu.getBoundingClientRect();


    apps.forEach(app => {
        const btn = document.createElement("button");
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.width = "100%";
        btn.style.padding = "5px";
        btn.style.cursor = "pointer";

        const ico = document.createElement("img");
        ico.style.width = "24px"; // 24-32px оптимально для меню
        ico.style.marginRight = "10px";

        ico.src = app.icon || "";

        
        const title = document.createElement("p");
        title.style.margin = "0";
        title.innerText = _(app.name);

            btn.onclick = () => {
              if(app.path){
            openApp(app)
          }else{
            openApp(app.name);
          }}

        
        btn.appendChild(ico);
        btn.appendChild(title);
        if (app.system){
            menu0.appendChild(btn);
        }else{
            menu1.appendChild(btn);
        }
        
        
    });  
    if (apps.filter(a=> a.system == false).length == 0){
      menuList0.open = true;
    }else{
      menuList1.open = true;
    }
}

function handleInspectScreen(targetSelector) {

    const rootElement = targetSelector 
        ? document.querySelector(targetSelector) 
        : (document.querySelector('.workspace') || document.body);

    if (!rootElement) {
        return JSON.stringify({ error: `Selector '${targetSelector}' not found.` });
    }

    const screenDump = [];

    function traverseDOM(element) {

        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) return;

        const style = window.getComputedStyle(element);

        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return;
        }

        let directText = "";
        for (let node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                directText += node.nodeValue.trim();
            }
        }

        const hasClass = element.className && typeof element.className === 'string' && element.className.trim() !== "";
        const hasId = element.id !== "";
        const isInteractive = ['BUTTON', 'INPUT', 'TEXTAREA', 'A', 'H1', 'H2', 'H3'].includes(element.tagName);

        if (directText || isInteractive || hasId || hasClass) {
            screenDump.push({
                tagName: element.tagName.toLowerCase(),
                id: element.id || undefined,
                class: element.className || undefined,
                styleDisplay: style.display,
                innerText: directText || undefined,

                value: (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') ? element.value : undefined
            });
        }

        for (let i = 0; i < element.children.length; i++) {
            traverseDOM(element.children[i]);
        }
    }

    traverseDOM(rootElement);

   
    
       return JSON.stringify(screenDump);
}




function getApps(){
    return apps;
    
}

let DB_NAME = 'Infinity_OS_FS';

if (localStorage.getItem("startup_disk")){
    DB_NAME = localStorage.getItem("startup_disk");
}else{
    localStorage.setItem("startup_disk", "Infinity_OS_FS")
}


const STORE_NAME = 'FileObjects';
let LAST_DB = "";
const startupDisk = localStorage.getItem("startup_disk");


/**
 * Клас-обгортка для роботи з IndexedDB.
 * Всі операції є асинхронними.
 */
class IDBWrapper {
    constructor() {
        this.db = null;
    }

    /**
     * Відкриває з'єднання з базою даних та створює сховище об'єктів.
     * @returns {Promise<IDBDatabase>} З'єднання з базою даних.
     */
    async openDB() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            fs = [];
            const request = indexedDB.open(DB_NAME, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {

                    db.createObjectStore(STORE_NAME, { keyPath: 'name' }); 
                }
            };

            request.onsuccess = (event) => {
console.log("LAST_DB - "+LAST_DB)
console.log("DB_NAME - "+DB_NAME)
                if (LAST_DB != event.target.result.name || DB_NAME == ""){
                    sounds.play("driveIn");
                }
                LAST_DB = event.target.result.name;
                this.db = event.target.result;
                console.log("Mount: " + event.target.result.name)
                resolve(this.db);
                dbInstances[DB_NAME] = event.target.result;
            };
            

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Зберігає або оновлює файл у IndexedDB.
     * @param {Object} fileObject Об'єкт файлу з обов'язковим полем 'name'.
     * @returns {Promise<void>}
     */
    async saveFile(fileObject) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {

            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const request = store.put(fileObject);

            request.onsuccess = async () => {
              if (fileObject.type == 'text/html') await registerApps();
              resolve();
            }
            request.onerror = (event) => reject(event.target.error);
        });
    }
    
    /**
     * Видаляє файл з IndexedDB за іменем.
     * @param {string} fileName Ім'я файлу (ключ).
     * @returns {Promise<void>}
     */
    async deleteFile(fileName) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.delete(fileName);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Завантажує всі файли з IndexedDB.
     * @returns {Promise<Array>} Масив об'єктів файлів.
     */
     
    async loadAllFiles() {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);

            const request = store.getAll(); 

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }
}

const idbWrapper = new IDBWrapper();

let fs = [];
let dbInstances = {}

/**
 * Перевіряє, чи закрита база даних IndexedDB за її ім'ям
 * @param {string} dbName - Назва бази даних (наприклад, твій DB_NAME)
 * @returns {boolean} true, якщо база закрита або не існує
 */
function isDbClosed(dbName) {
    const db = dbInstances[dbName];

    if (!db) return true; 

    try {


        db.transaction([STORE_NAME], 'readonly');
        
        return false; // Транзакція успішна -> база ВІДКРИТА
    } catch (error) {

        if (error.name === 'InvalidStateError' || error.message.includes('closed')) {
            return true; 
        }

        return false; 
    }
}


/**
 * Допоміжна функція для перетворення Data URL (base64) на Blob.
 * Потрібна для коректного відтворення медіафайлів після завантаження з LS.
 * @param {string} dataurl Data URL рядок (наприклад, data:image/jpeg;base64,...)
 * @returns {Blob} Об'єкт Blob
 */
function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

function getExt(file) {
    if (!file) return "";

    const name = typeof file === "object" ? file.name : file;
    const lastDot = name.lastIndexOf(".");

    return lastDot > 0
        ? name.slice(lastDot + 1).toLowerCase()
        : "";
}

/**
 * Асинхронно перетворює File/Blob на об'єкт, придатний для JSON-серіалізації.
 * Для тексту зберігає текст, для медіа - Data URL.
 * @param {File} file Об'єкт File для серіалізації.
 * @returns {Promise<Object>} Об'єкт з ім'ям, типом та вмістом у вигляді Data URL або тексту.
 */
function serializeFile(file) {
    if (file instanceof Promise) return;
    return new Promise((resolve) => {
        const fileType = file.type || getMimeType(file.name);
        
        
        const reader = new FileReader();

        reader.onload = function(e) {
            resolve({
                name: file.name,
                type: file.type,
                lastModified: file.lastModified,
                content: e.target.result
            });
        };

        if (fileType.startsWith("text/")) {

            reader.readAsText(file);
        } else{
            reader.readAsDataURL(file);
            
        }
    });
}


/**
 * Зберігає або оновлює один файл у IndexedDB.
 * @param {File} file Об'єкт File, який потрібно зберегти.
 */
async function saveFileToDB(file) {
    if (currentDisk.type == 'indexedDB'){
     if (!file instanceof Blob && !(file instanceof File)) return false;
     currentDisk.busy = true;
               if (file.type == 'text/html') await registerApps()
    

    const fileObjectToSave = await serializeFile(file);

    try {

        await idbWrapper.saveFile(fileObjectToSave);
        
        currentDisk.busy = false;
        return true;
    } catch (error) {
       return false; 
    }
  }
    
}

/**
 * Перетворює запис із БД/LocalStorage у File-об'єкт.
 */
function fileFromRecord(item) {
    let blob;

    if (item.type.startsWith("text/")) {
        blob = new Blob([item.content], { type: item.type });
    } else if (typeof item.content === 'string' && item.content.startsWith('data:')) {
        blob = dataURLtoBlob(item.content);
    } else {
        blob = new Blob([], { type: item.type });
    }

    return new File([blob], item.name, { type: item.type, lastModified: item.lastModified });
}

/**
 * Асинхронно завантажує файли з IndexedDB на початку роботи.
 */
async function loadFsFromDB() {
if (!currentDisk || currentDisk.type == 'indexedDB'){
    try {
        if (currentDisk) currentDisk.busy = true;
        const savedFileObjects = await idbWrapper.loadAllFiles();

        if (savedFileObjects && savedFileObjects.length > 0) {

            fs = savedFileObjects.map(fileFromRecord);

        } else {
            console.log("IndexedDB is empty or not yet created. Initializing empty FS.");
            const savedFs = localStorage.getItem('infinity_os_fs');

            if (savedFs) {
                console.log("Found legacy FS in Local Storage. Attempting migration...");
                const deserializedFs = JSON.parse(savedFs);

                fs = deserializedFs.map(item =>
                    item.content
                        ? fileFromRecord(item)
                        : new File([], item.name, { type: item.type, lastModified: item.lastModified })
                );

                if (fs.length > 0) {
                    console.log("Migrating files to IndexedDB...");
                    await Promise.all(fs.map(file => saveFileToDB(file)));
                    localStorage.removeItem('infinity_os_fs');
                    console.log("Legacy LocalStorage FS successfully migrated and cleared.");
                }

            } else {
                console.log("Local Storage is also empty. Initializing empty FS.");
                fs = [];
            }
        }
    } catch (error) {
        console.error("Error loading FS from IndexedDB:" + error);
        fs = [];
    }
    if (currentDisk) currentDisk.busy = false;
}
}


/**
 * Оновлює заголовки активних вікон (WinBox) та, якщо потрібно, їхній вміст.
 */

/**
 * Застосовує переклади до статичних елементів DOM, позначених data-i18n.
 */
function applyTranslationsToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = _(key);
    });
document.querySelectorAll('[title-i18n]').forEach(element => {
        const key = element.getAttribute('title-i18n');
        updateSystemPopover(element, _(key), false, false)
    });

}



function loadLanguage(lang = null, dlang = null) {
  try {

    if (!lang) lang = localStorage.getItem("locale");
    if (!dlang) dlang = localStorage.getItem("dlocale");

    if (!lang) lang = "en";
    if (!dlang) dlang = "en-US";

    if (!langs[lang]) {
      throw new Error(`Language "${lang}" not found in dictionary.`);
    }

    currentStrings = langs[lang];
    currentLang = lang;
    dateLang = dlang;

  } catch (error) {
    console.error("Error loading language, rolling back to English:", error);

    const fallbackLang = (lang !== "en" && langs["en"]) ? "en" : lang;
    
    currentStrings = langs[fallbackLang] || {};
    currentLang = fallbackLang;
    dateLang = (lang !== "en") ? "en-US" : dlang;
  }

  applyTranslationsToDOM();
  
  localStorage.setItem("locale", currentLang);
  localStorage.setItem("dlocale", dateLang);

  console.log(`Language set to: ${currentLang}`);
  console.log("SAVE:" + currentLang + " " + dateLang);
}


/**
 * Асинхронно завантажує фон з FS та ховає Splash Screen.
 * Ця функція обгорнута у Promise, щоб await у IIFE чекав на завершення 
 * асинхронної операції FileReader.
 * @returns {Promise<void>}
 */
function loadBackground() {
    return new Promise(resolve => {
      
      if (bgClock == true){
        document.getElementById("desktop-fore").style.display = "flex"
      }else{
        document.getElementById("desktop-fore").style.display = "none"
      }
        const backgroundFileName = localStorage.getItem('background_file');
        
        if (backgroundFileName) {


            const backgroundFile = typeof fs !== 'undefined' ? fs.find(item => item.name === backgroundFileName) : null;
            
            if (backgroundFile && backgroundFile instanceof File) {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    const dataUrl = e.target.result;

                    document.body.style.backgroundImage = `url(${dataUrl})`; // Виправлено синтаксис
                    console.log(`Background loaded from Local Storage: ${backgroundFileName}`);
                    
                    resolve(); // <--- КРИТИЧНО: Завершення Promise після успіху
                };
                
                reader.onerror = function() {
                    console.error("Error reading background file via FileReader.");
                    
                    resolve(); // <--- КРИТИЧНО: Завершення Promise навіть при помилці
                };

                reader.readAsDataURL(backgroundFile);
            } else {

                localStorage.removeItem('background_file');
                console.log("Saved background file not found, cleared setting.");
                
                resolve(); // <--- КРИТИЧНО: Завершення Promise, якщо файл не знайдено
            }
        } else {

            console.log("No background configured.");
            
            resolve(); // <--- КРИТИЧНО: Завершення Promise, якщо фон не налаштовано
        }
    });
}





async function loadLayout(){
    let savedLayout = localStorage.getItem("currentKeyboardLayout");
if (savedLayout) {
    currentKeyboardLayout = savedLayout;
    chKbrdLayout(savedLayout);
    
}else{
    chKbrdLayout("mac");
    
}

}
const notify = document.getElementById('notify')

function finishStartup() {

desktopIcons.forEach(i=>{
let ev;

if (i.nameApp){
  ev = ()=> openApp(apps[apps.findIndex(app => app.name === i.nameApp)])
  console.log(apps.findIndex(app => app.name === i.nameApp))
}else if (i.nameFile){
  const f = fs.find(f=>f.name == i.nameFile);
  ev = ()=> Openf(f.type, f.name)
}


if ((!i.nameApp && !i.nameFile) || (i.nameApp && i.nameFile) || !i.icon || !i.name) localStorage.removeItem('desktopIcons')

let ic;
console.log(apps.length)
console.log(apps.find(app => app.name == i.nameApp))
if (i.icon) ic = i.icon;
else if (i.nameApp && !i.icon) ic = apps.find(app => app.name === i.nameApp).icon
  addIcon(i.name, ic, ev)
})

// Блок автозавантаження
    let autoload = [];
    try {
        const autoloadString = localStorage.getItem('autoload');
        if (autoloadString) {
            autoload = JSON.parse(autoloadString);
        }
    } catch (e) {
        console.error("Autoload parsing error:", e);
    }


        autoload.forEach(itemName => {
            const autofile = fs.find(file => file.name === itemName);
            
            if (autofile) {
                const reader = new FileReader();
                // Загортаємо асинхронний слухач у свій try-catch, щоб захистити ядро від кривого коду в автозавантаженні
                reader.addEventListener("load", () => {
                    try {
                        (0, eval)(reader.result); // Безпечний глобальний eval
                    } catch (err) {
                        console.error(`Autoload runtime error in ${itemName}:`, err);
                    }
                });
                reader.readAsText(autofile);
            } else {
                console.warn(`Файл автозавантаження '${itemName}' не знайдено в fs.`);
            }
        });
    

    // Приховуємо заставку та запускаємо звук
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) splash.classList.add("hidden"); 
    }, 500);

    try {
        sounds.play("startup");
    } catch (e) {}

    
    
}



const prg = document.getElementById("loadprg");

function fail(msg) {
    notify.innerText = msg;
    throw new Error(msg); // жорстко зупиняємо запуск
}
function firstStart(){

    if (!localStorage.getItem("locale") || !localStorage.getItem("dlocale")){

const oobe_steps = [
    {
        id: 1,
        lay: `
            <h1 data-i18n="language">Language</h1>
            <select id="languageSelect">
                <option value="en|EN-US">English</option>
                <option value="ua|UK-UA">Українська</option>
                <option value="fr|FR-FR">Français</option>
                <option value="ru|RU-RU">Русский</option>
<option value="pl|pl-PL">Polski</option>
            </select>`,
        onLoad: () => {
            const select = document.getElementById("languageSelect");

            const nextBtn = document.querySelector('.toolbar button');
            nextBtn.disabled = false; 

            select.onchange = () => {
                const [langCode, region] = select.value.split('|');
                loadLanguage(langCode, region); // Your existing function
                console.log(`Language set to: ${langCode}, Region: ${region}`);
            };
        }
    },
    {
        id: 2,
        lay: "<h1>Setup Complete</h1><p>Welcome to Infinity OS.</p>",
        onLoad: () => {
            console.log("Final step loaded.");
        }
    }
];
let curr_oobe_step = 1;

window.oobe_next = () => {
    if (curr_oobe_step > oobe_steps.length) {
        oobe.close();
        return;
    }

    const currentStepData = oobe_steps[curr_oobe_step - 1];
    document.getElementById("oobe_step").innerText = curr_oobe_step + "/" + oobe_steps.length;
    document.getElementById("oobe_cont").innerHTML = currentStepData.lay;

    if (typeof currentStepData.onLoad === "function") {
        currentStepData.onLoad();
    }

    curr_oobe_step += 1;
};

        const oobe = new wm("core.intro", {
            class: wbtheme + " no-header no-move no-resize",
            html: `<div class="toolbar"> <span id="oobe_step"></span> <button onclick='oobe_next()' disabled> > </button> </div><main style="justify-content:center; padding:15px;"id="oobe_cont"></main>`,
            x: "center",y: "center",
            modal: true
        }
        )



oobe_next()
    }else{
        return false;
    }
}




async function setupFonts() {
  fonts = JSON.parse(localStorage.getItem("fonts")) || {installed: [...coreFonts], active: "sans-serif"};
  const active = fonts.active;

  const f = getFs().find(f => f.name == active);
  if (!f) return document.body.style.fontFamily = `sans-serif`;

  const b = await f.arrayBuffer(); // Don't forget to await the buffer if it's a File/Blob
  const font = new FontFace(active, b);

const blob = new Blob([b], { type: f.type }); // або woff/otf
window.currentFontBlobUrl = URL.createObjectURL(blob);


  if (!fonts.installed.includes(active)) {
        fonts.installed.push(active);

        localStorage.setItem("fonts", JSON.stringify(fonts));
        console.log(`"${active}" added to installed list.`);
    }
  
  try {
    const loadedFont = await font.load();
    document.fonts.add(loadedFont);

    document.body.style.fontFamily = `"${active}", sans-serif`;
    document.documentElement.style.setProperty("--font", document.body.style.fontFamily);
    
    console.log(`Font "${active}" applied successfully.`);
  } catch (e) {
    console.error("Font loading failed:", e);
  }
}

function setupExtentions() {
    // --- 2. ІНІЦІАЛІЗАЦІЯ ОБРОБНИКІВ (Твій базовий цикл) ---
    for (const ext in FILE_TYPES) {
        if (FILE_TYPES.hasOwnProperty(ext)) {
                FILE_TYPES[ext].openWith = FILE_ASSOC[ext] || "openf";
            
        }
    }      
}
  
function getMaxLS(prg, max = 5) {
    let i = 0;
    const keyPrefix = "TEST_";

    const chunkSize = 50 * 1024; // 50KB per write
    let usedBytes = 0;

    try {
        while (true) {
            const key = keyPrefix + i;
            const value = "x".repeat(chunkSize);

            localStorage.setItem(key, value);

            usedBytes += chunkSize;
            i++;

            if (prg) {
                const ratio = Math.min(usedBytes / (5 * 1024 * 1024), 0.99);
                prg.value = Math.round(ratio * max);
            }

            console.log("Used KB:", (usedBytes / 1024).toFixed(1));
        }
    } catch (e) {
        console.log("LIMIT REACHED:", usedBytes, "bytes");

        // cleanup
        for (let j = 0; j < i; j++) {
            localStorage.removeItem(keyPrefix + j);
        }

        if (prg) prg.value = max;

        return usedBytes;
    }

}
const usageTracker = (function() {

    const getTodayKey = () => new Date().toISOString().split('T')[0];

    let stats = JSON.parse(localStorage.getItem('.usageData') || '{}');

    const tick = () => {
      if (allowScreenTime !== true) return;

        const activeWindow = document.querySelector('.winbox.focus, .winbox.wb-focus');
        
        if (activeWindow) {

            const titleEl = activeWindow.querySelector('.wb-title');

            if (titleEl) {
                let winTitle = titleEl.textContent.trim();

                if (activeWindow.classList.contains('file-r')) winTitle += ' [app/file OPEN/READ/RUN mode]'
                if (activeWindow.classList.contains('file-e')) winTitle += ' [file EDIT mode]'
                const today = getTodayKey();

                if (!stats[today]) stats[today] = {};
                if (!stats[today][winTitle]) stats[today][winTitle] = 0;

                stats[today][winTitle] += 1;
            }
        }else {
           const today = getTodayKey();

                if (!stats[today]) stats[today] = {};
                if (!stats[today][_("desktop")]) stats[today][_("desktop")] = 0;

                stats[today][_("desktop")] += 1;
        }
    };

    const save = () => {
        if (allowScreenTime == true) localStorage.setItem('.usageData',JSON.stringify(stats));
    };

    return {
        start: function() {

            setInterval(tick, 1000);

            setInterval(save, 10000);

            window.addEventListener('beforeunload', save);
        },

        getDailyStats: function(dateStr) {
            const date = dateStr || getTodayKey();
            return stats[date] || {};
        }
    };
})();

// Тимчасовий реєстр для збереження знайдених MIME-типів на ходу
// Ключ - розширення (sb3), значення - MIME (application/octet-stream)


function registerApps() {
  if (currentDisk.name != startupDisk) return console.error('.')
  console.log("REG")
    const localApps = fs.filter(a =>
        a.name.endsWith(".html") ||
        a.name.endsWith(".htm")
    );



    if (localApps.length !== 0) {
        

const htmlpaths = fs
    .filter(f => f.name.endsWith(".html") || f.name.endsWith(".htm"))
    .map(f => f.name);

// Filter apps to exclude those with paths in htmlpaths
apps = apps.filter(app => {
    // Keep system apps regardless of htmlpaths
    if (app.system) return true;
    
    // For non-system apps, exclude those in htmlpaths
    return htmlpaths.includes(app.path);
});

apps.filter(a => a.system);
// --- РОЗУМНЕ ОЧИЩЕННЯ ФАЙЛОВИХ АСОЦІАЦІЙ ---
    // Проходимо по кожній парі [розширення, шлях_до_додатка]
    Object.entries(FILE_ASSOC).forEach(([ext, appPath]) => {
        
        // Шукаємо, чи існує ще файл додатка у віртуальній ФС
        const isAppExists = fs.some(f => f.name === appPath);
        
        // Якщо додаток видалено з диска — анулюємо асоціацію для цього розширення
        if (!isAppExists) {
            delete FILE_ASSOC[ext];
            
            // Також чистимо кастомний тип з FILE_TYPES, якщо він там був
            const baseExtensions = Object.keys(FILE_TYPES);
            if (!baseExtensions.includes(ext)) {
                delete FILE_TYPES[ext];
            }
        }
    });
        localApps.forEach(app => {
            const reader = new FileReader();
            const appName = app.name;

            reader.addEventListener("load", () => {
                const content = reader.result;

                // --- 1. ПАРСИНГ ПАРАМЕТРІВ ТА РЕЄСТРАЦІЯ В МЕНЮ ---
const titleMatch = content.match(/<title>(.*?)<\/title>/i);

let searchParam = "";

// Variables that hold URLSearchParams from location
const paramVars = new Set();

// const params = new URLSearchParams(location.search);
const searchParamsRegex =
    /\b(?:const|let|var)\s+(\w+)\s*=\s*new\s+URLSearchParams\s*\(\s*(?:window\.|self\.|this\.|document\.)?location\.search\s*\)/g;

// const params = new URL(location.href).searchParams;
const hrefParamsRegex =
    /\b(?:const|let|var)\s+(\w+)\s*=\s*new\s+URL\s*\(\s*(?:window\.|self\.|this\.|document\.)?location\.href\s*\)\.searchParams/g;

let match;

while ((match = searchParamsRegex.exec(content)) !== null) {
    paramVars.add(match[1]);
}

while ((match = hrefParamsRegex.exec(content)) !== null) {
    paramVars.add(match[1]);
}

// Also support direct:
// new URL(location.href).searchParams.get(...)
const directHrefRegex =
    /new\s+URL\s*\(\s*(?:window\.|self\.|this\.|document\.)?location\.href\s*\)\.searchParams\.get\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

const argumentsFound = [];

while ((match = directHrefRegex.exec(content)) !== null) {
    argumentsFound.push(match[1]);
}

// Look for params.get(...)
for (const variable of paramVars) {
    const getRegex = new RegExp(
        `\\b${variable}\\.get\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*\\)`,
        "g"
    );

    while ((match = getRegex.exec(content)) !== null) {
        argumentsFound.push(match[1]);
    }
}

if (argumentsFound.includes("file")) {
    searchParam = "file";
} else if (argumentsFound.includes("path")) {
    searchParam = "path";
} else if (argumentsFound.length > 0 && argumentsFound[0] !== "url") {
    searchParam = argumentsFound[0];
}
                const iconMatch = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
                const systemFile = fs.find(f => f.name === appName);

                addApp({
                    name: titleMatch ? titleMatch[1] : appName.split("/").pop(),
                    icon: iconMatch ? iconMatch[1] : "",
                    path: appName,
                    hash: systemFile ? systemFile.size : 0,
                    openWithParam: searchParam,
                    system: false
                });

                // Внутрішня хелпер-функція для реєстрації розширення в ядрі, щоб не дублювати код
                function registerExtension(ext, mimeType) {
                    const cleanExt = ext.toLowerCase().replace('.', '').trim();
                    if (!cleanExt || cleanExt.startsWith('x-')) return;

                    if (!FILE_TYPES[cleanExt]) {
                        FILE_TYPES[cleanExt] = {};
                        FILE_TYPES[cleanExt].mime = mimeType || "application/octet-stream";
                        FILE_TYPES[cleanExt].icon = getIcon(new File([], `a.${cleanExt}`)) || (icns.empty || "");
                        FILE_TYPES[cleanExt].openWith = (FILE_ASSOC[cleanExt] !== null) ? FILE_ASSOC[cleanExt] : appName;
                    }

                    if (!FILE_ASSOC[cleanExt]) {
                      if (FILE_TYPES[cleanExt].openWith == 'openf') return;
                        FILE_ASSOC[cleanExt] = appName; 
                        localStorage.setItem('config/exts', JSON.stringify(FILE_ASSOC));
                        console.log(`[FileAssoc] Registered .${cleanExt} (${mimeType || 'unknown'}) for ${appName}`);
                    }
                }

                // --- 2. АВТОМАТИЧНИЙ ПОШУК АСОЦІАЦІЙ ТА MIME (FSAAPI) ---
                if (content.includes("showOpenFilePicker") || content.includes("accept")) {
                    const mimeBlockRegex = /['"`]([a-zA-Z0-9/-]+)['"`]\s*:\s*\[([^\]]+)\]/g;
                    const extensionRegex = /['"`]\.([a-zA-Z0-9]+)['"`]/g;
                    let mimeMatch;

                    while ((mimeMatch = mimeBlockRegex.exec(content)) !== null) {
                        const detectedMime = mimeMatch[1];       
                        const extensionsContent = mimeMatch[2];  
                        let extMatch;

                        while ((extMatch = extensionRegex.exec(extensionsContent)) !== null) {
                            registerExtension(extMatch[1], detectedMime);
                        }
                    }
                }

                // --- 3. НОВЕ: ПАРСИНГ КЛАСИЧНИХ INPUT TYPE="FILE" АТРИБУТІВ ACCEPT ---
                // Витягуємо контент всередині атрибуту accept="..." у тегах input
                const inputAcceptRegex = /<input[^>]+type=["']file["'][^>]*accept=["']([^"']+)["']/gi;
                let inputMatch;

                while ((inputMatch = inputAcceptRegex.exec(content)) !== null) {
                    const acceptValue = inputMatch[1]; // Наприклад: ".json,image/*,video/mp4"
                    const parts = acceptValue.split(",");

                    parts.forEach(part => {
                        const token = part.trim();
                        
                        if (token.startsWith(".")) {
                            // Ситуація 1: Пряме розширення (наприклад: .json)
                            registerExtension(token, "application/octet-stream");
                        } else if (token.includes("/")) {
                            // Ситуація 2 та 3: MIME-типи або Маски (image/png або image/*)
                            if (token.endsWith("/*")) {
                                // Якщо це маска типу image/*, реєструємо базові дефолтні розширення для медіа
                                const typeGroup = token.split("/")[0];
                                if (typeGroup === "image") registerExtension("png", token);
                                if (typeGroup === "image") registerExtension("jpg", token);
                                if (typeGroup === "audio") registerExtension("mp3", token);
                                if (typeGroup === "audio") registerExtension("wav", token);
                                if (typeGroup === "video") registerExtension("mp4", token);
                            } else {
                                // Якщо це точний MIME тип (наприклад: text/css)
                                const extFromMime = token.split("/").pop();
                                registerExtension(extFromMime, token);
                            }
                        }
                    });
                }
            });

            reader.readAsText(app);
        });
    }
}

const PowerManager = {
    timer: null,
    timeoutDuration: 60*1000,
    isAsleep: false,
    isPaused: false,
    onIdleCallback: null,
    onWakeCallback: null,

    // Core interaction events (no hardware APIs required)
    events: [
  'pointermove', 'keypress', 'pointerdown', 'scroll', 'click',
  'touchstart', 'touchmove' // Add these
],

    init(options = {}) {
        if (options.timeout !== undefined && !isNaN(options.timeout)) {
        this.timeoutDuration = options.timeout;
        this.isPaused = options.isPaused;
    }
        if (options.onIdle) this.onIdleCallback = options.onIdle;
        if (options.onWake) this.onWakeCallback = options.onWake;

        this.handleEvent = this.handleEvent.bind(this);
if (this.timeoutDuration === 0) {
            this.pause();
        }
        this.startTracking();
this.resetTimer();
        
    },
    setTimeout(newDurationMs) {
    console.log(`PowerManager: Timeout changed to ${newDurationMs}ms`);
    this.timeoutDuration = newDurationMs;
    
    if (newDurationMs === 0) {
        this.pause(); // Automatically halt everything if set to 0
    } else {
        this.isPaused = false; // Ensure it's unpaused if a valid time comes back
        if (!this.isAsleep) {
            this.resetTimer();
        }
    }
},

resetTimer() {
    clearTimeout(this.timer);
    // Double check to ensure a 0 timeout never accidentally registers a macro-task
    if (this.timeoutDuration === 0 || this.isPaused) return; 
    
    this.timer = setTimeout(() => this.goToSleep(), this.timeoutDuration);
},


    // 2. TURN OFF THE TIMEOUT
    pause() {
        console.log("PowerManager: Inactivity timeout disabled.");
        this.isPaused = true;
        clearTimeout(this.timer); // Stops the countdown completely
    },

    // 3. TURN ON THE TIMEOUT AGAIN
    resume() {
        console.log("PowerManager: Inactivity timeout resumed.");
        this.isPaused = false;
        this.resetTimer(); // Restarts the countdown
    },

startTracking(target = window) {
    // Якщо target — це елемент iframe, беремо його window
    const win = (target.contentWindow) ? target.contentWindow : target;

    try {
const listener = (e) => this.handleEvent(e, (target.contentWindow) ? 'iframe' : 'window');
    
    // Зберігаємо посилання на цей ліснер, щоб потім можна було зробити removeEventListener
    win._powerManagerListener = listener;

    this.events.forEach(event => {
        win.addEventListener(event, listener, { passive: true });
    });
    } catch (e) {
        console.warn("PowerManager: Cannot attach power manager to iframe: "+e.message);
    }},

    stopTracking() {
        clearTimeout(this.timer);
        this.events.forEach(event => {
            window.removeEventListener(event, this.handleEvent);
        });
    },
    



    ignoreEvents: false, // New flag to prevent instant wake up
    
    handleEvent(e, origin) {
    if (this.ignoreEvents) return;
    
    // Always allow waking up
    if (this.isAsleep) {
        this.wakeUp();
    }
    
    // Only reset timer if timeout is enabled
    if (this.timeoutDuration > 0 && !this.isPaused) {
        this.resetTimer();
    }
},
    
    goToSleep() {
        if (this.isAsleep) return;
        this.isAsleep = true;
        this.ignoreEvents = true; // Block event handling temporarily
        
        if (this.onIdleCallback) this.onIdleCallback();
        
        // Allow inputs to wake the device again after 200ms
        setTimeout(() => {
            this.ignoreEvents = false;
        }, 200);
    },
    
    wakeUp() {
        this.isAsleep = false;
        if (this.onWakeCallback) this.onWakeCallback();
    }
};



function enterSleepMode() {
  const date = new Date();
    console.log("Entering sleep mode... " + date.toLocaleString(dateLang));
    

    
    // 1. Встановлюємо системні прапорці
    PowerManager.isAsleep = true;
    document.body.classList.add('os-suspended');
    
    // 2. Керуємо відображенням оверлею
    const overlay = document.getElementById('system-sleep-overlay');
    if (overlay) {
        overlay.style.display = 'flex'
    }
}

function exitSleepMode() {
    const date = new Date();
    console.log("Waking up system... " + date.toLocaleString(dateLang));
    
    // 1. Скидаємо прапорці
    PowerManager.isAsleep = false;
    document.body.classList.remove('os-suspended');
    
    // 2. Прибираємо оверлей з екрана
    const overlay = document.getElementById('system-sleep-overlay');
    if (overlay) {
        overlay.style.display = 'none'
    }
}






(async () => {
    try {
    if (cleanOnBoot){
    let a = 0;
        Object.keys(localStorage).forEach(k=> {
  if (localStorage[k].trim() == ''){localStorage.removeItem(k);
  a++;
  }
})
if (a > 0) console.log('Cleaned keys:' + a)
    }
        prg.value = 0;

        maxLS = await getMaxLS(prg, 5);
        prg.value = 5;
        
        await loadFsFromDB();
        prg.value = 10;

            const disks = await getDisks();
currentDisk = disks.find(d => d.name == DB_NAME);
        prg.value = 15;
        
        await firstStart();
        prg.value = 20;

        await setupFonts();
        prg.value = 25;
        
        await loadLanguage();
        prg.value = 30;

        devProps = await buildDevProps();
        prg.value = 35;

        await setPanelConfig(JSON.parse(localStorage.getItem('panel-conf')) || {})
        prg.value = 40;
        
        await loadTheme();
        prg.value = 45;

        await loadBackground();
        prg.value = 50;

        await redefineAdaptations()
        prg.value = 55;
        
        await loadLayout();
        prg.value = 60;
        
        PowerManager.init({
    timeout: localStorage.getItem("sleepModeTimeout") ? parseInt(localStorage.getItem("sleepModeTimeout")) : (60 * 1000), 
    onIdle: () => enterSleepMode(),
    onWake: () => exitSleepMode(),
    isPaused: (parseInt(localStorage.getItem("sleepModeTimeout")) == 0) ? true : false
});
        prg.value = 65;
        
        await npmUpdate();
        prg.value = 70;

        await setupExtentions();
        prg.value = 75;
        
        updateBattery();
        prg.value = 80;

        await registerApps();
        prg.value = 85;
        
        notificationAPI = await redefineNotifications()
        prg.value = 90;

        if (allowScreenTime == true) await usageTracker.start();
        prg.value = 95;
        
        await finishStartup();
        prg.value = 100;
        
    } catch (e) {
        console.error("BOOT ERROR:"+ e);
        notify.innerText = "Infinity OS startup failed: " + e.message;
    }
})();


  function setPerm(app, perm, state) {
      // 1. Захист від undefined: якщо додаток ще не має жодних дозволів,
      // створюємо під нього пустий об'єкт, щоб не було TypeError
      permissions[app] ??= {};

      // 2. Оновлюємо конкретне право (state: true/false)
      permissions[app][perm] = state;

      // 3. Зберігаємо в localStorage, обов'язково перетворивши об'єкт на JSON-рядок
      try {
          localStorage.setItem('permissions', JSON.stringify(permissions));
      } catch (e) {
          
      }
  }


async function deleteApp(app0){
  let app;
  if (typeof app0 === 'string') app = apps.find(a=> a.name == app0);
  else app = app0;
  if (!app || app.system) return console.error("App "+ (typeof app0 === 'string' ? app0+" ": "") +"not found.");
  if (app.path.includes('/') && app.path.startsWith(app.name.split('.')[0]+'/')){
    try{
    await purgeDir(app.name.split('.')[0]+'/'); // ex: gm.html -> gm/*}
  }catch {
    return console.error('App found, but unable to delete the folder.')
  }
  }else{
    try{
    await deleteFile(app.path)
  }catch{
    return console.error('App found, but unable to delete the file.')
  }
  };
  apps = apps.filter(a=> a.name != app.name)

  delete permissions[app.name];
  localStorage.setItem('permissions',JSON.stringify(permissions));
  console.log("App "+ (typeof app0 === 'string' ? app0+" ": "") + "deleted successfully.")
  registerApps();
}

function setContentEditableSelection(container, start, length) {
    const range = document.createRange();
    const selection = window.getSelection();
    const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    
    let charCount = 0;
    let startNode, endNode, startOffset, endOffset;
    let node;

    while (node = walk.nextNode()) {
        const nodeLength = node.textContent.length;

        if (!startNode && charCount + nodeLength > start) {
            startNode = node;
            startOffset = start - charCount;
        }

        if (startNode && charCount + nodeLength >= start + length) {
            endNode = node;
            endOffset = (start + length) - charCount;
            break;
        }
        
        charCount += nodeLength;
    }

    if (startNode && endNode) {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
        container.focus();
    }
}

function rtfToHtml(rtf) {
    if (!rtf) return "";

    let html = rtf.replace(/[\r\n]/g, "");

    const getMargin = (cmd) => {
        const match = html.match(new RegExp(`\\\\${cmd}(\\d+)`));
        return match ? Math.round(match[1] / 1440 * 96) + "px" : "20px";
    };

    html = html.replace(/\\u(\d+)\??/g, (_, code) => String.fromCharCode(code));

    const fonts = {};
    const fontTableMatch = html.match(/\{\\fonttbl(.*?)\}/s);
    if (fontTableMatch) {
        const fontEntries = [...fontTableMatch[1].matchAll(/\{\\f(\d+)[^;]*?\s+([^;{}]+);/g)];
        fontEntries.forEach(match => fonts[match[1]] = match[2].trim());
    }

    html = html.replace(/\{\\fonttbl.*?\}|\{\\colortbl.*?\}|\{\\stylesheet.*?\}|\{\\info.*?\}|\{\\\*\\generator.*?\}/gs, "");


    html = html.replace(/\\f(\d+)\s?/g, (_, id) => `</span><span style="font-family:${fonts[id] || 'Arial'}">`);
    html = html.replace(/\\fs(\d+)\s?/g, (_, size) => `</span><span style="font-size:${size / 2}pt">`);

    html = html
        .replace(/\\b\s+(.*?)\\b0/g, "<b>$1</b>").trim()
        .replace(/\\i\s+(.*?)\\i0/g, "<i>$1</i>").trim()
        .replace(/\\ul\s+(.*?)\\ul0/g, "<u>$1</u>").trim()
        .replace(/\\strike\s+(.*?)\\strike0/g, "<s>$1</s>").trim()
        .replace(/\\bullet\s+/g, "• ").trim()
        .replace(/\\par\s?/g, "<br>").trim(); // Додано опціональний пробіл після \par

    html = html.replace(/\\(qc|qr|qj)\s+(.*?)(?=\\par|\\ql|\\qc|\\qr|\\qj|$)/g, (match, cmd, text) => {
        const align = {qc:'center', qr:'right', qj:'justify'}[cmd];
        return `<div style="text-align:${align}">${text}</div>`;
    });


    html = html.replace(/\\[a-z0-9-]+(\s|(?=[\\{}]))/gi, "").trim();

    html = html.replace(/[{}]/g, "").trim();

    html = html.replace(/\s\s+/g, ' ').trim();

    return html.trim();
}

function htmlToRtf(html) {
    let content = html

        .replace(/<(b|strong)>(.*?)<\/\1>/gi, "\\b $2\\b0 ")
        .replace(/<(i|em)>(.*?)<\/\1>/gi, "\\i $2\\i0 ")
        .replace(/<u>(.*?)<\/u>/gi, "\\ul $1\\ul0 ")
        .replace(/<(s|strike|del)>(.*?)<\/\1>/gi, "\\strike $2\\strike0 ")
          .replace(/<div[^>]+style="text-align:\s*center;?"[^>]*>(.*?)<\/div>/gi, "\\qc $1\\ql ")
      .replace(/<div[^>]+style="text-align:\s*right;?"[^>]*>(.*?)<\/div>/gi, "\\qr $1\\ql ")
      .replace(/<div[^>]+style="text-align:\s*justify;?"[^>]*>(.*?)<\/div>/gi, "\\qj $1\\ql ")

      .replace(/<li>(.*?)<\/li>/gi, "\\bullet  $1\\par ")

        .replace(/<div style="text-align:\s*center;?">(.*?)<\/div>/gi, "\\qc $1\\ql ")
        .replace(/<div style="text-align:\s*right;?">(.*?)<\/div>/gi, "\\qr $1\\ql ")

        .replace(/<br\s*\/?>/gi, "\\par ")
        .replace(/<p>(.*?)<\/p>/gi, "\\par $1 ")
        .replace(/<div>(.*?)<\/div>/gi, "\\par $1 ")

        .replace(/<[^>]+>/g, "");

    const header = "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs24 ";
    const body = content.split('').map(char => {
        const code = char.charCodeAt(0);
        return code > 127 ? `\\u${code}?` : char;
    }).join('');

    return header + body + "}";
}


async function makeApp(content, name, target, href, fileWinBox){
let safeTarget = target.replace(/'/g, "\\'"); 
const modUrl = (a,b, url) => {
  safeTarget = (safeTarget.split('?')[0]+url).replace('??',"?")
}      
let expand = '';  

if (content.includes('localStorage') || content.includes('fakeStorage')){
  expand += `fakeStorage.request()`;
  expand += `\n`
}

if (content.includes("new Notification(") && !content.includes("Notification.requestPermission()")){
    expand += `Notification.requestPermission()`;
    expand += `\n`
}

if (content.includes("navigator.geolocation.getCurrentPosition") && !content.includes("navigator.geolocation.request()")){
    expand += `fakeGeolocation.request()`;
        expand += `\n`
}

const redefiner1 = `
  <script>
  document.querySelectorAll('[title]').forEach(e => {
    parent.updateSystemPopover(e, e.title, true, true)
})


  document.querySelectorAll('iframe[sandbox]').forEach(e => {
    // Standard tokens
    e.sandbox.remove('allow-modals', 'allow-popups', 'allow-popups-to-escape-sandbox');
});
  </script>
`

const redefiner = `
<script>
  document.documentElement.style.cursor = 'wait';
 let permissions = parent.getPerms();
${notificationAPI
    .replaceAll(/window\.location\.href(?!\s*=)/g, `'${href}'`)
    .replaceAll(/document\.location\.href(?!\s*=)/g, `'${href}'`)
    .replaceAll(/document\.title(?!\s*=)/g, `'${name}'`)
}

window.addEventListener('contextmenu', (e) => {
    const isInput = ["TEXTAREA", "INPUT"].includes(e.target.tagName) || e.target.contentEditable == "true";
    if (isInput) {
        e.preventDefault();
        parent.drawEditContextMenu(e, document)
    }
})

// Спільна функція обробки та збереження файлу в Infinity OS
async function handleDownload(url, fileName) {
    const response = await fetch(url);
    const blob = await response.blob();

    const fileToSave = new File([blob], "downloads/" + fileName, {
        type: blob.type
    });

    parent.getFs().push(fileToSave);
    await parent.saveFileToDB(fileToSave);
    new parent.Notification("${name.replace(/'/g, "\\'")}", {body: parent._('saved_file_to').replace('{path}', fileToSave.name)})
}

function getDownloadName(anchor) {
    return (
        anchor.download ||
        anchor.getAttribute("download") ||
        anchor.href.split("/").pop() ||
        "download"
    );
}

function interceptDownload(anchor) {
    if (!anchor?.hasAttribute("download")) return false;

    handleDownload(anchor.href, getDownloadName(anchor));
    return true;
}

// Перехоплення a.click()
const originalAnchorClick = HTMLAnchorElement.prototype.click;

HTMLAnchorElement.prototype.click = function () {
    if (interceptDownload(this)) return;

    try {
        // FIX: Use 'this' instead of 'anchor'
        const clickedUrl = new URL(this.href);
        
        // This will definitely show up now!
        

        const assoc = parent.getUrlAssoc();
        if (assoc.hasOwnProperty(clickedUrl.origin)) {
            event.preventDefault()
            console.log("URL ASSOC FOUND!")
            const appPath = assoc[clickedUrl.origin];
            const targetUrl = appPath + "?url=" + encodeURIComponent(anchor.href);
    
    // Launch your Infinity OS application with the full payload
    parent.Openf("text/html", targetUrl);
            
            
            return; // Return early without calling originalAnchorClick
        } 
    } catch (e) {
        console.error("URL parsing failed inside prototype.click:", e);
    }

    return originalAnchorClick.call(this);
};

// Перехоплення dispatchEvent(new MouseEvent("click"))
const originalDispatch = HTMLAnchorElement.prototype.dispatchEvent;

HTMLAnchorElement.prototype.dispatchEvent = function (event) {
    if (event?.type === "click" && interceptDownload(this))
        return true;

    return originalDispatch.call(this, event);
};

// Перехоплення реального кліку користувача
window.addEventListener(
    "click",
    (e) => {
        const anchor = e.target.closest("a");
        if (!anchor) return; // Quick guard check

        if (interceptDownload(anchor)) {
            e.preventDefault();
            return;
        }

        try {
            const clickedUrl = new URL(anchor.href);
            const assoc = parent.getUrlAssoc();

            if (assoc.hasOwnProperty(clickedUrl.origin)) {
                e.preventDefault(); // Stop actual browser redirect
                const appPath = assoc[clickedUrl.origin];
                console.log("URL ASSOC FOUND!")
                const targetUrl = appPath + "?url=" + encodeURIComponent(anchor.href);

// Launch your Infinity OS application with the full payload
parent.Openf("text/html", targetUrl);
            }
        } catch (err) {
            // Ignore malformed URLs or javascript:void(0) links
        }
    },
    true
);


function buildPickerOptions(input) {
    const options = {
        multiple: input.multiple
    };

    if (input.accept && input.accept.trim()) {
        options.types = [{
            description: "",
            accept: {}
        }];

        for (const type of input.accept.split(",")) {
            const t = type.trim();

            if (t.startsWith(".")) {
                options.types[0].accept["application/octet-stream"] ??= [];
                options.types[0].accept["application/octet-stream"].push(t);
            } else if (t.endsWith("/*")) {
                options.types[0].accept[t] = [];
            } else if (t.includes("/")) {
                options.types[0].accept[t] = [];
            }
        }
    }
console.log(options)
    return options;
}

// Спільна функція для наповнення інпуту файлами та запуску івентів
async function populateInputWithPicker(input) {
    try {
        const handles = await showOpenFilePicker(buildPickerOptions(input));
        const files = await Promise.all(handles.map(h => h.getFile()));

        const dt = new DataTransfer();
        for (const file of files) {
            dt.items.add(file);
        }

        input.files = dt.files;

        // Генеруємо системні події, щоб додаток дізнався про вибір файлу
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (err) {
        // Якщо користувач просто закрив пікер (скасував вибір), нічого не робимо
        
    }
}

// 1. Перехоплення реального фізичного кліку користувача
document.addEventListener("click", (e) => {
    const input = e.target.closest('input[type="file"]');
    if (!input) return;

    // Зупиняємо стандартний провідник хост-машини
    e.preventDefault();
    e.stopImmediatePropagation();

    // Запускаємо наш кастомний системний пікер Infinity OS
    populateInputWithPicker(input);
}, true);

// 2. Перехоплення програмного виклику element.click() з JS-коду додатка
const originalClick = HTMLInputElement.prototype.click;

HTMLInputElement.prototype.click = function () {
    if (this.type !== "file") {
        return originalClick.call(this);
    }

    // КРИТИЧНО: Прибираємо async з самого прототипу, щоб не ламати синхронний потік додатка.
    // Просто викликаємо нашу асинхронну функцію у фоні.
    populateInputWithPicker(this);
};


// 2. Надійно знімаємо курсор, коли DOM повністю побудовано й завантажено
window.addEventListener('DOMContentLoaded', () => {
    document.documentElement.style.cursor = 'unset';
});

// Також про всяк випадок дублюємо на повне завантаження (якщо є важкі ресурси)
window.addEventListener('load', () => {
    document.documentElement.style.cursor = 'unset';
});
let allowedKeys = [];
const fakeStorage = {
  async request() {
      console.log('Requesting: LS');
      
  if (${!permissions || !permissions[name] || permissions[name].localStorage == null} ){
        const allow = await confirm(parent._('application_needs_permission')+"Local Storage drive (W)");
  parent.setPerm("${name}",'localStorage',allow);
 console.log("Permission request state: "+Boolean(${permissions[name] && permissions[name].localStorage}))
  } 
  },
  setItem(key, value) {
        if (${permissions[name] && permissions[name].localStorage == true}) {
            localStorage.setItem(String(key), String(value));
            allowedKeys.push(String(key));
        }
    },

    getItem(key) {
    allowedKeys.push(String(key));
        return localStorage.getItem(String(key));
    },

    removeItem(key) {
        if (allowedKeys.includes(String(key))) localStorage.removeItem(String(key));
    },

    clear() {
    localStorage.removeItem(k);
    },

    key(index) {
        return localStorage.key(index);
    },

    get length() {
        return localStorage.length;
    }
};
window.fakeStorage = fakeStorage;

  
  // 1. Зберігаємо
    const originalReplaceState = history.replaceState;
  const originalPushState = history.replaceState;

    // 2. Перевизначаємо на об'єкті history
    history.replaceState = (state, unused, url) => {}
  history.pushState = (state, unused, url) => {}

window.showOpenFilePicker = (...o)=> window.parent.showOpenFilePicker(...o);
window.showDirectoryPicker = (...o) => window.parent.showDirectoryPicker(...o);

const winKill = () => {
parent.kill('${fileWinBox.id}');  
  console.log('Close: '+ '${fileWinBox.id}')
}

alert = (...a)=>parent.alert(...a);
prompt = (...a)=>parent.prompt(...a);
confirm = (...a)=> parent.confirm(...a);
fetch = (...a) => parent.fetch(...a);
console = parent.console;
Worker = parent.Worker;
print = () => parent.print();

window.focus = () => parent.fore('${fileWinBox.id}');  
window.open = (...a)=> parent.window.open(...a)
window.blur = () => parent.blur('${fileWinBox.id}');

window.opener = null;
window.parent.close = () => {};
window.top = null;

window.fakeGeolocation = {
  request: async () => {
    const existing = permissions['${name}'];
    if (!existing || !existing.location && existing.location == null) {
        const allow = await parent.confirm(parent._('application_needs_permission') + "Location");
        parent.setPerm('${name}', 'location', allow); // Fixed variable reference
    }
  },

  getCurrentPosition: async (successCallback, errorCallback, options) => { // Added async here
        if (typeof successCallback !== 'function') return;
        if (${!permissions || !permissions[name] || permissions[name].location != true}) return; // Fixed variable references
        // Get your coordinates from wherever you want
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            if (!data || data.error) {
                if (typeof errorCallback === 'function') errorCallback({ code: 2, message: "Position unavailable", PERMISSION_DENIED: true });
                return; // Stop execution if API fails
            }
            // Create the readable query for the map frame

            successCallback({
                coords: {
                    latitude: data.latitude,
                    longitude: data.longitude,
                    accuracy: 50000,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null
                },
                timestamp: Date.now()
            });
        } catch {
            if (typeof errorCallback === 'function') errorCallback({ code: 2, message: "Position unavailable", POSITION_UNAVAILABLE: true });
        }
    },

    watchPosition: (successCallback, errorCallback, options) => {
        if (typeof successCallback !== 'function') return null;

        const watchId = Math.floor(Math.random() * 1000000);
        
        // Store the callbacks so updateSystemLocation can trigger them later
        activeWatches.set(watchId, { successCallback, errorCallback, options });

        // PLACE TO RETURN COORDS: Deliver the initial position right away by calling our fixed function directly
        setTimeout(() => {
            navigator.geolocation.getCurrentPosition(successCallback, errorCallback, options);
        }, 0);

        return watchId;
    },

    clearWatch: (watchId) => {
        activeWatches.delete(watchId);
    }
};

  ${expand}
try{
// 1. Create the observer
const globalTitleObserver = new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    // Check if an attribute changed and that attribute is 'title'
    if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
      const el = mutation.target;
      
      // Call your parent function
      parent.updateSystemPopover(el, el.title, true, true);
    }
  }
});

// 2. Start observing the entire document
globalTitleObserver.observe(document.body, {
  attributes: true,
  subtree: true,             // Traverses down to watch ALL elements inside the body
  attributeFilter: ['title'] // Ignores all changes except the 'title' attribute
});
}catch{}
  
  
</script>
`;



let modifiedContent = content;
// Регулярний вираз для пошуку атрибута multiple всередині тегів <input>
const multipleRegex = /(<input[^>]*?)\s+multiple(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?([^>]*>)/gi;

// 2. Заміна
modifiedContent = modifiedContent.replaceAll(/document\.location\.href(?!\s*=)/g, `'${href}'`);
modifiedContent = modifiedContent.replaceAll(/window\.location\.href(?!\s*=)/g, `'${href}'`);
modifiedContent = modifiedContent.replaceAll(/location\.href(?!\s*=)/g, `'${href}'`);
modifiedContent = modifiedContent.replaceAll(/document\.title(?!\s*=)/g, `'${name}'`)

modifiedContent = modifiedContent.replaceAll(/document\.location\.search(?!\s*=)/g, `'${safeTarget}'`);
modifiedContent = modifiedContent.replaceAll(/window\.location\.search(?!\s*=)/g, `'${safeTarget}'`);
modifiedContent = modifiedContent.replaceAll(/location\.search(?!\s*=)/g, `'${safeTarget}'`);

modifiedContent = modifiedContent.replaceAll('window.close()', 'winKill()');
modifiedContent = modifiedContent.replaceAll('self.close()', 'winKill()');
modifiedContent = modifiedContent.replaceAll('this.close()', 'winKill()');

modifiedContent = modifiedContent.replace(multipleRegex, '$1$2');

modifiedContent = modifiedContent.replaceAll('navigator.geolocation', 'fakeGeolocation');

modifiedContent = modifiedContent.replaceAll('localStorage', 'fakeStorage');
modifiedContent = modifiedContent.replaceAll('Object.keys(fakeStorage)', 'Object.keys(localStorage)');
modifiedContent = modifiedContent.replaceAll('Object.keys(window.fakeStorage)', 'Object.keys(localStorage)');

return [modifiedContent, redefiner, redefiner1];
}
/**
 * Відкриває файл у новому вікні WinBox.
 * * @param {Event | File | string} source - Об'єкт події DOM, об'єкт File, або ім'я файлу (рядок).
 * @param {function} refr - Функція оновлення (наприклад, null).
 * @param {string} [type=null] - Примусовий MIME-тип (наприклад, "text/plain").
 * @param {File} [file=null] - Об'єкт файлу, якщо 'source' є подією, але викликано з контекстного меню.
 */
function Openf(type, file = null, allowOpenWith = true) {

    let fileWinBox;
    let fileType = "unknown";
    let exfile = null;      // Found File object
    let filestr = null;     // File name
    let isEditable = false;
    const uniqueFileId = "content-" + Date.now();

    const fileOrName =
        typeof file === "string" ? file.split("?")[0] : file;

    if (typeof fileOrName === "string") {
        filestr = fileOrName;
        exfile = fs.find(f => f.name.trim() === filestr.trim());
    } else if (fileOrName instanceof File) {
        exfile = fileOrName;
        filestr = exfile.name;
    }

    if (!exfile) {
        console.error("File not found (Direct call): " + fileOrName);
        return;
    }

    fileType = type || exfile.type;

    const ic = getIcon(exfile);

    if (allowOpenWith) {
        const nm = typeof file === "object" ? file.name : file;

        if (getExt(exfile) && !nm.includes("?") && !nm.includes("=")) {
            const config = FILE_TYPES[exfile.name.split(".").pop()];

            if (config?.openWith && config.openWith !== "openf") {
                const app = apps.find(app => app.path === config.openWith);
                if (!app) return;

                Openf(
                    getMimeType(app.path),
                    `${app.path}?${app.openWithParam}=${exfile.name}`
                );
                return;
            }
        }
    }

    const w = 600;
    const h = 400;

    const typeclass = fileType.split("/")[0];

    fileWinBox = new wm(filestr, {
        icon: ic,
        x: "center",
        y: "center",
        class: [wbtheme, typeclass, "hidden"],
        minheight: 200,
        minwidth: 255,
        width: w,
        height: h,
        html: `<div class='loading' style="padding: 10px; color: black; height: 100%; text-align: center; overflow: hidden;">${_('loading_text')}</div>`
    });


    const reader = new FileReader();

    reader.onload = async function(e) {
        const content = e.target.result;
        let newContent = '';


  fileWinBox.removeClass("hidden");

        
        if (fileType == "application/x-theme") {

localStorage.setItem("theme", exfile.name);
try{
        const parser = new ThemeParser();
        const thm = parser.parse(content); 
parser.applyTheme(thm.styles)
applyThemeToUI(thm.name)
}catch{
loadTheme()
}
fileWinBox.close();
}            
        
if (fileType.startsWith("font/") || fileType === "application/x-font-ttf" || fileType === "application/font-woff") {

    const fontName = exfile.name;
    
    // 2. Map the fileType to the proper CSS format() string
    let cssFormat = "";
    if (fileType.includes("woff2")) {
        cssFormat = 'format("woff2")';
    } else if (fileType.includes("woff")) {
        cssFormat = 'format("woff")';
    } else if (fileType.includes("ttf") || fileType.includes("truetype")) {
        cssFormat = 'format("truetype")';
    } else if (fileType.includes("otf") || fileType.includes("opentype")) {
        cssFormat = 'format("opentype")';
    }

    newContent = `
    <style>
        @font-face {
            font-family: '${uniqueFileId}';
            /* Added the dynamic format hint here */
            src: url(${e.target.result}) ${cssFormat};
        }
        .preview-container-${uniqueFileId} { 
            font-family: '${uniqueFileId}', serif !important; 
            padding: 15px;
        }
    </style>

    <div class="toolbar">
        <button onclick="updateFonts('add', '${fontName}')">${_('add')}</button>
        <button onclick="updateFonts('delete', '${fontName}')">${_('delete_btn')}</button>
        <button onclick="updateFonts('set', '${fontName}')">${_('apply')}</button>
    </div>

    <div class="no-font preview-container-${uniqueFileId}">
        <h2>Lorem Ipsum</h2>
        <p>"Neque porro quisquam est qui dolorem ipsum..."</p>
        <small>"There is no one who loves pain itself..."</small>
        <h2>1234567890</h2>
        <pre>@ # $ _ & - + () / * " ' : ; ! ?</pre>
    </div>
    `;
}
else if (fileType === "text/csv") {
  isEditable = true;

  const rows = content.split("\n").map(row => row.split(","));
  
  let tableHtml = `
    <table id="${uniqueFileId}" style="width:100%; border-collapse:collapse;">`;
  
  rows.forEach((row, rowIndex) => {
    tableHtml += "<tr>";
    row.forEach((cell, cellIndex) => {
      tableHtml += `<td contenteditable="true" 
                        style="border:1px solid #ccc; padding:5px; min-width:50px;">
                        ${cell}</td>`;
    });
    tableHtml += "</tr>";
  });
  
  tableHtml += `</table>
    <style>
      #${uniqueFileId} td:focus { outline: 2px solid #0078d7; background: #f0f0f0; }
    </style>`;

  newContent = `
                <div class="toolbar">
                            <button id="saveBtn-${uniqueFileId}" >${_('save_btn')}</button>
                                <button id="printBtn-${uniqueFileId}" >${_('print_btn')}</button>
                                <button id="findBtn-${uniqueFileId}" >${_('find_btn')}</button>
                                
  <vr></vr> <button style='width:25px' id="+Btn-${uniqueFileId}" onclick='getElementById("${uniqueFileId}").style.fontSize = parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"))+5+"px";' >+</button>
                            <button style='width:25px' id="-Btn-${uniqueFileId}" onclick='getElementById("${uniqueFileId}").style.fontSize = (parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size")) > 5 ) ? parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"))-5+"px": parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"));' style="padding: 4px 8px; border: 1px solid #aaa; background-color: #ddd; ">-</button></div>
  `+tableHtml;
} else if (fileType === "application/rtf" || fileType === "text/markdown" || fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    isEditable = true;
    fileWinBox.addClass("file-e");


if (fileType == "application/rtf") {
        initialHtml = rtfToHtml(content);
    } else if (fileType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const options = {
            styleMap: [
                "p[style-name='Center'] => p.text-center",
                "p[style-name='Right'] => p.text-right",
                "p[style-name='Left'] => p.text-left"
            ]
        };

        const result = await mammoth.convertToHtml({arrayBuffer: content}, options);
        initialHtml = result.value;
        
    } else {
        initialHtml = marked.parse(content);
    }

    window.input = (text) => {
try{
        const symLabel = fileWinBox.body.querySelector("#sym");
        if (symLabel) symLabel.innerText = text.length;
}catch{}
    }

    newContent = `
<div style="background: #e0e0e0; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">

    <div class="toolbar" style="position: sticky; top: 0; overflow-x: auto; z-index: 2;">
        <button id="saveBtn-${uniqueFileId}">${_('save_btn')}</button>
        <button id="printBtn-${uniqueFileId}">${_('print_btn')}</button>
        <button id="findBtn-${uniqueFileId}">${_('find_btn')}</button>

        <vr></vr>

        <button onclick="document.execCommand('bold')"><b>B</b></button>
        <button onclick="document.execCommand('italic')"><i>I</i></button>
        <button onclick="document.execCommand('underline')"><u>U</u></button>
        <button onclick="document.execCommand('strikethrough')"><strike>S</strike></button>

        <button onclick="document.execCommand('insertUnorderedList')">UL</button>
        <button onclick="document.execCommand('insertOrderedList')">OL</button>
        <vr></vr>
        <button onclick="document.execCommand('justifyLeft')">L</button>
        <button onclick="document.execCommand('justifyCenter')">C</button>
        <button onclick="document.execCommand('justifyRight')">R</button>
    </div>

    <div style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px 0;">
        <div contenteditable="true"
             class='no-font'
             oninput='input(this.innerText)'
             id="${uniqueFileId}"
             style="margin: 0 auto;
                    width: 500px;
                    outline: none;
                    background: white;
                    color: black;
                    white-space: pre-wrap;
                    aspect-ratio: 210 / 297;
                    box-sizing: border-box;
                    box-shadow: 0 0 15px rgba(0,0,0,0.2);">${initialHtml}</div>
    </div>

    <div class="footer" style="justify-content: space-between; background: #f5f5f5; padding: 5px; margin: 0; border-top: 1px solid #ccc; font-size: 12px; color: #555;">
        <span id="sym"></span>
        <input type="range"
               oninput='document.getElementById("${uniqueFileId}").style.width = this.value + "px"'
               min="200" max="1200" value="500" step="50"
               style="margin-right: 10px; cursor: pointer;" />
    </div>

</div>
    `;

    setTimeout(() => {
        const el = document.getElementById(uniqueFileId);
        if (el) window.input(el.innerText);
    }, 10);
} else if (fileType.startsWith("text/") || !exfile.name.split("/").pop().substring(1).includes(".")) {
            
            if (fileType == "text/html"){
                const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
if (titleMatch) fileWinBox.setTitle( titleMatch[1].trim())
                
                const iconMatch = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
    if (iconMatch) fileWinBox.setIcon(iconMatch[1])
    else fileWinBox.setIcon('')

         const name = (titleMatch) ? titleMatch[1].trim() : exfile.name;
       const target = typeof file == 'string' ? '?'+file.split('?').pop() : '';

       const href = typeof file == 'string' ? file : exfile.name;

let [modifiedContent, redefiner, redefiner1] = await makeApp(content, name,target,href, fileWinBox);




if (content.includes("new Notification(") ) {
    
    fileWinBox.onclose = (urgent) => {
        if (!urgent) {

            console.log(`Background mode activated for ${fileWinBox.title}`);
            fileWinBox.hide();
            return true; // Перехоплюємо закриття
        } else {
            console.log(`Force close! Terminating background process.`);
            return false; // Дозволяємо системі знищити вікно
        }
    };
}

fileWinBox.addClass("file-r");
newContent = `
      <div style="height: 100%; width: 100%;">
          <iframe 
              id="fileWinBox-frame-${fileWinBox.id}"
              srcdoc=" ${redefiner.replace(/"/g, '&quot;')} ${modifiedContent.replace(/"/g, '&quot;')} ${redefiner1.replace(/"/g, '&quot;')}" 
              style="width: 100%; height: 100%; border: none;"
              onload="parent.applySystemConfig('${fileWinBox.id}')">
          </iframe>
      </div>
`;
            } 
            else if (fileType == "text/javascript"){
                
                newContent = eval(content);
                fileWinBox.close();
            } else {
                isEditable = true;
                fileWinBox.addClass("file-e");
                const safeContent = content.replace(/&/g, '&amp;')
                                           .replace(/</g, '&lt;')
                                           .replace(/>/g, '&gt;')
                                           .replace(/"/g, '&quot;')
                                           .replace(/'/g, '&#039;'); 
                                           
                newContent = `
            <div style="height: 100%; display: flex;white-space: nowrap; flex-direction: column;">
                <div class="toolbar">
                            <button id="saveBtn-${uniqueFileId}" >${_('save_btn')}</button>
                                <button id="printBtn-${uniqueFileId}" >${_('print_btn')}</button>
                                <button id="findBtn-${uniqueFileId}" >${_('find_btn')}</button>
                                
  <vr></vr> <button style='width:25px' id="+Btn-${uniqueFileId}" onclick='getElementById("${uniqueFileId}").style.fontSize = parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"))+5+"px";' >+</button>
                            <button style='width:25px' id="-Btn-${uniqueFileId}" onclick='getElementById("${uniqueFileId}").style.fontSize = (parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size")) > 5 ) ? parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"))-5+"px": parseFloat(window.getComputedStyle(getElementById("${uniqueFileId}")).getPropertyValue("font-size"));' style="padding: 4px 8px; border: 1px solid #aaa; background-color: #ddd; ">-</button></div>
                        <textarea id="${uniqueFileId}" style="flex-grow: 1; height:100%; resize: none; border:none; padding: 10px; font-size: 15px;">${safeContent}</textarea>
                    </div>
                `;
             

            }
            
        } else if (fileType.startsWith("image/")) {

            newContent = `<div style="text-align: center; height: 100%; width: 100%; overflow-y:hidden;">
                              <img src="${content}" style="max-width: 100%; height:100%; max-height: 100%; object-fit: contain;padding:0; margin:0;">
                          </div>`;
                          
        } else if (fileType.startsWith("audio/")) {

    // This updates the window setup rules
          fileWinBox.width = 265;
          fileWinBox.height = 180;
          fileWinBox.resize();
          fileWinBox.setTitle(fileWinBox.title.split('/').pop().split('.')[0]);
    fileWinBox.addClass("no-resize")
    fileWinBox.addClass("no-max")
    fileWinBox.addClass("tra")

    const fileName = exfile.name.split("/").pop(); // Отримуємо назву файлу
    
    newContent = `
      <style>
      .blinking{
      animation: blinking 1s infinite step-end; 
      }
/* The animation code */
@keyframes blinking {
  0% {opacity: 0;}
  50% {opacity: 1;}
}


.snd {
  /* Remove default browser styling */
  appearance: none;
  -webkit-appearance: none;
  
  width: 90%;
  height: 15px;
  margin-left: 5px;
  border-radius: 0px;
}

/* Container styling for Chrome/Safari/Edge */
.snd::-webkit-meter-bar {

  border: none;
  border-radius: 0px;
}

/* The actual moving value bar for Chrome/Safari/Edge */
.snd::-webkit-meter-optimum-value {
  background-image: repeating-linear-gradient(
    to right,
    #4caf50,
    #4caf50 6px,       /* Segment width (6px green) */
    transparent 6px,   /* Gap starts exactly where green ends */
    transparent 9px    /* Gap ends here (3px transparent space) */
  );
  background-size: auto 100%;
  border-radius: 0px;
}

/* For Firefox container */
.snd::-moz-meter-bar {

  background-image: repeating-linear-gradient(
    to right,
    #4caf50,
    #4caf50 6px,
    transparent 6px,
    transparent 9px
  );
}

      </style>
<div style="display: flex; flex-direction: column; height: 100%; width: 100%;  overflow: hidden;">
    
    <div style="display: flex; height: 70px;">
        
        <div id="time-block-${uniqueFileId}" style="display: flex; flex-direction: column; width: 130px; border-right: 1px solid #444; background:rgba(0,0,0,0.5); color: #00ff00; font-family: monospace; font-weight: bold; display: flex; align-items: center; justify-content: center; position: relative;border-bottom-left-radius:10px;">

      <div style="display: flex; flex-direction: column; gap: 2px; width: 100%;">
            <meter id="meter-l-${uniqueFileId}" min="0" max="100" value="0" class='snd' style="flex-grow: 1;  display: block;"></meter>
            <meter id="meter-r-${uniqueFileId}" min="0" max="100" value="0" class='snd' style="flex-grow: 1; display: block;"></meter>
</div>
<div style="display: flex; flex-direction: row; line-height:15px;">
            <sub id="play-status-${uniqueFileId}"  style="color:#aa0000;">\u25FC</sub>
            
            <b id="time-text-${uniqueFileId}" >0:00</b>
      </div>
            

        </div>

        <div style="flex-grow: 1;  background:rgba(0,0,0,0.5); overflow: hidden; display: flex; align-items: center; border-bottom-right-radius:10px;">
      
            <marquee scrollamount="1" style="font-size: 18px; font-weight: bold; color: white; display: block;  width: 100%;font-family: monospace;">${fileName}</marquee>
        </div>
    </div>

    <div style="padding: 10px; display: flex; align-items: center;">
        <input type="range" id="seek-${uniqueFileId}" style="flex-grow: 1; height: 10px;" min="0" max="100" value="0">
    </div>

    <div style="padding: 5px;display: flex; justify-content: space-evenly; align-items: center; color:black;">
        
        <button id="ctrl-prev-${uniqueFileId}" title="Prev" ><</button>
        <button id="ctrl-pause-${uniqueFileId}" style="color:yellow;">||</button>
        <button id="ctrl-play-${uniqueFileId}"  style="flex:1; color:#0a0;" >\u25B6</button>
        <button id="ctrl-stop-${uniqueFileId}"  style="color:#a00;" >\u25FC</button>
        <button id="ctrl-next-${uniqueFileId}" title="Next" >></button>
    </div>

    <audio id="${uniqueFileId}" src="${content}" autoplay></audio>

</div>`;


    const formatTime = (seconds) => {
        if (isNaN(seconds)) return "0:00";
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const stopProgressInterval = () => {
        if (fileWinBox._audioIntervalId) {
            clearInterval(fileWinBox._audioIntervalId);
            delete fileWinBox._audioIntervalId;
        }
    };

const updateUI = () => {
        const audioPlayer = document.getElementById(uniqueFileId);

        if (!audioPlayer) return;
        audioPlayer.volume  =vol;

        const timeText = document.getElementById(`time-text-${uniqueFileId}`);
        const seekRange = document.getElementById(`seek-${uniqueFileId}`);
        const playStatus = document.getElementById(`play-status-${uniqueFileId}`);

        try {
            if (audioPlayer.canPlayType && !audioPlayer.canPlayType(fileType)) fileWinBox.close();
        } catch (e) {}
        
        if (isNaN(audioPlayer.duration)) return;

        if (timeText) {
            timeText.innerText = formatTime(audioPlayer.currentTime);
        }
        if (seekRange) {
            seekRange.value = ((audioPlayer.currentTime / audioPlayer.duration) * 100);
        }

        if (playStatus) {
            if (audioPlayer.paused) {
                if (audioPlayer.currentTime == 0) {
                    playStatus.style.color = '#aa0000'; // Stopped (Red Square implied by image's context)
                    playStatus.innerText = '\u25FC';
                    playStatus.classList.remove("blinking");
                } else {
                    playStatus.style.color = 'yellow'; // Paused (Pause icon from image 0.png is static)
                    playStatus.innerText = '||';
                    playStatus.classList.remove("blinking");
                }
            } else {
                playStatus.style.color = '#00aa00'; // Playing (Green Triangle blinks, as requested)
                playStatus.innerText = '\u25B6';
                playStatus.classList.add("blinking");
            }}

            
        const progress = ((audioPlayer.currentTime / audioPlayer.duration) * 100).toFixed(2);
        const gradient = `linear-gradient(to right, rgba(0, 128, 0, 0.5) 0%, rgba(0, 128, 0, 1.0) ${progress}%, transparent ${progress}%, transparent 100%)`;
        const combinedBackground = `${gradient}, var(--color-win-ina)`;
        
        if (fileWinBox.min){
        fileWinBox.addClass("play")
        fileWinBox.setBackground(combinedBackground);
    }else{
    
    fileWinBox.removeClass("play");
    }
}


    setTimeout(() => {
        const player = document.getElementById(uniqueFileId);
        if (!player) return;
player.play();
        player.ontimeupdate = updateUI;

        const meterL = document.getElementById(`meter-l-${uniqueFileId}`);
        const meterR = document.getElementById(`meter-r-${uniqueFileId}`);
        
if (meterL && meterR) {
    if (!player._audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        player._audioCtx = new AudioContext();
        player._source = player._audioCtx.createMediaElementSource(player);
        
        player._splitter = player._audioCtx.createChannelSplitter(2);
        player._analyserL = player._audioCtx.createAnalyser();
        player._analyserR = player._audioCtx.createAnalyser();
        
player._analyserL.fftSize = 32;
player._analyserR.fftSize = 32;


// A tighter decibel window means smaller acoustic changes span the entire 0-255 spectrum
player._analyserL.minDecibels = -45; 
player._analyserL.maxDecibels = -10;

player._analyserR.minDecibels = -45;
player._analyserR.maxDecibels = -10;

        player._source.connect(player._splitter);
        player._splitter.connect(player._analyserL, 0); // Лівий
        player._splitter.connect(player._analyserR, 1); // Правий
        
        player._source.connect(player._audioCtx.destination);
    }

    const bufferLength = player._analyserL.frequencyBinCount;
    const dataArrayL = new Uint8Array(bufferLength);
    const dataArrayR = new Uint8Array(bufferLength);

    let animationFrameId;

    const updateMeters = () => {

        const currentPlayer = document.getElementById(uniqueFileId);
        const mL = document.getElementById(`meter-l-${uniqueFileId}`);
        const mR = document.getElementById(`meter-r-${uniqueFileId}`);
        
        if (!currentPlayer || !mL || !mR || currentPlayer.paused) {

            if (mL) mL.value = 0;
            if (mR) mR.value = 0;
            if (!currentPlayer || !mL) {
                cancelAnimationFrame(animationFrameId);
                return;
            }
        }

        animationFrameId = requestAnimationFrame(updateMeters);

        player._analyserL.getByteFrequencyData(dataArrayL);
        player._analyserR.getByteFrequencyData(dataArrayR);

const getVolumeFromFrequencies = (dataArray) => {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    
    // 1. Get raw linear ratio (0.0 to 1.0)
    const linearRatio = (sum / dataArray.length) / 255;
    
    // 2. Apply a fractional exponent (Power less than 1 boosts small numbers)
    // 0.5 is a square root (high boost). Try 0.33 for an even crazier hyper-jump.
    const hypersensitiveRatio = Math.pow(linearRatio, 0.4); 
    
    // 3. Scale back to 0-100%
    return hypersensitiveRatio * 100;
};

const volL = getVolumeFromFrequencies(dataArrayL);
const volR = getVolumeFromFrequencies(dataArrayR);

// No more flat multipliers needed; the math handles the sensitivity distribution!
mL.value = volL;
mR.value = volR;
    };

    player.onplay = () => {

        if (player._audioCtx.state === 'suspended') {
            player._audioCtx.resume();
        }
        updateMeters();
    };
    
    player.onpause = () => {
        meterL.value = 0;
        meterR.value = 0;
    };

    if (!player.paused) {
        updateMeters();
    }
}

        const seekInput = document.getElementById(`seek-${uniqueFileId}`);
        seekInput.oninput = function() {
            player.currentTime = (this.value / 100) * player.duration;
            updateUI(); // Immediate update when seekbar moves
        };

        document.getElementById(`ctrl-prev-${uniqueFileId}`).onclick = () => { player.currentTime -= 10; updateUI(); };
        document.getElementById(`ctrl-play-${uniqueFileId}`).onclick = () => { player.play(); updateUI(); };
        document.getElementById(`ctrl-pause-${uniqueFileId}`).onclick = () => { player.pause(); updateUI(); };
        document.getElementById(`ctrl-stop-${uniqueFileId}`).onclick = () => { player.pause(); player.currentTime = 0; updateUI(); };
        document.getElementById(`ctrl-next-${uniqueFileId}`).onclick = () => { player.currentTime += 10; updateUI(); };

    }, 50);
    
    
updateUI()

    fileWinBox.onminimize = function() {
        updateUI();
        stopProgressInterval();
        fileWinBox._audioIntervalId = setInterval(updateUI, 500);
    };

    fileWinBox.onrestore = function() {
        fileWinBox.setBackground('transparent');
        stopProgressInterval();
    };

    fileWinBox.onblur = function() {
        fileWinBox.setBackground('transparent');
        stopProgressInterval();
    };

    fileWinBox.onclose = function() {
        fileWinBox.setBackground('transparent');
        stopProgressInterval();
    };
} else if (fileType.startsWith("video/")) {

            newContent = `<div style="height: 100%; overflow-y:hidden;"> <video controls src="${content}" style="width: 100%; height: 100%;max-width: 100%; max-height: 100%; object-fit: contain;padding:0; margin:0;"></video> </div>`;
            
        } else if (fileType == "application/pdf" && navigator.pdfViewerEnabled) {
            newContent= `
             <div style="height: 100%; overflow-y:hidden;">
             <embed src="${content}" type="application/pdf" style="width: 100%; height: 100%;">
             </div> 
            `;
        } else {

            newContent = `<div style="padding: 10px; color: black;">${_('unsupported_file_type')}</div>`;
        }
        
        try{
            fileWinBox.body.innerHTML = newContent;
        }catch{
            console.warn('Running non-window application. Exiting GPU draw.')
        }

        if (isEditable) {

            const printButton = fileWinBox.body.querySelector(`#printBtn-${uniqueFileId}`);
            const findButton = fileWinBox.body.querySelector(`#findBtn-${uniqueFileId}`);
            const saveButton = fileWinBox.body.querySelector(`#saveBtn-${uniqueFileId}`);
            const textArea = fileWinBox.body.querySelector(`#${uniqueFileId}`);



if (exfile.name.endsWith(".html") || exfile.name.endsWith(".htm")) printButton.disabled = true;

                fileWinBox.body.addEventListener('keydown', async function(event) { // ЗРОБЛЕНО ASYNC



                    if (event.ctrlKey || event.metaKey) {	

                        const isSave = event.key.toLowerCase() === 's';
						const isPrint = event.key.toLowerCase() === 'p';
						const isFind = event.key.toLowerCase() === 'f';
if (!isSave && !isPrint && !isFind) return;
						event.preventDefault()
                        
                        if (isSave) saveButton.click();
                        if (isPrint) printButton.click();
                        if (isFind) findButton.click();             


}
                });
                
let isConfirmedClose = false; // Прапорець, який дозволить чисте знищення вікна

fileWinBox.onclose = function(urgent) {
    // Якщо закриття примусове (urgent) або ми вже пройшли перевірку збереження — закриваємо без питань
    if (urgent || isConfirmedClose) {
        return false; // Дозволяємо системі знищити вікно
    }

    // Якщо є незбережені зміни (або isEditable), перехоплюємо закриття
    // Запускаємо асинхронний діалог у фоні
    (async () => {

        const save = await confirm(_("confirm_save_file").replace('{file}', exfile.name.split('/').pop() ));
        if (save) {
            saveButton.click(); // Твій фіксований збір CSV чи тексту
        }
        
        // Змінюємо стан запобіжника і програмно викликаємо закриття знову!
        isConfirmedClose = true;
        fileWinBox.close(); 
    })();

    return true; // МИТТЄВО перехоплюємо перше натискання хрестика, щоб вікно не зникло завчасно
};


findButton.onclick = async () => {
    const query = await prompt(_("find_btn"));
    if (!query) return;

    const isTextarea = textArea.tagName.toLowerCase() === "textarea";

    if (isTextarea) {

        const text = textArea.value;
        const index = text.toLowerCase().indexOf(query.toLowerCase());

        if (index !== -1) {
            textArea.focus();
            textArea.setSelectionRange(index, index + query.length);

            const lineHeight = parseFloat(window.getComputedStyle(textArea).lineHeight);
            const charsBefore = text.substring(0, index).split('\n');
            const currentRow = charsBefore.length;
            textArea.scrollTop = (currentRow * lineHeight) - (textArea.clientHeight / 2);
        } else {
            await alert(_("not_found"));
        }
    } else {

        const container = textArea;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let textNode;
        let found = false;

        while (textNode = walker.nextNode()) {
            const index = textNode.nodeValue.toLowerCase().indexOf(query.toLowerCase());
            
            if (index !== -1) {
                const range = document.createRange();
                const selection = window.getSelection();
                
                range.setStart(textNode, index);
                range.setEnd(textNode, index + query.length);
                
                selection.removeAllRanges();
                selection.addRange(range);
                
                textNode.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                found = true;
                break;
            }
        }

        if (!found) await alert(_("not_found"));
    }
};


printButton.onclick = async () => {
    const isTextarea = textArea.tagName.toLowerCase() === "textarea";
    let newTextContent;
    
      newTextContent = isTextarea ? textArea.value : textArea.innerHTML;
  
    
    const iframe0 = document.createElement('iframe');


    document.body.appendChild(iframe0);

    const doc = iframe0.contentWindow.document;
iframe0.contentWindow.print = window.print;

    doc.open();

    doc.write('<html><head><title>Print</title></head><body>' + newTextContent + '</body></html>');
    doc.close();

    iframe0.contentWindow.focus(); 
    iframe0.contentWindow.print();


    setTimeout(() => {
        document.body.removeChild(iframe0);
    }, 1000);
}

function normalizeHTML(html) {
    return html
        .replace(/<div>/g, "<p>")
        .replace(/<\/div>/g, "</p>")
        .replace(/<br>/g, "<br/>")
        .replace(/&nbsp;/g, " ");
}

saveButton.onclick = async () => { // ЗРОБЛЕНО ASYNC
console.log("SAVE")
                const isTextarea = textArea.tagName.toLowerCase() === "textarea";
let newTextContent;
if (isTextarea) {
newTextContent = textArea.value;
}else{
if (fileType == "application/rtf"){
newTextContent = htmlToRtf(textArea.innerHTML);
}else if (fileType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"){
    const paddingPx = parseInt(window.getComputedStyle(textArea).paddingLeft) || 20;
    const marginTwips = Math.round((paddingPx / 96) * 1440);

const cleanHtml = `<!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <title>${exfile.name}</title>
        </head>
        <body>
            ${textArea.innerHTML}
        </body>
    </html>`;
    newTextContent = await window.HTMLToDOCX(cleanHtml, null, { orientation: 'portrait' });

} else if (fileType === "text/csv") {
    // Цей код має виконуватися при натисканні на saveBtn
const table = document.getElementById(`${uniqueFileId}`);
const rows = Array.from(table.querySelectorAll('tr'));

const csvContent = rows.map(tr => {
    // Беремо всі клітинки поточного рядка
    const cells = Array.from(tr.querySelectorAll('td'));
    
    // Чистимо текст кожної клітинки від внутрішніх переносів, які міг наставити contenteditable
    return cells.map(td => {
        return td.textContent.replace(/[\n\r]/g, '').trim();
    }).join(",");
}).join("\n");

// Тепер записуємо чистий CSV-текст назад у систему
newTextContent = csvContent; 


}else{
var turndownService = new TurndownService()
newTextContent = turndownService.turndown(textArea.innerHTML)
}
}

                const newFile = new File([newTextContent], exfile.name, { type: exfile.type ,lastModified: Date.now() });

                const index = fs.findIndex(item => item.name === exfile.name);
                if (index !== -1) {
                    fs[index] = newFile;

                    if (currentDisk && currentDisk.type != "localStorage"){   await saveFileToDB(newFile);
                            } else{
                    localStorage.setItem(exfile.name, newTextContent)
                            }
                    

                }
            };
        }
    } 

    if (fileType.startsWith("text/") ||!exfile.name.split("/").pop().substring(1).includes(".")  || fileType == "application/x-theme"  || fileType== "application/rtf") {
        console.log("readAsText");
        reader.readAsText(exfile);
    } else if (fileType.startsWith("image/") || fileType.startsWith("audio/") || fileType.startsWith("video/") || fileType.startsWith("font/") || fileType == "application/pdf") {
        console.log("readAsDataURL")
        reader.readAsDataURL(exfile);
    } else {
        console.log("readAsArrayBuffer")
        reader.readAsArrayBuffer(exfile);
    }


} 

// Функція повертає true, якщо файл відповідає фільтрам, або якщо фільтрів немає
function isFileAllowed(fileName, opts) {
    if (!opts?.types?.length) return true;
    if (opts.runAs === 'dir') return false;

    const ext = '.' + fileName.split('.').pop().toLowerCase();
    const mime = FILE_TYPES[ext.slice(1)]?.mime;

    if (!mime) return false;

    return opts.types.some(type =>
        Object.entries(type.accept ?? {}).some(([allowedMime, allowedExts]) => {
            // 1. Обробка масок типу "image/*", "audio/*", "video/*"
            if (allowedMime.endsWith('/*')) {
                const baseType = allowedMime.split('/')[0]; // отримуємо "image"
                const appBaseType = mime.split('/')[0];     // отримуємо "image"
                if (baseType === appBaseType) return true;
            }

            // 2. Ситуація, коли додаток передав сумісний MIME-тип (наприклад, image/jpeg для .jpg)
            // Або якщо додаток використовує універсальний application/octet-stream
            const mimeMatch = (allowedMime === mime) || 
                              (allowedMime === 'application/octet-stream') ||
                              (mime === 'image/jpeg' && allowedMime === 'image/jpg') || // фікс сумісності старих ліб
                              (mime === 'image/png' && allowedMime === 'image/apng');

            if (!mimeMatch) return false;

            // Empty array means "all extensions for this MIME"
            if (!allowedExts || !allowedExts.length) return true;

            // 3. Перевіряємо, чи є наше розширення серед явного списку дозволених додатком
            // Додатково нормалізуємо (прибираємо/додаємо крапку для надійності)
            return allowedExts.some(e => {
                const cleanE = e.startsWith('.') ? e.toLowerCase() : '.' + e.toLowerCase();
                
                // Рівносильність jpg та jpeg на рівні ядра
                if ((ext === '.jpg' || ext === '.jpeg') && (cleanE === '.jpg' || cleanE === '.jpeg')) {
                    return true;
                }
                
                return cleanE === ext;
            });
        })
    );
}


/**
 * Перетворює байти у читабельний рядок (KB, MB, GB).
 * @param {number} bytes Кількість байтів.
 * @returns {string} Форматований рядок.
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


async function zipFolder(folderPath, zipName = null, compress = false) {
    const zip = new JSZip();

    const cleanFolderPath = folderPath.replace(/\/+$/, "") + "/";
    const folderName = cleanFolderPath.split("/").filter(Boolean).pop();


    const pathParts = cleanFolderPath.split("/").filter(Boolean);
    pathParts.pop();
    const parentPath = pathParts.length > 0 ? pathParts.join("/") + "/" : "";

    const finalZipName = (zipName === null) ? `${folderName}.zip` : (zipName.endsWith('.zip')) ? zipName : zipName+".zip" ;
    const archivePath = (zipName === null) ?  parentPath + finalZipName : finalZipName;

    for (const f of fs) {

        if (f.name === archivePath) continue;

        if (f.name.startsWith(cleanFolderPath)) {
            const relativePath = f.name.slice(cleanFolderPath.length);
            
            if (!relativePath || relativePath === "/") continue;

            try {
                const arrayBuffer = await f.arrayBuffer();
                zip.file(relativePath, arrayBuffer);
            } catch (e) {
                console.error(`Failed to read ${f.name}:`, e);
            }
        }
    }

    const contentBlob = await zip.generateAsync({
        type: "blob",
        compression: compress ? "DEFLATE" : "STORE"
    });

    const resultFile = new File([contentBlob], archivePath, { type: "application/zip" });

    const existingIdx = fs.findIndex(file => file.name === archivePath);
    if (existingIdx !== -1) {
        fs[existingIdx] = resultFile; // Замінюємо старий файл новим
    } else {
        fs.push(resultFile);
    }

    await saveFileToDB(resultFile);

    console.log(`Archive created at: ${archivePath}`);
    return archivePath; // Корисно для UI, щоб підсвітити файл
}



async function unzipFile(filePath, cwd = '') {
    let file;
    if (typeof filePath == "string"){
        file = fs.find(f => f.name === filePath);
    } else {
        file = filePath;
    }
    if (!file) return;

    var zip = new JSZip();
    await zip.loadAsync(file);

    const unzipPromises = [];

    try {
        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                console.log(`Extracting: ${relativePath}`);

                const promise = zipEntry.async("blob").then(async (content) => {
                    const type = getMimeType(zipEntry.name);
                    const parts = zipEntry.name.split("/");
                    const pureName = parts.pop(); 
                    const folderPath = parts.join("/"); 
                    
                    let p;
                    if (cwd == ""){
                        p = zipEntry.name;
                    } else {
                        p = cwd + "/" + zipEntry.name;
                    }

                    const extractedFile = new File(
                        [content],
                        p,
                        { type }
                    );

                    fs.push(extractedFile);

                    await saveFileToDB(extractedFile); 
                });

                unzipPromises.push(promise);
            }
        });

        await Promise.all(unzipPromises);
        console.log("Extracting ended successfully.");

    } catch (e) {
        console.error(e.message);
    }
}


function getMimeType(fileName) {
    const ext = getExt(fileName);
    return (ext && FILE_TYPES[ext]) ? FILE_TYPES[ext].mime : 'application/octet-stream';
}

function getIcon(file) {
    const ext = getExt(file);
    return (ext && FILE_TYPES[ext]) ? FILE_TYPES[ext].icon : icns.empty;
}


/**
 * Асинхронно перейменовує файл у fs, IndexedDB та оновлює UI.
 * @param {number} fileIndex Індекс файлу в масиві fs.
 * @param {string} newName Нове ім'я файлу.
 * @param {function} renderFileList Функція для оновлення списку файлів.
 * @param {function} null Функція для оновлення індикатора квоти.
 * @returns {Promise<boolean>} Успішність операції.
 */
async function performRename(fileIndex, newName) {
    if (fileIndex === -1 || !fs[fileIndex]) {
        console.error("Can not rename. Not found.");
        return false;
    }

    const oldFile = fs[fileIndex];
    const oldFileType = oldFile.type;
    const oldName = oldFile.name;

    const newFile = new File([oldFile], newName, { type: getMimeType(newName) ,lastModified: Date.now()});

    fs[fileIndex] = newFile;
    
    try {

        await idbWrapper.deleteFile(oldName);


        const success = await saveFileToDB(newFile);
        
        if (success) {

            if (oldFileType === 'text/javascript') {
                let autoload = JSON.parse(localStorage.getItem('autoload') || '[]');
                
                if (autoload.includes(oldName)) {
                    autoload = autoload.filter(name => name !== oldName);
                    autoload.push(newName);
                    localStorage.setItem('autoload', JSON.stringify(autoload));
                    
                }
            }

			
        }
    } catch (error) {
        console.error("Can not save or rename.", error);
        return false;
    }
    return false;
}



// 1. Wrap the entire function logic in a Promise so 'await' blocks execution properly
function createPartition() {
  return new Promise((resolve) => {
    const newPartWin = new wm('core.createMediaDevice.storage', {
      width: 200, 
      height: 110,
      x: 'center',
      y: 'center',
      class: [wbtheme, 'no-resize', 'no-header'], 
      html: `     
<div style="display:flex; gap:5px; flex-direction:column;padding:5px;">
  <div style="display:flex; flex-direction:row;  gap:5px; align-items:center;">
    <label>${_('name')}:</label>
    <input type="text" id="nameSel"/>
  </div>

  <div style="display:flex; flex-direction:row; gap:5px; align-items:center;">
    <label>${_('type')}:</label>
    <select id="typeSel">
      <option disabled>LocalStorage</option>
      <option value="indexedDB">IndexedDB</option>
    </select>
  </div>

  <div>
    <button id="create">${_('ok')}</button>
    <button id="cancel">${_('cancel')}</button>
  </div>
</div>
      `, 
      oncreate: function() {
        const $ = (selector) => document.querySelector(selector);

        $("#cancel").addEventListener('click', async () => {
          this.close();
          resolve(false); // Resolve false on cancel
        });

        $('#create').addEventListener('click', async () => {
          const dbName = $('#nameSel').value.trim(); 
          const diskType = $('#typeSel').value.trim();

          if (dbName === '') return;

          try {
            if (diskType === 'indexedDB') {
              await new Promise((res, rej) => {
                const request = indexedDB.open(dbName, 1);

                request.onupgradeneeded = (event) => {
                  const db = event.target.result;
                  if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "name" });
                  }
                };

                request.onerror = (event) => {
                  console.error("Database error:", event.target.error);
                  rej(event.target.error);
                };

                request.onsuccess = (event) => {
                  const db = event.target.result;
                  console.log(`Database '${dbName}' created successfully.`);
                  db.close(); 
                  res();
                };
              });
            }

            this.close();
            resolve(true); // Resolve true on successful drive creation!
          } catch (err) {
            console.error("Failed to create partition:", err);
            resolve(false);
          }
        });
      }
    });
  });
}

// A simple helper that polls until the DB instance is ready
const awaitDbInstance = (driveName) => {
  return new Promise((resolve) => {
    if (dbInstances[driveName]) return resolve(dbInstances[driveName]);
    
    const interval = setInterval(() => {
      if (dbInstances[driveName]) {
        clearInterval(interval);
        resolve(dbInstances[driveName]);
      }
    }, 50); // check every 50ms
  });
};

function listDir(dir) {
dir = dir.endsWith("/") ? dir.split("/")[0] : dir;
    return fs.filter(f => {
        const p = f.path || f.name;

        if (!dir) {
            return !p.includes("/");
        }

        if (!p.startsWith(dir + "/")) return false;

        const rest = p.slice(dir.length + 1);
        return !rest.includes("/");
    });
};


async function formatDrive(driveName){
const disks = await getDisks()
  const disk = disks.find(d=> d.name == driveName);
  
    if (disk.type == "localStorage"){
    localStorage.clear();
    } else if (disk.type == "indexedDB") {
  const db = await awaitDbInstance(driveName);
  
console.log([...db.objectStoreNames]);
  const store = db
  .transaction(STORE_NAME, "readwrite")
  .objectStore(STORE_NAME);

await store.clear();

  }

}

async function unmountDrive(driveName) {
  currentDisk = null;
  const disks = await getDisks();
  const disk = disks.find(d => d.name == driveName);

  if (disk.type === "indexedDB") {
    try {
      if (disk == currentDisk && currentDir.busy)
        throw new Error("target is busy");

      if (!dbInstances[driveName] || !disk.mounted)
        throw new Error("not mounted");

      dbInstances[driveName].close();
      DB_NAME = "";
      delete dbInstances[driveName];
      console.log("UnMounted:" + driveName);
      LAST_DB = "";
    } catch (err) {
      if (
        err.message === "target is busy" ||
        err.message === "not mounted"
      ) {
        throw err; // Preserve the original error.
      }

      throw new Error("failed to unmount");
    }
  }

  sounds.play("driveOut");
}

async function mountDrive(driveName){
  const disks = await getDisks()
  const disk = disks.find(d=> d.name == driveName);
  try{
  if (!disk) return;
  if (currentDisk && (currentDisk.name == driveName && currentDisk.type == disk.type && currentDisk.used == disk.used && currentDisk.total == disk.total)) throw new Error(driveName+" is already mounted")
  currentDisk = disk;
    if (disk.type === 'indexedDB'){
    idbWrapper.db = null;
    DB_NAME = driveName;
    console.log("Attempting to mount:"+driveName)
    await idbWrapper.openDB();
    await loadFsFromDB();
    } else if (disk.type != 'localStorage'){
          await loadFsFromDB();
    }
  } catch (e){
      throw e;
  }
}

 /**
 * Асинхронно створює новий порожній текстовий файл, додає його в FS та оновлює UI.
 * @param {function} renderFileList Функція для оновлення списку файлів.
 * @param {function} null Функція для оновлення індикатора квоти.
 */
 
async function handleCreateFile(cwd = "") {
    let fileName = await prompt(_('prompt_new_file_name'));
    
    if (!fileName) return; 
    const path = cwd == "" ? fileName : cwd.trim() + "/" + fileName;

    if (fs.some(file => file.name === path)) {

        return;
    }
    


    const newFile = new File([""], path, { type: getMimeType(fileName) });

    fs.push(newFile);

    if (currentDisk.type != "localStorage"){
    saveFileToDB(newFile);
    }else{
        localStorage.setItem(path, "");
        
    }
        
        
}
        
        

function getAllFileSizes(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    const req = store.getAll();
    req.onsuccess = () => {
      let total = 0;
      const sizes = [];

      for (const item of req.result) {
        if (item instanceof Blob) {
          sizes.push(item.size);
          total += item.size;
        }


      }

      resolve({ sizes, total });
    };
    req.onerror = () => reject(req.error);
  });
}   
async function getIndexedDBUsage(dbName){
           if (!dbName) return console.error('No drive name provided.');     
    const oldDB = DB_NAME;

return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);

    request.onsuccess = async (event) => {
      const db = event.target.result;
      let totalSize = 0;
      const storeNames = Array.from(db.objectStoreNames);

      for (const storeName of storeNames) {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const keys = await new Promise(res => {
            const req = store.getAllKeys();
            req.onsuccess = () => res(req.result);
        });

        for (const key of keys) {
            const data = await new Promise(res => {
                store.get(key).onsuccess = (e) => res(e.target.result);
            });

            totalSize += new Blob([JSON.stringify(data)]).size;
        }
      }
      db.close();
      resolve(totalSize);
    };
    request.onerror = () => reject(request.error);
  });
            }
        
async function updateDiskQuotaUI (disk, meter, text){
    try {
        if (disk.type === "localStorage") {

            const usedBytes = JSON.stringify(localStorage).length * 2;
            const totalBytes = maxLS;
if (meter && text){
            meter.max = totalBytes;
            meter.value = usedBytes;
            text.innerText = formatBytes(usedBytes) + " / " + formatBytes(totalBytes);
}
        }else {
            const usedBytes = await getIndexedDBUsage(disk.name);

            const estimate = await navigator.storage.estimate();
            const totalBytes = estimate.quota || usedBytes;
            
            if (meter && text){
            meter.max = totalBytes;
            
            meter.value = usedBytes;
            text.innerText = formatBytes(usedBytes) + " / " + formatBytes(totalBytes);
            }
            return {usedBytes: usedBytes, totalBytes: totalBytes};
        }
    } catch (e) {
        console.warn("Quota error: "+ e.message);
        if (text) text.innerText = _("unknown");
        return {usedBytes: 0, totalBytes: 0};
    }
}

async function getDisks() {
    const disks = [];



    const lsUsed = JSON.stringify(localStorage).length * 2; // байти приблизно
    disks.push({
        type: "localStorage",
        name: "Local Storage",
        icon: icns.lsDrive,
        used: lsUsed,
        total: maxLS, // 5 MB стандарт
    });

    if (window.indexedDB && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
    const {usedBytes, totalBytes} = await updateDiskQuotaUI({type: "indexedDB", name: db.name});
    disks.push({
        type: "indexedDB",
        name: db.name,
        icon: icns.dbDrive,
        used: usedBytes,
        total: totalBytes,
        mounted: DB_NAME == db.name
    });
}
    }

    return disks;
};




addIcon("files", icns.files, function(e){
    const uniqueId = "file-explorer-" + Date.now(); 
    const opts = (e && e.detail && e.detail.extraData) ? e.detail.extraData : {};
    let mode = opts.runAs ? opts.runAs : 'view';
    console.log("Active mode:", mode);
    let title = _("files");
    if (mode == 'file') title = _('select_file')
    if (mode == 'dir') title = _('select_folder')
    if (mode == 'save') title = _('save_to')
    new wm(title, { // ВИКОРИСТАННЯ _()
    x: "center",y: "center",
        id: uniqueId, 
        icon: icns.files,
        class: [ wbtheme],
        minwidth: 255,
        minheight:255,
        html: `
    <div style="height: 100%; width: 100%; display: flex; flex-direction: column; white-space: nowrap; overflow: hidden;">
        <!-- Тулбар -->
        <div id="file-toolbar-${uniqueId}" class="toolbar" style="flex-shrink: 0;">
            <button id="up-btn-${uniqueId}">..</button>
            <div id="toolbar-${uniqueId}" style="display: none;">
                <input type='text' id="pathlabel-${uniqueId}">
            </div>
        </div>

        <!-- Основна частина: Sidebar + Resizer + List -->
        <div style="display: flex; flex-direction: row; flex-grow: 1; height: 100%; overflow: hidden;">
            
            <!-- Sidebar -->
            <div style="display: flex; flex-direction: column;   padding-top: 10px; box-sizing: border-box;width: fit-content; background: #ddd !important; overflow-y: auto; height: 100%;">
                <ul style="flex: 1;list-style-type: none; padding:0; margin-top:0; background:transparent;" id="sidebar-${uniqueId}"></ul>
            </div>

            <!-- Ресайзер -->
            <div id="resizer-${uniqueId}" style="width: 5px; cursor: col-resize; background: #ccc; flex-shrink: 0;"></div>


            <ul id="file-list-${uniqueId}" style="flex: 1; color: black; list-style-type: none; padding: 0; margin: 0; height: 100%; overflow-y: auto;">
            </ul>

        </div>
    </div>
`,
        minheight: 210,
        minwidth: 210,
        
        oncreate: async function() { 
            const fileListContainer = this.body.querySelector(`#file-list-${uniqueId}`);
            const sideListContainer = this.body.querySelector(`#sidebar-${uniqueId}`);

            
            

            
    const resizer = this.body.querySelector(`#resizer-${uniqueId}`);

    let minSidebarWidth;

    const resize = (e) => {

        const rect = sideListContainer.getBoundingClientRect();

        const newWidth = e.clientX - rect.left;
        
        if (newWidth > 50 && newWidth < 600) { // Обмежуємо розумними межами
             sideListContainer.style.width = newWidth + 'px';
        }
    };

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Запобігаємо виділенню тексту при русі
        document.addEventListener('mousemove', resize);

        document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', resize);
        }, { once: true });
    });

    fileListContainer.addEventListener("dragover", (e) => e.preventDefault());

            

            let currentDir = "";
            if (mode != 'view' && opts.startIn){
              currentDir = opts.startIn;
            }
            
            const getFoldersInDir = (dir) => {
    const folders = new Set();

    fs.forEach(f => {
        const p = f.path || f.name;

        if (!dir) {
            if (p.includes("/")) {
                folders.add(p.split("/")[0]);
            }
        } else {
            if (p.startsWith(dir + "/")) {
                const rest = p.slice(dir.length + 1);
                if (rest.includes("/")) {
                    folders.add(rest.split("/")[0]);
                }
            }
        }
    });

    return [...folders];
};






const showContextFldrMenu = (e, currFolder) => {
    e.preventDefault(); // Завжди корисно для контекстного меню

    if (e.target.closest("ul") !== e.target) return;

    document.querySelectorAll(".menu").forEach(item => item.style.display = "none");
    
    const menu = document.getElementById("folderM");
    const cleanFolder = currFolder.trim();


    const visibleButtons = ["create_item_btn"]; 

    if (cleanFolder !== "/" && cleanFolder !== "") {
      visibleButtons.push("zip1_btn");
        visibleButtons.push("getinfo1_btn");
    }

const list = e.target.closest("ul");
if (!list || list !== e.target) return;

const mode = list.id.includes("sidebar") ? "drive" : "file";

menu.querySelectorAll("li").forEach(li => {
    li.style.display = "none";
    li.dataset.mode = mode;
});

    visibleButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.display = "block";
            btn.setAttribute("data-file", currFolder);
        }
    });

    menu.querySelectorAll("li > p, label, b").forEach(item => {

        if (!item.dataset.key) item.dataset.key = item.innerText;
        item.innerText = _(item.dataset.key);
    });

    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";
    menu.style.display = "block";
}


const showContextMenu = (e, itemType, fileName) => {
    e.preventDefault();

    document.querySelectorAll(".menu").forEach(item => item.style.display = "none");

    const buttons = Object.keys(fileMenuBtns);

    console.log(fileName + " " + itemType);

    buttons.forEach(id => { fileMenuBtns[id].style.display = "block"; });

    document.getElementById("fileM")
        .querySelectorAll("li > p, label, b")
        .forEach(item => item.innerText = _(item.innerText));

    if (itemType === "localStorage") {
        buttons.forEach(id => fileMenuBtns[id].style.display = "none");
        fileMenuBtns.format_btn.style.display = "block";
        fileMenuBtns.getinfo_btn.style.display = "block";
    }
    else if (itemType === "indexedDB") {
        buttons.forEach(id => fileMenuBtns[id].style.display = "none");
        fileMenuBtns.mount_btn.style.display = "block";
        fileMenuBtns.unmount_btn.style.display = "block";
        fileMenuBtns.format_btn.style.display = "block";
        fileMenuBtns.toggle_startup.style.display = "block";
        fileMenuBtns.getinfo_btn.style.display = "block";
        fileMenuBtns.delete_file_btn.style.display = "block";
    }
    else if (itemType === "file") {
        fileMenuBtns.toggle_startup.style.display = "none";
        fileMenuBtns.mount_btn.style.display = "none";
        fileMenuBtns.unmount_btn.style.display = "none";
        fileMenuBtns.format_btn.style.display = "none";
        fileMenuBtns.print_btn.style.display = "none";

        const file = fs.find(f => f.name === fileName || f.path === fileName);

        fileMenuBtns.print_btn.style.display =
            ((file.type.startsWith("text/") && file.type !== "text/html") ||
             file.name.endsWith(".md") || file.name.endsWith(".rtf") || file.name.endsWith(".doc"))
                ? "block" : "none";

        fileMenuBtns.open_as_text_btn.style.display =
            (file.type.startsWith("text/") && file.type !== "text/plain") ||
            file.type == "image/svg+xml" || file.type == "application/x-theme" ? "block" : "none";

        fileMenuBtns.toggle_autoload.style.display =
            file.type === "text/javascript" ? "block" : "none";

        fileMenuBtns.set_bg_btn.style.display =
            file.type.startsWith("image/") ? "block" : "none";

        fileMenuBtns.unzip_btn.style.display =
            file.name.endsWith(".zip") ? "block" : "none";

        fileMenuBtns.default_btn.style.display =
            (file.type.startsWith("font/") ||
             file.type === "application/x-font-ttf" ||
             file.type === "application/font-woff" ||
             file.type === "application/vnd.ms-opentype") ? "block" : "none";

        fileMenuBtns.zip_btn.style.display = "none";
    }
    else {
        fileMenuBtns.zip_btn.style.display = "block";
        fileMenuBtns.toggle_startup.style.display = "none";
        fileMenuBtns.open_as_text_btn.style.display = "none";
        fileMenuBtns.toggle_autoload.style.display = "none";
        fileMenuBtns.set_bg_btn.style.display = "none";
        fileMenuBtns.unzip_btn.style.display = "none";
        fileMenuBtns.mount_btn.style.display = "none";
        fileMenuBtns.unmount_btn.style.display = "none";
        fileMenuBtns.format_btn.style.display = "none";
        fileMenuBtns.print_btn.style.display = "none";
        fileMenuBtns.default_btn.style.display = "none";
    }

    const menu = document.getElementById("fileM");
    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";
    menu.style.display = "block";

    buttons.forEach(id => { fileMenuBtns[id].setAttribute("data-file", fileName); });
};
// Кешуємо посилання на кнопки контекстного меню один раз
const fileMenuBtns = {
    open_btn: document.getElementById("open_btn"),
    open_as_text_btn: document.getElementById("open_as_text_btn"),
    unzip_btn: document.getElementById("unzip_btn"),
    rename_btn: document.getElementById("rename_btn"),
    delete_file_btn: document.getElementById("delete_file_btn"),
    set_bg_btn: document.getElementById("set_bg_btn"),
    toggle_autoload: document.getElementById("toggle_autoload"),
    getinfo_btn: document.getElementById("getinfo_btn"),
    mount_btn: document.getElementById("mount_btn"),
    unmount_btn: document.getElementById("unmount_btn"),
    format_btn: document.getElementById("format_btn"),
    default_btn: document.getElementById("default_btn"),
    zip_btn: document.getElementById("zip_btn"),
    toggle_startup: document.getElementById("toggle_startup"),
    print_btn: document.getElementById("print_btn"),
};


const openBtn = document.getElementById("open_btn");
const openTxtBtn = document.getElementById("open_as_text_btn");
const renBtn = document.getElementById("rename_btn");
const deleteBtn = document.getElementById("delete_file_btn");
const setbgBtn = document.getElementById("set_bg_btn");
const autoloadBtn = document.getElementById("toggle_autoload");
const startupBtn = document.getElementById("toggle_startup");
const unzipBtn = document.getElementById("unzip_btn");
const zipBtn = document.getElementById("zip_btn");
const zip1Btn = document.getElementById("zip1_btn");
const getinfoBtn = document.getElementById("getinfo_btn");
const getinfo1Btn = document.getElementById("getinfo1_btn");
const mountBtn = document.getElementById("mount_btn");
const unmountBtn = document.getElementById("unmount_btn");
const formatBtn = document.getElementById("format_btn");
const printBtn = document.getElementById("print_btn");
const defaultBtn = document.getElementById("default_btn");
const upBtn = document.getElementById(`up-btn-${uniqueId}`)

upBtn.onclick = async (e) => {
if (open){
if (currentDir != ""){
    currentDir = currentDir.split("/").slice(0, -1).join("/");
}else{
    open = 0;
    currentDir = "";
    if (currentDisk.type != 'localStorage') await unmountDrive(currentDisk.name);
    currentDisk = null;
    fs = [];
}
    renderFileList()
document.getElementById("pathlabel-"+uniqueId).value = currentDir;
}
}
defaultBtn.onclick = async (e) => {

    e.stopPropagation();
    const li = e.target.closest("li");
    
    const font = li.getAttribute("data-file");
    console.log("active font:" + fonts.active);
    await updateFonts("set", font);
}
formatBtn.onclick = async (e) => {
    
    e.stopPropagation();
    const li = e.target.closest("li");
    
    const driveName = li.getAttribute("data-file");
    
    const a = await confirm(_("confirm_format").replace("{name}", driveName));
    if (a) await formatDrive(driveName);
    if (currentDisk.name == driveName) await renderFileList()
    await loadDisksList();
}
mountBtn.onclick = async (e) => {
    e.stopPropagation();
    const li = e.target.closest("li");
    
    const driveName = li.getAttribute("data-file");
mountDrive(driveName)
}
unmountBtn.onclick = async (e) => {
    e.stopPropagation();
    const li = e.target.closest("li");
    
    const driveName = li.getAttribute("data-file");

    await unmountDrive(driveName);
    open = 0;
    currentDisk = null;
    await renderFileList();   
    await loadDisksList()
}
getinfoBtn.onclick = async (e) => {
    getInfo(e,getinfoBtn)
};
getinfo1Btn.onclick = async (e) => {
    getInfo(e, getinfo1Btn)
};
getInfo = async (e, btn) => {


    
    const path = btn.getAttribute("data-file");
    
    let typeofpath = "";

    let entry;
    const disks = await getDisks()
    if (!path.endsWith("/")) {
        entry = fs.find(f => f.name === path);
        typeofpath = "file"
        if (!entry){
            entry = disks.find(d => d.name === path)
            typeofpath = "drive"
        }
    }else{
        typeofpath = "dir"
    }

    
    let name;
    if (path.endsWith("/")){
    name = path.slice(0, -1).split('/').pop();
    }else if (typeofpath == "drive"){
        name = entry.name;
    }else{
        name = path.split('/').pop();
    }

    let size;
    if (typeofpath == "file") {
        size = formatBytes(entry.size)
    }else if (typeofpath == "drive"){
        size = formatBytes(entry.total);
    } else {
        let sum = 0;
        fs.forEach(f => { if (f.name.startsWith(path)) sum += f.size; });
        size = formatBytes(sum)
            
    }

    const dateOptions = localeFormat;
    let modifiedDate,formattedDate;
    if (typeofpath == "file") {
     modifiedDate = entry.lastModified
    }else if (typeofpath == "dir"){
        modifiedDate = Math.max(...fs.filter(f=> f.name.startsWith(path) ).map(f=> f.lastModified));
    }else{
        modifiedDate = Date.now()
    }
  

formattedDate = new Intl.DateTimeFormat(dateLang, dateOptions).format(new Date(modifiedDate));

    let type;
    type = path.endsWith("/") ? _("folder") : entry.type;

    let ic;
    
        if (typeofpath == "file"){
        ic = getIcon(entry)
        }else if (typeofpath == "drive"){
            if (entry.type == "indexedDB"){
                ic = icns.dbDrive;
            }else{
                ic = icns.lsDrive;
            }
        }else{
            ic = icns.folder;
        }

    const win = new wm(_("info"), {x: "center",y: "center",
        class: [ wbtheme, "no-max"],
        icon: icns.dialogInfo,
        height: 320,
        width: 250,
        minheight: 320,
        minwidth: 250,
        html: `
            <div style="padding: 15px;  font-size: 15px; color: black; line-height: 1.5;text-align: center; margin-bottom: 15px;">
                <img src="${ic}" style="width: 64px; height: 64px; object-fit: contain;">
                <p style="font-weight: bold; margin-top: 8px; word-break: break-all; font-size: 15px;">${name}</p>
            </div>
            <div style='user-select:auto;padding-left:5px;line-height: 1.25;'>
                <hr style="margin: 3px 0; border-color: #ffffff33;">
                <b>${_("type")}: </b>${type}<br>
                <b>${_("size")}: </b>${size}<br>
                <b>${_("path")}: </b>${path}<br>
                <b>${_("lastModified")}: </b>${formattedDate}
            </div>
            
        `
    });
    
    const metaDiv = document.createElement("div");

metaDiv.style = 'user-select:text;padding-left:5px;line-height: 1.25;'

if (!path.endsWith("/")) {
    if (entry.type.startsWith("image/")) {
        const imgMeta = new Image();
        imgMeta.src = URL.createObjectURL(entry);
        imgMeta.onload = () => {
            const width = imgMeta.naturalWidth;
            const height = imgMeta.naturalHeight;
            
            metaDiv.innerHTML += `
                <hr style="margin: 3px 0; border-color: #ffffff33;">
                <b>${_("dimensions")}:</b> ${width} × ${height} px
            `;
            
            URL.revokeObjectURL(imgMeta.src);
        };
    } else if (entry.type.startsWith("audio/")) {
        const audio = new Audio();
        audio.src = URL.createObjectURL(entry);
        audio.onloadedmetadata = () => {
            const duration = audio.duration; // секунди
            const mins = Math.floor(duration / 60);
            const secs = Math.floor(duration % 60);
            
            metaDiv.innerHTML += `
                <hr style="margin: 3px 0; border-color: #ffffff33;">
                <b>${_("duration")}:</b> ${mins}:${secs.toString().padStart(2,'0')}
            `;
            
            URL.revokeObjectURL(audio.src);
        };
    } else if (entry.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(entry);
        video.onloadedmetadata = () => {
            const width = video.videoWidth;
            const height = video.videoHeight;
            const duration = video.duration;
            const mins = Math.floor(duration / 60);
            const secs = Math.floor(duration % 60);
            
            metaDiv.innerHTML += `
                <hr style="margin: 3px 0; border-color: #ffffff33;">
                <b>${_("dimensions")}:</b> ${width} × ${height} px<br>
                <b>${_("duration")}:</b> ${mins}:${secs.toString().padStart(2,'0')}
            `;
            
            URL.revokeObjectURL(video.src);
        };
    }
}

win.body.appendChild(metaDiv);
};
unzipBtn.onclick = async (e) => {
    e.stopPropagation();
    const filePath = e.target
    .closest("li").getAttribute("data-file");
    try{
    await unzipFile(filePath, currentDir);
  }
  catch{
    throw Error(_("unable_to_unzip"))
  }
    await renderFileList();   
  
};
zipBtn.onclick = async (e) => {
    e.stopPropagation();
    const filePath = e.target
    .closest("li").getAttribute("data-file");
    await zipFolder(filePath);
    await renderFileList();  
};
zip1Btn.onclick = async (e) => {
    e.stopPropagation();
    const filePath = e.target
    .closest("li").getAttribute("data-file");

    // Правильний витяг імені папки без ризику зламати код
const folderName = filePath.replace(/\/+$/, "").split('/').pop();

await zipFolder(filePath, `${filePath+folderName}.zip`, true);
    await renderFileList();  
};
document.getElementById("isAutoload").onchange = (e) => {
    let autoload = [];
    const autoloadString = localStorage.getItem('autoload');
    if (autoloadString) {
        try {

            autoload = JSON.parse(autoloadString);
        } catch (error) {
            console.error("Помилка парсингу autoload JSON:"+ error);

            autoload = []; 
        }
    }

    const fileName = e.target.parentNode.getAttribute("data-file");

    
    if (e.target.checked) {

        if (!autoload.includes(fileName)) {
            autoload.push(fileName);
        }
    } else {


        autoload = autoload.filter(name => name !== fileName);
    }


    localStorage.setItem('autoload', JSON.stringify(autoload));  
};
setbgBtn.onclick = (e) => {
                        e.stopPropagation(); // Важливо: запобігає виклику Openf при натисканні X
                        const fileName = e.target.closest("li").getAttribute("data-file");
                        const file = fs.find(f => f.name === fileName);
                                const reader = new FileReader();
        
        reader.onload = async function(e) {
            
            const dataUrl = e.target.result;

            document.body.style.backgroundImage = `url(${dataUrl})`;

            localStorage.setItem('background_file', file.name);

            }
            reader.readAsDataURL(file);
                    };
deleteBtn.onclick = async (e) => {
  e.stopPropagation();
  
  const fileName = e.target.closest("li").getAttribute("data-file");
  const isFolder = fileName.endsWith("/");
  const disks = await getDisks();
  const disk = disks.find(disk => disk.name === fileName); 
  
  if (await confirm(_('prompt_delete').replace('{file}', fileName))) {
    
    // =========================================================
    // CASE 1: INDEXEDDB DRIVE DELETION
    // =========================================================
    if (disk && disk.type === 'indexedDB') {
      await new Promise((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase(fileName);
        
        deleteRequest.onsuccess = () => {
          console.log(`База ${fileName} видалена`);
          resolve();
        };

        deleteRequest.onerror = (err) => {
          console.warn(`Помилка при видаленні ${fileName}:`, err);
          resolve(); // Resolve anyway to proceed with UI updates
        };
      });

      // Update lists and exit early cleanly
      await loadDisksList();
      await renderFileList();
    }
    
    
    // =========================================================
    // CASE 3: LOCAL STORAGE PARTITION OR PATH DELETION
    // =========================================================
    if (disk && disk.type === "localStorage") {
      if (isFolder) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(fileName)) {
            localStorage.removeItem(key);
          }
        });
      } else {
        localStorage.removeItem(fileName);
      }
      
      // Delay slightly to let LocalStorage sync if needed
      setTimeout(async () => { 
        await loadDisksList();
        await renderFileList(); 
      }, 100);
      return;
    }

    // =========================================================
    // CASE 4: REGULAR FILE OR FOLDER DELETION
    // =========================================================
    const file = fs.find(f => f.name === fileName);
    
    if (isFolder) {
      await purgeDir(fileName);
      await renderFileList();
      return;
    }
    
    let autoload = [];
    const autoloadString = localStorage.getItem('autoload');
    if (autoloadString) autoload = JSON.parse(autoloadString);
    
    if (file && file.type === "text/javascript") {
      if (autoload.includes(fileName)) {
        autoload = autoload.filter(name => name !== fileName);
        localStorage.setItem('autoload', JSON.stringify(autoload));
      }
    }

    const legacyFontTypes = ["application/x-font-ttf", "application/font-woff", "application/vnd.ms-opentype"];
    if (file && (file.type.startsWith("font/") || legacyFontTypes.includes(file.type))) {
      await updateFonts("delete", fileName);
    }
    
    await deleteFile(file.name);
  }

  // Fallback safety update triggers for regular file deletions
  if (disk) await loadDisksList();
  await renderFileList();
};

renBtn.onclick = async (e) => {
    e.stopPropagation();
    
    const li = e.target.closest("li");
    const oldPath = li.getAttribute("data-file");
    const isFolder = oldPath.endsWith("/");
    
    
    let oldName;
    oldName = oldPath;
    if (!isFolder) {
        
        if (currentDisk.type === "localStorage") {
            oldName = oldPath;
        } else {
            const file = fs.find(f => f.name === oldPath);
            if (!file) return;
            oldName = file.name;
        }
    }
    
    const newName = await prompt(
        _('prompt_rename').replace('{old_name}', oldName),
        oldName
    );
    
    if (!newName || newName === oldName) return;
    
    if (currentDisk.type === "localStorage") {

        
        
        
            const value = localStorage.getItem(oldPath);
            
            localStorage.removeItem(oldPath);
            localStorage.setItem(newName, value);
        
        
        return;
    }

    if (isFolder) {
        
            
        
        fs.forEach(f => {
            if (f.name.startsWith(oldPath)) {
            const fileIndex = fs.findIndex(item => item.name.startsWith( oldPath));
            newName0 = f.name.replace(oldPath, newName)
                performRename(fileIndex, newName0);                
            }
        });

    } else {
        const fileIndex = fs.findIndex(item => item.name === oldPath);
       await performRename(fileIndex, newName);
    }

            await renderFileList();
        await loadDisksList();
};
openBtn.onclick = (e) =>{
e.stopPropagation();
const fileName = e.target.closest("li").getAttribute("data-file");
if (fileName.endsWith("/")){
            currentDir = fileName.slice(0,-1);
             renderFileList();
             document.getElementById("pathlabel-"+uniqueId).value = currentDir;
}else{
                        const file = fs.find(f => f.name === fileName);
                        Openf(getMimeType(file.name), file);
}
}
        
openTxtBtn.onclick = (e) => {
                        e.stopPropagation();
                        const fileName = e.target.closest("li").getAttribute("data-file");
                        const file = fs.find(f => f.name === fileName);
                        Openf('text/plain', file, false);
                    }



loadDisksList = async () => {
sideListContainer.classList.add("loading");

const disks = await getDisks();
        sideListContainer.innerHTML = '';
    disks.forEach(disk => {
        const li = document.createElement("li");
        
        li.classList = "disk";
        li.innerHTML = `
            <span style="display:flex;align-items:center;">
                <img src="${disk.icon}" width="20" style="margin-right:10px;">
                ${disk.name} <meter optimum="0.25" high="4" class="quota-progress" style="flex-grow:1;"></meter>
                    <div class="quota-text" style="font-size: 12px; color: #555;">${_('loading_text')}</div>
            </span>
        `;
        const meter = li.querySelector(".quota-progress");
const text = li.querySelector(".quota-text");

updateDiskQuotaUI(disk, meter, text);

        li.oncontextmenu = (e) => {
            e.preventDefault();
            const li = e.target.closest("li");
            const diskLi = li.textContent.trim().split(" ");
            const diskName = diskLi
                .splice(0, diskLi.length - 5)
                .join(" ")
                .trim();
            
            const startupCheckbox = document.getElementById("isStartup");
            
            
            startupCheckbox.checked = (diskName === startupDisk);

            startupCheckbox.onchange = (ev) => {
                console.log(startupDisk)
                if (ev.target.checked) {

                    
                    localStorage.setItem("startup_disk", diskName);
                } else {
                    localStorage.removeItem("startup_disk");
                }
            }
            
            showContextMenu(e, disk.type, diskName);
        };

        li.onclick = async () => {
            open = 1;
            currentDir = "";
                            document.getElementById("pathlabel-"+uniqueId).value = '';
            //fileListContainer.innerHTML = '';
            if (disk.type === "localStorage") {
                const keys = Object.keys(localStorage);
                currentDisk = disk;
                fs = keys.map(k => new File([localStorage.getItem(k)], k, { type: getMimeType(k)}));
            } else {
await mountDrive(disk.name)
            }
            await renderFileList(); // оновлюємо список
        };
        sideListContainer.appendChild(li);
    });
sideListContainer.oncontextmenu = (e) => {
            e.preventDefault();
    showContextFldrMenu(e, '');
};
}

loadDisksList()
let open = 1;

const hLi = document.createElement("li");
hLi.classList = 'header';
const hDisplay = document.createElement("span");
hDisplay.style.cssText = "flex-grow:1; display:flex; align-items:center;";


let sortCol = 'name';
let sortDir = 1;

hDisplay.onclick = (e) => {
    const colMod = e.target.id.split('-')[1];
    if (!colMod) return;

    if (sortCol === colMod) {
        sortDir *= -1;
    } else {
        sortCol = colMod;
        sortDir = 1;
    }

    if (colMod == 'name') fs.sort((a, b) => sortDir * a.name.localeCompare(b.name));
    if (colMod == 'size') fs.sort((a, b) => sortDir * (a.size - b.size));
    if (colMod == 'lastModified') fs.sort((a, b) => sortDir * (a.lastModified - b.lastModified));
    if (colMod == 'type') fs.sort((a, b) => sortDir * a.type.localeCompare(b.type));

    renderFileList();
};
hLi.appendChild(hDisplay);


const renderFileList = async () => {
  fileListContainer.innerHTML = ``;
  console.log("REND")
  if (open){
    hDisplay.innerHTML = `<p id='sort-name-${uniqueId}'>${_('name')}</p>`;
    filesCols.forEach(col => {
        if (col === 'lastModified') {
            hDisplay.innerHTML += `<p id='sort-lastModified-${uniqueId}'>${_('lastModified')}</p>`;
        } 
        else if (col === 'type') {
            hDisplay.innerHTML += `<p id='sort-type-${uniqueId}'>${_('type')}</p>`;
        } 
        else if (col === 'size') {
            hDisplay.innerHTML += `<p id='sort-size-${uniqueId}'>${_('size')}</p>`;
        }
    });

    // Re-apply the active sort indicator after rebuilding the header
    if (sortCol) {
        const activeHeader = hDisplay.querySelector(`#sort-${sortCol}-${uniqueId}`);
        if (activeHeader) activeHeader.classList.add('sort-'+ ( (sortDir == 1) ? 'asc' : 'desc') );
    }
    fileListContainer.appendChild(hLi);
  }

fileListContainer.oncontextmenu = (e) => {
            e.preventDefault();
    const li = e.target.closest("li");
    
    
    
    showContextFldrMenu(e, open ? currentDir.trim()+"/" : "");
};
                
if (open) {
    document.getElementById("toolbar-" + uniqueId).style.display = "block";
} else {
    document.getElementById("toolbar-" + uniqueId).style.display = "none";

    loadDisksList()
}


sideListContainer.classList.remove("loading");
minSidebarWidth = parseInt(window.getComputedStyle(sideListContainer).width) || 100;
if (!currentDisk) return;
fileListContainer.classList.add("loading");

    const folders = getFoldersInDir(currentDir);
    folders.forEach(folderName => {
        let li = document.createElement("li");
const safeId = folderName.replace(/\s+/g, "_").replace(/\//g, "_") + uniqueId;

const folderDisplay = document.createElement("span");
folderDisplay.style.cssText = "flex-grow:1; display:flex; align-items:center;";

folderDisplay.innerHTML = `
    <span style="position:relative; display:inline-block; width:20px; height:20px; margin-right:10px; flex-shrink:0;">
        <img src="${icns.folder}" width="20" height="20">
        <span id="${safeId}" style="
            position:absolute;
            top:3px;
            left:0px;
            color: rgba(0,0,0,0.5);
            font-size:8px;
            width:20px;
            height:20px;
            display:flex;
            align-items:center;
            justify-content:center;
        ">0</span>
    </span>
    <p class="folder-name-text" style="flex-grow:1; margin:0;">${folderName}</p>
`;

const folderPrefix = currentDir ? currentDir + "/" + folderName + "/" : folderName + "/";
const insideFiles = fs.filter(f => f.name.startsWith(folderPrefix) && f.name.trim() !== folderPrefix);

filesCols.forEach(col => {
    if (col === 'lastModified') {

        const timestamps = insideFiles.map(f => {

            return typeof f.lastModified === 'number' ? f.lastModified : new Date(f.lastModified).getTime();
        }).filter(t => !isNaN(t));

        let formattedDate = "N/A";
        if (timestamps.length > 0) {
            const modifiedDate = Math.max(...timestamps);
            formattedDate = new Intl.DateTimeFormat(dateLang, localeFormat).format(new Date(modifiedDate));
        }
        
        folderDisplay.innerHTML += `<p class="col-date">${formattedDate}</p>`;
    } 
    else if (col === 'type') {
        folderDisplay.innerHTML += `<p class="col-type">${_("folder")}</p>`;
    } 
    else if (col === 'size') {
        let sum = 0;
        insideFiles.forEach(f => {

            if (typeof f.size === 'number') {
                sum += f.size;
            } else if (typeof f.size === 'string') {
                const num = parseFloat(f.size);
                if (!isNaN(num)) {
                sum += num;
                }
            }
        });

        
        

        folderDisplay.innerHTML += `<p class="col-size">${formatBytes(sum)}</p>`;
    }
});

li.appendChild(folderDisplay);


li.oncontextmenu = (e) => {
    e.preventDefault();
    const li = e.target.closest("li");
    const folderName1 = currentDir == "" ? folderName.trim() + "/" : currentDir + "/" + folderName.trim() + "/";
    
    
    showContextMenu(e, "folder", folderName1);
};

        li.onclick = () => {
          if (mode == 'view' || mode == 'file'){
            currentDir = currentDir ? currentDir + "/" + folderName : folderName;
             renderFileList();
             document.getElementById("pathlabel-"+uniqueId).value = currentDir;
          }else if (mode == 'dir'){
             window.dispatchEvent(new CustomEvent('dir_picked', {
    detail: { 
        paths: [folderName] // Передаємо як масив (навіть якщо файл один), бо W3C очікує масив
    }
}));
             this.close()
          }
        };
        
        
const isHidden = folderName.startsWith(".");

if (!isHidden || filesShowHidden) {

    fileListContainer.appendChild(li);

    if (isHidden) {
        li.style.opacity = "0.5"; 
    }
}

document.getElementById(safeId).textContent = insideFiles.length;
    });

    const files = listDir(currentDir);
    files.forEach(file => {
        let li = document.createElement("li");
        li.setAttribute("data-path", file.name);
        let ic = getIcon(file)

li.oncontextmenu = (e) => {
    e.preventDefault();
    const li = e.target.closest("li");
    const fileName = file.name;

    if (fileName.endsWith(".js")) {
        const autoloadString = localStorage.getItem('autoload');
        if (autoloadString) {
            const autoload = JSON.parse(autoloadString);
            const autoloadCheckbox = document.getElementById("isAutoload");
            if (autoloadCheckbox) {
                autoloadCheckbox.checked = autoload.includes(file.name);
            }
        }
    }
    
    showContextMenu(e, "file", fileName);
}

        const fullPath = file.name;

        const fileDisplay = document.createElement("span");
        fileDisplay.style.cssText = "flex-grow:1;display:flex;align-items:center;";
        fileDisplay.innerHTML = `
            <img src="${ic}" width="20" style="margin-right:10px;">
            <p>${file.name.split("/").pop()}</p>
        `;
        filesCols.forEach(col => {
        if (col === 'lastModified') {

            const formattedDate = new Intl.DateTimeFormat(dateLang, localeFormat)
                .format(new Date(file.lastModified));
            
            fileDisplay.innerHTML += `<p class="col-date">${formattedDate}</p>`;
        } 
        else if (col === 'type') {
            fileDisplay.innerHTML += `<p class="col-type">${file.type}</p>`;
        }
        else if (col === 'size') {
            fileSize = formatBytes(file.size)
    fileDisplay.innerHTML += `<p class="col-size">${fileSize}</p>`;
}

    });

        fileDisplay.onclick = (e) => {
    e.stopPropagation();

    const li = e.target.closest("li");
    const filePath = li.getAttribute("data-path");

    const file = fs.find(f => f.name === filePath);

    if (!file) {
        console.error("Файл не знайдено:", filePath);
        return;
    }

    console.log(currentDisk.name)
    if (mode == 'view'){
    Openf(getMimeType(file.name), file);
  }else if (mode == 'file'){
    window.dispatchEvent(new CustomEvent('file_picked', {
    detail: { 
        paths: [file.name] // Передаємо як масив (навіть якщо файл один), бо W3C очікує масив
    }
}));

// Після відправки даних — закриваємо вікно провідника
this.close()
  }
};
fileListContainer.classList.remove("loading");


                document.getElementById("pathlabel-"+uniqueId).onchange = (e) => {
                    currentDir = document.getElementById("pathlabel-"+uniqueId).value;
                     renderFileList();
                }



                    li.appendChild(fileDisplay);
                    const isHidden = file.name.split("/").pop().startsWith(".");

// Вираховуємо, чи дозволений цей конкретний файл через пікер
// Якщо ми в звичайному режимі 'view', то opts порожній, і isAllowed завжди буде true
const isAllowedByPicker = (mode === 'file' || mode === 'save') ? isFileAllowed(file.name, opts) : true;

// Твоя логіка відображення
if ((!isHidden || filesShowHidden) && isAllowedByPicker) {

    fileListContainer.appendChild(li);

    if (isHidden) {
        li.style.opacity = "0.5"; 
    }
}

                    
                });
            
fileListContainer.classList.remove("loading");
            };
            document.getElementById("create_item_btn").onclick = async (e) => {
      const li = e.target.closest('li');
    if (open && li.dataset.mode == 'file'){
    await handleCreateFile(currentDir);
    await renderFileList()
    await loadDisksList();
    } else{
        const created = await createPartition();
        if (created) await loadDisksList();
    }
};

            

            fileListContainer.ondrop = async (e) => { // Додаємо async
    e.preventDefault();
    const fls = e.dataTransfer.files;

    for (const file of fls) {

        const content = await file.arrayBuffer(); 
        
        const path = currentDir == "" ? file.name : currentDir.trim() + "/" + file.name;


        const a = new File([content], path, {
            type: getMimeType(path),
            lastModified: file.lastModified
        });

        fs.push(a);
        await saveFileToDB(a); 
    }

    renderFileList();
}



            await renderFileList();
            
        }, 
        onclose: function(){
            if (mode === 'file') window.dispatchEvent(new CustomEvent('file_cancel'));
    if (mode === 'dir')  window.dispatchEvent(new CustomEvent('dir_cancel'));
    if (mode === 'save') window.dispatchEvent(new CustomEvent('save_cancel'));
    return false;
        }
    });
}, true);

addSystemApp(("about"),icns.dialogInfo, function(){
    new wm(_("about"),{ // ВИКОРИСТАННЯ _()
    icon: icns.dialogInfo,x: "center",y: "center",
    class: [ "no-max", "no-min", "no-resize", 'tra', wbtheme],
    html: `

            <div style="padding: 5px;  font-size: 15px;text-align: center;">
                <img src="${devProps.deviceIcon}" style="width: 160px; height: 110px; object-fit: contain;">
                <p style="font-weight: bold;  margin: 0px; word-break: break-all; font-size: 25px;">${devProps.model || _('unknown')}</p>
<small style='padding-top: 0;color:gray;'>
                    ${devProps.inchRes || _("unknown")}, ${devProps.relYear || _("unknown")}
                </small>
            </div>
            <div style='user-select:auto;text-align: center;'>
                <b>${_("CPU")}: </b>${devProps.chip || _("unknown")}<br>
                <b>GPU: </b>${devProps.gpu || _("unknown")}<br>    
                <b>${_("memory")}: </b>${devProps.memory || _("unknown")}<br>
                <b>${_("startup_disk")}: </b>${startupDisk || _("unknown")}<br>
                <b>Infinity OS: </b>${devProps.os.version || _("unknown")}


            </div>
            
            
        `,
        height: 365,
        width: 260,
        minheight: 320,
        minwidth: 250,
  });
});
addSystemApp("Infinity Store",icns.store, function(){
    new wm("Infinity Store",{
    icon: icns.store,x: "center",y: "center",
    class: [ wbtheme],
    url: "apps/store.html",
          height:300,width:400,minheight: 200,minwidth:400,oncreate: function() {
            applySystemConfig(this.id)
          },
          
    
  });
});


addSystemApp("clock", icns.clock, function(){
    new wm(_('clock'), { 
        icon: icns.clock, x: "center",y: "center",
        class: [ 'no-max', wbtheme,'no-resize', 'tra'], 
        html: `<div style=\'padding-left:5px;\'><h2 class=\'clock-time\' style=\'font-size: 2em; margin: 0;\'>--:--:--</h2><p class=\'clock-date\' style=\'margin: 0;\'>--.--.----</p></div>`, 
        height:150, width:160 
    });
})

addSystemApp(("calculator"), icns.calc, function(){

    const uniqueCalcId = Math.floor(Math.random() * 1000000);
    const instanceName = `Calc_${uniqueCalcId}`;

    new wm(_('calculator'),{
        x: "center",
        y: "center", 
        icon: icns.calc, 
        class: [ 'no-max', wbtheme, 'no-resize', 'tra'], 
        html: `
            <style> 
                .calc-container {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr); /* 4 абсолютно рівні колонки */
                    gap: 6px; /* Гарні рівномірні відступи */
                    padding: 6px;
                    box-sizing: border-box;
                    width: 100%;
                    height: 100%;
                }
                .calc-btn {
                    width: 100%;
                    height: 42px;
                    font-size: 20px;
                    color: black !important;
                    cursor: pointer;
                    box-sizing: border-box;
                    border-radius: 6px; /* Трохи заокруглення в стиль ОС */
                }
                .calc-display {
                    grid-column: span 2; /* Дисплей займає рівно дві колонки */
                    width: 100%;
                    height: 42px;
                    font-size: 22px;
                    text-align: right;
                    padding-right: 8px;
                    box-sizing: border-box;
                    border-radius: 6px;
                }
            </style> 

            <div class="calc-container"> 
                <input inputmode="decimal" type="text" id="calc-result-${uniqueCalcId}" class="calc-display" readonly />
                
                <input type="button" value="C" class="calc-btn" onclick="window.${instanceName}.clr()"/> 
                <input type="button" value="π" class="calc-btn" onclick="window.${instanceName}.ent(Math.PI.toFixed(2))"/> 

                <input type="button" value="1" class="calc-btn" onclick="window.${instanceName}.dis('1')"/> 
                <input type="button" value="2" class="calc-btn" onclick="window.${instanceName}.dis('2')"/> 
                <input type="button" value="3" class="calc-btn" onclick="window.${instanceName}.dis('3')"/> 
                <input type="button" value="/" class="calc-btn" onclick="window.${instanceName}.dis('/')"/> 

                <input type="button" value="4" class="calc-btn" onclick="window.${instanceName}.dis('4')"/> 
                <input type="button" value="5" class="calc-btn" onclick="window.${instanceName}.dis('5')"/> 
                <input type="button" value="6" class="calc-btn" onclick="window.${instanceName}.dis('6')"/> 
                <input type="button" value="-" class="calc-btn" onclick="window.${instanceName}.dis('-')"/> 

                <input type="button" value="7" class="calc-btn" onclick="window.${instanceName}.dis('7')"/> 
                <input type="button" value="8" class="calc-btn" onclick="window.${instanceName}.dis('8')"/> 
                <input type="button" value="9" class="calc-btn" onclick="window.${instanceName}.dis('9')"/> 
                <input type="button" value="+" class="calc-btn" onclick="window.${instanceName}.dis('+')"/> 

                <input type="button" value="." class="calc-btn" onclick="window.${instanceName}.dis('.')"/> 
                <input type="button" value="0" class="calc-btn" onclick="window.${instanceName}.dis('0')"/> 
                <input type="button" value="=" class="calc-btn" onclick="window.${instanceName}.solve()"/> 
                <input type="button" value="*" class="calc-btn" onclick="window.${instanceName}.dis('*')"/> 
            </div> 
        `,
        height: 280, 
        width: 235,
        oncreate: function() {

            window[instanceName] = {
                dis: function(val) { 
                    const res = document.getElementById(`calc-result-${uniqueCalcId}`);
                    if(res) res.value += val;
                }, 
                solve: function() { 
                    const res = document.getElementById(`calc-result-${uniqueCalcId}`);
                    if(!res || res.value.trim() === "") return;
                    try { 

                        let y = eval(res.value); 
                        res.value = Number(y).toString(); 
                    } catch (e) { 
                        res.value = "Error"; 
                    } 
                }, 
                ent: function(i) {
                    const res = document.getElementById(`calc-result-${uniqueCalcId}`);
                    if(res) res.value += i;
                },
                clr: function() { 
                    const res = document.getElementById(`calc-result-${uniqueCalcId}`);
                    if(res) res.value = ""; 
                }
            };

            applySystemConfig(this.id);
        },

        onclose: function() {
            if (window[instanceName]) {
                delete window[instanceName];
            }
        }
    });
});


class ToggleOrderList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._items = [];
  }

  connectedCallback() {
    this.render();
  }

  set items(data) {
    this._items = [...data];
    this.render();
  }

  get items() {
    const listItems = this.shadowRoot.querySelectorAll('li');
    return Array.from(listItems).map(li => ({
      id: li.dataset.id,
      label: li.querySelector('.label-text').textContent,
      checked: li.querySelector('input[type="checkbox"]').checked,
      disabled: li.hasAttribute('data-disabled') // Persist disabled state flag
    }));
  }

  render() {
    this.shadowRoot.innerHTML = `
  <style>
    :host { display: block; max-width: 400px; font-family: system-ui, sans-serif; }
    ul { list-style: none; padding: 0; margin: 0; }
    
    /* Strict layout defaults only */
    li {
      display: flex; 
      align-items: center; 
      margin-bottom: 5px;
      cursor: grab;
    }
    li[data-disabled] { cursor: not-allowed; }
    li.dragging { cursor: grabbing; }
    
    .handle { user-select: none; margin-right: 10px; }
    li[data-disabled] .handle { color: #ced4da; }
    .label-text { flex-grow: 1; margin-left: 10px; }
  </style>
  <ul id="list-container">
    ${this._items.map(item => `
      <li part="item" 
          class="${item.disabled ? 'disabled' : ''}" 
          ${item.disabled ? 'data-disabled="true"' : 'draggable="true"'} 
          data-id="${item.id}">
        <span class="handle">☰</span>
        <input type="checkbox" ${item.checked ? 'checked' : ''} ${item.disabled ? 'disabled' : ''}>
        <span class="label-text">${item.label}</span>
      </li>
    `).join('')}
  </ul>
`;

    this.addDragAndDropListeners();
    this.addChangeListener();
  }

  addDragAndDropListeners() {
    const container = this.shadowRoot.getElementById('list-container');
    let draggedItem = null;

    container.addEventListener('dragstart', (e) => {
      const li = e.target.closest('li');
      if (li && !li.hasAttribute('data-disabled')) {
        draggedItem = li;
        setTimeout(() => li.classList.add('dragging'), 0);
      } else {
        e.preventDefault(); // Safety step if someone tries dragging handles
      }
    });

    container.addEventListener('dragend', (e) => {
      const li = e.target.closest('li');
      if (li) {
        li.classList.remove('dragging');
        draggedItem = null;
        this.dispatchUpdateEvent();
      }
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      const currentLi = this.shadowRoot.querySelector('.dragging');
      if (!currentLi) return;

      const afterElement = this.getDragAfterElement(container, e.clientY);
      
      // Prevent dropping items above an element that is locked/disabled at index 0
      if (afterElement && afterElement.hasAttribute('data-disabled')) {
        return;
      }

      if (afterElement == null) {
        container.appendChild(currentLi);
      } else {
        container.insertBefore(currentLi, afterElement);
      }
    });
  }

  addChangeListener() {
    this.shadowRoot.getElementById('list-container').addEventListener('change', () => {
      this.dispatchUpdateEvent();
    });
  }

  dispatchUpdateEvent() {
    this.dispatchEvent(new CustomEvent('list-updated', {
      detail: { items: this.items },
      bubbles: true,
      composed: true
    }));
  }

  getDragAfterElement(container, y) {
    const dragElements = [...container.querySelectorAll('li:not(.dragging)')];

    return dragElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
}

customElements.define('toggle-order-list', ToggleOrderList);

addSystemApp(("settings"), icns.settings, function(){
if (document.querySelector(".winbox.settings")) return;
    new wm(_('settings'),{x: "center",y: "center",
     icon: icns.settings, class: [ wbtheme, "settings"], 
     html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />

<style>
/* ===== СКИДАННЯ ТА ФІКСАЦІЯ КОНТЕКСТУ ===== */


body, html {
    margin: 0;
    padding: 0;
    height: 100vh;
    width: 100vw;
    overflow: hidden; /* ГАРАНТОВАНО прибирає зовнішній скрол сторінки */
}

#sett_app {
    width: 100%;
    height: 100%;
    overflow: hidden;
    container-type: inline-size;
}

/* ===== GRID ЛЕЙАУТ ===== */
main {
    margin: 0;
    padding: 0;
    height: 100%; /* Займає рівно 100% від #sett_app, без виходу за межі */
    width: 100%;
    display: grid;
    grid-template-columns: 240px 1fr;
    grid-template-rows: 100%; /* Фіксуємо висоту рядка грида */
    grid-template-areas: "sidebar content";
    overflow: hidden;
}

/* ===== SIDEBAR ===== */
.settings-toolbar {
    height: 100%; /* Замість 100vh */
    grid-area: sidebar;
    border-right: 1px solid #ccc;
    background: #f0f0f0;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    transition: 0.3s;
    overflow-y: auto; /* Якщо вкладок стане забагато, скролитиметься сам сайдбар */
}

.column{
      margin-top: 15px; display: flex; justify-content: flex-start; gap: 10px; width: max-content;
}

/* ===== CONTENT ===== */
.content-container {
    grid-area: content;
    height: 100%; /* Замість 100vh */
    overflow-y: auto; /* Єдине місце, де дозволено вертикальний скрол контенту! */
    padding: 15px;
}

/* Хендлер */
.sidebar-handle {
    display: none;
}

/* Вкладки */
.sidebar-tab:before{
    content: "» ";
}

.sidebar-tab:hover{
    text-decoration: underline;
}

.sidebar-separator {
    border-top: 1px solid #aaa;
    margin: 6px 0;
}

.page{
  margin-bottom:15px;
}




@container (width < 700px) {
    main.sidebar-collapsed {
        grid-template-columns: 50px 1fr; /* Трохи збільшили для зручності іконки ≡ */
    }

    main.sidebar-collapsed .settings-toolbar {
        padding: 5px;
        align-items: center;
    }

    main.sidebar-collapsed .settings-toolbar .sidebar-tab,
    main.sidebar-collapsed .settings-toolbar .sidebar-separator {
        display: none !important; /* Гарантовано ховаємо текст */
    }

    .sidebar-handle {
        display: block !important;
        width: 100%;
        padding: 8px 0;
        cursor: pointer;
        background: #ccc;
        border: 1px solid #aaa;
        text-align: center;
    }
}

/* ===== СТИЛІ ===== */
.setting-row:not(.right):not(.column) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 40px;
    padding: 8px 4px;
    transition: background-color 0.15s ease-in-out;
}

.setting-row:not(.column):not(.right) {
    border-top: 1px solid rgba(127, 127, 127, 0.25);
}

.setting-row:not(.column):first-child {
    border-top: none;
}

.setting-row:not(.column):not(.right):hover {
    background-color: var(--bg-menu-item-hover);
    border-radius: var(--radius-sm);
}

.setting-label {
    flex-grow: 1;
    width:100%;
    font-size: 14px;
    line-height: 1.3;
    color: var(--color-text-primary);
}






@keyframes fadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

#kbrd {
    display: block;
    width: 100%;
    height: auto;
    margin: 0;
    border-bottom-left-radius: 5px;
    transition: opacity 0.5s ease-in-out;
    opacity: 1;
}

#dispImg{
    width: 160px;
    height:90px;
    text-align: center;
    justify-content: center;
    background: #000;
    color: white;
    border: darkgrey 2.5px solid;
    padding: 5px;
    border-radius: 5px;
}


.crt{
    position: relative; /* важливо для ::before/::after */
    animation: textShadow 1.6s infinite;
}

.crt::before {
  content: " ";
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
  z-index: 2;
  background-size: 100% 2px, 3px 100%;
  pointer-events: none;
}

@keyframes flicker {
  0% {
  opacity: 0.27861;
  }
  5% {
  opacity: 0.34769;
  }
  10% {
  opacity: 0.23604;
  }
  15% {
  opacity: 0.90626;
  }
  20% {
  opacity: 0.18128;
  }
  25% {
  opacity: 0.83891;
  }
  30% {
  opacity: 0.65583;
  }
  35% {
  opacity: 0.67807;
  }
  40% {
  opacity: 0.26559;
  }
  45% {
  opacity: 0.84693;
  }
  50% {
  opacity: 0.96019;
  }
  55% {
  opacity: 0.08594;
  }
  60% {
  opacity: 0.20313;
  }
  65% {
  opacity: 0.71988;
  }
  70% {
  opacity: 0.53455;
  }
  75% {
  opacity: 0.37288;
  }
  80% {
  opacity: 0.71428;
  }
  85% {
  opacity: 0.70419;
  }
  90% {
  opacity: 0.7003;
  }
  95% {
  opacity: 0.36108;
  }
  100% {
  opacity: 0.24387;
  }
}

.crt::after {
  content: " ";
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: rgba(18, 16, 16, 0.1);
  opacity: 0;
  z-index: 2;
  pointer-events: none;
  animation: flicker 0.15s infinite;
}

@keyframes textShadow {
  0% {
    text-shadow: 0.4389924193300864px 0 1px rgba(0,30,255,0.5), -0.4389924193300864px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  5% {
    text-shadow: 2.7928974010788217px 0 1px rgba(0,30,255,0.5), -2.7928974010788217px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  10% {
    text-shadow: 0.02956275843481219px 0 1px rgba(0,30,255,0.5), -0.02956275843481219px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  15% {
    text-shadow: 0.40218538552878136px 0 1px rgba(0,30,255,0.5), -0.40218538552878136px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  20% {
    text-shadow: 3.4794037899852017px 0 1px rgba(0,30,255,0.5), -3.4794037899852017px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  25% {
    text-shadow: 1.6125630401149584px 0 1px rgba(0,30,255,0.5), -1.6125630401149584px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  30% {
    text-shadow: 0.7015590085143956px 0 1px rgba(0,30,255,0.5), -0.7015590085143956px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  35% {
    text-shadow: 3.896914047650351px 0 1px rgba(0,30,255,0.5), -3.896914047650351px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  40% {
    text-shadow: 3.870905614848819px 0 1px rgba(0,30,255,0.5), -3.870905614848819px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  45% {
    text-shadow: 2.231056963361899px 0 1px rgba(0,30,255,0.5), -2.231056963361899px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  50% {
    text-shadow: 0.08084290417898504px 0 1px rgba(0,30,255,0.5), -0.08084290417898504px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  55% {
    text-shadow: 2.3758461067427543px 0 1px rgba(0,30,255,0.5), -2.3758461067427543px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  60% {
    text-shadow: 2.202193051050636px 0 1px rgba(0,30,255,0.5), -2.202193051050636px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  65% {
    text-shadow: 2.8638780614874975px 0 1px rgba(0,30,255,0.5), -2.8638780614874975px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  70% {
    text-shadow: 0.48874025155497314px 0 1px rgba(0,30,255,0.5), -0.48874025155497314px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  75% {
    text-shadow: 1.8948491305757957px 0 1px rgba(0,30,255,0.5), -1.8948491305757957px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  80% {
    text-shadow: 0.0833037308038857px 0 1px rgba(0,30,255,0.5), -0.0833037308038857px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  85% {
    text-shadow: 0.09769827255241735px 0 1px rgba(0,30,255,0.5), -0.09769827255241735px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  90% {
    text-shadow: 3.443339761481782px 0 1px rgba(0,30,255,0.5), -3.443339761481782px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  95% {
    text-shadow: 2.1841838852799786px 0 1px rgba(0,30,255,0.5), -2.1841838852799786px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
  100% {
    text-shadow: 2.6208764473832513px 0 1px rgba(0,30,255,0.5), -2.6208764473832513px 0 1px rgba(255,0,80,0.3), 0 0 3px;
  }
}

</style>
</head>
<body>
<div id="sett_app">
<main class="sidebar-collapsed">

<!-- SIDEBAR -->
<div class="settings-toolbar">
    <button class="sidebar-handle" id="sidebarToggle">≡</button>

    <a class="sidebar-tab" data-page="general" data-i18n="general"></a>
    <a class="sidebar-tab" data-page="usage" data-i18n="usage"></a>

    <div class="sidebar-separator"></div>

    <a class="sidebar-tab" data-page="drivers" data-i18n="drivers"></a>
    <a class="sidebar-tab" data-page="display" data-i18n="display"></a>
    <a class="sidebar-tab" data-page="keyboard" data-i18n="keyboard"></a>

    <div class="sidebar-separator"></div>

    <a class="sidebar-tab" data-page="files" data-i18n="files"></a>
    <a class="sidebar-tab" data-page="themes" data-i18n="themes"></a>
    <a class="sidebar-tab" data-page="panel" data-i18n="panel"></a>
</div>


<div class="content-container" id="settings-content" style='padding-top:0;padding-right:0;'>

    <!-- GENERAL -->
    <div class="page" data-page="general">
        <h2 data-i18n="general"></h2>

        <div class="setting-row">
            <span class="setting-label" data-i18n="language"></span>

            <select id="languageSelect">
                <option value="en|EN-US">English</option>
                <option value="ua|UK-UA">Українська</option>
                <option value="fr|FR-FR">Français</option>
                <option value="ru|RU-RU">Русский</option>
                
                <option value="pl|pl-PL">Polski</option>
            </select>

        </div>

      <div class="setting-row">
          <label for="cleanOnBootTgl" data-i18n="clean_config_drive_on_boot"></label>
      <input id="cleanOnBootTgl" type="checkbox">
  </div>
      
    </div>
    
    <div class="page" data-page="drivers" hidden>

        <h2 data-i18n="drivers"></h2>
        <ul id='navigator_list' style="list-style-type: none;" ></ul>

        <h2 data-i18n="devices"></h2>
        <ul id='dev_list' style="list-style-type: none;"></ul>

    </div>

          <div class="page" data-page="usage" hidden>

        <h2 data-i18n="usage"></h2>
        <label for='allowUsage' data-i18n="allow_usage"></label>
        <input id="allowUsage" type="checkbox"> 

          <div style="padding-top:15px;" id="usage-list" class="usage-list"></div>

    </div>


<!-- DISPLAY -->
<div class="page" data-page="display" hidden>
    <div style="display: flex; align-items: flex-start; gap: 20px;">

        <!-- Лівий блок: заголовок та опис -->
        <div style="flex:1;">
            <h2 data-i18n="display"></h2>
     <div class="setting-row column">
    <label for="bgClockShow" data-i18n="show_bg_clock"></label>
      <input id="bgClockShow" type="checkbox">
      </div>
     <div class="setting-row column">
          <label for="hotCorners" data-i18n="hot_corners"></label>
      <input id="hotCorners" type="checkbox">
</div>

                    <div class="setting-row column">
                <span class="setting-label"  data-i18n="screen_timeout"></span>
<input type="range" min="0" value="1" max="30" step="1" id="screenTimeout">
                </div>

        </div>

        <!-- Правий блок: зображення та select -->
        <div style="flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-start; width:200px;">

            <div id="dispImg">Sample Text</div>

            <div class="setting-row right" style="margin-top:8px; padding:0; width:100%;">
                <span class="setting-label" data-i18n="display_type"></span>
                <select id="screenTypeSelect" style="width:100%;">
                    <option value="oled">OLED/AMOLED</option>
                    <option value="lcd">LCD</option>
                    <option value="crt">CRT</option>
                </select>
            </div>

        </div>
    </div>
</div>

<!-- KEYBOARD -->
<div class="page" data-page="keyboard" style='padding:0;' hidden>
    <div style="display: flex; align-items: flex-start; gap: 20px;">

        <!-- Лівий блок: заголовок та опис -->
        <div style="flex:1;">
            <h2 data-i18n="keyboard"></h2>
        </div>

        <!-- Правий блок: зображення та select -->
        <div style="flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-start; width:200px;">
            <img src="../assets/mac_kbrd.jpg" alt="Keyboard layout" id='kbrd' style="width:100%; height:auto; transition: opacity 0.5s ease-in-out; opacity:1;">

            <div class="setting-row right" style="margin-top:8px; padding:0; width:100%;">
                <span class="setting-label" data-i18n="keyboard_set"></span>
                <select id="keyboardLayoutSelect" style="width:100%;">
                    <option value="mac">Apple Mac OS</option>
                    <option value="win">Windows</option>
                </select>
            </div>
        </div>
    </div>
</div> 

    


    <!-- FILES -->
    <div class="page" data-page="files" hidden>
        <h2 data-i18n="files"></h2>
  <div class="setting-row">
        <label for='showHidden' data-i18n="show_hidden"></label>
        <input id="showHidden" type="checkbox"> 
</div>
      <toggle-order-list id='files-cols-lst'></toggle-order-list>

<h2 data-i18n="file_associations"></h2>
<div id='fileAssociations'>

</div>

    </div>

    <!-- THEMES -->
    <div class="page" data-page="themes" hidden>
        <h2 data-i18n="themes"></h2>
              <div class="setting-row">
              <label for='hideWinContentOnTransform' data-i18n="hide_win_content_on_transform"></label>
        <input id="hideWinContentOnTransform" type="checkbox"> 
      </div>
        <div class="setting-row">
                <span class="setting-label" data-i18n="theme"></span>
                <select id="themeSelect"></select>
                </div>
            
                
    </div>
    <!-- PANEL -->
    <div class="page" data-page="panel" hidden>
        <h2 data-i18n="panel"></h2>
        <div class="setting-row">
                <span class="setting-label"  data-i18n="panel_position"></span>
                <select id="panelPosSelect">
                    <option data-i18n="bottom" value="bt">Bottom</option>
                    <option data-i18n="top" value="top">Top</option>
</select>
                </div>
            
            
                    <div class="setting-row">
                <span class="setting-label"  data-i18n="size"></span>
<input type="range" min="30" value="35" max="35" step="5" id="panelSize">
                </div>

    
    </div>

</div>
</main>
</div>
</body>
</html>
     `
     ,
oncreate: function() {

const fileAssociations = document.getElementById('fileAssociations');

// Обходимо ключі об'єкта FILE_TYPES (txt, js, css...)
Object.keys(FILE_TYPES).forEach(ext => {
    const el = document.createElement("div");
    el.className = 'setting-row';

    // Відображаємо розширення файлу (наприклад, .js)
    const label = document.createElement("span");
    label.innerText = `.${ext}`;

    const selectContainer = document.createElement("div");
    
    const selectLabel = document.createElement("span");
    selectLabel.innerText = _('open_with') + ": ";

    // Створюємо правильний тег <select> замість <input>
    const select = document.createElement('select');
    if (FILE_TYPES[ext].openWith === null ||  (ext == "pdf" && !navigator.pdfViewerEnabled )) {
      label.style.color = 'gray';
      selectLabel.color = 'gray';
      select.disabled = true;
    }

    // Опція за замовчуванням (якщо програму не вибрано)
    const defaultOption = document.createElement('option');
    defaultOption.value = 'openf'; 
    defaultOption.text = _('files');
    select.appendChild(defaultOption);  

    // Наповнюємо випадаючий список додатками з реєстру
    apps.forEach(app => {
        // Перевіряємо, чи додаток взагалі вміє приймати файли
        if (!app.openWithParam || app.system) return;

        const newOption = document.createElement('option');
        newOption.value = app.path; // Логічніше зберігати url додатку для виклику
        newOption.text = app.name;  // Показуємо назву (наприклад, Monaco Editor)
        
        // Якщо цей додаток вже призначений для цього типу файлу — робимо його активним
        if (FILE_TYPES[ext].openWith === app.path) {
            newOption.selected = true;
        }
        
        select.appendChild(newOption);  
    });

    // Обробник зміни налаштування користувачем
    select.addEventListener('change', (e) => {
        FILE_TYPES[ext].openWith = e.target.value;
        FILE_ASSOC[ext] = e.target.value;
        localStorage.setItem('config/exts', JSON.stringify(FILE_ASSOC));
    });

    selectContainer.appendChild(selectLabel);
    selectContainer.appendChild(select);
    el.appendChild(label);
    el.appendChild(selectContainer);
    fileAssociations.appendChild(el);
});

  const checkboxes = document.querySelectorAll('.format-group input[type="checkbox"]');

  checkboxes.forEach(cb => {
    const unit = cb.dataset.unit;


    if (localeFormat.hasOwnProperty(unit)) {
      cb.checked = true;



    } else {
      cb.checked = false;
    }
  });
  

function getLocaleFormat() {
  const options = {};
  const checkboxes = document.querySelectorAll('.format-group input[type="checkbox"]');
  
  checkboxes.forEach(cb => {
    if (cb.checked) {
      const unit = cb.dataset.unit;
      let value = cb.value;

      if (value === "true") value = true;
      if (value === "false") value = false;

      options[unit] = value;
    }
  });
  localeFormat = options;
  localStorage.setItem("localeFormat", JSON.stringify(options))
  return options;
}

const thmSelect = document.getElementById("themeSelect");
const allFiles = parent.getFs();
const themeFiles = allFiles.filter(f => f.name.toLowerCase().endsWith(".theme"));

const parser = new ThemeParser(); 

thmSelect.innerHTML = `<option value="none">Glass (Default)</option>`;

themeFiles.forEach(f => {
    const el = document.createElement("option");
    el.value = f.name;
    el.innerText = f.name.replace(".theme", ""); // Прибираємо розширення для краси
    
    if (localStorage.getItem("theme") === f.name) {
        el.selected = true;
    }
    thmSelect.appendChild(el);
});

thmSelect.onchange = async () => {
    const selectedName = thmSelect.value;

    if (selectedName === "none") {
        localStorage.removeItem("theme");
        theme = null;
        loadTheme();
        const reboot = await confirm(_("confirm_set_theme"));
        if (reboot) safeShutdown({ restart: true });
        return;
    }

    const file = themeFiles.find(f => f.name === selectedName);
    if (!file) return;

    try {
        // Wrap FileReader in a Promise so we can await it
        const text = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });

        const thm = parser.parse(text);

        if (thm && thm.styles) {
            localStorage.setItem("theme", file.name);
            parser.applyTheme(thm.styles);

            const wbtheme = thm.name || "user-theme";
            applyThemeToUI(wbtheme);

            // Now this runs in the same async chain as the user gesture
            const reboot = await confirm(_("confirm_set_theme"));
            if (reboot) safeShutdown({ restart: true });
        }
    } catch (err) {
        console.error("Помилка при зміні теми:"+ err);
    }
};

    const toggleBtn = document.getElementById("sidebarToggle");
const tabs = document.querySelectorAll(".sidebar-tab");
const pages = document.querySelectorAll(".page");
const langSelect = document.getElementById("languageSelect");
const tbPosSelect = document.getElementById("panelPosSelect");
const tbSizeSelect = document.getElementById("panelSize");

toggleBtn.onclick = () => {
    document.querySelector("main").classList.toggle("sidebar-collapsed");
};

/* ===== I18N ===== */
function updateTexts() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.dataset.i18n;
        const text = _(key);
        if (text !== undefined) el.textContent = text;
    });
}

/* ===== INIT LANGUAGE ===== */
function initLanguageSelect() {
    const cl = currentLang;
    const dl = dateLang;
    if (!cl || !dl) return;
    langSelect.value = cl + "|" + dl;
}

panelPosSelect.value = (JSON.parse(localStorage.getItem('panel-conf')) || {}).pos;

tbSizeSelect.value = (JSON.parse(localStorage.getItem('panel-conf')) || {}).size;

tbSizeSelect.oninput = () => {
    const v = tbSizeSelect.value;
setPanelConfig({ size: tbSizeSelect.value });
}

panelPosSelect.onchange = () => {
const v = panelPosSelect.value; // "bt" or "top"
setPanelConfig({pos: panelPosSelect.value});
}

/* ===== CHANGE LANGUAGE ===== */
langSelect.onchange = () => {
    const [lang, date] = langSelect.value.split("|");

    currentLang = lang;
    dateLang = date;
    loadLanguage(lang, date);


    setTimeout(() => {
        updateTexts();      // оновлюємо тексти
        initLanguageSelect(); // щоб select відобразив актуальне значення
    }, 50);
};


const kbrdImg = document.getElementById('kbrd');
const screenTypeSelect = document.getElementById("screenTypeSelect");
const dispImg = document.getElementById('dispImg');


/* ===== TAB SWITCHING ===== */
async function showPage(name) {
    pages.forEach(p => {
        p.hidden = p.dataset.page !== name;
    });

    tabs.forEach(t => {
        t.classList.toggle("active", t.dataset.page === name);
    });

    updateTexts(); // на випадок якщо вкладка нова
if (name == "usage") {
  const usageH2 = document.querySelector('h2[data-i18n="usage"]');
    allowUsage = document.getElementById("allowUsage");
    allowUsage.checked = allowScreenTime;
    
    allowUsage.onchange = () => {
        allowScreenTime = allowUsage.checked;
        localStorage.setItem("allowScreenTime", allowUsage.checked);


        if (!allowScreenTime) {
            if (window.usageIntervalId) {
                clearInterval(window.usageIntervalId);
                window.usageIntervalId = null;
            }
            document.getElementById('usage-list').innerHTML = '';
            
            if (usageH2) usageH2.textContent = _("usage");
        } else {

            updateUsageTab();
            if (!window.usageIntervalId) {
                window.usageIntervalId = setInterval(updateUsageTab, 2000);
            }
        }
    };


    const formatTime = (seconds) => {
        const fmtSec = new Intl.NumberFormat(dateLang, { style: "unit", unit: "second", unitDisplay: "short" });
        const fmtMin = new Intl.NumberFormat(dateLang, { style: "unit", unit: "minute", unitDisplay: "short" });
        const fmtHr  = new Intl.NumberFormat(dateLang, { style: "unit", unit: "hour",   unitDisplay: "short" });

        if (seconds < 60) return fmtSec.format(seconds);
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return fmtMin.format(minutes);
        
        const hours = Math.floor(minutes / 60);
        const remMinutes = minutes % 60;
        
        if (remMinutes === 0) return fmtHr.format(hours);
        return `${fmtHr.format(hours)} ${fmtMin.format(remMinutes)}`;
    };

    const updateUsageTab = () => {

        if (allowScreenTime != true) return;

        const rawData = localStorage.getItem('.usageData');
        const usageList = document.getElementById('usage-list');

        if (!usageList) return; // Захист на випадок, якщо DOM уже знищено

        if (!rawData) {
            usageList.innerHTML = ``;
            usageH2.innerText = _("usage");
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const stats = JSON.parse(rawData);
        const todayStats = stats[today] || {};
        const appEntries = Object.entries(todayStats);

        if (appEntries.length === 0) {
            usageList.innerHTML = ``;
            usageH2.textContent = _("usage");
            return;
        }

        let totalSeconds = 0;
        let maxSeconds = 0;

        appEntries.forEach(([_, seconds]) => {
            totalSeconds += seconds;
            if (seconds > maxSeconds) maxSeconds = seconds;
        });

        usageH2.innerText = `${_("usage")} - ${formatTime(totalSeconds)}`;
        usageList.innerHTML = '';

        appEntries.sort((a, b) => b[1] - a[1]);

        appEntries.forEach(([appName, seconds]) => {
            const item = document.createElement('div');
            item.className = 'usage-item';

            const info = document.createElement('div');
            info.className = 'usage-info';
            info.style.display = 'flex';
            info.textContent = _(appName.replace(/\[.*?\]/g, "")) + " - " + formatTime(seconds);

            const progress = document.createElement('progress');
            progress.className = 'usage-bar';
            progress.max = maxSeconds;
            progress.value = seconds;

            item.appendChild(info);
            item.appendChild(progress);
            usageList.appendChild(item);
        });
    };

    updateUsageTab();

    if (window.usageIntervalId) clearInterval(window.usageIntervalId);

    if (allowScreenTime === true) {
        window.usageIntervalId = setInterval(updateUsageTab, 2000);
    }


    if (this && typeof this.onclose === 'function') {
        const originalOnClose = this.onclose;
        this.onclose = function() {
            if (window.usageIntervalId) {
                clearInterval(window.usageIntervalId);
                window.usageIntervalId = null;
            }
            originalOnClose.apply(this, arguments);
        };
    } else if (this) {

        this.onclose = function() {
            if (window.usageIntervalId) {
                clearInterval(window.usageIntervalId);
                window.usageIntervalId = null;
            }
        };
    }
}
if (name == 'themes'){
  hideWinContentOnTransformCheck = document.getElementById("hideWinContentOnTransform");
  hideWinContentOnTransformCheck.checked = hideWinContentOnTransform;
  hideWinContentOnTransformCheck.onchange = () => {
    hideWinContentOnTransform = hideWinContentOnTransformCheck.checked;
    localStorage.setItem('hideWinContentOnTransform', JSON.stringify(hideWinContentOnTransformCheck.checked))
  }
}
if (name == "files") {
    const showHiddenCheck = document.getElementById("showHidden");
    showHiddenCheck.checked = filesShowHidden;
    let tmpFilesCols = filesCols;
    const filesColsList = document.getElementById('files-cols-lst');
    
    // De-duplicate columns using a Set
    const uniqueCols = [...new Set(['name', 'lastModified', 'type', 'size', ...filesCols])];
    
    // Notice the parentheses ({ ... }) around the returned object!
    filesColsList.items = uniqueCols.map(col => ({
        id: col, 
        label: _(col), 
        checked: filesCols.includes(col) || col == 'name', 
        disabled: col == 'name'
    }));

    filesColsList.addEventListener('list-updated', (e) => {
      tmpFilesCols = filesColsList.items.filter(col => (col.checked && !col.disabled)).map(col => col.id);
      filesCols = tmpFilesCols;
      console.log('List structure updated in real-time:', filesCols)
        filesSettings = { "filesCols": filesCols, "showHidden": filesShowHidden };
        localStorage.setItem("config/files", JSON.stringify(filesSettings)); 

    });

    showHiddenCheck.onchange = () => {
        filesShowHidden = showHiddenCheck.checked;
        filesSettings = { "filesCols": tmpFilesCols, "showHidden": filesShowHidden };
        localStorage.setItem("config/files", JSON.stringify(filesSettings));
    };
}
    else if (name == "drivers"){

const container = document.getElementById("navigator_list");
container.innerHTML = "";

const availableDrivers = Object.keys(devProps)
  .filter(name => (devProps[name] != null) && name != "os" && name != "deviceIcon" && name != "relYear" && name != "inchRes" && name != "model");

availableDrivers.forEach(name => {
  const li = document.createElement("li");
  li.innerText = name;
  container.appendChild(li);
});


const container1 = document.getElementById("dev_list");
container1.innerHTML = "";

devices.forEach(dev => {
  const li = document.createElement("li");
  if (dev.type == "screen") {
    li.innerHTML = `<b>${_("display")}</b>${dev.width}*${dev.height}`;
  } else {
li.innerHTML = `<b>${dev.id}</b>`;
  }
  container1.appendChild(li);
});

const d = await getDisks();
d.forEach(dsk => {
  if (dsk.type != "localStorage") {
    const li = document.createElement("li");

    li.innerHTML = `<b>${dsk.name}</b>${dsk.type}`;
    container1.appendChild(li);
  }
});


    }
if (name == "general"){
const cleanOnBootTgl = document.getElementById('cleanOnBootTgl');
cleanOnBootTgl.checked = cleanOnBoot;
cleanOnBootTgl.onchange = () => {
    cleanOnBoot = cleanOnBootTgl.checked;
    localStorage.setItem("cleanOnBoot", JSON.stringify(cleanOnBootTgl.checked) )
}
}
    if (name == "keyboard"){
        
    setTimeout(() => {

        kbrdImg.src = "assets/" + keyboardLayoutSelect.value + "_kbrd.jpg";

        kbrdImg.style.opacity = 1;
    }, 250); // половина часу transition

    }

    if (name == "display"){
    const scrTm = document.getElementById("screenTimeout");
    if (localStorage.getItem("sleepModeTimeout")) scrTm.value = parseInt(localStorage.getItem("sleepModeTimeout"))/60/1000;
scrTm.oninput = () => {
    const v = scrTm.value;
    scrTm.title = scrTm.value + " M"
    if (v == 0){scrTm
        PowerManager.pause();
    }else{
    if (PowerManager.isPaused) PowerManager.resume();
        PowerManager.setTimeout(v * 60 * 1000); // Change to 10 minutes
    }
    localStorage.setItem("sleepModeTimeout", v * 60 * 1000)
}
    
     const bgClockShow = document.getElementById("bgClockShow");
bgClockShow.checked = bgClock;
bgClockShow.onchange = () => {
    
    bgClock = bgClockShow.checked;
        localStorage.setItem("backgroundClock", JSON.stringify(bgClock));

        const desktopFore = document.getElementById("desktop-fore");
        if (desktopFore) {
            desktopFore.style.display = bgClock ? "flex" : "none";
        }
    
}


const hotCornersEnbl = document.getElementById("hotCorners");
hotCornersEnbl.checked = enableHotCorners;
hotCornersEnbl.onchange = () => {
    
    enableHotCorners = hotCornersEnbl.checked;
        localStorage.setItem("enableHotCorners", JSON.stringify(enableHotCorners));
    
}
        dispImg.classList = [];

if (screenTypeSelect.value == "lcd") {
    /*
            box-shadow: 
    inset 6px 6px 10px 0 rgba(0, 0, 0, 0.2),  
    inset -6px -6px 10px 0 rgba(255, 255, 255, 0.5);
  padding: 20px;
  background-color: #e0e0e0; 
  border-radius: 10px;
            */
    dispImg.style.boxShadow = 'inset 6px 6px 10px 0 rgba(0, 0, 0, 0.2),inset -6px -6px 10px 0 rgba(255, 255, 255, 0.5)';
} else if (screenTypeSelect.value == "crt") {
    dispImg.style.boxShadow = 'none';
    dispImg.classList = ["crt"];
} else {
    dispImg.style.boxShadow = 'none';
}
    }
}

tabs.forEach(tab => {
    tab.onclick = () => {
        showPage(tab.dataset.page);
    };
});

const keyboardLayoutSelect = document.getElementById("keyboardLayoutSelect");

if(currentKeyboardLayout) {
    keyboardLayoutSelect.value = currentKeyboardLayout;
}

keyboardLayoutSelect.onchange = () => {
    

    currentKeyboardLayout = keyboardLayoutSelect.value;
    chKbrdLayout(keyboardLayoutSelect.value);
    localStorage.setItem("currentKeyboardLayout",keyboardLayoutSelect.value );

    kbrdImg.style.opacity = 0;
    setTimeout(() => {

        kbrdImg.src = "assets/" + keyboardLayoutSelect.value + "_kbrd.jpg";

        kbrdImg.style.opacity = 1;
    }, 250); // половина часу transition
};





screenTypeSelect.onchange = () => {

    displayType = screenTypeSelect.value;

    setTimeout(() => {
        dispImg.classList = [];

        if (screenTypeSelect.value == "lcd"){
            /*
            box-shadow: 
    inset 6px 6px 10px 0 rgba(0, 0, 0, 0.2),  
    inset -6px -6px 10px 0 rgba(255, 255, 255, 0.5);
  padding: 20px;
  background-color: #e0e0e0; 
  border-radius: 10px;
            */
            dispImg.style.boxShadow = 'inset 6px 6px 10px 0 rgba(0, 0, 0, 0.2),inset -6px -6px 10px 0 rgba(255, 255, 255, 0.5)';
        }else if (screenTypeSelect.value == "crt"){
            dispImg.style.boxShadow = 'none';
            dispImg.classList = ["crt"];
        }else{
            dispImg.style.boxShadow = 'none';
        }
        
    }, 250); // половина часу transition
}



/* ===== INIT ===== */
initLanguageSelect();
showPage("general");
updateTexts();
}
      ,height:215, width:200, minheight:200, minwidth:200 });
})

let history = [];

window.ActiveTerminals = {
    currentActiveId: null,
    instances: {},

    initHook: function(originalConsole) {
        const methods = ['log', 'warn', 'error', 'dir', 'table'];
        methods.forEach(method => {
            window.console[method] = (...args) => {

                if (this.currentActiveId && this.instances[this.currentActiveId]) {
                    this.instances[this.currentActiveId][method](...args);
                }

                originalConsole[method](...args);
            };
        });
    }
};

if (!window.console._hooked) {
    const originalConsole = { ...window.console };
    window.ActiveTerminals.initHook(originalConsole);
    window.console._hooked = true;
}

addSystemApp(("terminal"), icns.term, function(){
    const uniqueTermId = Date.now();
    
    // Поточні змінні для системного префіксу (можна динамічно змінювати)
    let termHost = devProps.os.name.replaceAll(' ', '-').toLowerCase();

    new wm(_('terminal'), {
        x: "center", y: "center",
        icon: icns.term,
        class: [ wbtheme, 'winbox-terminal', 'tra'],
        html: `
<div class="no-font" id="term-container-${uniqueTermId}" style="width:100%; height:100%; background:rgba(0,0,0,0.5); color:#fff; display:flex; flex-direction:column; user-select:text !important;">
  <div id="tout-${uniqueTermId}" style="flex-grow:1; overflow-y:auto; padding:10px; font-family:monospace !important; box-sizing:border-box;"></div>
</div>
        `,
        oncreate: function () {
            const out = document.getElementById(`tout-${uniqueTermId}`);
            const container = document.getElementById(`term-container-${uniqueTermId}`);
            
            let historyIndex = -1;
const termLbl = `<span style="color:#8be9fd;">root</span>@<span style="color:#50fa7b;">${termHost}</span> <span style="color:#ff79c6;">$</span><span style="color:#f1fa8c;">> </span>`
            // Функція створення inline-рядка для вводу команди
            function createPromptLine() {
                // Видаляємо старий інпут, якщо він є
                const oldLine = out.querySelector('.term-active-line');
                if (oldLine) oldLine.remove();

                const lineWrapper = document.createElement('div');
                lineWrapper.className = 'term-active-line';
                lineWrapper.style.display = 'flex';
                lineWrapper.style.alignItems = 'center';
                lineWrapper.style.width = '100%';

                // Елемент префіксу (Промпт)
    const promptSpan = document.createElement('span');
promptSpan.style.whiteSpace = 'nowrap';
promptSpan.style.marginRight = '5px';
promptSpan.style.flexShrink = '0'; // ДОДАЙТЕ ЦЕ
promptSpan.innerHTML = termLbl;
                

                // Сам інпут, інтегрований у рядок
                const input = document.createElement('input');
                input.id = `term-input-${uniqueTermId}`;
                input.type = 'text';
                input.style.flexGrow = '1';
                input.style.fontFamily = 'monospace';
                input.style.background = 'transparent'; // Повна прозорість, колір фону йде від контейнера
                input.style.color = '#fff';
                input.style.border = 'none';
                input.style.outline = 'none';
                input.style.padding = '0';
                input.style.margin = '0';
                input.autocomplete = 'off';
                input.setAttribute('spellcheck', 'false');

                lineWrapper.appendChild(promptSpan);
                lineWrapper.appendChild(input);
                out.appendChild(lineWrapper);

                // Налаштування подій для нового інпуту
                input.onfocus = () => {
                    window.ActiveTerminals.currentActiveId = uniqueTermId;
                };

                input.onkeydown = (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        executeCommand(input.value);
                    } else if (e.key === "ArrowUp") {
                        if (historyIndex < history.length - 1) {
                            historyIndex++;
                            input.value = history[history.length - 1 - historyIndex];
                        }
                        e.preventDefault();
                    } else if (e.key === "ArrowDown") {
                        if (historyIndex > 0) {
                            historyIndex--;
                            input.value = history[history.length - 1 - historyIndex];
                        } else {
                            historyIndex = -1;
                            input.value = "";
                        }
                        e.preventDefault();
                    }
                };

                // Фокусуємося
                input.focus();
                out.scrollTop = out.scrollHeight;
            }
container.onclick = (e) => {
    // Перевіряємо, чи користувач випадково не виділяє текст прямо зараз
    if (window.getSelection().toString().trim() != '') {
        return; // Якщо є виділений текст — нічого не робимо, даємо скопіювати
    }
    
    // Якщо клікнули нижче всіх логів (на порожнє місце самого контейнера)

        const activeInput = document.getElementById(`term-input-${uniqueTermId}`);
        if (activeInput) activeInput.focus();
    
};

            function appendAnsiText(targetElement, rawStr, defaultColor = '#fff') {
                const colors = {
                    30:"#000", 31:"#f55", 32:"#5f5", 33:"#ff5",
                    34:"#59f", 35:"#f5f", 36:"#5ff", 37:"#fff"
                };
                const wrapper = document.createElement('div');
                wrapper.style.color = defaultColor;
                wrapper.style.whiteSpace = 'pre-wrap';
                const parts = String(rawStr).split(/\x1b\[(\d+)m/);
                let currentColor = null;

                for (let i = 0; i < parts.length; i++) {
                    if (i % 2 === 1) {
                        const code = parts[i];
                        if (code === "0") currentColor = null;
                        else currentColor = colors[code] || currentColor;
                    } else {
                        if (parts[i]) {
                            const span = document.createElement('span');
                            if (currentColor) span.style.color = currentColor;
                            span.textContent = parts[i];
                            wrapper.appendChild(span);
                        }
                    }
                }

                // Вставляємо вивід ПЕРЕД активним рядком вводу
                const activeLine = out.querySelector('.term-active-line');
                if (activeLine) {
                    out.insertBefore(wrapper, activeLine);
                } else {
                    targetElement.appendChild(wrapper);
                }
                out.scrollTop = out.scrollHeight;
            }

            const terminalConsole = {
                clear: () => {
                    out.innerHTML = "";
                    createPromptLine();
                },
                dir: (obj) => {
                    if (!obj) return;

                        const keys = Object.getOwnPropertyNames(obj);
                        for (const key of keys) {
                            terminalConsole.log(`${key} : ${typeof obj[key]}`);
                        }

                },
                log: (...args) => {
                    const processed = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(" ");
                    appendAnsiText(out, processed, '#fff');
                },
                warn: (...args) => {
                    const processed = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(" ");
                    appendAnsiText(out, processed, '#f90');
                },
error: (...args) => {
  const activeInput = document.getElementById(`term-input-${uniqueTermId}`);
    const processed = args.map(arg => {
        // Force absolutely anything into a string string format first
        let errMsg = '';
        if (arg && arg.message) {
            errMsg = arg.message;
        } else if (typeof arg === 'object') {
            errMsg = JSON.stringify(arg);
        } else {
            errMsg = String(arg);
        }
        if (errMsg.trim() == 'Unexpected end of input') return `Unknown command.`;

        // Hyper-flexible match: find the exact word or path right before "is not defined"
        // This ignores any prefixes like "Error:", "ReferenceError:", or terminal spaces
        const match = errMsg.match(/(\S+)\s+is\s+not\s+defined|Unexpected\s+identifier\s+['"]?([^\s'"]+)['"]?/);
        
        if (match) {
            // Clean out any leftover wrapper quotes or colons if the engine added them
          const rawCommand = match[1] || match[2];
          inpVal = (activeInput.value.includes('(') && activeInput.value.includes(')') ) ? activeInput.value : activeInput.value.split(' ')[0];
            const commandName = (activeInput.value.trim() != '') ? activeInput.value : rawCommand.replace(/['":]/g, '').trim();
            const commandDisplayName = (activeInput.value.trim() != '') ? inpVal : rawCommand.replace(/['":]/g, '').trim();

            if (commandName.includes(' /')) {
                return `Command ${commandDisplayName} is trying to manipulate empty directory named '[empty]/' (slash symbol, but no name provided)`;
            } 
            
            return `Commnd Error: ${commandDisplayName}. \n${errMsg}`;
        }

        // Fallback if no match
        return errMsg;
    }).join(" ");

    appendAnsiText(out, processed, '#f00');
},
                table: (data) => {
                    if (!data || typeof data !== 'object') {
                        terminalConsole.log(data);
                        return;
                    }
                    const table = document.createElement('table');
                    table.style.borderCollapse = 'collapse';
                    table.style.width = '100%';
                    table.style.margin = '10px 0';
                    table.style.color = '#fff';
                    table.style.border = '1px solid #444';
                    table.style.fontFamily = 'monospace';

                    const isArray = Array.isArray(data);
                    const sample = isArray ? data[0] : data[Object.keys(data)[0]];
                    const headers = ['(index)', ...Object.keys(sample || {})];

                    const thead = table.createTHead();
                    const headerRow = thead.insertRow();
                    headers.forEach(text => {
                        const th = document.createElement('th');
                        th.textContent = text;
                        th.style.border = '1px solid #444';
                        th.style.padding = '8px';
                        th.style.backgroundColor = '#222';
                        headerRow.appendChild(th);
                    });

                    const tbody = table.createTBody();
                    for (const [key, val] of Object.entries(data)) {
                        const row = tbody.insertRow();
                        const indexCell = row.insertCell();
                        indexCell.textContent = key;
                        indexCell.style.border = '1px solid #444';
                        indexCell.style.padding = '4px 8px';
                        indexCell.style.fontWeight = 'bold';

                        headers.slice(1).forEach(header => {
                            const cell = row.insertCell();
                            const cellValue = (val && typeof val === 'object') ? val[header] : val;
                            cell.textContent = cellValue !== undefined ? cellValue : '';
                            cell.style.border = '1px solid #444';
                            cell.style.padding = '4px 8px';
                        });
                    }

                    const activeLine = out.querySelector('.term-active-line');
                    if (activeLine) {
                        out.insertBefore(table, activeLine);
                    } else {
                        out.appendChild(table);
                    }
                    out.scrollTop = out.scrollHeight;
                }
            };

            window.ActiveTerminals.instances[uniqueTermId] = terminalConsole;

            const executeCommand = async (value) => {
                const val = value.trim();
                if (!val) {
                    createPromptLine();
                    return;
                }

                history.push(val);
                historyIndex = -1;

                // Фіксуємо виконану команду в історії виводу (як статичний текст)
                const cmdLog = document.createElement('div');
                cmdLog.style.color = '#aaa';
                // Відображаємо у логах саме той промпт, який був при вводі
                cmdLog.innerHTML = termLbl + escapeHtml(val);
                
                const activeLine = out.querySelector('.term-active-line');
                if (activeLine) out.insertBefore(cmdLog, activeLine);

                window.ActiveTerminals.currentActiveId = uniqueTermId;

                try {
                    const runner = new Function('console', 'code', 'return (async () => { return eval(code); })()');
                    const r = await runner(terminalConsole, val);

                    if (r !== undefined) {
                        const res = document.createElement('div');
                        res.style.color = '#fff';
                        res.style.whiteSpace = 'pre-wrap';
                        
                        if (r instanceof File || r instanceof Blob) {
                            const fileMeta = {
                                "[Class]": r.constructor.name,
                                name: r.name || "Blob_Data",
                                size: (r.size / 1024).toFixed(2) + " KB",
                                type: r.type || "application/octet-stream",
                                lastModified: r.lastModified ? r.lastModified : "N/A"
                            };
                            res.textContent = JSON.stringify(fileMeta, null, 2);
                        } else if (Array.isArray(r) && (r[0] instanceof File || r[0] instanceof Blob)) {
                            const arrayMeta = r.map((f, idx) => ({
                                index: idx,
                                name: f.name,
                                size: f.size,
                                type: f.type,
                                lastModified: f.lastModified ? f.lastModified : "N/A"
                            }));
                            res.textContent = "Can't display JS file objects directly. Displaying adapted:\nStorage: " + (typeof currentDisk !== 'undefined' ? currentDisk.name : 'N/A') +  "\n" + JSON.stringify(arrayMeta, null, 2);
                        } else if (typeof apps !== 'undefined' && r === apps) {
                              const cleanedAppsForLog = apps.map(app => {
                                  if (app.icon && app.icon.startsWith("data:")) {
                                      return { ...app, icon: "BASE64 image omitted" };
                                  }
                                  if (app.element) {
                                      return { ...app, element: true };
                                  }
                                  if (app.system){
                                    return { ...app, path: 'RAM/*'};
                                  }
                                  return app; 
                              });
                              res.textContent = JSON.stringify(cleanedAppsForLog, null, 2);
                        } else {
                            if (typeof r === 'object' && r !== null) {
                                res.textContent = JSON.stringify(r, (key, value) => {
                                    if (typeof value === 'function') {
                                        return `[Function: ${value.name || 'anonymous'}]`;
                                    }
                                    return value;
                                }, 2);
                            } else {
                                res.textContent = (typeof r === 'string' && r.includes(' ') ? _(r) : String(r));
                            }
                        }
                        
                        if (activeLine) out.insertBefore(res, activeLine);
                    }
                } catch(e) {
console.error(e)
                }

                // Рендеримо новий чистий рядок для наступної команди
                createPromptLine();
            };

            // Ініціалізуємо найперший рядок вводу
            createPromptLine();
        },
        onclose: function () {
            delete window.ActiveTerminals.instances[uniqueTermId];
            if (window.ActiveTerminals.currentActiveId === uniqueTermId) {
                window.ActiveTerminals.currentActiveId = null;
            }
        },
        minheight: 200, minwidth: 350,
        width: 350, height: 350,
    });
});


addSystemApp(("web_browser"), icns.web, function(){
const unique_ls = localStorage;
    new wm(_('web_browser'),{x: "center",y: "center",icon: icns.web,class: [ wbtheme],url: 'apps/web.html',height:400,width:600,minheight: 200,minwidth:400,oncreate: function() {
            applySystemConfig(this.id);
          }, onclose: function(force){
          localStorage = unique_ls;
              return false;
              
          }});
})

addSystemApp(("task_mgr"), icns.tasks, function(){
    new wm(_('task_mgr'),{x: "center",y: "center",icon: icns.tasks,class: [ wbtheme],url: 'apps/resmon.html',height:400,width:600,minheight: 200,minwidth:400, oncreate: function() {
            applySystemConfig(this.id)
          }});
})

async function gitClone(url, branch = "main") {
  // Clean up trailing slashes to prevent empty repository names
  if (url.endsWith('/')) url = url.slice(0, -1);
  if (url.includes('tree/')) url = url.split('tree/')[0];

  // Parse owner and repo name
  const parts = url.split("/");
  const repoName = parts.pop();
  const owner = parts[parts.length-1];

  // GitHub API endpoint for zipballs bypasses standard web CORS restrictions gracefully
  let downloadUrl = `https://api.github.com/repos/${owner}/${repoName}/zipball/${branch}`;

  try {
    console.log(`Cloning into ${repoName} (branch: ${branch})...`);
    let response = await fetch(downloadUrl);

    // If main fails, try falling back to master automatically
    if (!response.ok && branch === "main") {
      console.warn(`Branch "${branch}" not found. Retrying with "master"...`);
      return await gitClone(url, "master");
    }

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const blob = await response.blob();
    const repoFile = new File([blob], `${repoName}.zip`); // Added extension clarity

    await unzipFile(repoFile, repoName);
    return true; 
    
  } catch (error) {
    console.error('Clone failed:', error.message || error);
    return false;
  }
}


async function node(fileName) {
    let file;
    if (typeof fileName == "string"){
     file = fs.find(f => f.name === fileName);
    if (!file) console.error( `node: can't open file '${fileName}'`);
} else if (fileName instanceof File) { file = fileName }

    let rawCode = "";
    if (file.content) {
        rawCode = file.content;
    } else if (typeof file.text === 'function') {
        rawCode = await file.text(); // Зчитуємо текст з об'єкта File
    }

// Створюємо базовий клієнтський клас
class WSClient {
    constructor(url) {
        this.socket = new WebSocket(url);
        this.events = {};
        this.socket.onopen = (e) => this.emit('open', e);
        this.socket.onclose = (e) => this.emit('close', e);
        this.socket.onerror = (e) => this.emit('error', e);
        this.socket.onmessage = (e) => this.emit('message', e.data);
    }
    send(data) { if (this.socket.readyState === WebSocket.OPEN) this.socket.send(data); }
    close() { this.socket.close(); }
    on(event, cb) { (this.events[event] = this.events[event] || []).push(cb); }
    emit(event, data) { (this.events[event] || []).forEach(cb => cb(data)); }
}

// Клас Сервера
class WSServer {
    constructor(options = {}) {
        this.onconnection = null;
        window.addEventListener("node-ws", e => {
            const client = {
                send: (data) => window.dispatchEvent(new CustomEvent("ui-ws", { detail: data })),
                on: (event, cb) => { if(event === 'message') this.onmessage = cb; }
            };
            this.onconnection?.(client);
            this.onmessage?.(e.detail);
        });
    }
    on(event, cb) { if (event === "connection") this.onconnection = cb; }
}

// МАГІЯ: Робимо wsModule посиланням на клієнт, але додаємо туди .Server та .WebSocket
const wsModule = WSClient; // Тепер const WebSocket = require('ws'); new WebSocket() спрацює!
wsModule.Server = WSServer;
wsModule.WebSocket = WSClient; // Для деструктуризації: const { WebSocket } = require('ws');
const pathModule = {
    join: (...args) => args.join('/').replace(/\/+/g, '/'),
    basename: (path) => path.split('/').pop(),
    extname: (path) => path.includes('.') ? '.' + path.split('.').pop() : ''
};
class EventEmitter {
    constructor() { this.events = {}; }
    on(event, cb) { (this.events[event] = this.events[event] || []).push(cb); }
    emit(event, data) { (this.events[event] || []).forEach(cb => cb(data)); }
}

    const virtualFS = {
    readFileSync: (path) => {
        const file = fs.find(f => f.fullPath === path || f.name === path);
        if (!file) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
        return file.content;
    },
    writeFileSync: (path, data) => {
        const existingFile = fs.find(f => f.name === path);
        if (existingFile) {
            existingFile.content = data;
            saveFileToDB(existingFile); // Ваша функція збереження в IndexedDB
        } else {

            const newFile = new File([data], path,{type: "text/plain"} )
                
                  fs.push(newFile);
            saveFileToDB(newFile);
            
          
        }
        return true;
    },
    readdirSync: (path) => {

        return fs.filter(f => f.name.startsWith(path))
                 .map(f => f.name);
    },
    existsSync: (path) => {
        return !!fs.find(f => f.name === path);
    }
};

// 1. Fix the require wrapper logic inside function node()
const require = (name) => {
    if (name === "fs") return virtualFS; 
    if (name === "path") return pathModule;
    if (name === "events") return { EventEmitter };
    if (name === "ws") return wsModule;

    const cleanName = name.startsWith('./') ? name.slice(2) : name;
    const extension = cleanName.endsWith('.js') ? '' : '.js';
    const modulePath = `system/node_modules/${cleanName}${extension}`;
    
    const moduleFile = fs.find(f => f.name === modulePath);
    if (!moduleFile) {
        console.error(`Cannot find module '${name}' at ${modulePath}`);
        return {};
    }

    const mContent = moduleFile.content || "";
    const localModule = { exports: {} }; // Named uniquely to avoid collision
    
    try {
        // If the code already contains a 'return', wrapping it directly can break logic.
        // We inject require, module, and exports cleanly.
        const wrapper = new Function('require', 'module', 'exports', `
            ${mContent}
            return module.exports;
        `);

        // Pass our localModule tracking object down
        const result = wrapper(require, localModule, localModule.exports);

        // Fallback to checking localModule.exports directly if result missed it
        const finalExport = result !== undefined ? result : localModule.exports;

        if (finalExport && finalExport.default && Object.keys(finalExport).length === 1) {
            return finalExport.default;
        }

        return finalExport;
    } catch (e) {
        // Don't swallow the bug! Print the exact stack trace to see what broke inside ms.js
        console.error(`Require error in ${name}:`, e);
        throw e; 
    }
};


    try {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

        try {
    new Function(rawCode); // Спроба просто скомпілювати код
} catch (e) {
    console.error( `node: Syntax Error: ${e.message}`);
}

        const script = new AsyncFunction('require', 'process', 'console', rawCode);
        
        const process = {
            env: { NODE_ENV: 'production' },
            version: devProps.os.version
        };

        await script(require, process, console);
        return `Process '${fileName}' finished.`;
    } catch (err) {
console.error(`node: runtime error: \n${err.stack}`);
    throw err; // <-- FIXED: Changed 'throw e' to 'throw err'
    }
}




const installedpkg = new Set();

function npmUpdate() {
    installedpkg.clear();

    const coreModules = ["fs", "path", "events", "ws"];
    coreModules.forEach(pkg => installedpkg.add(pkg));

    fs.forEach(f => {
        if (f.name.startsWith("system/node_modules/")) {
            const name = f.name.split("/").pop().replace(/\.js$/, "");
            console.log("Updated pkg: "+name);
            installedpkg.add(name);
        }
    });
}

function npmList(){
return JSON.stringify([...installedpkg], null, 2);
}


async function npmInstall(packageName) {
    if (installedpkg.has(packageName)) {
        console.log("Already installed: "+ packageName);
        return; // захист від рекурсії
    }

    installedpkg.add(packageName);

    try {
        const metaRes = await fetch(`https://unpkg.com/${packageName}/package.json`);
        const meta = await metaRes.json();

        const mainFile = meta.main || "index.js";
        const url = `https://unpkg.com/${packageName}/${mainFile}`
        let response, code;
        try{
         response = await fetch(url);
         code = await response.text();
        }catch{
        
        const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(url);
            response = await fetch(proxyUrl);
code = await response.text();
        }

        if (code.includes('export default') || code.includes('export {')) {
            code = `
                const exports = {};
                const module = { exports };
                (function() {
                    ${code.replace(/export default /g, 'module.exports = ')
                          .replace(/export \{/g, '/* export ignored */ {')}
                })();
                return module.exports;
            `;
        }

        const path = "system/node_modules/"+packageName+".js";
        const fl = new File([code], path, { type: "text/javascript" });
        fl.content = code;

        const existingIdx = fs.findIndex(f => f.name === path);
        if (existingIdx > -1) fs[existingIdx] = fl; else fs.push(fl);

        saveFileToDB(fl);

        console.log("Installed: "+ packageName);

        // Залежності
        if (meta.dependencies) {
            const depNames = Object.keys(meta.dependencies);
            for (const dep of depNames) {
                await npmInstall(dep); // рекурсія, але з перевіркою
            }
        }
    } catch (err) {
        console.error(err.message);
    }

    console.log("Completed: "+ packageName);
}

  async function purgeDir(dir) {
      if (dir.trim() == "") return console.log("Cannot purge root directory.");

      const folderPathWithSlash = dir.endsWith("/") ? dir : dir + "/";
      const folderPathWithoutSlash = dir.endsWith("/") ? dir.slice(0, -1) : dir;

      const rem = fs.filter(file => 
          file.name.startsWith(folderPathWithSlash) || file.name === folderPathWithoutSlash
      );
      
      console.log("To be removed: " + rem.length);

      for (const f of rem) {
          console.log("Deleting: " + f.name);

          await deleteFile(f.name);
          
          console.log("Deleted: " + f.name);
      }
      
      return true; 
  }

async function deleteFile(fileName) {
    if (!fileName) return false;

    const cleanFileName = fileName.trim();
    const initialLength = fs.length;
    fs = fs.filter(item => item.name !== cleanFileName);

    if (currentDisk.type == 'indexedDB'){
    currentDisk.busy = true;
    if (fs.length < initialLength) {
        try {
            // Видаляємо з фізичного сховища IndexedDB
            await idbWrapper.deleteFile(cleanFileName); 

            // Приводимо до нижнього регістру для надійності перевірки розширення
            const lowerName = cleanFileName.toLowerCase();
            apps = apps.filter(a=> a.path != fileName)
            if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
                
                // Викликаємо оновлення реєстру
                registerApps();
            }
            currentDisk.busy = false;
            return true;
        } catch (error) {
            console.error("Помилка видалення з IndexedDB:", error);
            currentDisk.busy = false;
            return false;
        }
    } 
    
  } else if (currentDisk.type == "localStorage"){
      const cleanFileName = fileName.trim();
    if (fs.length < initialLength) {
        localStorage.removeItem(cleanFileName);
    }
  }


    return false;
} 


function updateTime() {
    if (PowerManager.isAsleep) return;
    const timeElementsCollection = document.getElementsByClassName("clock-time");
    const dateElementsCollection = document.getElementsByClassName("clock-date");
    
    if (timeElementsCollection.length === 0 && dateElementsCollection.length === 0) {
        return;
    }

    const now = new Date();
    const currentTime = now.toLocaleTimeString(dateLang, { hour: '2-digit', minute: '2-digit', second: '2-digit'});

const formatterWeekday = new Intl.DateTimeFormat(dateLang, { weekday: "short" });
const formatterDay = new Intl.DateTimeFormat(dateLang, { day: "numeric" });
const formatterMonth = new Intl.DateTimeFormat(dateLang, { month: "long" });

const rawDate = new Intl.DateTimeFormat(dateLang, {
    weekday: "short",
    day: "numeric",
    month: "long"
}).format(now);

const currentDate = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
    
    Array.from(timeElementsCollection).forEach((t) => {
        t.textContent = currentTime;
        updateSystemPopover(t, currentDate, false, false)
    });

    Array.from(dateElementsCollection).forEach((d) => {
        d.textContent = currentDate;
    });
}




document.addEventListener("click", () =>{
document.querySelectorAll(".menu").forEach(function(item){
item.style.display="none";
})
if (event.target.id != "menubtn" && document.querySelector("#sysmenu") && event.target.className != "appmenu-category" ){
    
document.querySelector("#sysmenu").style.display = "none";}
})
document.querySelectorAll("li").forEach(listItem => {

    listItem.addEventListener("click", (e) => {

        document.querySelectorAll(".menu").forEach(function(menuItem) {
            menuItem.style.display = "none";
        });
    });
});

document.getElementById("desktop-fore").addEventListener("contextmenu", (e)=>{
e.preventDefault();

document.querySelectorAll(".menu").forEach(function(item){
item.style.display="none";
})

document.getElementById("deskM").querySelectorAll("li > p").forEach(function(item) {item.innerText = _(item.innerText);})
document.getElementById("deskM").style.display = "block";
document.getElementById("deskM").style.left = e.clientX+"px";
document.getElementById("deskM").style.top = e.clientY+"px";
});

document.getElementById("desktopApps").addEventListener("contextmenu", (e)=>{
e.preventDefault();

document.querySelectorAll(".menu").forEach(function(item){
item.style.display="none";
})

document.getElementById("deskM").querySelectorAll("li > p").forEach(function(item) {item.innerText = _(item.innerText);})
document.getElementById("deskM").style.display = "block";
document.getElementById("deskM").style.left = e.clientX+"px";
document.getElementById("deskM").style.top = e.clientY+"px";
});





function drawEditContextMenu(e, doc = document) {

  const l=parseInt(e.screenX)/parseFloat(window.devicePixelRatio.toFixed(1)); 
  const t=parseInt(e.screenY)/parseFloat(window.devicePixelRatio.toFixed(1));
    const editableTarget = e.target.closest('[contenteditable="true"]') || 
                           (['TEXTAREA', 'INPUT'].includes(e.target.tagName) ? e.target : null);

    const selectableTarget = window.getComputedStyle(e.target).userSelect !== 'none' ? e.target : null;


    if (editableTarget || selectableTarget) {
        e.preventDefault();

        document.querySelectorAll(".menu").forEach(item => item.style.display = "none");
        const menu = document.getElementById("textM");
        menu.style.display = "block";
        menu.style.left = l + "px";
        menu.style.top = t + "px";

        let commands = {};
        if (editableTarget) {
            commands = {
                't_undo': 'undo', 't_redo': 'redo', 't_cut': 'cut',
                't_copy': 'copy', 't_paste': 'paste', 't_del': 'delete', 't_all': 'selectAll'
            };
            document.getElementById("t_").style.display = "block";
        } else {
            commands = {
                't_copy': 'copy',
                't_all': 'selectAll'
            };
            document.getElementById("t_").style.display = "none";
        }

        menu.querySelectorAll('li').forEach(li => {
            const command = commands[li.id];

            li.style.display = command ? "block" : "none"; 
            li.onmousedown = null;
            li.onclick = null;

            if (command) {
                li.onmousedown = (event) => event.preventDefault(); 

li.onclick = async (event) => {
    event.stopPropagation();

    if (editableTarget && typeof editableTarget.focus === 'function') {
        editableTarget.focus();
    }
    
    try {
        if (command === 'paste') {
            // Використовуємо сучасний асинхронний Clipboard API
            const text = await navigator.clipboard.readText();
            
            // Перевіряємо, чи це INPUT/TEXTAREA, чи contenteditable
            if (editableTarget.tagName === 'INPUT' || editableTarget.tagName === 'TEXTAREA') {
                const start = editableTarget.selectionStart;
                const end = editableTarget.selectionEnd;
                const val = editableTarget.value;
                
                // Вставляємо текст у позицію курсора (замінюючи виділений текст, якщо він є)
                editableTarget.value = val.substring(0, start) + text + val.substring(end);
                
                // Повертаємо курсор на місце після вставленого тексту
                editableTarget.selectionStart = editableTarget.selectionEnd = start + text.length;
            } else {
                // Для contenteditable використовуємо стандартний фолбек або Range API
                // Але execCommand('insertText') зазвичай працює безпечно, на відміну від 'paste'
                doc.execCommand('insertText', false, text);
            }
        } else if (command === 'copy' || command === 'cut') {
            // Для копіювання/вирізання теж можна зробити надійний міграційний шлях
            let selectedText = "";
            if (editableTarget && (editableTarget.tagName === 'INPUT' || editableTarget.tagName === 'TEXTAREA')) {
                selectedText = editableTarget.value.substring(editableTarget.selectionStart, editableTarget.selectionEnd);
            } else {
                selectedText = doc.getSelection().toString();
            }

            if (selectedText) {
                await navigator.clipboard.writeText(selectedText);
                if (command === 'cut') {
                    doc.execCommand('delete', false, null); // Видаляємо вирізане
                }
            }
        } else {
            // Усі інші команди (undo, redo, selectAll) залишаємо через execCommand
            doc.execCommand(command, false, null);
        }
    } catch (err) {
        console.warn("Clipboard/ExecCommand operation failed:", err);
        // Резервний фолбек, якщо Clipboard API заблоковано політикою безпеки iframe
        try { doc.execCommand(command, false, null); } catch(e){}
    }

    menu.style.display = 'none';
};
            }
        });
    }
}


document.body.addEventListener('contextmenu', (e) => {
drawEditContextMenu(e);
    });





let lowBattWarned = false;
// Об'єкт із твоїми новими SVG-іконками (встав сюди свій реальний SVG-код)
const BATTERY_ICONS = {
    charging: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-battery-charging" viewBox="0 0 16 16">
  <path d="M9.585 2.568a.5.5 0 0 1 .226.58L8.677 6.832h1.99a.5.5 0 0 1 .364.843l-5.334 5.667a.5.5 0 0 1-.842-.49L5.99 9.167H4a.5.5 0 0 1-.364-.843l5.333-5.667a.5.5 0 0 1 .616-.09z"/>
  <path d="M2 4h4.332l-.94 1H2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2.38l-.308 1H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2"/>
  <path d="M2 6h2.45L2.908 7.639A1.5 1.5 0 0 0 3.313 10H2zm8.595-2-.308 1H12a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H9.276l-.942 1H12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
  <path d="M12 10h-1.783l1.542-1.639q.146-.156.241-.34zm0-3.354V6h-.646a1.5 1.5 0 0 1 .646.646M16 8a1.5 1.5 0 0 1-1.5 1.5v-3A1.5 1.5 0 0 1 16 8"/>
</svg>`,
    full:     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-battery-full" viewBox="0 0 16 16">
  <path d="M2 6h10v4H2z"/>
  <path d="M2 4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm10 1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4 3a1.5 1.5 0 0 1-1.5 1.5v-3A1.5 1.5 0 0 1 16 8"/>
</svg>`,
    half:     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-battery-half" viewBox="0 0 16 16">
  <path d="M2 6h5v4H2z"/>
  <path d="M2 4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm10 1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4 3a1.5 1.5 0 0 1-1.5 1.5v-3A1.5 1.5 0 0 1 16 8"/>
</svg>`,
    low:      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-battery-low" viewBox="0 0 16 16">
  <path d="M2 6h2v4H2z"/>
  <path d="M2 4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm10 1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4 3a1.5 1.5 0 0 1-1.5 1.5v-3A1.5 1.5 0 0 1 16 8"/>
</svg>`,
    empty:    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-battery" viewBox="0 0 16 16">
  <path d="M0 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm14 3a1.5 1.5 0 0 1-1.5 1.5v-3A1.5 1.5 0 0 1 16 8"/>
</svg>`
};

async function updateBattery() {

    if (PowerManager.isAsleep) return;
    
    try {
        const battery = await navigator.getBattery();
        const batContainer = document.getElementById("batt");
                  const probablyNoBattery =
  battery.charging &&
  battery.level === 1 &&
  battery.chargingTime === 0 &&
  battery.dischargingTime === Infinity &&
  devProps.deviceIcon == 'assets/pc.svg'
if (probablyNoBattery) {
  batContainer.remove();
  return;
}

        const updateInfo = () => {

if (probablyNoBattery) return;


            const level = Math.round(battery.level * 100);
            
            if (batContainer) {
                let currentSvg = "";
                let strokeColor = "unset"; 

                if (battery.charging) {
                    currentSvg = BATTERY_ICONS.charging;
                    lowBattWarned = false;
                    if (level == 100) strokeColor = 'lightgreen';
                } else {
                    if (level <= 10) {
                        currentSvg = BATTERY_ICONS.empty;
                        strokeColor = 'red';
                        if (!lowBattWarned) {
                            new Notification(_("low_batt"), { body: _("low_batt_body") });
                        }
                        lowBattWarned = true;
                    } else if (level <= 25) {
                        currentSvg = BATTERY_ICONS.low;
                        if (!lowBattWarned) {
                            new Notification(_("low_batt"), { body: _("low_batt_body") });
                        }
                        lowBattWarned = true;
                        strokeColor = 'red';
                    } else if (level <= 75) {
                        currentSvg = BATTERY_ICONS.half;
                        lowBattWarned = false;
                    } else {
                        currentSvg = BATTERY_ICONS.full;
                        lowBattWarned = false;
                    }
                }

                batContainer.innerHTML = currentSvg;

                const svgElement = batContainer.querySelector('svg');
                if (svgElement) {
                    svgElement.style.color = strokeColor;
                }

                // Swapped native title for Popover API
                updateSystemPopover(batContainer, `${level}%`, false, false);
            }
        };

        updateInfo();

        battery.onchargingchange = updateInfo;
        battery.onlevelchange = updateInfo;

    } catch (error) {
        console.error("Battery API не підтримується або заблоковано:", error);
    }
}



const NETWORK_ICONS = {
    ethernet:  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-ethernet" viewBox="0 0 16 16">
  <path d="M14 13.5v-7a.5.5 0 0 0-.5-.5H12V4.5a.5.5 0 0 0-.5-.5h-1v-.5A.5.5 0 0 0 10 3H6a.5.5 0 0 0-.5.5V4h-1a.5.5 0 0 0-.5.5V6H2.5a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5M3.75 11h.5a.25.25 0 0 1 .25.25v1.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-1.5a.25.25 0 0 1 .25-.25m2 0h.5a.25.25 0 0 1 .25.25v1.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-1.5a.25.25 0 0 1 .25-.25m1.75.25a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v1.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25zM9.75 11h.5a.25.25 0 0 1 .25.25v1.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-1.5a.25.25 0 0 1 .25-.25m1.75.25a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v1.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25z"/>
  <path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zM1 2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z"/>
</svg>`,
    wifiFull:  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-wifi" viewBox="0 0 16 16">
  <path d="M15.384 6.115a.485.485 0 0 0-.047-.736A12.44 12.44 0 0 0 8 3C5.259 3 2.723 3.882.663 5.379a.485.485 0 0 0-.048.736.52.52 0 0 0 .668.05A11.45 11.45 0 0 1 8 4c2.507 0 4.827.802 6.716 2.164.205.148.49.13.668-.049"/>
  <path d="M13.229 8.271a.482.482 0 0 0-.063-.745A9.46 9.46 0 0 0 8 6c-1.905 0-3.68.56-5.166 1.526a.48.48 0 0 0-.063.745.525.525 0 0 0 .652.065A8.46 8.46 0 0 1 8 7a8.46 8.46 0 0 1 4.576 1.336c.206.132.48.108.653-.065m-2.183 2.183c.226-.226.185-.605-.1-.75A6.5 6.5 0 0 0 8 9c-1.06 0-2.062.254-2.946.704-.285.145-.326.524-.1.75l.015.015c.16.16.407.19.611.09A5.5 5.5 0 0 1 8 10c.868 0 1.69.201 2.42.56.203.1.45.07.61-.091zM9.06 12.44c.196-.196.198-.52-.04-.66A2 2 0 0 0 8 11.5a2 2 0 0 0-1.02.28c-.238.14-.236.464-.04.66l.706.706a.5.5 0 0 0 .707 0l.707-.707z"/>
</svg>`, // SVG для wifi (повний сигнал)
    wifi2:     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-wifi-2" viewBox="0 0 16 16">
  <path d="M13.229 8.271c.216-.216.194-.578-.063-.745A9.46 9.46 0 0 0 8 6c-1.905 0-3.68.56-5.166 1.526a.48.48 0 0 0-.063.745.525.525 0 0 0 .652.065A8.46 8.46 0 0 1 8 7a8.46 8.46 0 0 1 4.577 1.336c.205.132.48.108.652-.065m-2.183 2.183c.226-.226.185-.605-.1-.75A6.5 6.5 0 0 0 8 9c-1.06 0-2.062.254-2.946.704-.285.145-.326.524-.1.75l.015.015c.16.16.408.19.611.09A5.5 5.5 0 0 1 8 10c.868 0 1.69.201 2.42.56.203.1.45.07.611-.091zM9.06 12.44c.196-.196.198-.52-.04-.66A2 2 0 0 0 8 11.5a2 2 0 0 0-1.02.28c-.238.14-.236.464-.04.66l.706.706a.5.5 0 0 0 .708 0l.707-.707z"/>
</svg>`, // SVG для wifi-2
    wifi1:     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-wifi-1" viewBox="0 0 16 16">
  <path d="M11.046 10.454c.226-.226.185-.605-.1-.75A6.5 6.5 0 0 0 8 9c-1.06 0-2.062.254-2.946.704-.285.145-.326.524-.1.75l.015.015c.16.16.407.19.611.09A5.5 5.5 0 0 1 8 10c.868 0 1.69.201 2.42.56.203.1.45.07.611-.091zM9.06 12.44c.196-.196.198-.52-.04-.66A2 2 0 0 0 8 11.5a2 2 0 0 0-1.02.28c-.238.14-.236.464-.04.66l.706.706a.5.5 0 0 0 .707 0l.708-.707z"/>
</svg>`, // SVG для wifi-1
    wifiOff:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-wifi-off" viewBox="0 0 16 16">
  <path d="M10.706 3.294A12.6 12.6 0 0 0 8 3C5.259 3 2.723 3.882.663 5.379a.485.485 0 0 0-.048.736.52.52 0 0 0 .668.05A11.45 11.45 0 0 1 8 4q.946 0 1.852.148zM8 6c-1.905 0-3.68.56-5.166 1.526a.48.48 0 0 0-.063.745.525.525 0 0 0 .652.065 8.45 8.45 0 0 1 3.51-1.27zm2.596 1.404.785-.785q.947.362 1.785.907a.482.482 0 0 1 .063.745.525.525 0 0 1-.652.065 8.5 8.5 0 0 0-1.98-.932zM8 10l.933-.933a6.5 6.5 0 0 1 2.013.637c.285.145.326.524.1.75l-.015.015a.53.53 0 0 1-.611.09A5.5 5.5 0 0 0 8 10m4.905-4.905.747-.747q.886.451 1.685 1.03a.485.485 0 0 1 .047.737.52.52 0 0 1-.668.05 11.5 11.5 0 0 0-1.811-1.07M9.02 11.78c.238.14.236.464.04.66l-.707.706a.5.5 0 0 1-.707 0l-.707-.707c-.195-.195-.197-.518.04-.66A2 2 0 0 1 8 11.5c.374 0 .723.102 1.021.28zm4.355-9.905a.53.53 0 0 1 .75.75l-10.75 10.75a.53.53 0 0 1-.75-.75z"/>
</svg>`  // SVG для wifi-off / немає мережі
};


async function updateNetwork() {
    if (PowerManager.isAsleep) return;

    const netContainer = document.getElementById("netw");
    if (!netContainer) return;

    const updateInfo = () => {
        const isOnline = navigator.onLine;
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        let currentSvg = NETWORK_ICONS.wifiOff;
        let tooltipText = "Offline";
        let strokeColor = "unset";

        if (isOnline) {
            tooltipText = "Online";
            const type = connection ? connection.type : 'wifi';

            if (type === 'ethernet') {
                currentSvg = NETWORK_ICONS.ethernet;
                tooltipText = "Ethernet Connection";
            } else {
                const effectiveType = connection ? connection.effectiveType : '4g';
                tooltipText = `Wi-Fi (~${connection?.downlink || '?'} Mb/s)`;
                if (effectiveType === '4g') {
                    currentSvg = NETWORK_ICONS.wifiFull;
                } else if (effectiveType === '3g') {
                    currentSvg = NETWORK_ICONS.wifi2;
                } else {
                    currentSvg = NETWORK_ICONS.wifi1;
                }
            }
        } else {
            currentSvg = NETWORK_ICONS.wifiOff;
            strokeColor = "red";
        }

        netContainer.innerHTML = currentSvg;

        const svgElement = netContainer.querySelector('svg');
        if (svgElement) {
            svgElement.style.color = strokeColor;
        }

        // Swapped native title for Popover API
        updateSystemPopover(netContainer, tooltipText, false, false);
    };

    updateInfo();

    window.addEventListener('online', updateInfo);
    window.addEventListener('offline', updateInfo);

    if (navigator.connection) {
        navigator.connection.onchange = updateInfo;
    }
}
updateNetwork();






setInterval(async () => {
    const vol1 = getMasterVolume() * 100;
    const volContainer = document.getElementById("vol");
    if (volContainer) {
        updateSystemPopover(volContainer, Math.round(vol1) + "%", false, false);
        if (vol1 == 0) volContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-volume-down" viewBox="0 0 16 16">
  <path d="M9 4a.5.5 0 0 0-.812-.39L5.825 5.5H3.5A.5.5 0 0 0 3 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 9 12zM6.312 6.39 8 5.04v5.92L6.312 9.61A.5.5 0 0 0 6 9.5H4v-3h2a.5.5 0 0 0 .312-.11M12.025 8a4.5 4.5 0 0 1-1.318 3.182L10 10.475A3.5 3.5 0 0 0 11.025 8 3.5 3.5 0 0 0 10 5.525l.707-.707A4.5 4.5 0 0 1 12.025 8"/>
</svg>`;
        else if (vol1 > 50) volContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-volume-up" viewBox="0 0 16 16">
  <path d="M11.536 14.01A8.47 8.47 0 0 0 14.026 8a8.47 8.47 0 0 0-2.49-6.01l-.708.707A7.48 7.48 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303z"/>
  <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.48 5.48 0 0 1 11.025 8a5.48 5.48 0 0 1-1.61 3.89z"/>
  <path d="M10.025 8a4.5 4.5 0 0 1-1.318 3.182L8 10.475A3.5 3.5 0 0 0 9.025 8c0-.966-.392-1.841-1.025-2.475l.707-.707A4.5 4.5 0 0 1 10.025 8M7 4a.5.5 0 0 0-.812-.39L3.825 5.5H1.5A.5.5 0 0 0 1 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 7 12zM4.312 6.39 6 5.04v5.92L4.312 9.61A.5.5 0 0 0 4 9.5H2v-3h2a.5.5 0 0 0 .312-.11"/>
</svg>`;
        else volContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-volume-mute" viewBox="0 0 16 16">
  <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06M6 5.04 4.312 6.39A.5.5 0 0 1 4 6.5H2v3h2a.5.5 0 0 1 .312.11L6 10.96zm7.854.606a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0"/>
</svg>`; // Оптимізовано checks
    }

    
}, 500);


let hotCornerClose = false;
window.addEventListener('click', function(e) {
    if (!enableHotCorners) return;
    
    let win; 
    if (document.querySelectorAll('.winbox.max').length > 1) win = document.querySelector('.winbox.max.focus');
    else win = document.querySelector('.winbox.max');
    if (!win) return;

    const dpr = parseFloat(window.devicePixelRatio.toFixed(1)) || 1;
    const scaledX = parseInt(e.screenX) / dpr;
    const scaledY = parseInt(e.screenY) / dpr;
    const scaledWidth = screen.width / dpr;

    // Check if the actual click happened in the hot corner
    const isTopEdge = scaledY <= 15;
    const isRightEdge = scaledX >= (scaledWidth - 15);

    if (isTopEdge && isRightEdge) {
        const closeBtn = win.querySelector('.wb-close');
        if (closeBtn) closeBtn.click();
    }
});

window.addEventListener('mousemove', function(e) {
  if (!enableHotCorners) return;
    const win = document.querySelector('.winbox.max');
    if (!win) return; // Only run if a window is maximized
    const closeBtn = win.querySelector('.wb-close');
    const dpr = parseFloat(window.devicePixelRatio.toFixed(1)) || 1;
    
    // Normalize coordinates against the system accessibility scaling layer
    const scaledX = parseInt(e.screenX) / dpr;
    const scaledY = parseInt(e.screenY) / dpr;
    const scaledWidth = screen.width /dpr; // Or innerWidth depending on your context

    // Define a hot-corner box (e.g., within 15px of the top-right corner)
    const isTopEdge = scaledY <= 15;
    const isRightEdge = scaledX >= (scaledWidth - 15);


    if (isTopEdge && isRightEdge) {
            hotCornerClose = true;
            if (!closeBtn.classList.contains('hover')) closeBtn.classList.add('hover');
        
    }else{
      hotCornerClose = false;
      if (closeBtn.classList.contains('hover')) closeBtn.classList.remove('hover');
    }
});

window.addEventListener('keydown', async function(event) {
    let volDN = "AudioVolumeDown";
    let volUP = "AudioVolumeUp";

    // Адаптація під Mac-розкладку мультимедійних клавіш (F10/F11 як гучність)
    if (typeof currentKeyboardLayout !== 'undefined' && currentKeyboardLayout === "mac") {
        volDN = 'F11';
        volUP = 'F10';
    }

    // 1. Керування системною гучністю
    if (event.key === volUP || event.key === volDN) {
        event.preventDefault();
        event.stopPropagation();
        
        let volPercent = Math.round((typeof getMasterVolume === 'function' ? getMasterVolume() : (window.vol || 0)) * 100); 

        if (event.key === volUP) {
            volPercent = Math.min(volPercent + 5, 100);
        } else if (event.key === volDN) {
            volPercent = Math.max(volPercent - 5, 0);
        }

        const targetVol = volPercent / 100;
        if (typeof setMasterVolume === 'function') {
            setMasterVolume(targetVol); 
        } else {
            window.vol = targetVol; // надійний глобальний fallback
        }
        
        // Тут можна викликати кастомний графічний OSD-індикатор гучності Infinity OS!
        return;
    }

    // 2. Блокування системної довідки F1 та небезпечного закриття вікон через Ctrl+W / Cmd+W
    if (event.key === 'F1' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w')) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 3. Супер-клавіша (Meta / Win / Cmd) для відкриття Головного Меню
    if (event.key === 'Meta' || event.key === 'OS') {
        event.preventDefault();
        event.stopPropagation();
        
            openMenu();
        
        return;
    }

    // 4. Класичне закриття активного вікна wm (WinBox) через Alt+F4
    if (event.altKey && event.key.toUpperCase() === 'F4') {
        event.preventDefault();
        event.stopPropagation();
        const activeWindow = document.querySelector('.winbox.focus');
        if (activeWindow && activeWindow.winbox) {
            activeWindow.winbox.close();
        }
        return;
    }
if (event.ctrlKey && event.altKey && event.code === "KeyT"){
          event.preventDefault();
        event.stopPropagation();
        openApp('terminal');
        return
}
    // 5. Глобальний чорний список комбінацій (Блокування збереження, друку, пошуку браузера)
    if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        const blacklisted = ['s', 'p', 'f']; 

        if (blacklisted.includes(key)) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
}, { capture: true }); // Використовуємо фазу перехоплення (capture), щоб ядро реагувало ПЕРШИМ

// Uncomment when terminal can't be accessed.
/*
indexedDB.deleteDatabase(DB_NAME);
localStorage.clear();
*/