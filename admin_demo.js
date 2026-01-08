// URL de tu Web App de Google Apps Script (Asegúrate de que sea la última versión publicada)
const API_URL = "https://script.google.com/macros/s/AKfycbxyyH80FUstRfFi6LrsL5c5YmNrdOhSGGDvPXKcB_lFVCRl7lQVt4Pj-q3uPlL8g4nhXA/exec";

let CLIENTS_CACHE = [];
let USERS_CACHE = [];

document.addEventListener("DOMContentLoaded", () => {
    console.log("Iniciando Portal de Administración...");
    initApp();
});

async function initApp() {
    // Cargamos los datos iniciales
    await Promise.all([
        loadNextWO(),
        loadClients(),
        loadUsers()
    ]);
}

// 1. Obtener el siguiente ID de Orden de Trabajo
async function loadNextWO() {
    try {
        const response = await fetch(`${API_URL}?action=getNextWO`);
        const data = await response.json();
        document.getElementById("id_orden").value = data.next || "1";
    } catch (e) {
        console.error("Error cargando ID:", e);
    }
}

// 2. Cargar Clientes desde la hoja 'clients'
async function loadClients() {
    try {
        const response = await fetch(`${API_URL}?action=getClients`);
        CLIENTS_CACHE = await response.json();
        const select = document.getElementById("select_cliente");
        
        select.innerHTML = '<option value="">Seleccione Cliente</option>';
        CLIENTS_CACHE.forEach(cliente => {
            const option = document.createElement("option");
            option.value = cliente.id; // Asumiendo que la columna A es ID
            option.textContent = cliente.nombre; // Asumiendo columna B es Nombre
            select.appendChild(option);
        });
    } catch (e) {
        console.error("Error cargando Clientes:", e);
    }
}

// 3. Cargar Staff desde la hoja 'Users'
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}?action=getUsers`);
        USERS_CACHE = await response.json();
        const select = document.getElementById("select_worker");
        const selectExtra = document.getElementById("select_extra_worker");
        const selectPay = document.getElementById("pay_select_worker");

        const fragment = document.createDocumentFragment();
        
        USERS_CACHE.forEach(user => {
            const option = document.createElement("option");
            option.value = user.id;
            option.textContent = user.nombre;
            fragment.appendChild(option);
        });

        // Llenamos todos los selects de trabajadores que tienes en el HTML
        [select, selectExtra, selectPay].forEach(s => {
            if(s) {
                s.innerHTML = '<option value="">Seleccione Staff</option>';
                s.appendChild(fragment.cloneNode(true));
            }
        });
    } catch (e) {
        console.error("Error cargando Usuarios:", e);
    }
}

// 4. Autorellenar dirección del cliente
function autoFillCliente() {
    const id = document.getElementById("select_cliente").value;
    const cliente = CLIENTS_CACHE.find(c => c.id == id);
    if (cliente) {
        document.getElementById("direccion").value = cliente.direccion || "";
    }
}

// 5. Capturar Dirección Física (Requerimiento de Celda J)
async function getPhysicalLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) resolve("Sin soporte GPS");
        
        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const { latitude, longitude } = pos.coords;
                // Geocodificación inversa gratuita
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await res.json();
                resolve(data.display_name || `Lat: ${latitude}, Lon: ${longitude}`);
            } catch (err) {
                resolve("Error al obtener nombre de calle");
            }
        }, () => resolve("Ubicación denegada"));
    });
}

// 6. Lanzar Proyecto (Guardar en WorkOrders)
async function guardarOrden() {
    const btn = document.querySelector(".btn-save");
    const clientId = document.getElementById("select_cliente").value;
    const workerId = document.getElementById("select_worker").value;
    const presupuesto = document.getElementById("presupuesto").value;

    if (!clientId || !workerId || !presupuesto) {
        alert("⚠️ Por favor completa Cliente, Staff y Presupuesto.");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CAPTURANDO GPS...';

    const cliente = CLIENTS_CACHE.find(c => c.id == clientId);
    const usuario = USERS_CACHE.find(u => u.id == workerId);
    
    // Obtenemos la dirección física real
    const direccionReal = await getPhysicalLocation();

    const payload = {
        action: "saveWorkOrder",
        id: document.getElementById("id_orden").value,
        nombre_cliente: cliente.nombre,
        email_trabajador: usuario.email,
        presupuesto: presupuesto,
        direccion_entrada: direccionReal, // Esto va a la Columna J
        notas: document.getElementById("notas").value || ""
    };

    try {
        // Importante: no-cors para Google Scripts
        await fetch(API_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload)
        });

        alert("🚀 PROYECTO LANZADO\nUbicación registrada: " + direccionReal);
        location.reload();
    } catch (err) {
        console.error("Error:", err);
        alert("❌ Error al conectar.");
        btn.disabled = false;
        btn.innerText = "LANZAR PROYECTO";
    }
}

// Funciones para Modales (estética)
function abrirModalNominaGlobal() { document.getElementById('modalSelectPay').style.display = 'flex'; }
function cerrarModales() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }
