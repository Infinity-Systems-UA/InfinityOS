setInterval(updateTime, 500);
const notify = document.getElementById('notify');
  let hasCustomWm = false;
  let currentStrings = {};
  let currentLang = 'en';
  let dateLang = "en-US";
  let currentKeyboardLayout = "win";
  let displayType = localStorage.getItem('config/dispType') || "lcd";
  let notificationAPI;
  let apps = [];
  let icons = [];
  window.wasm = {};
  let desktopIcons = JSON.parse(localStorage.getItem('desktopIcons')) || [];
  let BOOT = true;
  let BOOT_INTERR  = false;
  let CROSS_ORI = true;
  let INTERR_KEY = 'F9';
  let lastWheelTime = 0;
  let recentEvents = [];
  let HW_API = false;
  let clipboard = null;
  let INTERCEPT_ERRS = true;
const bootConfig = JSON.parse(localStorage.getItem("boot")) || {};
let enableTouchpadGestures = JSON.parse(localStorage.getItem("enableTouchpadGestures") )|| false;
let cleanOnBoot = bootConfig.clean ?? true; // Чистить пусті ключі диску конфігурацій при запуску.
let gestureThreshold = parseInt(localStorage.getItem('touchpadThreshold')) || 150;
let localeFormat = JSON.parse(localStorage.getItem("localeFormat")) || { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
let verboseBoot = bootConfig.verbose ?? true;
let checkAPIonBoot = bootConfig.check ?? true;



async function checkCrossOrigin() {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";

    try {
        document.body.appendChild(iframe);

        await new Promise((resolve, reject) => {
            iframe.onload = resolve;
            iframe.onerror = reject;
            iframe.src = "about:blank";
        });

        try {
            void iframe.contentWindow.document.documentElement;
            CROSS_ORI = true;
        } catch {
            CROSS_ORI = false;
        }
    } catch {
        CROSS_ORI = false;
    } finally {
        iframe.remove();
    }

    return CROSS_ORI;
}


const screenCaptUtils = {
        async capture() {
        const overlay = document.getElementById('flash-overlay');
        overlay.classList.remove('shot');
        void overlay.offsetWidth; // force reflow so the animation restarts if triggered twice quickly
        overlay.classList.add('shot');
        overlay.addEventListener('animationend', () => overlay.classList.remove('shot'), { once: true });

        let res;
        try {
            res = await fetch('/api/screenshot');
        } catch (err) {
            throw new Error(`Network failure: ${err.message}`);
        }

        if (!res || !res.ok) {
            const errText = res ? await res.text() : 'No response';
            throw new Error(`HTTP ${res ? res.status : 500}: ${errText}`);
        }

        return await res.blob();
    },


    async download(filename = 'screenshot.png') {
        const blob = await this.capture();
        const f = new File([blob], filename, { type: 'image/png', lastModified: Date.now() });
        fs.push(f);
        await saveFileToDB(f);
    }
};

function outputLog(message) {
    if (BOOT === true && verboseBoot === true) {
        log(message);
        return;
    }

    const isWarning = message.includes("<span style='color:yellow;'>");


    message = message
        .replace("<span style='color:yellow;'>", "")
        .replaceAll("<br>", "")
        .replace("</span>", "")
        .replaceAll('<br>','')
        .trim();

    if (isWarning) {
        console.warn(message);
    } else {
        console.log(message);
    }
}

function outputError(message){if(BOOT===true && verboseBoot === true)log(message);else{message=message.replace("<span style='color:red;'>","").replace("</span>","").replaceAll('<br>','').trim();console.error(message)}}
async function checkAPI() {
    let res;
    const outputHalt = () => {
        outputError(`
                <span style='color:red;'>
                    [FAIL] Hardware connectivity features are unavailable on this configuration.<br>
                    Screen capture isn't available.<br>
                    WLAN connections will remain untouched, but cannot be viewed or managed.<br>
                    Bluetooth is unavailable, including device discovery and BluetoothUtils.<br>
                    USB thumb storage is not supported.<br>
                    Printing service is not supported.
                </span>
            `);
            HW_API = false;
return outputLog("[INFO] You can turn off API check in Settings > General");
    }
try{
        res = await fetch("/api/");
if (!res.ok){
   return outputHalt();
}
 
    }catch{
           return outputHalt();
    }

    try {
        const data = await res.json();

        if (!data.routes) {
            throw new Error("Invalid API response");
        }

        HW_API = true;
        outputLog("[OK] /api/");

        // Routes that should never be actively tested.
        const skippedGET = new Set([
            "/api/screenshot"
        ]);

        const skippedPOST = new Set([
            "/api/wlan/disconnect",
            "/api/screenshot"
        ]);

        // GET routes
        for (const route of data.routes.GET || []) {
            if (skippedGET.has(route)) {
                outputLog(
                    `<span style='color:yellow;'>[SKIP] (GET) ${route} skipped (Unexpected changes may occur if evaluated)</span>`
                );
                continue;
            }

            try {
                const url =
                    route === "/api/read_binary"
                        ? `${route}?path=/dev/null`
                        : route;

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status || 404}`);
                }

                const contentType =
                    response.headers.get("content-type") || "";

                if (contentType.includes("application/json")) {
                    await response.json();
                } else {
                    await response.text();
                }

                if (route !== "/api/") {
                    outputLog(`[OK] (GET) ${route}`);
                }

            } catch (err) {
                outputError(
                    `<span style='color:red;'>[FAIL] (GET) ${route} — ${err.message}</span>`
                );
            }
        }

        // POST routes
        for (const route of data.routes.POST || []) {
            if (skippedPOST.has(route)) {
                outputLog(
                    `<span style='color:yellow;'>[SKIP] (POST) ${route} skipped (Unexpected changes may occur if evaluated)</span>`
                );
                continue;
            }

            try {
                const response = await fetch(route, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: "{}"
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status || 404}`);
                }

                outputLog(`[OK] (POST) ${route}`);

            } catch (err) {
                outputError(
                    `<span style='color:red;'>[FAIL] (POST) ${route} — ${err.message}</span>`
                );
            }
        
    }

    } catch (err) {
        HW_API = false;

        outputError(`
            <span style='color:red;'>
                [FAIL] /api/ — "not available on this device"
            </span>
        `);
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


const WlanUtils = {
  // 1. Get list of available Wi-Fi networks
  async list() {
    try {
      const res = await fetch('/api/wlan/list');
      if (!res) throw new Error('Network interface returned empty response');
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      
      const data = await res.json();
      if (data.success) {
        return data.networks;
      }
      console.error('No WLAN adapter found:', data.error);
      return [];
    } catch (err) {
      console.error('Incorrect WLAN interface provided');
      return Error('Incorrect WLAN interface provided');
    }
  },

  // 2. Connect to a network with password
  async connect(ssid, password = '') {
    const res = await fetch('/api/wlan/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ssid, password })
    });
    if (!res) return;
    
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.message;
  },

  // 3. Disconnect from active Wi-Fi
async disconnect() {
    const res = await fetch('/api/wlan/disconnect', {
        method: 'POST'
    });

    if (!res) return;

    const data = await res.json();

    if (!data.success) {
        throw new Error('Failed to disconnect Wi-Fi');
    }

    return data.message;
}
};

  const BluetoothUtils = {
    // 1. Get list of available & paired Bluetooth devices
    async list() {
      try {
        const res = await fetch('/api/bluetooth/list');
        if (!res) throw new Error('Bluetooth interface returned empty response');
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

        const data = await res.json();
        if (data.success) {
          return data.devices;
        }
        console.error('Bluetooth error:', data.error);
        return [];
      } catch (err) {
        console.error('Incorrect Bluetooth interface provided');
        return new Error('Incorrect Bluetooth interface provided');
      }
    },

    // 2. Scan for nearby devices
    async scan(timeoutSec = 5) {
      try {
        const res = await fetch('/api/bluetooth/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeout: timeoutSec })
        });
        if (!res) return;

        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.devices;
      } catch (err) {
        console.error('Bluetooth scan failed:', err);
        throw err;
      }
    },

    // 3. Connect to a device by MAC address
    async connect(mac) {
      const res = await fetch('/api/bluetooth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac })
      });
      if (!res) return;

      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.message;
    },

    // 4. Pair to a device by MAC address
    async pair(mac) {
      const res = await fetch('/api/bluetooth/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac })
      });
      if (!res) return;

      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.message;
    },

    // 5. Toggle adapter hardware power ("on" | "off")
    async power(state) {
      const isPoweredOn = state === true || state === 1 || state === 'on';
      const stateVal = isPoweredOn ? 'on' : 'off';

      const res = await fetch('/api/bluetooth/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: stateVal })
      });

      if (!res || !res.ok) {
        throw new Error(`HTTP Error ${res ? res.status : 'No response'}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to change power state');
      return data.state === true || data.state === 1 || data.state === 'on';
    },

    // 6. Disconnect active Bluetooth connection
    async disconnect(mac) {
      const bodyPayload = typeof mac === 'string' ? { mac } : {};

      const res = await fetch('/api/bluetooth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (!res) return;

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to disconnect Bluetooth device');
      }

      return data.message;
    },
    // 7. Get current power status ("on" | "off" or boolean)
get status() {
    return (async () => {
      try {
        const res = await fetch('/api/bluetooth/power', {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        if (!res || !res.ok) return false;
        const data = await res.json();
        return data.state === 'on' || data.state === true;
      } catch (err) {
        console.error('Failed to get Bluetooth status:', err);
        return false;
      }
    })();
  }
  };

function setDrawMode(e="cpu"){document.getElementById("body").classList.toggle("GPU_DRAW",e=="gpu")}function classifyWheel(e){const t=performance.now(),n=t-lastWheelTime;lastWheelTime=t,recentEvents.push(n),recentEvents.length>5&&recentEvents.shift();const o=Math.round(recentEvents.reduce((e,t)=>e+t,0)/recentEvents.length),a=window.devicePixelRatio||1,r=236.25/a-3,s=Math.round(Math.abs(Math.round(-3*e.deltaY)-Math.round(e.wheelDeltaY))),i=e.wheelDeltaY?s>r*(100/160):!1;return s>=r?"mouse":!i||o<50||s<r&&o<r?"trackpad":"unknown"}

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
    const printers = [];

    window.systemWorkers = []; 
    window.abortControllers = []
    window.systemObservers = [];

    let filesSettings = JSON.parse(localStorage.getItem("config/files")) || { "filesCols": [], "showHidden": true , "colorFolders":false, "showLS":true, "showSS": false, "showCK": false};
    let filesColorFolders = filesSettings.colorFolders;
    let filesCols = filesSettings.filesCols;
    let filesShowHidden = filesSettings.showHidden;
    let filesShowLS = filesSettings.showLS;
    let filesShowSS = filesSettings.showSS;
    let filesShowCK = filesSettings.showCK;

    let currentDisk = null;



function movePanelWidg(w1,w2){itemToMove=document.getElementById(w1);referenceItem=document.getElementById(w2);container=document.querySelector("#panel .right");container.moveBefore(itemToMove,referenceItem)}let fonts={active:"",installed:[]};const coreFonts=["serif","sans-serif","monospace","cursive","fantasy","system-ui","ui-serif","ui-sans-serif","ui-monospace","ui-rounded","math","emoji","fangsong"];window.updateFonts=function(action,fontName){try{if(action==="add"){if(!fonts.installed.includes(fontName))fonts.installed.push(fontName)}else if(action==="delete"){fonts.installed=fonts.installed.filter(f=>f!==fontName);if(fonts.active===fontName)fonts.active=""}else if(action==="set")fonts.active=fontName;localStorage.setItem("fonts",JSON.stringify(fonts));console.log("Fonts updated:",fonts)}catch(e){console.error(e.message)}setupFonts()};function getElementXPath(element){if(element.id!=="")return`//*[@id="${element.id}"]`;if(element===document.body)return"/html/body";let ix=0,siblings=element.parentNode.childNodes;for(let i=0;i<siblings.length;i++){let sibling=siblings[i];if(sibling===element)return getElementXPath(element.parentNode)+"/"+element.tagName.toLowerCase()+"["+(ix+1)+"]";if(sibling.nodeType===1&&sibling.tagName===element.tagName)ix++}}
    window.styles = '';



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

const getHostCssVariables = () => {
  const root = document.documentElement;
  const rootStyles = getComputedStyle(root);
  const variableNames = new Set();

  // 1. Collect custom properties from computed root styles.
  for (let i = 0; i < rootStyles.length; i++) {
    const name = rootStyles[i];
    if (name.startsWith("--")) {
      variableNames.add(name);
    }
  }

  // 2. Recursively discover variables in accessible stylesheets.
  const scanRules = (rules) => {
    for (const rule of rules) {
      if (rule.style) {
        for (let i = 0; i < rule.style.length; i++) {
          const name = rule.style[i];
          if (name.startsWith("--")) {
            variableNames.add(name);
          }
        }
      }

      // Handle @media, @supports, @layer, etc.
      if (rule.cssRules) {
        try {
          scanRules(rule.cssRules);
        } catch (e) {
          // Ignore inaccessible nested rules.
        }
      }
    }
  };

  for (const sheet of document.styleSheets) {
    try {
      scanRules(sheet.cssRules);
    } catch (e) {
      // Cross-origin stylesheet: CSSOM access is restricted.
    }
  }

  // 3. Export only variables that have computed values on :root.
  const result = [];

  for (const name of variableNames) {
    const value = rootStyles.getPropertyValue(name).trim();

    if (value) {
      result.push(`${name}: ${value};`);
    }
  }

  return result.join("\n");
};

    // --- СИНХРОННА ГЕНЕРАЦІЯ ШРИФТІВ І СТИЛІВ ---
      const generateCssContent = () => {
  const activeFont = fonts.active || "sans-serif";

let cssVariables = getHostCssVariables()

    let stylesText = `
        :root {
            --font: "${activeFont}", sans-serif;
${cssVariables}
        }
.use-app-font,.use-app-font::before,.use-app-font::after{font-family:var(--font)}.no-font,.no-font *{font-family:inherit!important}*{-webkit-tap-highlight-color:transparent}::selection{background-color:var(--color-selection,blue);color:var(--color-selection-text)!important;filter:invert(100%)}::-webkit-selection{background-color:var(--color-selection,blue)!important;color:var(--color-selection-text)!important}input[type="color"]{-webkit-appearance:none;-moz-appearance:none;appearance:none;background-color:transparent;cursor:pointer}input[type="color"]::-webkit-color-swatch-wrapper{padding:0}img,a{-webkit-touch-callout:none}
    `;  
    // console.log(cssVariables);
        // 1. Інжект активного системного шрифту
        if (window.currentFontBlobUrl) {
          stylesText = `
            @font-face {
              font-family: "${activeFont}";
              src: url("${window.currentFontBlobUrl}") format("truetype");
            }
          ` + stylesText;
        }

        // 2. Додаємо згенеровані динамічні шрифти з Infinity OS
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


    let wm;


function setMinProgress(data, id) {
    //console.log(JSON.stringify(data))
    const e=document.getElementById(id),w=e?(e.winbox||e._winbox):null;
const progress = ((data.position/ data.duration) * 100).toFixed(2);
            const gradient = `linear-gradient(to right, rgba(0, 128, 0, 0.5) 0%, rgba(0, 128, 0, 1.0) ${progress}%, transparent ${progress}%, transparent 100%)`;
            const combinedBackground = `${gradient}, var(--color-win-ina)`;
            if (!w) return;
            if (w.min){
            w.addClass("play")
            w.setBackground(combinedBackground);
        }else{
        
        w.removeClass("play");
        }
}

let runningApps = [];
function blur(id){const e=document.getElementById(id),w=e?(e.winbox||e._winbox):null;if(!w)throw Error("Window not found.");w.blur();console.log("Blur: "+id)}
function fore(id){const e=document.getElementById(id),w=e?(e.winbox||e._winbox):null;if(w){w.show(1);w.focus()}}
function setTitle(ttl,id){const e=document.getElementById(id),w=e?(e.winbox||e._winbox):null;if(w)w.setTitle(ttl)}
function winResize(id,x,y){const e=document.getElementById(id),w=e?(e.winbox||e._winbox):null;if(!w)return;w.width=x;w.height=y;w.resize();e.classList.add("no-resize","no-max")}
  function kill(id, type = "winbox") {
    console.log('Kill type: '+ type)
      if (type === "winbox") {
          const winboxElement = document.getElementById(id);
          const winboxInstance = winboxElement
              ? (winboxElement.winbox || winboxElement._winbox)
              : null;

            const fdRun = runningApps.find(a=>a.id == id)
          runningApps = runningApps.filter(item => item !== fdRun);

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
      else if (type == 'abortController'){
        const abortControllerEntry = window.abortControllers.find(c => window.abortControllers.indexOf(c) === Number(id));
        if (abortControllerEntry) abortControllerEntry.abort('Revoked by user');
      }

      else {
          console.error(`Unknown kill type: ${type}`);
      }
  }
  
  function detectMobile(){return!!(navigator.userAgentData?.mobile||window.matchMedia("(pointer: coarse)").matches)}
  
  function getArch() {
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
if (ua.architecture) return ua.architecture;
    if (
        detectMobile() ||
        ua.includes("arm") ||
        platform.includes("arm") 
    ) {
        return "arm";
    }
    
    if (
        ua.includes("arm64") ||
        ua.includes("aarch64") ||
        ua.includes("armv8") ||
        platform.includes("arm64")
    ) {
        return "arm64";
    }

    if (
        ua.includes("x86_64") ||
        ua.includes("x86-64") ||
        ua.includes("amd64") ||
        ua.includes("win64") ||
        platform.includes("x86_64")
    ) {
        return "x64";
    }

    if (
        ua.includes("i686") ||
        ua.includes("i386") ||
        ua.includes("i486") ||
        ua.includes("i586") ||
        ua.includes("i686") ||
        platform.includes("x86")
    ) {
        return "x86";
    }

    return "unknown";
}

/**
 * Detects the monitor's refresh rate (Hz).
 * @returns {Promise<number>} Resolves with the estimated refresh rate (e.g., 60, 120, 144).
 */
async function getScreenRefreshRate(fix=true) {
    return new Promise((resolve) => {
        const frameTimes = [];

        function checkFrame(timestamp) {
            frameTimes.push(timestamp);

            // Collect 60 frames for a more stable measurement
            if (frameTimes.length < 60) {
                requestAnimationFrame(checkFrame);
            } else {
                const totalDuration =
                    frameTimes[frameTimes.length - 1] - frameTimes[0];

                const averageFrameTime =
                    totalDuration / (frameTimes.length - 1);

                const calculatedHz = 1000 / averageFrameTime;

                // Common refresh rates
                if (!fix) return calculatedHz;
                const standardRates = [
                    30, 60, 75, 90, 120, 144, 165, 180, 240, 360
                ];

                // Select the nearest standard refresh rate
                const nearestRate = standardRates.reduce((nearest, rate) =>
                    Math.abs(rate - calculatedHz) <
                    Math.abs(nearest - calculatedHz)
                        ? rate
                        : nearest
                );

                resolve(nearestRate);
            }
        }

        requestAnimationFrame(checkFrame);
    });
}

    
  let ableToUseUSB = true;




    async function buildDevProps() {

  let deviceIcon;

if (detectMobile()) {
    deviceIcon = "assets/mobile.svg";
} else if (
    navigator.maxTouchPoints > 0 ||
    matchMedia("(any-pointer: coarse)").matches
) {
    deviceIcon = "assets/laptop.svg";
} else {
    deviceIcon = "assets/pc.svg";
}

      const devProps = {
        model: '',
        res: screen.width+"×"+screen.height,
        refreshRate: await getScreenRefreshRate(),
        chip: '', // Clean placeholder format
        memory: navigator.deviceMemory ? navigator.deviceMemory + " GB" : '',
        os: {
          name: "Infinity OS",
          version: "01112026" 
        },
        deviceIcon: deviceIcon
      };


const scr = {};
let proto = screen;

while (proto) {
    for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === "constructor" || Object.hasOwn(scr, key)) continue;

        try {
            const value = screen[key];

            if (
                typeof value === "string" ||
                typeof value === "number" ||
                typeof value === "boolean"
            ) {
                scr[key] = value;
            }
        } catch {}
    }

    proto = Object.getPrototypeOf(proto);
}

scr.type = "screen";
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
      if (ableToUseUSB && HW_API){
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
    }}
  }

  // Події-хендлери
  function onUsbPluggedIn(drive) {
    const driveTitle = `${drive.vendor || ""} ${drive.model || ""}`.trim() || drive.name || "USB Drive";
    document.getElementById('usbTray').style.display = 'block';
    document.getElementById('usbTray').onclick = async ()=>{
        await mountDrive(driveTitle)
        openApp('files')
    }
    
    new Notification(_("device_connected"), {
        icon: icns.usbDrive,
      body: driveTitle,
      sound: sounds.deviceIn,
      silent: false
    });
  }

  function onUsbPluggedOut(drive) {
    document.getElementById('usbTray').style.display = 'none';

    const driveTitle = `${drive.vendor || ""} ${drive.model || ""}`.trim() || drive.name || "USB Drive";
    new Notification(_("device_disconnected"), {
        icon: icns.usbDrive,
      body: driveTitle,
      sound: sounds.deviceOut,
      silent: false
    });

    // Перевіряємо за системним іменем накопичувача (наприклад 'sdb' або 'sdb1')
    if (currentDisk && (currentDisk.part_name === drive.part_name || currentDisk.name === drive.name)) {
      unmountDrive(driveTitle);
    }
  }
  // Запускаємо перевірку кожні 2 секунди
  setInterval(checkUsbStatus, 2000);


// Printers
let previousPrinters = [];


async function checkPrinterStatus() {
    if (!HW_API) return;

    try {
        const res = await fetch('/api/printers');
        const data = await res.json();

        

        const currentPrinters = (data.printers || []).map(name => ({
            name: name
        }));

        // 1. Detect newly connected / available printers
        for (const printer of currentPrinters) {
            const exists = previousPrinters.some(
                p => p.name === printer.name
            );

            if (!exists) {
                onPrinterConnected(printer);

                window.dispatchEvent(new CustomEvent("update", {
                    detail: {
                        type: "devices",
                        timestamp: Date.now()
                    }
                }));
            }
        }

        // 2. Detect disconnected / unavailable printers
        for (const prevPrinter of previousPrinters) {
            const exists = currentPrinters.some(
                p => p.name === prevPrinter.name
            );

            if (!exists) {
                onPrinterDisconnected(prevPrinter);

                window.dispatchEvent(new CustomEvent("update", {
                    detail: {
                        type: "devices",
                        timestamp: Date.now()
                    }
                }));
            }
        }

        // 3. Save current printer list
        previousPrinters = currentPrinters;

    } catch (err) {
        console.error("Failed to check printer status:", err);
    }
}

// Printer connected handler
window.onPrinterConnected = (printer)=> {
    const printerName = printer.name || "Printer";
    printer.type = 'printer';
    printers.push(printer)
    new Notification(_("device_connected"), {
        icon: icns.printer,
        body: printerName,
        sound: sounds.deviceIn,
        silent: false
    });
}

// Printer disconnected handler
window.onPrinterDisconnected = (printer)=> {
    const printerName = printer.name || "Printer";
    printers = printers.filter(p=> p.name!=printer.name);
    new Notification(_("device_disconnected"), {
        icon: icns.printer,
        body: printerName,
        sound: sounds.deviceOut,
        silent: false
    });
}

// Check every 2 seconds
setInterval(checkPrinterStatus, 2000);


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
            devProps.model = ua.model || '';
          }else{
            if (HW_API){
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
          }


          
          const bitness = ua.bitness ? `${ua.bitness}-bit` : "";
          const cores = navigator.hardwareConcurrency ? `(${navigator.hardwareConcurrency} Cores)` : "";
          
          devProps.chip = `${getArch()} ${bitness} ${cores}`.replace(/\s+/g, ' ').trim();

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

let gpu = renderer;

if (renderer.startsWith("ANGLE")) {
    const parts = renderer.match(/^ANGLE\s*\((.*)\)$/)?.[1]?.split(",") || [];
    gpu = parts[1] || parts[0] || renderer;
}

devProps.gpu = gpu
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(Mesa|Microsoft)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

      } catch {
        devProps.gpu = '';
      }

      return devProps;
    }
    
    const iconsSet = JSON.parse(localStorage.getItem("config/icons") ?? "{}")
    

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
        json: 'icons/json.svg',
        font: "icons/font.svg",
        empty: "icons/application-blank.svg",
        binary: "icons/application-binary.svg",
        userFile: "icons/user-file.svg",
        graphFile: "icons/graph-file.svg",
        printerFile: "icons/printer-file.svg",
        folder: "icons/folder.svg",
        printer: "icons/printer.svg",
        // Group 3: Dialogs icons (medium in dialogs windows, small in title bars)
        dialogInfo: 'icons/dialog-info.svg',
        dialogQues: 'icons/dialog-ques.svg',
        dialogErr: 'icons/dialog-err.svg',
        dialogWarn: 'icons/dialog-warn.svg',
        // Group 4: Drive icons (medium in Files app sidebar, big in 'Get Info')
        lsDrive: 'icons/drive-ls.svg',
        dbDrive: 'icons/drive-idb.svg',
        usbDrive: 'icons/drive-usb.svg',
        cacheDrive: 'icons/drive-cache.svg',
    };
    
    if (iconsSet) {
    Object.keys(window.icns).forEach((i) => {
        if (iconsSet[i]) window.icns[i] = iconsSet[i];
    });
}
    
    window.sounds = {
    error: new Audio("sounds/error.mp3"),
    startup: new Audio("sounds/login.ogg"),
    info: new Audio("sounds/info.mp3"),
    question: new Audio("sounds/ques.mp3"),
    warn: new Audio(""),
    deviceIn: new Audio("sounds/in.mp3"),
    deviceOut: new Audio("sounds/out.mp3"),
    notify: new Audio("sounds/info.mp3"),
    logout: new Audio(""),
    
    async play(aud, vol = 1) {
        let audio;
        let objectUrl = null;
        console.log(aud);
        if (aud instanceof Blob) {
            objectUrl = URL.createObjectURL(aud);
            audio = new Audio(objectUrl);
        }
        
        else if (
            typeof aud === "string" &&
            aud.startsWith("data:audio")
        ) {
            audio = new Audio(aud);
        }
        
        else if (typeof aud === "string") {
            const source = this[aud];
            
            if (!(source instanceof HTMLAudioElement)) {
                console.error(`Sound "${aud}" not found.`);
                return;
            }
            
            // Create a completely independent player
            audio = new Audio(source.src);
        }
        
        else {
            console.error("Unknown sound type.");
            return;
        }
        
        audio.volume = vol;
        
        return new Promise((resolve) => {
            let finished = false;
            
            const done = () => {
                if (finished) return;
                finished = true;
                
                audio.onended = null;
                audio.onerror = null;
                
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
    
    let devProps;
    let maxLS, maxSS, maxCK, maxCCH;

    async function safeShutdown({ restart = false } = {}) {
        console.log("Infinity OS: safe shutdown started");
        getAbortCtrls().forEach(abortCtrl => abortCtrl.abort('System power off'))

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
    if (winColor == null || winColor === "") return null;

    const value = String(winColor).trim();

    // KDE RGB: "19 24 32" or "19,24,32"
    const parts = value.split(/[,\s]+/).filter(Boolean);

    if (
        parts.length === 3 &&
        parts.every(p => /^\d+$/.test(p))
    ) {
        const rgb = parts.map(Number);

        if (rgb.every(n => n >= 0 && n <= 255)) {
            return `rgb(${rgb.join(", ")})`;
        }

        return null;
    }

    // Hex colors: #RGB or #RRGGBB
    if (/^#[\da-f]{3}([\da-f]{3})?$/i.test(value)) {
        return value;
    }

    // Preserve other CSS color formats, such as rgba() and named colors
    return value;
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
    const general   = data["[general]"] || {};
    const header    = data["[colors:header]"] || {};
    const window    = data["[colors:window]"] || {};
    const button    = data["[colors:button]"] || {};
    const selection = data["[colors:selection]"] || {};
    const view      = data["[colors:view]"] || {};
    const tooltip   = data["[colors:tooltip]"] || {};
    const complementary = data["[colors:complementary]"] || {};
    const wm        = data["[wm]"] || {};

    const color = (value, fallback = null) =>
        this.colorToCSS(value) || fallback;

    const pick = (...values) =>
        values.map(v => this.colorToCSS(v)).find(Boolean) || null;

    const activeTitle = pick(
        header.BackgroundNormal,
        wm.activeBackground,
        wm.activebackground
    ) || "#31363b";

    const inactiveTitle = pick(
        header.BackgroundInactive,
        wm.inactiveBackground,
        wm.inactivebackground
    ) || "#2a2e32";

    const windowBg = color(window.BackgroundNormal, "#eff0f1");
    const windowAlt = color(window.BackgroundAlternate, windowBg);
    const windowText = color(window.ForegroundNormal, "#31363b");
    const windowInactiveText = color(window.ForegroundInactive, windowText);
    const windowActiveText = color(window.ForegroundActive, windowText);

    const viewBg = color(view.BackgroundNormal, windowBg);
    const viewAlt = color(view.BackgroundAlternate, windowAlt);
    const viewText = color(view.ForegroundNormal, windowText);
    const viewInactiveText = color(view.ForegroundInactive, viewText);
    const viewActiveText = color(view.ForegroundActive, viewText);

    const highlight = color(selection.BackgroundNormal, "#3daee9");
    const highlightAlt = color(selection.BackgroundAlternate, highlight);
    const highlightText = color(selection.ForegroundNormal, "#ffffff");

    const buttonFace = color(button.BackgroundNormal, "#e3e5e7");
    const buttonAlt = color(button.BackgroundAlternate, buttonFace);
    const buttonText = color(button.ForegroundNormal, "#31363b");
    const buttonInactiveText = color(button.ForegroundInactive, buttonText);
    const buttonHover = color(button.DecorationHover, highlight);
    const buttonFocus = color(button.DecorationFocus, buttonHover);

    const link = color(view.ForegroundLink, highlight);
    const visited = color(view.ForegroundVisited, link);

    const negative = color(view.ForegroundNegative, "#da4453");
    const neutral = color(view.ForegroundNeutral, "#fdbc4b");
    const positive = color(view.ForegroundPositive, "#27ae60");

    const infoBg = color(tooltip.BackgroundNormal, viewBg);
    const infoText = color(tooltip.ForegroundNormal, viewText);
    const infoAlt = color(tooltip.BackgroundAlternate, infoBg);

    const compBg = color(complementary.BackgroundNormal, "#232629");
    const compAlt = color(complementary.BackgroundAlternate, compBg);
    const compText = color(complementary.ForegroundNormal, "#eff0f1");

    const md = 6;
    const sm = 4;
    const lg = 12;
    const pill = 26;
    const full = 56;

    // Parse raw KDE RGB for luminance, supporting commas or spaces.
    const raw = String(window.BackgroundNormal || "239 240 241").trim();
    const rgbParts = raw.split(/[,\s]+/).filter(Boolean);
    const rgb = rgbParts.map(Number);

    let dark = false;

    if (
        rgb.length === 3 &&
        rgb.every(n => Number.isFinite(n) && n >= 0 && n <= 255)
    ) {
        const lum =
            0.2126 * rgb[0] +
            0.7152 * rgb[1] +
            0.0722 * rgb[2];

        dark = lum < 128;
    }

    const secondaryText = dark
        ? "rgba(255,255,255,.7)"
        : "rgba(0,0,0,.7)";

    const tertiaryText = dark
        ? "rgba(255,255,255,.5)"
        : "rgba(0,0,0,.5)";

    const border = dark
        ? "rgba(255,255,255,.14)"
        : "rgba(0,0,0,.16)";

    const shadow = "rgba(0,0,0,.15)";
    const darkShadow = "rgba(0,0,0,.3)";

    document.body.style.backgroundColor = windowBg;

    const colors = {
        // Window title bars
        "--color-win-act": activeTitle,
        "--color-win-ina": inactiveTitle,
        "--color-win-act-text": color(header.ForegroundActive, windowText),
        "--color-win-ina-text": color(header.ForegroundInactive, windowInactiveText),

        // Accent and selection
        "--accent-color": highlight,
        "--accent-hover": buttonHover,
        "--accent-focus": buttonFocus,
        "--color-selection": highlight,
        "--color-selection-alt": highlightAlt,
        "--color-selection-text": highlightText,

        // Main backgrounds
        "--bg-color": windowBg,
        "--bg-body": windowBg,
        "--bg-window": windowBg,
        "--bg-window-alt": windowAlt,
        "--bg-panel": buttonFace,
        "--bg-panel-alt": buttonAlt,
        "--bg-menu": viewBg,
        "--bg-menu-alt": viewAlt,
        "--bg-view": viewBg,
        "--bg-view-alt": viewAlt,
        "--bg-tooltip": infoBg,
        "--bg-complementary": compBg,
        "--bg-complementary-alt": compAlt,

        // Text
        "--color-text-primary": windowText,
        "--color-text-secondary": secondaryText,
        "--color-text-tretiary": tertiaryText,
        "--color-text-tertiary": tertiaryText,
        "--color-text-inactive": windowInactiveText,
        "--color-text-active": windowActiveText,
        "--color-view-text": viewText,
        "--color-view-text-inactive": viewInactiveText,
        "--color-view-text-active": viewActiveText,
        "--color-button-text": buttonText,
        "--color-button-text-inactive": buttonInactiveText,
        "--color-complementary-text": compText,

        // Links and status colors
        "--color-link": link,
        "--color-link-visited": visited,
        "--color-positive": positive,
        "--color-neutral": neutral,
        "--color-negative": negative,
        "--color-success": positive,
        "--color-warning": neutral,
        "--color-error": negative,

        // Buttons
        "--toolbar-bg": buttonFace,
        "--button-bg": buttonFace,
        "--button-bg-alt": buttonAlt,
        "--button-text": buttonText,
        "--button-light": buttonHover,
        "--button-focus": buttonFocus,
        "--button-hilight": highlight,
        "--button-shadow": shadow,
        "--button-dk-shadow": darkShadow,
        "--button-act-bg": buttonHover,
        "--button-border": border,
        "--button-act-border": highlight,

        // Borders and separators
        "--color-border": border,
        "--color-border-subtle": dark
            ? "rgba(255,255,255,.08)"
            : "rgba(0,0,0,.08)",
        "--color-border-strong": dark
            ? "rgba(255,255,255,.25)"
            : "rgba(0,0,0,.25)",
        "--color-separator": border,
        "--color-focus": buttonFocus,
        "--color-hover": buttonHover,

        // Inputs
        "--input-bg": viewBg,
        "--color-input-bg": viewBg,
        "--input-text": viewText,
        "--input-border": border,
        "--input-focus": buttonFocus,
        "--input-placeholder": tertiaryText,

        // Tooltip / information popup
        "--info-bg": infoBg,
        "--info-bg-alt": infoAlt,
        "--info-text": infoText,

        // Scrollbars
        "--scrollbar-track": "transparent",
        "--scrollbar-thumb": dark
            ? "rgba(255,255,255,.18)"
            : "rgba(0,0,0,.22)",
        "--scrollbar-thumb-hover": dark
            ? "rgba(255,255,255,.3)"
            : "rgba(0,0,0,.35)",

        // Effects
        "--blur": "none",
        "--shadow-sm": "0 1px 2px rgba(0,0,0,.12)",
        "--shadow-md": "0 3px 8px rgba(0,0,0,.18)",
        "--shadow-lg": "0 8px 24px rgba(0,0,0,.24)",

        // Radii
        "--radius-sm": sm + "px",
        "--radius-md": md + "px",
        "--radius-lg": lg + "px",
        "--radius-pill": pill + "px",
        "--radius-full": full + "px",

        // Window control buttons
        "--color-win-btn-close": "rgba(218,68,83,.8)",
        "--color-win-btn-close-hover": "#da4453",
        "--color-win-btn-minimize": neutral,
        "--color-win-btn-maximize": positive,
    };

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

let transformListenersAttached = false;

function applyThemeToUI(name) {
    const safeName = name.replace(/[^\x20-\x7EА-яЁёІіЇїЄє]/g, "").trim();
    const themeClasses = safeName.split(/\s+/).filter(Boolean);

    if (document.getElementById("panel")) document.getElementById("panel").className = safeName;
    if (document.getElementById("sysmenu")) document.getElementById("sysmenu").className = safeName;

    // Reset body theme classes properly
    document.body.className = safeName;

    Array.from(document.getElementsByClassName("menu")).forEach(e => {
        e.className = "menu " + safeName;
    });

           setPanelConfig(JSON.parse(localStorage.getItem("panelConf")) || {});

    // Attach listeners once globally
    if (hideWinContentOnTransform && !transformListenersAttached) {
        transformListenersAttached = true;
        let activeBox = null;

        window.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.wb-control, .min')) return;

            const header = e.target.closest('.winbox .wb-header');
            const resizeEdge = e.target.closest([
                '.winbox .wb-n', '.winbox .wb-e', 
                '.winbox .wb-s', '.winbox .wb-w',
                '.winbox .wb-nw', '.winbox .wb-ne', 
                '.winbox .wb-sw', '.winbox .wb-se'
            ].join(','));

            if (!header && !resizeEdge) return;

            const targetElement = header || resizeEdge;
            activeBox = targetElement.closest('.winbox');
            if (!activeBox) return;

            activeBox.classList.add('is-cont-hidden');
        });

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


        const allElements = [targetElement, ...targetElement.querySelectorAll("*:not(script):not(noscript):not(style):not([id*='tout-']):not(.ansi-output):not(.ansi-output *)")];

        allElements.forEach(element => {


            Array.from(element.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "")
                .forEach(textNode => {


console.log(searchPattern+" -> "+replacementString + " (at "+ (targetElement.id || targetElement.tagName)+")")
                    if (typeof searchPattern === 'string') {

                        textNode.textContent = textNode.textContent.replaceAll(searchPattern, replacementString);
                    } else if (searchPattern instanceof RegExp) {

                        const globalPattern = new RegExp(searchPattern, searchPattern.flags.includes('g') ? searchPattern.flags : searchPattern.flags + 'g');
                        textNode.textContent = textNode.textContent.replace(globalPattern, replacementString);
                    }
                });
        });
    }
    let tbConfig = {};

function setPanelConfig(config) {
    // merge first, so every read below sees the full config
    tbConfig = { ...tbConfig, ...config };

    const panel = document.getElementById('panel');
    if (panel) {
        if (apps.filter(a => a.system == false).length == 0) {
            document.getElementById("appmenu-list-sys").open = true;
        } else {
            document.getElementById("appmenu-list-user").open = true;
        }

        if (tbConfig.pos) {
            const isTop = tbConfig.pos === 'top';
            panel.style.top = isTop ? '0' : 'auto';
            panel.style.bottom = isTop ? 'auto' : '0';
            document.body.classList.toggle('panel-at-top', isTop);
        }

        document.getElementById('showDesktopZone')
            .classList.toggle('disabled', !tbConfig.showPeekZone);

        if (tbConfig.size) {
            document.documentElement.style.setProperty('--panel-height', tbConfig.size + 'px');
        }
    }

    localStorage.setItem('panelConf', JSON.stringify(tbConfig));
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
        'csv':  { mime: 'text/csv', icon: icns.textCsv },
        'theme':{ mime: 'application/x-theme', icon: icns.ms_theme },
        'svg':  { mime: 'image/svg+xml', icon: icns.imageGeneric }, // Has resolution avaliable as Group 2 types.
        'docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', icon: icns.textRich },
        'xslt': { mime: 'application/xslt+xml', icon: icns.textHtml},
        'colors': {mime: 'application/x-kde-palette', icon: icns.ms_theme},
        'vcf': {mime: 'text/vcard', icon: icns.userFile},
        'json': {mime:"application/json", icon: icns.json},
        'gml': {mime:"text/vnd.gml", icon: icns.graphFile},
        'ppd': {mime:"application/vnd.cups-ppd", icon: icns.printerFile},
        'dd': {mime:"text/x-doldoc", icon: icns.textRich},

    // Group 2: viewable, but not editable. Resolution is available in 'Get Info'
        'jpg':  { mime: 'image/jpeg', icon: icns.imageGeneric },
        'jpeg': { mime: 'image/jpeg', icon: icns.imageGeneric },
        'png':  { mime: 'image/png', icon: icns.imageGeneric },
        'gif':  { mime: 'image/gif', icon: icns.imageGeneric },

        'webp': { mime: 'image/webp', icon: icns.imageGeneric },
        'avif': { mime: 'image/avif', icon: icns.imageGeneric },
        'apng': { mime: 'image/apng', icon: icns.imageGeneric },
        
        'wasm': { mime: 'application/wasm', icon: icns.binary}, // Doesn't have resolution

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

    async function getMasterVolume() {
        // body...

    const res = await fetch('/api/volume');
    const data = await res.json();

    if (!data.success) {
        throw new Error(data.error);
    }

    return data;

    }

        const installedpkg = new Set();

    function getFileTypes(){return FILE_TYPES;}
    function getUrlAssoc(){return URL_ASSOC;}
    function getKbrdShortcutsLayout(){return currentKeyboardLayout;}
    function getNotification(){return notificationAPI;}
    function getCurrLang(){return currentLang;}
    function getCurrDisk(){return currentDisk;}
    function getCurrDateLang(){return dateLang;}
    function getDevProps(){return devProps;}
    function getPerms(){return permissions;}
    function getDB(){return DB_NAME;}
    function getFs(){return fs;}
    function getIcns(){return icns;}
    function getFonts(){return fonts;}
    function getWM(){return wm;}
    function getWBtheme(){return wbtheme;}
    function getUpTime(){return Date.now()-lastBoot;}
    function getSysWorkers(){return window.systemWorkers;}
    function getMutObsrvs(){return window.systemObservers;}
    function getAbortCtrls(){return window.abortControllers;}
    function getPwrMan(){return PowerManager;}
    function getWlanUtils(){return WlanUtils;}
    function getBTUtils(){return BluetoothUtils;}
    function getScreenCaptUtils(){return BluetoothUtils;}
    function getDesktopIcons(){return desktopIcons;}
    function getWorker(){return window.Worker;}
    function getWASM(){return window.wasm;}

function setTrayIcon(id, show, state){
    const e = document.getElementById(id);
    if (!e) return console.error('Tray icon not found: '+id);

}
  function chKbrdLayout(layout) {
      const runSpan = document.querySelector("#deskM li:nth-child(3) span");
      const scrSpan = document.querySelector("#deskM li:nth-child(4) span");
      const revealDeskSpan = document.querySelector("#deskM li:nth-child(5) span");

      if (layout === "win") {
          replaceTextInElements("⌘", "CTRL");
          replaceTextInElements("⌥", "ALT");
          
          // Target specifically the RUN shortcut for Windows
          if (runSpan) runSpan.textContent = "WIN+R";
          if (scrSpan) scrSpan.textContent = "PrtScn";
          if (revealDeskSpan) revealDeskSpan.textContent = 'WIN+D';


          currentKeyboardLayout = 'win';
      } else {
          replaceTextInElements("CTRL", "⌘");
          replaceTextInElements("ALT", "⌥");

          // Restore Spotlight shortcut for macOS
          if (runSpan) runSpan.textContent = "⌘+Space";
          if (scrSpan) scrSpan.textContent = "⌘+⇧+3";
          if (revealDeskSpan) revealDeskSpan.textContent = '⌘+F3';

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



          document.getElementById("delete_item_btn").addEventListener("click",async (e) => {
        e.stopPropagation();
        hideMenus(e)
                  const elementToDelete = obj;
            const targetName = elementToDelete.getAttribute('name'); 
        if (await confirm(_('prompt_delete').replace('{file}', targetName))){
        if (obj && obj.parentNode) {
            // Save references before we destroy/nullify them


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
      }
    });


          document.getElementById("open_item_btn").addEventListener("click",async (e) => {
        e.stopPropagation();
        hideMenus(e)
                  obj.onclick()
            
    });

    document.getElementById("rename_item_btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        hideMenus(e)
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
            hideMenus(e)
        });

    function makeShortcut(){
      new wm('core.createDesktopAlias', {
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

<div id="setup-app" style="display:flex; flex-direction:row; gap:5px; align-items:center;">
    <label style="min-width:60px; flex-shrink:0;">${_('app')}:</label>

    <select id="apps" style="min-width:120px; width:150px; box-sizing:border-box;">
        <option value="" disabled selected hidden></option>
    </select>
</div>
    

      <!-- Action Buttons (Standard block alignment instead of absolute overlapping) -->
      <div >
        <button id="save1" class='ok' style="padding: 4px 12px;" disabled>${_('ok')}</button>
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
        if (fileIns) {$('#save1').disabled = false;
      $('#name').value = fileIns.name.split('/').pop();
    }

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

          addIcon(($('#name').value.trim() == '' ? nm : $('#name').value.trim()), ic, ev, {isShortcut: !!fileIns});
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


desktopApps.addEventListener('dragover', (e) => {
    e.preventDefault();

    const draggingItem = document.querySelector('.dragging');
    if (!draggingItem) return;

    const siblings = Array.from(
        desktopApps.querySelectorAll('.appIcon:not(.dragging)')
    );

    const nextSibling = siblings.find(sibling => {
        const box = sibling.getBoundingClientRect();

        return (
            e.clientX < box.left + box.width / 2 &&
            e.clientY < box.top + box.height / 2
        );
    });

    // Never insert anything before the required Files icon
    if (nextSibling && !nextSibling.classList.contains('required')) {
        desktopApps.insertBefore(draggingItem, nextSibling);
    }
});

// Function to update desktopIcons based on DOM order and save to localStorage
function saveIconOrder() {
    const desktopContainer = document.getElementById("desktopApps") || document.body;
    const iconElements = Array.from(desktopContainer.children);

    // Rebuild desktopIcons array in the new DOM order
    desktopIcons = iconElements.map((el, index) => {
        const matchingIcon = icons.find(item => item.element === el);
        if (!matchingIcon) return null;
if (matchingIcon.name === 'files') return null;

        // Preserve matching item structure (nameApp or nameFile)
        let iconData = desktopIcons.find(item => item.name === matchingIcon.name) || {};
        console.log(iconData)
        return {
            id: index,
            name: matchingIcon.name,
            ...(iconData.nameApp ? { nameApp: iconData.nameApp } : {}),
            ...(iconData.nameFile ? { nameFile: iconData.nameFile } : {})
        };
    }).filter(Boolean);

    localStorage.setItem('desktopIcons', JSON.stringify(desktopIcons));
}

function addIcon(nameKey, iconUrl, onclickLogic, { isRequiredIcon = false, isShortcut = false } = {}) {

    const desktopApps = document.getElementById("desktopApps") || document.body;

    const appContainer = document.createElement('div');

    appContainer.className = 'appIcon' + (isRequiredIcon ? ' required' : '') + (isShortcut ? ' shortcut' : '');
    appContainer.setAttribute('name', _(nameKey));

    const shortcutArrow = isShortcut ? `
        <span class="shortcut-arrow" aria-hidden="true">
            <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 8 L8 2 M4 2 H8 V6" fill="none" stroke="#1a73e8"
                      stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </span>` : '';

    appContainer.innerHTML = `
        <span class="icon-wrap">
            <img src="${iconUrl}" style="height: 32px;" draggable="false">
            ${shortcutArrow}
        </span>
        <p data-i18n="${nameKey}" style="margin: 0px; color: #fff; text-shadow: 1px 1px 1px rgba(0,0,0,0.5);">${_(nameKey)}</p>

        <div class="notification-badge"
             aria-hidden="true"
             style="display: none;"></div>
    `;

    // Badge starts completely empty
    const badge = appContainer.querySelector('.notification-badge');
    badge.removeAttribute('name');
    badge.textContent = '';

    // Context menu logic
    appContainer.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();

        obj = appContainer;
        document.querySelectorAll(".menu").forEach(i => i.style.display = "none");

        const itemM = document.getElementById("itemM");
        const xtraM = document.getElementById('extra_shortcuts');

        if (isRequiredIcon) {
            itemM.querySelector('#delete_item_btn').classList.add('disabled');
            itemM.querySelector('#rename_item_btn').classList.add('disabled');
        } else {
            itemM.querySelector('#delete_item_btn').classList.remove('disabled');
            itemM.querySelector('#rename_item_btn').classList.remove('disabled');
        }
const ap05 = apps.find(a => a.name == nameKey);
        const sh12 = ap05?.shortcuts;

xtraM.replaceChildren();

const valid = (sh12 || []).filter(sh =>
    typeof sh.url === 'string' &&
    (sh.url.startsWith('?') || sh.url.startsWith('/?') || sh.url.startsWith('./?') || /^https?:\/\//i.test(sh.url))
);

if (valid.length) {
    const hr = document.createElement('hr');
    hr.style.cssText = 'margin:3px 0;border-color:#ffffff33;';
    xtraM.append(hr);

    valid.forEach(sh => {
        const li = document.createElement('li');
        if (sh?.icons?.[0]){
            const ima = document.createElement('img');
            ima.src = sh.icons[0].src;
            li.append(ima);
        }

        const p = document.createElement('p');
        p.textContent = sh.name;
        li.append(p);

        if (sh.description) {
            li.title = sh.description;                      // hover tooltip
            li.setAttribute('aria-description', sh.description);
            
        }
        if (sh.short_name) li.dataset.shortcut = sh.short_name;
        if (sh.url.startsWith('http')) {
    li.onclick = () => window.open(sh.url);
} else if (
    sh.url.startsWith('?') ||
    sh.url.startsWith('/?') ||
    sh.url.startsWith('./?') ||
    sh.url === './' ||
    sh.url.startsWith('./')
) {
    const query = sh.url.replace(/^\.\//, '').replace(/^\//, '');
    li.onclick = () => Openf(null, ap05.path + query, false);
}
        
        xtraM.append(li);
    });
}

        itemM.querySelectorAll("li > p, li > b").forEach(i => i.innerText = _(i.innerText));
        itemM.style.display = "block";
        itemM.style.left = e.clientX + "px";
        itemM.style.top = e.clientY + "px";
    });

    // Drag and Drop implementation
    if (!isRequiredIcon){
    appContainer.setAttribute('draggable', 'true');

    appContainer.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', '');
        appContainer.classList.add('dragging');
    });

    appContainer.addEventListener('dragend', () => {
        appContainer.classList.remove('dragging');
        saveIconOrder();
    });
}

appContainer.onclick = (e) => {
    // 1. Prevent duplicate triggers if already animating
    if (appContainer.classList.contains('launching')) return;

    // 2. Add the class
    appContainer.classList.add('launching');

    // 3. Run the application launch logic
    if (typeof onclickLogic === 'function') {
        onclickLogic(e);
    }

    // 4. Inspect the true computed animation state
    const style = window.getComputedStyle(appContainer);
    const hasActiveAnimation = style.animationName !== 'none' && parseFloat(style.animationDuration) > 0;

    if (hasActiveAnimation) {
        // Wait for CSS animation completion event
        appContainer.addEventListener('animationend', () => {
            appContainer.classList.remove('launching');
        }, { once: true });
    } else {
        // Instant cleanup if animations are turned off via CSS/themes
        appContainer.classList.remove('launching');
    }
};

    if (isRequiredIcon) addSystemApp(nameKey, iconUrl, onclickLogic);

    icons.push({
        name: nameKey,
        icon: iconUrl,
        onclick: onclickLogic,
        element: appContainer
    });

    desktopApps.appendChild(appContainer);
}


/*
 * Set notification badge.
 *
 * value:
 *   0    -> clear badge
 *   null -> empty badge (no number)
 *   INT  -> show number
 */
function setBadge(name, value) {
    const icon = desktopIcons.find(i =>
        i.nameApp == name || i.name == name
    );

    if (!icon) return false;

    const appIcon = icons.find(i =>
        i.name == icon.name
    );

    if (!appIcon || !appIcon.element) return false;

    const badge = appIcon.element.querySelector('.notification-badge');
    if (!badge) return false;

    // 0 = clear
    if (value === 0) {
        return clearBadge(name);
    }

    // no value = empty badge
    if (!value) {
        badge.removeAttribute('name');
        badge.textContent = '';
        badge.style.display = 'block';
        badge.setAttribute('aria-hidden', 'false');
        return true;
    }

    // Integer = numbered badge
    if (Number.isInteger(value)) {
        badge.removeAttribute('name');
        badge.textContent = String(value);
        badge.style.display = 'block';
        badge.setAttribute('aria-hidden', 'false');
        return true;
    }

    return false;
}


function clearBadge(name) {
    const icon = desktopIcons.find(i =>
        i.nameApp == name || i.name == name
    );

    if (!icon) return false;

    const appIcon = icons.find(i =>
        i.name == icon.name
    );

    if (!appIcon || !appIcon.element) return false;

    const badge = appIcon.element.querySelector('.notification-badge');
    if (!badge) return false;

    badge.removeAttribute('name');
    badge.textContent = '';
    badge.style.display = 'none';
    badge.setAttribute('aria-hidden', 'true');

    return true;
}


async function openApp(targ, arg = null) {
    // 0. Відновлення існуючого вікна
let win;
if (typeof targ === "string" || !targ.path) {
 win = [...document.querySelectorAll('.winbox.hide')]
    .find(win => win.querySelector('.wb-title')?.textContent === _(targ));
}else{
  win = [...document.querySelectorAll('.winbox.hide')]
    .find(win => win.querySelector('.wb-title')?.textContent === _(targ.name));
}

if (win) {
    const wb = win.winbox;

    if (wb) {
      console.log('FORE1')
        wb.show();
        wb.focus();
        return;
    }

   
}


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
              const appClasses = Array.isArray(appEntry.class) ? appEntry.class : [ 'no-full'];
              new wm(_(appEntry.name), {
                  x: "center", y: "center",
                  class: appClasses.map(c => c === "wbtheme" ? wbtheme : c).join(" ") || wbtheme,
                  url: appPath,
                  icon: appEntry.icon,
                  minwidth: appEntry.miw, minheight: appEntry.mih,
                  width: appEntry.w, height: appEntry.h,
                  maxwidth: appEntry.maw, maxheight: appEntry.mah,
                  oncreate: function() {
                      applySystemConfig(this.id);
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
          Openf(mime, appEntry.path, false);

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


        document.getElementById('count_sysApps').innerText = apps.filter(a=> a.system == true).length;
        document.getElementById('count_userApps').innerText = apps.filter(a=> a.system == false).length;

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

    let startupDisk = 'System';
    let startupDiskType = 'indexedDB';



    if (localStorage.getItem("startupDisk") && localStorage.getItem("startupDiskType")){
        startupDisk = localStorage.getItem("startupDisk") ?? startupDisk;
        startupDiskType = localStorage.getItem("startupDiskType") ?? startupDiskType;
    }else{
        localStorage.setItem("startupDisk", startupDisk)
        localStorage.setItem("startupDiskType", startupDiskType)
    }


    let DB_NAME = startupDisk;
    const STORE_NAME = 'FileObjects';


    /**
     * Клас-обгортка для роботи з IndexedDB.
     * Всі операції є асинхронними.
     */
class IDBWrapper {
    constructor() {
        this.db = null;
    }

    async openDB(version) {
        return new Promise((resolve, reject) => {
            // Re-use connection if DB is open and no specific higher version is requested
            if (this.db) {
                if (!version || this.db.version === version) {
                    return resolve(this.db);
                }
                this.db.close();
                this.db = null;
            }

            // Passing undefined lets IndexedDB use the current DB version safely
            
            const request = indexedDB.open(DB_NAME, version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'name' }); 
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                
                // Close connection automatically if another process tries to upgrade it
                this.db.onversionchange = () => {
                    this.db.close();
                    this.db = null;
                };

                if (typeof dbInstances !== 'undefined') {
                    dbInstances[DB_NAME] = this.db;
                }
                resolve(this.db);
            };

            request.onblocked = () => {
                console.warn("IDB open blocked: close other connections to continue.");
            };

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    async saveFile(fileObject) {
        const db = await this.openDB(); // Automatically uses current DB connection/version
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], currentDisk.mode);
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(fileObject);

            request.onsuccess = async () => {
                if (fileObject.type === 'text/html' && typeof registerApps === 'function') {
                    await registerApps();
                }
                resolve();
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async deleteFile(fileName) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], currentDisk.mode);
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(fileName);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

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


function serializeFile(file) {
    if (
        !file ||
        typeof file !== "object" ||
        typeof file.size !== "number" ||
        typeof file.slice !== "function"
    ) {
        return Promise.reject(
            new TypeError("Expected a File or Blob")
        );
    }
    
    return new Promise((resolve, reject) => {
        const fileName = file.name || "unnamed";
        const fileType = file.type || getMimeType(fileName);
        const reader = new FileReader();
        
        reader.onload = () => {
            resolve({
                name: fileName,
                type: fileType,
                lastModified: file.lastModified || Date.now(),
                content: reader.result
            });
        };
        
        reader.onerror = () => reject(
            reader.error || new Error("File read failed")
        );
        
        reader.onabort = () => reject(
            new Error("File reading aborted")
        );
        
        if (fileType.startsWith("text/")) {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    });
}


async function saveFileToDB(file, alertme=false) {
    if (
    !file ||
    typeof file !== "object" ||
    typeof file.arrayBuffer !== "function" ||
    typeof file.size !== "number"
) {
    console.error("Invalid file object provided.", file);
    return false;
}

if (currentDisk && currentDisk.mode != 'readwrite'){
    console.error('Unable to complete! '+currentDisk.name+" is "+currentDisk.mode+".");
    return false;
}

const index = fs.findIndex(f => f.name === file.name);

if (index === -1) {
    fs.push(file);
} else {
    const a = alertme ? await confirm(_("confirm_replace_file_with_same_path").replace('{file}', file.name)) : true;

    if (a) {
        fs[index] = file;
    } else {
        return;
    }
}

    const fileName = file.name || "unnamed";
    
    

    try {
        if (currentDisk.type === "indexedDB") {
            currentDisk.busy = true;

            const fileObjectToSave = await serializeFile(file);
            await idbWrapper.saveFile(fileObjectToSave);

            if (file.type === "text/html") {
                await registerApps();
            }

        } else if (currentDisk.type === "localStorage") {


            localStorage.setItem(fileName, await file.text());

        } else if (currentDisk.type === "cookies") {
    
    
            await cookieStore.set({
    name: fileName,
    value: await file.text()
});
    
        } else if (currentDisk.type === "cache") {
            
    const cache = await caches.open(currentDisk.name);
    const key = file.name.split('/').map(encodeURIComponent).join('/');

    await cache.put(key, new Response(file, {
        headers: { 'Content-Type': file.type || getMimeType(file.name) }
    }));

}
else if (currentDisk.type === "sessionStorage") {


            sessionStorage.setItem(fileName, await file.text());

        } else if (currentDisk.type === "USB") {
            const targetFilePath = `${disk.where}/${fileName}`;
            const url =
                `/api/write_binary?path=${encodeURIComponent(targetFilePath)}`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/octet-stream"
                },
                body: file
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "USB write failed");
            }

        } else {
            throw new Error(`Unsupported disk type: ${currentDisk.type}`);
        }

        if (
            fileName.startsWith("system/shared/") &&
            fileName.endsWith(".wasm")
        ) {
            await refreshLibs();
        }else if (fileName.endsWith('.htm') || fileName.endsWith('.html')){
            await registerApps();
        }

        return true;

    } catch (error) {
        console.error("Error saving file:", error);
        return false;

    } finally {
        if (currentDisk.type === "indexedDB") {
            currentDisk.busy = false;
        }
    }
}


/**
 * Перетворює запис із БД/LocalStorage у File-об'єкт.
 */
function fileFromRecord(item) {
    let blob;

    if (item.type && item.type.startsWith("text/")) {
        blob = new Blob([item.content], { type: item.type });
    } else if (typeof item.content === 'string' && item.content.startsWith('data:')) {
        blob = dataURLtoBlob(item.content);
    } else {
        blob = new Blob([], { type: item.type || "application/octet-stream" });
    }

    return new File([blob], item.name || "unnamed", { 
        type: item.type || "application/octet-stream", 
        lastModified: item.lastModified || Date.now() 
    });
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
document.body.style.backgroundImage = `
    radial-gradient(
        circle at 50% 42%,
        rgba(255, 255, 255, 0.13) 0%,
        rgba(255, 255, 255, 0.035) 20%,
        transparent 45%
    ),
    radial-gradient(
        circle at 50% 50%,
        transparent 35%,
        rgba(0, 0, 0, 0.28) 100%
    ),
    linear-gradient(
        135deg,
        #6d3f78 0%,
        #a55f70 18%,
        #568d98 36%,
        #009bb0 51%,
        #007ca8 65%,
        #075b9b 82%,
        #03447f 100%
    )
`;
      }
        return new Promise(resolve => {
          
          if (bgClock == true){
            document.getElementById("desktop-fore").style.display = "flex"
          }else{
            document.getElementById("desktop-fore").style.display = "none"
          }
            const backgroundFileName = localStorage.getItem('backgroundFile');
            
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

                    localStorage.removeItem('backgroundFile');
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


    async function finishStartup() {
 if (BOOT_INTERR) return false; // Normal startup interrupted.
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
      addIcon(i.name, ic, ev, {isShortcut: !!i.nameFile})
    })
  },10);

        // Приховуємо заставку та запускаємо звук
        setTimeout(() => {
            const splash = document.getElementById('splash');
            if (splash) splash.classList.add("hidden"); 

        }, 10);

        try {
            sounds.play("startup");
        } catch (e) {}    
    }



    const prg = document.getElementById("loadprg");


function firstStart() {

    const oobe_steps = [
        {
            id: 1,
            lay: `
                <h1 data-i18n="language">Language</h1>
                <select id="languageSelect">
                    <option value="en">English</option>
                    <option value="ua">Українська</option>
                    <option value="fr">Français</option>
                    <option value="ru">Русский</option>
                    <option value="pl">Polski</option>
                </select>`,
            onLoad: () => {
                const select = document.getElementById("languageSelect");
                const nextBtn = document.querySelector('.toolbar button');

                select.value = currentLang || "en";
                nextBtn.disabled = false;

                select.onchange = () => {
                    currentLang = select.value;
                    console.log(`Language selected: ${currentLang}`);
                };
            }
        },
        {
            id: 2,
            lay: `
                <h1>Region</h1>
                May affect general language in 3rd-party app. Set Same region as language for best results.<br>
                <select id="regionSelect">
                    <option value="en-US">United States</option>
                    <option value="uk-UA">Ukraine</option>
                    <option value="fr-FR">France</option>
                    <option value="ru-RU">Russia</option>
                    <option value="pl-PL">Poland</option>
                </select>`,
            onLoad: () => {
                const select = document.getElementById("regionSelect");
                const nextBtn = document.querySelector('.toolbar button');

                select.value = dateLang || "en-US";
                nextBtn.disabled = false;

                select.onchange = () => {
                    dateLang = select.value;
                };
            }
        }
    ];

    let curr_oobe_step = 1;

    window.oobe_next = () => {
        // Finished OOBE
        if (curr_oobe_step > oobe_steps.length) {
            loadLanguage(currentLang, dateLang);

            localStorage.setItem("oobeComplete", "true");
if (!localStorage.getItem('desktopIcons')){
    addIcon('files', icns.files, apps[0].onclick)
desktopIcons.push({id:0,name:_('files'), nameApp: 'files'})
localStorage.setItem('desktopIcons', JSON.stringify(desktopIcons));
}

            oobe.close();
            return;
        }

        const currentStepData = oobe_steps[curr_oobe_step - 1];

        document.getElementById("oobe_step").innerText =
            curr_oobe_step + "/" + oobe_steps.length;

        document.getElementById("oobe_cont").innerHTML =
            currentStepData.lay;

        if (typeof currentStepData.onLoad === "function") {
            currentStepData.onLoad();
        }

        curr_oobe_step += 1;
    };

    const oobe = new wm("core.intro", {
        class: wbtheme + " no-header no-move no-resize",
        html: `
            <div class="toolbar">
                <span id="oobe_step"></span>
                <button onclick="oobe_next()" disabled>></button>
            </div>
            <main style="justify-content:center; padding:15px;" id="oobe_cont"></main>
        `,
        x: "center",
        y: "center",
        modal: true
    });

    oobe_next();
}




    async function setupFonts() {
      try{
      fonts = JSON.parse(localStorage.getItem("fonts")) || {installed: [...coreFonts], active: "sans-serif"};
  const active = fonts.active;

  if (!active) {
    document.body.style.fontFamily = 'sans-serif';
    document.documentElement.style.setProperty("--font", "sans-serif");
    return;
  }

  const f = getFs().find(f => f.name === active);

  if (!f) {
    document.body.style.fontFamily = 'sans-serif';
    document.documentElement.style.setProperty("--font", "sans-serif");
    return;
  }

      const b = await f.arrayBuffer(); // Don't forget to await the buffer if it's a File/Blob
      const font = new FontFace(active, b);

    const blob = new Blob([b], { type: f.type }); // або woff/otf
    window.currentFontBlobUrl = URL.createObjectURL(blob);


      if (!fonts.installed.includes(active) && f) {
            fonts.installed.push(active);

            localStorage.setItem("fonts", JSON.stringify(fonts));
            console.log(`"${active}" added to installed list.`);
        }
      

        const loadedFont = await font.load();
        document.fonts.add(loadedFont);

        document.body.style.fontFamily = `"${active}", sans-serif`;
        document.documentElement.style.setProperty("--font", document.body.style.fontFamily);
        
        console.log(`Font "${active}" applied successfully.`);
  }catch{
      document.body.style.fontFamily = 'sans-serif';
    document.documentElement.style.setProperty("--font", "sans-serif");
    return;
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
    if (maxLS) {
      console.warn('Returning cached data')
      return maxLS;
    }
      let i = 0;
      const keyPrefix = "TEST_";

      const chunkSize = 50 * 1024; // 50KB per write
      let writtenBytes = 0;

      // 1. Calculate how much space your existing keys are currently taking up
      let existingBytes = 0;
      for (let k in localStorage) {
          if (localStorage.hasOwnProperty(k)) {
              existingBytes += (k.length + localStorage.getItem(k).length) * 2; 
              
          }
      }

      try {
          while (true) {
              const key = keyPrefix + i;
              const value = "x".repeat(chunkSize);

              localStorage.setItem(key, value);

              writtenBytes += chunkSize;
              
              i++;

              if (prg) {
                  // Approximate ratio including existing data
                  const ratio = Math.min((writtenBytes + existingBytes) / (5 * 1024 * 1024), 0.99);
                  prg.value = Math.round(ratio * max);
              }
          }
      } catch (e) {
          

          // cleanup test keys safely
          for (let j = 0; j < i; j++) {
              localStorage.removeItem(keyPrefix + j);
          }

          if (prg) prg.value = max;

          // 2. Return the Total Limit (Existing space + what was left)
          return existingBytes + writtenBytes;
      }
  }



let maxCacheSize = null;


async function getMaxCCH(prg, max = 5) {
    if (maxCacheSize !== null) return maxCacheSize;

    // Fast path: the browser already reports its quota, so no probing is needed
    try {
        if (navigator.storage?.estimate) {
            const { quota, usage } = await navigator.storage.estimate();
            if (quota) {
                maxCacheSize = Math.max(0, quota - (usage || 0));
                if (prg) prg.value = max;
                return maxCacheSize;
            }
        }
    } catch (e) { /* fall through to probing */ }

    // Fallback: doubling probe, then shrinking once a write fails
    const cacheName = 'INFINITY_OS_MAX_TEST_CACHE';
    const MB = 1024 * 1024;
    const probeCap = 2048 * MB;           // stop probing at 2GB
    const block = new Uint8Array(MB);     // allocated once, reused

    const cache = await caches.open(cacheName);
    let written = 0;
    let size = MB;
    let i = 0;
    let growing = true;

    try {
        while (written < probeCap) {
            try {
                const blob = new Blob(new Array(size / MB).fill(block));
                await cache.put('/chunk-' + i++, new Response(blob));
                written += size;
                if (growing) size *= 2;   // keep doubling until the first failure
                if (prg) prg.value = Math.round(Math.min(written / probeCap, 0.99) * max);
            } catch (e) {
                if (size <= MB) break;    // even 1MB failed: we're full
                growing = false;          // stop growing, only shrink from here
                size /= 2;
            }
        }
    } finally {
        await caches.delete(cacheName);   // one call wipes every chunk
        if (prg) prg.value = max;
    }

    maxCacheSize = written;
    return maxCacheSize;
}




function getMaxSS(prg, max = 5) {
    if (maxSS) {
        console.warn('Returning cached data');
        return maxSS;
    }
    let i = 0;
    const keyPrefix = "TEST_SS_";

    const chunkSize = 50 * 1024; // 50KB per write
    let writtenBytes = 0;

    // 1. Calculate how much space your existing sessionStorage keys are taking up
    let existingBytes = 0;
    for (let k in sessionStorage) {
        if (sessionStorage.hasOwnProperty(k)) {
            existingBytes += (k.length + sessionStorage.getItem(k).length) * 2; 
        }
    }

    try {
        while (true) {
            const key = keyPrefix + i;
            const value = "x".repeat(chunkSize);

            sessionStorage.setItem(key, value);

            writtenBytes += chunkSize;
            i++;

            if (prg) {
                // Approximate ratio including existing data
                const ratio = Math.min((writtenBytes + existingBytes) / (5 * 1024 * 1024), 0.99);
                prg.value = Math.round(ratio * max);
            }
        }
    } catch (e) {
        

        // Cleanup test keys safely
        for (let j = 0; j < i; j++) {
            sessionStorage.removeItem(keyPrefix + j);
        }

        if (prg) prg.value = max;

        // 2. Cache and return the Total Limit (Existing space + what was left)
        maxSS = existingBytes + writtenBytes;
        return maxSS;
    }
}

let maxCookiesSize = null;

function getMaxCK(prg, max = 5) {
    // Only return cached size if it was a successful non-zero measurement, 
    // or allow resetting if you want to re-test.
    if (maxCookiesSize !== null && maxCookiesSize > 0) return maxCookiesSize;

    if (typeof document === "undefined") {
        console.warn("Document is undefined.");
        return 0;
    }

    const prefix = `__ck_test_${Date.now()}_`;
    const path = "/";
    const testName = prefix + "probe";

    // Probe whether cookies can be written at all
    // Note: SameSite=Lax requires a proper context; 
    // if testing locally, ensure you use http://localhost instead of file://
    document.cookie = `${testName}=1; path=${path}; SameSite=Lax`;

    // Check if the cookie was successfully written
    const probeWorks = document.cookie.includes(`${testName}=1`);

    // Clean up probe
    document.cookie = `${testName}=; Max-Age=0; path=${path}; SameSite=Lax`;

    if (!probeWorks) {
        console.warn(
            "Cookie probe failed. Make sure you are running via a local server (http://localhost) and not a file:// URL, and that cookies are enabled."
        );
        return 0;
    }

    // Calculate existing cookie bytes
    const existingCookies = document.cookie ? document.cookie.split(/;\s*/) : [];
    const existingBytes = existingCookies.reduce((sum, c) => sum + c.length, 0);

    const chunkSize = 500; 
    let writtenBytes = 0;
    let i = 0;
    const created = [];

    try {
        while (i < 100) { // Safety limit to prevent infinite loops
            const name = prefix + i;
            const value = "x".repeat(chunkSize);
            
            document.cookie = `${name}=${value}; path=${path}; SameSite=Lax`;

            // Verify if this specific chunk was stored
            if (!document.cookie.includes(`${name}=`)) {
                break; // Browser cookie limit reached
            }

            created.push(name);
            writtenBytes += name.length + value.length;
            i++;

            if (prg) {
                prg.value = Math.min(
                    max,
                    Math.round((writtenBytes / (5 * 1024 * 1024)) * max)
                );
            }
        }
    } finally {
        // Clean up all created test cookies
        for (const name of created) {
            document.cookie = `${name}=; Max-Age=0; path=${path}; SameSite=Lax`;
        }

        if (prg) prg.value = max;
    }

    console.log("Existing visible cookie bytes:", existingBytes);
    console.log("Test bytes successfully stored:", writtenBytes);

    maxCookiesSize = existingBytes + writtenBytes;
    return maxCookiesSize;
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


    async function registerApps() {
    if (currentDisk.name != startupDisk) return console.error('.');
    
    const localApps = fs.filter(a =>
        a.name.endsWith(".html") || a.name.endsWith(".htm")
    );
    
    if (localApps.length === 0) return;
    
    const htmlpaths = localApps.map(f => f.name);
    
    // Keep system apps; keep non-system apps only if their file still exists
    apps = apps.filter(app => app.system || htmlpaths.includes(app.path));
    
    // --- Clean up file associations whose app file was removed ---
    Object.entries(FILE_ASSOC).forEach(([ext, appPath]) => {
        if (appPath === 'openf') return;
        const isAppExists = fs.some(f => f.name === appPath);
        if (!isAppExists) {
            delete FILE_ASSOC[ext];
            if (!Object.keys(FILE_TYPES).includes(ext)) {
                delete FILE_TYPES[ext];
            }
            localStorage.setItem('config/exts', JSON.stringify(FILE_ASSOC));
        }
    });
    
    localApps.forEach(app => {
        const reader = new FileReader();
        const appName = app.name;
        
        reader.addEventListener("load", async () => {
            const content = reader.result;
            let searchParam = "";
            
            function registerExtension(ext, mimeType) {
                const cleanExt = ext.toLowerCase().replace('.', '').trim();
                if (!cleanExt || cleanExt.startsWith('x-')) return;
                
                const existing = FILE_TYPES[cleanExt];
                
                if (!existing) {
                    FILE_TYPES[cleanExt] = {
                        mime: mimeType || "application/octet-stream",
                        icon: getIcon(new File([], `a.${cleanExt}`)) || (icns.empty || ""),
                        openWith: FILE_ASSOC[cleanExt] || appName
                    };
                } else if (
                    mimeType &&
                    (!existing.mime || existing.mime === "application/octet-stream")
                ) {
                    existing.mime = mimeType;
                }
                
                if (!FILE_ASSOC[cleanExt] && searchParam) {
                    FILE_ASSOC[cleanExt] = appName;
                    FILE_TYPES[cleanExt].openWith = appName;
                    localStorage.setItem('config/exts', JSON.stringify(FILE_ASSOC));
                }
            }
            
            // --- 1. Parse URL params and register in menu ---
            const titleMatch = content.match(/<title>(.*?)<\/title>/i);
            const paramVars = new Set();
            const argumentsFound = [];
            
            const searchParamsRegex =
                /\b(?:const|let|var)\s+(\w+)\s*=\s*new\s+URLSearchParams\s*\(\s*(?:window\.|self\.|this\.|document\.)?location\.search\s*\)/g;
            const hrefParamsRegex =
                /\b(?:const|let|var)\s+(\w+)\s*=\s*new\s+URL\s*\(\s*(?:window\.|self\.|this\.|document\.)?location\.href\s*\)\.searchParams/g;
            const directHrefRegex =
                /new\s+URL\s*\(\s*(?:window\.|self\.|this\.|document\.)?location\.href\s*\)\.searchParams\.get\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
            
            let match;
            while ((match = searchParamsRegex.exec(content)) !== null) paramVars.add(match[1]);
            while ((match = hrefParamsRegex.exec(content)) !== null) paramVars.add(match[1]);
            while ((match = directHrefRegex.exec(content)) !== null) argumentsFound.push(match[1]);
            
            for (const variable of paramVars) {
                const getRegex = new RegExp(
                    `\\b${variable}\\.get\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*\\)`, "g"
                );
                while ((match = getRegex.exec(content)) !== null) argumentsFound.push(match[1]);
            }
            
            if (argumentsFound.includes("file")) searchParam = "file";
            else if (argumentsFound.includes("path")) searchParam = "path";
            else if (argumentsFound.length > 0 && argumentsFound[0] !== "url") searchParam = argumentsFound[0];
            
            const iconMatch = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
const systemFile = fs.find(f => f.name === appName);

let thmColor = {
    dark: '',
    light: ''
};


const tag = content.match(/<link\b[^>]*\brel\s*=\s*["']manifest["'][^>]*>/i)?.[0];
    const href = tag?.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
async function readManifest() {
    
    if (!href) return null;
    try {
        if (href.startsWith("data:")) {
            const comma = href.indexOf(",");
            const head = href.slice(0, comma), body = href.slice(comma + 1);
            const text = /;base64/i.test(head)
                ? new TextDecoder().decode(Uint8Array.from(atob(body), c => c.charCodeAt(0)))
                : decodeURIComponent(body);
            return JSON.parse(text);
        }
        const res = await fetch(href);
        return await res.json();
    } catch (e) {
        console.warn("Manifest read failed for", appName, e);
        return null;
    }
}

const manifest = await readManifest();

if(manifest?.theme_color) thmColor = {light: manifest.theme_color, dark:manifest.theme_color};

const tags = [...content.matchAll(
    /<meta\b[^>]*\bname\s*=\s*["']theme-color["'][^>]*>/gi
)];

for (const [tag] of tags) {
    const color = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
    const media = tag.match(/\bmedia\s*=\s*["']([^"']+)["']/i)?.[1] || '';

    if (media.includes('dark')) {
        thmColor.dark = color || '';
    } else if (media.includes('light')) {
        thmColor.light = color || '';
    } else {
        thmColor.light ||= color || '';
        thmColor.dark ||= color || '';
    }
}


const aInstance = {
    name: titleMatch ? titleMatch[1] : appName.split("/").pop(),
    icon: iconMatch ? iconMatch[1] : "",
    path: appName,
    hash: systemFile ? systemFile.size : 0,
    openWithParam: searchParam,
    system: false
};
if (manifest?.display) aInstance.display = (manifest.display  == 'browser' ? "standalone" : manifest.display);
if ((manifest?.shortcuts || []).length) aInstance.shortcuts = manifest?.shortcuts || [];
if (thmColor.dark != '' || thmColor.light != '') aInstance.theme_color = thmColor;
if (manifest?.background_color) aInstance.background_color = manifest.background_color;
if (manifest?.launch_handler?.client_mode) {
    aInstance.launch_handler__client_mode =
        Array.isArray(manifest.launch_handler.client_mode)
            ? manifest.launch_handler.client_mode[0]
            : manifest.launch_handler.client_mode;
}
addApp(aInstance);
            
            // --- 2a. Manifest file handlers (optional, must not break the rest) ---
            try {
               
                
                if (href) {
                    const res = await fetch(href);
                    const manifest = await res.json();
                    
                    // Custom format
                    if (manifest?.fileHandlers?.accept) {
                        for (const [mime, exts] of Object.entries(manifest.fileHandlers.accept)) {
                            exts.forEach(ext => registerExtension(ext, mime));
                        }
                    }
                    // Standard format: file_handlers: [{ accept: { mime: [exts] } }]
                    if (Array.isArray(manifest?.file_handlers)) {
                        manifest.file_handlers.forEach(h => {
                            for (const [mime, exts] of Object.entries(h.accept || {})) {
                                [].concat(exts).forEach(ext => registerExtension(ext, mime));
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn(`[FileTypes] Manifest skipped for ${appName}:`, e);
            }
            
            // --- 2b. showOpenFilePicker accept maps ---
            if (content.includes("showOpenFilePicker") || content.includes("accept")) {
                const acceptEntryRegex =
                    /['"`]([a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+)['"`]\s*:\s*\[([^\]]*)\]/g;
                let m;
                while ((m = acceptEntryRegex.exec(content)) !== null) {
                    const detectedMime = m[1];
                    const extensionRegex = /['"`]\.([a-zA-Z0-9]+)['"`]/g;
                    let extMatch;
                    while ((extMatch = extensionRegex.exec(m[2])) !== null) {
                        registerExtension(extMatch[1], detectedMime);
                        console.log(`[FileTypes] Detected .${extMatch[1]} -> ${detectedMime}`);
                    }
                }
            }
            
            // --- 3. <input type="file" accept="..."> ---
            const inputAcceptRegex = /<input[^>]+type=["']file["'][^>]*accept=["']([^"']+)["']/gi;
            let inputMatch;
            while ((inputMatch = inputAcceptRegex.exec(content)) !== null) {
                inputMatch[1].split(",").forEach(part => {
                    const token = part.trim();
                    if (token.startsWith(".")) {
                        registerExtension(token, "application/octet-stream");
                    } else if (token.includes("/")) {
                        if (token.endsWith("/*")) {
                            const group = token.split("/")[0];
                            if (group === "image") {
                                registerExtension("png", "image/png");
                                registerExtension("jpg", "image/jpeg");
                            }
                            if (group === "audio") {
                                registerExtension("mp3", "audio/mpeg");
                                registerExtension("wav", "audio/wav");
                            }
                            if (group === "video") registerExtension("mp4", "video/mp4");
                        } else {
                            registerExtension(token.split("/").pop(), token);
                        }
                    }
                });
            }
        });
        
        reader.readAsText(app);
    });
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
        // console.log("Entering sleep mode... " + date.toLocaleString(dateLang));
        

        
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
        // console.log("Waking up system... " + date.toLocaleString(dateLang));
        
        // 1. Скидаємо прапорці
        PowerManager.isAsleep = false;
        document.body.classList.remove('os-suspended');
        
        // 2. Прибираємо оверлей з екрана
        const overlay = document.getElementById('system-sleep-overlay');
        if (overlay) {
            overlay.style.display = 'none'
        }
    }
async function runAutoload(){
    let autoload = JSON.parse(localStorage.getItem('autoload')) ?? [];

  


let wmProvider = null;

// Phase 1: find the JS file that provides wm
for (const itemName of autoload) {
    const autofile = fs.find(file => file.name === itemName);

const perms = getPerms();
const app = apps.find(a => a.path === itemName);
const permission = app ? perms[app.name]?.autoload : undefined;

if (!autofile || permission === null || permission === false) {
    autoload = autoload.filter(a => a !== itemName);
    localStorage.setItem('autoload', JSON.stringify(autoload));
    continue;
}

    if (autofile.type !== "text/javascript") continue;

    const code = await autofile.text();

    const providesWm =
        /\bwm\s*=/.test(code) &&
        !/\b(?:const|let|var)\s+wm\s*=/.test(code);

    if (providesWm) {
        hasCustomWm = true;
        wmProvider = autofile;

        // Execute it immediately so wm exists
        eval(code);

        break;
    }
}


// Phase 2: if no custom wm, load WinBox first
if (!hasCustomWm) {
    await new Promise(resolve => {
        const script = document.createElement("script");

        script.src = "dist/winbox.bundle.min.js";

        script.onload = () => {
            log("[OK] WinBox loaded");

            wm = WinBox;

            resolve();
        };

        script.onerror = () => {
            log("<span style='color:red;'>[FAIL] WinBox failed to load</span>");
            resolve();
        };

        document.body.appendChild(script);
    });
} else {
    log("<span style='color:yellow;'>[SKIP] WinBox skipped</span>");  
}



// Phase 3: now open the remaining autoload files
for (const itemName of autoload) {
    const autofile = fs.find(file => file.name === itemName);

    if (!autofile) continue;

    // Don't execute the WM provider twice
    if (autofile === wmProvider) continue;

    Openf(autofile.type, autofile, false);
}
                    
    
}

function loadAccessSettings() {
  const turnOnAnims =
    JSON.parse(localStorage.getItem('access/turnOnAnims') ?? 'true');

  const highContrast =
    JSON.parse(localStorage.getItem('access/highContrast') ?? 'false');

  document.body.classList.toggle('no-anims', !turnOnAnims);
  document.body.classList.toggle('hi-contr', highContrast);

}


  (async () => {
      BOOT = true;
      try {
        prg.value = 0;
        log("[INFO] Press "+INTERR_KEY+" to interrupt normal startup", 'INTERR_MSG');
        if (await setBeatMon()){
            log("[OK] Performace monitor is working");
        }else{
            log("<span style='color:red;'>[FAIL] Performace monitor can not be started. Use F5 on crash</span>");
        }
          maxLS = await getMaxLS(prg, 1.25);
          log("[OK] Local Storage allocated: " + maxLS + " bytes");
          maxSS = await getMaxSS(prg, 2.5);
          log("[OK] Session Storage allocated: " + maxSS + " bytes");
          maxCK = await getMaxCK(prg, 3.75);
          
          
          if (maxCK != 0){
          log("[OK] Cookies allocated: " + maxCK + " bytes");
      }else{
        log("<span style='color:red;'>[FAIL] Cookies are not supported. Some features will be not available</span>");
      }
      maxCCH =  await getMaxCCH(prg, 5);
      if ( window.location.protocol != 'file:'){
        log("[OK] Caches allocated: " + maxCCH + " bytes");
    }else{
        log("<span style='color:red;'>[FAIL] Cache drives are not supported. You can view existing drives, but not write to them</span>");
    }
          prg.value = 5;


        if (checkAPIonBoot) await checkAPI()
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
          prg.value = 10;



          await mountDrive(startupDisk, null, 'readwrite' , true);
          if (currentDisk){
            log("[OK] Disks loaded");
        }else{
            log("<span style='color:red;'>[FAIL] Current disk is not set</span>");
        }
          
          prg.value = 15;

          await setupFonts();
          log("[OK] Fonts loaded");
          prg.value = 20;

          devProps = await buildDevProps();
          log("[OK] Device properties loaded");
          prg.value = 25;

          await loadTheme();
          log("[OK] Theme loaded");
          prg.value = 30;
          console.log(body.classList)

          await loadBackground();
          log("[OK] Background loaded");
          prg.value = 35;

          await redefineAdaptations();
          log("[OK] Adaptations redefined");
          prg.value = 40;

          await loadLayout();
          log("[OK] Keyboard shortcuts layout loaded: " + getKbrdShortcutsLayout());
          prg.value = 45;

          await PowerManager.init({
              timeout: localStorage.getItem("sleepModeTimeout")
                  ? parseInt(localStorage.getItem("sleepModeTimeout"))
                  : (60 * 1000),
              onIdle: () => enterSleepMode(),
              onWake: () => exitSleepMode(),
              isPaused: (parseInt(localStorage.getItem("sleepModeTimeout")) == 0)
          });
          log("[OK] Power Manager loaded");
          prg.value = 50;

          await getNodeEnv();
log("[OK] Node environment loaded");
npmUpdate();
libUpdate();
log("[OK] Shared libraries loaded: " +  libList().length);
          log("[OK] Node packages loaded: "+npmList().length);
          prg.value = 55;

          await setupExtentions();
          log("[OK] File extension associations loaded");
          prg.value = 60;

          notificationAPI = await redefineNotifications();
          log("[OK] Notifications redefined");
          prg.value = 65;

          await registerApps();
          log("[OK] Applications registered");
          prg.value = 70;
          await checkCrossOrigin();
          if (CROSS_ORI){
            log("[OK] Cross-origin is supported");
          }else{
            apps = apps.filter(a=> a.name != 'task_mgr' && a.name != 'Infinity Store');
            log("<span style='color:red;'>[FAIL] Cross-origin is not supported. Some system apps may not be avaliable</span>");
          }

          await updateBattery();
          log("[OK] Battery status loaded");
          if (localStorage.getItem("oobeComplete") !== "true") {
            await new Promise(resolve => {
        const script = document.createElement("script");

        script.src = "dist/winbox.bundle.min.js";

        script.onload = () => {
            log("[OK] WinBox loaded");

            wm = WinBox;

            resolve();
        };

        script.onerror = () => {
            log("<span style='color:red;'>[FAIL] WinBox failed to load</span>");
            resolve();
        };

        document.body.appendChild(script);
    });
              await firstStart();
              log("[OK] OOBE loaded");
              prg.value = 75;
              
          } else {
              log("<span style='color:yellow;'>[SKIP] OOBE skipped</span>");
              await loadLanguage();
          log("[OK] Language loaded: " + currentLang + " " + dateLang);
          
              await runAutoload();
              log("[OK] Autoload running");
          }
          prg.value = 80;
          await updateTime();
          log("[OK] Clock synced");
          await updateNetwork()
          log("[OK] Networking loaded");
            if (HW_API){
                document.getElementById('capt_btn').classList.remove('disabled')
                log("[OK] Screen Capture service loaded");
            }

          if (HW_API){
          await updateVolume()
          log("[OK] Volume manager loaded");
          }else{
          log("<span style='color:yellow;'>[SKIP] Audio output volume is not supported. Use hardware keys to control volume.</span>");            
          }
          if (HW_API){
            await updateBluetooth();
            log("[OK] Bluetooth utilities loaded");
        }else{
            log("<span style='color:yellow;'>[SKIP] Bluetooth utilities are not supported</span>");
        }

        try{
            loadAccessSettings();
            log("[OK] Accessibility settings loaded");
        }catch{
            log("<span style='color:yellow;'>[SKIP] Accessibility settings skipped. Nothing to load.</span>");
        }
          prg.value = 85;


          await setPanelConfig(JSON.parse(localStorage.getItem("panelConf")) || {});
          log("[OK] Panel configuration loaded");

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
              log("<span style='color:red;'>[FAIL] Startup interrupted by user</span>");
          }

      } catch (e) {
          console.error("BOOT ERROR:", e);
          log("<span style='color:red;'>[FAIL] Startup error</span>");
      }
      
  })();

      function setPerm(app, perm, state, loc=null) {
          // 1. Захист від undefined: якщо додаток ще не має жодних дозволів,
          // створюємо під нього пустий об'єкт, щоб не було TypeError
          permissions[app] ??= {};

          // 2. Оновлюємо конкретне право (state: true/false)
          permissions[app][perm] = state;

          // 3. Зберігаємо в localStorage, обов'язково перетворивши об'єкт на JSON-рядок
          try {
              localStorage.setItem('permissions', JSON.stringify(permissions));
          } finally {
            if (loc) loc.reload()
              
          }
      }


    async function deleteApp(app0, full=false){
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
      desktopIcons = desktopIcons.filter(i=> i.nameApp != app.name);
      localStorage.setItem('desktopIcons', JSON.stringify(desktopIcons))
      };
      apps = apps.filter(a=> a.name != app.name);

      if (full) {Object.keys(localStorage)
  .filter(k => k.toLowerCase().startsWith(
    String(JSON.stringify(app.name)).toLowerCase().replaceAll(" ", "_")+"/"
  ))
  .forEach(k => localStorage.removeItem(k));
}
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



function isInstalled(app){
    const appName = (app.name || "").trim().toLowerCase();
    
    // 1. Extract base name from the entry path
    const baseName = (app.entry || "")
        .split("/")
        .pop()
        .split(".")[0]
        .toLowerCase();

    // 2. Map app types to their proper extensions


    // Fallback to the entry path's own extension, defaulting to .js if none exists


    const ext = '.' + app.type
    const fileName = baseName + ext;

    // 3. Check File System directly (Independent of getApps)
    
    const fileExists = fs.some(f => (f.name || "").toLowerCase() === fileName);
    const fsNames = new Set(fs.map(f => (f.name || "").toLowerCase()));

    if (fileExists || fsNames.has(appName) || fsNames.has(baseName)) {
        return true;
    }

    // 4. Check registered apps list
    return apps.some(a => {
        if (a.system) return false;
        
        const name = (a.name || "").trim().toLowerCase();
        const path = (a.path || "").toLowerCase();
        
        return (
            name === appName ||
            (path && path.includes(appName)) ||
            (path && !baseName.includes("index") && path.includes(baseName)) || 
            (app.type == 'wasm' && libList().includes(app.name)) ||
            (app.type == 'node' && npmList().includes(app.name))

        );
    });
}
async function getRel(name, mnfst, inst=false) {
    if (!apps.find(a =>
        a.system &&
        a.name === 'Infinity Store' &&
        a.icon === 'icons/store.svg' && a.onclick
    )) {
        return [];
    }
let mnfstParsed ={};
if (mnfst && !inst){
    const response = await fetch(mnfst);
    mnfstParsed = await response.json();
    
}
   

    
    const META_URL = localStorage.getItem("StoreRepo") ||
        "https://cosmic-dragon-a1ab65.netlify.app/meta.json";

    const response = await fetch(META_URL);

    if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`);
    }

    // Get the update date from the HTTP header BEFORE parsing JSON.
    const lastModified = response.headers.get("Last-Modified");

    const storeEntries = await response.json();

    const dt = lastModified ? new Date(lastModified) : new Date();

if (!lastModified) {
    dt.setDate(dt.getDate() - ((dt.getDay() - 4 + 7) % 7));
}

    // Format as DDMMYYYY, e.g. 27032010
    const formattedDate =
        String(dt.getDate()).padStart(2, '0') +
        String(dt.getMonth() + 1).padStart(2, '0') +
        dt.getFullYear();

    const app = storeEntries.find(e => e.name === name);
    let insLst = [];
if (inst){
if (!app) return [];
    app.related.forEach(a=>{
        app0 = storeEntries.find(e => e.name === a);
    if (isInstalled(app0)) insLst.push({id:a, platform:"infinity_store", url: 'market://details?id=' +
            encodeURIComponent(a),
        version: formattedDate});
})
if (mnfstParsed?.related_applications){
    mnfstParsed?.related_applications.forEach(rel=>{
        if (apps.find(a=> a.name == rel.id)) insList.push(rel);
        
    })
}
return insLst;
    
}
    

    return [...( app ? app?.related.map(r => ({
        id: r,
        platform: 'infinity_store',
        url: 'market://details?id=' +
            encodeURIComponent(r),
        version: formattedDate
    })) : []), ...(mnfstParsed?.related_applications || [])]
}


    async function makeApp(content, name, target, href, fileWinBox, fndApp){
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

    if (content.includes('require(') || content.includes('import ')){
        expand += `  

function webRequire(pa, op) {
    if (typeof pa !== 'string') {
            return require(pa, op);
}
            pa = pa.replace('node:','');

    if (pa.startsWith('@') || pa.includes('.main')) {
        return require(pa, op);
    }

    if (parent.npmList().includes(pa)) {
        // NodeJS
        return parent.getNodeEnvSync().require(pa);
    }

    return console.error("Module not found: " + pa);
}

`
    }

    // Get the computed styles of the root element
const rootStyles = window.getComputedStyle(document.documentElement);

// Get the value of the specific CSS variable and trim any leading/trailing spaces




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
        <style>
        :root{
        --accent-color: ${rootStyles.getPropertyValue('--accent-color').trim()};
        }
        </style>
    <script>
      Object.defineProperty(navigator, 'userAgent', {
      get: function () {
          return 'Mozilla/5.0 (Infinity OS ${devProps.os.version}; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
      }
  });


        navigator.appVersion = navigator.userAgent.replace('Mozilla/','');
        navigator.oscpu = "Infinity OS ${devProps.os.version}";

      document.documentElement.style.cursor = 'wait';
     let permissions = parent.getPerms();
    ${notificationAPI
        .replaceAll(/window\.location\.href(?!\s*=)/g, `"${href}"`)
        .replaceAll(/document\.location\.href(?!\s*=)/g, `"${href}"`)
        .replaceAll(/document\.title(?!\s*=)/g, `"${name}"`)
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
            type: parent.getMimeType(fileName) || blob.type, lastModified: Date.now()
        });
if (fileToSave instanceof File){
        parent.getFs().push(fileToSave);
        await parent.saveFileToDB(fileToSave);
}





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
            if (this.href == '#') { event.preventDefault(); return;};
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


        async function getFilesFromDirectory(dirHandle, path = "") {
    const files = [];

    for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === "file") {
            const file = await handle.getFile();
Object.defineProperty(file, "name", {
    value: file.name.split("/").pop(),
    configurable: true
});

Object.defineProperty(file, "webkitRelativePath", {
    value: file.name,
    configurable: true
});

            files.push(file);
        } else if (handle.kind === "directory") {
            const subFiles = await getFilesFromDirectory(
                handle,
                name
            );

            files.push(...subFiles);
        }
    }

    return files;
}

    async function populateInputWithPicker(input) {
        console.log(input)
    try {
        let files;

        if (input.webkitdirectory || input.directory) {
            const directoryHandle = await showDirectoryPicker();

            files = await getFilesFromDirectory(directoryHandle);
        } else {
            const handles = await showOpenFilePicker(
                buildPickerOptions(input)
            );

            files = await Promise.all(
                handles.map(handle => handle.getFile())
            );
        }

        const dt = new DataTransfer();

        for (const file of files) {
            dt.items.add(file);
        }

        input.files = dt.files;

        input.dispatchEvent(
            new Event("input", { bubbles: true })
        );

        input.dispatchEvent(
            new Event("change", { bubbles: true })
        );

    } catch (err) {
        // Abort/cancel: leave the input unchanged.
        if (err?.name !== "AbortError") {
            console.error("File picker error:", err);
        }
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


async function requestAutoload(){
    const perms = parent.getPerms();
    let allow = perms[${JSON.stringify(name)}]?.autoload;
    if (allow == null) {
      allow = await parent.confirm(parent._("application_needs_permission") + parent._('autoload'));
      parent.setPerm(${JSON.stringify(name)}, "autoload", allow);
    }
    if (!allow && allow != null) throw new DOMException("Permission denied", "NotAllowedError");
        else {
        let autoload = JSON.parse(
                localStorage.getItem('autoload') || '[]'
            );

            if (!autoload.includes('${href}')) {
                autoload.push('${href}');

                localStorage.setItem(
                    'autoload',
                    JSON.stringify(autoload)
                );
            }
            return true;
        }
        

}

    let allowedKeys = [];
  const fakeStorage = {
    async request() {
      console.log('Requesting: LS');
      const perms = parent.getPerms();
      if (!perms[${JSON.stringify(name)}] || perms[${JSON.stringify(name)}].localStorage == null) {
        const allow = await confirm(parent._('application_needs_permission') + "Local Storage drive (W)");
        parent.setPerm(${JSON.stringify(name)}, 'localStorage', allow);
        console.log("Permission request state: " + Boolean(parent.getPerms()[${JSON.stringify(name)}]?.localStorage));
      }
    },

    setItem(key, value) {
      if (!key.includes("/"))
        key = String(${JSON.stringify(name)}).toLowerCase().replaceAll(" ", "_") + "/" + key;

      const perms = parent.getPerms();
      if (perms[${JSON.stringify(name)}] && perms[${JSON.stringify(name)}].localStorage === true) {
        localStorage.setItem(String(key), String(value));
        allowedKeys.push(String(key));
      }
    },

    getItem(key) {
      if (!key.includes("/"))
        key = String(${JSON.stringify(name)}).toLowerCase().replaceAll(" ", "_") + "/" + key;
      allowedKeys.push(String(key));
      return localStorage.getItem(String(key));
    },
    removeItem(key) {
      if (!key.includes("/")) {
          key = String(${JSON.stringify(name)}).toLowerCase().replaceAll(" ", "_") + "/" + key;
      }
      if (allowedKeys.includes(String(key)))
          localStorage.removeItem(String(key));
  },

  clear() {
      Object.keys(localStorage).forEach(k => {
          if (k.startsWith(String(${JSON.stringify(name)}).toLowerCase().replaceAll(" ", "_")))
              localStorage.removeItem(k);
      });
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
    window.showSaveFilePicker = (...o) => window.parent.showSaveFilePicker(...o);
    

    alert = (...a)=>parent.alert(...a);
    prompt = (...a)=>parent.prompt(...a);
    confirm = (...a)=> parent.confirm(...a);
    fetch = (...a) => parent.fetch(...a);
    console = parent.console;
    Worker = parent.Worker;
    print = () => parent.print();



// Intercept uncaught JavaScript errors
window.onerror = (message, source, lineno, colno, error) => {
    // Avoid logging through the overridden console.error here
    // parent.originalConsoleError("Uncaught error:", error || message, source, lineno, colno);

    parent.showJsError(
        message || error?.stack,
        '${href}',
        lineno,
        colno
    );

    return true;
};

// Intercept unhandled promise rejections
window.addEventListener("unhandledrejection", event => {
    // parent.originalConsoleError("Unhandled rejection:", event.reason);

    parent.showJsError(
        event.reason?.stack ||
        event.reason?.message ||
        String(event.reason)
    );
});

// Forward calls from iframe/application to the parent window's handler
HTMLInputElement.prototype.showPicker = function () {
  return parent.HTMLInputElement.prototype.showPicker.call(this);
};
if (!window.documentPictureInPicture) {
  window.documentPictureInPicture = new EventTarget();
}

    documentPictureInPicture.requestWindow = (...a) => parent.documentPictureInPicture.requestWindow(...a);


document.addEventListener('click', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type === 'color') {
    e.preventDefault(); // Stop native picker dialog
    e.target.showPicker();
  }
}, true);

        

   (function () {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'title');

  Object.defineProperty(document, 'title', {
    get() {
      return originalDescriptor.get.call(this);
    },
    set(newTitle) {
      // Execute original setter to update the document title
      originalDescriptor.set.call(this, newTitle);

      // Directly invoke the parent window function

        parent.setTitle(newTitle, '${fileWinBox.id}');
    },
    configurable: true, 
    enumerable: true
  });
})();
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
    const perms = parent.getPerms();
    let allow = perms[${JSON.stringify(name)}]?.wakeLock;
    if (allow == null) {
      allow = await parent.confirm(parent._("application_needs_permission") + "Wake Lock");
      parent.setPerm(${JSON.stringify(name)}, "wakeLock", allow);
    }
    if (!allow) throw new DOMException("Permission denied", "NotAllowedError");

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
  
navigator.getInstalledRelatedApps = async ()=> await parent.getRel(String(${JSON.stringify(name)}), document.querySelector('link[rel="manifest"]')?.href, true)

navigator.setAppBadge = (n) => parent.setBadge("${name}", n );
navigator.clearAppBadge = () => parent.clearBadge("${name}");
if (!navigator.mediaSession) {
  navigator.mediaSession = {setActionHandler: ()=> {}}
}
navigator.mediaSession.setPositionState = (stateData) => parent.setMinProgress(stateData, '${fileWinBox.id}');


  if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && navigator.mediaDevices.getUserMedia){
  const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  window.fakeMediaDevices = {
        async request(){
        console.log('Requesting: mediaDevices');
        try{
        const existing = permissions["${name}"];
        if (!existing || !existing.mediaDevices && existing.mediaDevices == null) {
        console.log('Ask: mediaDevices');
            const allow = await parent.confirm(parent._('application_needs_permission') + "Media Devices");
            parent.setPerm("${name}", 'mediaDevices', allow); // Fixed variable reference
        }
        }catch{}
        },
        async getDisplayMedia(constraints = {}) {
    const isGranted = Boolean(parent.getPerms()[${JSON.stringify(name)}]?.mediaDevices === true);
    if (!isGranted) throw new DOMException("Permission denied by user", "NotAllowedError");
    return originalGetDisplayMedia(constraints);
  },
  async getUserMedia(constraints = {}) {
    const isGranted = Boolean(parent.getPerms()[${JSON.stringify(name)}]?.mediaDevices === true);
    if (!isGranted) throw new DOMException("Permission denied by user", "NotAllowedError");
    return originalGetUserMedia(constraints);
  }
  }
  }

    window.fakeGeolocation = {
      async request(){
        const existing = permissions["${name}"];
        if (!existing || !existing.location && existing.location == null) {
            const allow = await parent.confirm(parent._('application_needs_permission') + "Location");
            parent.setPerm("${name}", 'location', allow); // Fixed variable reference
        }
      },

     async getCurrentPosition(successCallback, errorCallback, options) {
    if (typeof successCallback !== 'function') return;
    const perms = parent.getPerms();
    if (!perms[${JSON.stringify(name)}] || perms[${JSON.stringify(name)}].location !== true) return;
parent.setTrayIcon('geodata', true)
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
        parent.setTrayIcon('geodata', false)
            } catch {
        parent.setTrayIcon('geodata', true, -1)
                if (typeof errorCallback === 'function') errorCallback({ code: 2, message: "Position unavailable", POSITION_UNAVAILABLE: true });
        parent.setTrayIcon('geodata', false)
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
      



Object.defineProperty(navigator, 'preferences', {
    value: {
      get colorScheme() {
        let isDark = false;
        try {
          isDark = parent.getWBtheme().includes(' dark');
        } catch(e) {}
        console.log('Got user prefs: colorScheme');
        return {
          value: isDark ? 'dark' : 'light',
          override: null,
          validValues: ['light', 'dark'],
          addEventListener: () => {},
          removeEventListener: () => {}
        };
      },
      get reducedTransparency() {
        let isReduced = false;
        try {
          isReduced = parent.getWBtheme().includes('win_cla');
        } catch(e) {}
        console.log('Got user prefs: reducedTransparency');
        return {
          value: isReduced ? 'reduce' : 'no-preference',
          override: null,
          validValues: ['reduce', 'no-preference'],
          addEventListener: () => {},
          removeEventListener: () => {}
        };
      }
    },
    configurable: true,
    enumerable: true
  });

      
Object.defineProperty(navigator, 'language', {value:parent.getCurrLang(),configurable:false, enumerable:false});
Object.defineProperty(navigator, 'languages', {value:[parent.getCurrLang()],configurable:false, enumerable:false});


const originalMatchMedia = window.matchMedia;

window.matchMedia = function (query) {

    const match = query.match(
        /\\(\\s*display-mode\\s*:\\s*(fullscreen|standalone|minimal-ui|browser)\\s*\\)/i
    );

if (${JSON.stringify(!!fndApp?.display)}) {
    if (match) {
        const requestedMode = match[1].toLowerCase();
        const isMatching = requestedMode === ${JSON.stringify(fndApp?.display?.toLowerCase())};

        const modifiedQuery = query.replace(
            match[0],
            isMatching ? 'all' : 'not all'
        );



        return originalMatchMedia.call(window, modifiedQuery);
    }}

    return originalMatchMedia.call(window, query);
};

</script>
    `;







    let modifiedContent = content;
    const multipleRegex = /(<input[^>]*?)\s+multiple(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?([^>]*>)/gi;

if (fndApp?.display) {
modifiedContent = modifiedContent.replace(
    /\(\s*display-mode\s*:\s*(fullscreen|standalone|minimal-ui|browser)\s*\)/gi,
    (match, mode) =>
        mode.toLowerCase() === fndApp.display.toLowerCase()
            ? 'all'
            : 'not all'
);
}
    const fileHref = href;
modifiedContent = modifiedContent.replaceAll(
    /(?<![\w$.])(?:(?:document|window)\.)?location\.href(?!\s*=)/g,
    JSON.stringify(fileHref)
);
    modifiedContent = modifiedContent.replaceAll(/document\.title(?!\s*=)/g, `'${name}'`)

    modifiedContent = modifiedContent.replaceAll(/document\.location\.search(?!\s*=)/g, `'${safeTarget}'`);
    modifiedContent = modifiedContent.replaceAll(/window\.location\.search(?!\s*=)/g, `'${safeTarget}'`);
    modifiedContent = modifiedContent.replaceAll(/location\.search(?!\s*=)/g, `'${safeTarget}'`);

    //modifiedContent.replaceAll('documentPictureInPicture.requestWindow(', 'parent.documentPictureInPicture.requestWindow(');

    modifiedContent = modifiedContent.replaceAll('window.close()', `parent.kill('${fileWinBox.id}')`);
    modifiedContent = modifiedContent.replaceAll('self.close()', `parent.kill('${fileWinBox.id}') `);

    modifiedContent = modifiedContent.replace(multipleRegex, '$1$2');

    modifiedContent = modifiedContent.replaceAll('navigator.geolocation', 'window.fakeGeolocation');
    modifiedContent = modifiedContent.replaceAll('navigator.mediaDevices', 'window.fakeMediaDevices');
    modifiedContent = modifiedContent.replaceAll('navigator.wakeLock', 'window.fakeWakeLock');

    modifiedContent = modifiedContent.replaceAll('localStorage.', 'fakeStorage.');
    modifiedContent = modifiedContent.replaceAll('[localStorage]', '[fakeStorage]');
    modifiedContent = modifiedContent.replaceAll('Object.keys(fakeStorage)', 'Object.keys(localStorage)');
    modifiedContent = modifiedContent.replaceAll('Object.keys(window.fakeStorage)', 'Object.keys(localStorage)');

    modifiedContent = modifiedContent
        .replace(/(?<![^\s])confirm\(/g, 'await confirm(')
        .replace(/(?<![^\s])prompt\(/g, 'await prompt(');


        modifiedContent = modifiedContent.replace(/(?<!\.)\brequire\(/g, 'webRequire(');

    modifiedContent = modifiedContent.replace(
    /import\s+(?:(\w+)|\{\s*([^}]+)\s*\})\s+from\s+['"]([^'"]+)['"];?/g,
    (match, defaultImport, namedImports, path) => {
        if (path.startsWith('http') || path.startsWith('@')) {
            return match;
        }

        if (defaultImport) {
            return `const ${defaultImport} = webRequire('${path}');`;
        }

        return `const { ${namedImports.trim()} } = webRequire('${path}');`;
    }
);
    
    return [modifiedContent, redefiner, redefiner1];
    }



async function htmlToDocx(htmlString) {
    if (typeof JSZip === 'undefined') {
        throw new Error("JSZip is required to generate .docx files.");
    }

    const zip = new JSZip();

    // 1. Content Types (Register numbering.xml & styles.xml)
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`);

    // 2. Global Relationships
    zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    // 3. Document Relationships (Link document.xml to styles.xml and numbering.xml)
    zip.folder("word").folder("_rels").file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`);

    // 4. Styles Definition
    zip.folder("word").file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Center">
    <w:name w:val="Center"/>
    <w:pPr><w:jc w:val="center"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Right">
    <w:name w:val="Right"/>
    <w:pPr><w:jc w:val="right"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Left">
    <w:name w:val="Left"/>
    <w:pPr><w:jc w:val="left"/></w:pPr>
  </w:style>
</w:styles>`);

    // 5. Native OOXML Numbering Definitions (numId 1 = Bullet, numId 2 = Decimal)
    zip.folder("word").file("numbering.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
  <w:num w:numId="2">
    <w:abstractNumId w:val="1"/>
  </w:num>
</w:numbering>`);

    // Helper: Clean Hex Colors
    function cleanHexColor(colorStr) {
        if (!colorStr) return null;
        if (colorStr.startsWith('#')) return colorStr.slice(1).toUpperCase();
        const rgb = colorStr.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            return rgb.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('').toUpperCase();
        }
        return null;
    }

    // Helper: Recursively extract text runs with formatting
    function parseInlineNodes(node, currentStyle = {}) {
        let runsXml = '';

        node.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                if (!text) return;

                let rPr = '';
                if (currentStyle.bold) rPr += '<w:b/>';
                if (currentStyle.italic) rPr += '<w:i/>';
                if (currentStyle.underline) rPr += '<w:u w:val="single"/>';
                if (currentStyle.strike) rPr += '<w:strike/>';
                if (currentStyle.color) rPr += `<w:color w:val="${currentStyle.color}"/>`;

                runsXml += `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();
                const style = child.style || {};

                if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'center', 'ul', 'ol', 'li'].includes(tagName)) {
                    return;
                }

                const newStyle = {
                    bold: currentStyle.bold || ['b', 'strong'].includes(tagName) || style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600,
                    italic: currentStyle.italic || ['i', 'em'].includes(tagName) || style.fontStyle === 'italic',
                    underline: currentStyle.underline || ['u', 'ins'].includes(tagName) || style.textDecoration?.includes('underline'),
                    strike: currentStyle.strike || ['s', 'strike', 'del'].includes(tagName) || style.textDecoration?.includes('line-through'),
                    color: cleanHexColor(style.color) || currentStyle.color
                };

                if (tagName === 'br') {
                    runsXml += '<w:r><w:br/></w:r>';
                } else {
                    runsXml += parseInlineNodes(child, newStyle);
                }
            }
        });

        return runsXml;
    }

    function getAlignment(el) {
        const tagName = el.tagName.toLowerCase();
        const styleAlign = (el.style?.textAlign || el.getAttribute('align') || '').toLowerCase();
        const classList = el.classList;

        if (tagName === 'center' || styleAlign === 'center' || classList.contains('center')) {
            return { id: 'Center', val: 'center' };
        }
        if (styleAlign === 'right' || classList.contains('right')) {
            return { id: 'Right', val: 'right' };
        }
        if (styleAlign === 'left' || classList.contains('left')) {
            return { id: 'Left', val: 'left' };
        }
        return null;
    }

    // 6. Process HTML into Word Paragraphs (<w:p>)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;

    let wordXmlContent = '';

    function processBlockElement(element, listNumId = null) {
        const tagName = element.tagName ? element.tagName.toLowerCase() : '';

        // Handle List Containers
        if (tagName === 'ul') {
            Array.from(element.children).forEach(child => {
                if (child.tagName && child.tagName.toLowerCase() === 'li') {
                    processBlockElement(child, 1); // 1 = Bullet List
                }
            });
            return;
        }

        if (tagName === 'ol') {
            Array.from(element.children).forEach(child => {
                if (child.tagName && child.tagName.toLowerCase() === 'li') {
                    processBlockElement(child, 2); // 2 = Ordered List
                }
            });
            return;
        }

        let pPr = '';

        // Attach native OOXML numbering attributes for Mammoth parsing
        if (listNumId !== null) {
            pPr += `<w:numPr><w:numId w:val="${listNumId}"/><w:ilvl w:val="0"/></w:numPr>`;
        }

        const align = getAlignment(element);
        if (align) {
            pPr += `<w:pStyle w:val="${align.id}"/><w:jc w:val="${align.val}"/>`;
        }

        if (tagName.startsWith('h') && tagName.length === 2) {
            const level = tagName.replace('h', '');
            pPr += `<w:pStyle w:val="Heading${level}"/>`;
        }

        const runs = parseInlineNodes(element);

        if (runs) {
            wordXmlContent += `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs}</w:p>`;
        } else if (element.innerText && element.innerText.trim()) {
            const escaped = element.innerText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            wordXmlContent += `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
        }
    }

    Array.from(tempDiv.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) {
                const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                wordXmlContent += `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            processBlockElement(node);
        }
    });

    if (!wordXmlContent && tempDiv.innerText.trim()) {
        const escaped = tempDiv.innerText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        wordXmlContent = `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
    }

    // 7. Build Document XML
    zip.folder("word").file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${wordXmlContent}
  </w:body>
</w:document>`);

    return await zip.generateAsync({ 
        type: "blob", 
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
    });
}



// Parse GML key-value syntax, including nested brackets.

function parseGML(content) {
    if (typeof content !== 'string' || !content.trim()) {
        throw new Error('The GML file is empty or invalid.');
    }

    // Tokenize GML while preserving quoted strings and ignoring comments.
    function tokenize(source) {
        const tokens = [];
        let i = 0;

        while (i < source.length) {
            const ch = source[i];

            if (/\s/.test(ch)) {
                i++;
                continue;
            }

            // GML comments start with # outside quoted strings.
            if (ch === '#') {
                while (i < source.length && source[i] !== '\n') i++;
                continue;
            }

            if (ch === '[' || ch === ']') {
                tokens.push({ type: ch, value: ch });
                i++;
                continue;
            }

            if (ch === '"') {
                i++;
                let value = '';
                let closed = false;

                while (i < source.length) {
                    const c = source[i++];

                    if (c === '"') {
                        closed = true;
                        break;
                    }

                    if (c === '\\') {
                        if (i >= source.length) {
                            throw new Error('Unfinished escape in GML string.');
                        }

                        const escaped = source[i++];

                        switch (escaped) {
                            case '"': value += '"'; break;
                            case '\\': value += '\\'; break;
                            case 'n': value += '\n'; break;
                            case 'r': value += '\r'; break;
                            case 't': value += '\t'; break;
                            default:
                                // Preserve unknown escape sequences.
                                value += '\\' + escaped;
                        }
                    } else {
                        value += c;
                    }
                }

                if (!closed) {
                    throw new Error('Unterminated quoted string in GML.');
                }

                tokens.push({ type: 'string', value });
                continue;
            }

            // Unquoted key or value.
            const start = i;

            while (
                i < source.length &&
                !/\s/.test(source[i]) &&
                source[i] !== '[' &&
                source[i] !== ']' &&
                source[i] !== '#'
            ) {
                i++;
            }

            if (i === start) {
                throw new Error(`Unexpected character at position ${i}.`);
            }

            const raw = source.slice(start, i);
            const numberPattern =
                /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

            if (numberPattern.test(raw)) {
                const number = Number(raw);

                if (!Number.isFinite(number)) {
                    throw new Error(`Invalid numeric value: ${raw}`);
                }

                tokens.push({ type: 'value', value: number });
            } else {
                tokens.push({ type: 'value', value: raw });
            }
        }

        return tokens;
    }

    const tokens = tokenize(content);
    let pos = 0;

    function peek() {
        return tokens[pos];
    }

    function parseBlock() {
        const obj = {};

        while (pos < tokens.length && peek().type !== ']') {
            const keyToken = tokens[pos++];

            if (
                keyToken.type !== 'value' &&
                keyToken.type !== 'string'
            ) {
                throw new Error(
                    `Expected an attribute name at token ${pos - 1}.`
                );
            }

            const key = String(keyToken.value);

            if (pos >= tokens.length || peek().type === ']') {
                throw new Error(`Missing value for GML attribute "${key}".`);
            }

            let value;

            if (peek().type === '[') {
                pos++;
                value = parseBlock();

                if (!peek() || peek().type !== ']') {
                    throw new Error(`Missing closing bracket for "${key}".`);
                }

                pos++;
            } else {
                value = tokens[pos++].value;
            }

            // Preserve repeated keys, including node, edge and
            // repeated custom attributes.
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (!Array.isArray(obj[key])) {
                    obj[key] = [obj[key]];
                }

                obj[key].push(value);
            } else {
                obj[key] = value;
            }
        }

        return obj;
    }

    // Locate the graph block. Permit whitespace, comments, and
    // harmless leading content before it.
    let graphIndex = -1;

    for (let i = 0; i < tokens.length - 1; i++) {
        if (
            tokens[i].type === 'value' &&
            tokens[i].value === 'graph' &&
            tokens[i + 1].type === '['
        ) {
            graphIndex = i;
            break;
        }
    }

    if (graphIndex < 0) {
        throw new Error('No graph [ ... ] block found in the GML file.');
    }

    pos = graphIndex + 1; // Position at opening bracket.

    if (peek().type !== '[') {
        throw new Error('Invalid graph block.');
    }

    pos++;
    const result = parseBlock();

    if (!peek() || peek().type !== ']') {
        throw new Error('Unclosed graph block.');
    }

    pos++;

    if (pos !== tokens.length) {
        throw new Error('Unexpected content after the graph block.');
    }

    return result;
}

// Normalize graph.node and graph.edge into arrays.
// Keep the original attributes and nested data intact.
function normalizeGraph(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid GML graph.');
    }

    function asArray(value) {
        if (value == null) return [];
        return Array.isArray(value) ? value : [value];
    }

    const nodes = asArray(parsed.node);
    const edges = asArray(parsed.edge);

    const idMap = new Map();

    nodes.forEach((node, index) => {
        if (!node || typeof node !== 'object') {
            throw new Error(`Invalid node at index ${index}.`);
        }

        if (node.id === undefined || node.id === null) {
            throw new Error(`Node at index ${index} has no ID.`);
        }

        const key = String(node.id);

        if (idMap.has(key)) {
            throw new Error(`Duplicate node ID: ${key}`);
        }

        idMap.set(key, node);
    });

    edges.forEach((edge, index) => {
        if (!edge || typeof edge !== 'object') {
            throw new Error(`Invalid edge at index ${index}.`);
        }

        if (edge.source == null || edge.target == null) {
            throw new Error(`Edge at index ${index} needs source and target.`);
        }

        if (
            !idMap.has(String(edge.source)) ||
            !idMap.has(String(edge.target))
        ) {
            throw new Error(
                `Edge at index ${index} refers to a missing node.`
            );
        }
    });

    return {
        graph: parsed,
        nodes,
        edges
    };
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

          

          const typeclass = fileType.split("/")[0];
          let DO_NOT_REPLACE = false;
  const minWidth = 255;
  const minHeight = 200;

  const width = Math.max(window.innerWidth * 0.30, minWidth);
  const height = Math.max(window.innerHeight * 0.35, minHeight);

const fndApp = apps.find(a=>a.path == exfile.name);

if (fndApp  && type == 'text/html'){
if (fndApp.launch_handler__client_mode){
    let autoMode = 'navigate-new';
    if (detectMobile()) autoMode = 'navigate-existing';
        if (fndApp.launch_handler__client_mode == 'focus-existing' || fndApp.launch_handler__client_mode == 'navigate-existing' || (fndApp.launch_handler__client_mode == 'auto' && autoMode == 'navigate-existing')){
            const fndRun0 = runningApps.find(a=>a.name == fndApp.name)
            if (fndRun0){
                fore(fndRun0.id);
                return;
        }
            
        }else if (fndApp.launch_handler__client_mode == 'navigate-new' || (fndApp.launch_handler__client_mode == 'auto' && autoMode == 'navigate-new')) {
            // Continue
            console.log('New PWA window created: '+fndApp.name)
        }
    }
}

  fileWinBox = new wm(filestr, {
      icon: ic,
      x: "center",
      y: "center",
      class: [wbtheme, typeclass, "hidden", 'loading', 'no-full'],
      minwidth: minWidth,
      minheight: minHeight,
      width,
      height,
      html: `<div style="
    color: var(--color-text-primary);
    background-color: var(--bg-color);
    width: 100%;
    height: 100%;
    padding: 10px;
    box-sizing: border-box;
    display: flex;
    font-size: 20px;
    align-items: center;
    justify-content: center;
">${_('loading')}</div>`
  });

  if (fndApp && type == 'text/html'){
    if (fndApp.display){
        if (fndApp.display == 'minimal-ui'){
fileWinBox.addControl({
    // the position index
    index: 2,
    // classname to apply styling
    class: "wb-menu",
    // icon url when not specified via classname
    image: "",
    // click listener
    click: function(event, winbox){
        // the winbox instance will be passed as 2nd parameter
        alert(winbox.id);
        
    }
});

        }else if (fndApp.display == 'fullscreen'){
            fileWinBox.removeClass('no-full');
            fileWinBox.addClass('allow-full')
fileWinBox.fullscreen(1);
        }
    }
  }

        const reader = new FileReader();

        reader.onload = async function(e) {
            const content = e.target.result;
            let newContent = '';
            let wasSaved = true; // For those types, which aren't editable, or saveable.


      

            
            if (fileType == "application/x-theme" || fileType == 'application/x-kde-palette') {
    localStorage.setItem("theme", exfile.name);
    
            const parser = new ThemeParser();
            const thm = parser.parse(content, exfile.name); 
    await parser.applyTheme(thm.styles)
    await applyThemeToUI(thm.name)

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
    }  else if (fileType === 'application/wasm') {
            isEditable = false;
            
            // 1. Inject the canvas element directly using your window's element property
            newContent = `
                <canvas id='wasmcanvas' width='640' height='480' style='width:100%; height:100%; display:block;'></canvas>
            `;

            fileWinBox.body.innerHTML = newContent;
            DO_NOT_REPLACE = true;


            requestAnimationFrame(async()=>{const e=document.getElementById("wasmcanvas");if(!e)return console.error("Wasm canvas target could not be resolved.");const t=e.getContext("2d");try{const n=await WebAssembly.compile(content),o=WebAssembly.Module.imports(n),a={},r={env:{print:e=>console.log(e),random:()=>Math.random(),now:()=>performance.now(),abort:e=>{console.error(`WASM aborted (${e})`)},memory:new WebAssembly.Memory({initial:16,maximum:256}),table:new WebAssembly.Table({initial:0,element:"anyfunc"})}};o.forEach(e=>{a[e.module]||(a[e.module]={}),e.kind==="function"?a[e.module][e.name]=r[e.module]&&typeof r[e.module][e.name]=="function"?r[e.module][e.name]:(...t)=>console.warn(`[Wasm Missing Import Stub -> ${e.module}.${e.name} called with]:`,t):e.kind==="global"?a[e.module][e.name]=new WebAssembly.Global({value:"i32",mutable:!0},0):e.kind==="memory"?a[e.module][e.name]=new WebAssembly.Memory({initial:1}):e.kind==="table"&&(a[e.module][e.name]=new WebAssembly.Table({initial:0,element:"anyfunc"}))});const{instance:i,module:s}=await WebAssembly.instantiate(content,a),l=WebAssembly.Module.exports(s),c=l.find(e=>e.kind==="memory"),d=l.find(e=>e.kind==="function"&&["pointer","buffer","screen","output","mem"].some(t=>e.name.includes(t))),u=c?i.exports[c.name].buffer:i.exports.memory?.buffer||null,f=l.find(e=>e.kind==="function"&&["tick","render","generate","update","main","run","draw"].some(t=>e.name.includes(t))),m=l.filter(e=>e.kind==="function"),p=d?i.exports[d.name]:m.length>1?i.exports[m[0].name]:()=>0,h=f?i.exports[f.name]:m.length>1?i.exports[m[1].name]:i.exports[m[0].name];if(!h){console.error("Could not automatically map lifecycle functions from Wasm export metadata.");return}const g=u&&typeof h=="function"&&typeof p=="function";let y=0,v=!1;if(g)try{y=p(),v=Number.isInteger(y)&&y>=0}catch(e){v=!1}Object.entries(i.exports).forEach(([e,t])=>{typeof t=="function"&&(window.wasm[e]=t)});const b=JSON.parse(localStorage.getItem("autoload"))||[];b.includes(exfile.name)||console.log('ADDED (window.wasm):\n'+Object.keys(i.exports).join(", "));if(!v){fileWinBox.close();return}const w=e.width*e.height*4,E=u.byteLength-y;let M;if(E<w){console.warn(`Wasm memory buffer (${u.byteLength} bytes) is smaller than requested canvas layout (${w} bytes). Auto-scaling resolution down.`);try{M=new Uint8ClampedArray(u,y,Math.floor(E/4)*4)}catch(e){console.error("Wasm memory is insufficient to populate a standard graphical canvas frame context.");return}}else M=new Uint8ClampedArray(u,y,w);p();console.log("WASM getPointer: "+p.name);console.log("WASM renderFrameFn: "+h.name);function R(){h();const t=e.width*e.height*4;if(u.byteLength-y<t)return void requestAnimationFrame(R);const n=new Uint8ClampedArray(u,y,t);t&&ctx.putImageData(new ImageData(n,e.width,e.height),0,0),requestAnimationFrame(R)}R(),console.log(`Successfully parsed and loaded [${exfile.name}].`)}catch(e){console.error("Wasm runtime crashed during dynamic initialization:",e)}})
        }
    else if (fileType === "text/csv") {
      isEditable = true;


window.sheetToCsv = function (tableId, computed = false) {
    const table = document.getElementById(tableId);
    const Q = v => /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const grid = [...table.querySelectorAll('tbody tr')].map(tr =>
        [...tr.querySelectorAll('td')].map(td =>
            computed ? td.innerText.trim() : table.sheet.getRaw(td)));

    // drop only leading rows where every cell is empty
    while (grid.length && grid[0].every(v => v === '')) grid.shift();

    return grid.map(r => r.map(Q).join(',')).join('\n');
};


const initFormulas = (tableId) => {
    const table = document.getElementById(tableId);
    if (!table) return;

    const colIndex = s => s.toUpperCase().split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    const find = name => {
        const m = /^([A-Za-z]+)(\d+)$/.exec(name);
        return m ? table.querySelector(`td[data-row="${m[2] - 1}"][data-col="${colIndex(m[1])}"]`) : null;
    };
    const getRaw = td => td.dataset.raw !== undefined
        ? td.dataset.raw
        : td.innerText.replace(/\n$/, '').trim();
    const setRaw = (td, v) => { td.dataset.raw = v; td.innerText = v; };

    // Sloppy-mode helper so `with` works even if the surrounding code is strict
    const evalIn = new Function('__D', '__f', 'with(__D){return eval(__f)}');
    const evaluating = new Set();

    const valueOf = td => {
        const raw = getRaw(td);
        if (raw.charAt(0) !== '=' || raw == '=') {
            const n = parseFloat(raw);
            return isNaN(n) ? raw : n;
        }
        if (evaluating.has(td)) throw new Error('circular');
        evaluating.add(td);
        try { return evalIn(D, raw.slice(1)); }
        finally { evaluating.delete(td); }
    };

    // Any A1 / a1 / AA10 style identifier resolves to that cell's value;
    // everything else (Math, Date...) falls through to globals
    const D = new Proxy({}, {
        has: (t, k) => typeof k === 'string' && !!find(k),
        get: (t, k) => typeof k === 'string' ? valueOf(find(k)) : undefined
    });

    const refresh = () => {
        table.querySelectorAll('td[data-row]').forEach(td => {
            if (document.activeElement === td) return;
            const raw = getRaw(td);
            if (raw.charAt(0) !== '=' || raw == '=') return;
            let out;
            try { out = valueOf(td) == NaN ? "#NAN" : valueOf(td); } catch (e) { out = '#ERR'; }
            if (out == null) out = '';
            if (td.innerText !== String(out)) td.innerText = out;
        });
    };

    table.addEventListener('focusin', e => {
        const td = e.target;
        if (td.tagName === 'TD' && td.dataset.raw !== undefined) td.innerText = td.dataset.raw;
    });
    table.addEventListener('focusout', e => {
        const td = e.target;
        if (td.tagName !== 'TD') return;
        td.dataset.raw = td.innerText.replace(/\n$/, '');
        refresh();
    });

    table.querySelectorAll('td[data-row]').forEach(td => { td.dataset.raw = td.textContent.trim(); });
    table.sheet = { getRaw, setRaw, refresh };
    refresh();
};

      const initAutoFill = (tableId)=> {
      const controller = new AbortController();
  const { signal } = controller;
      const table = document.getElementById(tableId);
      const handle = document.getElementById(`fillHandle-${tableId}`);
      if (!table || !handle) return;

      let selectedCell = null;
      let isDragging = false;
      let dragTargetCell = null;

      // Reposition handle to bottom-right of active cell
      const updateHandlePosition=(cell) => {
          if (!cell) {
              handle.style.display = 'none';
              return;
          }
          selectedCell = cell;
          const rect = cell.getBoundingClientRect();
          const parentRect = table.parentElement.getBoundingClientRect();

          handle.style.display = 'block';
          handle.style.top = `${rect.bottom - parentRect.top + table.parentElement.scrollTop -6}px`;
          handle.style.left = `${rect.right - parentRect.left + table.parentElement.scrollLeft -6}px`;
      }

      // Sequence Generator
      const getNextValue = (baseVal, step) => {
          const trimmed = baseVal.trim();

          // 1. Numbers (1, 2, 3...)
if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return String(Number(trimmed) + step);
}

          // 2. Letters (a-z, A-Z)
          if (trimmed.length === 1 && /[a-zA-Z]/.test(trimmed)) {
              const charCode = trimmed.charCodeAt(0);
              const isUpper = charCode >= 65 && charCode <= 90;
              const baseCode = isUpper ? 65 : 97;
              const nextCode = baseCode + ((charCode - baseCode + step) % 26);
              return String.fromCharCode(nextCode);
          }

          // Default: copy value if pattern not recognized
          return baseVal;
      }

      // 1. Focus listener to attach handle
      table.addEventListener('focusin', (e) => {
          if (e.target.tagName === 'TD') updateHandlePosition(e.target);
      });

      // 2. Handle Mouse Down
      handle.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          isDragging = true;
      },{ signal });

      // 3. Highlight range during drag
      table.addEventListener('pointermove', (e) => {
          if (!isDragging || !selectedCell) return;
          const target = e.target.closest('td');
          if (!target) return;

          dragTargetCell = target;
          const startRow = parseInt(selectedCell.dataset.row);
          const startCol = parseInt(selectedCell.dataset.col);
          const endRow = parseInt(target.dataset.row);
          const endCol = parseInt(target.dataset.col);

          const minRow = Math.min(startRow, endRow);
          const maxRow = Math.max(startRow, endRow);
          const minCol = Math.min(startCol, endCol);
          const maxCol = Math.max(startCol, endCol);

          table.querySelectorAll('td').forEach(td => {
              const r = parseInt(td.dataset.row);
              const c = parseInt(td.dataset.col);
              if (r >= minRow && r <= maxRow && c >= minCol && c <= maxCol) {
                  td.classList.add('drag-highlight');
              } else {
                  td.classList.remove('drag-highlight');
              }
          });
      }, { signal });
  document.addEventListener('pointerdown', (e)=> {
    if (e.target.tagName === 'TD') updateHandlePosition(e.target);
    else updateHandlePosition()
  },{ signal })
      // 4. Perform Auto-Fill on Mouse Up
      document.addEventListener('pointerup', () => {
          if (!isDragging || !selectedCell || !dragTargetCell) {
              isDragging = false;
              return;
          }
          isDragging = false;

          const startRow = parseInt(selectedCell.dataset.row);
          const startCol = parseInt(selectedCell.dataset.col);
          const endRow = parseInt(dragTargetCell.dataset.row);
          const endCol = parseInt(dragTargetCell.dataset.col);

          const baseValue = table.sheet.getRaw(selectedCell);   // was selectedCell.innerText

          // Vertical vs Horizontal Drag priority
          const rowDiff = Math.abs(endRow - startRow);
          const colDiff = Math.abs(endCol - startCol);

          if (rowDiff >= colDiff) {
              // Vertical Drag (Up / Down)
              const dir = endRow >= startRow ? 1 : -1;
              for (let r = startRow + dir; dir > 0 ? r <= endRow : r >= endRow; r += dir) {
                  const step = Math.abs(r - startRow) * dir;
                  const cell = table.querySelector(`td[data-row="${r}"][data-col="${startCol}"]`);
                  if (cell) table.sheet.setRaw(cell, getNextValue(baseValue, step));
              }
          } else {
              // Horizontal Drag (Left / Right)
              const dir = endCol >= startCol ? 1 : -1;
              for (let c = startCol + dir; dir > 0 ? c <= endCol : c >= endCol; c += dir) {
                  const step = Math.abs(c - startCol) * dir;
                  const cell = table.querySelector(`td[data-row="${startRow}"][data-col="${c}"]`);
                  if (cell) table.sheet.setRaw(cell, getNextValue(baseValue, step));
              }
          }
table.sheet.refresh();
          // Cleanup highlights & update position
          table.querySelectorAll('td').forEach(td => td.classList.remove('drag-highlight'));
          updateHandlePosition(dragTargetCell);
      },{ signal });
      fileWinBox.onclose = ()=>{
  controller.abort('Spreadsheet closed');
  }
  }




// Helper to convert 0-based column index to Excel letters (0 -> A, 25 -> Z, 26 -> AA)
function getColLabel(index) {
    let label = '';
    let i = index;
    while (i >= 0) {
        label = String.fromCharCode((i % 26) + 65) + label;
        i = Math.floor(i / 26) - 1;
    }
    return label;
}

function parseCsv(text) {
    const rows = []; let row = [], f = '', q = false;
    text = text.replace(/^\ufeff/, '');
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) {
            if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
            else f += ch;
        } else if (ch === '"') q = true;
        else if (ch === ',') { row.push(f); f = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(f); rows.push(row); row = []; f = '';
        } else f += ch;
    }
    row.push(f); rows.push(row);
    return rows;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rows = parseCsv(content.trimEnd());

// Determine max column count across all rows
const maxCols = Math.max(...rows.map(r => r.length), 0);

let tableHtml = `
<table id="${uniqueFileId}" style=" border-spacing: 0;width:100%; border-collapse:collapse; padding:0; margin:0; color: var(--color-text-primary); user-select: none;">`;

// 1. Render Top Column Headers (Corner cell + A, B, C...)
tableHtml += "<thead><tr style='text-align: center; font-weight: bold; position: sticky; top: 0; z-index: 2; background: var(--toolbar-bg);'>";
tableHtml += "<th style='border:1px solid #ccc; padding:5px 10px; width:40px; min-width:40px; background: var(--toolbar-bg);'></th>"; // Top-left corner

for (let c = 0; c < maxCols; c++) {
    tableHtml += `<th style='border:1px solid #ccc; padding:5px 10px; min-width:60px; background: var(--toolbar-bg); font-size:15px;'>${getColLabel(c)}</th>`;
}
tableHtml += "</tr></thead><tbody>";

// 2. Render Data Rows with Left Row Numbers (1, 2, 3...)
rows.forEach((row, rowIndex) => {
    tableHtml += "<tr>";
    
    // Row Index Header Cell
    tableHtml += `<th style="border:1px solid #ccc; padding:5px 10px; background: var(--toolbar-bg); font-size:15px; text-align:center; position: sticky; left: 0; z-index: 1;">${rowIndex + 1}</th>`;
    
    row.forEach((cell, cellIndex) => {
        tableHtml += `<td contenteditable="true" 
                        data-row="${rowIndex}" data-col="${cellIndex}"
                        style="border:1px solid #ccc; padding:5px; min-width:60px; position:relative;">
                        ${cell}</td>`;
    });

    // Fill remaining empty cells if row length is shorter than maxCols
    for (let c = row.length; c < maxCols; c++) {
        tableHtml += `<td contenteditable="true" 
                        data-row="${rowIndex}" data-col="${c}"
                        style="border:1px solid #ccc; padding:5px; min-width:60px; position:relative;"></td>`;
    }

    tableHtml += "</tr>";
});

tableHtml += `</tbody></table>
<div id="fillHandle-${uniqueFileId}" class="fill-handle" style="display:none; position:absolute; width:5px; height:5px; background:var(--accent-color, #0078d7); border:1px solid #fff; cursor:crosshair; z-index:10;"></div>
<style>
  #${uniqueFileId} td { user-select: text; }
  #${uniqueFileId} td:focus { outline: 1px solid var(--accent-color, #0078d7) !important; z-index: 1; }
  #${uniqueFileId} td.drag-highlight { background: var(--accent-color, #0078d7) !important; color: #fff; }
</style>`;
// Global helper (ensure this exists in scope or window)
window.getColLabel = function(index) {
    let label = '';
    let i = index;
    while (i >= 0) {
        label = String.fromCharCode((i % 26) + 65) + label;
        i = Math.floor(i / 26) - 1;
    }
    return label;
};

window.addRow = function(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const tbody = table.querySelector('tbody') || table;
    const rowIndex = tbody.children.length; // 0-based data row index
    const colCount = table.querySelectorAll('thead th').length - 1; // subtract corner th
    
    const tr = document.createElement('tr');

    // 1. Add sticky Row Header (1, 2, 3...)
    const th = document.createElement('th');
    th.textContent = rowIndex + 1;
    th.style.cssText = "border:1px solid #ccc; padding:4px 8px; background: var(--toolbar-bg); font-size:15px; text-align:center; position: sticky; left: 0; z-index: 1;";
    tr.appendChild(th);

    // 2. Add standard data cells
    for (let c = 0; c < (colCount > 0 ? colCount : 1); c++) {
        const td = document.createElement('td');
        td.contentEditable = "true";
        td.dataset.row = rowIndex;
        td.dataset.col = c;
        td.style.cssText = "border:1px solid #ccc; padding:5px; min-width:60px; position:relative;";
        tr.appendChild(td);
    }

    tbody.appendChild(tr);
};

window.addCol = function(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;

    // 1. Calculate new column index
    const headerRow = table.querySelector('thead tr');
    const existingCols = headerRow ? headerRow.children.length - 1 : 0; // subtract corner cell
    const newColIndex = existingCols;

    // 2. Append new Column Header (A, B, C...) to <thead>
    if (headerRow) {
        const th = document.createElement('th');
        th.textContent = window.getColLabel(newColIndex);
        th.style.cssText = "border:1px solid #ccc; padding:4px 8px; min-width:60px; background: var(--toolbar-bg); font-size:15px;";
        headerRow.appendChild(th);
    }

    // 3. Append new <td> cell to each row in <tbody>
    const bodyRows = table.querySelectorAll('tbody tr');
    bodyRows.forEach((tr, rIndex) => {
        const td = document.createElement('td');
        td.contentEditable = "true";
        td.dataset.row = rIndex;
        td.dataset.col = newColIndex;
        td.style.cssText = "border:1px solid #ccc; padding:5px; min-width:60px; position:relative;";
        tr.appendChild(td);
    });
};

      newContent = `
        <div id="csvContainer-${uniqueFileId}" style="height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background-color: var(--bg-color); position: relative;">
          <div class="toolbar" style="flex-shrink: 0;">
            
        <select style='appearance: base-select; height:25px;' id="save-mode-${uniqueFileId}">
  <!-- This button automatically acts as the native trigger -->
<button id="saveBtn-${uniqueFileId}">${_('save_btn')}</button>
  <option value='saveNone' disabled hidden selected></option>
  <option value="csv_pres">CSV (${_('with_formulas_preservation')})</option>
  <option value="csv">CSV (${_('computed_values')})</option>
</select>
            <button id="printBtn-${uniqueFileId}">${_('print_btn')}</button>
            <button id="findBtn-${uniqueFileId}">${_('find_btn')}</button>
            <vr></vr> 
            <button style='width:25px' id="PBtn-${uniqueFileId}" onclick='document.getElementById("${uniqueFileId}").style.fontSize = parseFloat(window.getComputedStyle(document.getElementById("${uniqueFileId}")).getPropertyValue("font-size"))+5+"px";'>+</button>
            <button style='width:25px' id="MBtn-${uniqueFileId}" onclick='document.getElementById("${uniqueFileId}").style.fontSize = (parseFloat(window.getComputedStyle(document.getElementById("${uniqueFileId}")).getPropertyValue("font-size")) > 5 ) ? parseFloat(window.getComputedStyle(document.getElementById("${uniqueFileId}")).getPropertyValue("font-size"))-5+"px": parseFloat(window.getComputedStyle(document.getElementById("${uniqueFileId}")).getPropertyValue("font-size"));' style="padding: 4px 8px; border: 1px solid #aaa; background-color: #ddd;">-</button>
        <vr></vr>
<button onclick="addRow('${uniqueFileId}')">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-bar-down" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M1 3.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13a.5.5 0 0 1-.5-.5M8 6a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 .708-.708L7.5 12.293V6.5A.5.5 0 0 1 8 6"/>
</svg>
</button>
<button onclick="addCol('${uniqueFileId}')">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-bar-right" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M6 8a.5.5 0 0 0 .5.5h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L12.293 7.5H6.5A.5.5 0 0 0 6 8m-2.5 7a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 1 0v13a.5.5 0 0 1-.5.5"/>
</svg>
</button>
          </div>
          <div style="flex: 1; overflow: auto; background-color: var(--bg-color); position: relative;">
            ${tableHtml}
          </div>
        </div>`;

      // Attach drag logic after DOM injection
      setTimeout(() => { initFormulas(uniqueFileId); initAutoFill(uniqueFileId); }, 0);
  } else if (fileType === "text/markdown" || fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        isEditable = true;
        fileWinBox.addClass("file-e");
        document.execCommand('styleWithCSS', false, false);
document.execCommand('defaultParagraphSeparator', false, 'p');


    if (fileType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            const options = {
                styleMap: [
                  "u => u", // Map Word underline explicitly to <u> tag
                    "p[style-name='Center'] => center",
                    "p[style-name='Right'] => p.right",
                    "p[style-name='Left'] => p.left",
                    // Явний мапінг для нумерованих та маркованих списків:
                "p[style-name='List Paragraph'] => li",
                "p[style-name='Bullet List'] => ul > li",
                "p[style-name='Numbered List'] => ol > li"
                ]
            };
if (content.byteLength > 0) {
    const result = await mammoth.convertToHtml(
        { arrayBuffer: content },
        options
    );
    initialHtml = result.value;
} else {
    initialHtml = '';
    console.log('NEW DOCX');
}
            
        } else {
            initialHtml = marked.parse(content);

const temp = document.createElement('div');
temp.innerHTML = initialHtml;

temp.querySelectorAll('del').forEach(el => {
    const s = document.createElement('s');
    s.innerHTML = el.innerHTML;
    el.replaceWith(s);
});

initialHtml = temp.innerHTML;
        }

        window.input = (text) => {
    try{
      wasSaved = false;
      
            const symLabel = fileWinBox.body.querySelector("#sym-"+uniqueFileId);
            if (symLabel) symLabel.innerText = text.length+"sym";
    }catch{}
        }

window.execAndCheck = function(id, cmd) {
    const editor = document.getElementById(id);
    if (!editor) return;

    editor.focus();

    if (cmd === 'insertOrderedList' || cmd === 'insertUnorderedList') {
        const listTag = cmd === 'insertOrderedList' ? 'ol' : 'ul';

        // If already inside this list, toggle it off.
        const selection = window.getSelection();
        let node = selection?.anchorNode;
        if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;

        const currentList = node?.parentElement?.closest('ul, ol')
            || node?.closest?.('ul, ol');

        if (currentList && currentList.tagName.toLowerCase() === listTag) {
            document.execCommand(cmd, false, null);
        } else {
            document.execCommand(cmd, false, null);
        }
    } else {
        document.execCommand(cmd, false, null);
    }

    updateToolbarState(id);
};

window.applyHeading = function(id, tagName) {
    const editor = document.getElementById(id);
    if (!editor) return;

    editor.focus();

    // Toggle the current heading off when the same heading is selected.
    const selection = window.getSelection();
    let node = selection?.anchorNode;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;

    const currentBlock = node?.closest?.('h1, h2, h3, p');

    if (currentBlock && currentBlock.tagName.toLowerCase() === tagName.toLowerCase()) {
        document.execCommand('formatBlock', false, '<p>');
    } else {
        document.execCommand('formatBlock', false, `<${tagName}>`);
    }

    updateToolbarState(id);
};

// Check cursor position and apply .ok class to active buttons
window.updateToolbarState = function(id) {
    const editor = document.getElementById(id);
    const container = document.getElementById(`toolbar-${id}`);
    if (!editor || !container) return;

    // 1. Check inline & list styles using queryCommandState
    const cmdButtons = container.querySelectorAll('button[data-cmd]');
    cmdButtons.forEach(btn => {
        const cmd = btn.getAttribute('data-cmd');
        try {
            if (document.queryCommandState(cmd)) {
                btn.classList.add('ok');
            } else {
                btn.classList.remove('ok');
            }


        } catch {
            btn.classList.remove('ok');
        }
    });

    // 2. Check Block Format (H1, H2, H3, P)
    let blockVal = '';
    try {
        blockVal = (document.queryCommandValue('formatBlock') || '').toLowerCase();
    } catch {}

    ['h1', 'h2', 'h3', 'p'].forEach(tag => {
        const btn = document.getElementById(`btn-${tag}-${id}`);
        if (!btn) return;

        if (blockVal.includes(tag)) {
            btn.classList.add('ok');
        } else {
            btn.classList.remove('ok');
        }
    });
};

        newContent = `
    <div style="background: #e0e0e0; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">

        <div class="toolbar" id="toolbar-${uniqueFileId}" style="position: sticky; top: 0; overflow-x: auto; z-index: 2;">
            <button id="saveBtn-${uniqueFileId}">${_('save_btn')}</button>
            <button id="printBtn-${uniqueFileId}">${_('print_btn')}</button>
            <button id="findBtn-${uniqueFileId}">${_('find_btn')}</button>

            <vr></vr>

            <button data-cmd="bold" onclick="execAndCheck('${uniqueFileId}', 'bold')"><b>B</b></button>
            <button data-cmd="italic" onclick="execAndCheck('${uniqueFileId}', 'italic')"><i>I</i></button>
            <button data-cmd="underline" onclick="execAndCheck('${uniqueFileId}', 'underline')"><u>U</u></button>
            <button data-cmd="strikeThrough" onclick="execAndCheck('${uniqueFileId}', 'strikethrough')"><strike>S</strike></button>
            <vr></vr>
            <button data-cmd="insertUnorderedList" onclick="execAndCheck('${uniqueFileId}', 'insertUnorderedList')">UL</button>
            <button data-cmd="insertOrderedList" onclick="execAndCheck('${uniqueFileId}', 'insertOrderedList')">OL</button>
            ${fileType !== "text/markdown" ? `
            <vr></vr>
            <button data-cmd="justifyLeft" onclick="execAndCheck('${uniqueFileId}', 'justifyLeft')">L</button>
            <button data-cmd="justifyCenter" onclick="execAndCheck('${uniqueFileId}', 'justifyCenter')">C</button>
            <button data-cmd="justifyRight" onclick="execAndCheck('${uniqueFileId}', 'justifyRight')">R</button>
` : ''}
            <vr></vr>
            <button id="btn-h1-${uniqueFileId}" onclick="applyHeading('${uniqueFileId}', 'h1')">H1</button>
            <button id="btn-h2-${uniqueFileId}" onclick="applyHeading('${uniqueFileId}', 'h2')">H2</button>
            <button id="btn-h3-${uniqueFileId}" onclick="applyHeading('${uniqueFileId}', 'h3')">H3</button>
            <button id="btn-p-${uniqueFileId}" onclick="applyHeading('${uniqueFileId}', 'p')">¶</button>
        </div>

        <div style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px 0; background:var(--bg-color)">
            <div contenteditable="true"
                 class='no-font'
                 oninput='input(this.innerText)'
                 id="${uniqueFileId}"
                 style="margin: 0 auto;
                        width: 500px;
                        outline: none;
                        background: white !important;
                        color: black;
                        white-space: normal;
                        aspect-ratio: 210 / 297;
                        box-sizing: border-box;
                        box-shadow: 0 0 15px rgba(0,0,0,0.2);">${initialHtml}</div>
        </div>

        <div class="footer" style="justify-content: space-between; padding: 5px; margin: 0; border-top: 1px solid #ccc; font-size: 15px;">
        <span>
        
            <span id="sym-${uniqueFileId}"></span>
            <span id="scale-${uniqueFileId}"></span>
        </span>
            <input type="range"
                   oninput='document.getElementById("${uniqueFileId}").style.width = this.value + "px"; document.getElementById("scale-${uniqueFileId}").innerText=document.getElementById("${uniqueFileId}").style.width;'
                   min="200" max="1200" value="500" step="50"
                   style="margin-right: 10px; cursor: pointer;" />
        </div>

    </div>
`;



setTimeout(() => {
    const el = document.getElementById(uniqueFileId);
    if (el) {
        window.input(el.innerText);

        // Update active toggles when selection changes or cursor moves
        const handler = () => window.updateToolbarState(uniqueFileId);
        
        el.addEventListener('keyup', handler);
        el.addEventListener('mouseup', handler);
        el.addEventListener('click', handler);
        
        // Listen on document selection change for fine caret movements
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === el) {
                window.updateToolbarState(uniqueFileId);
            }
        });
    }
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
                }else if (fileType.trim() == "application/vnd.cups-ppd"){
                  isEditable = false;
  const ppd = PPD.parse(content);



window.onPrinterConnected({name:ppd.attributes.ModelName});
fileWinBox.close();

                }else if (fileType.trim() == "text/x-doldoc"){
                  isEditable = false;
newContent = dolDocToHtml(content);

                } else if (fileType.startsWith("text/") || !exfile.name.split("/").pop().substring(1).includes(".")) {
                 if (fileType == 'text/vnd.gml') {
    isEditable = false;

newContent = `
    <canvas class="gml-canvas" style="
        display: block;
        width: 100%;
        height: 100%;
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        box-sizing: border-box;
        background-color: var(--bg-color);
    "></canvas>
`;

// fileWinBox.addClass('no-max')

fileWinBox.body.innerHTML = newContent;
DO_NOT_REPLACE = true;



    // Query within this window, not the whole document.
    const canvas = fileWinBox.body.querySelector('.gml-canvas');
    


    // Wait until the browser has laid out the window.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            try {
                const parsed = parseGML(content);
                const graph = parsed.graph || parsed;

                const nodes = [].concat(graph.node || []);
                const edges = [].concat(graph.edge || []);

                if (nodes.length === 0) {
                    throw new Error(
                        'No nodes found. Check the GML structure and parser.'
                    );
                }

                const ctx = canvas.getContext('2d');

                
function drawGraph(w=0,h=0) {
    const rect = canvas.getBoundingClientRect();


if (w==0) w = rect.width;
if (h==0) h = rect.height;
    if (!Array.isArray(nodes) || !Array.isArray(edges) || !graph) {
        throw new Error('Graph data has not been initialized.');
    }

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width =  w || rect.width;
    const height = h || rect.height;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Canvas 2D context is unavailable.');
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (nodes.length === 0) {
        return true;
    }

    const isDirected = Number(graph.directed ?? 0) === 1;

    const radius = Math.max(
        4,
        Math.min(20, width / 60, height / 60, 300 / Math.sqrt(nodes.length))
    );

    const positions = new Map();
    const idKey = value => String(value);

    // Circular layout, with enough margin for nodes.
    const margin = radius + 14;
    const layoutRadius = Math.max(
        0,
        Math.min(
            (width - margin * 2) / 2,
            (height - margin * 2) / 2
        )
    );

    nodes.forEach((node, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / nodes.length;

        positions.set(idKey(node.id), {
            x: width / 2 + Math.cos(angle) * layoutRadius,
            y: height / 2 + Math.sin(angle) * layoutRadius
        });
    });

    // Group edges by unordered endpoint pair so that reciprocal
    // and parallel edges can be separated visually.
    const groups = new Map();

    edges.forEach(edge => {
        const source = idKey(edge.source);
        const target = idKey(edge.target);
        const pairKey = [source, target].sort().join('\u0000');

        if (!groups.has(pairKey)) groups.set(pairKey, []);
        groups.get(pairKey).push(edge);
    });

    const edgeOffsets = new Map();

    groups.forEach(group => {
        group.forEach((edge, i) => {
            // A lone non-loop edge stays straight.
            const offset = group.length === 1 ? 0 :
                (i - (group.length - 1) / 2) * 24;

            edgeOffsets.set(edge, offset);
        });
    });

    function edgeColor(edge) {
        return typeof edge.color === 'string'
            ? edge.color
            : '#94a3b8';
    }

    function edgeWidth(edge) {
        // Support common weight attributes without requiring them.
        const raw = edge.weight ?? edge.count ?? edge.value;
        const value = Number(raw);

        if (raw == null || !Number.isFinite(value) || value <= 0) {
            return 1.5;
        }

        return Math.max(1, Math.min(6, 1 + Math.sqrt(value) * 0.8));
    }

    function nodeColor(node) {
        // Support common custom color attributes.
        const custom = node.color ?? node.fill ?? node.fillcolor;

        if (typeof custom === 'string' && custom.trim()) {
            return custom;
        }
        

        return '#64748b';
    }

    function drawArrow(x, y, angle, color) {
        const size = 8;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
            x - size * Math.cos(angle - Math.PI / 6),
            y - size * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(x, y);
        ctx.lineTo(
            x - size * Math.cos(angle + Math.PI / 6),
            y - size * Math.sin(angle + Math.PI / 6)
        );

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // Draw edges first, so nodes appear on top of their endpoints.
    edges.forEach(edge => {
        const a = positions.get(idKey(edge.source));
        const b = positions.get(idKey(edge.target));

        if (!a || !b) return;

        const color = edgeColor(edge);
        const lineWidth = edgeWidth(edge);

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = 0.75;
        ctx.lineCap = 'round';

        // Self-loop.
        if (idKey(edge.source) === idKey(edge.target)) {
            const loopRadius = radius + 12;

            ctx.beginPath();
            ctx.arc(
                a.x,
                a.y - radius,
                loopRadius,
                Math.PI * 0.15,
                Math.PI * 2.1
            );
            ctx.stroke();

            if (isDirected) {
                const endX = a.x + loopRadius * Math.cos(Math.PI * 0.15);
                const endY = a.y - radius +
                    loopRadius * Math.sin(Math.PI * 0.15);

                drawArrow(
                    endX,
                    endY,
                    Math.PI * 0.15 + Math.PI / 2,
                    color
                );
            }

            ctx.globalAlpha = 1;
            return;
        }

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);

        if (distance === 0) {
            ctx.globalAlpha = 1;
            return;
        }

        const ux = dx / distance;
        const uy = dy / distance;
        const offset = edgeOffsets.get(edge) || 0;

        const startX = a.x + ux * radius;
        const startY = a.y + uy * radius;
        const endX = b.x - ux * radius;
        const endY = b.y - uy * radius;

        let controlX = (startX + endX) / 2 - uy * offset;
        let controlY = (startY + endY) / 2 + ux * offset;

        ctx.beginPath();
        ctx.moveTo(startX, startY);

        if (offset === 0) {
            ctx.lineTo(endX, endY);
        } else {
            ctx.quadraticCurveTo(
                controlX,
                controlY,
                endX,
                endY
            );
        }

        ctx.stroke();

        if (isDirected) {
            // Tangent to the curve at its endpoint.
            const tangentX = endX - controlX;
            const tangentY = endY - controlY;
            const angle = Math.atan2(tangentY, tangentX);

            drawArrow(endX, endY, angle, color);
        }

        ctx.globalAlpha = 1;
    });

    // Draw nodes and labels.
    nodes.forEach(node => {
        const p = positions.get(idKey(node.id));
        if (!p) return;

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);

        ctx.fillStyle = nodeColor(node);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, radius * 0.12);
        ctx.stroke();

        const label = String(node.label ?? node.id);

        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(8, Math.min(12, radius * 0.8))}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(label, p.x, p.y, radius * 1.8);
    });

    return true;
}


                 /* info.textContent =
                    `${nodes.length} nodes · ${edges.length} edges`;
                    */

                drawGraph();

                // Redraw when the window is resized.
                function redrawGraph(w=0,h=0,timer=false) {
    setTimeout(() => {
        drawGraph(w,h);
    },timer ? 100 : 10);
}

fileWinBox.onresize = function (w, h) {
    redrawGraph(w,h);
};

fileWinBox.onmaximize = ()=> redrawGraph(0,0,true);
fileWinBox.onmaximize = ()=> redrawGraph(0,0,true);

            } catch (error) {
                // info.textContent = 'GML error: ' + error.message;
                console.error('GML rendering failed:', error);
            }
        });
    });
    }else if (fileType == "text/html"){
                 const titleMatch = content.match(/<title>(.*?)<\/title>/i);   
    fileWinBox.setTitle(titleMatch ? titleMatch[1] : ( fndApp?.name || exfile.name))
                    let win;

   win = [...document.querySelectorAll('.winbox.hide')]
    .find(win => win.querySelector('.wb-title')?.textContent ===fndApp?.name.trim());


if (win) {
    const wb = win.winbox;

    if (wb) {
      console.log('FORE1')
        wb.show();
        wb.focus();
        fileWinBox.close()
        return;
    }

   
}

const iconMatch = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);


        if (fndApp?.icon || iconMatch) fileWinBox.setIcon( iconMatch ? iconMatch[1] : fndApp?.icon)
        else fileWinBox.setIcon('')

             const name = (fndApp?.name) ? fndApp?.name.trim() : exfile.name;
           const target = typeof file == 'string' ? '?'+file.split('?').pop() : '';

           const href = typeof file == 'string' ? file : exfile.name;

    let [modifiedContent, redefiner, redefiner1] = await makeApp(content, name, target, href, fileWinBox, fndApp);


runningApps.push({id:fileWinBox.id, name:name});


    if (content.includes("new Notification(") ) {
        
        fileWinBox.onclose = (urgent) => {

    if (!urgent) {
        console.log(`Background mode activated for ${fileWinBox.title}`);

        fileWinBox.hide();

        return true;
    }

    // Remove app from runningApps
    const index = runningApps.findIndex(
        a => a.id === fileWinBox.id
    );

    if (index !== -1) {
        runningApps.splice(index, 1);
    }

    console.log("Force close! Terminating background process.");

    return false;
};
    }else{
        fileWinBox.onclose = () => {
            const index = runningApps.findIndex(
        a => a.id === fileWinBox.id
    );

    if (index !== -1) {
        runningApps.splice(index, 1);
    }   
        }
    }



    fileWinBox.addClass("file-r");
    newContent = `
          <div style="height: 100%; width: 100%;">
              <iframe 
                  id="fileWinBox-frame-${fileWinBox.id}"
                  srcdoc=" ${redefiner.replace(/"/g, '&quot;')} ${modifiedContent.replace(/"/g, '&quot;')} ${redefiner1.replace(/"/g, '&quot;')}" 
                  style="width: 100%; height: 100%; border: none; ${(fndApp?.background_color ? 'background-color: '+ fndApp.background_color+';' : '')}"
                  onload="parent.applySystemConfig('${fileWinBox.id}')">
              </iframe>
          </div>
    `;
                } else if (fileType == 'text/css'){
                    const sty = document.createElement('style');
                    sty.innerText = content;
                    document.body.appendChild(sty);
                    fileWinBox.close(); // Don't need a window
                }
                else if (fileType == "text/javascript"){
                    try{
                    newContent = eval(content)
                }catch(e){
                    onerror(e.message, exfile.name, 0,0,e)
}
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
                            <textarea id="${uniqueFileId}" oninput='wasSaved=false;' style="flex-grow: 1; height:100%; resize: none; border:none; padding: 10px; font-size: 15px;">${safeContent}</textarea>
                        </div>
                    `;
                 

                }
                
            } else if (fileType.startsWith("image/")) {
                fileWinBox.addClass("tra")
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
        
        newContent = `<style>.blinking{animation:blinking 1s infinite step-end}@keyframes blinking{0%{opacity:0}50%{opacity:1}}.snd{appearance:none;-webkit-appearance:none;width:90%;height:15px;margin-left:5px;border-radius:0}.snd::-webkit-meter-bar{border:none;border-radius:0}.snd::-webkit-meter-optimum-value{background-image:repeating-linear-gradient(to right,#4caf50,#4caf50 6px,transparent 6px,transparent 9px);background-size:auto 100%;border-radius:0}.snd::-moz-meter-bar{background-image:repeating-linear-gradient(to right,#4caf50,#4caf50 6px,transparent 6px,transparent 9px)}</style><div style="display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden"><div style="display:flex;height:70px"><div id="time-block-${uniqueFileId}" style="display:flex;flex-direction:column;width:130px;border-right:1px solid #444;background:rgba(0,0,0,.5);color:#0f0;font-family:monospace;font-weight:bold;align-items:center;justify-content:center;position:relative;border-bottom-left-radius:10px"><div style="display:flex;flex-direction:column;gap:2px;width:100%"><meter id="meter-l-${uniqueFileId}" min="0" max="100" value="0" class="snd" style="flex-grow:1;display:block"></meter><meter id="meter-r-${uniqueFileId}" min="0" max="100" value="0" class="snd" style="flex-grow:1;display:block"></meter></div><div style="display:flex;flex-direction:row;line-height:15px"><sub id="play-status-${uniqueFileId}" style="color:#a00">\u25FC</sub><b id="time-text-${uniqueFileId}">0:00</b></div></div><div style="flex-grow:1;background:rgba(0,0,0,.5);overflow:hidden;display:flex;align-items:center;border-bottom-right-radius:10px"><marquee scrollamount="1" style="font-size:20px;font-weight:bold;color:#fff;display:block;width:100%;font-family:monospace">${fileName}</marquee></div></div><div style="padding:10px;display:flex;align-items:center"><input type="range" id="seek-${uniqueFileId}" style="flex-grow:1;height:10px" min="0" max="100" value="0"></div><div style="padding:5px;display:flex;justify-content:space-evenly;align-items:center;color:#000"><button id="ctrl-prev-${uniqueFileId}" title="Prev"><</button><button id="ctrl-pause-${uniqueFileId}" style="color:#ff0">||</button><button id="ctrl-play-${uniqueFileId}" style="flex:1;color:#0a0">\u25B6</button><button id="ctrl-stop-${uniqueFileId}" style="color:#a00">\u25FC</button><button id="ctrl-next-${uniqueFileId}" title="Next">></button></div><audio id="${uniqueFileId}" src="${content}" autoplay></audio></div>`;


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
        }else {
        
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

                newContent = `<div style="height: 100%; overflow-y:hidden;"> <video controls src="${content}" style="width: 100%; height: 100%;max-width: 100%; max-height: 100%; object-fit: contain;padding:0; margin:0;" disablepictureinpicture ></video> </div>`;
                
            } else if (fileType == "application/pdf" && navigator.pdfViewerEnabled) {
                newContent= `
                 <div style="height: 100%; overflow-y:hidden;">
                 <embed src="${content}#toolbar=0" type="application/pdf" style="width: 100%; height: 100%;">
                 </div> 
                `;
            } else {

                newContent = `<div style="
    color: var(--color-text-primary);
    background-color: var(--bg-color);
    width: 100%;
    height: 100%;
    padding: 10px;
    box-sizing: border-box;
">${_('unsupported_file_type')}</div>`;            }
            
            try{
                if (!DO_NOT_REPLACE) fileWinBox.body.innerHTML = newContent;
            }catch{
                console.warn('Running non-window application. Exiting GPU draw.')
            }

            if (isEditable) {

                const printButton = fileWinBox.body.querySelector(`#printBtn-${uniqueFileId}`);
                const findButton = fileWinBox.body.querySelector(`#findBtn-${uniqueFileId}`);
                const saveButton = fileWinBox.body.querySelector(`#saveBtn-${uniqueFileId}`);
                const textArea = fileWinBox.body.querySelector(`#${uniqueFileId}`);
                const sizePButton = fileWinBox.body.querySelector(`#PBtn-${uniqueFileId}`)
                const sizeMButton = fileWinBox.body.querySelector(`#MBtn-${uniqueFileId}`)
                const saveMode = fileWinBox.body.querySelector(`#save-mode-${uniqueFileId}`);
                if (saveMode){
                    console.log(`Value picked is here!`);
                saveMode.addEventListener('change',async (e) => {
                    console.log(`Value picked: ${e.target.value}`);
                    // 1 = "formulas preserved". Falls back to 0 where the property doesn't exist (native browsers)
        const prsrvFormulas = (e.target.value  == 'csv_pres')?  1 : 0;
        const newTextContent = sheetToCsv(uniqueFileId, !prsrvFormulas);

                    const newFile = new File([newTextContent], exfile.name, { type: exfile.type ,lastModified: Date.now() });

                    const index = fs.findIndex(item => item.name === exfile.name);
                    if (index !== -1) {
                        fs[index] = newFile;

                        await saveFileToDB(newFile);
                               
                        window.dispatchEvent(new CustomEvent("update", {
    detail: {
      type: "devices",
      timestamp: Date.now()
    }
  }));

                    }
                    e.target.value = 'saveNone';
                })}


if (!HW_API) printButton.disabled = true;
if (currentDisk.mode && currentDisk.mode != 'readwrite'){ saveButton.disabled = true; }
    

                    fileWinBox.body.addEventListener('keydown', async function(event) { // ЗРОБЛЕНО ASYNC



                        if (event.ctrlKey || event.metaKey) {	

                            const isSave = event.key.toLowerCase() === 's';
    						const isPrint = event.key.toLowerCase() === 'p';
    						const isFind = event.key.toLowerCase() === 'f';
                const isPlus = event.key === '+';
                const isMinus = event.key === '-';

    if (!isSave && !isPrint && !isFind && !isMinus && !isPlus) return;
    						event.preventDefault();
                event.stopPropagation();
                console.log("[EDITOR ACTION]: "+event.key)
                            
                            if (isSave) saveButton.click();
                            if (isPrint) printButton.onclick();
                            if (isFind) findButton.click();     
                            if (isMinus) sizeMButton.click();
                            if (isPlus) sizePButton.click();        


    }
                    });
                    
    let isConfirmedClose = false; // Прапорець, який дозволить чисте знищення вікна
  const oriClose = fileWinBox.onclose || null;
    fileWinBox.onclose = function(urgent) {
    
        // Якщо закриття примусове (urgent) або ми вже пройшли перевірку збереження — закриваємо без питань
        if (urgent || isConfirmedClose || wasSaved) {
        if (oriClose) oriClose()
            return false; // Дозволяємо системі знищити вікно
        }

        // Якщо є незбережені зміни (або isEditable), перехоплюємо закриття
        // Запускаємо асинхронний діалог у фоні
        (async () => {

            const save = await confirm(_("confirm_save_file").replace('{file}', exfile.name.split('/').pop() ));
            if (save) {
                saveButton.click(); // Твій фіксований збір CSV чи тексту
            }
            
            // Змінюємо стан запобіжника і програмно викликаємо закриття знову
            isConfirmedClose = true;
            if (oriClose) oriClose()
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
                alert(_("not_found"));
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

            if (!found) alert(_("not_found"));
        }
    };


    printButton.onclick = async () => {
        const isTextarea = textArea.tagName.toLowerCase() === "textarea";
        let newTextContent;
        
          newTextContent = isTextarea ? textArea.value : textArea.innerHTML;
          if (!textArea) return;
      
        
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



  // Save handler
  saveButton.onclick = async () => {
    if (exfile.type == 'text/csv') return; // Dropdown is used;
    if (currentDisk.mode != 'readwrite') return;
    wasSaved = true;
      console.log("SAVE");
      const isTextarea = textArea.tagName.toLowerCase() === "textarea";
      let newTextContent;

      if (isTextarea) {
          newTextContent = textArea.value;
      } else {
          if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
              const paddingPx = parseInt(window.getComputedStyle(textArea).paddingLeft) || 20;
              const marginTwips = Math.round((paddingPx / 96) * 1440);

              // Await the asynchronous Blob generator
              newTextContent = await htmlToDocx(textArea.innerHTML);

    } else if (fileType === "text/markdown") {
const turndownService = new TurndownService();

    // Preserve underline using HTML, since standard Markdown has no underline syntax.
    turndownService.addRule('underline', {
        filter: ['u'],
        replacement: content => `<u>${content}</u>`
    });

    // Convert strike-through to Markdown syntax.
    turndownService.addRule('strike', {
        filter: ['s', 'strike', 'del'],
        replacement: content => `~~${content}~~`
    });

    newTextContent = turndownService.turndown(textArea.innerHTML);
}
    }

                    const newFile = new File([newTextContent], exfile.name, { type: exfile.type ,lastModified: Date.now() });

                    const index = fs.findIndex(item => item.name === exfile.name);
                    if (index !== -1) {
                        fs[index] = newFile;

                        await saveFileToDB(newFile);
                               
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
   
    const isFont = fileType.startsWith("font/") || 
                   fileType === "application/x-font-ttf" || 
                   fileType === "application/font-woff" ||
                   fileType === "application/font-woff2";

    if (fileType.startsWith("text/") || !exfile.name.split("/").pop().substring(1).includes(".") || fileType == "application/x-theme" || fileType == 'application/xslt+xml' || fileType == 'application/json' || fileType == 'application/x-kde-palette' || fileType == "application/vnd.cups-ppd") {
        
        reader.readAsText(exfile);
    } else if (fileType.startsWith("image/") || fileType.startsWith("audio/") || fileType.startsWith("video/") || isFont || fileType == "application/pdf") {
        
        reader.readAsDataURL(exfile);
    } else {
        
        reader.readAsArrayBuffer(exfile); // This captures application/wasm perfectly
    }
  fileWinBox.removeClass('loading')
  fileWinBox.removeClass("hidden");
  
    } 


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
    const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
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
      <button class='ok' id="zipFldr">${_('ok')}</button>
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



    async function unzipFile(filePath, cwd = '', gui=false) {
        let file, prg1;
        if (typeof filePath == "string"){
            file = fs.find(f => f.name === filePath);
        } else {
            file = filePath;
        }
        if (!file) return;
        if (gui){
    prg1 = new progress(_('extracting'), 0,1)
    prg1.oncancel = ()=>{
        return;
    }
}


        var zip = new JSZip();
        await zip.loadAsync(file);

let fileCount = 0;
let currFile = 0;
zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
        fileCount++;
    }
});

console.log(`Files to extract: ${fileCount}`);

if (gui) prg1.setMax(fileCount);


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

                        //fs.push(extractedFile);

                        await saveFileToDB(extractedFile, true);
                        if (gui) prg1.setValue(currFile+1);
                        currFile++; 
                    });

                    unzipPromises.push(promise);
                }
            });

            await Promise.all(unzipPromises);
            if (gui) prg1.close(); 
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
    const oldName = oldFile.name;
    const oldFileType = oldFile.type;

    const newFile = new File(
        [oldFile],
        newName,
        {
            type: getMimeType(newName),
            lastModified: Date.now()
        }
    );

    try {
        const deleted = await deleteFile(oldName);

        if (!deleted) {
            console.error("Could not delete:", oldName);
            return false;
        }

        const success = await saveFileToDB(newFile);

        if (!success) {
            console.error("Could not save:", newName);
            return false;
        }

        // deleteFile() removed the old object,
        // so just add the new one.
        // fs.push(newFile);

        if (oldFileType === 'text/javascript') {
            let autoload = JSON.parse(
                localStorage.getItem('autoload') || '[]'
            );

            if (autoload.includes(oldName)) {
                autoload = autoload.filter(name => name !== oldName);
                autoload.push(newName);

                localStorage.setItem(
                    'autoload',
                    JSON.stringify(autoload)
                );
            }
        }

        return true;

    } catch (error) {
        console.error("Can not save or rename.", error);
        return false;
    }
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
        <option disabled>USB</option>
        <option disabled>SessionStorage</option>
        <option disabled>Cookies</option>
        ${ window.location.protocol != 'file:' ? `<option value="cache">Cache</option>` : `<option disabled value="cache">Cache</option>`}
      </select>
    </div>

    <div>
      <button class='ok' id="create">${_('ok')}</button>
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
                if (diskType == 'cache'){
                    await caches.open(dbName);
                }
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
      console.log('Formatting '+driveName || disk.name + "("+disk.type+")")
        if (disk.type == "localStorage"){
            localStorage.clear();
        } else if (disk.type == "sessionStorage"){
            sessionStorage.clear();
        }else if (disk.type == "cookies") {
            await Promise.all(
    (await cookieStore.getAll()).map(cookie =>
        cookieStore.delete({
            name: cookie.name,
            path: cookie.path ?? "/"
        })
    )
);
        } else if (disk.type == "indexedDB") {
      const db = await awaitDbInstance(driveName);
      const store = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME);

    await store.clear();

      }else if (disk.type == 'USB'){
        await mountDrive(driveName);
        
        fs.forEach(f=> {
           if (f.name.endsWith('.html') || f.name.endsWith('.htm')){
          const a = apps.find(apl=> apl.path == f.name);
                  if (a) deleteApp(a.name);
        }
          deleteFile(f.name);

        })
      } else{
        return console.error("This drive type doesn't support 'Format'.")
      }
console.log('Formatted: '+(driveName || disk.name)+"\n"+disk.used+"B left")
    }

    async function unmountDrive(driveName) {
        if (!driveName && currentDisk) driveName = currentDisk.name;
      currentDisk = null;
      fs = [];
      const disks = await getDisks();
      const disk = disks.find(d => d.name == driveName);

      if (disk.type === "indexedDB") {
        try {
          if (disk == currentDisk && currentDisk.busy)
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
    function changeDriveMode(mode){
        if (mode != 'readonly' && mode != 'readwrite' && mode != 'versionchange'){
            console.error('Unknown mode: '+ mode);
            return false;
        }
        currentDisk.mode = mode;
        return true;
    }



async function getCookie(name) {
    return (await cookieStore.get(name))?.value ?? null;
}

async function mountDrive(driveName, v = 1, mode = 'readwrite', force = false) {
  const disks = await getDisks();
  const disk = disks.find(d => d.name == driveName);
  if (!disk && !force) return console.error('NOT FOUND');

  if (!disk && startupDiskType == 'indexedDB' && force){
                      await new Promise((res, rej) => {
                    const request = indexedDB.open(startupDisk, 1);

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
                      
                      db.close(); 
                      res();
                    };
                  });
                      return safeShutdown({restart:true})
  }

  if (disk.type === 'indexedDB') {
    if (!['readonly', 'readwrite', 'versionchange'].includes(mode)) {
      console.error('Unknown mode: ' + mode);
      return false;
    }
  } else {
    if (mode !== 'readwrite') console.error('Drive type does not support operation modes. Attribute omitted.');
    if (v != 1 && v != null) console.log('Drive type does not support versioning. Attribute omitted.');
  }

  if (!force && currentDisk &&
      currentDisk.name == driveName &&
      currentDisk.type == disk.type &&
      currentDisk.total == disk.total) {
    return console.error(driveName + ' is already mounted');
  }

  // Remember the previous state so a failed mount can be rolled back
  const prevDisk = currentDisk ?? null;
  const prevFs = fs;

  currentDisk = disk;
  console.warn(currentDisk)
  disk.mounted = true;
  disk.mode = mode;
  disk.busy = true;
  console.log('Attempting to mount: ' + driveName);

  try {
    switch (disk.type) {
      case 'indexedDB': {
        idbWrapper.db = null;
        DB_NAME = driveName;
        await idbWrapper.openDB(Math.max(disk.version || 1, v));

        const records = await idbWrapper.loadAllFiles();
        if (records && records.length > 0) {
          fs = records.map(fileFromRecord);
        } else {
          fs = [];
          // Legacy migration (consider restricting this to your main disk only)
          const legacy = localStorage.getItem('infinity_os_fs');
          if (legacy) {
            fs = JSON.parse(legacy).map(item =>
              item.content
                ? fileFromRecord(item)
                : new File([], item.name, { type: item.type, lastModified: item.lastModified })
            );
            if (fs.length > 0) {
              await Promise.all(fs.map(saveFileToDB));
              localStorage.removeItem('infinity_os_fs');
              console.log('Legacy LocalStorage FS migrated and cleared.');
            }
          }
        }
        break;
      }

      case 'USB': {
        if (!disk.where) throw new Error('Mount failed. "Where" is not provided.');
        if (disk.total == 0 && disk.used == 0) throw new Error('Mount failed. Capacity: 0B.');

        const res = await fetch(`/api/ls?path=${encodeURIComponent(disk.where)}`);
        const data = await res.json();
        if (!data.success || !Array.isArray(data.items)) throw new Error('Mount failed. Could not list drive.');

        const prefix = disk.where + '/';
        const files = await Promise.all(
          data.items.filter(i => i.type === 'file').map(async item => {
            const blob = await (await fetch(`/api/read_binary?path=${encodeURIComponent(item.path)}`)).blob();
            const name = item.path.startsWith(prefix) ? item.path.slice(prefix.length) : item.path;
            return new File([blob], name, { type: getMimeType(name), lastModified: item.mtime * 1000 });
          })
        );
        fs = files;
        break;
      }

      case 'cookies':
        fs = (await cookieStore.getAll()).map(c =>
          new File([c.value], c.name, { type: getMimeType(c.name) }));
        break;

      case 'cache': {
        const cache = await caches.open(driveName);
        const requests = await cache.keys();
        const files = await Promise.all(requests.map(async req => {
          const res = await cache.match(req);
          if (!res) return null;
          const name = decodeURIComponent(new URL(req.url).pathname.slice(1));
          return new File([await res.blob()], name, { type: res.headers.get('Content-Type') || getMimeType(name) });
        }));
        fs = files.filter(Boolean);
        break;
      }

      case 'localStorage':
      case 'sessionStorage': {
        const store = disk.type === 'localStorage' ? localStorage : sessionStorage;
        fs = Object.keys(store).map(k =>
          new File([store.getItem(k)], k, { type: getMimeType(k) }));
        break;
      }
    }

    if (!force) sounds.play('deviceIn');
  } catch (e) {
    // Roll back so we never stay "mounted" on a drive that failed to load
    currentDisk = prevDisk;
    disk.mounted = false;
    fs = prevFs;
    throw e;
  } finally {
    disk.busy = false;
  }
}

     /**
     * Асинхронно створює новий порожній текстовий файл, додає його в FS та оновлює UI.
     * @param {function} renderFileList Функція для оновлення списку файлів.
     * @param {function} null Функція для оновлення індикатора квоти.
     */
     
    async function handleCreateFile(cwd = "") {
        let fileName = await prompt(_('prompt_new_file_name'),(cwd == "" ? '' : cwd.trim()+"/"));
        try{
        
        
        if (!fileName) return; 


        if (fs.some(file => file.name === fileName)) {

            return;
        }
        


        const newFile = new File([""], fileName, { type: getMimeType(fileName) });

        // fs.push(newFile);
        saveFileToDB(newFile, true);

            }catch{
                showJsError(
  _('alert_create_file_error') + (fileName ? ": " + fileName : '')
);
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
    async function getIndexedDBUsage(dbName) {
  if (!dbName) return 0;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);

    request.onerror = () => reject(request.error);
    request.onsuccess = async (event) => {
      const db = event.target.result;
      let totalSize = 0;
      const storeNames = Array.from(db.objectStoreNames);

      try {
        for (const storeName of storeNames) {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);

          // Use a cursor to stream through records efficiently
          await new Promise((res, rej) => {
            const cursorReq = store.openCursor();
            cursorReq.onsuccess = (e) => {
              const cursor = e.target.result;
              if (cursor) {
                totalSize += getObjectSize(cursor.value);
                cursor.continue();
              } else {
                res();
              }
            };
            cursorReq.onerror = () => rej(cursorReq.error);
          });
        }
        db.close();
        resolve(totalSize);
      } catch (err) {
        db.close();
        reject(err);
      }
    };
  });
}


async function parseCookies() {
    return Object.fromEntries(
        (await cookieStore.getAll()).map(cookie => [
            cookie.name,
            cookie.value
        ])
    );
}




// Helper to accurately measure different JS data types without breaking binary data
function getObjectSize(value) {
  if (value == null) return 0;
  if (value instanceof Blob || value instanceof File) return value.size;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (typeof value === 'string') return value.length * 2; // UTF-16 chars = 2 bytes
  
  // Fallback for plain objects/JSON data
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0; // Handle circular references safely
  }
}
            
  async function updateDiskQuotaUI(disk, meter, text) {
    const lsUsed = new Blob([JSON.stringify(localStorage)]).size; // байти приблизно
      const ssUsed = new Blob([JSON.stringify(sessionStorage)]).size; // байти приблизно
      const ckUsed = new Blob([
    JSON.stringify(
        await cookieStore.getAll()
    )
]).size;// байти приблизно
      try {
          if (disk.type === "localStorage") {
              
              const totalBytes = maxLS;
              
              if (meter && text) {
                  meter.max = totalBytes;
                  meter.value = lsUsed;
                  
                  // --- Set thresholds for LocalStorage ---
                  meter.low = totalBytes * 0.50;      // Under 50% is green
                  meter.high = totalBytes * 0.85;     // Over 85% turns yellow/red
                  meter.optimum = totalBytes * 0.20;  // Lower usage is better
                  
                  text.innerText = formatBytes(lsUsed) + " / " + formatBytes(totalBytes);
              }
              return { usedBytes: lsUsed, totalBytes: totalBytes }; // Added return for consistency
          } else if (disk.type === "sessionStorage") {
              
              const totalBytes = maxSS;
              
              if (meter && text) {
                  meter.max = totalBytes;
                  meter.value = ssUsed;
                  
                  // --- Set thresholds for LocalStorage ---
                  meter.low = totalBytes * 0.50;      // Under 50% is green
                  meter.high = totalBytes * 0.85;     // Over 85% turns yellow/red
                  meter.optimum = totalBytes * 0.20;  // Lower usage is better
                  
                  text.innerText = formatBytes(ssUsed) + " / " + formatBytes(totalBytes);
              }
              return { usedBytes: ssUsed, totalBytes: totalBytes }; // Added return for consistency
          } else if (disk.type === "cookies") {
              const totalBytes = maxCK;
              
              if (meter && text) {
                  meter.max = totalBytes;
                  meter.value = ckUsed;
                  
                  // --- Set thresholds for LocalStorage ---
                  meter.low = totalBytes * 0.50;      // Under 50% is green
                  meter.high = totalBytes * 0.85;     // Over 85% turns yellow/red
                  meter.optimum = totalBytes * 0.20;  // Lower usage is better
                  
                  text.innerText = formatBytes(ckUsed) + " / " + formatBytes(totalBytes);
              }
              return { usedBytes: ckUsed, totalBytes: totalBytes }; // Added return for consistency
          }else if (disk.type === "cache") {
              const cchUsed = await getCacheSizeInBytes(disk.name)
              if (meter && text) {
                  meter.max = maxCCH;
                  meter.value = cchUsed;
                  
                  // --- Set thresholds for LocalStorage ---
                  meter.low = maxCCH * 0.50;      // Under 50% is green
                  meter.high = maxCCH * 0.85;     // Over 85% turns yellow/red
                  meter.optimum = maxCCH * 0.20;  // Lower usage is better
                  
                  text.innerText = formatBytes(cchUsed) + " / " + formatBytes(maxCCH);
              }
              return { usedBytes: cchUsed, totalBytes: maxCCH }; // Added return for consistency
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

async function getCacheSizeInBytes(cacheName) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  
  let totalBytes = 0;
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      // Clone the response because response bodies can only be read once
      const blob = await response.clone().blob();
      totalBytes += blob.size;
    }
  }
  
  return totalBytes;
}



  async function getDisks() {
      const disks = [];
      const lsUsed = new Blob([JSON.stringify(localStorage)]).size; // байти приблизно
      const ssUsed = new Blob([JSON.stringify(sessionStorage)]).size; // байти приблизно
      const ckUsed = new Blob([
    JSON.stringify(
        await cookieStore.getAll()
    )
]).size; // байти приблизно
      disks.push({
          type: "localStorage",
          name: "Local Storage",
          icon: icns.lsDrive,
          used: lsUsed,
          total: maxLS, // Global variable
          length: localStorage.length
      });

      disks.push({
          type: "sessionStorage",
          name: "Session Storage",
          icon: icns.lsDrive,
          used: ssUsed,
          total: maxSS, // Global variable
          length: sessionStorage.length
      });
if (maxCK != 0){
      disks.push({
          type: "cookies",
          name: "Cookies",
          icon: icns.lsDrive,
          used: ckUsed,
          total: maxCK, // Global variable
          length: Object.keys(parseCookies()).length
      });
  }

  if (caches){
    const cchs = await caches.keys();
    for (const cch of cchs){
        const size = 
        disks.push({
          type: "cache",
          name: cch,
          icon: icns.cacheDrive,
          used: await getCacheSizeInBytes(cch),
          total: maxCCH, // Global variable
      });
    }
    
  }

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
              version: db.version,
              mounted: DB_NAME == db.name && (currentDisk ? currentDisk?.name == db.name : true),
              mode: (currentDisk && currentDisk.name == db.name ? currentDisk.mode : 'readwrite')
            });
        }
    }

  try {
    if (HW_API){
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
      where: d.mountpoint
  };

  

  disks.push(disk);
          }
      }}
  } catch {
      // Running without the backend (file:// or no server).
      // Just skip USB drives.
  }

        return disks;
    };


  async function getInfo(e, btn){
        const path = btn.getAttribute("data-file");
        if (!path) return;
        
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
        let sum = 0;
        if (typeofpath == "file") {
            size = formatBytes(entry.size)
        }else if (typeofpath == "drive"){
            size = formatBytes(entry.total);
        } else {
            
            fs.forEach(f => { if (f.name.startsWith(path)) sum += f.size; });
            size = formatBytes(sum)
                
        }

        const dateOptions = localeFormat;
        let modifiedDate,formattedDate;
        let createdDate,formattedCreatedDate;
        if (typeofpath == "file") {
         modifiedDate = entry.lastModified
        }else if (typeofpath == "dir"){
            createdDate = Math.min(...fs.filter(f=> f.name.startsWith(path) ).map(f=> f.lastModified));
            modifiedDate = Math.max(...fs.filter(f=> f.name.startsWith(path) ).map(f=> f.lastModified));
        }else{
            modifiedDate = Date.now()
        }
      

    formattedDate = new Intl.DateTimeFormat(dateLang, dateOptions).format(new Date(modifiedDate));
    if (createdDate) formattedCreatedDate = new Intl.DateTimeFormat(dateLang, dateOptions).format(new Date(createdDate));
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
                    
    `;


    if (typeofpath == 'dir'){
        meta+=`<b>${_("files")}: </b>${fs.filter(f=> f.name.startsWith(path)).length}<br>`;
        meta+=`<b>${_("created")}: </b>${formattedCreatedDate}<br>`;
    }
    if (modifiedDate != Date.now()) meta+= `<b>${_("lastModified")}: </b>${formattedDate}<br>`
    const cookies = await cookieStore.getAll();
const cookie = cookies.find(c => c.name === name);

if (cookie) {
    if (cookie.domain)
        meta += `<b>${_("domain")}:</b> ${cookie.domain}<br>`;
    
    if (cookie.partitioned)
        meta += `<b>${_("partitioned")}:</b> ${cookie.partitioned}<br>`;
    
    if (cookie.expires != null)
        meta += `<b>${_("expires")}:</b> ${new Intl.DateTimeFormat(dateLang, dateOptions).format(new Date(cookie.expires))}<br>`;
    
    if (cookie.path)
        meta += `<b>${_("path")} (cookie):</b> ${cookie.path}<br>`;
    
    window.updateCk = async (e) => {
    const secure = e.checked;
    const revert = () => { e.checked = !!cookie.secure; };

    // HttpOnly cookies can't be modified from JS
    if (cookie.httpOnly) return revert();

    // SameSite=None and Partitioned both require Secure
    if (!secure && (String(cookie.sameSite).toLowerCase() === "none" || cookie.partitioned)) return revert();

    let str = `${cookie.name}=${cookie.value}; path=${cookie.path}`;
    if (cookie.domain) str += `; domain=${cookie.domain}`;
    if (cookie.expires != null) str += `; expires=${new Date(cookie.expires).toUTCString()}`;
    if (cookie.sameSite) str += `; samesite=${cookie.sameSite}`;
    if (cookie.partitioned) str += "; partitioned";
    if (secure) str += "; secure";
    document.cookie = str;

    // Confirm the browser accepted the write
    const all = await cookieStore.getAll({ name: cookie.name });
    const fresh = all.find(c => c.path === cookie.path) || all[0];
    cookie.secure = fresh ? fresh.secure : cookie.secure;
    e.checked = !!cookie.secure;
};
    
    const secureLocked =
    cookie.httpOnly ||
    cookie.partitioned ||
    String(cookie.sameSite).toLowerCase() === "none";

meta += `
    <b>${_("secure")}:</b>
    <input type="checkbox"
        ${cookie.secure ? "checked" : ""}
        ${secureLocked ? "disabled" : ""}
        onchange="updateCk(this)"><br>
    <b>SameSite:</b> ${cookie.sameSite}<br>
`;
}

  }else if (typeofpath == 'drive'){
     meta = `
      <hr style=" border-color: #ffffff33;">
                    <b>${_("type")}: </b>${type} ${entry.mode ? "("+entry.mode+")" : ''}<br>
                    <b>${_("size")}: </b>${size}<br>
                    <b>${_('usage')}: </b>${formatBytes(entry.used)}<br>
    `;
    if (entry.version) meta+= `<b>${_("version")}: </b>${entry.version}<br>`
    if (entry.where) meta+= `<b>${_("path")}: </b>${entry.where.replaceAll('/', '/\u200B')}<br>`
    if (entry.length) meta+= `<b>${_("files")}: </b>${entry.length}<br>`
  }
        const win = new wm(_("info"), {x: "center",y: "center",
            class: [ wbtheme, "no-max", 'no-full'],
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
                    <img src="${ic}" style="width: 64px; height: 64px; object-fit: contain; ${typeofpath=="dir" && filesColorFolders? `filter: hue-rotate(${sum*10}deg);'`:''} ">
                    <p style="font-weight: bold; margin-top: 8px; word-break: break-all; font-size: 15px; user-select:text;">${name}</p>
                </div>
                <div style='user-select:text;padding-left:5px;padding-right:5px;line-height: 1.25;overflow-wrap:anywhere; word-break:break-word;'>
              ${meta}
                <div id='meta-${name}-${size}'></div>
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

    addSystemApp("files", icns.files, function(opts={}){
        const uniqueId = "file-explorer-" + Date.now(); 
        let mode = opts?.runAs ? opts.runAs : 'view';
        
        let title = _("files");
        if (mode == 'file') title = _('select_file')
        if (mode == 'dir') title = _('select_folder')
        if (mode == 'save') title = _('save_to')
        new wm(title, { // ВИКОРИСТАННЯ _()
        x: "center",y: "center",
            id: uniqueId, 
            icon: icns.files,
            class: ["hidden", wbtheme, 'no-full'],
            minwidth: 255,
            minheight:255,
            html: `

        <div style="height: 100%; width: 100%; display: flex; flex-direction: column; white-space: nowrap; overflow: hidden;">
            <!-- Тулбар -->
            <div id="file-toolbar-${uniqueId}" class="toolbar" style="flex-shrink: 0;">
                <button id="up-btn-${uniqueId}">..</button>
                    <input style='width:200px;' type='text' id="pathlabel-${uniqueId}">
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
                const fileToolbar = this.body.querySelector(`#file-toolbar-${uniqueId}`);
                let currentDir = "";

                if (mode == 'save'){
                    const slash = document.createElement('span');
                    slash.innerText = '/';
                    fileToolbar.appendChild(slash);

                    const nameInp = document.createElement('input');
                    nameInp.type = 'text';
                    nameInp.id = 'name-inp'+uniqueId;
                    if (opts.suggestedName) {
    const parts = opts.suggestedName.split('/');
    nameInp.value = parts.pop();                 // filename (removes it from parts)

    if (parts.length) {                          // anything left is the directory
        currentDir = parts.join('/');
        //renderFileList();
        document.getElementById('pathlabel-' + uniqueId).value = currentDir;
    }
}

                    fileToolbar.appendChild(nameInp);

                    const typeInp = document.createElement('select');
typeInp.id = 'type-inp' + uniqueId;

// Normalize types -> [{ label, exts: ['.txt', ...] }]
const types = (opts.types || []).map(ty => ({
    label: ty.description || '',
    exts: Object.values(ty.accept || {}).flat().map(e => e.toLowerCase())
}));

types.forEach((ty, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${ty.label} (${ty.exts.join(', ')})`;   // "Text Files (.txt)"
    typeInp.appendChild(opt);
});

// Optional "all files" entry, as the real API allows unless excludeAcceptAllOption is true
if (!opts.excludeAcceptAllOption || !types.length) {
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = '*.*';
    typeInp.appendChild(all);
}

fileToolbar.appendChild(typeInp);

                    const saveName = document.createElement('button');
                    saveName.class = 'ok';
                    saveName.innerText = _('save_btn')
                    saveName.id = 'name-save'+uniqueId;
                    saveName.onclick = ()=>{
                        const idx = typeInp.value === 'all' ? -1 : +typeInp.value;
                        window.dispatchEvent(new CustomEvent('file_saved', {
                            detail: { 
                                paths: [document.getElementById("pathlabel-"+uniqueId).value == '' ? (nameInp.value) :  document.getElementById("pathlabel-"+uniqueId).value+"/"+nameInp.value],
                                typeIndex: idx,                      // -1 = "All files"
                                type: idx >= 0 ? opts.types[idx] : null   // the original {description, accept} object
                            }
                        }));
                        this.close();
                    }
                    fileToolbar.appendChild(saveName);

                }
        const resizer = this.body.querySelector(`#resizer-${uniqueId}`);

        let minSidebarWidth;
                  document.getElementById("pathlabel-"+uniqueId).onchange = (e) => {
                        currentDir = document.getElementById("pathlabel-"+uniqueId).value;
                         renderFileList();
                    }

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

        hideMenus(e)
        
        const menu = document.getElementById("folderM");
        const cleanFolder = currFolder.trim();

            const list = e.target.closest("ul");
    if (!list || list !== e.target) return;
const mode = list.id.includes("sidebar") ? "drive" : "file";

        const visibleButtons = (currentDisk && currentDisk.mode == 'readwrite') ? ["create_item_btn"] : []; 
if (!currentDisk) visibleButtons.push("create_item_btn");
if (mode == 'file' && currentDisk) visibleButtons.push('t_file_paste')

    if (cleanFolder !== "/" && cleanFolder !== "" && (currentDisk && currentDisk.mode == 'readwrite' )) {
          visibleButtons.push("zip1_btn");
      }
        if (mode == 'file' && currentDisk) visibleButtons.push("getinfo1_btn");



    

    menu.querySelectorAll("li").forEach(li => {
        li.style.display = "none";
        li.dataset.mode = mode;
    });

        visibleButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.style.display = "block";
    if (cleanFolder !== "/" && cleanFolder !== "") {
          btn.setAttribute("data-file", currFolder);
        }else if (currentDisk) {
            btn.setAttribute("data-file",currentDisk.name);
        }
                
                
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


// Cache DOM element references once as standalone variables
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
const upBtn = document.getElementById(`up-btn-${uniqueId}`);
const fileCopyBtn = document.getElementById('t_file_copy');
const fileCutBtn = document.getElementById('t_file_cut');
const filePasteBtn = document.getElementById('t_file_paste');

// Clipboard DOM elements
const clipbrdRow = document.getElementById('files_clipbrd_row');
const tAfterClipbrd = document.getElementById('t_afterClipbrd');
const tBeforeClipbrd = document.getElementById('t_beforeClipbrd');

// Group all menu buttons into an array for easy iterations
const allMenuBtns = [
    openBtn, openTxtBtn, renBtn, deleteBtn, setbgBtn,
    autoloadBtn, startupBtn, unzipBtn, zipBtn, getinfoBtn,
    mountBtn, unmountBtn, formatBtn, printBtn, defaultBtn, fileCopyBtn,fileCutBtn,filePasteBtn
];

const showContextMenu = (e, itemType, fileName) => {
    e.preventDefault();

 hideMenus(e)




    // Show all buttons by default
    allMenuBtns.forEach(btn => { if (btn) btn.style.display = "block"; });

    document.getElementById("fileM")
        .querySelectorAll("li > p, label, b")
        .forEach(item => item.innerText = _(item.innerText));

    if (itemType === "localStorage" || itemType === "sessionStorage" || itemType === "cookies") {
        allMenuBtns.forEach(btn => { if (btn) btn.style.display = "none"; });
        formatBtn.style.display = "block";
        startupBtn.style.display = "block";
        getinfoBtn.style.display = "block";
        mountBtn.style.display = "block";
        unmountBtn.style.display = "block";
        clipbrdRow.style.display = 'none';
        tAfterClipbrd.style.display = 'none';
        tBeforeClipbrd.style.display = 'none';
    }
    else if (itemType === "indexedDB" || itemType == 'cache' ){
        allMenuBtns.forEach(btn => { if (btn) btn.style.display = "none"; });
        mountBtn.style.display = "block";
        unmountBtn.style.display = "block";
        formatBtn.style.display = "block";
        startupBtn.style.display = "block";
        getinfoBtn.style.display = "block";
        deleteBtn.style.display = "block";
        clipbrdRow.style.display = 'none';
        tAfterClipbrd.style.display = 'none';
        tBeforeClipbrd.style.display = 'none';
    } 
    else if (itemType === "USB") {
        allMenuBtns.forEach(btn => { if (btn) btn.style.display = "none"; });
        formatBtn.style.display = "block";
        getinfoBtn.style.display = "block";
        mountBtn.style.display = "block";
        unmountBtn.style.display = "block";
        clipbrdRow.style.display = 'none';
        tAfterClipbrd.style.display = 'none';
        tBeforeClipbrd.style.display = 'none';
    }
    else if (itemType === "file") {
        startupBtn.style.display = "none";
        mountBtn.style.display = "none";
        unmountBtn.style.display = "none";
        formatBtn.style.display = "none";
        printBtn.style.display = "none";
        clipbrdRow.style.display = 'flex';
        tAfterClipbrd.style.display = 'block';
        tBeforeClipbrd.style.display = 'block';

        const file = fs.find(f => f.name === fileName || f.path === fileName);


printBtn.style.display =
    HW_API
        ? (
            (
                (file.type.startsWith("text/") && file.type !== "text/html") ||
                file.name.endsWith(".md") ||
                file.name.endsWith(".docx") ||
                file.type === "application/pdf" ||
                [
                    "image/jpeg",
                    "image/png",
                    "image/gif",
                    "image/webp",
                    "image/avif",
                    "image/apng"
                ].includes(file.type)
            )
                ? "block"
                : "none"
        )
        : "none";


        openTxtBtn.style.display =
            (file.type.startsWith("text/") && (file.type !== "text/plain")) ||
            file.type === "application/vnd.cups-ppd" || file.type === "image/svg+xml" || file.type === "application/x-theme" || file.type === 'application/xslt+xml' || file.type === 'application/json' || file.type == 'application/x-kde-palette'
                ? "block" : "none";
        
        renBtn.style.display = (currentDisk && (currentDisk.type == "cookies" || currentDisk.type == "cache")) ? "none": 'block';

        autoloadBtn.style.display =
            (file.type === "text/javascript" || file.type === "text/html" || file.type === "text/css") 
                ? "block" : "none";

        setbgBtn.style.display = file.type.startsWith("image/") ? "block" : "none";

        unzipBtn.style.display = file.name.endsWith(".zip") && (currentDisk.mode == 'readwrite') ? "block" : "none";

        defaultBtn.style.display =
            (file.type.startsWith("font/") ||
             file.type === "application/x-font-ttf" ||
             file.type === "application/font-woff" ||
             file.type === "application/vnd.ms-opentype") 
                ? "block" : "none";

        zipBtn.style.display = "none";
    }
    else {
        if (currentDisk.mode == 'readwrite') zipBtn.style.display = "block";
        startupBtn.style.display = "none";
        openTxtBtn.style.display = "none";
        autoloadBtn.style.display = "none";
        setbgBtn.style.display = "none";
        unzipBtn.style.display = "none";
        mountBtn.style.display = "none";
        unmountBtn.style.display = "none";
        formatBtn.style.display = "none";
        printBtn.style.display = "none";
        defaultBtn.style.display = "none";
        clipbrdRow.style.display = 'none';
        tAfterClipbrd.style.display = 'none';
        tBeforeClipbrd.style.display = 'none';
        
        renBtn.style.display = (currentDisk && currentDisk.type == "cookies") ? "none": 'block';
        
        
    }

    const menu = document.getElementById("fileM");
    menu.style.left = e.clientX + "px";
    const rect = menu.getBoundingClientRect();
    const menuHeight = rect.height;

    if (e.clientY + menuHeight > window.innerHeight) {
        menu.style.bottom = `${window.innerHeight - e.clientY}px`;
        menu.style.top = "auto";
    } else {
        menu.style.top = `${e.clientY}px`;
        menu.style.bottom = "auto";
    }

    menu.style.display = "block";

    allMenuBtns.forEach(btn => { if (btn) btn.setAttribute("data-file", fileName); btn.addEventListener('click', hideMenus) });
};

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

    printBtn.onclick = async (e) => {
        e.stopPropagation();
                            const fileName = e.target.closest("li").getAttribute("data-file");
                            const file = fs.find(f => f.name === fileName);
                            
const fileType = file.type;
                          
if (fileType.startsWith("text/") || !file.name.split("/").pop().substring(1).includes(".") || fileType == "application/x-theme" || fileType == 'application/xslt+xml' || fileType == 'application/json' || fileType == 'application/x-kde-palette' || fileType == "application/vnd.cups-ppd") {
        const newTextContent = await file.text();
await openPrintDialog({ text: newTextContent, title: file.name });

    } else {
        
        await printFile(file);
    }


                            
    }
    formatBtn.onclick = async (e) => {
        
        e.stopPropagation();
        const li = e.target.closest("li");
        
        const driveName = li.getAttribute("data-file");
        
        const a = await confirm(_("confirm_format").replace("{name}", driveName));
        if (a) await formatDrive(driveName);
        if (currentDisk?.name == driveName) await renderFileList()
        await loadDisksList();
    }
    mountBtn.onclick = async (e) => {
        e.stopPropagation();
        const li = e.target.closest("li");
        fileListContainer.style.cursor = "wait";
        const driveName = li.getAttribute("data-file");
    await mountDrive(driveName);
    await renderFileList();
    fileListContainer.style.cursor = "";
    }
    unmountBtn.onclick = async (e) => {
        e.stopPropagation();
        fileListContainer.style.cursor = "wait";
        const li = e.target.closest("li");
        
        const driveName = li.getAttribute("data-file");

        await unmountDrive(driveName);
        open = 0;
        currentDisk = null;
        await renderFileList();  
        fileListContainer.style.cursor = '' 
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
        await unzipFile(filePath, document.getElementById("pathlabel-"+uniqueId).value, true);
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
        }else{
            autoload = []; 
        }

        const fileName = e.target.parentNode.getAttribute("data-file");

        
        if (e.target.checked) {

            if (!autoload.includes(fileName)) {
                autoload.push(fileName);
                if (apps.find(a => a.path === fileName)) setPerm(apps.find(a => a.path === fileName).name, 'autoload',true)
            }
        } else {
            if (apps.find(a => a.path === fileName)) setPerm(apps.find(a => a.path === fileName).name, 'autoload',false)
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

                localStorage.setItem('backgroundFile', file.name);

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
        if (disk){
                    if (disk.type === 'indexedDB') {
          await new Promise((resolve) => {
            const deleteRequest = indexedDB.deleteDatabase(fileName);
            
            deleteRequest.onsuccess = () => {
              console.log(`DELETED: ${fileName} PARTITION!`);
              resolve();
            };

            deleteRequest.onerror = (err) => {
              console.warn(`Помилка при видаленні ${fileName}:`, err);
              resolve(); // Resolve anyway to proceed with UI updates
            };
          });

          // Update lists and exit early cleanly


        }else if (disk.type == 'cache'){
            const deleted = await caches.delete(disk.name);

console.log("Cache storage deleted:", deleted); // true if it existed and was removed

        }
                      await loadDisksList();
          await renderFileList();
          return;
        }

        
        

        // =========================================================
        // CASE 4: REGULAR FILE OR FOLDER DELETION
        // =========================================================
        const file = fs.find(f => f.name === fileName);
        
        if (isFolder) {
          await purgeDir(fileName, true);
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
         if (fileName.endsWith('.html') || fileName.endsWith('.htm')){
          const a = apps.find(apl=> apl.path == fileName);
                  if (a) deleteApp(a.name);
        }else{
        await deleteFile(file.name);
        
      }
      }

      // Fallback safety update triggers for regular file deletions
      await loadDisksList();
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
            
            if (currentDisk.type === "localStorage" || currentDisk.type === "sessionStorage") {
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
        } else if (currentDisk.type === "sessionStorage") {
    
    const value = sessionStorage.getItem(oldPath);
    
    sessionStorage.removeItem(oldPath);
    sessionStorage.setItem(newName, value);
    
    
    return;
}

        if (isFolder) {
    const filesToRename = fs.filter(
    f => f.name.startsWith(oldPath)
);

const a0 = new progress(
    _('renaming'),
    0,
    filesToRename.length
);

let a2 = 0;

for (const f of filesToRename) {
    const newName0 = f.name.replace(oldPath, newName);

    await performRename(
        fs.indexOf(f),
        newName0
    );

    a2++;
    a0.setValue(a2);
}

a0.close();
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
               

                 if (document.getElementById("pathlabel-"+uniqueId)){
                    document.getElementById("pathlabel-"+uniqueId).value = fileName.slice(0,-1);
                  currentDir = document.getElementById("pathlabel-"+uniqueId).value;}
                                   renderFileList();
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
fileCopyBtn.onclick = (e) => {
    const li = e.target.closest("li");
    const path = li.getAttribute("data-file");

    const file = fs.find(f => f.name === path);
    if (!file) return;

    clipboard = file;
    clipboardMode = 'copy';

    filePasteBtn.classList.remove('disabled');
};

fileCutBtn.onclick = async (e) => {
    const li = e.target.closest("li");
    const path = li.getAttribute("data-file");

    const file = fs.find(f => f.name === path);
    if (!file) return;

    clipboard = file;
    clipboardMode = 'cut';

    filePasteBtn.classList.remove('disabled');

    await deleteFile(path);
    await renderFileList()
};

document.onkeydown = (e) => {
  if (((currentKeyboardLayout == 'win') && e.ctrlKey || (currentKeyboardLayout == 'mac' && e.metaKey)) && e.key.toLowerCase() === "v") {
    filePasteBtn.click();
  }
};

filePasteBtn.onclick = async () => {
    if (currentDisk.mode != 'readwrite') return;
    if (!clipboard) return;

    // Create an actual new File
    const pasteFile = new File(
        [await clipboard.arrayBuffer()],
        (currentDir ? currentDir.trim() + "/" : "") +
        clipboard.name.split("/").pop(),
        {
            type: clipboard.type,
            lastModified: clipboard.lastModified
        }
    );

    fs.push(pasteFile);
    await saveFileToDB(pasteFile);
    await renderFileList()

    if (clipboardMode === 'cut') {
        clipboard = null;
        clipboardMode = null;
        filePasteBtn.classList.add('disabled');
    }
};


    loadDisksList = async () => {
    sideListContainer.style.cursor = "wait";

    const disks = await getDisks();
            sideListContainer.innerHTML = '';
        disks.forEach(disk => {
            const li = document.createElement("li");
            
            li.classList = "disk";
            li.name = disk.name;

            if (filesSettings.showLS == false && disk.type == 'localStorage') return;
            if (filesSettings.showSS == false && disk.type == 'sessionStorage') return;  
            if (filesSettings.showCK == false && disk.type == 'cookies') return;


            li.innerHTML = `
                <span style="display:flex;align-items:center;">
                    <img src="${disk.icon}" width="20" style="margin-right:10px;">
                    ${disk.name} <meter class="quota-progress" style="flex-grow:1;"></meter>
                        <div class="quota-text" style="font-size: 12px; color: #555;">${_('loading')}</div>
                </span>
            `;

            const meter = li.querySelector(".quota-progress");
    const text = li.querySelector(".quota-text");

    updateDiskQuotaUI(disk, meter, text);

            li.oncontextmenu = async (e) => {
                e.preventDefault();
                const li = e.target.closest("li");
                const diskLi = li.textContent.trim().split(" ");
                const diskName = diskLi
                    .splice(0, diskLi.length - 5)
                    .join(" ")
                    .trim();

const ds = await getDisks();

                
                const startupCheckbox = document.getElementById("isStartup");
                
                
                startupCheckbox.checked = (diskName === startupDisk);

                startupCheckbox.onchange = (ev) => {
                    
                    if (ev.target.checked) {

                        startupDisk = diskName;
                        localStorage.setItem("startupDisk", diskName);
                        localStorage.setItem('startupDiskType',  ds.find(d=>d.name == diskName).type)
                    } else {
                        localStorage.removeItem("startupDisk");
                        localStorage.removeItem("startupDiskType");
                        startupDisk = null;
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

                  fileListContainer.style.cursor = "wait";
    await mountDrive(disk.name);
                } finally{
                await renderFileList(); // оновлюємо список
                  fileListContainer.style.cursor = "";
                }
            };

  /*
  if (currentDisk && li.name == currentDisk.name) {
      li.style.background = "rgba(0,0,0,100)";
  }
  */
    this.removeClass("hidden")
            sideListContainer.appendChild(li);
        });
    sideListContainer.oncontextmenu = (e) => {
                e.preventDefault();
        showContextFldrMenu(e, '');
    };

    sideListContainer.style.cursor = "";
    }

    loadDisksList();
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
cookieStore.addEventListener("change", event => {
    renderFileList()
    loadDisksList();
});
  window.addEventListener("update", (e) => {
  
    
    if (e.detail.type == "drives"){
        renderFileList()
    }else{
loadDisksList();
    }
  });

    const renderFileList = async () => {
      fileListContainer.innerHTML = ``;
      
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
                    try{
    if (open) {
        document.getElementById("pathlabel-" + uniqueId).disabled = false;
    } else {
        document.getElementById("pathlabel-" + uniqueId).disabled = true;

        loadDisksList()
    }
}catch{}



    minSidebarWidth = parseInt(window.getComputedStyle(sideListContainer).width) || 100;
    if (!currentDisk) return fileListContainer.style.cursor = "";


        const folders = getFoldersInDir(currentDir);
        folders.forEach(folderName => {
            let li = document.createElement("li");
    const safeId = folderName.replace(/\s+/g, "_").replace(/\//g, "_") + uniqueId;

    const folderDisplay = document.createElement("span");
    folderDisplay.style.cssText = "flex-grow:1; display:flex; align-items:center;";
    
    let sum = 0;
    const folderPrefix = currentDir ? currentDir + "/" + folderName + "/" : folderName + "/";
    const insideFiles = fs.filter(f => f.name.startsWith(folderPrefix) && f.name.trim() !== folderPrefix);


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

    folderDisplay.innerHTML = `
        <span style="position:relative; display:inline-block; width:20px; height:20px; margin-right:10px; flex-shrink:0;">
            <img ${filesColorFolders?`style='filter: hue-rotate(${sum*10}deg);'`:""} src="${icns.folder}" width="20" height="20">
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
              if (mode == 'view' || mode == 'file' || mode == 'save'){
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
try{
    document.getElementById(safeId).textContent = insideFiles.length;
}catch{}
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
                
    fileListContainer.style.cursor = "";
                };
                document.getElementById("create_item_btn").onclick = async (e) => {
          const li = e.target.closest('li');
        if (open && li.dataset.mode == 'file'){
            console.log(uniqueId);
            try{
        await handleCreateFile(document.getElementById("pathlabel-"+uniqueId).value );
    }catch{
        await handleCreateFile('');
    }
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


                if (mode != 'view' && opts.startIn){
                  currentDir = opts.startIn;
                  
                 document.getElementById("pathlabel-"+uniqueId).value = currentDir;
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
    });



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
                  <input id="name" list="apps" type="text" style="width: 150px; box-sizing: border-box;" autofocus onchange='document.querySelector("#save1").click()' required>
                  <datalist id="apps"></datalist>
              </div>

              <!-- Action Buttons -->
              <div>
                  <button id="save1" class='ok' style="padding: 4px 12px;" disabled>${_('ok')}</button>
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
    

    addSystemApp("about",icns.dialogInfo, function(){
        new wm(_("about"),{ // ВИКОРИСТАННЯ _()
        icon: icns.dialogInfo,x: "center",y: "center",
        class: [ "no-max", "no-min", "no-resize", 'tra', wbtheme, 'no-full'],
        html: `

                <div style="padding: 5px;  font-size: 15px;text-align: center;">
                    <img src="${devProps.deviceIcon}" style="width: 160px; height: 110px; object-fit: contain;">
                    <p style="font-weight: bold;  margin: 0px; word-break: break-all; font-size: 25px;user-select:text;">${devProps.model || _('unknown')}</p>
    <small style='padding-top: 0;color:gray;'>
                        ${(devProps.res || _("unknown") )+ " " + devProps.refreshRate +"hz " +_('display')}
                    </small>
                </div>
                <div style='user-select:text;text-align: center;'>
                    <b>${_("CPU")}: </b>${devProps.chip || _("unknown")}<br>
                    <b>GPU: </b>${devProps.gpu || _("unknown")}<br>    
                    <b>${_("memory")}: </b>${devProps.memory || _("unknown")}<br>
                    <b>${_("startup_disk")}: </b>${startupDisk || _("unknown")}<br>
                    <b>Infinity OS: </b>${ devProps.os.version == null ? _("unknown"): devProps.os.version}


                </div>
                
                
            `,
            height: 365,
            width: 260,
            minheight: 320,
            minwidth: 250,
      });
    });
    addSystemApp("Infinity Store",icns.store, function(param=null){
        new wm("Infinity Store",{
        icon: icns.store,x: "center",y: "center",
        class: [ wbtheme, 'no-full'],
        url: (param ? "apps/store.html?"+(param)  : "apps/store.html"),
              height:300,width:400,minheight: 200,minwidth:400,oncreate: function() {
                applySystemConfig(this.id)
              },
              
        
      });
    });


    addSystemApp("clock", icns.clock, function(){
        new wm(_('clock'), { 
            icon: icns.clock, x: "center",y: "center",
            class: [ 'no-max', wbtheme,'no-resize', 'tra', 'no-full'], 
            html: `<div style=\'padding-left:5px;\'><h2 class=\'clock-time\' style=\'font-size: 2em; margin: 0;\'>--:--:--</h2><p class=\'clock-date\' style=\'margin: 0;\'>--.--.----</p></div>`, 
            height:150, width:160 
        });
    })

    addSystemApp("calculator", icns.calc, function(){

        const uniqueCalcId = Math.floor(Math.random() * 1000000);
        const instanceName = `Calc_${uniqueCalcId}`;

        new wm(_('calculator'),{
            x: "center",
            y: "center", 
            icon: icns.calc, 
            class: [ 'no-max', wbtheme, 'no-resize', 'tra', 'no-full'], 
            html: `
                <style> 
.calc-container {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(5, 1fr);
    gap: 6px;
    padding: 6px;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
}

.calc-btn {
    width: 100%;
    height: 100%;
    min-height: 0;

    font-size: 20px;
    color: var(--color-text-primary) !important;
    cursor: pointer;
    box-sizing: border-box;
    border-radius: 6px;
}

.calc-display {
    grid-column: span 2;

    width: 100%;
    height: 100%;
    min-height: 0;

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

    addSystemApp("settings", icns.settings, function(args = null){
    if (document.querySelector(".winbox.settings")) return;
        new wm(_('settings'),{x: "center",y: "center", width: 600,height:400,minheight: 200,minwidth:400,
         icon: icns.settings, class: [ wbtheme, "settings", 'no-full'], 
         html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8" />

    <style>html,body{margin:0;padding:0;height:100vh;width:100vw;overflow:hidden}#sett_app{width:100%;height:100%;overflow:hidden;container-type:inline-size}main{margin:0;padding:0;height:100%;width:100%;display:grid;grid-template-columns:clamp(140px,28cqi,240px) 1fr;grid-template-rows:100%;grid-template-areas:"sidebar content";transition:grid-template-columns .25s ease;overflow:hidden}#sett_app .settings-toolbar{height:100%;grid-area:sidebar;border-right:1px solid #ccc;background:var(--toolbar-bg);padding:10px;display:flex;flex-direction:column;gap:5px;transition:.3s;overflow-y:auto}
    
    #sett_app .sidebar-tab {
  display: block;        /* text-overflow doesn't work on inline elements */
  min-width: 0;          /* lets it shrink inside the flex column */
  max-width: 100%;
  overflow: hidden;      /* the missing piece */
  white-space: nowrap;
  text-overflow: ellipsis;
}
#sett_app .column{margin-top:15px;display:flex;justify-content:flex-start;gap:10px;width:max-content}#sett_app .content-container{grid-area:content;height:100%;overflow-y:auto;  background:var(--bg-color)}#sett_app .sidebar-handle{display:none}#sett_app .sidebar-tab:before{content:"» "}#sett_app .sidebar-tab:hover{text-decoration:underline}#sett_app .sidebar-tab.active{font-weight:bold;color:var(--accent-color,#4a9eff)}#sett_app .sidebar-separator{border-top:1px solid var(--input-border);margin:6px 0}@container (width < 700px){main.sidebar-collapsed{grid-template-columns:50px 1fr}main.sidebar-collapsed .settings-toolbar{align-items:center}main.sidebar-collapsed .settings-toolbar .sidebar-tab,main.sidebar-collapsed .settings-toolbar .sidebar-separator{display:none!important}#sett_app .sidebar-handle{display:block!important;width:100%;padding:8px 0;cursor:pointer;text-align:center}}#sett_app .settright{display:flex;align-items:center;gap:5px;align-self:flex-end;width:calc(fit-content() + 500px);margin-right:5px}#sett_app .settright select{box-sizing:border-box;width:auto!important}.settright>div{flex-direction:row;gap:5px}#sett_app .setting-row:not(.settright):not(.column){display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:40px;padding:2.5px 5px;transition:background-color .15s ease-in-out}#sett_app #sett_app .setting-row:not(.column):not(.settright):hover{background-color:var(--button-border);border-radius:var(--radius-sm);}#sett_app .setting-label{flex-grow:1;width:100%;font-size:16px;line-height:1.3}@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}#sett_app #kbrd{display:block;width:100%;height:auto;margin:0;border-bottom-left-radius:5px;transition:opacity .5s ease-in-out;opacity:1;margin-right:-15px;}#sett_app #dispImg{--r:960/540;aspect-ratio:var(--r);height:min(90%,min(960px,90vh*(var(--r))));width:90%;text-align:center;justify-content:center;background:#000;color:#fff;border:darkgrey 2.5px solid;padding:5px;border-radius:5px;}#sett_app .crt{position:relative;animation:textShadow 1.6s infinite}.crt:before{content:" ";display:block;position:absolute;top:0;left:0;bottom:0;right:0;background:linear-gradient(rgba(18,16,16,0) 50%,rgba(0,0,0,.25) 50%),linear-gradient(90deg,rgba(255,0,0,.06),rgba(0,255,0,.02),rgba(0,0,255,.06));z-index:2;background-size:100% 2px,3px 100%;pointer-events:none}@keyframes flicker{0%{opacity:.27861}5%{opacity:.34769}10%{opacity:.23604}15%{opacity:.90626}20%{opacity:.18128}25%{opacity:.83891}30%{opacity:.65583}35%{opacity:.67807}40%{opacity:.26559}45%{opacity:.84693}50%{opacity:.96019}55%{opacity:.08594}60%{opacity:.20313}65%{opacity:.71988}70%{opacity:.53455}75%{opacity:.37288}80%{opacity:.71428}85%{opacity:.70419}90%{opacity:.7003}95%{opacity:.36108}100%{opacity:.24387}}.crt:after{content:" ";display:block;position:absolute;top:0;left:0;bottom:0;right:0;background:rgba(18,16,16,.1);opacity:0;z-index:2;pointer-events:none;animation:flicker .15s infinite}@keyframes textShadow{0%{text-shadow:.4389924193300864px 0 1px rgba(0,30,255,.5),-.4389924193300864px 0 1px rgba(255,0,80,.3),0 0 3px}5%{text-shadow:2.7928974010788217px 0 1px rgba(0,30,255,.5),-2.7928974010788217px 0 1px rgba(255,0,80,.3),0 0 3px}10%{text-shadow:.02956275843481219px 0 1px rgba(0,30,255,.5),-.02956275843481219px 0 1px rgba(255,0,80,.3),0 0 3px}15%{text-shadow:.40218538552878136px 0 1px rgba(0,30,255,.5),-.40218538552878136px 0 1px rgba(255,0,80,.3),0 0 3px}20%{text-shadow:3.4794037899852017px 0 1px rgba(0,30,255,.5),-3.4794037899852017px 0 1px rgba(255,0,80,.3),0 0 3px}25%{text-shadow:1.6125630401149584px 0 1px rgba(0,30,255,.5),-1.6125630401149584px 0 1px rgba(255,0,80,.3),0 0 3px}30%{text-shadow:.7015590085143956px 0 1px rgba(0,30,255,.5),-.7015590085143956px 0 1px rgba(255,0,80,.3),0 0 3px}35%{text-shadow:3.896914047650351px 0 1px rgba(0,30,255,.5),-3.896914047650351px 0 1px rgba(255,0,80,.3),0 0 3px}40%{text-shadow:3.870905614848819px 0 1px rgba(0,30,255,.5),-3.870905614848819px 0 1px rgba(255,0,80,.3),0 0 3px}45%{text-shadow:2.231056963361899px 0 1px rgba(0,30,255,.5),-2.231056963361899px 0 1px rgba(255,0,80,.3),0 0 3px}50%{text-shadow:.08084290417898504px 0 1px rgba(0,30,255,.5),-.08084290417898504px 0 1px rgba(255,0,80,.3),0 0 3px}55%{text-shadow:2.3758461067427543px 0 1px rgba(0,30,255,.5),-2.3758461067427543px 0 1px rgba(255,0,80,.3),0 0 3px}60%{text-shadow:2.202193051050636px 0 1px rgba(0,30,255,.5),-2.202193051050636px 0 1px rgba(255,0,80,.3),0 0 3px}65%{text-shadow:2.8638780614874975px 0 1px rgba(0,30,255,.5),-2.8638780614874975px 0 1px rgba(255,0,80,.3),0 0 3px}70%{text-shadow:.48874025155497314px 0 1px rgba(0,30,255,.5),-.48874025155497314px 0 1px rgba(255,0,80,.3),0 0 3px}75%{text-shadow:1.8948491305757957px 0 1px rgba(0,30,255,.5),-1.8948491305757957px 0 1px rgba(255,0,80,.3),0 0 3px}80%{text-shadow:.0833037308038857px 0 1px rgba(0,30,255,.5),-.0833037308038857px 0 1px rgba(255,0,80,.3),0 0 3px}85%{text-shadow:.09769827255241735px 0 1px rgba(0,30,255,.5),-.09769827255241735px 0 1px rgba(255,0,80,.3),0 0 3px}90%{text-shadow:3.443339761481782px 0 1px rgba(0,30,255,.5),-3.443339761481782px 0 1px rgba(255,0,80,.3),0 0 3px}95%{text-shadow:2.1841838852799786px 0 1px rgba(0,30,255,.5),-2.1841838852799786px 0 1px rgba(255,0,80,.3),0 0 3px}100%{text-shadow:2.6208764473832513px 0 1px rgba(0,30,255,.5),-2.6208764473832513px 0 1px rgba(255,0,80,.3),0 0 3px}}#sett_app h2,#sett_app h1,#sett_app p,#sett_app label,#sett_app span,.setting-label,.sidebar-tab,.usage-list{color:var(--color-text-primary)}
#battery_graph {
    width: 100%;
    height: 250px;
}

            .page{
            padding-left:15px;
            margin-right:5px;
            }
/* See also — related settings panel */
#sett_app blockquote {
  margin: 0 0;
  padding: 12px 16px;
  border: 1px solid var(--input-border);
  border-left: 3px solid var(--accent-color, #4a9eff);
  border-radius: var(--radius-sm, 6px);
  background: var(--toolbar-bg);
  color: var(--color-text-primary);
}

/* Heading */
#sett_app blockquote > b {
  margin: 0 0 8px;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

/* Related items */
#sett_app blockquote > li {
  list-style: none;
  margin: 0;
  padding: 0;
}

            #sett_app .setting-row:not(.settright):not(.column)  {
            background-color: var(--toolbar-bg);
            margin-bottom:5px;
            border-radius: var(--radius-sm);
            border: 1px solid var(--toolbar-border);

            }

            #sett_app .setting-row:not(.settright):not(.column) select  {
            height:90%;
            }

#sett_app blockquote > li + li {
  border-top: 1px solid var(--input-border);
}

/* Links */
#sett_app blockquote > li > a {
  display: block;
  padding: 8px 0;
  color: var(--accent-color, #4a9eff);
  text-decoration: none;
  line-height: 1.4;
  transition: color 150ms ease;
}

#sett_app blockquote > li > a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

#sett_app blockquote > li > a:focus-visible {
  outline: 2px solid var(--accent-color, #4a9eff);
  outline-offset: 2px;
  border-radius: 2px;
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
        <a class="sidebar-tab ${hasCustomWm ? 'disabled' : ''}" data-page="usage" data-i18n="usage"></a>
        <a class="sidebar-tab" data-page="access" data-i18n="accessibility"></a>

        <div class="sidebar-separator"></div>

        <a class="sidebar-tab" data-page="devices" data-i18n="devices"></a>
        <a class="sidebar-tab ${HW_API ? '' : 'disabled'}" data-page="network" data-i18n="network"></a>
        <a class="sidebar-tab" data-page="display" data-i18n="display"></a>
        <a class="sidebar-tab" data-page="keyboard" data-i18n="keyboard"></a>
        <a class="sidebar-tab" data-page="battery" data-i18n="battery"></a>

        <div class="sidebar-separator"></div>

        <a class="sidebar-tab" data-page="files" data-i18n="files"></a>
        <a class="sidebar-tab" data-page="themes" data-i18n="themes"></a>
        <a class="sidebar-tab ${document.querySelector('footer') ? '' : 'disabled'}" data-page="panel" data-i18n="panel"></a>
    </div>


    <div class="content-container" id="settings-content" style='padding-top:0;padding-right:0;'>

        <!-- GENERAL -->
        <div class="page" data-page="general">
            <h2 data-i18n="general"></h2>

            <div class="setting-row">
                <span class="setting-label" data-i18n="language"></span>

                <select id="languageSelect">
                    <option value="en">English</option>
                    <option value="ua">Українська</option>
                    <option value="fr">Français</option>
                    <option value="ru">Русский</option>
                    <option value="pl">Polski</option>
                </select>

        <select id="regionSelect1">
            <option value="en-US">United States</option>
            <option value="uk-UA">Україна</option>
            <option value="fr-FR">France</option>
            <option value="ru-RU">Россия</option>
            <option value="pl-PL">Polska</option>
        </select>
            </div>



                      <div class="setting-row">
              <label for="vrbsBt" data-i18n="enable_verbose_boot"></label>
          <input id="vrbsBt" type="checkbox">
      </div>

                          <div class="setting-row">
              <label for="checkAPIonBoot" data-i18n="enable_api_check"></label>
          <input id="checkAPIonBoot" type="checkbox">
      </div>
                      <div class="setting-row">
              <label for="cleanOnBootTgl" data-i18n="clean_config_drive_on_boot"></label>
          <input id="cleanOnBootTgl" type="checkbox">
      </div>
          
        </div>
        
        <div class="page" data-page="devices" hidden>



            <h2 data-i18n="devices"></h2>
            <ul id='dev_list' style="list-style-type: none;"></ul>

            <h2 data-i18n="printers"></h2>
            <ul id='pri_list' style="list-style-type: none;"></ul>

        </div>


<div class="page" data-page="battery" hidden>
    <h2 data-i18n="battery"></h2>
<ul id="battery_stats" style="list-style-type: none;"></ul>
<div id="battery_graph">
    <canvas id="batteryChart"></canvas>
</div>
    <blockquote>
<b data-i18n='see_also'>See also:</b>
            <a class='sidebar-tab' data-page='display' data-i18n='screen_timeout'></a>
            </blockquote>
</div>

<div class="page" data-page="access" hidden>
    <h2 data-i18n="accessibility"></h2>
<div class="setting-row">
              <label for="turnOnAnims" data-i18n="turn_on_animations"></label>
          <input id="turnOnAnims" type="checkbox">
      </div>

<div class="setting-row">
              <label for="highContrast" data-i18n="high_contrast_text"></label>
          <input id="highContrast" type="checkbox">
      </div>

    <blockquote>
<b data-i18n='see_also'>See also:</b>
            <a class='sidebar-tab' data-page='themes' data-i18n='hide_win_content_on_transform'></a>
            </blockquote>
</div>

<!-- NETWORK -->
<div class="page" data-page="network" hidden>
    <h2>Wi-Fi</h2>
    <ul id="wifi_list" style="list-style-type: none;"></ul>
    
    <h2>Bluetooth <input type='checkbox' id='bt_toggle'> </h2>
    <ul id="bt_list" style="list-style-type: none;"></ul>

</div>

              <div class="page" data-page="usage" hidden>

            <h2 data-i18n="usage"></h2>
            <label for='allowUsage' data-i18n="allow_usage"></label>
            <input id="allowUsage"  type="checkbox"> 

              <div style="padding-top:15px;" id="usage-list" class="usage-list"></div>

        </div>


    <!-- DISPLAY -->
    <div class="page" data-page="display" hidden>
        <div style="display: flex; align-items: flex-start; gap: 20px;margin-top: 0;">

            <!-- Лівий блок: заголовок та опис -->
            <div style="flex:1;">
                <h2 data-i18n="display"></h2>
         <div class="setting-row column">
        <label for="bgClockShow" data-i18n="show_bg_clock"></label>
          <input id="bgClockShow" type="checkbox">
          </div>
         <div class="setting-row column">
              <label for="hotCorners" data-i18n="touch_gestures"></label>
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
            <div style="flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-start; width:auto;    margin-top: 5px;">

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
    <div class="page" data-page="keyboard" style='margin-right:0;margin-top:0;' hidden>
        <div style="display: flex; align-items: flex-start; gap: 20px;margin-top: 0;">

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
    <div class="setting-row">
            <label for='colorFolders' data-i18n="color_folders_by_size"></label>
            <input id="colorFolders" type="checkbox"> 
    </div>
    <div class="setting-row">
            <label for='showLSCheck' data-i18n="show_LS_drive_in_files"></label>
            <input id="showLSCheck" type="checkbox"> 
    </div>
    <div class="setting-row">
            <label for='showSSCheck' data-i18n="show_SS_drive_in_files"></label>
            <input id="showSSCheck" type="checkbox"> 
    </div>
    <div class="setting-row">
            <label for='showCKCheck' data-i18n="show_CK_drive_in_files"></label>
            <input id="showCKCheck" type="checkbox" ${maxCK == 0 ? 'disabled': ''}> 
    </div>
            <h2 data-i18n="columns"></h2>
          <toggle-order-list style='margin-top:10px;' id='files-cols-lst'></toggle-order-list>

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
                        <option data-i18n="bottom" selected value="bt">Bottom</option>
                        <option data-i18n="top" value="top">Top</option>
    </select>
                    </div>
                
                
                        <div class="setting-row">
                    <label for='panelSize' class="setting-label"  data-i18n="small_panel_size"></label>
    <input type="checkbox" id="panelSize">
                    </div>

        <div class="setting-row">
            <label for='showDeskZone' data-i18n="show_peek_at_desktop_zone_in_tray"></label>
            <input id="showDeskZone" type="checkbox"> 
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


let wifiNetworksInitialized = false;


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
    
    // 1. Save current wbtheme state before making changes
    const previousWbtheme = wbtheme.split(' ')[0] || "glass-theme";

    let targetWbtheme = "glass-theme";
    let targetStyles = null;
    let targetFile = null;

    // 2. Resolve target type & prepare data
    if (selectedName === "none" || selectedName === "dark") {
        targetWbtheme = "glass-theme";
    }else {
        targetFile = themeFiles.find(f => f.name === selectedName);
        if (!targetFile) return;

        try {
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsText(targetFile);
            });

            const thm = parser.parse(text, selectedName);
            if (thm && thm.styles) {
                // File themes get type from thm.type (e.g. "win_cla", "win_aero", "kde")
                targetWbtheme = thm.type || thm.name || "user-theme";
                targetStyles = thm.styles;
            }
        } catch (err) {
            console.error("Error loading theme file:", err);
            return;
        }
    }

    // 3. Compare theme types (e.g. "glass-theme dark" vs "win_cla" vs "kde")
    const shouldConfirm = previousWbtheme !== targetWbtheme;
    

    // 4. Update state and UI
    if (selectedName === "none") {
        localStorage.removeItem("theme");
        theme = null;
        wbtheme = "glass-theme";
        applyThemeToUI(wbtheme);
    } else if (selectedName === "dark") {
        localStorage.setItem("theme", "dark");
        theme = "dark";
        wbtheme = "glass-theme dark";
        applyThemeToUI(wbtheme);
    } else if (targetFile && targetStyles) {
        localStorage.setItem("theme", targetFile.name);
        theme = targetFile.name;
        await parser.applyTheme(targetStyles);
        await applyThemeToUI(wbtheme);

        await setPanelConfig(JSON.parse(localStorage.getItem("panelConf")) || {});
    }

    // 5. Ask for restart if boundaries/types were crossed
    if (shouldConfirm) {
        const reboot = await confirm(_("confirm_set_theme"));
        if (reboot) {
            safeShutdown({ restart: true });
            wbtheme = targetWbtheme;
        }
    }
};

        const toggleBtn = document.getElementById("sidebarToggle");
    const tabs = document.querySelectorAll(".sidebar-tab");
    const pages = document.querySelectorAll(".page");
    const langSelect = document.getElementById("languageSelect");
    const regSelect = document.getElementById("regionSelect1");
    const tbPosSelect = document.getElementById("panelPosSelect");
    const tbSizeSelect = document.getElementById("panelSize");
    const tbShowPeek = document.getElementById("showDeskZone");

    toggleBtn.onclick = () => {
        document.querySelector("main").classList.toggle("sidebar-collapsed");
    };

    /* ===== I18N ===== */
    function updateTexts() {
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.dataset.i18n;
            const text = _(key);
            //console.log(key+": "+text)
            if (text !== undefined) el.textContent = text;
        });
    }

    /* ===== INIT LANGUAGE ===== */
    function initLanguageSelect() {
        const cl = currentLang;
        const dl = dateLang;
        if (!cl || !dl) return;
        langSelect.value = currentLang;
        regSelect.value = dateLang;
    }
    panelPosSelect.value = (JSON.parse(localStorage.getItem('panelConf')) ?? {pos:"bt"}).pos || 'bt';

    tbSizeSelect.checked = (JSON.parse(localStorage.getItem('panelConf')) || {}).size == 30 ? true : false;

    tbSizeSelect.oninput = () => {
        
    setPanelConfig({ size: tbSizeSelect.checked ? 30 : 35 });
    }

    tbShowPeek.checked = (JSON.parse(localStorage.getItem('panelConf')) || {}).showPeekZone;

    tbShowPeek.oninput = () => {
        
    setPanelConfig({ showPeekZone: tbShowPeek.checked });
    }

    panelPosSelect.onchange = () => {
    
    setPanelConfig({pos: panelPosSelect.value});
    }

    /* ===== CHANGE LANGUAGE ===== */
    langSelect.onchange = () => {
        currentLang = langSelect.value;
        loadLanguage(currentLang, dateLang);
        setTimeout(() => {
            updateTexts();      // оновлюємо тексти
            initLanguageSelect(); // щоб select відобразив актуальне значення
        }, 50);
    };

    regSelect.onchange = () => {
        dateLang = regSelect.value;
        loadLanguage(currentLang, dateLang);
        setTimeout(() => {
            updateTexts();      // оновлюємо тексти
            initLanguageSelect(); // щоб select відобразив актуальне значення
        }, 50);
    };


    const kbrdImg = document.getElementById('kbrd');
    const screenTypeSelect = document.getElementById("screenTypeSelect");
    const dispImg = document.getElementById('dispImg');


    const wb = this;

    /* ===== TAB SWITCHING ===== */
    async function showPage(name) {

        wb.setTitle(_('settings')+(document.querySelector('[data-page='+name+"]").innerText == '' ? '' : " - "+document.querySelector('[data-page='+name+"]").innerText))
        
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
        if (!hasCustomWm){
        allowUsage.checked =  allowScreenTime;
        
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
    }else{
        allowUsage.disabled = true;
    }
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
if (name == 'battery'){
    const cont = document.getElementById('battery_stats');

navigator.getBattery().then((battery) => {

    const ctx = document.getElementById('batteryChart').getContext('2d');
// Read the variable from :root
const primaryColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--accent-color')
  .trim();

console.log(primaryColor); // Output: e.g., "#3498db"
try{
    const batteryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: _('level'),
                data: [],
                 borderColor: primaryColor,
                 pointStyle: false,
                borderWidth: 2,
                tension: 0.3,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,

            scales: { y: { min: 0, max: 100, title: { display: true,
            text: '%' } } } } });


    function updateGraph() {

        const level = battery.level * 100;

        const seconds = battery.charging
            ? battery.chargingTime
            : battery.dischargingTime;

        // Browser doesn't know the estimated time
        if (!Number.isFinite(seconds) || seconds <= 0) {
            batteryChart.data.labels = [];
            batteryChart.data.datasets[0].data = [];
            batteryChart.update();
            return;
        }

        const minutes = seconds / 60;

        const labels = [];
        const values = [];

        /*
         * Create a prediction from now until:
         *
         * charging  -> 100%
         * discharging -> 0%
         *
         * Use one point every 5 minutes.
         */

        const step = 5;

        for (let t = 0; t <= minutes; t += step) {

            let percentage;

            if (battery.charging) {

                percentage =
                    level +
                    (100 - level) * (t / minutes);

            } else {

                percentage =
                    level -
                    level * (t / minutes);
            }

            percentage = Math.max(0, Math.min(100, percentage));

const futureTime = new Date(Date.now() + t * 60 * 1000);

labels.push(
    futureTime.toLocaleTimeString(dateLang, {
        hour: '2-digit',
        minute: '2-digit'
    })
);

            values.push(Number(percentage.toFixed(1)));
        }

        // Make sure the final point is exactly 100/0
        if (battery.charging) {
            values[values.length - 1] = 100;
        } else {
            values[values.length - 1] = 0;
        }

        batteryChart.data.labels = labels;

        batteryChart.data.datasets[0].data = values;

        batteryChart.data.datasets[0].label =
            battery.charging
                ? _('level') + ' → 100%'
                : _('level') + ' → 0%';

        batteryChart.update();
    }


    function updateAllBatteryInfo() {

        cont.innerHTML = `
            <li style='user-select:text;'>
                <b style='user-select:none;'>${_('level')}: </b>
                ${Math.round(battery.level * 100)}%
            </li>

            <li style='user-select:text;'>
                <b style='user-select:none;'>${_('connected')}: </b>
                ${battery.charging}
            </li>
        `;

        if (battery.charging) {

            cont.innerHTML += `
                <li style='user-select:text;'>
                    ${formatTime(battery.chargingTime)}
                    <b style='user-select:none;'>
                        ${_('until_full').toLowerCase()}
                    </b>
                </li>
            `;

        } else {

            cont.innerHTML += `
                <li style='user-select:text;'>
                    ${formatTime(battery.dischargingTime)}
                    <b style='user-select:none;'>
                        ${_('until_empty').toLowerCase()}
                    </b>
                </li>
            `;
        }

        updateGraph();
    }


    updateAllBatteryInfo();

    battery.addEventListener(
        "chargingchange",
        updateAllBatteryInfo
    );

    battery.addEventListener(
        "levelchange",
        updateAllBatteryInfo
    );

    battery.addEventListener(
        "chargingtimechange",
        updateAllBatteryInfo
    );

    battery.addEventListener(
        "dischargingtimechange",
        updateAllBatteryInfo
    );
}catch{}
});
}
if (name == "network") {
    const container = document.getElementById("wifi_list");
    container.innerHTML = "";
    try{
    const networks = await WlanUtils.list();

    networks.forEach(network => {
        const li = document.createElement("li");

const signal =
    network.signal >= 75 ? NETWORK_ICONS.wifiFull :
    network.signal >= 50 ? NETWORK_ICONS.wifi2 :
    network.signal >= 25 ? NETWORK_ICONS.wifi1 :
    NETWORK_ICONS.wifiOff;

        li.innerHTML = `
            <i>${network.ssid}</i>
            ${signal}
            ${network.security || ""}
            ${network.active ? ` - ${_("connected")}` : ""}
        `;

if (network.active) {
    li.style.fontWeight = "bold";
    li.style.cursor = "pointer";

    li.onclick = async () => {
        try {
            await WlanUtils.disconnect();

            await showPage("network");
        } catch (err) {
            console.error("Failed to disconnect Wi-Fi:", err.message);

        }
    };
} else {
    li.style.cursor = "pointer";

    li.onclick = async () => {
        let password = "";

        if (
            network.security &&
            network.security.toLowerCase() !== "open"
        ) {
          if (localStorage.getItem('wlan/pass_'+network.ssid)){
            password = localStorage.getItem('wlan/pass_'+network.ssid);
          }else{
            password = await prompt(
                _("wifi_password") + ": " + network.ssid
            );

            if (password === null) return;
        }
      }

        try {
            await WlanUtils.connect(network.ssid, password);
            await showPage("network");
            localStorage.setItem('wlan/pass_'+network.ssid, password)
        } catch (err) {
            console.error("Failed to connect to Wi-Fi:", err);

        }
    };
}

        container.appendChild(li);
    });
  }catch(e){
     container.innerHTML = _("not_found");
  }
const btToggle = document.getElementById('bt_toggle');
if (!HW_API){
btToggle.disabled = true;
    return;
}
btToggle.checked  = await BluetoothUtils.status;
btToggle.onchange = async ()=>{
  await BluetoothUtils.power(btToggle.checked);
  await showPage("network");
}

  const btContainer = document.getElementById("bt_list");
btContainer.innerHTML = "";

try {
  const devices = await BluetoothUtils.list();

  if (!Array.isArray(devices) || devices.length === 0) {
    btContainer.innerHTML = _("not_found");
  } else {
    devices.forEach((device) => {
      const li = document.createElement("li");
      const deviceName = device.name || device.mac;
      const isConnected = Boolean(device.connected);

      li.innerHTML = `
        <i>${deviceName}</i>
        <small>(${device.mac})</small>
        ${isConnected ? ` - ${ _("connected") }` : ""}
      `;

      li.style.cursor = "pointer";

      if (isConnected) {
        li.style.fontWeight = "bold";
        li.onclick = async () => {
          try {
            await BluetoothUtils.disconnect(device.mac);
            await showPage("network");
          } catch (err) {
            console.error("Failed to disconnect Bluetooth device:", err.message);
          }
        };
      } else {
        li.onclick = async () => {
          try {
            
            // Pair if device isn't paired yet, otherwise connect directly
            if (!device.paired) {
              await BluetoothUtils.pair(device.mac);
              await showPage("network");
            }
            await BluetoothUtils.connect(device.mac);
            await showPage("network");
          } catch (err) {
            console.error("Failed to connect to Bluetooth device:", err.message);
          }
        };
      }

      btContainer.appendChild(li);
    });
  }
} catch (e) {
  btContainer.innerHTML = _("not_found");
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
    if (name == 'access'){
        
const turnOnAnims = document.getElementById('turnOnAnims');
document.getElementById('turnOnAnims').checked = JSON.parse(localStorage.getItem('access/turnOnAnims') ?? 'true');
turnOnAnims.onchange = (e) => {
  const enabled = e.target.checked;

  document.body.classList.toggle('no-anims', !enabled);
  localStorage.setItem('access/turnOnAnims', JSON.stringify(enabled));
};

const highContrast = document.getElementById('highContrast');


document.getElementById('highContrast').checked = JSON.parse(localStorage.getItem('access/highContrast') ?? 'false');
highContrast.onchange = (e) => {
  const enabled = e.target.checked;

  document.body.classList.toggle('hi-contr', enabled);
  localStorage.setItem('access/highContrast', JSON.stringify(enabled));
};
    }
if (name == "files") {
    const showHiddenCheck = document.getElementById("showHidden");
    const colorFoldersCheck = document.getElementById("colorFolders");
    const showLSCheck = document.getElementById("showLSCheck");
    const showSSCheck = document.getElementById("showSSCheck");
    const showCKCheck = document.getElementById("showCKCheck");

    showHiddenCheck.checked = filesShowHidden;
    colorFoldersCheck.checked = filesColorFolders;
    showLSCheck.checked = filesShowLS;
    showSSCheck.checked = filesShowSS;
    showCKCheck.checked = filesShowCK;

    let tmpFilesCols = filesCols;
    const filesColsList = document.getElementById("files-cols-lst");

    // De-duplicate columns using a Set
    const uniqueCols = [...new Set([
        "name", "lastModified", "type", "size", ...filesCols
    ])];

    filesColsList.items = uniqueCols.map(col => ({
        id: col,
        label: _(col),
        checked: filesCols.includes(col) || col == "name",
        disabled: col == "name"
    }));

    // Save all file settings
    const saveFilesSettings = () => {
        filesSettings = {
            filesCols: tmpFilesCols,
            showHidden: filesShowHidden,
            colorFolders: filesColorFolders,
            showLS: filesShowLS,
            showSS: filesShowSS,
            showCK: filesShowCK
        };

        localStorage.setItem("config/files", JSON.stringify(filesSettings));
    };

    filesColsList.addEventListener("list-updated", () => {
        tmpFilesCols = filesColsList.items
            .filter(col => col.checked && !col.disabled)
            .map(col => col.id);

        filesCols = tmpFilesCols;

        console.log("List structure updated in real-time:", filesCols);
        saveFilesSettings();
    });

    showHiddenCheck.onchange = () => {
        filesShowHidden = showHiddenCheck.checked;
        saveFilesSettings();
    };

    colorFoldersCheck.onchange = () => {
        filesColorFolders = colorFoldersCheck.checked;
        saveFilesSettings();
    };

    showLSCheck.onchange = () => {
        filesShowLS = showLSCheck.checked;
        saveFilesSettings();
    };

    showSSCheck.onchange = () => {
        filesShowSS = showSSCheck.checked;
        saveFilesSettings();
    };

    showCKCheck.onchange = () => {
        filesShowCK = showCKCheck.checked;
        saveFilesSettings();
    };
}
        else if (name == "devices"){

    


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

    const container0 = document.getElementById("pri_list");
    container0.innerHTML = "";

    printers.forEach(dev => {
      const li = document.createElement("li");
      
        li.innerHTML = `<b>${_("printer")}</b>${dev.name}`;
      container0.appendChild(li);
    });



    


        }
    if (name == "general"){
   const cleanOnBootTgl = document.getElementById('cleanOnBootTgl');
const vrbsBt = document.getElementById('vrbsBt');
const checkAPIonBoot1 = document.getElementById('checkAPIonBoot');

function saveBootSettings() {
    localStorage.setItem("boot", JSON.stringify({
        verbose: verboseBoot,
        clean: cleanOnBoot,
        check: checkAPIonBoot
    }));
}

function updateBootControls() {
    const enabled = verboseBoot;


    cleanOnBootTgl.checked = cleanOnBoot;
    checkAPIonBoot1.checked = checkAPIonBoot;
}

vrbsBt.checked = verboseBoot;
cleanOnBootTgl.checked = cleanOnBoot;
checkAPIonBoot1.checked = checkAPIonBoot;

cleanOnBootTgl.onchange = () => {
    cleanOnBoot = cleanOnBootTgl.checked;
    saveBootSettings();
};

vrbsBt.onchange = () => {
    verboseBoot = vrbsBt.checked;
    updateBootControls();
    saveBootSettings();
};

checkAPIonBoot1.onchange = () => {
    checkAPIonBoot = checkAPIonBoot1.checked;
    saveBootSettings();
};

updateBootControls();
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
    hotCornersEnbl.checked = enableTouchpadGestures;
    gt.disabled = !enableTouchpadGestures;
    hotCornersEnbl.onchange = () => {
        
        enableTouchpadGestures = hotCornersEnbl.checked;
        gt.disabled = !enableTouchpadGestures;
            localStorage.setItem("enableTouchpadGestures", JSON.stringify(enableTouchpadGestures));
        
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
        if (tab.classList.contains('disabled')) {
            
        }
        tab.onclick = () => {
            showPage(tab.dataset.page);
        };
    });

    document.querySelectorAll('#sett_app blockquote a').forEach(tab => {
        
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



screenTypeSelect.value = displayType;

    screenTypeSelect.onchange = () => {

        displayType = screenTypeSelect.value;
        localStorage.setItem('config/dispType', displayType)

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
if (args){
    if (!document.querySelector('[data-page='+args+"]").classList.contains('disabled')) showPage(args);
    else this.close();
}
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


      if (this.currentActiveId && this.instances[this.currentActiveId]) {
          this.instances[this.currentActiveId][method](...args);
      }

      if (!INTERCEPT_ERRS) originalConsole[method](...args);
  };
            });
        }
    };

    if (!window.console._hooked) {
        const originalConsole = { ...window.console };
        window.ActiveTerminals.initHook(originalConsole);
        window.console._hooked = true;
    }

    addSystemApp("terminal", icns.term, function(){
        const uniqueTermId = Date.now();
        
        // Поточні змінні для системного префіксу (можна динамічно змінювати)
        let termHost = devProps.os.name.replaceAll(' ', '-').toLowerCase();

        new wm(_('terminal'), {
            x: "center", y: "center",
            icon: icns.term,
            class: [ wbtheme, 'winbox-terminal', 'tra', 'no-full'],
            html: `
    <div class="no-font" id="term-container-${uniqueTermId}" style="width:100%; height:100%; background:rgba(0,0,0,0.5); color:#fff; display:flex; flex-direction:column; user-select:text !important;">
      <div class='term' id="tout-${uniqueTermId}" style="flex-grow:1; overflow-y:auto; padding:10px; font-family:monospace !important; box-sizing:border-box;"></div>
    </div>
            `,
            oncreate: function () {
                const out = document.getElementById(`tout-${uniqueTermId}`);
                const container = document.getElementById(`term-container-${uniqueTermId}`);
                const activeInput = document.getElementById(`term-input-${uniqueTermId}`);
                let currInput = '';

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
                            
                            executeCommand(input);

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

            
            //if (activeInput) activeInput.focus();
        
    };

                function appendAnsiText(targetElement, rawStr, defaultColor = '#fff') {
                    const colors = {
                        30:"#000", 31:"#f55", 32:"#5f5", 33:"#ff5",
                        34:"#59f", 35:"#f5f", 36:"#5ff", 37:"#fff"
                    };
                    const wrapper = document.createElement('div');
                    wrapper.className = 'ansi-output';
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
                       const processed = args.map(arg => {
    let msg = '';

    if (arg && arg.message) {
        msg = arg.message;
    } else if (typeof arg === 'object' && arg !== null) {
        msg = JSON.stringify(arg);
    } else {
        msg = String(arg);
    }

    return msg ?? String(arg);
}).join(" ");
                        appendAnsiText(out, processed, '#f90');
                    },
    error: (...args) => {
        
        let msgerr = args.toString();
        /*
        const cmd0 = args[1]?.value?.trim()?.split(" ")[0];
        const cmd1 = currInput.split(' ')[0];
        try{
        if (Object.values(ActiveTerminals.instances).length == 0 || !INTERCEPT_ERRS) return originalConsole.error(...args);
        else if (Object.values(ActiveTerminals.instances).length > 0 && INTERCEPT_ERRS && currInput != ''){
            if (currInput.startsWith('/')) {
                msgerr = 'Path cannot start with a SLASH';
            } else if (currInput != '') {
                msgerr = 'DEFINE: ' + cmd1;
            }
        }else if (currInput == ''){
            return originalConsole.error(...args);
        }
    }catch{
        msgerr = 'Command not found';
    }
    */




        appendAnsiText(out, msgerr, '#f00');
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

const executeCommand = async (inp) => {
    const val = inp.value.trim();
    inp.value = '';
    currInput = val;
    if (!val) {
        createPromptLine();
        return;
    }

    history.push(val);
    historyIndex = -1;

    const cmdLog = document.createElement('div');
    cmdLog.style.color = '#aaa';
    cmdLog.className = 'ansi-output';
    cmdLog.innerHTML = termLbl + escapeHtml(val);
    
    const activeLine = out.querySelector('.term-active-line');
    if (activeLine) out.insertBefore(cmdLog, activeLine);

    window.ActiveTerminals.currentActiveId = uniqueTermId;

    try {
        const res = eval(`(async () => {
            const r = eval(${JSON.stringify(val)});
            return r instanceof Promise ? await r : r;
        })()`);

        const r = await res;

        if (r !== undefined && r !== null) {
            let outputText = "";

            if (r instanceof File || r instanceof Blob) {
                const fileMeta = {
                    name: r.name || null,
                    size: formatBytes(r.size),
                    type: r.type || "application/octet-stream",
                    lastModified: r.lastModified ? r.lastModified : "N/A",
                };
                outputText = JSON.stringify(fileMeta, null, 2);
            } else if (Array.isArray(r) && (r[0] instanceof File || r[0] instanceof Blob)) {
                const arrayMeta = r.map((f, idx) => ({
                    index: idx,
                    name: f.name || null,
                    size: formatBytes(f.size),
                    type: f.type,
                    lastModified: f.lastModified ? f.lastModified : "N/A",
                }));
                outputText = "Show as: array\nStorage: " + (typeof currentDisk !== 'undefined' ? currentDisk.name : 'N/A') + "\n" + JSON.stringify(arrayMeta, null, 2);
            } else if (typeof apps !== 'undefined' && r === apps) {
                const cleanedAppsForLog = apps.map(app => {
                    if (app.icon && app.icon.startsWith("data:")) return { ...app, icon: "BASE64 image omitted" };
                    if (app.element) return { ...app, element: true };
                    
                    return app; 
                });
                outputText = JSON.stringify(cleanedAppsForLog, null, 2);
            } else if (typeof r === 'object') {
    let targetObj = r;

    // Перетворюємо NodeList, PluginArray, HTMLCollection та інші псевдомасиви
    if (r.length !== undefined && !Array.isArray(r) && typeof r[Symbol.iterator] === 'function') {
        targetObj = Array.from(r);
    }

    // Безпечна серіалізація з захистом від циклічних посилань
    const getCircularReplacer = () => {
        const seen = new WeakSet();
        return (key, value) => {
            if (typeof value === 'function') {
                return `[Function: ${value.name || 'anonymous'}]`;
            }
            if (typeof value === 'object' && value !== null) {
                // Якщо зустріли DOM-елемент або Window
                if (value === window) return '[Window]';
                if (value instanceof HTMLElement) return `<${value.tagName.toLowerCase()}#${value.id || ''}>`;
                if (seen.has(value)) return '[Circular]';
                seen.add(value);
            }
            return value;
        };
    };

    try {
        const jsonStr = JSON.stringify(targetObj, getCircularReplacer(), 2);

        if (jsonStr === "{}" || jsonStr === "[]") {
            const className = r.constructor ? r.constructor.name : "Object";
            const keys = Object.keys(r);
            outputText = `${className} { ${keys.length ? keys.join(', ') : ''} }`;
        } else {
            outputText = jsonStr;
        }
    } catch (e) {
        // Резервний вивід, якщо об'єкт геть нестандартний
        const className = r.constructor ? r.constructor.name : "Object";
        outputText = `${className} { ${Object.keys(r).slice(0, 10).join(', ')}... }`;
    }
} else {
                outputText = (typeof r === 'string' && r.includes(' ') && typeof _ === 'function' ? _(r) : String(r));
            }

            if (outputText) {
                const resEl = document.createElement('div');
                resEl.style.color = '#fff';
                resEl.style.whiteSpace = 'pre-wrap';
                resEl.textContent = outputText;
                if (activeLine) out.insertBefore(resEl, activeLine);
            }
        }
    } catch(e) {
        console.error(e);
        
    }

    createPromptLine();
};

                // Ініціалізуємо найперший рядок вводу
                createPromptLine();
                currInput = '';
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

    addSystemApp("task_mgr", icns.tasks, function(){
        new wm(_('task_mgr'),{x: "center",y: "center",icon: icns.tasks,class: [ wbtheme, 'no-full'],url: 'apps/resmon.html',height:400,width:600,minheight: 200,minwidth:400, oncreate: function() {
                applySystemConfig(this.id)
              }});
    })
async function gitClone(e,t="main"){e.endsWith("/")&&(e=e.slice(0,-1)),e.includes("tree/")&&(e=e.split("tree/")[0]);const s=e.split("/"),n=s.pop(),o=s[s.length-1],a=`https://api.github.com/repos/${o}/${n}/zipball/${t}`;try{console.log(`Cloning into '${n}' (branch: ${t})...`);let e=await fetch(a);if(!e.ok&&t==="main")return console.warn(`Branch "${t}" not found. Retrying with "master"...`),await gitClone(e,"master");if(!e.ok)throw new Error(`HTTP error! status: ${e.status}`);const s=await e.blob();return await unzipFile(new File([s],`${n}.zip`),n),!0}catch(e){return console.error("Clone failed:",e.message||e),!1}}

async function node(fileName) {
    let file;
    if (typeof fileName == "string") {
        file = fs.find(f => f.name === fileName);
        if (!file) return console.error(`node: can't open file '${fileName}'`);
    } else if (fileName instanceof File) {
        file = fileName;
    }

    const rawCode = await file.text();

    // ---- Preload text of every file so sync require()/readFileSync work ----
    const textCache = new Map();
    await Promise.all(fs.map(async f => {
        try {
            if (typeof f.content === "string") textCache.set(f.name, f.content);
            else if (typeof f.text === "function") textCache.set(f.name, await f.text());
        } catch (e) {}
    }));

     

    try {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

        // Syntax check with AsyncFunction (plain Function rejects top-level await)
        try { new AsyncFunction(rawCode); }
        catch (e) { console.error(`node: Syntax Error: ${e.message}`); }

        const script = new AsyncFunction("require", "process", "console", rawCode);
        const process = {
            env: { NODE_ENV: "production" },
            version: devProps.os.version
        };

        await script(require, process, console);
        return `Process '${file.name}' finished.`;
    } catch (err) {
        console.error(`node: runtime error: \n${err.stack}`);
        throw err;
    }
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



    const wsModule = WSClient;
    wsModule.Server = WSServer;
    wsModule.WebSocket = WSClient;

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
            const f = fs.find(f => f.fullPath === path || f.name === path);
            if (!f) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            return textCache.get(f.name) ?? "";
        },
        writeFileSync: (path, data) => {
            const text = String(data);
            const newFile = new File([text], path, { type: "text/plain" });
            const idx = fs.findIndex(f => f.name === path);
            if (idx >= 0) fs[idx] = newFile; else fs.push(newFile);
            textCache.set(path, text);
            saveFileToDB(newFile);
            return true;
        },
        readdirSync: (path) => fs.filter(f => f.name.startsWith(path)).map(f => f.name),
        existsSync: (path) => !!fs.find(f => f.name === path)
    };

    // ---- require with module cache + sync loading from textCache ----
    const moduleCache = {};
    const require = (name) => {
        if (name === "fs") return virtualFS;
        if (name === "path") return pathModule;
        if (name === "events") return { EventEmitter };
        if (name === "ws") return wsModule;

        const clean = name.replace(/^\.\//, "");
        const base = `system/node_modules/${clean}`;
        const candidates = [base, base + ".js", base + "/index.js"];
        const modulePath = candidates.find(p => textCache.has(p));

        if (!modulePath) {
            console.error(`Cannot find module '${name}' (looked in ${candidates.join(", ")})`);
            return {};
        }
        if (moduleCache[modulePath]) return moduleCache[modulePath].exports;

        const localModule = { exports: {} };
        moduleCache[modulePath] = localModule; // set before running (circular deps)

        const wrapper = new Function(
            "require", "module", "exports", "__filename", "__dirname",
            textCache.get(modulePath)
        );
        wrapper(
            require, localModule, localModule.exports,
            modulePath, modulePath.slice(0, modulePath.lastIndexOf("/"))
        );
        return localModule.exports;
    };




// ---- module-level helpers (WSClient, WSServer, pathModule, EventEmitter unchanged) ----
// class WSClient {...}  class WSServer {...}  const wsModule = ...  const pathModule = ...  class EventEmitter {...}

// Build an environment: preloads file text so require()/readFileSync can stay synchronous


const NM = "system/node_modules/";
const BINARY_EXT = /\.(wasm|zip|png|jpe?g|gif|webp|ico|mp3|mp4|webm|ogg|wav|ttf|otf|woff2?)$/i;

function normalizePath(p) {
    const out = [];
    for (const seg of p.split("/")) {
        if (!seg || seg === ".") continue;
        if (seg === "..") out.pop(); else out.push(seg);
    }
    return out.join("/");
}

async function createNodeEnv() {
    const textCache = new Map();
    await Promise.all(fs.map(async f => {
        if (BINARY_EXT.test(f.name)) return; // never load binaries as text
        try {
            if (typeof f.content === "string") textCache.set(f.name, f.content);
            else if (typeof f.text === "function") textCache.set(f.name, await f.text());
        } catch (e) {}
    }));

    const virtualFS = {
        readFileSync: (path) => {
            const f = fs.find(f => f.fullPath === path || f.name === path);
            if (!f) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            return textCache.get(f.name) ?? "";
        },
        writeFileSync: (path, data) => {
            const text = String(data);
            const newFile = new File([text], path, { type: "text/plain" });
            const idx = fs.findIndex(f => f.name === path);
            if (idx >= 0) fs[idx] = newFile; else fs.push(newFile);
            textCache.set(path, text);
            saveFileToDB(newFile);
            return true;
        },
        readdirSync: (path) => fs.filter(f => f.name.startsWith(path)).map(f => f.name),
        existsSync: (path) => !!fs.find(f => f.name === path)
    };

    const moduleCache = {};

    // base = normalized path without extension; honors package.json "main"
    function findModule(base) {
        const cands = [base, base + ".js", base + ".json"];
        const pkg = textCache.get(base + "/package.json");
        if (pkg) {
            try {
                const main = JSON.parse(pkg).main;
                if (main) {
                    const m = normalizePath(base + "/" + main);
                    cands.push(m, m + ".js", m + "/index.js");
                }
            } catch (e) {}
        }
        cands.push(base + "/index.js");
        return cands.find(p => textCache.has(p));
    }

    function makeRequire(fromDir) {
        return function require(name) {
            if (name === "fs") return virtualFS;
            if (name === "path") return pathModule;
            if (name === "events") return { EventEmitter };
            if (name === "ws") return wsModule;

            const relative = name.startsWith("./") || name.startsWith("../");
            const base = normalizePath(relative ? fromDir + "/" + name : NM + name);
            const modulePath = findModule(base);

            if (!modulePath) {
                const err = new Error(`Cannot find module '${name}' (looked for ${base})`);
                err.code = "MODULE_NOT_FOUND";
                throw err;
            }
            if (moduleCache[modulePath]) return moduleCache[modulePath].exports;

            const text = textCache.get(modulePath);
            const mod = { exports: {} };
            moduleCache[modulePath] = mod; // set before running (circular deps)

            if (modulePath.endsWith(".json")) {
                mod.exports = JSON.parse(text);
                return mod.exports;
            }

            const dir = modulePath.slice(0, modulePath.lastIndexOf("/"));
            try {
                new Function("require", "module", "exports", "__filename", "__dirname", text)(
                    makeRequire(dir), mod, mod.exports, modulePath, dir
                );
            } catch (e) {
                delete moduleCache[modulePath]; // don't keep a half-initialized module
                throw e;
            }
            return mod.exports;
        };
    }

    // Top-level scripts keep the old behavior: "./x" resolves inside system/node_modules
    const require = makeRequire(NM.slice(0, -1));
    const process = { env: { NODE_ENV: "production" }, version: devProps.os.version };

    return { require, process, fs: virtualFS, textCache, moduleCache };
}

// Shared environment, so other code can reuse it
let _nodeEnv = null;
async function getNodeEnv(refresh = false) {
    if (!_nodeEnv || refresh) _nodeEnv = await createNodeEnv();
    return _nodeEnv;
}
// Sync access. Only valid after getNodeEnv() has been awaited at least once
function getNodeEnvSync() {
    if (!_nodeEnv) throw new Error("Node env not initialized. Call await getNodeEnv() first.");
    return _nodeEnv;
}

async function node(fileName) {
    let file;
    if (typeof fileName == "string") {
        file = fs.find(f => f.name === fileName);
        if (!file) return console.error(`node: can't open file '${fileName}'`);
    } else if (fileName instanceof File) {
        file = fileName;
    }

    const rawCode = await file.text();
    const env = await getNodeEnv(true); // refresh so newly added files are visible

    try {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        try { new AsyncFunction(rawCode); }
        catch (e) { console.error(`node: Syntax Error: ${e.message}`); }

        const script = new AsyncFunction("require", "process", "console", rawCode);
        await script(env.require, env.process, console);
        return `Process '${file.name}' finished.`;
    } catch (err) {
        console.error(`node: runtime error: \n${err.stack}`);
        throw err;
    }
}




    const installedwasm = new Set();

function npmUpdate(s=false) {
    installedpkg.clear();
    ["fs", "path", "events", "ws"].forEach(p => installedpkg.add(p));

    const prefix = "system/node_modules/";
    fs.forEach(f => {
        if (!f.name.startsWith(prefix)) return;
        const parts = f.name.slice(prefix.length).split("/");
        let name;
        if (parts[0].startsWith("@") && parts.length >= 2) name = parts[0] + "/" + parts[1].replace(/\.js$/, "");
        else if (parts.length > 1) name = parts[0];            // folder package
        else name = parts[0].replace(/\.js$/, "");             // flat file (npmInstall)
        if (name && !installedpkg.has(name)) {
            if (!s) console.log("Updated pkg: " + name);
            installedpkg.add(name);
        }
    });
}

function libUpdate() {
    installedwasm.clear();
    const prefix = "system/shared/";
    fs.forEach(f => {
        if (!f.name.startsWith(prefix)) return;
        const parts = f.name.slice(prefix.length).split("/");
        if (parts.length > 1) installedwasm.add(parts[0]);                    // system/shared/<name>/...
        else if (parts[0].endsWith(".wasm")) installedwasm.add(parts[0].slice(0, -5)); // system/shared/<name>.wasm
    });
}

function npmList() { return [...installedpkg]; }
function libList() { return [...installedwasm]; }

// Call after any install/uninstall of a lib
async function refreshLibs() {
    await getNodeEnv(true);
    npmUpdate(true);
    libUpdate();
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
            installedpkg.delete(packageName);
        }

        console.log("Completed: "+ packageName);
        await getNodeEnv(true);
    npmUpdate(true);
    }

          async function purgeDir(dir, gui=false) {
              if (dir.trim() == "") return console.log("Cannot purge root directory.");
              let prg1;
              let currFile = 0;

              const folderPathWithSlash = dir.endsWith("/") ? dir : dir + "/";
              const folderPathWithoutSlash = dir.endsWith("/") ? dir.slice(0, -1) : dir;

              const rem = fs.filter(file => 
                  file.name.startsWith(folderPathWithSlash) || file.name === folderPathWithoutSlash
              );
              
              console.log("To be removed: " + rem.length);
    if (gui){
        prg1 = new progress(_('deleting'), 0,rem.length)
        prg1.oncancel = ()=>{
            return;
        }
    }

              for (const f of rem) {
                  console.log("Deleting: " + f.name);

                  await deleteFile(f.name);
    currFile++;

    if (gui && prg1) prg1.setValue(currFile);
    
                  
                  console.log("Deleted: " + f.name);
              }
    if (gui) prg1.close()
              
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
                }else if (lowerName.startsWith("system/node_modules/") && lowerName.endsWith(".js")){
                    await getNodeEnv(true);
                    npmUpdate(true);
                }else if (lowerName.startsWith("system/shared/") && lowerName.endsWith(".wasm")){
                    await refreshLibs();
                    
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
            return true;
        }
      }else if (currentDisk.type == 'cache'){
const cache = await caches.open(currentDisk.name);
await cache.delete(fileName.startsWith('/') ? fileName : ("/"+fileName));
      } else if (currentDisk.type == "sessionStorage") {
    const cleanFileName = fileName.trim();
    if (fs.length < initialLength) {
        sessionStorage.removeItem(cleanFileName);
        return true;
    }
}else if (currentDisk.type == "cookies") {
    await cookieStore.delete({
    name: fileName,
    path: "/"
});
} else if (currentDisk.type == 'USB'){
        try{
        const targetPath = `${currentDisk.where}/${fileName}`;
        const url = `/api/delete?path=${encodeURIComponent(targetPath)}`;
      const response = await fetch(url, { method: 'POST' });
      const result = await response.json();

  if (result.success) {
        console.log(`${fileName} successfully deleted!`);
        window.dispatchEvent(new CustomEvent("update", {
    detail: {
      type: "devices",
      timestamp: Date.now()
    }
  }));
        return true;
      } else {
        console.error("Delete err:", result.error);
        return false;
      }
    } catch (err) {
      console.error("Net Delete err:", err);
      return false;
    }
      }


        return false;
    } 


function updateTime(){if(PowerManager.isAsleep)return;const t=document.getElementsByClassName("clock-time"),d=document.getElementsByClassName("clock-date");if(!t.length&&!d.length)return;const n=new Date(),a=n.toLocaleTimeString(dateLang,{hour:"2-digit",minute:"2-digit",second:"2-digit"}),r=new Intl.DateTimeFormat(dateLang,{weekday:"short",day:"numeric",month:"long"}).format(n),c=r.charAt(0).toUpperCase()+r.slice(1);Array.from(t).forEach(e=>{e.textContent=a,updateSystemPopover(e,c,!1,!1)}),Array.from(d).forEach(e=>e.textContent=c)}
function hideMenus(e) {
    document.querySelectorAll(".menu").forEach(menu => {
        menu.style.display = "none";
    });

    if (
        !e.target.closest("#menubtn") &&
        !e.target.closest(".appmenu-category")
    ) {
        document.querySelector("#sysmenu")?.style.setProperty("display", "none");
    }
}

document.addEventListener("click", (event)=>{
    updateCapsLock(event);
    hideMenus(event);
});

document.addEventListener('contextmenu', e=>     updateCapsLock(e))

document.addEventListener('pointermove', updateCapsLock)
function showDeskMenu(e){e.preventDefault(),document.querySelectorAll(".menu").forEach(e=>e.style.display="none");const t=document.getElementById("deskM");t.querySelectorAll("li > p").forEach(e=>e.innerText=_(e.innerText)),t.style.display="block",t.style.left=e.clientX+"px",t.style.top=e.clientY+"px"}document.getElementById("desktop-fore").addEventListener("contextmenu",showDeskMenu),document.getElementById("desktopApps").addEventListener("contextmenu",showDeskMenu);


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
        const topRow = menu.querySelector(".menu-row-top");
        const divider = document.getElementById("t_");
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
            let visibleTopCount = 0;
            menu.querySelectorAll('li').forEach(li => {
                const command = commands[li.id];

                li.style.display = command ? "flex" : "none"; 
                li.onmousedown = null;
                li.onclick = null;

                if (command) {

                    if (li.parentElement && li.parentElement.classList.contains('menu-row-top')) {
                    visibleTopCount++;
                }

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
            // Toggle class on top container based on visible buttons inside it
        if (visibleTopCount === 1) {
            topRow.classList.add("single-item");
        } else {
            topRow.classList.remove("single-item");
        }

        topRow.style.display = visibleTopCount > 0 ? "" : "none";
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
                        if (level <= 15) {
                            currentSvg = BATTERY_ICONS.empty;
                            strokeColor = 'var(--color-error, red)';
                            batContainer.classList.add('blink')
                            if (!lowBattWarned) {
                                new Notification(_("low_batt"), { body: _("low_batt_body") });
                            }
                            lowBattWarned = true;
                        } else if (level <= 25) {
                            currentSvg = BATTERY_ICONS.low;
                            batContainer.classList.remove('blink')
                            lowBattWarned = true;
                            strokeColor = 'var(--color-error, red)';
                        } else if (level <= 75) {
                            currentSvg = BATTERY_ICONS.half;
                            batContainer.classList.remove('blink')
                            lowBattWarned = false;
                        } else {
                            currentSvg = BATTERY_ICONS.full;
                            batContainer.classList.remove('blink')
                            lowBattWarned = false;
                        }
                    }

                    if (level == 100) strokeColor = 'var(--color-success, lightgreen)';

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
            console.error("Battery API is not supported:", error.message);
        }
    }


function setBeatMon() {
    // body...
    if (performance.memory) {
  setInterval(() => {
    const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
    // If using more than 90% of the allocated browser memory
    if (usedJSHeapSize > jsHeapSizeLimit * 0.90) {
      // Render your custom UI safely
      document.body.innerHTML = `
        <h1>System halted!</h1>
        Press <kbd>${currentKeyboardLayout == 'mac' ? '⌘' : 'CTRL'}</kbd>+<kbd>R</kbd> or <kbd>F5</kbd> ro reboot.`;
      setTimeout(() => location.reload(), 1000);
    }
  }, 5000);
  return true;
}else{
    return false;
}

}


async function updateNetwork() {
    const updateInfo = () => {
        if (PowerManager.isAsleep) return;

        const netContainer = document.getElementById("netw");
        if (!netContainer) return;

        const isOnline = navigator.onLine;
        const connection = navigator.connection ||
            navigator.mozConnection ||
            navigator.webkitConnection;

        const saveData = connection?.saveData ?? false;

        let currentSvg = NETWORK_ICONS.wifiOff;
        let tooltipText = "Offline";
        let strokeColor = "var(--color-error, red)";

        if (isOnline) {
            strokeColor = saveData ? "var(--color-success, lightgreen)" : "white";
            tooltipText = "Online";

            const type = connection?.type || "wifi";

            if (type === "ethernet") {
                currentSvg = NETWORK_ICONS.ethernet;
                tooltipText = "Ethernet Connection";
            } else {
                const effectiveType = connection?.effectiveType || "4g";

                tooltipText =
                    `Wi-Fi (~${connection?.downlink ?? '?'} Mb/s)` +
                    (saveData ? " SAVE-DATA" : "");

                if (effectiveType === "4g") {
                    currentSvg = NETWORK_ICONS.wifiFull;
                } else if (effectiveType === "3g") {
                    currentSvg = NETWORK_ICONS.wifi2;
                } else {
                    currentSvg = NETWORK_ICONS.wifi1;
                }
            }
        }

        netContainer.innerHTML = currentSvg;

        const svgElement = netContainer.querySelector("svg");
        if (svgElement) {
            svgElement.style.color = strokeColor;
        }

        updateSystemPopover(netContainer, tooltipText, false, false);
    };

    updateInfo();

    window.addEventListener("online", updateInfo);
    window.addEventListener("offline", updateInfo);

    const connection = navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;

    if (connection) {
        connection.addEventListener("change", updateInfo);
    }
}
function updateCapsLock(event) {
    const el = document.getElementById("capsLockState");
    if (!el) return;
    if (!event || typeof event.getModifierState !== "function") return;

    el.style.display = event.getModifierState("CapsLock") ? "block" : "none";
}
document.addEventListener("keyup", (event) => {
    updateCapsLock(event)
});

function showDesktop(mode = -1) {
    if (mode == -1) {
        document.body.classList.toggle('peek');

    } else {
        document.body.classList.toggle('peek', !mode);
    }
}

    async function updateBluetooth() {
        const updateInfo = async () => {
        if (PowerManager.isAsleep) return;
        const netContainer = document.getElementById("bt");
        if (!netContainer) return;
        if (!HW_API) return netContainer.style.display = 'none';
          const act = await BluetoothUtils.status;
            netContainer.style.display = act ? 'block': "none";

        };

        updateInfo();

    }
        setInterval(updateBluetooth, 500);



    async function updateVolume(){
        const volContainer = document.getElementById("vol");
        if (!volContainer) return;
        if (!HW_API){
            volContainer.style.display = 'none';
            return false;
        }else if (HW_API && volContainer.style.display == 'none'){
            volContainer.style.display = 'flex';
        }
        try{
        const vol0 = await getMasterVolume();
        const vol1 = vol0.volume;

        if (volContainer) {
            updateSystemPopover(
    volContainer,
    Math.round(vol1) + "%\n" +
    (devices.find(d => d.type == 'audioOutput' && d.name != 'Default')?.name || ''),
    false,
    false
);
            if (vol1 == 0 || vol0.muted) volContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-volume-mute" viewBox="0 0 16 16">
      <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06M6 5.04 4.312 6.39A.5.5 0 0 1 4 6.5H2v3h2a.5.5 0 0 1 .312.11L6 10.96zm7.854.606a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0"/>
    </svg>`;
            else if (vol1 > 50) volContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-volume-up" viewBox="0 0 16 16">
      <path d="M11.536 14.01A8.47 8.47 0 0 0 14.026 8a8.47 8.47 0 0 0-2.49-6.01l-.708.707A7.48 7.48 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303z"/>
      <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.48 5.48 0 0 1 11.025 8a5.48 5.48 0 0 1-1.61 3.89z"/>
      <path d="M10.025 8a4.5 4.5 0 0 1-1.318 3.182L8 10.475A3.5 3.5 0 0 0 9.025 8c0-.966-.392-1.841-1.025-2.475l.707-.707A4.5 4.5 0 0 1 10.025 8M7 4a.5.5 0 0 0-.812-.39L3.825 5.5H1.5A.5.5 0 0 0 1 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 7 12zM4.312 6.39 6 5.04v5.92L4.312 9.61A.5.5 0 0 0 4 9.5H2v-3h2a.5.5 0 0 0 .312-.11"/>
    </svg>`;
            else volContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-volume-down" viewBox="0 0 16 16">
      <path d="M9 4a.5.5 0 0 0-.812-.39L5.825 5.5H3.5A.5.5 0 0 0 3 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 9 12zM6.312 6.39 8 5.04v5.92L6.312 9.61A.5.5 0 0 0 6 9.5H4v-3h2a.5.5 0 0 0 .312-.11M12.025 8a4.5 4.5 0 0 1-1.318 3.182L10 10.475A3.5 3.5 0 0 0 11.025 8 3.5 3.5 0 0 0 10 5.525l.707-.707A4.5 4.5 0 0 1 12.025 8"/>
    </svg>`; // Оптимізовано checks
        }
    }catch{
        volContainer.style.display = 'none';
        return false;
    }}

    setInterval(updateVolume, 500);

  function initGestures() {
    let accumulatedDeltaY = 0;
    let gestureTimeout = null;
    const targetItem = document;
    const THRESHOLD = gestureThreshold;

    targetItem.addEventListener('wheel', (e) => {
      if (classifyWheel(e) == 'mouse') return; // ignore real mouse wheels
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || !enableTouchpadGestures) return;
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
        } else if (!el.classList.contains('min') && !el.classList.contains('no-min') && !el.classList.contains('hide')) {
          el.winbox.minimize();
        }
      }
    }, { passive: true });
  }

  initGestures()



    

    
  let metaShortcut = false;

window.addEventListener("keydown",e=>{if(e.key!=="Meta"&&e.metaKey)metaShortcut=true},true),window.addEventListener("keyup",e=>{if(e.key==="Meta"){metaShortcut||openMenu(),metaShortcut=false}},true);
    window.addEventListener('keydown', function(event) {
      if (event.key === INTERR_KEY) {
        BOOT_INTERR = true;
        document.getElementById('INTERR_MSG').innerHTML = `<span style=\'color:red;\'>[FAIL] Startup interrupted by user</span>`
      }

      const blockEvent = () => {
          event.preventDefault();
          event.stopPropagation();
      };

      const isMac = typeof currentKeyboardLayout !== 'undefined' && currentKeyboardLayout === 'mac';
      const key = event.key;
      const code = event.code;
      const isMetaOrCtrl = event.metaKey || event.ctrlKey;

      // 1. App Launchers & System Overrides
      const isMeta = event.metaKey; 

// 1. App Launchers & System Overrides

// Mac: Cmd + F3 | Windows: Win + D
const isRevealDesk = isMac 
  ? (isMeta && code === 'F3') 
  : (isMeta && code === 'KeyD');




      const isRun = isMac ? (event.metaKey && code === 'Space') : (event.metaKey && code === 'KeyR');

      if (event.metaKey && code === 'KeyE') {
          blockEvent();
          return openApp("files");
      }

      if (event.metaKey && code === 'keyL') {
          blockEvent();
          return PowerManager.goToSleep();
      }

      if (isRun) {
          blockEvent();
          return openApp("run");
      }

if (isRevealDesk) {
  blockEvent();
  return showDesktop();
}


      const isScrSht = isMac
    ? (event.metaKey && event.shiftKey && event.code === "Digit3")
    : (event.code === "PrintScreen");

if (isScrSht && HW_API) {
    blockEvent();
    const n  = 'pictures/screenshots/' + Date.now() + '.png';
    screenCaptUtils.download(n);
    new Notification('Infinity OS', {body:_('saved_file_to').replace('{path}',n)} );
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

  }, { capture: true });


    window.addEventListener('keydown', function(event) {
      const isMetaOrCtrl = event.metaKey || event.ctrlKey;
      const code = event.code;

      // Prevent default browser behavior (Save, Print, Find) if not handled by an app
      if (isMetaOrCtrl && ['KeyS', 'KeyP', 'KeyF'].includes(code)) {
          event.preventDefault();
      }
  });


    // Uncomment this when terminal can't be accessed.
    /*
    indexedDB.deleteDatabase(DB_NAME);
    localStorage.clear();
    */