function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function redefineAdaptations() {
   if (detectMobile()) window.devicePixelRatio = 1.0;

// Core Setupc
const originalShowPicker = HTMLInputElement.prototype.showPicker;
const originalClick = HTMLInputElement.prototype.click;


// Helper to normalize colors into strict lower-case 7-character hex format (#rrggbb)
function normalizeHexColor(color) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = color;
  const hex = ctx.fillStyle;
  // If browser normalizes to hex, return it; otherwise fallback to black
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : '#000000';
}


HTMLInputElement.prototype.showPicker = function () {
  if (this.type === 'color') {
    const inputEl = this;
    const initialValue = normalizeHexColor(inputEl.value || '#000000');
    let currentValue = initialValue;

    // --- Datalist support -------------------------------------------------
    const escapeAttr = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const getDatalistColors = () => {
      let list = inputEl.list;
      if (!list) {
        const id = inputEl.getAttribute('list');
        if (id) list = document.getElementById(id);
      }
      if (!list || !list.options) return [];

      const seen = new Set();
      const result = [];
      for (const opt of list.options) {
        if (opt.disabled) continue;
        const raw = (opt.value || '').trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(raw)) continue; // color inputs only accept #rrggbb
        const hex = normalizeHexColor(raw);
        if (seen.has(hex)) continue;
        seen.add(hex);
        result.push({
          hex,
          label: opt.label || opt.getAttribute('label') || opt.textContent.trim() || hex
        });
      }
      return result;
    };

    const suggestions = getDatalistColors();
    const SWATCH_SIZE = 24;
    const SWATCH_GAP = 6;
    const perRow = Math.max(1, Math.floor((284 + SWATCH_GAP) / (SWATCH_SIZE + SWATCH_GAP)));
    const swatchRows = Math.ceil(suggestions.length / perRow);
    const extraHeight = suggestions.length
      ? swatchRows * (SWATCH_SIZE + SWATCH_GAP) + 8
      : 0;

    const swatchesHTML = suggestions.length ? `
      <div id="picker-swatches" style="display: flex; flex-wrap: wrap; gap: ${SWATCH_GAP}px;">
        ${suggestions.map(s => `
          <div class="picker-swatch"
               data-color="${s.hex}"
               title="${escapeAttr(s.label)}"
               style="
                 width: ${SWATCH_SIZE}px;
                 height: ${SWATCH_SIZE}px;
                 background-color: ${s.hex};
                 border-radius: 4px;
                 border: 1px solid rgba(128,128,128,0.6);
                 box-sizing: border-box;
                 cursor: pointer;
               "></div>
        `).join('')}
      </div>
    ` : '';
    // ----------------------------------------------------------------------

    // Create custom color picker window via Window Manager
    const pickerWin = new wm('prototype.colorPicker', {
      class: [wbtheme, 'no-resize', 'no-header'],
      width: 300,
      height: 200 + extraHeight,
      x: 'center',
      y: 'center',
      html: `
        <div style="
          color: var(--color-text-primary);
          background-color: var(--bg-color);
          text-align: left;
          padding: 8px;
          box-sizing: border-box;
          width: 100%;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div id="picker-canvas" style="background-color: ${initialValue}; width: 100%; height: 100px; border: none; border-radius: 8px;"></div>

          ${swatchesHTML}

          <div style="display: flex; gap: 8px; align-items: center;">
            <label style="font-family: sans-serif; font-size: 12px;">HEX:</label>
            <input type="text" id="picker-hex" value="${initialValue}" style="flex: 1; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace;">
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: auto;">
            <button id="cancel" style="padding: 6px 12px;">${typeof _ === 'function' ? _("cancel") : "Cancel"}</button>
            <button id="apply" class="ok" style="padding: 6px 12px;">${typeof _ === 'function' ? _("ok") : "OK"}</button>
          </div>
        </div>
      `,
      oncreate: function () {
        const winBody = this.body || this;
        const colorCanvas = winBody.querySelector('#picker-canvas');
        const hexInput = winBody.querySelector('#picker-hex');
        const cancelBtn = winBody.querySelector('#cancel');
        const applyBtn = winBody.querySelector('#apply');
        const swatchEls = winBody.querySelectorAll('.picker-swatch');

        // Highlight the swatch matching the current value
        const refreshSelectedSwatch = () => {
          swatchEls.forEach(el => {
            const selected = el.dataset.color.toLowerCase() === currentValue.toLowerCase();
            el.style.outline = selected ? '2px solid var(--color-text-primary, #000)' : 'none';
            el.style.outlineOffset = selected ? '1px' : '0';
          });
        };

        // Helper to update target input and dispatch 'input' event (live preview)
        const updateLiveValue = (hex) => {
          const formattedHex = normalizeHexColor(hex);
          currentValue = formattedHex;
          inputEl.value = formattedHex;
          refreshSelectedSwatch();

          // Fire live input event
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        };

        // Handle direct text box edit
        hexInput.addEventListener('input', (e) => {
          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
            colorCanvas.style.backgroundColor = e.target.value;
            updateLiveValue(e.target.value);
          }
        });

        // Datalist swatch click: preview + sync the HEX field
        swatchEls.forEach(el => {
          el.addEventListener('click', () => {
            const hex = el.dataset.color;
            colorCanvas.style.backgroundColor = hex;
            hexInput.value = hex;
            updateLiveValue(hex);
          });
        });

        refreshSelectedSwatch();

        // Cancel button: Revert back to original value and fire 'input' event
        cancelBtn.onclick = () => {
          if (currentValue !== initialValue) {
            inputEl.value = initialValue;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          }
          this.close();
        };

        // Apply button: Commit final value and fire 'change' event
        applyBtn.onclick = () => {
          updateLiveValue(currentValue);
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          this.close();
        };
      }
    });

    return;
  }

  if (originalShowPicker) {
    originalShowPicker.call(this);
  }
};

// Override click on prototype to route through custom showPicker
HTMLInputElement.prototype.click = function () {
  if (this.type === 'color') {
    this.showPicker();
    return;
  }
  if (originalClick) {
    originalClick.call(this);
  }
};

// Global capture listener for user clicks and synthetic dispatchEvent calls
document.addEventListener('click', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === 'color') {
    event.preventDefault();
    event.target.showPicker();
  }
}, true);

/*
HTMLInputElement.prototype.click = function () {
  if (this.type === 'color') {
    this.showPicker();
    return;
  }
  originalClick.call(this);
};

// Catch physical user mouse clicks on color inputs
// Global capture listener in Core
document.addEventListener('click', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === 'color') {
    // 1. Prevent native default browser action
    event.preventDefault();

    // 2. Explicitly trigger your overridden showPicker logic
    event.target.showPicker();
  }
}, true); // Must run in capture phase
*/

// Polyfill the global if the browser doesn't provide it
if (!window.documentPictureInPicture) {
  window.documentPictureInPicture = new EventTarget();
}


documentPictureInPicture.requestWindow = async (param) => {
  if (!param?.width || !param?.height) return;

  const w = new wm('core.PictureInPicture', {
    class: [wbtheme, 'no-max', 'no-min', 'front', 'no-full'],
    x: "center",
    y: "center",
    width: param.width,
    height: param.height
  });

  const listeners = new Map();
  let isClosed = false;

  const fakeDocument = new Proxy(w.body, {
    get(target, prop) {
      if (prop === 'body') return w.body;
      if (prop === 'head') return document.head;
      if (prop === 'getElementById') {
        return (id) => target.querySelector(`#${CSS.escape(id)}`);
      }
      if (prop === 'createElement') {
        return document.createElement.bind(document);
      }
      const val = Reflect.get(target, prop);
      return typeof val === 'function' ? val.bind(target) : val;
    }
  });

  const pipWindow = {
    document: fakeDocument,
    
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },

    removeEventListener(type, callback) {
      if (listeners.has(type)) {
        listeners.get(type).delete(callback);
      }
    },

    dispatchEvent(event) {
      const typeListeners = listeners.get(event.type);
      if (typeListeners) {
        typeListeners.forEach(cb => cb.call(pipWindow, event));
      }
      return !event.defaultPrevented;
    },

    close() {
      if (isClosed) return;
      isClosed = true;

      // 1. Reset standard API global window reference
      if (window.documentPictureInPicture) {
        window.documentPictureInPicture.window = null;
      }

      // 2. Dispatch pagehide event synchronously to listeners
      const pageHideEvent = new Event('pagehide', {target: pipWindow});
      //Object.defineProperty(pageHideEvent, 'target', { value: pipWindow });
      pipWindow.dispatchEvent(pageHideEvent);

      // 3. Destroy underlying window manager instance
      if (typeof w.destroy === 'function') w.destroy();
      else if (typeof w.close === 'function') w.close();
      else w.element?.remove();
    }
  };

  // Keep track of active window instance
  if (!window.documentPictureInPicture) {
    window.documentPictureInPicture = new EventTarget();
  }
  window.documentPictureInPicture.window = pipWindow;

  // Catch window manager closing (if user clicks close 'X' button)
  if (typeof w.on === 'function') {
    w.on('close', () => pipWindow.close());
    w.on('destroy', () => pipWindow.close());
  }

  return pipWindow;
};

const NativeAbortController = window.AbortController;

window.abortControllers = window.abortControllers || [];

let nextAbortControllerId = 0;

window.AbortController = class TrackingAbortController extends NativeAbortController {
    constructor() {
        super();

        this.id = nextAbortControllerId++;

        window.abortControllers.push(this);

        this.signal.addEventListener('abort', () => {
            const index = window.abortControllers.indexOf(this);

            if (index !== -1) {
                window.abortControllers.splice(index, 1);
            }

            const rawReason = this.signal.reason;

            const isDefaultError =
                rawReason instanceof DOMException &&
                rawReason.name === 'AbortError';

            if (!isDefaultError) {
                console.error(
                    `[AbortCtrls #${this.id}] ${rawReason}`
                );
            }
        }, { once: true });
    }
};


  
window.open = function(url, targetName, windowFeatures = '') {

    // 1. Default Infinity OS window settings
    const parsedFeatures = {
        width: 600,
        height: 400,
        x: "center",
        y: "center",
        modal: false,
        resizable: true
    };

    // 2. Flexible windowFeatures parsing
    if (windowFeatures && typeof windowFeatures === 'string') {
        windowFeatures.split(',').forEach(feature => {
            const pair = feature.trim();
            if (!pair) return;

            let [key, val] = pair.split('=');

            key = key.trim().toLowerCase();
            val = val ? val.trim().toLowerCase() : 'yes';

            if (key === 'width' || key === 'innerwidth') {
                parsedFeatures.width =
                    parseInt(val, 10) || parsedFeatures.width;

            } else if (key === 'height' || key === 'innerheight') {
                parsedFeatures.height =
                    parseInt(val, 10) || parsedFeatures.height;

            } else if (key === 'left' || key === 'screenx') {
                parsedFeatures.x =
                    val === 'center'
                        ? 'center'
                        : (parseInt(val, 10) ?? parsedFeatures.x);

            } else if (key === 'top' || key === 'screeny') {
                parsedFeatures.y =
                    val === 'center'
                        ? 'center'
                        : (parseInt(val, 10) ?? parsedFeatures.y);

            } else if (key === 'modal' || key === 'popup') {
                parsedFeatures.modal =
                    val === 'yes' ||
                    val === '1' ||
                    val === 'true';

            } else if (key === 'resizable') {
                parsedFeatures.resizable =
                    val === 'yes' ||
                    val === '1' ||
                    val === 'true';
            }
        });
    }

    try {
        const clickedUrl = new URL(url);

        const assoc = getUrlAssoc();

        /*
         * URL.origin works for normal HTTP/HTTPS URLs.
         *
         * For custom schemes such as:
         *   store://
         *   store://app
         *
         * URL.origin returns "null", so fall back to the
         * HTTP/HTTPS regex.
         */
const origin =
    clickedUrl.origin !== 'null'
        ? clickedUrl.origin
        : `${clickedUrl.protocol}//${clickedUrl.host}`;

        /*
         * Check the association using the calculated key.
         */
        if (origin && Object.prototype.hasOwnProperty.call(assoc, origin)) {

        

            // IMPORTANT: use the same key that was checked
            const appPath = assoc[origin];

            const targetUrl =
                appPath + "?url=" + encodeURIComponent(url);

            // Launch Infinity OS application with full payload
            if (getFs().find(f => f.name == appPath)) {

                parent.Openf(
                    "text/html",
                    targetUrl,
                    false
                );

            } else {

                const firstParam =
                    clickedUrl.searchParams.values().next().value;

                parent.openApp(
                    appPath,
                    clickedUrl.searchParams
                );
            }

            return;
        }

    } catch (e) {
        console.error(
            "URL parsing failed inside window.open:",
            e
        );
    }


    
    const windowClasses = [wbtheme, 'text', 'no-full'];

    if (!parsedFeatures.resizable) {
        windowClasses.push('no-resize');
    }

    // Create the window SYNCHRONOUSLY.
    const fileWinBox = new wm(url, {
        icon: typeof ic !== 'undefined' ? ic : '',

        x: parsedFeatures.x,
        y: parsedFeatures.y,

        class: windowClasses,

        minheight: 200,
        minwidth: 255,

        width: parsedFeatures.width,
        height: parsedFeatures.height,

        html: ``,

        onclose: function () {
            this.closed = true;
        }
    });

    // Load content asynchronously without making window.open async.
    (async function loadWindowContent() {
        try {
            let content = '';

            const response = await fetch(url);

            if (response.ok) {
                content = await response.text();
            } else {
                throw new Error(
                    `Failed to load ${url}: HTTP ${response.status}`
                );
            }

            const titleMatch = content.match(
                /<title[^>]*>([\s\S]*?)<\/title>/i
            );

            const title = titleMatch
                ? titleMatch[1].trim()
                : (url.split('/').pop() || 'App');

            fileWinBox.setTitle(title);

            const iconMatch = content.match(
                /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i
            );

            fileWinBox.setIcon(
                iconMatch ? iconMatch[1] : ''
            );

            const safeTarget = url.includes('?')
                ? '?' + url.split('?').pop()
                : '';

            const [
                modifiedContent,
                redefiner,
                redefiner1
            ] = await makeApp(
                content,
                title,
                safeTarget,
                url,
                fileWinBox
            );

            const escapeAttribute = value =>
                String(value)
                    .replace(/&/g, '&amp;')
                    .replace(/"/g, '&quot;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');

            const srcdoc = escapeAttribute(
                redefiner + modifiedContent + redefiner1
            );

            fileWinBox.body.innerHTML = `
                <div style="height:100%;width:100%">
                    <iframe
                        id="fileWinBox-frame-${fileWinBox.id}"
                        srcdoc="${srcdoc}"
                        style="width:100%;height:100%;border:none"
                        sandbox="
                            allow-scripts allow-forms allow-same-origin
                            allow-downloads allow-modals
                            allow-orientation-lock allow-pointer-lock
                            allow-presentation
                            allow-storage-access-by-user-activation
                        "
                        onload="parent.applySystemConfig('${fileWinBox.id}')"
                    ></iframe>
                </div>
            `;

        } catch (e) {
            console.error('Window loading failed:', e);

            fileWinBox.body.textContent =
                'Failed to load: ' + e.message;
        }
    })();

    // Return immediately, without waiting for fetch() or makeApp().
    return fileWinBox;
};

// Adapter: replace the body with your real parent.* write call


function makeWritable(path) {
    let chunks = [];      // simple model: buffer everything, commit on close
    let closed = false;

    const toBlobPart = async (d) => {
        if (typeof d === 'string' || d instanceof Blob || d instanceof ArrayBuffer || ArrayBuffer.isView(d)) return d;
        throw new TypeError('Unsupported data type for write()');
    };

    return {
        async write(data) {
            if (closed) throw new TypeError('Stream closed');
            // support { type: 'write', data } form
            if (data && typeof data === 'object' && data.type === 'write') data = data.data;
            // (type 'seek'/'truncate' ignored in this simple version)
            chunks.push(await toBlobPart(data));
        },
        async truncate(size) {
            // simple version: only truncate(0) is common
            if (size === 0) chunks = [];
        },
        async seek() { /* not supported in the simple model */ },
        async close() {
            if (closed) return;
            closed = true;
            await saveFileToDB(new File([chunks], path, {type: getMimeType(path)}));
        },
        async abort() { closed = true; chunks = []; }
    };
}

window.showSaveFilePicker = (opts = {}) => {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            window.removeEventListener('file_saved', onSaved);
            window.removeEventListener('file_cancel', onCanceled);
        };

        const onSaved = (e) => {
            cleanup();
            const path = e.detail.paths[0];
            resolve({
                kind: 'file',
                name: path.split('/').pop(),
                getFile: async () => parent.getFs().find(f => f.name === path),
                createWritable: async (/* { keepExistingData } */) => makeWritable(path),
                isSameEntry: async (other) => other?.name === path.split('/').pop(),
                // non-standard extras
        pickedTypeIndex: e.detail.typeIndex,
        pickedType: e.detail.type
            });
        };

        const onCanceled = () => {
            cleanup();
            reject(new DOMException('User aborted a request.', 'AbortError'));
        };

        window.addEventListener('file_saved', onSaved);
        window.addEventListener('save_cancel', onCanceled);

        const safeOpts = opts && typeof opts === 'object' ? opts : {};
        openApp('files', { ...safeOpts, runAs: 'save' });
    });
};


    

window.showOpenFilePicker = (opts = {}) => {
           
            
            return new Promise((resolve, reject) => {
                
                const onFileSelected = (e) => {
                    window.removeEventListener('file_picked', onFileSelected);
                    window.removeEventListener('file_cancel', onFileCanceled);
                    
                    const handles = e.detail.paths.map(path => ({
                        kind: 'file',
                        name: path.split('/').pop(),
                        getFile: async () => parent.getFs().find(f => f.name === path)
                    }));
                    resolve(handles);
                };

                const onFileCanceled = () => {
                    window.removeEventListener('file_picked', onFileSelected);
                    window.removeEventListener('file_cancel', onFileCanceled);
                    reject(new DOMException("User aborted a request.", "AbortError"));
                };

                window.addEventListener('file_picked', onFileSelected);
                window.addEventListener('file_cancel', onFileCanceled);

                const safeOpts = opts && typeof opts === 'object' ? opts : {};

                // Використовуємо СUSTOMEvent, щоб передати об'єкт без втрат!
                openApp('files', { ...safeOpts, runAs: 'file' })
                
                
            });
};

window.showDirectoryPicker = async (opts = {}) => {
    
            
            return new Promise((resolve, reject) => {
                
                const onDirSelected = (e) => {
                    window.removeEventListener('dir_picked', onDirSelected);
                    window.removeEventListener('dir_cancel', onDirCanceled);
                    
                    const chosenDirPath = e.detail.paths[0]; 
                    const dirName = chosenDirPath.split('/').filter(Boolean).pop() || "root";
                    
                    resolve({
    kind: 'directory',
    name: dirName,

    // 1. Метод entries() — повертає пари [name, handle]
    entries: function() {
        const iterable = {
            // Цей символ робить об'єкт асинхронно ітерованим для for await...of
            [Symbol.asyncIterator]: async function* () {
                const fs = typeof getFs === 'function' ? getFs() : [];
                const seenEntries = new Set();
                
                for (const file of fs) {
                    if (file.name.startsWith(chosenDirPath + '/')) {
                        const relativePath = file.name.substring(chosenDirPath.length + 1);
                        const parts = relativePath.split('/');
                        const firstSegment = parts[0];
                        
                        if (seenEntries.has(firstSegment)) continue;
                        seenEntries.add(firstSegment);
                        
                        if (parts.length > 1) {
                            // Повертаємо [ім'я, дескриптор папки]
                            yield [firstSegment, { kind: 'directory', name: firstSegment }];
                        } else {
                            // Повертаємо [ім'я, дескриптор файла]
                            yield [firstSegment, { kind: 'file', name: firstSegment, getFile: async () => file }];
                        }
                    }
                }
            }
        };
        return iterable;
    },

    // 2. Метод values() — повертає тільки дескриптори (без ключів)
    values: function() {
        const iterable = {
            [Symbol.asyncIterator]: async function* () {
                const fs = typeof getFs === 'function' ? getFs() : [];
                const seenEntries = new Set();
                
                for (const file of fs) {
                    if (file.name.startsWith(chosenDirPath + '/')) {
                        const relativePath = file.name.substring(chosenDirPath.length + 1);
                        const parts = relativePath.split('/');
                        const firstSegment = parts[0];
                        
                        if (seenEntries.has(firstSegment)) continue;
                        seenEntries.add(firstSegment);
                        
                        if (parts.length > 1) {
                            yield { kind: 'directory', name: firstSegment };
                        } else {
                            yield { kind: 'file', name: firstSegment, getFile: async () => file };
                        }
                    }
                }
            }
        };
        return iterable;
    },

    // 3. Для прямого перебору дескриптора папки (дехто пише for await (const x of dirHandle))
    [Symbol.asyncIterator]: function() {
        return this.entries()[Symbol.asyncIterator]();
    }
});
                };

                const onDirCanceled = () => {
                    window.removeEventListener('dir_picked', onDirSelected);
                    window.removeEventListener('dir_cancel', onDirCanceled);
                    reject(new DOMException("User aborted a request.", "AbortError"));
                };

                window.addEventListener('dir_picked', onDirSelected);
                window.addEventListener('dir_cancel', onDirCanceled);

                const safeOpts = opts && typeof opts === 'object' ? opts : {};

                 openApp('files', { ...safeOpts, runAs: 'dir' })
            });
};

window.originalConsoleError = console.error.bind(console);

window.showJsError = (message, source, lineno, colno) => {
    if (!INTERCEPT_ERRS) return;

    const escapeHtml = (value) =>
        String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);

    const details = source
    ? `<br><small>${escapeHtml(source)}${
        lineno != null || colno != null
            ? `<br>${lineno ?? "?"}:${colno ?? "?"}`
            : ""
      }</small>`
    : "";

    const htm = `
        <div style="color:var(--color-text-primary);
                    background-color:var(--bg-color);
                    width:100%;height:100%;">
            <img width="70" src="${icns.dialogErr}">
            <br>${escapeHtml(message.replace('Unhandled Rejection: ', '').replace("Uncaught Error: ",''))}${details}
        </div>`;

    try {
        new wm(_("js_error"), {
            x: "center",
            y: "center",
            class: [wbtheme, "no-max", 'no-full'],
            icon: icns.dialogErr,
            height: 200,
            width: 230,
            minheight: 200,
            minwidth: 230,
            html: htm
        });

        
            sounds.play("error");
        
    } catch (e) {
        originalConsoleError("Critical System Error:", message, e);
    }
}



// Intercept uncaught JavaScript errors
window.onerror = (message, source, lineno, colno, error) => {
    // Avoid logging through the overridden console.error here
    originalConsoleError("Uncaught error:", error || message, source, lineno, colno);

    showJsError(
        message || error?.stack,
        source,
        lineno,
        colno
    );

    return true;
};

// Intercept unhandled promise rejections
window.addEventListener("unhandledrejection", event => {
    originalConsoleError("Unhandled rejection:", event.reason);

    showJsError(
        event.reason?.stack ||
        event.reason?.message ||
        String(event.reason)
    );
});


/* ==========================================================================
   InfinityOS print dialog
   - window.print()              print the text of the current document (as before)
   - openPrintDialog(source)     {text, title}  or  {data(base64), contentType, title}
   - printFile(file)             print a File/PDF/image from the Files app
   ========================================================================== */

const PRINT_MAX_FILE_BYTES = 10 * 1024 * 1024;           // server limit for files
const PRINT_NATIVE_TYPES = [                              // sent to CUPS as-is
    "application/pdf",
    "application/postscript",
    "image/png",
    "image/jpeg",
    "image/gif"
];

class PrintSourceError extends Error {
    constructor(key) { super(key); this.key = key; }      // key = language string id
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

// Any other image type (webp, bmp, svg, avif...) -> PNG, on a white background
function imageToPngBlob(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth || 1024;
            const h = img.naturalHeight || 1024;
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            canvas.toBlob(
                (png) => (png ? resolve(png) : reject(new PrintSourceError("unsupported_file_type"))),
                "image/png"
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new PrintSourceError("unsupported_file_type"));
        };
        img.src = url;
    });
}

async function fileToPrintSource(file) {
    const title = file.name.split("/").pop();
    const type = file.type || "";

    if (PRINT_NATIVE_TYPES.includes(type)) {
        const buf = await file.arrayBuffer();
        if (buf.byteLength > PRINT_MAX_FILE_BYTES) throw new PrintSourceError("print_file_too_large");
        return { data: await blobToBase64(new Blob([buf])), contentType: type, title };
    }

    if (type.startsWith("image/")) {
        const png = await imageToPngBlob(new Blob([await file.arrayBuffer()], { type }));
        if (png.size > PRINT_MAX_FILE_BYTES) throw new PrintSourceError("print_file_too_large");
        return { data: await blobToBase64(png), contentType: "image/png", title };
    }

    throw new PrintSourceError("unsupported_file_type");
}

window.printFile = async (file)=> {
    try {
        const source = await fileToPrintSource(file);
        return await openPrintDialog(source);
    } catch (err) {
        //showJsError(err instanceof PrintSourceError ? _(err.key) : String(err), file.name);
        return false;
    }
}

window.print = function () {
    const targetDoc = this.document || document;
    return openPrintDialog({ text: targetDoc.body.innerText, title: targetDoc.title });
};

window.openPrintDialog = (source) => {
    return new Promise((resolve) => {
        const isFile = typeof source.data === "string";
        const content = isFile ? "" : String(source.text || "");
        const jobTitle = String(source.title || "InfinityOS").slice(0, 100);
        const isPaged = isFile && (source.contentType === "application/pdf" ||
                                   source.contentType === "application/postscript");

        let closed = false;
        let activeJob = null; // { id, printer } once the job was accepted by CUPS
        let cancelled = false;

        // ---- helpers -------------------------------------------------------
        const api = async (body) => {
            const res = await fetch("/api/print", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            let data = {};
            try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
            return { res, data };
        };
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uni = document.querySelectorAll('.winbox').length + 1;
const id = (name) => `${name}${uni}`;

const pri = new wm(_("print_btn"), {
    icon: icns.printer,
    x: "center",
    y: "center",
    class: [wbtheme, "no-max", "no-resize", 'no-full'],
    height: isPaged ? 362 : 330,
    width: 380,
    html: `
        <div id="${id('print-dialog')}" style="padding: 8px 14px; box-sizing: border-box; text-align: left; color: var(--color-text-primary); background-color: var(--bg-color); width: 100%; height: 100%;">
            <div style="display: grid; grid-template-columns: 40% 60%; gap: 6px 8px; align-items: center;">
                <label data-i18n="select_printer"></label>
                <select id="${id('print-printer')}" style="width: 100%;" disabled></select>

                <label data-i18n="copies"></label>
                <input id="${id('print-copies')}" type="number" min="1" max="99" value="1" style="width: 100%; box-sizing: border-box;" disabled>

                <div id="${id('print-row-pages')}" style="display: none;">
                    <label data-i18n="page_range"></label>
                    <input id="${id('print-pages')}" type="text" placeholder="1-3,5" style="width: 100%; box-sizing: border-box;" disabled>
                </div>

                <div id="${id('print-row-paper')}" style="display: none;">
                    <label data-i18n="paper_size"></label>
                    <select id="${id('print-paper')}" style="width: 100%;" disabled></select>
                </div>

                <div id="${id('print-row-duplex')}" style="display: none;">
                    <label data-i18n="duplex"></label>
                    <select id="${id('print-duplex')}" style="width: 100%;" disabled></select>
                </div>

                <label data-i18n="orientation"></label>
                <select id="${id('print-orientation')}" style="width: 100%;" disabled></select>

                <label data-i18n="color_mode"></label>
                <select id="${id('print-color')}" style="width: 100%;" disabled></select>
            </div>

            <div style="text-align: center; margin-top: 12px;">
                <button id="${id('print-execute')}" class="ok" data-i18n="print_btn" focus disabled></button>
                <button id="${id('print-cancel-job')}" data-i18n="cancel_job" style="display: none;"></button>
                <p id="${id('print-status')}" style="margin: 8px 0 0; min-height: 1.2em;"></p>
            </div>
        </div>
    `,
    oncreate: function () {
        const root = document.getElementById(id("print-dialog"));

        // Localisation (scoped to this dialog)
        root.querySelectorAll("[data-i18n]").forEach((el) => {
            el.textContent = _(el.getAttribute("data-i18n"));
        });

        const $ = (name) => document.getElementById(id(name));

        const select = $("print-printer");
        const copiesInput = $("print-copies");
        const pagesRow = $("print-row-pages");
        const pagesInput = $("print-pages");
        const paperRow = $("print-row-paper");
        const paperSel = $("print-paper");
        const duplexRow = $("print-row-duplex");
        const duplexSel = $("print-duplex");
        const orientSel = $("print-orientation");
        const colorSel = $("print-color");
        const button = $("print-execute");
        const cancelBtn = $("print-cancel-job");
        const status = $("print-status");

        // Keep the rest of your existing oncreate code here.
                const controls = [select, copiesInput, pagesInput, paperSel, duplexSel, orientSel, colorSel];
                const setBusy = (busy) => {
                    controls.forEach((c) => (c.disabled = busy));
                    button.disabled = busy;
                };
                const setStatus = (key, raw, suffix) => {
                    status.textContent = key ? _(key) + (suffix || "") : (raw || "");
                };
                const showRow = (row, on) => { row.style.display = on ? "contents" : "none"; };
                const fill = (sel, items, selected) => {
                    sel.textContent = "";
                    items.forEach(([value, label]) => {
                        const opt = document.createElement("option");
                        opt.value = value;
                        opt.textContent = label;
                        if (value === selected) opt.selected = true;
                        sel.appendChild(opt);
                    });
                };
                const closeSoon = (ms) => setTimeout(() => { if (!closed) pri.close(); }, ms);

                // Static choices
                fill(duplexSel, [
                    ["one-sided", _("duplex_off")],
                    ["two-sided-long-edge", _("duplex_long")],
                    ["two-sided-short-edge", _("duplex_short")]
                ]);
                // PDFs/images keep their own orientation unless the user overrides it
                fill(orientSel, (isFile ? [["auto", _("orientation_auto")]] : []).concat([
                    ["portrait", _("portrait")],
                    ["landscape", _("landscape")]
                ]));
                fill(colorSel, [
                    ["color", _("color")],
                    ["monochrome", _("monochrome")]
                ]);
                showRow(pagesRow, isPaged);

                // ---- printer capabilities (paper size / duplex) ---------------
                let capsToken = 0;
                const loadCapabilities = async () => {
                    const token = ++capsToken;
                    showRow(paperRow, false);
                    showRow(duplexRow, false);
                    try {
                        const { data } = await api({ action: "capabilities", printer: select.value });
                        if (token !== capsToken || !data.success) return;

                        const opts = data.options || {};

                        const sizes = ((opts.PageSize && opts.PageSize.choices) || [])
                            .filter((c) => !c.startsWith("Custom"));
                        if (sizes.length) {
                            fill(paperSel, sizes.map((c) => [c, c]), opts.PageSize.default);
                            showRow(paperRow, true);
                        }

                        if (opts.Duplex && opts.Duplex.choices && opts.Duplex.choices.length > 1) {
                            showRow(duplexRow, true);
                        }
                    } catch (err) {
                        // Extra options are optional - printing still works without them
                        console.warn("Could not load printer capabilities:", err);
                    }
                };
                select.onchange = loadCapabilities;

                // ---- load CUPS printer queues ---------------------------------
                (async () => {
                    try {
                        const res = await fetch("/api/printers");
                        const data = await res.json();

                        if (!data.success) {
                            setStatus("printers_unavailable");
                            return;
                        }

                        if (!data.printers.length) {
                            setStatus("no_printers_found");
                            return;
                        }

                        fill(select, data.printers.map((n) => [n, n]), data.defaultPrinter);
                        setBusy(false);
                        loadCapabilities();
                    } catch (err) {
                        // console.error("Failed to load printers:", err);

                        resolve(false);
                        this.close();
                        showJsError(_("printers_unavailable"), "api/printers");
                    }
                })();

                // ---- follow the job after it was submitted --------------------
                const watchJob = async (job) => {
                    for (let i = 0; i < 60 && !closed && !cancelled; i++) {
                        await sleep(i === 0 ? 1500 : 2000);
                        if (closed || cancelled) return;
                        try {
                            const { data } = await api({ action: "jobs", printer: job.printer });
                            if (!data.success) return;
                            const alive = data.jobs.some((j) => j.jobId === job.id);
                            if (!alive) {
                                setStatus("print_completed");
                                cancelBtn.style.display = "none";
                                closeSoon(1500);
                                return;
                            }
                            setStatus("print_queued", null, ` (${job.id})`);
                        } catch (err) {
                            return; // stop polling quietly; the job was already sent
                        }
                    }
                };

                cancelBtn.onclick = async () => {
                    if (!activeJob) return;
                    cancelBtn.disabled = true;
                    try {
                        const { data } = await api({ action: "cancel", jobId: activeJob.id });
                        if (data.success) {
                            cancelled = true;
                            setStatus("print_cancelled");
                            cancelBtn.style.display = "none";
                            closeSoon(1200);
                            return;
                        }
                        setStatus(null, data.error || _("print_failed"));
                    } catch (err) {
                        console.error("Cancel request failed:", err);
                        setStatus("print_failed");
                    }
                    cancelBtn.disabled = false;
                };

                // ---- print ----------------------------------------------------
                button.onclick = async () => {
                    if (!isFile && !content.trim()) {
                        setStatus("print_empty");
                        return;
                    }

                    const copies = Math.min(99, Math.max(1, parseInt(copiesInput.value, 10) || 1));
                    copiesInput.value = copies;

                    const body = {
                        printer: select.value,
                        title: jobTitle,
                        copies,
                        colorMode: colorSel.value
                    };
                    if (isFile) {
                        body.data = source.data;               // base64
                        body.contentType = source.contentType;
                    } else {
                        body.text = content;
                    }
                    if (orientSel.value !== "auto") body.orientation = orientSel.value;
                    if (isPaged && pagesInput.value.trim()) body.pageRanges = pagesInput.value.trim();
                    if (duplexRow.style.display !== "none") body.sides = duplexSel.value;
                    if (paperRow.style.display !== "none" && paperSel.value) {
                        body.extraOptions = { PageSize: paperSel.value };
                    }

                    setBusy(true);
                    setStatus("printing");

                    try {
                        const { res, data } = await api(body);

                        if (res.ok && data.success) {
                            if (data.jobId) {
                                activeJob = { id: data.jobId, printer: data.printer || body.printer };
                                setStatus("print_success", null, ` (${data.jobId})`);
                                button.style.display = "none";
                                cancelBtn.style.display = "";
                                cancelBtn.disabled = false;
                                watchJob(activeJob);
                            } else {
                                setStatus("print_success");
                                closeSoon(1200);
                            }
                            return;
                        }

                        if (res.status === 413) {
                            setStatus(isFile ? "print_file_too_large" : "print_too_large");
                        } else if (data.error) {
                            setStatus(null, data.error);
                        } else {
                            setStatus("print_failed");
                        }
                    } catch (err) {
                        console.error("Print request failed:", err);
                        setStatus("print_failed");
                    }

                    // Let the user retry after an error
                    setBusy(false);
                };
            },
            onclose: function () {
                closed = true;
                resolve();
            }
        });
    });
}


class prgrs {
  constructor(lbl, prg = null, max = 100, oncancel = null) {
    this.max = max;
    this.prg = prg;
    this.lbl = lbl || _('loading_text');
    this.oncancel = oncancel;

    const self = this;

    // Create window manager instance
    this.win = new wm(this.lbl, {
      x: "center",
      y: "center",
      class: [wbtheme, "no-max", "no-resize", 'no-full'],
      icon: icns.dialogInfo,
      height: 140,
      width: 230,
      html: `
        <div style="
          color: var(--color-text-primary);
          background-color: var(--bg-color);
          text-align: left;
          padding: 5px;
          box-sizing: border-box;
          width: 100%;
          min-height: 100%;
        overflow: auto;
        ">
          <b>
            <span id="prg-done">${this.prg !== null && this.prg !== undefined ? this.prg : '?'}</span>/<span id="prg-total">${this.max}</span>
          </b>
          <progress id="prg-bar" max="${this.max}" ${this.prg !== null ? `value="${this.prg}"` : ""}></progress>
          <div style="text-align:right; padding:10px 15px 15px; flex-shrink:0;">
            <button id="cancel">${_('cancel')}</button>
          </div>
        </div>
      `,
      oncreate: function() {
        self.barEl = this.body.querySelector("#prg-bar");
        self.doneEl = this.body.querySelector("#prg-done");
        self.totalEl = this.body.querySelector("#prg-total");
        self.btnEl = this.body.querySelector("#cancel");

        self.btnEl.onclick = () => self.cancel();
      },
      onclose: function() {
        if (typeof self.oncancel === "function") {
          self.oncancel();
        }
      },
      onminimize: function() {
        self.updPrg(this);
      },
      onrestore: function() {
        self.updPrg(this);
      }
    });
  }

  // Set or update cancel handler dynamically
  setOnCancel(fn) {
    this.oncancel = fn;
    return this;
  }

  // Trigger cancel logic and close
  cancel() {
    if (typeof this.oncancel === "function") {
      this.oncancel();
    }
    this.close();
  }

  // Update text spans for current/total numbers
  updateText() {
    if (this.doneEl) {
      this.doneEl.textContent = (this.prg !== null && this.prg !== undefined) ? this.prg : '?';
    }
    if (this.totalEl) {
      this.totalEl.textContent = this.max;
    }
  }

  // Recalculate background gradient live
  updPrg(targetWin) {
    const win = targetWin || this.win;
    if (!win) return;

    const currentPrg = this.prg ?? 0;
    const progress = Math.min(100, Math.max(0, ((currentPrg / this.max) * 100))).toFixed(2);
    const gradient = `linear-gradient(to right, rgba(0, 128, 0, 0.5) 0%, rgba(0, 128, 0, 1.0) ${progress}%, transparent ${progress}%, transparent 100%)`;
    const combinedBackground = `${gradient}, var(--color-win-ina)`;
    
    // Only apply gradient style if window is minimized
    if (win.min) {
      win.addClass("play");
      win.setBackground(combinedBackground);
    } else {
      win.removeClass("play");
    }
  }

  // Update label text
  setTitle(lbl) {
    this.lbl = lbl;
    this.win.setTitle(lbl);
    return this;
  }

  // Update progress value
  setValue(prg) {
    this.prg = prg;
    if (this.barEl) {
      if (prg === null || prg === undefined) {
        this.barEl.removeAttribute("value");
      } else {
        this.barEl.value = prg;
      }
    }
    this.updateText();
    // Update taskbar background live while minimized
    this.updPrg();
    return this;
  }

  // Update maximum value
  setMax(max) {
    this.max = max;
    if (this.barEl) {
      this.barEl.max = max;
    }
    this.updateText();
    // Update taskbar background live in case percentage shifted
    this.updPrg();
    return this;
  }

  // Programmatically close the progress window (prevents duplicate oncancel calls if window onclose already ran)
  close() {
    if (this.win && typeof this.win.close === "function") {
      // Temporarily nullify callback so close() doesn't re-trigger onclose event
      const cb = this.oncancel;
      this.oncancel = null;
      this.win.close();
      this.oncancel = cb;
    }
  }
}
// Bind it globally for apps
window.progress = prgrs;

  // alert
  window.alert = (msg) => {
  return new Promise((resolve) => {
    const icon = icns.dialogInfo;

    new wm("window.alert", {x: "center",y: "center",
      class: ["no-header", wbtheme, "no-max", "no-resize"],
      icon: icon,
      height: 150,
      width: 230,
      minheight: 150,
      minwidth: 230,
  html: `
    <div style="
      color: var(--color-text-primary);
      background-color: var(--bg-color);
      text-align: left;
      padding: 5px;
      box-sizing: border-box;
      width: 100%;
      min-height: 100%;
    overflow: auto;
    ">
      <img width="70" src="${icns.dialogInfo}">
      ${escapeHtml(msg)}<br>
      <div style="text-align:right; padding:0 15px 15px; flex-shrink:0;">
      <button class='ok' id="okBtn">OK</button>
    </div>
    </div>
  `,
      oncreate: function() {
        // this — це сам wm об’єкт
        sounds.play("info");
        this.body.querySelector("#okBtn").onclick = () => this.close();
        this.body.onkeydown = (e) => { if(e.key === "Enter") this.body.querySelector("#okBtn").click(); };
      },
      onclose: () => resolve()  // завершуємо Promise при закритті
    });
  });
}
window.confirm = async (msg) => {
  return new Promise((resolve) => {
    new wm("window.confirm", {
      x: "center", y: "center",
      class: ["no-header", wbtheme, "no-max", "no-resize"],
      height: 140, // Трохи зменшив висоту для компактності
      width: 320,  // Збільшив ширину для кращого вигляду в ряд
      html: `
          <div style="display:flex; flex-direction:column; min-height:100%; box-sizing:border-box; color:var(--color-text-primary); background-color:var(--bg-color);overflow: auto;">

  <div style="display:flex; padding:0px; margin:15px; align-items:flex-start; gap:15px; flex:1; overflow:auto;">
    <div style="flex-shrink:0;">
      <img width="50" src="${icns.dialogQues}">
    </div>
    <div style="flex:1; font-size:14px; line-height:1.4; overflow-wrap:anywhere;">
      ${escapeHtml(msg)}
    </div>
  </div>

  <div style="text-align:right; padding:0 15px 15px; flex-shrink:0;">
    <button id="cancelBtn" style="margin-right:8px;">${_("cancel")}</button>
    <button id="okBtn" class='ok' style="font-weight:bold;">${_("ok")}</button>
  </div>

</div>
      `,
      oncreate: function () {
       
            sounds.play("question");
        this.body.onkeydown  = (e) => { if(e.key === "Enter") this.body.querySelector("#okBtn").click(); };
        this.body.querySelector("#okBtn").onclick = () => { this.close(); resolve(true); };
        this.body.querySelector("#cancelBtn").onclick = () => { this.close(); resolve(false); };
      }
    });
  });
};
const nativeFetch = window.fetch;

const proxies = [
    "https://corsproxy.io/?key=d2e5217f&url=$url",
    "https://api.allorigins.win/raw?url=$url",


    "https://api.cors.lol/?url=$url",

    "https://cors.x2u.in/$url",

    "https://test.cors.workers.dev/?$url",

    "https://proxy.corsfix.com/?$url",

    "https://cors.isomorphic-git.org/$url",
    "https://cors.eu.org/$url",

    "https://thingproxy.freeboard.io/fetch/$url",

    "https://api.codetabs.com/v1/proxy?quest=$url",
];

window.fetch = async (url, options = {}) => {
    if (PowerManager.isAsleep) {
        throw new DOMException(
            "The operation was aborted because the OS is in sleep mode.",
            "AbortError"
        );
    }

    const signal = options.signal;

    if (signal?.aborted) {
        signal.throwIfAborted?.();

        throw new DOMException(
            "The operation was aborted.",
            "AbortError"
        );
    }

    const requestUrl = url instanceof Request
        ? url.url
        : String(url);

    const mergedOptions = {
        ...options,
        ...(signal ? { signal } : {})
    };

    // Local/non-HTTP URLs should still go directly
    if (!requestUrl.startsWith('http') && fs.find(f=>f.name == requestUrl) && !requestUrl.startsWith('/')){
        const f0 = fs.find(f=>f.name == requestUrl);
if (!f0) return new Response('File not found: ' + requestUrl, {status: 404,statusText: 'Not Found'});
    return new Response(f0, {
    status: 200,
    headers: {
        'Content-Type': f0.type
    }
});
 }
    if (
        requestUrl.startsWith('/') ||
        !requestUrl.startsWith('http')
    ) {
        return nativeFetch(url, mergedOptions);
    }

    // 1. Try direct request FIRST
    try {
        const response = await nativeFetch(url, mergedOptions);

        if (response.ok) {
            return response;
        }
    } catch (error) {
        if (signal?.aborted) {
            throw error;
        }

        console.error(`Direct fetch to ${requestUrl} failed!`);
    }

    // 2. Direct failed → try proxies in order
    for (const proxyTemplate of proxies) {
        if (signal?.aborted) {
            throw new DOMException(
                "The operation was aborted.",
                "AbortError"
            );
        }

        const proxyUrl = proxyTemplate.replace(
            '$url',
            encodeURIComponent(requestUrl)
        );

        try {
            const response = await nativeFetch(
                proxyUrl,
                mergedOptions
            );

            if (response.ok) {
                console.log("C! " + proxyUrl);
                return response;
            }
        } catch (error) {
            if (signal?.aborted) {
                throw error;
            }

            console.error(`${proxyUrl} failed!`);
        }
    }

    // 3. All proxies also failed → last-ditch direct retry
    return await nativeFetch(url, mergedOptions);
};
// 1. Зберігаємо оригінальні функції
      const nativeSetInterval = window.setInterval;
      const nativeClearInterval = window.clearInterval;

      // Карта для збереження активних інтервалів фрейму
      const activeIntervals = new Map();

      // 2. Створюємо обгортку для setInterval
      window.setInterval = (handler, timeout, ...args) => {
          
          // Створюємо перехоплювач, який перевіряє стан ОС перед кожним тиком
          const wrapperHandler = () => {
              if (PowerManager.isAsleep) return; 
              
              
              // Викликаємо оригінальний обробник
              if (typeof handler === 'function') {
                  handler(...args);
              } else {
                  // На випадок, якщо розробник передав рядок (застарілий синтаксис)
                  new Function(handler)();
              }
          };

          // Запускаємо оригінальний інтервал з нашою обгорткою
          const id = nativeSetInterval(wrapperHandler, timeout);
          
          // Запам'ятовуємо його (корисно для моніторингу ресурсів додатка)
          activeIntervals.set(id, true);
          return id;
      };

      // 3. Перевизначаємо clearInterval, щоб не засмічувати пам'ять Map
      window.clearInterval = (id) => {
          activeIntervals.delete(id);
          nativeClearInterval(id);
      };

window.prompt = async (msg, defaultValue = "") => {
  return new Promise((resolve) => {
    new wm("window.prompt", {
      x: "center", y: "center",
      class: ["no-header", wbtheme, "no-max", "no-resize"],
      height: 140,
      width: 350,
      html: `
       <div style="display:flex; gap:5px; padding:15px; min-height:100%; box-sizing:border-box; color:var(--color-text-primary); background-color:var(--bg-color);overflow: auto;">
  <div style="flex-shrink:0;">
    <img width="50" src="${icns.dialogQues}">
  </div>

  <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
    <div style="font-size:14px; margin-bottom:10px; overflow-wrap:anywhere;">
      ${escapeHtml(msg)}
    </div>

    <input
      id="inputPrompt"
      value="${defaultValue}"
      style="width:100%; box-sizing:border-box; padding:5px;">

    <div style="margin-top:20px; text-align:right;">
      <button id="cancelBtn" style="margin-right:10px;">${_("cancel")}</button>
      <button id="okBtn" class='ok' style="font-weight:bold;">${_("ok")}</button>
    </div>
  </div>
</div>
      `,
      oncreate: function () {
        const input = this.body.querySelector("#inputPrompt");
        input.focus(); // Автофокус для зручності

        const length = input.value.length;
input.setSelectionRange(length, length);
        
        this.body.querySelector("#okBtn").onclick = () => { this.close(); resolve(input.value); };
        this.body.querySelector("#cancelBtn").onclick = () => { this.close(); resolve(null); };
        
        // Обробка Enter для швидкого підтвердження
        input.onkeydown = (e) => { if(e.key === "Enter") this.body.querySelector("#okBtn").click(); };
      }
    });
  });
};

const OriginalWorker = window.Worker;
window.Worker = function(scriptURL, options) {
    const worker = new OriginalWorker(scriptURL, options);
    const workerId = 'worker_' + Math.random().toString(36).substr(2, 9);
    const entry = { id: workerId, url: scriptURL, instance: worker };
    window.systemWorkers.push(entry);

    const originalTerminate = worker.terminate;
    worker.terminate = function() {
        window.systemWorkers = window.systemWorkers.filter(w => w.id !== workerId);
        console.warn('[worker] terminating:', workerId);
        originalTerminate.call(this);
    };

    return worker;
};

const OriginalMutationObserver = window.MutationObserver;

window.MutationObserver = class extends OriginalMutationObserver {
    constructor(callback) {
        super(callback);

        const observerId = "observer_" + Math.random().toString(36).slice(2);

        window.systemObservers.push({
            id: observerId,
            instance: this
        });

        console.log("[observer] created:", observerId);

        const originalDisconnect = this.disconnect;

        this.disconnect = function() {
            window.systemObservers = window.systemObservers.filter(
                o => o.id !== observerId
            );

            console.warn("[observer] disconnected:", observerId);

            return originalDisconnect.call(this);
        };
    }
};

}


function redefineNotifications() {
  // Використовуємо String.raw, щоб захистити всі зворотні слеші та спецсимволи (як \n) від викривлення
  const NotificationWrapper = String.raw`
  
  
class OSNotification {
  constructor(title, options = {}) {
    this.title = title;
    this.options = options;
    
    // Internal storage for property-assigned event handlers
    this._onclick = null;
    this._onclose = null;
    this._onshow = null;
    this._onerror = null;
    
    try {
    const existing = permissions[document.title || document.location.href];
    if (!document.location.href.includes("localhost") && !document.location.href.includes("file://")) {
    if (!existing || existing.notification !== true) {
        return console.log("Not permitted to send notifications: " + (document.title || document.location.href));
    }
}
    const box = document.createElement("div");
    box.className = "notification";

    const titleEl = document.createElement("strong");
    titleEl.textContent = title;

    const bodyEl = document.createElement("div");
    bodyEl.textContent = options.body || "";

    if (options.icon) {
      const ic = document.createElement("img");
      ic.style.width = "32px";
      ic.style.marginRight = "10px"; 
      ic.src = options.icon;
      box.appendChild(ic);
    }
    
    box.appendChild(titleEl);
    box.appendChild(bodyEl);

    let doc;
    try {
      doc = parent?.document || document;
    } catch {
      doc = document;
    }
    let notificationContainer = doc.getElementById("notification-container");

if (!notificationContainer) {
  notificationContainer = document.createElement("div");
  notificationContainer.id = "notification-container";
  doc.body.appendChild(notificationContainer);
}

notificationContainer.appendChild(box);


      // Trigger show event (supports options.onshow or dynamic a.onshow)
      if (options.onshow) options.onshow();
      if (typeof this._onshow === "function") this._onshow();

      // Dispatch click event (checks options FIRST, then falls back to property setter)
      box.addEventListener("click", (e) => {
        this.close(); 
        if (typeof options.onclick === "function") {
          options.onclick.call(this, e);
        } else if (typeof this._onclick === "function") {
          this._onclick.call(this, e);
        }
      });

   const pm = typeof PowerManager !== "undefined"
    ? PowerManager
    : parent?.PowerManager;

if (!options.silent && !pm?.isAsleep) {



    if (window.sounds) {
        

        sounds.play(options.sound ?? "notify");
    } else if (parent?.window?.sounds) {
        
        
        

        parent.window.sounds.play(options.sound ?? "notify");
    } else {
        console.error("NO SOUND OBJECT");
    }
}


    let closed = false;
      this.close = () => {
        if (closed) return;
        closed = true;
        box.remove();
        if (typeof options.onclose === "function") options.onclose();
        if (typeof this._onclose === "function") this._onclose();
      };
      
if (!options.requireInteraction) setTimeout(() => {this.close()}, 2500)
    
    } catch (e) {
        if (typeof options.onerror === "function") options.onerror();
      if (typeof this._onerror === "function") this._onerror();
    }
  }
 
  // Setters & Getters for standard Web API event properties
  get onclick() { return this._onclick; }
  set onclick(handler) { this._onclick = handler; }

  get onclose() { return this._onclose; }
  set onclose(handler) { this._onclose = handler; }

  get onshow() { return this._onshow; }
  set onshow(handler) { this._onshow = handler; }

  get onerror() { return this._onerror; }
  set onerror(handler) { this._onerror = handler; }


static async requestPermission() {
    const existing = permissions[document.title || document.location.href];
    let allow;
    if (!existing || !existing.notification) {
      allow = await parent.confirm(parent._('application_needs_permission')+ "Notifications");
      parent.setPerm((document.title || document.location.href), 'notification', allow);
    } else {
      allow = existing.notification;
    }
  return Promise.resolve(allow ? "granted" : "denied");
}

static get permission() {
const permission = permissions?.[document.title || document.location.href]?.notification;

if (permission === true) {
    return 'granted';
}

if (permission !== false) {
    return 'default';
}

return 'denied';

}
}
window.Notification = OSNotification;
`;
  
  // Перевіряємо, чи такий скрипт вже інжектили, щоб не засмічувати DOM
  let sc = document.getElementById("notifications-core");
  if (!sc) {
    sc = document.createElement("script");
    sc.id = "notifications-core";
    document.head.appendChild(sc);
  }
  sc.textContent = NotificationWrapper;
  
  return NotificationWrapper;
}


const popoverControllers = new Map();

const popoverObserver = new MutationObserver(() => {
    for (const [triggerElement, data] of popoverControllers) {
        // Element was removed from the document
        if (!triggerElement.isConnected) {
            data.controller.abort();
            popoverControllers.delete(triggerElement);

            // Remove associated popover
            const popover = document.getElementById(data.popoverId);

            if (popover) {
                try {
                    popover.hidePopover();
                } catch {}

                popover.remove();
                console.log("[Popover REM] " + data.popoverId);
            }

            console.log("[Popover LISTENERS REM]", triggerElement);
        }
    }
});

popoverObserver.observe(document.body, {
    childList: true,
    subtree: true
});


const elementIds = new WeakMap();
let nextElementId = 1;

function getUniqueElementId(element) {
    if (!elementIds.has(element)) {
        elementIds.set(element, nextElementId++);
    }

    return elementIds.get(element);
}


function updateSystemPopover(
    triggerElement,
    text = '',
    r = true,
    c = false,
    k = true
) {
    if (!triggerElement) return;

    // Preserve original title
    if (triggerElement.hasAttribute('title')) {
        triggerElement.dataset.originalTitle = triggerElement.title;
    }

    text = text === ''
        ? (triggerElement.dataset.originalTitle || '')
        : text;

    if (r) {
        triggerElement.removeAttribute('title');
    }

    if (detectMobile() && c) return;


    // --------------------------------------------------
    // Check for an existing controller
    // --------------------------------------------------

    let data = popoverControllers.get(triggerElement);

    if (data) {
        // Already has a live controller.
        // Just update the popover instead of creating
        // another controller.
        if (!data.controller.signal.aborted) {
            const popover = document.getElementById(data.popoverId);

            if (popover) {
                popover.textContent = text;
                data.popover = popover;
            }

            return;
        }

        // Old controller was already aborted
        popoverControllers.delete(triggerElement);
        data = null;
    }


    // --------------------------------------------------
    // Create/retrieve popover
    // --------------------------------------------------

    const elementId = getUniqueElementId(triggerElement);

    const popoverId =
        `popover-${elementId}${c ? '-application' : '-system'}`;

    let popover = document.getElementById(popoverId);

    if (popover && c) {
        try {
            popover.hidePopover();
        } catch {}

        popover.remove();
        popover = null;
    }

    if (!popover) {
        popover = document.createElement('div');

        popover.id = popoverId;
        popover.setAttribute('popover', 'auto');
        popover.className = 'popover';

        popover.style.position = 'fixed';
        popover.style.margin = '0';
        popover.style.pointerEvents = 'none';

        document.body.appendChild(popover);

        
    }

    popover.textContent = text;

    triggerElement.setAttribute(
        'popovertarget',
        popoverId
    );


    // --------------------------------------------------
    // Create ONE controller for this element
    // --------------------------------------------------

    const controller = new AbortController();

    popoverControllers.set(triggerElement, {
        controller,
        popoverId,
        popover
    });



    const { signal } = controller;

    const dpr =
        parseFloat(window.devicePixelRatio.toFixed(1)) || 1;


    // --------------------------------------------------
    // Pointer move
    // --------------------------------------------------

    triggerElement.addEventListener(
        'pointermove',
        (e) => {
            try {
                popover.style.left =
                    Math.round(e.screenX / dpr) + 'px';

                popover.style.top =
                    Math.round(e.screenY / dpr) + 'px';

                popover.showPopover();
            } catch (err) {
                console.error(err);
            }
        },
        { signal }
    );


    // --------------------------------------------------
    // Pointer leave
    // --------------------------------------------------

    triggerElement.addEventListener(
        'pointerleave',
        () => {
            try {
                popover.hidePopover();
            } catch {}
        },
        { signal }
    );
}