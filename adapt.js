function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function redefineAdaptations() {
   if (detectMobile()) window.devicePixelRatio = 1.0;
    
window.open = async function(url, targetName, windowFeatures = '') {

    // 1. Дефолтні налаштування вікна Infinity OS
    const parsedFeatures = {
        width: 600,
        height: 400,
        x: "center",
        y: "center",
        modal: false,   
        resizable: true
    };

    // 2. Гнучкий парсинг рядка windowFeatures
    if (windowFeatures && typeof windowFeatures === 'string') {
        windowFeatures.split(',').forEach(feature => {
            const pair = feature.trim();
            if (!pair) return;

            let [key, val] = pair.split('=');
            key = key.trim().toLowerCase();
            val = val ? val.trim().toLowerCase() : 'yes';

            if (key === 'width' || key === 'innerwidth') {
                parsedFeatures.width = parseInt(val, 10) || parsedFeatures.width;
            } else if (key === 'height' || key === 'innerheight') {
                parsedFeatures.height = parseInt(val, 10) || parsedFeatures.height;
            } else if (key === 'left' || key === 'screenx') {
                parsedFeatures.x = val === 'center' ? 'center' : (parseInt(val, 10) ?? parsedFeatures.x);
            } else if (key === 'top' || key === 'screeny') {
                parsedFeatures.y = val === 'center' ? 'center' : (parseInt(val, 10) ?? parsedFeatures.y);
            } else if (key === 'modal' || key === 'popup') {
                parsedFeatures.modal = (val === 'yes' || val === '1' || val === 'true');
            }else if (key === 'resizable') {
                parsedFeatures.resizable = (val === 'yes' || val === '1' || val === 'true');
            }
        });
    }

    try {
        // FIX: Use 'this' instead of 'anchor'
        const clickedUrl = new URL(url);
        
        // This will definitely show up now!
        

        const assoc = getUrlAssoc();
        if (assoc.hasOwnProperty(clickedUrl.origin)) {
            console.log("URL ASSOC FOUND!")
            const appPath = assoc[clickedUrl.origin];
            const targetUrl = appPath + "?url=" + encodeURIComponent(url);
    
    // Launch your Infinity OS application with the full payload
    parent.Openf("text/html", targetUrl, false);
            
            
            return; // Return early without calling originalAnchorClick
        }
    } catch (e) {
        console.error("URL parsing failed inside prototype.click:", e);
    }


    let content = '';
    try {
        // FIXED: Added await here so fetch actually works
        const response = await fetch(url);
        if (response.ok) {
            // FIXED: Added await and called text as a method
            content = await response.text();
        }
const windowClasses = [ wbtheme, 'text'];
    
    if (!parsedFeatures.resizable) {
        windowClasses.push('no-resize');
    }

    // 2. Ініціалізація Window Manager з динамічними класами
    const fileWinBox = new wm(url, {
        icon: typeof ic !== 'undefined' ? ic : '', 
        x: parsedFeatures.x,
        y: parsedFeatures.y,
        class: windowClasses,
            minheight: 200, 
            minwidth: 255, 
            width: parsedFeatures.width, 
            height: parsedFeatures.height,
            html: `<div class='loading' style="padding: 10px; color: black; height: 100%; text-align: center;overflow: hidden;">${_('loading_text')}</div>`
        });

        const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch) fileWinBox.setTitle(titleMatch[1].trim());
                    
        const iconMatch = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
        if (iconMatch) fileWinBox.setIcon(iconMatch[1]);
        else fileWinBox.setIcon('');

        const name = (titleMatch) ? titleMatch[1].trim() : (url.split('/').pop() || 'App');
        
        // FIXED: Cleared up the malformed ternary notation syntax error
        const safeTarget = url.includes('?') ? '?' + url.split('?').pop() : '';

        // Added window.open intercept parsing hook compatibility
        let [modifiedContent, redefiner, redefiner1] = await makeApp(content, name, safeTarget, url, fileWinBox);

        let newContent = `
            <div style="height: 100%; width: 100%;">
                <iframe 
                    id="fileWinBox-frame-${fileWinBox.id}"
                    srcdoc="${redefiner.replace(/"/g, '&quot;')} ${modifiedContent.replace(/"/g, '&quot;')} ${redefiner1.replace(/"/g, '&quot;')}" 
                    style="width: 100%; height: 100%; border: none;"
                    sandbox="allow-scripts allow-forms allow-same-origin allow-downloads allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-storage-access-by-user-activation"
                    onload="parent.applySystemConfig('${fileWinBox.id}')">
                </iframe>
            </div>
        `;
        fileWinBox.body.innerHTML = newContent;

        return fileWinBox; // Return instance like window.open standard

    } catch (e) {
        console.error(e.message);
    }
};


window.showOpenFilePicker = (opts = {}) => {
    if (icons) {
        const physicalIcon = icons.find(icon => icon.name == 'files');
        console.log(icons)
        if (physicalIcon && physicalIcon.onclick) {         
            
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
                const customClick = new CustomEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    detail: { extraData: { ...safeOpts, runAs: 'file' } }
                });
                
                physicalIcon.element.dispatchEvent(customClick);
            });
        }
    }
};

window.showDirectoryPicker = async (opts = {}) => {
    // Ми вже в ядрі, тому шукаємо іконку прямо у поточному контексті
    if (typeof icons !== 'undefined') {
        const physicalIcon = Array.from(icons).find(icon => icon.name === 'files');
        
        if (physicalIcon && physicalIcon.onclick && apps.some(app => app.name === physicalIcon.name)) {         
            
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

                const customClick = new CustomEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    detail: { extraData: { ...safeOpts, runAs: 'dir' } }
                });
                
                physicalIcon.element.dispatchEvent(customClick);
            });
        }
    }
};



  // Краще використовувати window.onerror для повного перехоплення системних помилок
window.onerror = (message, source, lineno, colno, error) => {
    // 1. Спершу виводимо в консоль для дебагу (щоб бачити помилку, якщо WinBox впаде)
  
    // Формуємо HTML
    const htm = (lineno == null) 
        ? `<div><img width="70" src="${icns.dialogErr}"><br>${message}</div>` 
        : `<div><img width="70" src="${icns.dialogErr}"><br>${message}<br><small>${source}<br>${lineno}:${colno}</small></div>`;

    // 2. Створюємо вікно WinBox (переконуємося, що всі дужки закриті)
    try {
        new wm(_("js_error"), {
            x: "center", y: "center",
            class: [ wbtheme , "no-max"],
            icon: icns.dialogErr,
            height: 200,
            width: 230,
            minheight: 200,
            minwidth: 230,
            html: htm
        });

        if (sounds && typeof sounds.play === "function") {
            sounds.play("error");
        }
    } catch (e) {
        alert("Critical System Error: " + message); // Fallback, якщо UI ядро не працює
    }

    return true; // Запобігає виводу стандартної помилки в консоль браузера
};

window.print = function() {
    return new Promise((resolve) => {
        const targetDoc = this.document || document;
        // Отримуємо текст або HTML. Якщо принтер старий, краще передавати text/plain.
        // Сучасні IPP Everywhere принтери вміють рендерити PDF/JPEG напряму.
        const content = targetDoc.body.innerText; 
        
        const pri = new wm(_("print_btn"), {
            x: "center",
            y: "center",
            class: [wbtheme, "no-max", "no-resize"],
            height: 180, 
            width: 340, 
            html: `
                <div style="padding: 12px; text-align: center;">
                    <p style="margin: 0 0 10px 0;" data-i18n="enter_printer_ip">Enter Printer IP:</p>
                    <input type="text" id="ipp-printer-ip" placeholder="192.168.1.100" style="width: 80%; padding: 4px; margin-bottom: 12px; text-align: center;">
                    <br>
                    <button id="infinity-print-execute" data-i18n="print_btn" style="padding: 6px 20px; font-weight: bold;"></button>
                </div>
            `, 
            oncreate: function() {
                // Локалізація
                document.querySelectorAll('[data-i18n]').forEach(element => {
                    element.textContent = _(element.getAttribute('data-i18n'));
                });

                // Підтягуємо IP за замовчуванням, якщо він десь збережений в системі
                const ipInput = document.getElementById('ipp-printer-ip');


                document.getElementById('infinity-print-execute').onclick = async () => {
                    const printerIP = ipInput.value.trim();
                    if (!printerIP) return alert("Please enter a valid IP");

                    this.disabled = true;

                    try {
                        // Формуємо мінімальний бінарний IPP пакет (Операція: Print-Job, 0x0002)
                        // Для реального друку складних документів зазвичай використовують готові JS-байндінги,
                        // але для простого тексту можна зібрати заголовок вручную.
                        const ippRequest = createMinimalIppPacket(content);

                        // Надсилаємо IPP запит напряму на принтер (стандартний порт IPP - 631)
                        // Зауваження щодо CORS: принтер має дозволяти запити, або додаток Infinity OS 
                        // повинен працювати в контексті, який ігнорує CORS (наприклад, як розширення чи WebView).
                        await fetch(`http://${printerIP}/ipp/print`, {
                            method: 'POST',
                            headers: {
      // Головний заголовок для IPP. Браузер повинен розуміти, що ми шлемо бінарний потік IPP
    'Content-Type': 'application/ipp',
    
    // Деякі принтери вимагають чіткого зазначення типу прийнятої відповіді
    'Accept': 'application/ipp',
    
    // Необов'язково, але корисно для старих пристроїв (вказує host і port)
    'Host': `${printerIP}`
                            },
                            body: ippRequest
                        });



                    } catch (err) {
                        console.error("Direct IPP communication failed:", err); 
                    } finally {
                        pri.close(); 
                    }
                };
            },
            onclose: function() {
                resolve();
            }
        });
    });
};

/**
 * Функція створення мінімального бінарного пакету IPP (RFC 8010)
 * Спрощена версія для відправки тексту
 */
function createMinimalIppPacket(textData) {
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(textData);
    
    // Заголовок IPP (8 байт):
    // 0-1: Версія (2.0) -> 0x02, 0x00
    // 2-3: Operation-ID (Print-Job) -> 0x00, 0x02
    // 4-7: Request-ID -> 0x00, 0x00, 0x00, 0x01
    const header = new Uint8Array([0x02, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01]);
    
    // Теги груп атрибутів: 
    // 0x01 -> operation-attributes-tag
    const opTag = new Uint8Array([0x01]);
    
    // Обов'язкові атрибути: attributes-charset (utf-8) та attributes-natural-language (en)
    // Для повноцінного друку тут зазвичай збирається довгий ланцюжок байт.
    // Маркер кінця атрибутів: 0x03 (end-of-attributes-tag)
    const endTag = new Uint8Array([0x03]);
    
    // Збираємо все в один буфер разом із сирими даними документа
    const blob = new Blob([header, opTag, endTag, textBytes]);
    return blob;
}


  // alert
  window.alert = (msg) => {
  return new Promise((resolve) => {
    const icon = icns.dialogInfo;

    new wm("window.alert", {x: "center",y: "center",
      class: ["no-header", wbtheme, "no-max", "no-resize"],
      icon: icon,
      height: 200,
      width: 230,
      minheight: 100,
      minwidth: 230,
      html: `
        <div style="text-align:left; padding:10px;">
<img width="70" src="${icns.dialogInfo}">
          ${escapeHtml(msg)}<br>
          <button id="okBtn">OK</button>
        </div>
      `,
      oncreate: function() {
        // this — це сам wm об’єкт
        this.body.querySelector("#okBtn").onclick = () => this.close();
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
      height: 150, // Трохи зменшив висоту для компактності
      width: 320,  // Збільшив ширину для кращого вигляду в ряд
      html: `
        <div style="display: flex; padding: 15px; align-items: center; gap: 15px;">
          <div style="flex-shrink: 0;">
            <img width="50" src="${icns.dialogQues}">
          </div>
          <div style="flex-grow: 1; font-size: 14px; color: black; line-height: 1.4;">
            ${escapeHtml(msg)}
          </div>
        </div>
        <div style="text-align: right; padding: 0 15px 15px;">
          <button id="cancelBtn" style="margin-right: 8px;">${_("cancel")}</button>
          <button id="okBtn" style="font-weight: bold;">${_("ok")}</button>
        </div>
      `,
      oncreate: function () {
       if ( sounds.play === "function") {
            sounds.play("question");
        }
        this.body.querySelector("#okBtn").onclick = () => { this.close(); resolve(true); };
        this.body.querySelector("#cancelBtn").onclick = () => { this.close(); resolve(false); };
      }
    });
  });
};

const nativeFetch = fetch;

const proxies = [
    "https://proxy.cors.sh/$url",
    "https://corsproxy.io/?$url",
    "https://api.allorigins.win/raw?url=$url",
];

 fetch = async (url, options = {}) => {
    // 1. If system is asleep, block the request immediately
    if (PowerManager.isAsleep) {
        throw new DOMException("The operation was aborted because the OS is in sleep mode.", "AbortError");
    }

    const fetchController = new AbortController();
    const { signal } = fetchController;

    // 2. Safely merge the signals if the app provided one
    if (options.signal) {
        options.signal.addEventListener('abort', () => fetchController.abort());
        if (options.signal.aborted) fetchController.abort();
    }

    // 3. Construct clean configuration while preserving developer inputs
    const mergedOptions = { ...options, signal };

    // 4. Attempt the direct request first
    try {
        const response = await nativeFetch(url, mergedOptions);
        if (response.ok) return response;
        
        // If it returns a bad status (like 404/500), we still pass it through 
        // unless you want proxies to handle non-2xx statuses too.

    } catch (directError) {
        // If the user aborted the request, don't waste time with proxies
        if (signal?.aborted) throw directError;
        


        // 5. Fallback loop through designated proxies
        for (const proxyTemplate of proxies) {
            // Safely encode the target URL to keep the proxy string valid
            const proxyUrl = proxyTemplate.replace('$url', encodeURIComponent(url));
            
            try {
                const proxyResponse = await nativeFetch(proxyUrl, mergedOptions);
                if (proxyResponse.ok) {
                    return proxyResponse;
                }
            } catch (proxyError) {
                if (signal?.aborted) throw proxyError;
            }
        }

        // 6. If everything fails, bubble up the original direct execution error
        throw directError;
    }
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
      height: 160,
      width: 350,
      html: `
        <div style="display: flex; padding: 15px; gap: 15px;">
          <div style="flex-shrink: 0;">
            <img width="50" src="${icns.dialogQues}">
          </div>
          <div style="flex-grow: 1;">
            <div style="font-size: 14px; margin-bottom: 10px;">${escapeHtml(msg)}</div>
            <input id="inputPrompt" value="${defaultValue}" 
                   style="width: 100%; box-sizing: border-box; padding: 5px;">
            
            <div style="margin-top: 20px; text-align: right;">
              <button id="cancelBtn" style="margin-right: 10px;">${_("cancel")}</button>
              <button id="okBtn" style="font-weight: bold;">${_("ok")}</button>
            </div>
          </div>
        </div>
      `,
      oncreate: function () {
        const input = this.body.querySelector("#inputPrompt");
        input.focus(); // Автофокус для зручності
        
        this.body.querySelector("#okBtn").onclick = () => { this.close(); resolve(input.value); };
        this.body.querySelector("#cancelBtn").onclick = () => { this.close(); resolve(null); };
        
        // Обробка Enter для швидкого підтвердження
        input.onkeypress = (e) => { if(e.key === "Enter") this.body.querySelector("#okBtn").click(); };
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

    worker.addEventListener('error', (e) => {
        console.warn('[worker] uncaught error, terminating:', workerId, e.message);
        worker.terminate(); // uses the wrapped version above, so it cleans up systemWorkers too
    });

    return worker;
};


}



function redefineNotifications() {
  // Використовуємо String.raw, щоб захистити всі зворотні слеші та спецсимволи (як \n) від викривлення
  const NotificationWrapper = String.raw`
  
  
class OSNotification {
  constructor(title, options = {}) {
    this.title = title;
    this.options = options;
    
    const existing = permissions[document.title || document.location.href];
    if (!document.location.href.includes("localhost")) {
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
    doc.body.appendChild(box);
    
    if (options.onshow) {
      options.onshow();
    }

    box.addEventListener("click", () => {
      this.close(); 
      if (options.onclick) options.onclick();
    });

    if (!options.silent && !PowerManager.isAsleep) {
      if (window.sounds) {
        window.sounds.play(options.sound || "notify");
      } else if (parent?.window?.sounds) {
        parent.window.sounds.play(options.sound || "notify");
      }
    }

    let closed = false;
    this.close = () => {
      if (closed) return;
      closed = true;
      box.remove();
      if (options.onclose) options.onclose();
    };

    setTimeout(() => {
      this.close();
    }, 2500);
  }

static async requestPermission() {
    const existing = permissions[document.title || document.location.href];
    let allow;
    if (!existing || !existing.notification) {
      allow = await parent.confirm(parent._('application_needs_permission')+ "Notifications");
      parent.setPerm((document.title || document.location.href), 'notification', allow);
    } else {
      allow = existing.notification;
    }
  return Promise.resolve(allow ? "granted" : "denied"); window.location.reload();
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
  
  sc.innerText = NotificationWrapper;
  
  return NotificationWrapper;
}
const popoverControllers = new WeakMap();
function updateSystemPopover(triggerElement, text='', r=true, c=false) {
    if (!triggerElement) return;

    // c - custom app; r - remove '.title'
    text = (text == '') ? triggerElement.title : text;
    if (r) triggerElement.removeAttribute('title');
    
    if (detectMobile() && c) return
    
    /// --- Clean up any previous listeners for this exact trigger ---
    const prevController = popoverControllers.get(triggerElement);
    if (prevController && c) {
        prevController.abort(); // removes both pointermove & pointerleave listeners at once
        console.log("[Popover Listeners REM] for", triggerElement);
    }
    const controller = new AbortController();
    popoverControllers.set(triggerElement, controller);
    const { signal } = controller;

    // Normalize XPath output to make it a safe DOM ID string
    let safeXPathId = getElementXPath(triggerElement).replace(/[^a-zA-Z0-9_-]/g, '_');
    let popoverId = safeXPathId + (c ? '-application-popover' : "-system-popover");
    let popover = document.getElementById(popoverId);
    if (popover && c) {
        popover.remove();
        console.log("[Popover REM] " + popoverId);
    }
    if (!popover){
    popover = document.createElement('div');
    popover.id = popoverId;
    console.log("[Popover REG] " + popoverId);
    popover.setAttribute('popover', 'auto');
    popover.className = "popover";
    popover.style.position = 'fixed';
    popover.style.margin = '0';
    popover.style.pointerEvents = 'none';

    document.body.appendChild(popover);
    triggerElement.setAttribute('popovertarget', popoverId);

    // Recalculate and show on hover — pass { signal } so abort() removes this automatically
    triggerElement.addEventListener('pointermove', (e) => {
        try {
            popover.style.left = Math.round(parseInt(e.screenX) / parseFloat(window.devicePixelRatio.toFixed(1))) + "px";
            popover.style.top = Math.round(parseInt(e.screenY) / parseFloat(window.devicePixelRatio.toFixed(1))) + "px";
            popover.showPopover();
        } catch (err) { console.error(err); }
    }, { signal });

    triggerElement.addEventListener('pointerleave', () => {
        try { popover.hidePopover(); } catch (err) {}
    }, { signal });
}
    popover.textContent = text;
}