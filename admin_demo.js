const API_URL = "https://script.google.com/macros/s/AKfycbxyyH80FUstRfFi6LrsL5c5YmNrdOhSGGDvPXKcB_lFVCRl7lQVt4Pj-q3uPlL8g4nhXA/exec"; // <-- reemplaza con tu Web App URL

let CLIENTS_CACHE = [];
let USERS_CACHE = [];

document.addEventListener("DOMContentLoaded", ()=>{
  loadNextWO();
  loadClients();
  loadUsers();
});

function loadNextWO(){
  fetch(`${API_URL}?action=getNextWO`)
    .then(r=>r.json())
    .then(d=>document.getElementById("id_orden").value=d.next);
}

function loadClients(){
  fetch(`${API_URL}?action=getClients`)
    .then(r=>r.json())
    .then(data=>{
      CLIENTS_CACHE = data;
      const sel = document.getElementById("select_cliente");
      sel.innerHTML = `<option value="">Select Client</option>`;
      data.forEach(c=>{
        sel.innerHTML+=`<option value="${c.id}">${c.nombre}</option>`;
      });
    });
}

function autoFillCliente(){
  const id = document.getElementById("select_cliente").value;
  const c = CLIENTS_CACHE.find(x=>x.id==id);
  if(c) document.getElementById("direccion").value = c.direccion || "";
}

function loadUsers(){
  fetch(`${API_URL}?action=getUsers`)
    .then(r=>r.json())
    .then(data=>{
      USERS_CACHE = data;
      const sel = document.getElementById("select_worker");
      sel.innerHTML = `<option value="">Select Staff</option>`;
      data.forEach(u=>{
        sel.innerHTML+=`<option value="${u.id}">${u.nombre}</option>`;
      });
    });
}

function guardarOrden(){
  const clientId = document.getElementById("select_cliente").value;
  const staffId = document.getElementById("select_worker").value;
  if(!clientId || !staffId){ alert("Select client and staff"); return; }

  const c = CLIENTS_CACHE.find(x=>x.id==clientId);
  const u = USERS_CACHE.find(x=>x.id==staffId);

  const payload = {
    action:"saveWorkOrder",
    id:document.getElementById("id_orden").value,
    nombre_cliente:c.nombre,
    email_cliente:c.email,
    telefono:c.telefono,
    direccion:document.getElementById("direccion").value,
    servicio:c.servicio,
    asignado_a:staffId,
    email_trabajador:u.email,
    notas_estatus:document.getElementById("notas").value || "OPEN",
    presupuesto:document.getElementById("presupuesto").value || 0
  };

  fetch(API_URL,{method:"POST",body:JSON.stringify(payload)})
    .then(r=>r.json())
    .then(res=>{
      if(res.success){
        alert("✅ Work Order creada en Work_Orders");
        location.reload();
      } else {
        alert("❌ Error al guardar Work Order");
      }
    });
}
