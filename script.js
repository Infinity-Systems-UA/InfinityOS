setInterval(updateTime, 500);
  const notify = document.getElementById('notify');
let currentStrings = {};
let currentLang = 'en';
let dateLang = "en-US";
let currentKeyboardLayout = "mac";
let displayType = "oled";
let notificationAPI;
let apps = [];
let icons = [];
window.wasm = {};
let desktopIcons = JSON.parse(localStorage.getItem('desktopIcons')) || [];
let BOOT = true;
let BOOT_INTERR  = false;
let INTERR_KEY = 'F9';
let lastWheelTime = 0;
let recentEvents = [];

function setDrawMode(m='cpu') {
  if (m == 'gpu'){
document.getElementById('body').classList.add('GPU_DRAW');

  }else if (m == 'cpu')
document.getElementById('body').classList.remove('GPU_DRAW');
}

function classifyWheel(e) {
  const now = performance.now();
  const dt = now - lastWheelTime;
  lastWheelTime = now;
  recentEvents.push(dt);
  if (recentEvents.length > 5) recentEvents.shift();
  const avgInterval = Math.round(recentEvents.reduce((a, b) => a + b, 0) / recentEvents.length);
  const dpr = window.devicePixelRatio || 1;
  const mouseThreshold = 236.25 / dpr - 3;
  let diff = Math.round(Math.abs(Math.round(e.deltaY * -3) - Math.round(e.wheelDeltaY)));
  const ratioLooksLikeMouse = e.wheelDeltaY ? (diff > mouseThreshold * (100 / 160)) : false; // scale your old 100 constant proportionally
  const firingFastAndSmooth = avgInterval < 50;
  if (diff >= mouseThreshold) return 'mouse';
  if (!ratioLooksLikeMouse || firingFastAndSmooth || (diff < mouseThreshold && avgInterval < mouseThreshold )) return 'trackpad';
  return 'unknown';
}

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
  let gestureThreshold = parseInt(localStorage.getItem('touchpadThreshold')) || 150;
  let localeFormat = JSON.parse(localStorage.getItem("localeFormat")) || { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
let permissions;

try {
  permissions = JSON.parse(localStorage.getItem("permissions")) || {};
} catch {
  permissions = {};
}
  let allowScreenTime = JSON.parse(localStorage.getItem("allowScreenTime") )|| false;
  let bgClock = JSON.parse(localStorage.getItem('backgroundClock')) ?? false;
  let hideWinContentOnTransform = JSON.parse(localStorage.getItem("hideWinContentOnTransform") )|| false;
  let styles;
  let wbtheme; // Class name
  const devices = [];
  window.systemWorkers = []; 
  window.systemObservers = [];
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



function updateFirstMinimized() {
  const minWindows = Array.from(document.querySelectorAll('.winbox.min'));
  if (!minWindows.length) return;

  // Clear previous active state
  minWindows.forEach(el => el.classList.remove('first-min'));

  // Find the one closest to the left edge of the screen
  const leftmost = minWindows.reduce((prev, curr) => {
    return (curr.offsetLeft < prev.offsetLeft) ? curr : prev;
  });
  leftmost.classList.add('first-min');
}

let updateScheduled = false;

  function applySystemConfig(winID) {
    if (!winID) return;
    
    // Перевірка: якщо це системне вікно файлового менеджера, скрипти не інжектуємо
    const shouldInjectScript = !winID.startsWith("fileWinBox-frame");

    const windowContainer = document.getElementById(winID);
    
    if (!windowContainer) return console.warn(`App window with ID ${winID} not found.`);
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

      if (document.body.contains(el)) el.classList.add("use-app-font");
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
  function winResize(id,x,y){
    const winboxElement = document.getElementById(id);
          const winboxInstance = winboxElement ? (winboxElement.winbox || winboxElement._winbox) : null;
          if (!winboxInstance) return;
          winboxInstance.width = x;
        winboxInstance.height = y;
        winboxInstance.resize().move("center", "center");

        winboxElement.classList.add('no-resize');
        winboxElement.classList.add('no-max');
  }

function kill(id, type = "winbox") {
    if (type === "winbox") {
        const winboxElement = document.getElementById(id);
        const winboxInstance = winboxElement
            ? (winboxElement.winbox || winboxElement._winbox)
            : null;

        if (winboxInstance) {
            winboxInstance.close(1);
        } else {
            console.error(`Winbox "${id}" not found.`);
        }
    }

    else if (type === "worker") {
        const workerEntry = window.systemWorkers.find(w => w.id === id);

        if (workerEntry?.instance) {
            workerEntry.instance.terminate();
            console.log(`Worker ${id} killed.`);
        } else {
            console.error(`Worker "${id}" not found.`);
        }
    }

    else if (type === "observer") {
        const observerEntry = window.systemObservers.find(o => o.id === id);

        if (observerEntry?.instance) {
            observerEntry.instance.disconnect();
            console.log(`${observerEntry.type} ${id} disconnected.`);
        } else {
            console.error(`Observer "${id}" not found.`);
        }
    }

    else {
        console.error(`Unknown kill type: ${type}`);
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

let ableToUseUSB = true;
  async function buildDevProps() {

    const baseArch = navigator.platform.includes("64") || navigator.userAgent.includes("x86_64") || navigator.userAgent.includes("Win64") ? "x64" : "x86";
    const defaultChipStr = `${baseArch} (${navigator.hardwareConcurrency || 0} Cores)`;


let deviceIcon = "assets/pc.svg";
  if (navigator.maxTouchPoints > 0 || matchMedia("(any-pointer: coarse)").matches && !detectMobile()){
    deviceIcon = "assets/laptop.svg";
  } else if ( detectMobile() ){
    deviceIcon = "assets/mobile.svg"
  }else{
    deviceIcon = "assets/pc.svg";
  }

    const devProps = {
      model: '',
      inchRes: (getScreenDiagonalInches()-0.3).toFixed(1) + "-inch",
      chip: defaultChipStr, // Clean placeholder format
      memory: navigator.deviceMemory ? navigator.deviceMemory + " GB" : '',
      os: {
        name: "Infinity OS",
        version: "02082026" 
      },
      deviceIcon: deviceIcon
    };


// Screen
const scr = { type: "screen" };

for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(screen))) {
    try {
        const value = screen[key];

        if (typeof value !== "string" && typeof value !== "number") continue;

        scr[key] = value;
    } catch {}
}
devices.push(scr);

// mediaDevices
const mediaDevices = await navigator.mediaDevices.enumerateDevices();
for (const d of mediaDevices) {
    devices.push({
        type: d.kind.replace("input", 'Input').replace("output", 'Output'),           // audioinput, audiooutput, videoinput
        name: d.label || "Unknown",
        id: d.deviceId,
        group: d.groupId
    });
}

// HID
if (navigator.hid?.getDevices) {
    const hidDevices = await navigator.hid.getDevices();

    for (const device of hidDevices) {
        const obj = { type: "HID" };

        for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(device))) {
            try {
                const value = device[key];

                if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                    obj[key] = value;
                }
            } catch {}
        }

        devices.push(obj);
    }
}

// USB
if (navigator.usb?.getDevices) {
    const usbDevices = await navigator.usb.getDevices();

    for (const device of usbDevices) {
        const obj = { type: "USB" };

        for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(device))) {
            try {
                const value = device[key];

                if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                    obj[key] = value;
                }
            } catch {}
        }

        devices.push(obj);
    }
}

// Drives
let previousDrives = [];

async function checkUsbStatus() {
    if (ableToUseUSB)
  try {
    const res = await fetch('/api/drives');
    const data = await res.json();
    const currentDrives = data.drives || [];

    // 1. Шукаємо нові підключені диски
    for (const drive of currentDrives) {
      const exists = previousDrives.some(p => p.name === drive.name);
      if (!exists) {
        onUsbPluggedIn(drive);
        window.dispatchEvent(new CustomEvent("update", {
  detail: {
    type: "devices",
    timestamp: Date.now()
  }
}));
      }
    }

    // 2. Шукаємо відключені диски
    for (const prevDrive of previousDrives) {
      const exists = currentDrives.some(c => c.name === prevDrive.name);
      if (!exists) {
        onUsbPluggedOut(prevDrive);
        window.dispatchEvent(new CustomEvent("update", {
  detail: {
    type: "devices",
    timestamp: Date.now()
  }
}));
      }
    }
    // Send


    previousDrives = currentDrives;

  } catch {
    ableToUseUSB = false;
  }
}

// Події-хендлери
function onUsbPluggedIn(drive) {
  const driveTitle = `${drive.vendor || ""} ${drive.model || ""}`.trim() || drive.name || "USB Drive";
  new Notification(_("device_connected"), {
    body: driveTitle,
    silent: true
  });
}

function onUsbPluggedOut(drive) {
  const driveTitle = `${drive.vendor || ""} ${drive.model || ""}`.trim() || drive.name || "USB Drive";
  
  new Notification(_("device_disconnected"), {
    body: driveTitle,
    silent: true
  });

  // Перевіряємо за системним іменем накопичувача (наприклад 'sdb' або 'sdb1')
  if (currentDisk && (currentDisk.part_name === drive.part_name || currentDisk.name === drive.name)) {
    unmountDrive(driveTitle);
  }
}
// Запускаємо перевірку кожні 2 секунди
setInterval(checkUsbStatus, 2000);

    if (navigator.userAgentData) {
      try {
        const ua = await navigator.userAgentData.getHighEntropyValues([
          "model",
          "platform",
          "platformVersion",
          "architecture",
          "bitness"
        ]);

        if (ua.model != '') {
          devProps.model = ua.model || _("unknown");
        }else{
          try {
    const res = await fetch("/api/system_info");
    const data = await res.json();
    if (data.success && data.model) {
      devProps.model = data.model;
    }
  } catch (e) {
    console.warn("Failed to fetch system model:", e);
  }
        }


        const arch = ua.architecture ? ua.architecture : "x86";
        const bitness = ua.bitness ? `${ua.bitness}-bit` : "";
        const cores = navigator.hardwareConcurrency ? `(${navigator.hardwareConcurrency} Cores)` : "";
        
        devProps.chip = `${arch} ${bitness} ${cores}`.replace(/\s+/g, ' ').trim() || defaultChipStr;

      } catch (e) {
        console.warn("UA entropy blocked:", e);
      }
    }

    devProps.cores = navigator.hardwareConcurrency || '';

    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

devProps.gpu = renderer
  .match(/^ANGLE\s*\([^,]+,\s*([^,]+),/)?.[1]?.trim().replace('(R)','') || "";

    } catch {
      devProps.gpu = '';
    }

    return devProps;
  }
  let devProps;
  let maxLS;

  window.icns = {
      // Group 1: System applications (medium icons on desktop, small in the menu)
      files: "icons/files.svg",
      clock: "icons/clock.svg",
      calc: "icons/calc.svg",
      settings: "icons/settings.svg",
      term: "icons/terminal.svg",
      web: "icons/web.svg",
      tasks: "icons/tasks.svg",
      store: "icons/store.svg",
      run: "icons/run.svg",
      // Group 2: File types icons (big icons in 'Get Info', small in Files app, medium on desktop)
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
      binary: "icons/application-binary.svg",
      folder: "icons/folder.svg",
      // Group 3: Dialogs icons (medium in dialogs windows, small in title bars)
      dialogInfo: 'icons/dialog-info.svg',
      dialogQues: 'icons/dialog-ques.svg',
      dialogErr: 'icons/dialog-err.svg',
      dialogWarn: 'icons/dialog-warn.svg',
      // Group 4: Drive icons (medium in Files app sidebar, big in 'Get Info')
      lsDrive: 'icons/drive-ls.svg',
      dbDrive: 'icons/drive-idb.svg',
      usbDrive: 'icons/drive-usb.svg',
  };
  let vol = 1;

  window.sounds = {
    error: new Audio("sounds/error.ogg"),
    startup: new Audio("sounds/login.ogg"),
    info: new Audio(""),
    question: new Audio(""),
    warn: new Audio(""),
    deviceIn: new Audio("sounds/in.ogg"),
    deviceOut: new Audio("sounds/out.ogg"),
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
          document.getElementById("gamepad").style.display = "block";
  sounds.play("deviceIn")
      } else {

          const index = devices.findIndex(d => d.index === gamepad.index);
          if (index !== -1) {
              sounds.play("deviceOut")
              devices.splice(index, 1);
                  document.getElementById("gamepad").style.display = "none";
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

      colorToCSS(winColor) {
          if (!winColor) return null;
          const parts = winColor.trim().split(/\s+/);
          if (parts.length === 3) {
              return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
          }
          return winColor;
      }

      parse(fileContent, nm) {

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
      let tp;
      let stl;
if (nm.endsWith('.theme')){
tp = data['[visualstyles]'] && data['[visualstyles]']['ColorizationColor'] ? "win_aero" : "win_cla";
stl = this.mapMSWINVariables(data);
}else if (nm.endsWith('.colors')){
tp = 'kde'
stl = this.mapKDEVariables(data);
}
      return {
          styles: stl,
          name: this.getName(data) || nm.replaceAll(' ', '_').replace(/\.[^.]*$/, ""),
  		type: tp
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
  mapMSWINVariables(data) {
      const cpColors = data['[control panel\\colors]'] || {};
      const vs = data['[visualstyles]'] || {};

      const activeTitle = this.colorToCSS(cpColors['ActiveTitle']) || '#0054e3';
      const gradActiveTitle = this.colorToCSS(cpColors['GradientActiveTitle']) || activeTitle;
      const inactiveTitle = this.colorToCSS(cpColors['InactiveTitle']) || '#76a1e8';
      const gradInactiveTitle = this.colorToCSS(cpColors['GradientInactiveTitle']) || inactiveTitle;

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


  const sm = md - 5;
  const lg = md + 10;
  const pill = md + 40;
  const full = md + 90;

  const infoWindow = this.colorToCSS(cpColors['InfoWindow']);
  const infoText = this.colorToCSS(cpColors['InfoText']);

      const windowBg = this.colorToCSS(cpColors['Window']) || '#ffffff';
      const windowText = this.colorToCSS(cpColors['WindowText']) || '#000';

      const highlight = this.colorToCSS(cpColors['Hilight']) || '#326ba8';
      const highlightText = this.colorToCSS(cpColors['HilightText']) || '#326ba8';
      const buttonFace = this.colorToCSS(cpColors['ButtonFace']) || '#f0f0f0';


      document.body.style.backgroundColor = this.colorToCSS(cpColors['Background']) || '#000';



      const colors =  {

          '--color-win-act': winActive,
          '--color-win-ina': winInactive,

          '--accent-color': colorization ? this.parseColorization(colorization) : this.colorToCSS(cpColors['activeTitle']),
          '--color-selection': highlight,
          '--color-selection-text': highlightText,
          '--bg-color': windowBg,
          '--bg-panel': colorization ? this.parseColorization(colorization) : buttonFace,
          '--bg-body': windowBg,
          '--bg-menu': colorization ? this.parseColorization(colorization) : windowBg,

          '--toolbar-bg': buttonFace,
  '--button-bg': buttonFace,
      '--button-text': this.colorToCSS(cpColors['ButtonText']) || '#000',
      '--button-light': this.colorToCSS(cpColors['ButtonLight']) || '#c0c0c0',
      '--button-hilight': this.colorToCSS(cpColors['ButtonHilight']) || '#fff',
      '--button-shadow': this.colorToCSS(cpColors['ButtonShadow']) || '#808080',
      '--button-dk-shadow': this.colorToCSS(cpColors['ButtonDkShadow']) || '#000',

      '--button-act-bg': this.colorToCSS(cpColors['ButtonLight']) || '#c0c0c0',
      '--button-border': this.colorToCSS(cpColors['ButtonShadow']) || '#808080',
      '--button-act-border': this.colorToCSS(cpColors['ButtonDkShadow']) || '#000',

          '--color-text-primary': windowText,

          '--input-bg': windowBg,
          '--color-input-bg': windowBg,

          '--blur': colorization ? 'blur(10px)' : 'none',
    '--radius-sm': sm + 'px',
    '--radius-md': md + 'px',
    '--radius-lg': lg + 'px',
    '--radius-pill': pill + 'px',
    '--radius-full': full + 'px',

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
mapKDEVariables(data) {
    const general = data["[general]"] || {};
    const header = data["[colors:header]"] || {};
    const window = data["[colors:window]"] || {};
    const button = data["[colors:button]"] || {};
    const selection = data["[colors:selection]"] || {};
    const view = data["[colors:view]"] || {};
    const tooltip = data["[colors:tooltip]"] || {};
    const wm = data["[wm]"] || {};

    const activeTitle =
        this.colorToCSS(header.BackgroundNormal) ||
        this.colorToCSS(wm.activeBackground || wm.activebackground) ||
        "#31363b";

    const inactiveTitle =
        this.colorToCSS(header.BackgroundInactive) ||
        this.colorToCSS(wm.inactiveBackground || wm.inactivebackground) ||
        "#2a2e32";

    const windowBg =
        this.colorToCSS(window.BackgroundNormal) ||
        "#eff0f1";

    const windowText =
        this.colorToCSS(window.ForegroundNormal) ||
        "#31363b";

    const viewBg =
        this.colorToCSS(view.BackgroundNormal) ||
        windowBg;

    const viewText =
        this.colorToCSS(view.ForegroundNormal) ||
        windowText;

    const highlight =
        this.colorToCSS(selection.BackgroundNormal) ||
        "#3daee9";

    const highlightText =
        this.colorToCSS(selection.ForegroundNormal) ||
        "#ffffff";

    const buttonFace =
        this.colorToCSS(button.BackgroundNormal) ||
        "#e3e5e7";

    const buttonText =
        this.colorToCSS(button.ForegroundNormal) ||
        "#31363b";

    const buttonHover =
        this.colorToCSS(button.DecorationHover) ||
        highlight;

    const buttonFocus =
        this.colorToCSS(button.DecorationFocus) ||
        buttonHover;

    const md = 6;
    const sm = 4;
    const lg = 12;
    const pill = 26;
    const full = 56;

    document.body.style.backgroundColor = windowBg;

    const colors = {
        "--color-win-act": activeTitle,
        "--color-win-ina": inactiveTitle,

        "--accent-color": highlight,
        "--color-selection": highlight,
        "--color-selection-text": highlightText,

        "--bg-color": windowBg,
        "--bg-panel": buttonFace,
        "--bg-body": windowBg,
        "--bg-menu": viewBg,

        "--toolbar-bg": buttonFace,

        "--button-bg": buttonFace,
        "--button-text": buttonText,
        "--button-light": buttonHover,
        "--button-focus": buttonFocus,
        "--button-hilight": highlight,
        "--button-shadow": "rgba(0,0,0,.15)",
        "--button-dk-shadow": "rgba(0,0,0,.3)",

        "--button-act-bg": buttonHover,
        "--button-border": "rgba(0,0,0,.2)",
        "--button-act-border": highlight,

        "--color-text-primary": windowText,

        "--input-bg": viewBg,
        "--color-input-bg": viewBg,

        "--blur": "none",

        "--radius-sm": sm + "px",
        "--radius-md": md + "px",
        "--radius-lg": lg + "px",
        "--radius-pill": pill + "px",
        "--radius-full": full + "px",

        "--color-win-btn-close": "rgba(218,68,83,.8)",
    };

    const infoBg = this.colorToCSS(tooltip.BackgroundNormal);
    const infoText = this.colorToCSS(tooltip.ForegroundNormal);

    if (infoBg) colors["--info-bg"] = infoBg;
    if (infoText) colors["--info-text"] = infoText;

    const raw =
        window.BackgroundNormal ||
        "239 240 241";

    const rgb = raw.trim().split(/\s+/).map(Number);

    if (rgb.length === 3 && rgb.every(Number.isFinite)) {
        const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
        const dark = lum < 128;

        colors["--color-text-secondary"] = dark
            ? "rgba(255,255,255,.7)"
            : "rgba(0,0,0,.7)";

        colors["--color-text-tretiary"] = dark
            ? "rgba(255,255,255,.5)"
            : "rgba(0,0,0,.5)";
    }

    return colors;
}

  getName(data) {
  const thm = data["[Theme]"]
  const gen = data['[general]']
      if (thm && thm['DisplayName']) return thm['DisplayName'];
      if (gen && gen['Name']) return gen['Name'];
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
          const result = parser.parse(text, theme); 

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
          if (theme == "dark"){
              wbtheme = "glass-theme dark";
          }else{
          wbtheme = "glass-theme";
          localStorage.removeItem("theme");
          }
          applyThemeToUI(wbtheme);
      }
  }

  function applyThemeToUI(name) {
      const safeName = name.replace(/[^\x20-\x7EА-яЁёІіЇїЄє]/g, "").trim();

document.getElementById("panel").className = safeName;
document.getElementById("sysmenu").className = safeName;


document.body.classList.add(...safeName.split(/\s+/));
      
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
      'wasm': { mime: 'application/wasm', icon: icns.binary}, // Editable, but not readble by human beings. Ask monkeys for help,
      'xslt': { mime: 'application/xslt+xml', icon: icns.textHtml},
      'colors': {mime: 'application/x-kde-palette', icon: icns.ms_theme},
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

let URL_ASSOC = {};

try {
    URL_ASSOC = JSON.parse(localStorage.getItem('config/urls')) || {};
} catch {
    URL_ASSOC = {};
}

  const lastBoot = Date.now();

  function getFileTypes(){return FILE_TYPES;}
  function getUrlAssoc(){return URL_ASSOC;}
  function getMasterVolume(){return vol;}
  function getKbrdShortcutsLayout(){return currentKeyboardLayout;}
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
  function getMutObsrvs(){return window.systemObservers;}
  function getPwrMan(){return PowerManager;}
  function getDesktopIcons(){return desktopIcons;}


function chKbrdLayout(layout) {
    const runSpan = document.querySelector("#deskM li:nth-child(3) span");

    if (layout === "win") {
        replaceTextInElements("⌘", "CTRL");
        replaceTextInElements("⌥", "ALT");
        
        // Target specifically the RUN shortcut for Windows
        if (runSpan) runSpan.textContent = "WIN+R";

        currentKeyboardLayout = 'win';
    } else {
        replaceTextInElements("CTRL", "⌘");
        replaceTextInElements("ALT", "⌥");

        // Restore Spotlight shortcut for macOS
        if (runSpan) runSpan.textContent = "⌘+Space";

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
path = path.split("?")[0];

    console.log("url:", url);
    console.log("path:", path);
    
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

  document.getElementById("rename_item_btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      
      // 1. Одразу ховаємо контекстне меню, не чекаючи на prompt
      document.getElementById("itemM").style.display = "none";
      
      if (obj && obj.parentNode) {
          // Зберігаємо локальну копію елемента на випадок, якщо глобальний obj змінить значення під час очікування prompt
          const currentObj = obj; 
          const targetName = currentObj.getAttribute('name'); 
          const i = desktopIcons.find(icon => icon.name == targetName);

          if (!i) {
              console.error("Іконку не знайдено в масиві для імені:", targetName);
              return;
          }

          // Чекаємо на prompt ОС
          const re = await prompt(_("prompt_rename"), i.name);
          
          if (re && re.trim() !== "") {
              // Оновлюємо дані в пам'яті
              i.name = re;
              
              // 2. КРИТИЧНО: Оновлюємо і текст, і атрибут на самому елементі!
              currentObj.setAttribute('name', re); 
              const pElement = currentObj.querySelector('p');
              if (pElement) pElement.innerText = re;
              
              // Зберігаємо в persistent storage
              localStorage.setItem('desktopIcons', JSON.stringify(desktopIcons));
          }
      }
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
<div style="
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 15px;
  color: var(--color-text-primary);
  background-color: var(--bg-color);
  box-sizing: border-box;
  min-height: 100%;
">
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
        if (appIns) desktopIcons.push({id:id,name:nm, nameApp: (appIns.name || null)})
        if (fileIns) desktopIcons.push({id:id,name:nm, nameFile: (fileIns.name || null)})

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
          <img src="${iconUrl}" style="height: 32px;" draggable="false">
          <p data-i18n="${nameKey}" style="margin: 0px; color: #fff; text-shadow: 1px 1px 1px rgba(0,0,0,0.5);">${_(nameKey)}</p>
      `;

      appContainer.addEventListener("contextmenu", (e)=>{
          e.preventDefault(); e.stopPropagation(); obj = appContainer;
          document.querySelectorAll(".menu").forEach(i => i.style.display="none");
          if (isRequiredIcon) {document.getElementById("itemM").querySelector('#delete_item_btn').classList.add('disabled');
          document.getElementById("itemM").querySelector('#rename_item_btn').classList.add('disabled');
        }else{
          document.getElementById("itemM").querySelector('#delete_item_btn').classList.remove('disabled');
          document.getElementById("itemM").querySelector('#rename_item_btn').classList.remove('disabled');
        }
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
async function openApp(targ, arg = null) {
    // 1. Клік по фізичній іконці (якщо є)
    if (typeof targ === "string" || !targ.path) {
        if (typeof apps !== "undefined" && apps) {
            const expectedName = typeof targ === "string" ? targ : _(targ.name);
            const physicalIcon = Array.from(apps).find(icon => icon.name == expectedName);

            if (physicalIcon && physicalIcon.onclick && apps.some(app => app.name === physicalIcon.name)) {
                physicalIcon.onclick(arg); 
                return true;
            }
        }
    }

    // 2. Визначення сутності додатка
    const isString = typeof targ === "string";
    let appPath = (isString && targ.includes('.htm')) ? targ : (!isString ? targ.path : null); 
    let appEntry = isString 
        ? getApps().find(a => a.path === targ.split('?')[0] || a.name === targ)
        : targ;

    if (!appEntry) {
        console.error("App not found:", (isString ? targ : targ.name));
        return false; 
    }

    // 3. Системні додатки запускаємо ОДРАЗУ (без жодних маніпуляцій з дисками)
    if (appEntry.system) {
        if (appEntry.path) {
            const appClasses = Array.isArray(appEntry.class) ? appEntry.class : [];
            new wm(_(appEntry.name), {
                x: "center", y: "center",
                class: appClasses.map(c => c === "wbtheme" ? wbtheme : c).join(" ") || wbtheme,
                url: appPath,
                icon: appEntry.icon,
                minwidth: appEntry.miw, minheight: appEntry.mih,
                width: appEntry.w, height: appEntry.h,
                maxwidth: appEntry.maw, maxheight: appEntry.mah,
                oncreate: function() {
                    if (typeof applySystemConfig === "function") applySystemConfig(this.id);
                }
            });
        } else if (appEntry.onclick) {
            

            appEntry.onclick(arg);
        }
        return true;
    } 

    // 4. Користувацький додаток: ПЕРЕВІРКА -> ЗМІНА ДИСКА -> ВІДКРИТТЯ -> ВІДНОВЛЕННЯ
    const beforeDB = currentDisk ? currentDisk.name : null;
    const needsDiskSwitch = beforeDB && startupDisk && (beforeDB !== startupDisk);

    try {
        // Перевіряємо та перемикаємо диск на системний (startupDisk), якщо ми не на ньому
        if (needsDiskSwitch) {
            console.log(`[Drive Switch] Unmounting ${beforeDB} -> Mounting ${startupDisk}`);
            await unmountDrive(beforeDB);
            await mountDrive(startupDisk);
        }

        // Відкриваємо файл/додаток
        const mime = typeof getMimeType === "function" ? getMimeType(appEntry.path) : "text/html";
        await Openf(mime, appEntry.path, false);

    } catch (err) {
        console.error("Failed to launch user app:", err);
    } finally {
        // Повертаємо диск назад, якщо змінювали його
        if (needsDiskSwitch) {
            console.log(`[Drive Restore] Unmounting ${startupDisk} -> Restoring ${beforeDB}`);
            await unmountDrive(startupDisk);
            await mountDrive(beforeDB);
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
              console.log("OPN: "+DB_NAME)

              request.onupgradeneeded = (event) => {
                  const db = event.target.result;
                  if (!db.objectStoreNames.contains(STORE_NAME)) {

                      db.createObjectStore(STORE_NAME, { keyPath: 'name' }); 
                  }
              };

              request.onsuccess = (event) => {
  console.log("DB_NAME - "+DB_NAME)
  const dbInstance = event.target.result;
        console.log( "STORE_NAME: "+dbInstance.objectStoreNames)
                  if (!BOOT){
                      sounds.play("deviceIn");
                  }
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
    } else if (currentDisk.type == 'USB'){
const targetFilePath = `${currentDisk.where}/${file.name}`;
console.log(targetFilePath)
try {
  const url = `/api/write_binary?path=${encodeURIComponent(targetFilePath)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream'
    },
    body: file // Передаємо об'єкт File напряму в body
  });

  const result = await response.json();
  
  if (result.success) {
    console.log(`Файл ${file.name} успішно записано на USB!`);
  } else {
    console.error("Помилка запису файлу:", result.error);
  }
} catch (err) {
  console.error("Помилка мережевого запиту:", err);
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

async function listUsbContents(mountpoint) {
  if (!mountpoint) {
    console.warn("Флешка не змонтована (mountpoint відсутній)!");
    return [];
  }

  try {
    const url = `/api/ls?path=${encodeURIComponent(mountpoint)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      console.log("Отримано масив шляхів USB:", data.items);
      return data.items;
    } else {
      console.error("Помилка читання USB:", data.error);
      return [];
    }
  } catch (err) {
    console.error("Помилка запиту до /api/ls:", err);
    return [];
  }
}

// Приклад використання:
// const paths = await listUsbContents(usbDisk.mountpoint);

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
  } else if (!currentDisk || currentDisk.type == 'USB'){

try {
    // 1. Отримуємо список метаданих з /api/ls
    const res = await fetch(`/api/ls?path=${encodeURIComponent(currentDisk.where)}`);
    const data = await res.json();
    if (!data.success) {
      const brokenUSB = currentDisk.total == 0 && currentDisk.used == 0;
      try{
await unmountDrive(currentDisk);
}finally{
if (brokenUSB) return console.error('Mount failed. Capacity: 0B.')
if (currentDisk && !currentDisk.where) return console.error('Mount failed. "Where" is not provided.')
}

    }

    for (const item of data.items) {
      if (item.type === "file") {
        // 2. Витягуємо бінарний вміст файла з сервера
        const blobRes = await fetch(`/api/read_binary?path=${encodeURIComponent(item.path)}`);
        const blob = await blobRes.blob();

        // 3. Створюємо СПРАВЖНІЙ об'єкт File()
        const fileObject = new File([blob], item.path.replace(currentDisk.where+"/", ''), {
          type: getMimeType(item.path.replace(currentDisk.where+"/", '')),
          lastModified: item.mtime * 1000
        });

        // 4. Додаємо у твій масив fs
        fs.push(fileObject);
        
      
      }
    }

  } catch (err) {
    
  }
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



  function loadBackground() {
    const resetBg = ()=> {
      document.body.style.backgroundImage = `url(data:image/png;base64,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)`;
    }
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
                  resetBg();
                  resolve(); // <--- КРИТИЧНО: Завершення Promise, якщо файл не знайдено
              }
          } else {

              console.log("No background configured.");
              resetBg();
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


  function finishStartup() {
    const minimizeObserver = new MutationObserver((mutations) => {
  // Check if any mutated element or its ancestor has the winbox class
  const winboxMutated = mutations.some(m => 
    m.target.classList && 
    (m.target.classList.contains('winbox') || m.target.closest('.winbox'))
  );

  if (winboxMutated && !updateScheduled) {
    updateScheduled = true;
    requestAnimationFrame(() => {
      updateFirstMinimized();
      updateScheduled = false;
    });
  }
});

minimizeObserver.observe(document.body, {
  attributes: true,
  subtree: true,
  attributeFilter: ['class']
});

setTimeout(()=>{
  desktopIcons.forEach(i=>{
  let ev;

  if (i.nameApp){
    ev = ()=> openApp(apps[apps.findIndex(app => app.name === i.nameApp)])
    console.log(apps.findIndex(app => app.name === i.nameApp))
  }else if (i.nameFile){
    const f = fs.find(f=>f.name == i.nameFile);
    ev = ()=> Openf(f.type, f.name)
  }


  if ((!i.nameApp && !i.nameFile) || (i.nameApp && i.nameFile) || !i.name) localStorage.removeItem('desktopIcons')

  let ic;
  if (i.nameApp) ic = apps.find(app => app.name == i.nameApp).icon;
  else if (i.nameFile) ic = getIcon(fs.find(f=>f.name == i.nameFile))
    addIcon(i.name, ic, ev)
  })
},100);
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
if (BOOT_INTERR) return false; // Normal startup interrupted.

          autoload.forEach(itemName => {
              const autofile = fs.find(file => file.name === itemName);
              if (!autofile){
                autoload = autoload.filter(a=> a != itemName);
                localStorage.setItem('autoload', JSON.stringify(autoload))
              }else{
              Openf(autofile.type, autofile, false)
              }

          });
      

      // Приховуємо заставку та запускаємо звук
      setTimeout(() => {
          const splash = document.getElementById('splash');
          if (splash) splash.classList.add("hidden"); 

      }, 100);

      try {
          sounds.play("startup");
      } catch (e) {}

      
      
  }



  const prg = document.getElementById("loadprg");


    function firstStart(){

        

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
    let writtenBytes = 0;

    // 1. Calculate how much space your existing keys are currently taking up
    let existingBytes = 0;
    for (let k in localStorage) {
        if (localStorage.hasOwnProperty(k)) {
            existingBytes += (k.length + localStorage.getItem(k).length) * 2; 
            notify.innerText = "[OK] Local Storage allocated: " + existingBytes + " bytes\n";
        }
    }

    try {
        while (true) {
            const key = keyPrefix + i;
            const value = "x".repeat(chunkSize);

            localStorage.setItem(key, value);

            writtenBytes += chunkSize;
            notify.innerText = "[OK] Local Storage allocated: " + writtenBytes + " bytes\n";
            i++;

            if (prg) {
                // Approximate ratio including existing data
                const ratio = Math.min((writtenBytes + existingBytes) / (5 * 1024 * 1024), 0.99);
                prg.value = Math.round(ratio * max);
            }
        }
    } catch (e) {
        console.log("LIMIT REACHED. New writes:", writtenBytes, "bytes");

        // cleanup test keys safely
        for (let j = 0; j < i; j++) {
            localStorage.removeItem(keyPrefix + j);
        }

        if (prg) prg.value = max;

        // 2. Return the Total Limit (Existing space + what was left)
        return existingBytes + writtenBytes;
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
Object.entries(FILE_ASSOC).forEach(([ext, appPath]) => {
    // Skip cleanup for internal handlers/keywords like 'openf'
    if (appPath === 'openf') return;

    // Шукаємо, чи існує ще файл додатка у віртуальній ФС
    const isAppExists = fs.some(f => f.name === appPath);

    // Якщо додаток видалено з диска — анулюємо асоціацію для цього розширення
    if (!isAppExists) {
        delete FILE_ASSOC[ext];

        const baseExtensions = Object.keys(FILE_TYPES);
        if (!baseExtensions.includes(ext)) {
            delete FILE_TYPES[ext];
        }
        localStorage.setItem('config/exts', JSON.stringify(FILE_ASSOC));
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

    // 1. Synchronize in-memory registry with localStorage truth
    if (!FILE_TYPES[cleanExt]) {
        FILE_TYPES[cleanExt] = {
            mime: mimeType || "application/octet-stream",
            icon: getIcon(new File([], `a.${cleanExt}`)) || (icns.empty || ""),
            openWith: FILE_ASSOC[cleanExt] || appName
        };
    }

    // 2. If localStorage doesn't have an association yet, assign this app as default
    if (!FILE_ASSOC[cleanExt] && searchParam) {
        FILE_ASSOC[cleanExt] = appName; 
        FILE_TYPES[cleanExt].openWith = appName;
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
    BOOT = true;

    // Quick helper to handle formatting cleanly
    const log = (msg) => {
        notify.innerHTML += `<div>${msg}</div>`;
    };

    try {
        if (cleanOnBoot) {
            let a = 0;
            Object.keys(localStorage).forEach(k => {
                if (localStorage[k].trim() == '') {
                    localStorage.removeItem(k);
                    a++;
                }
            });
            if (a > 0) console.log("Cleaned keys: " + a);
        }

        prg.value = 0;

        maxLS = await getMaxLS(prg, 5);
        notify.innerHTML = ""; // Clear initial state
        log("[OK] Local Storage allocated: " + maxLS + " bytes");
        prg.value = 5;

        await loadFsFromDB();
        log("[INFO] Press "+INTERR_KEY+" to interrupt normal startup");
        log("[OK] Filesystem loaded");
        prg.value = 10;

        const disks = await getDisks();
        currentDisk = disks.find(d => d.name == DB_NAME);
        log("[OK] Disks loaded");
        prg.value = 15;

        if (!localStorage.getItem("locale") || !localStorage.getItem("dlocale")) {
            await firstStart();
            log("[OK] OOBE loaded");
        } else {
            log("<span style='color:yellow;'>[SKIP] OOBE skipped</span>");
        }
        prg.value = 20;

        await setupFonts();
        log("[OK] Fonts loaded");
        prg.value = 25;

        await loadLanguage();
        log("[OK] Language loaded: " + currentLang + " " + dateLang);
        prg.value = 30;

        devProps = await buildDevProps();
        log("[OK] Device properties loaded");
        prg.value = 35;

        await setPanelConfig(JSON.parse(localStorage.getItem("panel-conf")) || {});
        log("[OK] Panel configuration loaded");
        prg.value = 40;

        await loadTheme();
        log("[OK] Theme loaded");
        prg.value = 45;

        await loadBackground();
        log("[OK] Background loaded");
        prg.value = 50;

        await redefineAdaptations();
        log("[OK] Adaptations redefined");
        prg.value = 55;

        await loadLayout();
        log("[OK] Keyboard shortcuts layout loaded: " + getKbrdShortcutsLayout());
        prg.value = 60;

        PowerManager.init({
            timeout: localStorage.getItem("sleepModeTimeout")
                ? parseInt(localStorage.getItem("sleepModeTimeout"))
                : (60 * 1000),
            onIdle: () => enterSleepMode(),
            onWake: () => exitSleepMode(),
            isPaused: (parseInt(localStorage.getItem("sleepModeTimeout")) == 0)
        });

        log("[OK] Power Manager loaded");
        prg.value = 65;

        await npmUpdate();
        log("[OK] Node packages loaded");
        prg.value = 70;

        await setupExtentions();
        log("[OK] File extension associations loaded");
        prg.value = 75;

        updateBattery();
        log("[OK] Battery status loaded");
        prg.value = 80;

        await registerApps();
        log("[OK] Applications registered");
        prg.value = 85;

        notificationAPI = await redefineNotifications();
        log("[OK] Notifications redefined");
        prg.value = 90;

        if (allowScreenTime === true) {
            await usageTracker.start();
            log("[OK] Screen time tracker started");
        } else {
            log("<span style='color:yellow;'>[SKIP] Screen time tracker skipped</span>");
        }
        prg.value = 95;

        await finishStartup();
        prg.value = 100;
        if (!BOOT_INTERR) {
            log("[OK] Startup complete");
            BOOT = false;
        } else {
            log("<span style='color:maroon;'>[FAIL] Startup interrupted by user</span>");
        }

    } catch (e) {
        console.error("BOOT ERROR:", e);
        log("<span style='color:maroon;'>[FAIL] Startup error</span>");
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

  if (content.includes('localStorage.') || content.includes('fakeStorage.') ||
    content.includes('[localStorage]') || content.includes('[fakeStorage]')){
    expand += `fakeStorage.request()\n`;
  }

  if (content.includes("new Notification(") && !content.includes("Notification.requestPermission()")){
      expand += `Notification.requestPermission()\n`;
  }

  if (content.includes("navigator.geolocation.getCurrentPosition") && !content.includes("navigator.geolocation.request()")){
      expand += `fakeGeolocation.request()\n`;
  }

  if (content.includes("navigator.mediaDevices.get") && !content.includes('navigator.mediaDevices.request()')){
    expand += 'fakeMediaDevices.request()\n';
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
    Object.defineProperty(navigator, 'userAgent', {
    get: function () {
        return 'Mozilla/5.0 (Infinity OS ${devProps.os.version}; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
    }
});
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
    const download = anchor.getAttribute("download");
    return download || anchor.href.split("/").pop() || "download";
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
          if (this.href == '#') return;
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
          }else{
            parent.window.open(anchor.href);
      return;
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
      if (anchor.href == '#') return;
              const assoc = parent.getUrlAssoc();

              if (assoc.hasOwnProperty(clickedUrl.origin)) {
                  e.preventDefault(); // Stop actual browser redirect
                  const appPath = assoc[clickedUrl.origin];
                  console.log("URL ASSOC FOUND!")
                  const targetUrl = appPath + "?url=" + encodeURIComponent(anchor.href);

  // Launch your Infinity OS application with the full payload
  parent.Openf("text/html", targetUrl);
              }else{
      parent.window.open(anchor.href);
      return;
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


  document.addEventListener("click", (e) =>{
      parent.hideMenus(e);
    })

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
        if (!key.includes("/"))
            key = String("${name}").toLowerCase().replaceAll(" ", "_") + "/" + key;
        
        if (${permissions[name] && permissions[name].localStorage == true }) {
            localStorage.setItem(String(key), String(value));
            allowedKeys.push(String(key));
        }
    },
    
    getItem(key) {
        if (!key.includes("/")){
            key = String("${name}").toLowerCase().replaceAll(" ", "_") + "/" + key;
        }
        
        allowedKeys.push(String(key));
        return localStorage.getItem(String(key));
    },
    
    removeItem(key) {
        if (!key.includes("/")){
            key = String("${name}").toLowerCase().replaceAll(" ", "_") + "/" + key;
        }
        
        if (allowedKeys.includes(String(key)))
            localStorage.removeItem(String(key));
    },

      clear() {
      Object.keys(localStorage).forEach(k=> {
          if (k.startsWith(String("${name}").toLowerCase().replaceAll(" ", "_"))) localStorage.removeItem(k)
      })
      
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
  console.error = console.warn;
  Worker = parent.Worker;
  print = () => parent.print();

  window.focus = () => parent.fore('${fileWinBox.id}');  
  window.open = (...a)=> parent.window.open(...a)
  window.blur = () => parent.blur('${fileWinBox.id}');
  window.resizeTo = (x,y) => parent.winResize('${fileWinBox.id}', x,y);

  window.opener = null;
  window.parent.close = () => {};
  window.top = null;
      
window.location.ancestorOrigins = {
  length: 0,
  item: () => null,
  contains: () => false,
  [Symbol.iterator]: function* () {}
};

window.fakeWakeLock = {
    async request(type = "screen") {
        console.log("Requesting wake lock:", type);

        const existing = permissions["${name}"];
        let allow = existing?.wakeLock;

        if (allow == null) {
            allow = await parent.confirm(
                parent._("application_needs_permission") + "Wake Lock"
            );
            parent.setPerm("${name}", "wakeLock", allow);
        }

        if (!allow)
            throw new DOMException(
                "Permission denied",
                "NotAllowedError"
            );

        parent.getPwrMan().pause();

        return {
            released: false,

            async release() {
                if (this.released) return;

                this.released = true;
                parent.getPwrMan().resume();

                this.dispatchEvent?.(new Event("release"));
            },

            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() {}
        };
    }
};

if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && navigator.mediaDevices.getUserMedia){
const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

window.fakeMediaDevices = {
      async request(){
      console.log('Requesting: mediaDevices');
      const existing = permissions['${name}'];
      if (!existing || !existing.mediaDevices && existing.mediaDevices == null) {
      console.log('Ask: mediaDevices');
          const allow = await parent.confirm(parent._('application_needs_permission') + "Media Devices");
          parent.setPerm('${name}', 'mediaDevices', allow); // Fixed variable reference
      }
      },
      async getDisplayMedia(constraints = {}){
    // 2. Перевіряємо актуальний стан після request()
    const isGranted = Boolean(permissions['${name}'] && permissions['${name}'].mediaDevices === true);
    console.log("Permission request state: " + isGranted);

    if (!isGranted) {
      throw new DOMException("Permission denied by user", "NotAllowedError");
    }
      return originalGetDisplayMedia(constraints);
      },
async getUserMedia(constraints = {}) {
    // 2. Перевіряємо актуальний стан після request()
    const isGranted = Boolean(permissions['${name}'] && permissions['${name}'].mediaDevices === true);
    console.log("Permission request state: " + isGranted);

    if (!isGranted) {
      throw new DOMException("Permission denied by user", "NotAllowedError");
    }

    // 3. Викликаємо нативний метод
    return originalGetUserMedia(constraints);
  }
}

}

  window.fakeGeolocation = {
    async request(){
      const existing = permissions['${name}'];
      if (!existing || !existing.location && existing.location == null) {
          const allow = await parent.confirm(parent._('application_needs_permission') + "Location");
          parent.setPerm('${name}', 'location', allow); // Fixed variable reference
      }
    },

    async getCurrentPosition(successCallback, errorCallback, options) { // Added async here
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
  modifiedContent = modifiedContent.replaceAll(/(?<![\w$.])document\.location\.href(?!\s*=)/g,`'${href}'`);
  modifiedContent = modifiedContent.replaceAll(/(?<![\w$.])window\.location\.href(?!\s*=)/g,`'${href}'`);
  modifiedContent = modifiedContent.replaceAll(/(?<![\w$.])location\.href(?!\s*=)/g,`'${href}'`);
  modifiedContent = modifiedContent.replaceAll(/document\.title(?!\s*=)/g, `'${name}'`)

  modifiedContent = modifiedContent.replaceAll(/document\.location\.search(?!\s*=)/g, `'${safeTarget}'`);
  modifiedContent = modifiedContent.replaceAll(/window\.location\.search(?!\s*=)/g, `'${safeTarget}'`);
  modifiedContent = modifiedContent.replaceAll(/location\.search(?!\s*=)/g, `'${safeTarget}'`);

  modifiedContent = modifiedContent.replaceAll('window.close()', 'winKill()');
  modifiedContent = modifiedContent.replaceAll('self.close()', 'winKill()');
  modifiedContent = modifiedContent.replaceAll('this.close()', 'winKill()');

  modifiedContent = modifiedContent.replace(multipleRegex, '$1$2');

  modifiedContent = modifiedContent.replaceAll('navigator.geolocation', 'window.fakeGeolocation');
  modifiedContent = modifiedContent.replaceAll('navigator.mediaDevices', 'window.fakeMediaDevices');
  modifiedContent = modifiedContent.replaceAll('navigator.wakeLock', 'window.fakeWakeLock');

  modifiedContent = modifiedContent.replaceAll('localStorage.', 'fakeStorage.');
  modifiedContent = modifiedContent.replaceAll('[localStorage]', '[fakeStorage]');
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
          console.error("File not found: " + fileOrName);
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

        const w = "30%";
        const h = "35%";

        const typeclass = fileType.split("/")[0];
console.log(exfile.name)
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

          
          if (fileType == "application/x-theme" || fileType == 'application/x-kde-palette') {

  localStorage.setItem("theme", exfile.name);
  try{
          const parser = new ThemeParser();
          const thm = parser.parse(content, exfile.name); 
  parser.applyTheme(thm.styles)
  applyThemeToUI(thm.name)
  }catch{
  loadTheme()
  }
  fileWinBox.close();
  }            
          
  if (fileType.startsWith("font/") || fileType === "application/x-font-ttf" || fileType === "application/font-woff") {
    isEditable = false;
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
  } else if (fileType === 'application/wasm') {
          isEditable = false;
          
          // 1. Inject the canvas element directly using your window's element property
          newContent = `
              <canvas id='wasmcanvas' width='640' height='480' style='width:100%; height:100%; display:block;'></canvas>
          `;

          fileWinBox.body.innerHTML = newContent;


          // 2. Wait exactly one paint frame for the DOM layout engine to anchor the new canvas element
          requestAnimationFrame(async () => {
              const canvas = document.getElementById('wasmcanvas');
              if (!canvas) return console.error("Wasm canvas target could not be resolved.");
              
              const ctx = canvas.getContext('2d');

              try {
                  // --- Dynamic Imports Compiler ---
                  const tempModule = await WebAssembly.compile(content);
                  const importsNeeded = WebAssembly.Module.imports(tempModule);
                  const dynamicImports = {};
                  
  const WasmBridge = {
      env: {
          print(v) {
              console.log(v);
          },

          random() {
              return Math.random();
          },

          now() {
              return performance.now();
          },

          abort(code) {
              throw new Error(`WASM aborted (${code})`);
          },

          memory: new WebAssembly.Memory({
              initial: 16,
              maximum: 256
          }),

          table: new WebAssembly.Table({
              initial: 0,
              element: "anyfunc"
          })
      }
  };

  // 2. Your upgraded Dynamic Imports Compiler loop
  importsNeeded.forEach(imp => {
      if (!dynamicImports[imp.module]) dynamicImports[imp.module] = {};
      
      if (imp.kind === "function") {
          // Check if we have a real implementation inside our OS Bridge layout
          if (WasmBridge[imp.module] && typeof WasmBridge[imp.module][imp.name] === "function") {
              // Link the WASM import directly to your real JS function!
              dynamicImports[imp.module][imp.name] = WasmBridge[imp.module][imp.name];
          } else {
              // Fallback: If the OS doesn't have this function built yet, log it so it doesn't crash
              dynamicImports[imp.module][imp.name] = (...args) => {
                  console.warn(`[Wasm Missing Import Stub -> ${imp.module}.${imp.name} called with]:`, args);
              };
          }
      }
      if (!dynamicImports[imp.module]) dynamicImports[imp.module] = {};
      

      else if (imp.kind === "global") {
          // Inject a safe global placeholder value (usually 0 handles basic constants)
          dynamicImports[imp.module][imp.name] = new WebAssembly.Global({ value: 'i32', mutable: true }, 0);
      } 
      else if (imp.kind === "memory") {
          // Provide a default 1-page buffer (64KB) if the binary expects a host memory layout
          dynamicImports[imp.module][imp.name] = new WebAssembly.Memory({ initial: 1 });
      } 
      else if (imp.kind === "table") {
          // Provide an empty table object if it's looking for dynamic function pointer offsets
          dynamicImports[imp.module][imp.name] = new WebAssembly.Table({ initial: 0, element: 'anyfunc' });
      }
  });

                  // Instantiate compilation using the safely discovered imports map
                  const { instance, module } = await WebAssembly.instantiate(content, dynamicImports);
                  
                  // --- Reflection & Mapping Logic ---
                  const exportsList = WebAssembly.Module.exports(module);
                  const memoryExport = exportsList.find(exp => exp.kind === "memory");

                  // Parse function entrypoints dynamically
                  const pointerExport = exportsList.find(exp => 
                      exp.kind === "function" && 
                      (exp.name.includes("pointer") || exp.name.includes("buffer") || exp.name.includes("screen") || exp.name.includes("output") || exp.name.includes("mem"))
                  );

                  let wasmMemory = memoryExport ? instance.exports[memoryExport.name].buffer : (instance.exports.memory ? instance.exports.memory.buffer : null);
                    const renderExport = exportsList.find(exp => 
                      exp.kind === "function" && 
                      (exp.name.includes("tick") || exp.name.includes("render") || exp.name.includes("generate") || exp.name.includes("update") || exp.name.includes("main") || exp.name.includes("run") || exp.name.includes("draw"))
                  );

                  const functions = exportsList.filter(exp => exp.kind === "function");
                  let getPointerFn = pointerExport ? instance.exports[pointerExport.name] : (functions.length > 1 ? instance.exports[functions[0].name] : () => 0);
                  let renderFrameFn = renderExport ? instance.exports[renderExport.name] : (functions.length > 1 ? instance.exports[functions[1].name] : instance.exports[functions[0].name]);

                  if (!renderFrameFn) throw new Error("Could not automatically map lifecycle functions from Wasm export metadata.");
                  
  const canRender =
      wasmMemory &&
      typeof renderFrameFn === "function" &&
      typeof getPointerFn === "function";

  let pixelPointer = 0;
  let hasFramebuffer = false;

  if (canRender) {
      try {
          pixelPointer = getPointerFn();

          const requiredBytes = canvas.width * canvas.height * 4;

          hasFramebuffer =
              Number.isInteger(pixelPointer) &&
              pixelPointer >= 0;
      } catch (e) {
          hasFramebuffer = false;
      }
  }

      Object.entries(instance.exports).forEach(([name, value]) => {
          if (typeof value === "function") {
              window.wasm[name] = value;
          }
      });
      const autoloadList = JSON.parse(localStorage.getItem("autoload")) || [];

      if (!autoloadList.includes(exfile.name)) {
          console.log(Object.keys(instance.exports).join(", "));
      }


  if (!hasFramebuffer) {
      fileWinBox.close();
      return;
  }

  // --- MODE B: Graphical App Mode ---
    
  const byteCount = canvas.width * canvas.height * 4; 

  // Track the actual maximum available space from the pointer to the end of memory
  const availableBytes = wasmMemory.byteLength - pixelPointer;
  let pixelData;

  if (availableBytes < byteCount) {
      // The WASM memory is too small for a 640x480 frame!
      console.warn(`Wasm memory buffer (${wasmMemory.byteLength} bytes) is smaller than requested canvas layout (${byteCount} bytes). Auto-scaling resolution down.`);
      
      // Fallback: Read whatever is left in the buffer safely without crashing
      pixelData = new Uint8ClampedArray(wasmMemory, pixelPointer, availableBytes);
      
      // Recalculate a safe internal layout or use a dynamic allocation match
      // (Alternatively, you can just clamp the byte count to what's available)
      try {
          const clampedCount = Math.floor(availableBytes / 4) * 4; // Align to 4-byte boundaries (RGBA)
          pixelData = new Uint8ClampedArray(wasmMemory, pixelPointer, clampedCount);
      } catch(e) {
          throw new Error("Wasm memory is insufficient to populate a standard graphical canvas frame context.");
      }
  } else {
      // Normal allocation if the buffer is big enough
      pixelData = new Uint8ClampedArray(wasmMemory, pixelPointer, byteCount);
  }
  getPointerFn();


  console.log('WASM getPointer: '+ getPointerFn.name);
  console.log('WASM renderFrameFn: '+ renderFrameFn.name)
  function render() {
      renderFrameFn();

      const required = canvas.width * canvas.height * 4;

      if (wasmMemory.byteLength - pixelPointer < required) {
          requestAnimationFrame(render);
          return;
      }

      const pixels = new Uint8ClampedArray(
          wasmMemory,
          pixelPointer,
          required
      );

      ctx.putImageData(
          new ImageData(pixels, canvas.width, canvas.height),
          0,
          0
      );  

      requestAnimationFrame(render);
  }



                  render();
                  console.log(`Successfully parsed and loaded [${exfile.name}].`);

              } catch (wasmError) {
                  console.error("Wasm runtime crashed during dynamic initialization:", wasmError);
              }
          });
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

      <div class="footer" style="justify-content: space-between; background: #f5f5f5; padding: 5px; margin: 0; border-top: 1px solid #ccc; font-size: 15px; color: #555;">
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
  }else if (fileType.trim() == "application/xslt+xml"){
                isEditable = false;
const parser = new DOMParser();
const xslDoc = parser.parseFromString(content, "text/xml");

// 1. Check if the browser encountered an XML parsing error
const parseError = xslDoc.querySelector("parsererror");
if (parseError) {
    console.error("XML/XSLT Syntax Error:", parseError.textContent);
    // Handle the error gracefully here (e.g., alert the user or fallback)

}

const xmlDoc = parser.parseFromString('<?xml version="1.0" encoding="UTF-8"?><root/>', "text/xml");

const processor = new XSLTProcessor();
processor.importStylesheet(xslDoc);

const resultDoc = processor.transformToDocument(xmlDoc);

// 2. Make sure the transformation actually succeeded before serializing
if (!resultDoc) {
    console.error("XSLT Transformation failed. Check if your stylesheet structural rules are valid.");

}

const serializer = new XMLSerializer();
 newContent = serializer.serializeToString(resultDoc);
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
        
              <marquee scrollamount="1" style="font-size: 20px; font-weight: bold; color: white; display: block;  width: 100%;font-family: monospace;">${fileName}</marquee>
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
                      window.dispatchEvent(new CustomEvent("update", {
  detail: {
    type: "devices",
    timestamp: Date.now()
  }
}));

                  }
              };
          }
      } 

     // --- Trigger Block Fixes ---
  // Ensure font variations hit readAsDataURL correctly
  const isFont = fileType.startsWith("font/") || 
                 fileType === "application/x-font-ttf" || 
                 fileType === "application/font-woff" ||
                 fileType === "application/font-woff2";

  if (fileType.startsWith("text/") || !exfile.name.split("/").pop().substring(1).includes(".") || fileType == "application/x-theme" || fileType == "application/rtf" || fileType == 'application/xslt+xml') {
      console.log("readAsText");
      reader.readAsText(exfile);
  } else if (fileType.startsWith("image/") || fileType.startsWith("audio/") || fileType.startsWith("video/") || isFont || fileType == "application/pdf") {
      console.log("readAsDataURL");
      reader.readAsDataURL(exfile);
  } else {
      console.log("readAsArrayBuffer");
      reader.readAsArrayBuffer(exfile); // This captures application/wasm perfectly
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
function zipFolderUI(filePath, folderName){
    const zip = new wm("core.createZipFile", {
              width: 200, 
        height: 110,
        x: 'center',
        y: 'center',
        class: [wbtheme, 'no-resize', 'no-header'], 
        html: `     
<div style="display:flex; gap:5px; flex-direction:column; padding:5px; color: var(--color-text-primary); background-color: var(--bg-color); min-height:100%; box-sizing:border-box;">
  <div style="display:flex; flex-direction:row; gap:5px; align-items:center;">
    <label>${_('path')}:</label>
    <input type="text" id="nameZip"/>
  </div>

  <div style="display:flex; flex-direction:row; gap:5px; align-items:center;">
    <label>${_('compress')}</label>
    <input type="checkbox" id="comprZip">
  </div>

  <div>
    <button id="zipFldr">${_('ok')}</button>
    <button id="cancel2">${_('cancel')}</button>
  </div>
</div>`, oncreate: async function(){
      const $ = (selector) => document.querySelector(selector);
            
            $("#nameZip").value = filePath.trim() == "" ? folderName : filePath+folderName.replaceAll("/","")+".zip";
          $("#cancel2").addEventListener('click', async () => {
            this.close();
            resolve(false); // Resolve false on cancel
          });

          $('#zipFldr').addEventListener('click', async () => {
            const zipName0 = $('#nameZip').value.trim(); 
            const zipCompr = $('#comprZip').checked;
            await zipFolder(filePath, zipName0, zipCompr)
            this.close();
            resolve(true); // Resolve false on cancel
            })
            
  }
    
    }
          )

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


      
      try {

          await deleteFile(oldName);

      fs[fileIndex] = newFile;
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
 <div style="display:flex; gap:5px; flex-direction:column; padding:5px; color: var(--color-text-primary); background-color: var(--bg-color); min-height:100%; box-sizing:border-box;">
  <div style="display:flex; flex-direction:row; gap:5px; align-items:center;">
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
    const store = db
    .transaction(STORE_NAME, "readwrite")
    .objectStore(STORE_NAME);

  await store.clear();

    }else if (disk.type == 'USB'){
      await mountDrive(driveName);
      
      fs.forEach(f=> {
        deleteFile(f.name);
      })
    } else{
      return console.error("This drive type doesn't support 'Format'.")
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

    sounds.play("deviceOut");
  }

  async function mountDrive(driveName){
    const disks = await getDisks()
    const disk = disks.find(d=> d.name == driveName);
    try{
    if (!disk) return;
    if (currentDisk && (currentDisk.name == driveName && currentDisk.type == disk.type && currentDisk.used == disk.used && currentDisk.total == disk.total)) throw new Error(driveName+" is already mounted")
    currentDisk = disk;
  disk.mounted = true;
      if (disk.type === 'indexedDB'){
      idbWrapper.db = null;
      DB_NAME = driveName;
      console.log("Attempting to mount: "+driveName)
      await idbWrapper.openDB();
      await loadFsFromDB();
      } else if (disk.type != 'localStorage'){
        fs = [];
        console.log("Attempting to mount: "+driveName)
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
          
async function updateDiskQuotaUI(disk, meter, text) {
    try {
        if (disk.type === "localStorage") {
            const usedBytes = JSON.stringify(localStorage).length * 2;
            const totalBytes = maxLS;
            
            if (meter && text) {
                meter.max = totalBytes;
                meter.value = usedBytes;
                
                // --- Set thresholds for LocalStorage ---
                meter.low = totalBytes * 0.50;      // Under 50% is green
                meter.high = totalBytes * 0.85;     // Over 85% turns yellow/red
                meter.optimum = totalBytes * 0.20;  // Lower usage is better
                
                text.innerText = formatBytes(usedBytes) + " / " + formatBytes(totalBytes);
            }
            return { usedBytes: usedBytes, totalBytes: totalBytes }; // Added return for consistency
        } else if (disk.type == 'indexedDB') {
            const usedBytes = await getIndexedDBUsage(disk.name);
            const estimate = await navigator.storage.estimate();
            const totalBytes = estimate.quota || usedBytes;
            
            if (meter && text) {
                meter.max = totalBytes;
                meter.value = usedBytes;

                // --- Set thresholds for IndexedDB ---
                // Removed the broken Math.round logic that caused the permanent green tint
                meter.low = totalBytes * 0.50;      
                meter.high = totalBytes * 0.85;     
                meter.optimum = totalBytes * 0.20;  
                
                text.innerText = formatBytes(usedBytes) + " / " + formatBytes(totalBytes);
            }
            return { usedBytes: usedBytes, totalBytes: totalBytes };
        } else if (disk.type == 'USB'){
          const ds = await getDisks();
          const d1 = ds.find(d=> d.name == disk.name);
          const usedBytes = d1.used;
          const totalBytes = d1.total;


            if (meter && text) {
                meter.max = totalBytes;
                meter.value = usedBytes;
                
                // --- Set thresholds for LocalStorage ---
                meter.low = totalBytes * 0.50;      // Under 50% is green
                meter.high = totalBytes * 0.85;     // Over 85% turns yellow/red
                meter.optimum = totalBytes * 0.20;  // Lower usage is better
                
                text.innerText = formatBytes(usedBytes) + " / " + formatBytes(totalBytes);
              }

          return { usedBytes: usedBytes, totalBytes: totalBytes }
        }
    } catch (e) {
        console.warn("Quota error: " + e.message);
        if (text) text.innerText = _("unknown");
        return { usedBytes: 0, totalBytes: 0 };
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
        if (!db.name) continue;


          const usedBytes = await getIndexedDBUsage(db.name);
          const estimate = await navigator.storage.estimate();
          const totalBytes = estimate.quota || usedBytes;
          disks.push({
            type: "indexedDB",
            name: db.name,
            icon: icns.dbDrive,
            used: usedBytes,
            total: totalBytes,
            mounted: DB_NAME == db.name && (currentDisk ? currentDisk?.name == db.name : true)
          });
      }
  }

try {
    const res = await fetch('/api/drives');
    if (res.ok) {
        const data = await res.json();

        for (const d of (data.drives || [])) {
            const name = `${d.vendor || ""} ${d.model || ""}`.trim() || "USB Drive";

const disk = {
    type: "USB",
    name,
    icon: icns.usbDrive,
    used: d.used,
    total: d.total,
    mounted: currentDisk?.name == name,
};

Object.defineProperty(disk, "where", {
    value: d.mountpoint,
    writable: true,
    enumerable: false, // Hidden from key enumerations
    configurable: true
});

disks.push(disk);
        }
    }
} catch {
    // Running without the backend (file:// or no server).
    // Just skip USB drives.
}

      return disks;
  };


async function getInfo(e, btn){
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
ic = entry.icon;
          }else{
              ic = icns.folder;
          }


let meta = '';
if (typeofpath != 'drive'){
  meta = `
    <hr style=" border-color: #ffffff33;">
                  <b>${_("type")}: </b>${type}<br>
                  <b>${_("size")}: </b>${size}<br>
                  <b>${_("path")}: </b>${path.replaceAll('/', '/\u200B')}<br>
                  <b>${_("lastModified")}: </b>${formattedDate}
  `
}else if (typeofpath == 'drive'){
   meta = `
    <hr style=" border-color: #ffffff33;">
                  <b>${_("type")}: </b>${type}<br>
                  <b>${_("size")}: </b>${size}<br>
                  <b>${_('usage')}: </b>${formatBytes(entry.used)}<br>
  `;
if (entry.where) {
  meta+= `<b>${_("path")}: </b>${entry.where.replaceAll('/', '/\u200B')}<br>`
}
}
      const win = new wm(_("info"), {x: "center",y: "center",
          class: [ wbtheme, "no-max"],
          icon: icns.dialogInfo,
          height: 320,
          width: 250,
          minheight: 320,
          minwidth: 250,
          html: `
        <div style="
    display:flex;
    flex-direction:column;
    min-height:100%;
    box-sizing:border-box;
    color:var(--color-text-primary);
    background-color:var(--bg-color);
    overflow-x:hidden;
">
              <div style="padding-top: 15px;  font-size: 15px; text-align: center; margin-bottom: 15px;">
                  <img src="${ic}" style="width: 64px; height: 64px; object-fit: contain;">
                  <p style="font-weight: bold; margin-top: 8px; word-break: break-all; font-size: 15px;">${name}</p>
              </div>
              <div style='user-select:text;padding-left:5px;padding-right:5px;line-height: 1.25;overflow-wrap:anywhere; word-break:break-word;'>
            ${meta}
                  

            <span id='${'meta-'+name+"-"+size}'>
            </span>
              </div>
              </div>
              
          `
      });
      
      const metaDiv = document.getElementById('meta-'+name+"-"+size);


  if (!path.endsWith("/")) {
      if (entry.type.startsWith("image/")) {
          const imgMeta = new Image();
          imgMeta.src = URL.createObjectURL(entry);
          imgMeta.onload = () => {
              const width = imgMeta.naturalWidth;
              const height = imgMeta.naturalHeight;
              
              metaDiv.innerHTML += `
                            <hr style=" border-color: #ffffff33;">
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
              <div style="display: flex; flex-direction: column;   padding-top: 10px; box-sizing: border-box;width: fit-content; background: var(--toolbar-bg) !important; overflow-y: auto; height: 100%;">
                  <ul style="flex: 1;list-style-type: none; padding:0; margin-top:0; background:transparent;" id="sidebar-${uniqueId}"></ul>
              </div>

              <!-- Ресайзер -->
              <div id="resizer-${uniqueId}" style="width: 5px; cursor: col-resize; background: var(--toolbar-border); flex-shrink: 0;"></div>


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
      } else if (itemType === "USB"){
        buttons.forEach(id => fileMenuBtns[id].style.display = "none");
          fileMenuBtns.format_btn.style.display = "block";
          fileMenuBtns.getinfo_btn.style.display = "block";
          fileMenuBtns.mount_btn.style.display = "block";
          fileMenuBtns.unmount_btn.style.display = "block";
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
              file.type == "image/svg+xml" || file.type == "application/x-theme" || file.type == 'application/xslt+xml' ? "block" : "none";

          fileMenuBtns.toggle_autoload.style.display =
              (file.type === "text/javascript" || file.type === "text/html" || file.type === "application/wasm") ? "block" : "none";

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
      if (currentDisk && currentDisk.type != 'localStorage') await unmountDrive(currentDisk.name);
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
      const folderName = filePath.replace(/\/+$/, "").split('/').pop();
      await zipFolderUI(filePath,folderName );
      await renderFileList();  
  };
  zip1Btn.onclick = async (e) => {
      e.stopPropagation();
      const filePath = e.target
      .closest("li").getAttribute("data-file");

      // Правильний витяг імені папки без ризику зламати код
  const folderName = filePath.replace(/\/+$/, "").split('/').pop();

  await zipFolderUI(filePath,folderName );
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
  console.log(fileName)
  if (fileName.endsWith("/")){
              currentDir = fileName.slice(0,-1);
               renderFileList();
               document.getElementById("pathlabel-"+uniqueId).value = currentDir;
  }else{
                          const file = fs.find(f => f.name === fileName);
                          Openf(getMimeType(fileName), file);
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
                  ${disk.name} <meter class="quota-progress" style="flex-grow:1;"></meter>
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
              try{
              if (disk.type === "localStorage") {
                  const keys = Object.keys(localStorage);
                  currentDisk = disk;
                  fs = keys.map(k => new File([localStorage.getItem(k)], k, { type: getMimeType(k)}));
              } else {
  await mountDrive(disk.name)
              }} finally{
              await renderFileList(); // оновлюємо список
              }
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

window.addEventListener("update", (e) => {
  console.log("Update received:", e.detail);
  loadDisksList();
});

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

      if (fileName.endsWith(".js") || fileName.endsWith(".wasm") || fileName.endsWith(".htm") || fileName.endsWith(".html")) {
        try{
          const autoloadString = localStorage.getItem('autoload');
          if (autoloadString) {
              const autoload = JSON.parse(autoloadString);
              const autoloadCheckbox = document.getElementById("isAutoload");
              if (autoloadCheckbox) {
                  autoloadCheckbox.checked = autoload.includes(file.name);
              }
          }
        }catch{
          localStorage.setItem("autoload", '')
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



addSystemApp('run',icns.run,function(){
    new wm('core.runApplication', {
        x: "center", 
        y: "center",
        class: ["no-header", wbtheme, "no-max", 'no-resize'],
        height: 100,
        width: 260,  
        html: `
        <div style="
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 15px;
            color: var(--color-text-primary);
            background-color: var(--bg-color);
            box-sizing: border-box;
            min-height: 100%;
        ">
            <!-- Name Input Row -->
            <div style="display: flex; flex-direction: row; gap: 5px; align-items: center;">
                <label style="min-width: 60px;">${_('name')}:</label>
                <input id="name" list="apps" type="text" style="width: 150px; box-sizing: border-box;" required>
                <datalist id="apps"></datalist>
            </div>

            <!-- Action Buttons -->
            <div>
                <button id="save1" style="padding: 4px 12px;" disabled>${_('ok')}</button>
                <button id="cancel1" style="padding: 4px 12px;">${_('cancel')}</button>
            </div>
        </div>
        `, 
        oncreate: function() {
            let appIns = null;
            const $ = (selector) => this.body ? this.body.querySelector(selector) : document.querySelector(selector);

            const datalist = $('#apps');
            const nameInput = $('#name');
            const saveBtn = $('#save1');
            const cancelBtn = $('#cancel1');

            // Populate Datalist
            apps.forEach(a => {
                const el = document.createElement('option');
                el.value = _(a.name);
                datalist.appendChild(el);
            });

            // Listen directly to the <input> element, not the <datalist>
            nameInput.oninput = () => {
                const selectedVal = nameInput.value.trim();
                appIns = apps.find(a => _(a.name) === selectedVal || a.name === selectedVal) || null;
                saveBtn.disabled = !appIns;
            };

            cancelBtn.onclick = () => this.close();

            saveBtn.onclick = () => {
                if (appIns) {
                    openApp(appIns);
                    this.close();
                }
            };
        }
    })})
  

  addSystemApp(("about"),icns.dialogInfo, function(){
      new wm(_("about"),{ // ВИКОРИСТАННЯ _()
      icon: icns.dialogInfo,x: "center",y: "center",
      class: [ "no-max", "no-min", "no-resize", 'tra', wbtheme],
      html: `

              <div style="padding: 5px;  font-size: 15px;text-align: center;">
                  <img src="${devProps.deviceIcon}" style="width: 160px; height: 110px; object-fit: contain;">
                  <p style="font-weight: bold;  margin: 0px; word-break: break-all; font-size: 25px;user-select:text;">${devProps.model || _('unknown')}</p>
  <small style='padding-top: 0;color:gray;'>
                      ${devProps.inchRes || _("unknown")}
                  </small>
              </div>
              <div style='user-select:text;text-align: center;'>
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
                      color: var(--color-text-primary); !important;
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

  addSystemApp(("settings"), icns.settings, function(args = null){
  if (document.querySelector(".winbox.settings")) return;
      new wm(_('settings'),{x: "center",y: "center", width: 600,height:400,
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
        transition: grid-template-columns 0.25s ease;
      overflow: hidden;
  }

  /* ===== SIDEBAR ===== */
  #sett_app   .settings-toolbar {
      height: 100%; /* Замість 100vh */
      grid-area: sidebar;
      border-right: 1px solid #ccc;
      background: var(--toolbar-bg);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      transition: 0.3s;
      overflow-y: auto; /* Якщо вкладок стане забагато, скролитиметься сам сайдбар */
  }

  #sett_app   .column{
        margin-top: 15px; display: flex; justify-content: flex-start; gap: 10px; width: max-content;
  }

  /* ===== CONTENT ===== */
 #sett_app  .content-container {
      grid-area: content;
      height: 100%; /* Замість 100vh */
      overflow-y: auto; /* Єдине місце, де дозволено вертикальний скрол контенту! */
      padding: 15px;
      background: var(--bg-color);
  }

  /* Хендлер */
  #sett_app   .sidebar-handle {
      display: none;
  }

  /* Вкладки */
  #sett_app   .sidebar-tab:before{
      content: "» ";
  }

  #sett_app   .sidebar-tab:hover{
      text-decoration: underline;
  }

  #sett_app     .sidebar-tab.active {
      font-weight: bold;
      color: var(--accent-color, #4a9eff);
  }

  #sett_app   .sidebar-separator {
      border-top: 1px solid var(--input-border);
      margin: 6px 0;
  }

  #sett_app .page{
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

   #sett_app    .sidebar-handle {
          display: block !important;
          width: 100%;
          padding: 8px 0;
          cursor: pointer;
          text-align: center;
      }
  }
  #sett_app .settright{
    display: flex;
    align-items: center;
    gap: 5px;
    align-self: flex-end;   /* sticks it to the right edge of its flex column */
    width: calc(fit-content() + 500px);     /* dynamic width — only as wide as its content */
    margin-right: 5px;
}
  #sett_app       .settright select {
    box-sizing: border-box;
        width: auto !important;
        }
        .settright > div{
flex-direction: row;
        gap:5px;
        }
  /* ===== СТИЛІ ===== */
  #sett_app   .setting-row:not(.settright):not(.column) {
      display: flex;
      align-items: center;

      justify-content: space-between;
      gap: 10px;
      min-height: 40px;
      padding: 10px 5px;
      transition: background-color 0.15s ease-in-out;
  }

  #sett_app   .setting-row:not(.column):not(.settright) {
      border-top: 1px solid rgba(127, 127, 127, 0.25);
  }

  #sett_app   .setting-row:not(.column):first-child {
      border-top: none;
  }

  #sett_app   .setting-row:not(.column):not(.settright):hover {
      background-color: var(--button-border);
      border-radius: var(--radius-sm);
  }



  #sett_app   .setting-label {
      flex-grow: 1;
      width:100%;
      font-size: 14px;
      line-height: 1.3;
      
  }


  @keyframes fadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  #sett_app   #kbrd {
      display: block;
      width: 100%;
      height: auto;
      margin: 0;
      border-bottom-left-radius: 5px;
      transition: opacity 0.5s ease-in-out;
      opacity: 1;
  }

  #sett_app #dispImg{
          --r: 960 / 540;

  aspect-ratio: var(--r);
  height:min(90%, min(960px, 90vh*(var(--r))));

      width: 90%;

      text-align: center;
      justify-content: center;
      background: #000;
      color: white;
      border: darkgrey 2.5px solid;
      padding: 5px;
      border-radius: 5px;
  }


  #sett_app   .crt{
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

#sett_app h2, #sett_app h1, #sett_app p, #sett_app label, #sett_app span, .setting-label, .sidebar-tab, .usage-list{
    color: var(--color-text-primary);
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
            <label for="hotCorners" data-i18n="sensivity"></label>
        <input id="gestureThreshold" type="number">
  </div>

                      <div class="setting-row column">
                  <span class="setting-label"  data-i18n="screen_timeout"></span>
  <input type="range" min="0" value="1" max="30" step="1" id="screenTimeout">
                  </div>

          </div>

          <!-- Правий блок: зображення та select -->
          <div style="flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-start; width:auto;">

              <div id="dispImg">Sample Text</div>

              <div class="setting-row settright" style="margin-top:8px; padding:0;">
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
              <img src="../assets/mac_kbrd.png" alt="Keyboard layout" id='kbrd' style="width:100%; height:auto; transition: opacity 0.5s ease-in-out; opacity:1;">

              <div class="setting-row settright" style="margin-top:8px; padding:0;">
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

      // Опція за замовчуванням (якщо програму не вибрано)
      const defaultOption = document.createElement('option');
      defaultOption.value = 'openf'; 
      defaultOption.text = _('files');
      defaultOption.disabled = (ext == "pdf" && !navigator.pdfViewerEnabled) || (ext == 'application/xslt+xml' && !XSLTProcessor);
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
  const themeFiles = allFiles.filter(f => f.name.toLowerCase().endsWith(".theme") || f.name.toLowerCase().endsWith(".colors"));

  const parser = new ThemeParser(); 

  thmSelect.innerHTML = `<option value="none">Glass (Light)</option><option value="dark">Glass (Dark)</option>`;
  thmSelect.childNodes.forEach(chi=>{
      if (chi.value == "dark" && body.classList.contains("dark")) chi.selected = true;
  })
  themeFiles.forEach(f => {
      const el = document.createElement("option");
      el.value = f.name;

el.innerText = f.name.replace(/\.[^.]*$/, "");
      
      if (localStorage.getItem("theme") === f.name) {
          el.selected = true;
      }
      
      thmSelect.appendChild(el);
  });

  thmSelect.onchange = async () => {
      const selectedName = thmSelect.value;

      if (selectedName === "none") {
      if (body.classList.contains("dark")){
          body.classList.remove("dark");
      }else{
      
          localStorage.removeItem("theme");
          theme = null;
          loadTheme();
          const reboot = await confirm(_("confirm_set_theme"));
          if (reboot) safeShutdown({ restart: true });
          return;
      }
          
      }else if (selectedName == "dark"){
          if (!theme){
              body.classList.add("dark");
              localStorage.setItem("theme", "dark");
          }else{
              loadTheme();
const reboot = await confirm(_("confirm_set_theme"));
if (reboot) safeShutdown({ restart: true });
          }
          
      }

      const file = themeFiles.find(f => f.name === selectedName);
      if (!file) return;
body.classList.remove("dark");
      try {
          // Wrap FileReader in a Promise so we can await it
          const text = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(reader.error);
              reader.readAsText(file);
          });

          const thm = parser.parse(text,selectedName);

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
  li.innerHTML = `<b>${dev.name || dev.id || dev.productName}</b>${dev.type}`;
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

          kbrdImg.src = "assets/" + keyboardLayoutSelect.value + "_kbrd.png";

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
      localStorage.setItem("sleepModeTimeout", v * 60 * 1000);
      }
      const gt = document.getElementById('gestureThreshold');
      gt.value = gestureThreshold;
      gt.onchange = () =>{
        if (gt.value < 1 || gt.value.trim() == '') document.getElementById('gestureThreshold').value = 0;
        gestureThreshold = gt.value;
        
        localStorage.setItem('touchpadThreshold', gt.value);
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
  gt.disabled = !enableHotCorners;
  hotCornersEnbl.onchange = () => {
      
      enableHotCorners = hotCornersEnbl.checked;
      gt.disabled = !enableHotCorners;
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

          kbrdImg.src = "assets/" + keyboardLayoutSelect.value + "_kbrd.png";

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
  if (args) showPage(args);
  }});
  })

  let history = [];

  window.ActiveTerminals = {
      currentActiveId: null,
      instances: {},

      initHook: function(originalConsole) {
          const methods = ['log', 'warn', 'error', 'dir', 'table'];
          methods.forEach(method => {
              window.console[method] = (...args) => {
    if (
        args.length === 1 &&
        typeof args[0] === "object" &&
        JSON.stringify(args[0]) === "{}"
    ) {
        originalConsole.group("Empty object logged");
        originalConsole.trace();
        originalConsole.groupEnd();
    }

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
                  return `Command ${commandDisplayName} is trying to manipulate a directory, but no name provided before slash symbol.`;
              } 
              
              return `Command not found: ${commandDisplayName}.`;
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

    const cmdLog = document.createElement('div');
    cmdLog.style.color = '#aaa';
    cmdLog.innerHTML = termLbl + escapeHtml(val);
    
    const activeLine = out.querySelector('.term-active-line');
    if (activeLine) out.insertBefore(cmdLog, activeLine);

    window.ActiveTerminals.currentActiveId = uniqueTermId;

    try {
        // Огортаємо eval так, щоб він коректно розгортав Promise
        const runner = new Function('console', 'code', `
            return (async () => { 
                const res = eval(code);
                return res instanceof Promise ? await res : res;
            })()
        `);

        const r = await runner(terminalConsole, val);

        // Перевіряємо, чи повернулося реальне значення (і це не undefined чи null)
        if (r !== undefined && r !== null) {
            let outputText = "";

            if (r instanceof File || r instanceof Blob) {
                const fileMeta = {
                    "[Class]": r.constructor.name,
                    name: r.name || "Blob_Data",
                    size: (r.size / 1024).toFixed(2) + " KB",
                    type: r.type || "application/octet-stream",
                    lastModified: r.lastModified ? r.lastModified : "N/A"
                };
                outputText = JSON.stringify(fileMeta, null, 2);
            } else if (Array.isArray(r) && (r[0] instanceof File || r[0] instanceof Blob)) {
                const arrayMeta = r.map((f, idx) => ({
                    index: idx,
                    name: f.name,
                    size: f.size,
                    type: f.type,
                    lastModified: f.lastModified ? f.lastModified : "N/A"
                }));
                outputText = "Show as: array\nStorage: " + (typeof currentDisk !== 'undefined' ? currentDisk.name : 'N/A') +  "\n" + JSON.stringify(arrayMeta, null, 2);
            } else if (typeof apps !== 'undefined' && r === apps) {
                const cleanedAppsForLog = apps.map(app => {
                    if (app.icon && app.icon.startsWith("data:")) return { ...app, icon: "BASE64 image omitted" };
                    if (app.element) return { ...app, element: true };
                    if (app.system) return { ...app, path: 'RAM/*'};
                    return app; 
                });
                outputText = JSON.stringify(cleanedAppsForLog, null, 2);
            } else if (typeof r === 'object') {
                const jsonStr = JSON.stringify(r, (key, value) => {
                    if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`;
                    return value;
                }, 2);

                // Якщо це порожній об'єкт {}, НЕ виводимо його взагалі
                if (jsonStr !== '{}' && jsonStr !== '[]') {
                    outputText = jsonStr;
                }
            } else {
                outputText = (typeof r === 'string' && r.includes(' ') ? _(r) : String(r));
            }

            // Рендеримо результат ТІЛЬКИ якщо є текст і він не дорівнює "{}"
            if (outputText) {
                const res = document.createElement('div');
                res.style.color = '#fff';
                res.style.whiteSpace = 'pre-wrap';
                res.textContent = outputText;
                if (activeLine) out.insertBefore(res, activeLine);
            }
        }
    } catch(e) {
        console.error(e);
    }

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
      console.log(`Cloning into '${repoName}' (branch: ${branch})...`);
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
              window.dispatchEvent(new CustomEvent("update", {
  detail: {
    type: "devices",
    timestamp: Date.now()
  }
}));
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
    } else if (currentDisk.type == 'USB'){
      try{
      const targetPath = `${currentDisk.where}/${fileName}`;
      const url = `/api/delete?path=${encodeURIComponent(targetPath)}`;
    const response = await fetch(url, { method: 'POST' });
    const result = await response.json();

if (result.success) {
      console.log(`Файл ${fileName} успішно видалено!`);
      window.dispatchEvent(new CustomEvent("update", {
  detail: {
    type: "devices",
    timestamp: Date.now()
  }
}));
      return true;
    } else {
      console.error("Помилка видалення:", result.error);
      return false;
    }
  } catch (err) {
    console.error("Мережева помилка при видаленні:", err);
    return false;
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


function hideMenus(e){
    document.querySelectorAll(".menu").forEach(function(item){
  item.style.display="none";
  })
  if (e.target.id != "menubtn" && document.querySelector("#sysmenu") && e.target.className != "appmenu-category" ){
  document.querySelector("#sysmenu").style.display = "none";}
}


  document.addEventListener("click", (e) =>{
    hideMenus(e);
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
                      batContainer.classList.remove('blink')
                      lowBattWarned = false;
                  } else {
                      if (level <= 10) {
                          currentSvg = BATTERY_ICONS.empty;
                          strokeColor = 'red';
                          batContainer.classList.add('blink')
                          if (!lowBattWarned) {
                              new Notification(_("low_batt"), { body: _("low_batt_body") });
                          }
                          lowBattWarned = true;
                      } else if (level <= 25) {
                          currentSvg = BATTERY_ICONS.low;
                          batContainer.classList.remove('blink')
                          if (!lowBattWarned) {
                              new Notification(_("low_batt"), { body: _("low_batt_body") });
                          }
                          lowBattWarned = true;
                          strokeColor = 'red';
                      } else if (level <= 75) {
                          currentSvg = BATTERY_ICONS.half;
                          batContainer.classList.remove('blink')
                          lowBattWarned = false;
                      } else {
                          currentSvg = BATTERY_ICONS.full;
                          batContainer.classList.remove('blink')
                          lowBattWarned = false;
                      }
                      if (level == 100) strokeColor = 'lightgreen';
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
          updateSystemPopover(volContainer, Math.round(vol1) + "%\n"+devices.find(d=>d.type=='audioOutput' && d.name != 'Default').name, false, false);
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

function initGestures() {
  let accumulatedDeltaY = 0;
  let gestureTimeout = null;
  const targetItem = document;
  const THRESHOLD = gestureThreshold;

  targetItem.addEventListener('wheel', (e) => {
    if (classifyWheel(e) == 'mouse') return; // ignore real mouse wheels
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || !enableHotCorners) return;
    const el = document.querySelector('.winbox.focus');
    if (el && el.classList.contains('no-header')) return;

    // Accumulate the scroll delta
    accumulatedDeltaY += e.deltaY;

    clearTimeout(gestureTimeout);
    gestureTimeout = setTimeout(() => {
      accumulatedDeltaY = 0;
    }, THRESHOLD);

    // Two fingers UP swipe (Negative deltaY)
    if (accumulatedDeltaY <= -THRESHOLD) {
      accumulatedDeltaY = 0; 
      
      const minWindows = document.querySelectorAll('.winbox.min');
      
      // If the current window is minimized, or there's exactly one minimized window left out there
      if ((el && el.classList.contains('min')) || minWindows.length === 1) {
        const el1 = document.querySelector('.winbox.min');
        if (el1 && el1.winbox){
         el1.winbox.restore();
         el1.winbox.focus();
        }
      } 
      // Only maximize if we actually have an active, non-maximized focused window
      else if (el && el.winbox && !el.classList.contains('max') && !el.classList.contains('no-max')) {
        el.winbox.maximize();
      }
    } 
    // Two fingers DOWN swipe (Positive deltaY)
    else if (accumulatedDeltaY >= THRESHOLD) {
      accumulatedDeltaY = 0;
      
      // We can only minimize or restore an active focused window
      if (!el || !el.winbox) return; 
      
      if (el.classList.contains('max') && !el.classList.contains('no-max')) {
        el.winbox.restore();
      } else if (!el.classList.contains('min') && !el.classList.contains('no-min')) {
        el.winbox.minimize();
      }
    }
  }, { passive: true });
}

initGestures()



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

let metaShortcut = false;

window.addEventListener("keydown", e => {
    if (e.key !== "Meta" && e.metaKey) {
        metaShortcut = true;
    }
}, true);

window.addEventListener("keyup", e => {
    if (e.key === "Meta") {
        if (!metaShortcut) {
            openMenu();
        }
        metaShortcut = false;
    }
}, true);
  window.addEventListener('keydown', function(event) {
    if (event.key === INTERR_KEY) BOOT_INTERR = true;

    const blockEvent = () => {
        event.preventDefault();
        event.stopPropagation();
    };

    const isMac = typeof currentKeyboardLayout !== 'undefined' && currentKeyboardLayout === 'mac';
    const key = event.key;
    const code = event.code;
    const isMetaOrCtrl = event.metaKey || event.ctrlKey;

    // 1. App Launchers & System Overrides
    const isRun = isMac ? (event.metaKey && code === 'Space') : (event.metaKey && code === 'KeyR');

    if (event.metaKey && code === 'KeyE') {
        blockEvent();
        return openApp("files");
    }

    if (isRun) {
        blockEvent();
        return openApp("run");
    }

    if (event.ctrlKey && event.altKey && code === "KeyT") {
        blockEvent();
        return openApp('terminal');
    }

    // 2. Volume Controls (AudioVolumeDown/Up or F11/F10 on Mac)
    const isVolDown = key === (isMac ? 'F11' : 'AudioVolumeDown');
    const isVolUp   = key === (isMac ? 'F10' : 'AudioVolumeUp');

    if (isVolDown || isVolUp) {
        blockEvent();
        
        const currentVol = typeof getMasterVolume === 'function' ? getMasterVolume() : (window.vol || 0);
        const delta = isVolUp ? 5 : -5;
        const newPercent = Math.max(0, Math.min(100, Math.round(currentVol * 100) + delta));
        const targetVol = newPercent / 100;

        if (typeof setMasterVolume === 'function') {
            setMasterVolume(targetVol);
        } else {
            window.vol = targetVol;
        }
        return;
    }

    // 3. Block Help (F1) and Close Window (Ctrl+W / Cmd+W)
    if (key === 'F1' || (isMetaOrCtrl && code === 'KeyW')) {
        return blockEvent();
    }

    // 4. Alt+F4 Close Active WinBox
    if (event.altKey && key.toUpperCase() === 'F4') {
        blockEvent();
        document.querySelector('.winbox.focus')?.winbox?.close();
        return;
    }

    // 5. Browser Defaults Blacklist (Ctrl/Cmd + S, P, F)
    if (isMetaOrCtrl && ['KeyS', 'KeyP', 'KeyF'].includes(code)) {
        blockEvent();
    }
}, { capture: true });
  // Uncomment this when terminal can't be accessed.
  /*
  indexedDB.deleteDatabase(DB_NAME);
  localStorage.clear();
  */