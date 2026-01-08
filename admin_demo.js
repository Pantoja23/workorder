// ================================================
// admin.js - VERSIÓN PRODUCCIÓN CON GOOGLE SHEETS
// ================================================

const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbz3_Hr6Io7l7UqYpqJ3APk9q3LB31DimfF9zOk65c_MsmMcdM80JRyBV8lgDTK5Wv6rZQ/exec"; // Reemplaza con tu script real
let globalData = { clients: [], users: [], rawJobs: [] };
let countdown = 15;

window.onload = async () => {
    await cargarConfiguracion();
    await cargarTabla();
    iniciarTemporizador();
};

// ===== TEMPORIZADOR AUTO-REFRESH =====
function iniciarTemporizador() {
    setInterval(() => {
        countdown--;
        document.getElementById('timer-display').innerText = `| ACTUALIZANDO EN: ${countdown}s`;
        if(countdown <= 0){
            cargarTabla();
            countdown = 15;
        }
    }, 1000);
}

// ===== CARGAR CLIENTES Y TRABAJADORES =====
async function cargarConfiguracion() {
    try {
        const res = await fetch(`${URL_SCRIPT}?action=get_dropdowns`);
        const data = await res.json();
        globalData = { ...globalData, ...data };

        document.getElementById('select_cliente').innerHTML =
            '<option value="">-- Seleccionar Cliente --</option>' +
            globalData.clients.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

        const workerOptions = globalData.users.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
        document.getElementById('select_worker').innerHTML =
            '<option value="">-- Seleccionar Staff --</option>' + workerOptions;
        document.getElementById('select_extra_worker').innerHTML = workerOptions;
    } catch(e) { console.error("Error cargando configuración:", e); }
}

// ===== CARGAR TABLA DE TRABAJOS =====
async function cargarTabla() {
    try {
        const res = await fetch(URL_SCRIPT);
        const trabajos = await res.json();
        globalData.rawJobs = trabajos;

        // ===== ID Siguiente =====
        let maxNum = 100;
        trabajos.forEach(j => {
            if(j.id && j.id.startsWith('PTRWO')){
                const n = parseInt(j.id.replace('PTRWO',''));
                if(!isNaN(n) && n>maxNum) maxNum = n;
            }
        });
        document.getElementById('id_orden').value = 'PTRWO' + (maxNum + 1);

        // ===== AGRUPAR POR ORDEN =====
        const agrupados = trabajos.reduce((acc, curr)=>{
            if(String(curr.estatus).toLowerCase()!=='active') return acc;
            if(!acc[curr.id]) acc[curr.id]={...curr, equipo: [], gastoActual:0};

            const worker = globalData.users.find(u=>u.name===curr.asignado_a);
            const rate = worker?parseFloat(worker.rate):0;
            acc[curr.id].gastoActual += parseFloat(curr.horas_acumuladas||0)*rate;

            // ===== LÓGICA GPS =====
            let inVal = String(curr.estatus_gps_endrada || "").trim();
            let outVal = String(curr.estatus_gps_salida || "").trim();
            let addr = String(curr.labor_log_address || "").trim();
            let clase='gps-offline';
            let label='OFF / CLOCK OUT';

            if(outVal==="" || outVal==="null" || outVal==="S/D"){
                let match=inVal.match(/\(([^)]+)\)/);
                if(match){
                    const dist=parseFloat(match[1].replace(/[^\d.]/g,''));
                    if(!isNaN(dist)){
                        if(dist>0.1){ clase='gps-lejos'; label='LEJOS ('+dist+' mi)'; }
                        else { clase='gps-cerca'; label='TRABAJANDO ('+dist+' mi)'; }
                    }
                } else if(inVal!=="") { clase='gps-cerca'; label='EN SITIO'; }
            }

            acc[curr.id].equipo.push({nombre:curr.asignado_a, horas:curr.horas_acumuladas, gps:label, address:addr, clase});
            return acc;
        }, {});

        renderTabla(Object.values(agrupados));
    } catch(e){ console.error("Error cargar tabla:", e); }
}

// ===== RENDER TABLA =====
function renderTabla(items){
    const tbody=document.getElementById('lista_trabajos');
    tbody.innerHTML='';
    const alertsContainer = document.getElementById('alerts-container');
    const alertsPanel = document.getElementById('critical-alerts-panel');
    let alertHTML='';

    items.forEach(t=>{
        t.equipo.forEach(e=>{
            if(e.clase==='gps-lejos'){
                alertHTML+=`<div style="color:var(--danger); font-weight:800; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-exclamation-triangle" style="animation:pulse 1s infinite;"></i>
                <span>${e.nombre} está a <b>${e.gps.replace('LEJOS','')}</b> de la obra ${t.id} (${t.nombre_cliente})</span>
                </div>`;
            }
        });

        const profit = (t.presupuesto||0) - (t.gastoActual||0);
        const ratio = t.gastoActual/t.presupuesto*100;

        const tr = document.createElement('tr');
        tr.innerHTML=`
            <td><b style="color:var(--primary)">${t.id}</b><br>${t.nombre_cliente}<br><small>${t.direccion}</small></td>
            <td>${t.equipo.map(e=>`
                <div class="staff-tag ${e.clase}" onclick="verMapaEntrada('${e.address}','${e.nombre}','${t.id}')">
                    <span><i class="fas ${e.clase==='gps-lejos'?'fa-exclamation-triangle':(e.clase==='gps-cerca'?'fa-check-circle':'fa-power-off')}"></i> ${e.nombre}</span>
                    <small>${e.horas||0} hrs | ${e.gps}</small>
                </div>`).join('')}
            </td>
            <td><small style="color:#94a3b8">Budget: $${t.presupuesto||0}</small><br>
                <span class="profit-badge">Profit: $${profit.toFixed(2)}</span>
                ${ratio>85?'<br><span class="budget-alert">⚠️ OVER BUDGET</span>':''}
            </td>
            <td>
                <div style="display:flex; gap:6px;">
                    <button class="btn" style="background:var(--primary);color:white;" onclick="abrirAddWorker('${t.id}')"><i class="fas fa-user-plus"></i></button>
                    <button class="btn btn-finish" onclick="finalizarProyecto('${t.id}')"><i class="fas fa-check-double"></i></button>
                    <button class="btn" style="background:#25D366;color:white;" onclick="whatsappReporte('${t.id}','${t.nombre_cliente}',${t.gastoActual||0})"><i class="fab fa-whatsapp"></i></button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });

    alertsContainer.innerHTML = alertHTML;
    alertsPanel.style.display = alertHTML?'block':'none';
}

// ===== CREAR ORDEN =====
async function guardarOrden(){
    const payload={
        action:'CREATE_ORDER',
        id: document.getElementById('id_orden').value,
        cliente: document.getElementById('select_cliente').value,
        email_cliente: document.getElementById('h_email_cliente').value,
        telefono: document.getElementById('h_telefono_cliente').value,
        direccion: document.getElementById('direccion').value,
        servicio: document.getElementById('h_servicio_cliente').value,
        asignado_a: document.getElementById('select_worker').value,
        email_trabajador: document.getElementById('h_email_worker').value,
        notas: document.getElementById('notas').value,
        estatus:'ACTIVE',
        presupuesto:parseFloat(document.getElementById('presupuesto').value)||0
    };
    const btn=document.querySelector('.btn-save');
    btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> GUARDANDO...';
    btn.style.opacity='0.5';
    await fetch(URL_SCRIPT,{method:'POST',mode:'no-cors',body:JSON.stringify(payload)});
    location.reload();
}

// ===== FINALIZAR PROYECTO =====
async function finalizarProyecto(id){
    if(!confirm(`¿Marcar ${id} como completado?`)) return;
    await fetch(URL_SCRIPT,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'CHANGE_STATUS',id})});
    location.reload();
}

// ===== MODALES =====
function abrirAddWorker(id){ document.getElementById('add_worker_id').value=id; document.getElementById('modalAddWorker').style.display='flex'; }
function cerrarModales(){ document.querySelectorAll('.modal').forEach(m=>m.style.display='none'); }

// ===== ASIGNAR TRABAJADOR ADICIONAL =====
async function ejecutarAddWorker(){
    const id=document.getElementById('add_worker_id').value;
    const workerName=document.getElementById('select_extra_worker').value;
    const job = globalData.rawJobs.find(j=>j.id===id);
    const worker = globalData.users.find(u=>u.name===workerName);
    if(!worker) return;

    const payload={
        action:'CREATE_ORDER',
        id:id,
        cliente:job.nombre_cliente,
        email_cliente:job.email_cliente,
        telefono:job.telefono,
        direccion:job.direccion,
        servicio:job.servicio,
        asignado_a:workerName,
        email_trabajador:worker.email,
        notas:job.notas,
        estatus:'ACTIVE',
        presupuesto:job.presupuesto
    };
    await fetch(URL_SCRIPT,{method:'POST',mode:'no-cors',body:JSON.stringify(payload)});
    location.reload();
}

// ===== FILTRO =====
function filtrarTabla(){
    const q=document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('#lista_trabajos tr').forEach(tr=>{
        tr.style.display=tr.innerText.toLowerCase().includes(q)?'':'none';
    });
}

// ===== WHATSAPP REPORT =====
function whatsappReporte(id, cliente, gasto){
    const msg=encodeURIComponent(`*PANTOJA TILE - REPORTE*\n\n✅ Proyecto: ${id}\n👤 Cliente: ${cliente}\n💸 Gasto Labor: $${gasto}\n\n_Reporte generado automáticamente._`);
    window.open(`https://wa.me/?text=${msg}`,'_blank');
}

// ===== VER MAPA =====
function verMapaEntrada(addr,nombre,id){
    const proyecto=globalData.rawJobs.find(j=>j.id===id);
    const destino=proyecto?proyecto.direccion:'';
    if(!addr) return alert('No hay GPS para '+nombre);
    const url=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(addr)}&destination=${encodeURIComponent(destino)}&travelmode=driving`;
    window.open(url,'_blank');
}

// ===== AUTO FILL =====
function autoFillCliente(){
    const c = globalData.clients.find(x=>x.name===document.getElementById('select_cliente').value);
    if(c){
        document.getElementById('h_email_cliente').value=c.email;
        document.getElementById('h_telefono_cliente').value=c.phone;
        document.getElementById('h_servicio_cliente').value=c.service;
        document.getElementById('direccion').value=c.address||"";
    }
}
function autoFillWorker(){
    const w = globalData.users.find(x=>x.name===document.getElementById('select_worker').value);
    if(w) document.getElementById('h_email_worker').value=w.email;
}
