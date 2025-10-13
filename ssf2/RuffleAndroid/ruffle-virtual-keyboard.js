// ==UserScript==
// @name         Ruffle Virtual Keyboard For Mobile
// @namespace    http://tampermonkey.net/
// @version      2025-07-23
// @description  Displays an onscreen gamepad with arrow keys and spacebar so you can play Ruffle games on mobile
// @author       https://github.com/ed253/ruffle-virtual-keyboard/
// @match        https://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ruffle.rs
// @grant        none
// ==/UserScript==
// Modified by GdGohan, thanks ChatGPT

(function() {
    'use strict';

    const STORAGE_KEY = "virtualKeyboardLayout_v3";

    // ==== LISTA DE TECLAS DISPONÍVEIS ====
    const KEY_LIST = [
        {name:"ArrowUp", code:"ArrowUp", num:38},
        {name:"ArrowDown", code:"ArrowDown", num:40},
        {name:"ArrowLeft", code:"ArrowLeft", num:37},
        {name:"ArrowRight", code:"ArrowRight", num:39},
        {name:" ", code:"Space", num:32},
        {name:"Enter", code:"Enter", num:13},
        {name:"Escape", code:"Escape", num:27},
        {name:"Backspace", code:"Backspace", num:8},
        {name:"Tab", code:"Tab", num:9},
        {name:"Shift", code:"Shift", num:16},
        {name:"Control", code:"Control", num:17},
        {name:"Alt", code:"Alt", num:18},
        ...Array.from({length:26},(_,i)=>({name:String.fromCharCode(65+i), code:"Key"+String.fromCharCode(65+i), num:65+i})),
        ...Array.from({length:10},(_,i)=>({name:String(i), code:"Digit"+i, num:48+i}))
    ];

    // ==== FUNÇÃO DE DISPARO DE TECLA ====
    function pressKey(kEvent, kName, kCode, kNumber) {
    if(document.querySelector("ruffle-player") != null) {  
        var ruffleSelector = "ruffle-player";  
    } else if(document.querySelector("ruffle-embed") != null) {  
        var ruffleSelector = "ruffle-embed";  
    } else if(document.querySelector("#player") != null) {  
        var ruffleSelector = "#player";  
    } else {  
        return false;  
    }  
    document.querySelector(ruffleSelector).focus();
    let keyValue = kName;
    if (kNumber === 32) keyValue = " ";
    document.querySelector(ruffleSelector).dispatchEvent(new KeyboardEvent(kEvent, {
        key: keyValue,
        code: kCode,
        keyCode: kNumber,
        which: kNumber,
        bubbles: true
    }));
    return false;
}

    function init() {
        if (document.getElementById("virtualKbContainer")) return;

        const container = document.createElement("div");
        container.id = "virtualKbContainer";
        container.innerHTML = `
        <style>
        #editToggle, #addButton, #exportButton {
            position: fixed; top: 10px; z-index:10000;
            background: #222; color:#fff; border:2px solid #aaa; border-radius:8px;
            padding:6px 8px; font-size:14px; cursor:pointer; opacity:0.85;
        }
        #editToggle.active { background:#b07b11; opacity:1; }
        #editToggle { left:10px; }
        #addButton { left:60px; display:none; }
        #exportButton { left:110px; display:none; }
        #virtualKb { position: fixed; left:0; bottom:0; width:100%; height:260px; z-index:9999; pointer-events:none; }
        .vkButton {
            position: absolute; background: transparent; border: none; color: #eee;
            border-radius:8px; font-weight:600; display:flex; align-items:center;
            justify-content:center; touch-action:none; pointer-events:all; user-select:none;
        }
        .vkButton.editing { border: 2px dashed yellow; border-color: yellow; background: rgba(255,255,0,0.06); }
        .resize-handle {
            position:absolute; width:14px; height:14px; right:-8px; bottom:-8px;
            background: rgba(255,255,255,0.9); border-radius:3px; cursor: nwse-resize;
            display:none;
        }
        .vkButton.editing .resize-handle { display:block; }
        #layoutField {
            position:absolute; width:200px; height:100px; background:#111; color:#fff;
            border:2px solid #aaa; resize:none; z-index:10001; display:none; padding:4px;
        }
        </style>
        <button id="editToggle" title="Alternar modo edição">✎</button>
        <button id="addButton" title="Adicionar botão">+</button>
        <button id="exportButton" title="Exportar layout">⇩</button>
        <textarea id="layoutField"></textarea>
        <div id="virtualKb"></div>
        `;
        document.body.appendChild(container);

        const vk = document.getElementById("virtualKb");
        const toggle = document.getElementById("editToggle");
        const addBtn = document.getElementById("addButton");
        const exportBtn = document.getElementById("exportButton");
        const layoutField = document.getElementById("layoutField");

        let editMode = false;
        let layout = loadLayout();

        // render inicial
        layout.forEach(conf => {
            if (conf.type === "dpad") createDpad(conf);
            else createButtonFromConf(conf);
        });

        // toggle edição
        toggle.addEventListener("click", () => {
            editMode = !editMode;
            toggle.classList.toggle("active", editMode);
            addBtn.style.display = editMode ? "block" : "none";
            exportBtn.style.display = editMode ? "block" : "none";
        
            // Fecha a caixa de exportar se entrar em modo edição
            if(editMode) {
                layoutField.style.display = "none";
                document.querySelectorAll("#layoutField + button").forEach(b => b.remove());
            }
        
            document.querySelectorAll(".vkButton").forEach(b => {
                b.classList.toggle("editing", editMode);
        
                // mostra o botão de remover apenas
                const remove = b.querySelector(".remove-btn");
                if(remove) remove.style.display = editMode ? "flex" : "none";
            });
        });

        // criar botão novo centralizado
        addBtn.addEventListener("click", () => {
            const overlay = document.createElement("div");
            Object.assign(overlay.style, {
                position: "fixed", top: "0", left: "0", width: "100%", height: "100%",
                background: "rgba(0,0,0,0.6)", zIndex: "10001", display: "flex",
                alignItems: "center", justifyContent: "center"
            });
        
            const box = document.createElement("div");
            Object.assign(box.style, {
                background: "#222", color: "#fff", padding: "12px 16px",
                borderRadius: "8px", fontSize: "14px", textAlign: "center"
            });
        
            box.innerHTML = `
                <p style="margin-bottom:8px">Add new button:</p>
                <button data-type="0">Regular</button>
                <button data-type="1">Pause Texture</button>
                <button data-type="2">D-pad</button>
            `;
            box.querySelectorAll("button").forEach(b => {
                b.style.margin = "0 6px";
                b.style.padding = "4px 8px";
                b.style.cursor = "pointer";
                b.addEventListener("click", () => {
                    overlay.remove();
                    const tipo = b.dataset.type;
                    createNewButton(tipo);
                });
            });
        
            overlay.appendChild(box);
            document.body.appendChild(overlay);
        });
        
        function createNewButton(tipo) {
            const id = "btn" + Date.now();
            const centerX = window.innerWidth/2 - 30;
            const centerY = window.innerHeight/2 - 30;
        
            if (tipo === "2") {
                const conf = {
                    id,
                    x: centerX,
                    y: centerY,
                    w: 80,
                    h: 80,
                    type: "dpad",
                    img: "RuffleAndroid/RuffleVKTextures/dpad_default.png",
                    imgUp: "RuffleAndroid/RuffleVKTextures/dpad_up.png",
                    imgDown: "RuffleAndroid/RuffleVKTextures/dpad_down.png",
                    imgLeft: "RuffleAndroid/RuffleVKTextures/dpad_left.png",
                    imgRight: "RuffleAndroid/RuffleVKTextures/dpad_right.png",
                    keys: {
                        ArrowUp: "ArrowUp",
                        ArrowDown: "ArrowDown",
                        ArrowLeft: "ArrowLeft",
                        ArrowRight: "ArrowRight"
                    }
                };
                layout.push(conf);
                createDpad(conf);
            } else {
                let texture = "button";
                let pressedChange = 2;
                if (tipo === "1") {
                    texture = "pause";
                    pressedChange = 1;
                }
                const conf = { id,
                    keyName: "Space",
                    keyCode: "Space",
                    keyNumber: 32,
                    x:centerX,
                    y:centerY,
                    w:60,
                    h:60,
                    img:`RuffleAndroid/RuffleVKTextures/${texture}_default.png`,
                    img2:`RuffleAndroid/RuffleVKTextures/${texture}_pressed.png`,
                    option: pressedChange
                };
                layout.push(conf);
                createButtonFromConf(conf);
            }
            saveLayout();
        }

        // === EXPORTAR ===
        exportBtn.addEventListener("click", () => {
            // monta string manualmente
            let output = "[\n";
            layout.forEach((b, i) => {
                output += `  {
            id:"${b.id}",
            type:"${b.type || ""}",
            img:"${b.img || ""}",
            img2:"${b.img2 || ""}",
            imgUp:"${b.imgUp || ""}",
            imgDown:"${b.imgDown || ""}",
            imgLeft:"${b.imgLeft || ""}",
            imgRight:"${b.imgRight || ""}",
            option:${b.option || ""},
            keys:${b.keys ? JSON.stringify(b.keys) : "{}"},
            keyName:"${b.keyName || ""}",
            keyCode:"${b.keyCode || ""}",
            keyNumber:${b.keyNumber || 0},
            x:${b.x}, y:${b.y}, w:${b.w}, h:${b.h}
          }`;
                if (i < layout.length - 1) output += ",";
                output += "\n";
            });
            output += "]";
        
            layoutField.value = output;
            layoutField.style.display = "block";
            layoutField.style.left = "10px";
            layoutField.style.top = "10px";
            layoutField.style.width = "300px";
            layoutField.style.height = "150px";
            layoutField.style.position = "fixed";
            layoutField.style.resize = "none";
        
            // botões Fechar e Copiar
            let closeBtn = document.createElement("button");
            closeBtn.textContent = "Close";
            closeBtn.style.position = "fixed";
            closeBtn.style.left = "320px";
            closeBtn.style.top = "10px";
            closeBtn.style.zIndex = 10002;
            closeBtn.onclick = () => {
                layoutField.style.display = "none";
                closeBtn.remove();
                copyBtn.remove();
            };
            document.body.appendChild(closeBtn);
        
            let copyBtn = document.createElement("button");
            copyBtn.textContent = "Copy";
            copyBtn.style.position = "fixed";
            copyBtn.style.left = "400px";
            copyBtn.style.top = "10px";
            copyBtn.style.zIndex = 10002;
            copyBtn.onclick = () => {
            layoutField.select();
            document.execCommand("copy");
        };
        document.body.appendChild(copyBtn);
    });
        
            // ==== Funções auxiliares ====
            function createButtonFromConf(conf) {
            if (document.getElementById(conf.id)) return;
            if (conf.type === "dpad") {
                createDpad(conf);
                return;
            }
            const vk = document.getElementById("virtualKb");
            const btn = document.createElement("button");
            btn.className = "vkButton";
            btn.id = conf.id;
        
            setStyleFromConf(btn, conf);
        
            const rh = document.createElement("div");
            rh.className = "resize-handle";
            btn.appendChild(rh);
        
            const removeBtn = document.createElement("div");
            removeBtn.className = "remove-btn";
            removeBtn.textContent = "×";
            Object.assign(removeBtn.style, {
                position:"absolute", top:"-8px", right:"-8px",
                width:"18px", height:"18px", background:"#b11",
                color:"#fff", borderRadius:"50%", display:"none",
                justifyContent:"center", alignItems:"center",
                fontSize:"14px", cursor:"pointer", textAlign:"center"
            });
            removeBtn.addEventListener("click", e => {
                e.stopPropagation();
                btn.remove();
                layout = layout.filter(l => l.id !== conf.id);
                saveLayoutDebounced();
            });
            btn.appendChild(removeBtn);
                // --- Botões comuns ---
                const img = document.createElement("img");
                img.src = conf.img;
                img.style.width = "100%";
                img.style.height = "100%";
                img.style.pointerEvents = "none";
                btn.appendChild(img);
        
                btn.dataset.keyName = conf.keyName;
                btn.dataset.keyCode = conf.keyCode;
                btn.dataset.keyNumber = conf.keyNumber;
        
                // pressionar
                btn.addEventListener("pointerdown", e => {
                    if(editMode) { startDragOrResize(e, btn, conf, rh); return; }
                    pressKey('keydown', conf.keyName, conf.keyCode, conf.keyNumber);
        
                    if(conf.option === 2) img.src = conf.img2;
                    btn._pressed = true;
                });
        
                btn.addEventListener("pointerup", e => {
                    if(btn._pressed) {
                        pressKey('keyup', conf.keyName, conf.keyCode, conf.keyNumber);
                        btn._pressed = false;
        
                        if(conf.option === 2) img.src = conf.img;
                    }
                });
        
                // editar
                btn.addEventListener("click", e => {
                    if(!editMode) return;
                    e.stopPropagation();
                    
                    showKeySelector(conf, k => {
                        conf.keyName = k.name;
                        conf.keyCode = k.code;
                        conf.keyNumber = k.num;
                        saveLayoutDebounced();
                    });

                    /*const choice = prompt("Select the key:", conf.keyName);
                    if(!choice) return;
                    const k = KEY_LIST.find(k=>k.name.toLowerCase()===choice.toLowerCase());
                    if(k) { 
                        conf.keyName = k.name;
                        conf.keyCode = k.code;
                        conf.keyNumber = k.num;
                        saveLayoutDebounced();
                    }*/
                });
            vk.appendChild(btn);
        }
        
        function showKeySelector(conf, onSelect) {
            const overlay = document.createElement("div");
            Object.assign(overlay.style, {
                position: "fixed", top: "0", left: "0", width: "100%", height: "100%",
                background: "rgba(0,0,0,0.5)", zIndex: "10000", display: "flex",
                alignItems: "center", justifyContent: "center"
            });
        
            const box = document.createElement("div");
            Object.assign(box.style, {
                background: "#222", color: "#fff", padding: "10px", borderRadius: "8px"
            });
        
            const select = document.createElement("select");
            select.style.width = "200px";
            KEY_LIST.forEach(k => {
                const opt = document.createElement("option");
                opt.value = k.name;
                opt.textContent = k.code;
                if (k.name === conf.keyName) opt.selected = true;
                select.appendChild(opt);
            });
        
            const ok = document.createElement("button");
            ok.textContent = "OK";
            ok.style.marginLeft = "10px";
            ok.onclick = () => {
                const selected = KEY_LIST.find(k => k.name === select.value);
                onSelect(selected);
                overlay.remove();
            };
        
            box.append(select, ok);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
        }

        function createDpad(conf) {
            if (document.getElementById(conf.id)) return;
        
            const btn = document.createElement("button");
            btn.className = "vkButton";
            btn.id = conf.id;
            setStyleFromConf(btn, conf);
        
            const img = document.createElement("img");
            img.src = conf.img || "RuffleAndroid/RuffleVKTextures/dpad_default.png";
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.pointerEvents = "none";
            btn.appendChild(img);
        
            btn.dataset.type = "dpad";
            btn.dataset.keys = JSON.stringify(conf.keys || {
                ArrowUp: "ArrowUp",
                ArrowDown: "ArrowDown",
                ArrowLeft: "ArrowLeft",
                ArrowRight: "ArrowRight"
            });
        
            const rh = document.createElement("div");
            rh.className = "resize-handle";
            btn.appendChild(rh);
        
            const removeBtn = document.createElement("div");
            removeBtn.className = "remove-btn";
            removeBtn.textContent = "×";
            Object.assign(removeBtn.style, {
                position:"absolute", top:"-8px", right:"-8px",
                width:"18px", height:"18px", background:"#b11",
                color:"#fff", borderRadius:"50%", display:"none",
                justifyContent:"center", alignItems:"center",
                fontSize:"14px", cursor:"pointer", textAlign:"center"
            });
            removeBtn.addEventListener("click", e => {
                e.stopPropagation();
                btn.remove();
                layout = layout.filter(l => l.id !== conf.id);
                saveLayoutDebounced();
            });
            btn.appendChild(removeBtn);
        
            let lastTap = 0;
        
            btn.addEventListener("pointerdown", e => {
                if (!editMode) {
                    // --- modo normal ---
                    const rect = btn.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const w = rect.width;
                    const h = rect.height;
        
                    let dir;
                    const cx = w / 2, cy = h / 2;
                    const dx = x - cx;
                    const dy = y - cy;
        
                    if (Math.abs(dx) > Math.abs(dy)) {
                        dir = dx > 0 ? "ArrowRight" : "ArrowLeft";
                    } else {
                        dir = dy > 0 ? "ArrowDown" : "ArrowUp";
                    }
        
                    btn._lastDir = dir;
                    switch(dir) {
                        case "ArrowUp": img.src = conf.imgUp || "RuffleAndroid/RuffleVKTextures/dpad_up.png"; break;
                        case "ArrowDown": img.src = conf.imgDown || "RuffleAndroid/RuffleVKTextures/dpad_down.png"; break;
                        case "ArrowLeft": img.src = conf.imgLeft || "RuffleAndroid/RuffleVKTextures/dpad_left.png"; break;
                        case "ArrowRight": img.src = conf.imgRight || "RuffleAndroid/RuffleVKTextures/dpad_right.png"; break;
                    }
        
                    const keys = JSON.parse(btn.dataset.keys);
                    pressKey("keydown", keys[dir], keys[dir], 0);
                    btn._pressed = true;
                    return;
                }
        
                // --- modo edição ---
                e.stopPropagation();
        
                // resize
                if (e.target.classList.contains("resize-handle")) {
                    startResize(e, btn, conf);
                    return;
                }
        
                const now = Date.now();
                if (now - lastTap < 300) {
                    e.stopPropagation();
                
                    const keys = JSON.parse(btn.dataset.keys);
                    const overlay = document.createElement("div");
                    Object.assign(overlay.style, {
                        position: "fixed", top: "0", left: "0",
                        width: "100%", height: "100%",
                        background: "rgba(0,0,0,0.6)",
                        zIndex: "10001", display: "flex",
                        alignItems: "center", justifyContent: "center"
                    });
                
                    const box = document.createElement("div");
                    Object.assign(box.style, {
                        background: "#222", color: "#fff",
                        padding: "12px 16px", borderRadius: "8px",
                        fontSize: "14px", textAlign: "center",
                        minWidth: "260px"
                    });
                
                    const makeSelect = (id, current) => {
                        const select = document.createElement("select");
                        select.id = id;
                        select.style.width = "150px";
                        KEY_LIST.forEach(k => {
                            const opt = document.createElement("option");
                            opt.value = k.name;
                            opt.textContent = k.code;
                            if (k.name === current) opt.selected = true;
                            select.appendChild(opt);
                        });
                        return select;
                    };
                
                    const upSel = makeSelect("upSel", keys.ArrowUp);
                    const downSel = makeSelect("downSel", keys.ArrowDown);
                    const leftSel = makeSelect("leftSel", keys.ArrowLeft);
                    const rightSel = makeSelect("rightSel", keys.ArrowRight);
                
                    box.innerHTML = `<p style="margin-bottom:8px;">Edit D-pad keys</p>`;
                    box.append(
                        document.createTextNode("Up: "), upSel, document.createElement("br"),
                        document.createTextNode("Down: "), downSel, document.createElement("br"),
                        document.createTextNode("Left: "), leftSel, document.createElement("br"),
                        document.createTextNode("Right: "), rightSel, document.createElement("br")
                    );
                
                    const okBtn = document.createElement("button");
                    const cancelBtn = document.createElement("button");
                    okBtn.textContent = "OK";
                    cancelBtn.textContent = "Cancel";
                    okBtn.style.margin = "8px";
                    cancelBtn.style.margin = "8px";
                
                    okBtn.onclick = () => {
                        keys.ArrowUp = upSel.value;
                        keys.ArrowDown = downSel.value;
                        keys.ArrowLeft = leftSel.value;
                        keys.ArrowRight = rightSel.value;
                        btn.dataset.keys = JSON.stringify(keys);
                        conf.keys = keys;
                        saveLayoutDebounced();
                        overlay.remove();
                    };
                    cancelBtn.onclick = () => overlay.remove();
                
                    box.append(okBtn, cancelBtn);
                    overlay.appendChild(box);
                    document.body.appendChild(overlay);
                } else {
                    startDrag(e, btn, conf);
                }
                lastTap = now;
            });
        
            btn.addEventListener("pointerup", e => {
                if (!editMode && btn._pressed) {
                    img.src = conf.img || "RuffleAndroid/RuffleVKTextures/dpad_default.png";
                    const keys = JSON.parse(btn.dataset.keys);
                    pressKey("keyup", keys[btn._lastDir], keys[btn._lastDir], 0);
                    btn._pressed = false;
                }
            });
        
            document.getElementById("virtualKb").appendChild(btn);
        }

        function setStyleFromConf(btn, conf) {
            btn.style.left = conf.x + "px";
            btn.style.top = conf.y + "px";
            btn.style.width = conf.w + "px";
            btn.style.height = conf.h + "px";
        }
        
        function startDragOrResize(e, btn, conf, rh){
            if(e.target===rh) startResize(e, btn, conf);
            else startDrag(e, btn, conf);
        }

        function startDrag(e, btn, conf) {
            e.preventDefault();
            btn.setPointerCapture(e.pointerId);
            const startX = e.clientX, startY = e.clientY;
            const origLeft = parseFloat(btn.style.left) || 0;
            const origTop = parseFloat(btn.style.top) || 0;

            function move(ev) {
                btn.style.left = origLeft + (ev.clientX - startX) + "px";
                btn.style.top = origTop + (ev.clientY - startY) + "px";
            }
            function up(ev) {
                btn.releasePointerCapture(e.pointerId);
                conf.x = parseFloat(btn.style.left);
                conf.y = parseFloat(btn.style.top);
                saveLayoutDebounced();
                document.removeEventListener('pointermove', move);
                document.removeEventListener('pointerup', up);
            }
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up);
        }

        function startResize(e, btn, conf) {
            e.preventDefault(); e.stopPropagation();
            btn.setPointerCapture(e.pointerId);
            const startX = e.clientX, startY = e.clientY;
            const origW = parseFloat(btn.style.width);
            const origH = parseFloat(btn.style.height);

            function move(ev) {
                btn.style.width = Math.max(24, origW + (ev.clientX - startX)) + "px";
                btn.style.height = Math.max(24, origH + (ev.clientY - startY)) + "px";
            }
            function up(ev) {
                btn.releasePointerCapture(ev.pointerId);
                conf.w = parseFloat(btn.style.width);
                conf.h = parseFloat(btn.style.height);
                saveLayoutDebounced();
                document.removeEventListener('pointermove', move);
                document.removeEventListener('pointerup', up);
            }
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up);
        }

        function makeMovable(el) {
            el.style.position = "absolute";
            el.addEventListener("pointerdown", e => {
                if (!editMode) return;
                e.preventDefault();
                const startX = e.clientX, startY = e.clientY;
                const origLeft = parseFloat(el.style.left)||10;
                const origTop = parseFloat(el.style.top)||10;

                function move(ev) {
                    el.style.left = origLeft + (ev.clientX - startX) + "px";
                    el.style.top = origTop + (ev.clientY - startY) + "px";
                }
                function up(ev) {
                    document.removeEventListener("pointermove", move);
                    document.removeEventListener("pointerup", up);
                }
                document.addEventListener("pointermove", move);
                document.addEventListener("pointerup", up);
            });
        }

        function saveLayout() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
        }

        let saveTimeout;
        function saveLayoutDebounced() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveLayout, 200);
        }

        function loadLayout() {
            const data = localStorage.getItem(STORAGE_KEY);
            console.warn("No layout saved — loading default layout.");
            if (!data) {
                // layout inicial padrão
               return [
  {
            id:"btn1760132700743",
            type:"",
            img:"RuffleAndroid/RuffleVKTextures/button_default.png",
            img2:"RuffleAndroid/RuffleVKTextures/button_pressed.png",
            imgUp:"",
            imgDown:"",
            imgLeft:"",
            imgRight:"",
            option:2,
            keys:{},
            keyName:"P",
            keyCode:"KeyP",
            keyNumber:80,
            x:607.834, y:65.9997, w:88.103, h:82.6667
          },
  {
            id:"btn1760143570703",
            type:"",
            img:"RuffleAndroid/RuffleVKTextures/pause_default.png",
            img2:"RuffleAndroid/RuffleVKTextures/pause_pressed.png",
            imgUp:"",
            imgDown:"",
            imgLeft:"",
            imgRight:"",
            option:1,
            keys:{},
            keyName:"Backspace",
            keyCode:"Backspace",
            keyNumber:8,
            x:645.318, y:-2.12873, w:44.6666, h:35.7855
          },
  {
            id:"btn1760148907272",
            type:"dpad",
            img:"RuffleAndroid/RuffleVKTextures/dpad_default.png",
            img2:"",
            imgUp:"RuffleAndroid/RuffleVKTextures/dpad_up.png",
            imgDown:"RuffleAndroid/RuffleVKTextures/dpad_down.png",
            imgLeft:"RuffleAndroid/RuffleVKTextures/dpad_left.png",
            imgRight:"RuffleAndroid/RuffleVKTextures/dpad_right.png",
            option:"",
            keys:{"ArrowUp":"W","ArrowDown":"S","ArrowLeft":"A","ArrowRight":"D"},
            keyName:"",
            keyCode:"",
            keyNumber:0,
            x:46.5, y:123.667, w:116.333, h:107.667
          },
  {
            id:"btn1760342628942",
            type:"",
            img:"RuffleAndroid/RuffleVKTextures/button_default.png",
            img2:"RuffleAndroid/RuffleVKTextures/button_pressed.png",
            imgUp:"",
            imgDown:"",
            imgLeft:"",
            imgRight:"",
            option:2,
            keys:{},
            keyName:"O",
            keyCode:"KeyO",
            keyNumber:79,
            x:521, y:68.6667, w:87.3337, h:85.3337
          },
  {
            id:"btn1760342680185",
            type:"",
            img:"RuffleAndroid/RuffleVKTextures/button_default.png",
            img2:"RuffleAndroid/RuffleVKTextures/button_pressed.png",
            imgUp:"",
            imgDown:"",
            imgLeft:"",
            imgRight:"",
            option:2,
            keys:{},
            keyName:"I",
            keyCode:"KeyI",
            keyNumber:73,
            x:608, y:148.667, w:88.0001, h:81.6667
          },
  {
            id:"btn1760342727942",
            type:"",
            img:"RuffleAndroid/RuffleVKTextures/button_default.png",
            img2:"RuffleAndroid/RuffleVKTextures/button_pressed.png",
            imgUp:"",
            imgDown:"",
            imgLeft:"",
            imgRight:"",
            option:2,
            keys:{},
            keyName:"U",
            keyCode:"KeyU",
            keyNumber:85,
            x:522, y:150.667, w:87, h:80.3333
          },
  {
            id:"btn1760342745017",
            type:"",
            img:"RuffleAndroid/RuffleVKTextures/button_default.png",
            img2:"RuffleAndroid/RuffleVKTextures/button_pressed.png",
            imgUp:"",
            imgDown:"",
            imgLeft:"",
            imgRight:"",
            option:2,
            keys:{},
            keyName:"Space",
            keyCode:"Space",
            keyNumber:32,
            x:324, y:184.999, w:77.3333, h:73.3333
          }
];
            }
            try {
                let parsed = JSON.parse(data);
                return parsed.map(conf => {
                    // Garante que keys (D-pad) e imagens sejam restaurados corretamente
                    if (typeof conf.keys === "string") {
                        try { conf.keys = JSON.parse(conf.keys); } catch(e) { conf.keys = {}; }
                    }
                    conf.img = conf.img || "";
                    conf.img2 = conf.img2 || "";
                    conf.imgUp = conf.imgUp || "";
                    conf.imgDown = conf.imgDown || "";
                    conf.imgLeft = conf.imgLeft || "";
                    conf.imgRight = conf.imgRight || "";
                    return conf;
                });
            } catch(e) { 
                console.error("Error loading layout:", e);
                return []; 
            }
        }
        }
            // inicializa
            init();
        })();
