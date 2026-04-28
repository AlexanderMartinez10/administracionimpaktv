// --- ESTADO GLOBAL ---
let cuentas = JSON.parse(localStorage.getItem('impakto_cuentas_v3')) || [];
let sortAsc = true;
let chartInstance = null;
let currentFotoBase64 = '';

// --- HELPERS ---
function guardarCuentas() {
    localStorage.setItem('impakto_cuentas_v3', JSON.stringify(cuentas));
    actualizarUI();
}

function calcularDias(fecha) {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const v = new Date(fecha);
    v.setMinutes(v.getMinutes() + v.getTimezoneOffset()); v.setHours(0,0,0,0);
    return Math.ceil((v - hoy) / 86400000);
}

function fmtFecha(f) { const p = f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }

function showToast(msg, err=false) {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.className = t.className.replace(/bg-\w+-500\/90/, err ? 'bg-red-500/90' : 'bg-green-500/90');
    t.querySelector('i').className = err ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
    t.style.transform = 'translateY(0)';
    setTimeout(() => t.style.transform = 'translateY(150%)', 3000);
}

// --- NAVEGACIÓN ---
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.section-content');

navItems.forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        const target = item.getAttribute('data-target');
        navItems.forEach(n => {
            n.classList.remove('active','bg-impakto-red','text-white','shadow-[0_8px_20px_rgba(255,42,117,0.3)]');
            n.classList.add('text-impakto-light','border-transparent');
        });
        item.classList.add('active','bg-impakto-red','text-white','shadow-[0_8px_20px_rgba(255,42,117,0.3)]');
        item.classList.remove('text-impakto-light','border-transparent');
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById(target).classList.add('active');
        if (window.innerWidth < 768) toggleSidebar();
        if (target === 'dashboard') actualizarDashboard();
        if (target === 'cuentas') renderizarCuentas();
        if (target === 'alertas') renderizarAlertas();
    });
});

const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
function toggleSidebar() {
    sidebar.classList.toggle('-translate-x-full');
    sidebarOverlay.classList.toggle('hidden');
}
document.getElementById('openSidebarBtn').addEventListener('click', toggleSidebar);
document.getElementById('closeSidebarBtn').addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);

document.querySelector('.toggle-pwd').addEventListener('click', function() {
    const inp = document.getElementById('password');
    const ico = this.querySelector('i');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    ico.classList.toggle('fa-eye'); ico.classList.toggle('fa-eye-slash');
});

// --- DASHBOARD ---
function actualizarDashboard() {
    const totalClientes = cuentas.reduce((s,c) => s + (c.teles||[]).length, 0);
    document.getElementById('statTotal').textContent = cuentas.length;
    document.getElementById('statClientes').textContent = totalClientes;
    const hoy = new Date();
    let vencenMes = 0, proxArr = [];
    cuentas.forEach(c => {
        const dias = calcularDias(c.fecha);
        const f = new Date(c.fecha); f.setMinutes(f.getMinutes()+f.getTimezoneOffset());
        if (f.getMonth()===hoy.getMonth() && f.getFullYear()===hoy.getFullYear()) vencenMes++;
        if (dias >= 0) proxArr.push({fecha:c.fecha, dias});
    });
    document.getElementById('statMes').textContent = vencenMes;
    proxArr.sort((a,b)=>a.dias-b.dias);
    document.getElementById('statProximo').textContent = proxArr.length ? fmtFecha(proxArr[0].fecha) : 'Ninguno';
    renderizarGrafico();
}

function renderizarGrafico() {
    const ctx = document.getElementById('vencimientosChart').getContext('2d');
    const labels=[], counts=[0,0,0,0,0,0];
    const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const hoy=new Date();
    for(let i=0;i<6;i++){let m=hoy.getMonth()+i,y=hoy.getFullYear();if(m>11){m-=12;y++;}labels.push(`${meses[m]} ${y}`);}
    cuentas.forEach(c=>{
        const f=new Date(c.fecha); f.setMinutes(f.getMinutes()+f.getTimezoneOffset());
        const diff=(f.getFullYear()-hoy.getFullYear())*12+(f.getMonth()-hoy.getMonth());
        if(diff>=0&&diff<6) counts[diff]++;
    });
    if(chartInstance) chartInstance.destroy();
    Chart.defaults.color='#6b7280'; Chart.defaults.font.family='Poppins';
    chartInstance=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'Vencimientos',data:counts,backgroundColor:'rgba(255,42,117,0.8)',borderColor:'#ff2a75',borderWidth:1,borderRadius:4,hoverBackgroundColor:'#ff2a75'}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(31,41,55,0.5)'},ticks:{stepSize:1}},y:{grid:{display:false}}}}});
}

// --- TELES EN FORMULARIO ---
let telesData = [];

function crearCardTele(idx, tele={}) {
    const div = document.createElement('div');
    div.className = 'bg-impakto-dark/60 border border-impakto-gray/20 rounded-xl p-4 relative';
    div.setAttribute('data-tele-idx', idx);
    div.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-impakto-red flex items-center gap-2"><i class="fas fa-tv"></i> Tele ${idx+1}</span>
            ${idx>0?`<button type="button" onclick="eliminarTeleForm(${idx})" class="text-impakto-gray hover:text-red-400 transition-colors text-xs"><i class="fas fa-times"></i></button>`:''}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="relative">
                <i class="fas fa-user absolute left-3 top-1/2 -translate-y-1/2 text-impakto-gray text-sm"></i>
                <input type="text" placeholder="Nombre del cliente" value="${tele.nombre||''}" data-field="nombre" class="tele-input block w-full bg-impakto-black border border-impakto-gray/20 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-impakto-red transition-all">
            </div>
            <div class="relative">
                <i class="fas fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-impakto-gray text-sm"></i>
                <input type="tel" placeholder="Teléfono" value="${tele.telefono||''}" data-field="telefono" class="tele-input block w-full bg-impakto-black border border-impakto-gray/20 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-impakto-red transition-all">
            </div>
            <div class="relative md:col-span-2">
                <i class="fas fa-map-marker-alt absolute left-3 top-1/2 -translate-y-1/2 text-impakto-gray text-sm"></i>
                <input type="text" placeholder="Dirección / Donde vive" value="${tele.direccion||''}" data-field="direccion" class="tele-input block w-full bg-impakto-black border border-impakto-gray/20 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-impakto-red transition-all">
            </div>
            <div class="relative">
                <i class="fas fa-receipt absolute left-3 top-1/2 -translate-y-1/2 text-impakto-gray text-sm"></i>
                <input type="number" placeholder="Cuotas abonadas" value="${tele.cuotas||0}" min="0" data-field="cuotas" class="tele-input block w-full bg-impakto-black border border-impakto-gray/20 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-impakto-red transition-all">
            </div>
            <div class="relative">
                <i class="fas fa-money-bill-wave absolute left-3 top-1/2 -translate-y-1/2 text-impakto-gray text-sm"></i>
                <input type="number" placeholder="Deuda ($)" value="${tele.deuda||0}" min="0" data-field="deuda" class="tele-input block w-full bg-impakto-black border border-impakto-gray/20 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-impakto-red transition-all">
            </div>
        </div>`;
    return div;
}

function renderizarTelesForm() {
    const cont = document.getElementById('telesContainer');
    cont.innerHTML = '';
    telesData.forEach((t,i) => cont.appendChild(crearCardTele(i,t)));
}

window.eliminarTeleForm = function(idx) {
    telesData.splice(idx,1);
    renderizarTelesForm();
};

document.getElementById('btnAddTele').addEventListener('click', () => {
    telesData.push({nombre:'',telefono:'',direccion:'',cuotas:0,deuda:0,pagado:false});
    renderizarTelesForm();
});

function leerTelesForm() {
    const cards = document.querySelectorAll('[data-tele-idx]');
    cards.forEach((card, i) => {
        if (!telesData[i]) telesData[i] = {pagado:false};
        card.querySelectorAll('.tele-input').forEach(inp => {
            const f = inp.getAttribute('data-field');
            telesData[i][f] = (f==='cuotas'||f==='deuda') ? parseInt(inp.value)||0 : inp.value;
        });
    });
}

// --- TABLA / CARDS DE CUENTAS ---
function renderizarCuentas(filtro='') {
    const cont = document.getElementById('cuentasContainer');
    const empty = document.getElementById('emptyState');
    cont.innerHTML = '';

    let lista = cuentas.filter(c => {
        const f = filtro.toLowerCase();
        return !f ||
            c.email.toLowerCase().includes(f) ||
            (c.nota||'').toLowerCase().includes(f) ||
            (c.teles||[]).some(t =>
                (t.nombre||'').toLowerCase().includes(f) ||
                (t.telefono||'').toLowerCase().includes(f) ||
                (t.direccion||'').toLowerCase().includes(f)
            );
    });

    lista.sort((a,b)=> sortAsc ? new Date(a.fecha)-new Date(b.fecha) : new Date(b.fecha)-new Date(a.fecha));

    if (!lista.length) {
        empty.classList.remove('hidden'); empty.classList.add('flex');
        return;
    }
    empty.classList.add('hidden'); empty.classList.remove('flex');

    lista.forEach((cuenta, ci) => {
        const dias = calcularDias(cuenta.fecha);
        let bordColor='border-impakto-gray/20', badgeClass='bg-impakto-dark text-impakto-light border-impakto-gray/30', estadoTxt='Activa';
        if (dias<0){bordColor='border-red-500/30';badgeClass='bg-red-900/40 text-red-400 border-red-500/50';estadoTxt='Vencida';}
        else if(dias<=5){bordColor='border-yellow-500/30';badgeClass='bg-yellow-900/40 text-yellow-400 border-yellow-500/50';estadoTxt='Próximo';}

        const teles = cuenta.teles || [];
        const telesHTML = teles.map((t,ti) => {
            const pagBadge = t.pagado
                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-900/40 text-green-400 border border-green-500/50">Abonado</span>`
                : `<button onclick="marcarPagadoTele('${cuenta.id}',${ti})" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-impakto-dark text-impakto-gray border border-impakto-gray/30 hover:border-green-500/50 hover:text-green-400 transition-all" title="Marcar como pagado"><i class="fas fa-check mr-1"></i>Cobrar</button>`;
            return `<div class="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 border-b border-impakto-dark/60 last:border-0">
                <div class="flex items-center gap-2 min-w-[120px]">
                    <div class="w-7 h-7 rounded-full bg-impakto-red/10 border border-impakto-red/30 flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-tv text-impakto-red text-[10px]"></i>
                    </div>
                    <span class="text-sm font-medium text-white">${t.nombre||'Sin nombre'}</span>
                </div>
                ${t.telefono?`<span class="text-xs text-impakto-gray flex items-center gap-1"><i class="fas fa-phone text-[10px]"></i>${t.telefono}</span>`:''}
                ${t.direccion?`<span class="text-xs text-impakto-gray flex items-center gap-1 max-w-[180px] truncate"><i class="fas fa-map-marker-alt text-[10px]"></i>${t.direccion}</span>`:''}
                <span class="text-xs text-green-400 font-medium">${t.cuotas||0} cuotas</span>
                <span class="text-xs ${(t.deuda||0)>0?'text-red-400 font-bold':'text-impakto-gray'}">$${t.deuda||0} deuda</span>
                ${pagBadge}
                <button onclick="abrirModalTele('${cuenta.id}',${ti})" class="text-impakto-gray hover:text-blue-400 transition-colors text-xs ml-auto" title="Editar tele"><i class="fas fa-edit"></i></button>
            </div>`;
        }).join('');

        const card = document.createElement('div');
        card.className = `glass-panel rounded-2xl border ${bordColor} overflow-hidden transition-all hover:shadow-lg`;
        card.innerHTML = `
            <div class="flex items-center justify-between p-4 border-b border-impakto-dark/50">
                <div class="flex items-center gap-3">
                    ${cuenta.foto?`<img src="${cuenta.foto}" class="table-avatar" alt="Avatar">`:`<div class="table-avatar bg-impakto-dark flex items-center justify-center"><i class="fas fa-user text-impakto-gray"></i></div>`}
                    <div>
                        <div class="font-bold text-white text-sm">${cuenta.email}</div>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-[10px] text-impakto-gray bg-impakto-dark px-1.5 py-0.5 rounded border border-impakto-gray/20">${teles.length} TV${teles.length!==1?'s':''}</span>
                            <span class="text-xs ${cuenta.tipo==='multiple'?'text-purple-400':'text-blue-400'}">${cuenta.tipo==='multiple'?'Múltiple':'Individual'}</span>
                            ${cuenta.nota?`<span class="text-[10px] text-impakto-gray truncate max-w-[100px]">${cuenta.nota}</span>`:''}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-right hidden sm:block">
                        <div class="text-xs text-impakto-gray">Vence</div>
                        <div class="text-sm font-medium text-impakto-light">${fmtFecha(cuenta.fecha)}</div>
                        ${dias<=5&&dias>=0?`<div class="text-[10px] text-yellow-500 animate-pulse font-bold">${dias===0?'Vence HOY':`${dias}d restantes`}</div>`:''}
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-xs font-medium border ${badgeClass}">${estadoTxt}</span>
                    <button onclick="editarCuenta('${cuenta.id}')" class="text-impakto-gray hover:text-blue-400 transition-colors p-1.5" title="Editar cuenta"><i class="fas fa-edit"></i></button>
                    <button onclick="eliminarCuenta('${cuenta.id}')" class="text-impakto-gray hover:text-impakto-red transition-colors p-1.5" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            <div class="px-4 py-1">
                ${telesHTML || '<p class="text-impakto-gray text-xs py-3">No hay teles asignadas.</p>'}
            </div>`;
        cont.appendChild(card);
    });
}

document.getElementById('searchInput').addEventListener('input', e => renderizarCuentas(e.target.value));
document.getElementById('btnSort').addEventListener('click', () => {
    sortAsc = !sortAsc;
    document.getElementById('btnSort').querySelector('i').className = sortAsc?'fas fa-sort-amount-down':'fas fa-sort-amount-up';
    renderizarCuentas(document.getElementById('searchInput').value);
});

// --- FORMULARIO ABM ---
const form = document.getElementById('addForm');

form.addEventListener('submit', e => {
    e.preventDefault();
    leerTelesForm();
    const id = document.getElementById('editId').value;
    const obj = {
        email: document.getElementById('email').value,
        pass: document.getElementById('password').value,
        fecha: document.getElementById('fecha').value,
        nota: document.getElementById('nota').value,
        tipo: document.getElementById('tipo').value,
        foto: currentFotoBase64,
        teles: telesData.map(t=>({...t}))
    };

    if (id) {
        const idx = cuentas.findIndex(c=>String(c.id)===String(id));
        if (idx>-1) {
            const oldFecha = cuentas[idx].fecha;
            if (oldFecha!==obj.fecha) obj.teles.forEach(t=>t.pagado=false);
            cuentas[idx] = {...cuentas[idx], ...obj, foto: currentFotoBase64||cuentas[idx].foto};
            showToast('Cuenta actualizada correctamente');
        }
    } else {
        cuentas.push({id:Date.now(), ...obj});
        showToast('Cuenta agregada exitosamente');
    }

    guardarCuentas();
    resetForm();
    document.querySelector('[data-target="cuentas"]').click();
});

window.eliminarCuenta = function(id) {
    if(confirm('¿Eliminar esta cuenta?')) {
        cuentas = cuentas.filter(c=>String(c.id)!==String(id));
        guardarCuentas();
        showToast('Cuenta eliminada');
    }
};

window.editarCuenta = function(id) {
    const cuenta = cuentas.find(c=>String(c.id)===String(id));
    if(!cuenta) return;
    document.getElementById('editId').value = cuenta.id;
    document.getElementById('email').value = cuenta.email;
    document.getElementById('password').value = cuenta.pass;
    document.getElementById('fecha').value = cuenta.fecha;
    document.getElementById('nota').value = cuenta.nota||'';
    document.getElementById('tipo').value = cuenta.tipo||'individual';
    document.getElementById('txtSubmitAdd').textContent = 'Guardar Cambios';
    document.getElementById('btnCancelAdd').classList.remove('hidden');
    document.getElementById('formTitle').textContent = 'Editar Cuenta';
    currentFotoBase64 = cuenta.foto||'';
    if(cuenta.foto) document.getElementById('previewContainer').innerHTML=`<img src="${cuenta.foto}" id="previewImg">`;
    telesData = (cuenta.teles||[]).map(t=>({...t}));
    renderizarTelesForm();
    document.querySelector('[data-target="agregar"]').click();
};

window.marcarPagadoTele = function(cuentaId, teleIdx) {
    const c = cuentas.find(x=>String(x.id)===String(cuentaId));
    if(c && c.teles[teleIdx]) {
        const nombre = c.teles[teleIdx].nombre || 'el cliente';
        c.teles[teleIdx].pagado = true;
        c.teles[teleIdx].cuotas = (c.teles[teleIdx].cuotas||0)+1;
        c.teles[teleIdx].deuda = 0;
        guardarCuentas();
        alert(`¡Pago registrado!\n\n"Gracias por abonar ${nombre}, tu mensualidad ya fue registrada. Gracias por contar con nosotros, disfruta de todo el contenido en tu tele. ¡Feliz cliente!"`);
        showToast(`Pago de ${nombre} registrado`);
    }
};

// --- MODAL EDITAR TELE ---
window.abrirModalTele = function(cuentaId, teleIdx) {
    const c = cuentas.find(x=>String(x.id)===String(cuentaId));
    if(!c||!c.teles[teleIdx]) return;
    const t = c.teles[teleIdx];
    document.getElementById('modalCuentaId').value = cuentaId;
    document.getElementById('modalTeleIndex').value = teleIdx;
    document.getElementById('modalNombre').value = t.nombre||'';
    document.getElementById('modalTelefono').value = t.telefono||'';
    document.getElementById('modalDireccion').value = t.direccion||'';
    document.getElementById('modalCuotas').value = t.cuotas||0;
    document.getElementById('modalDeuda').value = t.deuda||0;
    document.getElementById('modalEditTele').classList.remove('hidden');
    document.getElementById('modalEditTele').classList.add('flex');
};

window.cerrarModalTele = function() {
    document.getElementById('modalEditTele').classList.add('hidden');
    document.getElementById('modalEditTele').classList.remove('flex');
};

window.guardarModalTele = function() {
    const cuentaId = document.getElementById('modalCuentaId').value;
    const teleIdx = parseInt(document.getElementById('modalTeleIndex').value);
    const c = cuentas.find(x=>String(x.id)===String(cuentaId));
    if(!c||!c.teles[teleIdx]) return;
    c.teles[teleIdx].nombre = document.getElementById('modalNombre').value;
    c.teles[teleIdx].telefono = document.getElementById('modalTelefono').value;
    c.teles[teleIdx].direccion = document.getElementById('modalDireccion').value;
    c.teles[teleIdx].cuotas = parseInt(document.getElementById('modalCuotas').value)||0;
    c.teles[teleIdx].deuda = parseInt(document.getElementById('modalDeuda').value)||0;
    guardarCuentas();
    cerrarModalTele();
    showToast('Tele actualizada correctamente');
};

document.getElementById('btnCancelAdd').addEventListener('click', resetForm);

function resetForm() {
    form.reset();
    document.getElementById('editId').value='';
    document.getElementById('txtSubmitAdd').textContent='Cargar Cuenta';
    document.getElementById('btnCancelAdd').classList.add('hidden');
    document.getElementById('formTitle').textContent='Agregar Nueva Cuenta';
    document.getElementById('password').type='password';
    document.querySelector('.toggle-pwd i').className='fas fa-eye';
    currentFotoBase64='';
    document.getElementById('previewContainer').innerHTML='<i class="fas fa-image text-2xl text-impakto-gray"></i>';
    telesData=[{nombre:'',telefono:'',direccion:'',cuotas:0,deuda:0,pagado:false}];
    renderizarTelesForm();
}

function actualizarUI() {
    if(document.getElementById('dashboard').classList.contains('active')) actualizarDashboard();
    if(document.getElementById('cuentas').classList.contains('active')) renderizarCuentas(document.getElementById('searchInput').value);
    if(document.getElementById('alertas').classList.contains('active')) renderizarAlertas();
    actualizarBadgeAlertas();
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    telesData=[{nombre:'',telefono:'',direccion:'',cuotas:0,deuda:0,pagado:false}];
    renderizarTelesForm();
    actualizarDashboard();
    actualizarBadgeAlertas();

    setTimeout(()=>{
        const loader=document.getElementById('loader');
        loader.style.opacity='0';
        setTimeout(()=>loader.style.display='none',500);
    },1800);

    document.getElementById('fotoInput').addEventListener('change', function(e) {
        const file=e.target.files[0];
        if(file){
            const r=new FileReader();
            r.onload=ev=>{
                currentFotoBase64=ev.target.result;
                document.getElementById('previewContainer').innerHTML=`<img src="${currentFotoBase64}" id="previewImg">`;
            };
            r.readAsDataURL(file);
        }
    });
});

// =============================================
// --- SISTEMA DE ALERTAS WHATSAPP ---
// =============================================

let filtroAlertaActual = 'todos';

// Limpiar número de teléfono para WhatsApp (solo dígitos, agregar código país si falta)
function limpiarTelefono(tel) {
    if (!tel) return '';
    let num = tel.replace(/[^0-9]/g, '');
    // Si empieza con 15 o con un número local argentino, agregar 54
    if (num.length === 10) num = '54' + num;
    else if (num.length === 11 && num.startsWith('0')) num = '54' + num.substring(1);
    else if (num.length < 10) return ''; // número inválido
    return num;
}

// Generar mensaje personalizado según los días restantes
function generarMensajeWhatsApp(nombre, dias, fechaVenc) {
    const nombreCliente = nombre || 'cliente';
    const fechaFormateada = fmtFecha(fechaVenc);

    if (dias < 0) {
        const diasVencidos = Math.abs(dias);
        return `Hola ${nombreCliente} 👋\n\nTe informamos que tu suscripción de *IMPAKTO TV* venció hace *${diasVencidos} día${diasVencidos!==1?'s':''}* (${fechaFormateada}).\n\n⚠️ Tu servicio puede ser suspendido en cualquier momento.\n\nPor favor, comunicate con nosotros para renovar y seguir disfrutando de todo el contenido. 📺\n\n¡Gracias por elegirnos! 🙌\n_IMPAKTO TV_`;
    }
    if (dias === 0) {
        return `Hola ${nombreCliente} 👋\n\n🔴 Tu suscripción de *IMPAKTO TV* *VENCE HOY* (${fechaFormateada}).\n\nPara no perder el acceso al contenido, te pedimos que abones tu cuota hoy mismo.\n\n📺 ¡Seguí disfrutando sin interrupciones!\n\n¡Gracias por elegirnos! 🙌\n_IMPAKTO TV_`;
    }
    if (dias <= 3) {
        return `Hola ${nombreCliente} 👋\n\n🟡 Tu suscripción de *IMPAKTO TV* vence en *${dias} día${dias!==1?'s':''}* (${fechaFormateada}).\n\n¡No te quedes sin tu contenido favorito! Aboná antes del vencimiento para seguir disfrutando. 📺\n\n¡Gracias por elegirnos! 🙌\n_IMPAKTO TV_`;
    }
    return `Hola ${nombreCliente} 👋\n\n📢 Te recordamos que tu suscripción de *IMPAKTO TV* vence el *${fechaFormateada}* (en ${dias} días).\n\nAboná con tiempo para no perder el acceso. 📺\n\n¡Gracias por ser parte de IMPAKTO TV! 🙌\n_IMPAKTO TV_`;
}

// Abrir WhatsApp con mensaje prellenado
window.enviarWhatsApp = function(telefono, nombre, dias, fecha) {
    const num = limpiarTelefono(telefono);
    if (!num) {
        showToast('Este cliente no tiene teléfono cargado', true);
        return;
    }
    const msg = generarMensajeWhatsApp(nombre, dias, fecha);
    const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    // Registrar que ya se envió
    registrarEnvio(telefono);
    showToast(`WhatsApp abierto para ${nombre || 'cliente'}`);
};

// Registrar envíos para no repetir
function registrarEnvio(telefono) {
    const enviados = JSON.parse(localStorage.getItem('impakto_wsp_enviados') || '{}');
    const hoy = new Date().toISOString().split('T')[0];
    enviados[telefono] = hoy;
    localStorage.setItem('impakto_wsp_enviados', JSON.stringify(enviados));
}

function yaEnviadoHoy(telefono) {
    const enviados = JSON.parse(localStorage.getItem('impakto_wsp_enviados') || '{}');
    const hoy = new Date().toISOString().split('T')[0];
    return enviados[telefono] === hoy;
}

// Obtener lista de alertas (clientes con vencimiento ≤7 días o vencidos)
function obtenerAlertas() {
    const alertas = [];
    cuentas.forEach(cuenta => {
        const dias = calcularDias(cuenta.fecha);
        if (dias <= 7) {
            (cuenta.teles || []).forEach((tele, ti) => {
                if (!tele.pagado) {
                    alertas.push({
                        cuentaId: cuenta.id,
                        email: cuenta.email,
                        fecha: cuenta.fecha,
                        dias: dias,
                        teleIdx: ti,
                        nombre: tele.nombre || 'Sin nombre',
                        telefono: tele.telefono || '',
                        direccion: tele.direccion || '',
                        enviado: yaEnviadoHoy(tele.telefono)
                    });
                }
            });
        }
    });
    alertas.sort((a, b) => a.dias - b.dias);
    return alertas;
}

// Actualizar badge en sidebar
function actualizarBadgeAlertas() {
    const badge = document.getElementById('alertaBadge');
    if (!badge) return;
    const alertas = obtenerAlertas();
    const pendientes = alertas.filter(a => !a.enviado).length;
    if (pendientes > 0) {
        badge.textContent = pendientes;
        badge.classList.remove('hidden');
        badge.classList.add('flex');
    } else {
        badge.classList.add('hidden');
        badge.classList.remove('flex');
    }
}

// Filtrar alertas
window.filtrarAlertas = function(tipo) {
    filtroAlertaActual = tipo;
    // Actualizar estilos de botones
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.classList.remove('active-filtro', 'border-green-500/50', 'bg-green-500/10', 'text-green-400');
        btn.classList.add('border-impakto-gray/20', 'text-impakto-light');
    });
    const activeBtn = document.getElementById(`filtro-${tipo}`);
    if (activeBtn) {
        activeBtn.classList.add('active-filtro', 'border-green-500/50', 'bg-green-500/10', 'text-green-400');
        activeBtn.classList.remove('border-impakto-gray/20', 'text-impakto-light');
    }
    renderizarAlertas();
};

// Enviar a todos los pendientes uno por uno
window.enviarTodosWhatsApp = function() {
    let alertas = obtenerAlertas().filter(a => !a.enviado && a.telefono);
    if (filtroAlertaActual === 'critico') alertas = alertas.filter(a => a.dias <= 3);
    else if (filtroAlertaActual === 'urgente') alertas = alertas.filter(a => a.dias > 3 && a.dias <= 7);
    else if (filtroAlertaActual === 'vencidas') alertas = alertas.filter(a => a.dias < 0);

    if (!alertas.length) {
        showToast('No hay mensajes pendientes para enviar', true);
        return;
    }

    if (!confirm(`Se abrirán ${alertas.length} ventanas de WhatsApp.\n¿Continuar?`)) return;

    let delay = 0;
    alertas.forEach(a => {
        setTimeout(() => {
            enviarWhatsApp(a.telefono, a.nombre, a.dias, a.fecha);
        }, delay);
        delay += 1500;
    });
};

// Renderizar cards de alertas
function renderizarAlertas() {
    const cont = document.getElementById('alertasContainer');
    const empty = document.getElementById('alertasEmpty');
    if (!cont) return;
    cont.innerHTML = '';

    let alertas = obtenerAlertas();

    // Aplicar filtro
    if (filtroAlertaActual === 'critico') alertas = alertas.filter(a => a.dias >= 0 && a.dias <= 3);
    else if (filtroAlertaActual === 'urgente') alertas = alertas.filter(a => a.dias > 3 && a.dias <= 7);
    else if (filtroAlertaActual === 'vencidas') alertas = alertas.filter(a => a.dias < 0);

    if (!alertas.length) {
        empty.classList.remove('hidden'); empty.classList.add('flex');
        return;
    }
    empty.classList.add('hidden'); empty.classList.remove('flex');

    alertas.forEach(a => {
        let urgColor, urgIcon, urgText, urgBorder;
        if (a.dias < 0) {
            urgColor = 'text-red-400'; urgIcon = 'fa-times-circle'; urgText = `Venció hace ${Math.abs(a.dias)}d`; urgBorder = 'border-red-500/30';
        } else if (a.dias === 0) {
            urgColor = 'text-red-500'; urgIcon = 'fa-fire'; urgText = '¡VENCE HOY!'; urgBorder = 'border-red-500/50';
        } else if (a.dias <= 3) {
            urgColor = 'text-yellow-400'; urgIcon = 'fa-exclamation-triangle'; urgText = `${a.dias}d restantes`; urgBorder = 'border-yellow-500/30';
        } else {
            urgColor = 'text-blue-400'; urgIcon = 'fa-bell'; urgText = `${a.dias}d restantes`; urgBorder = 'border-blue-500/30';
        }

        const enviadoBadge = a.enviado
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-900/40 text-green-400 border border-green-500/50 flex items-center gap-1"><i class="fas fa-check"></i>Enviado hoy</span>`
            : '';

        const card = document.createElement('div');
        card.className = `glass-panel rounded-2xl border ${urgBorder} p-4 transition-all hover:shadow-lg`;
        card.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center gap-4">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-11 h-11 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                        <i class="fab fa-whatsapp text-green-400 text-lg"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-white text-sm">${a.nombre}</span>
                            <span class="${urgColor} text-xs font-semibold flex items-center gap-1"><i class="fas ${urgIcon} text-[10px]"></i>${urgText}</span>
                            ${enviadoBadge}
                        </div>
                        <div class="flex items-center gap-3 mt-1 text-xs text-impakto-gray">
                            ${a.telefono ? `<span class="flex items-center gap-1"><i class="fas fa-phone text-[10px]"></i>${a.telefono}</span>` : '<span class="text-red-400">Sin teléfono</span>'}
                            <span class="flex items-center gap-1"><i class="fas fa-calendar text-[10px]"></i>${fmtFecha(a.fecha)}</span>
                            <span class="truncate max-w-[120px]">${a.email}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button onclick="previsualizarMensaje('${a.nombre.replace(/'/g,"\\'")}',${a.dias},'${a.fecha}')" class="px-3 py-2 rounded-xl text-xs font-medium bg-impakto-dark text-impakto-light border border-impakto-gray/20 hover:border-impakto-red/50 hover:text-white transition-all flex items-center gap-1" title="Ver mensaje">
                        <i class="fas fa-eye"></i><span class="hidden sm:inline">Ver</span>
                    </button>
                    <button onclick="enviarWhatsApp('${a.telefono}','${a.nombre.replace(/'/g,"\\'")}',${a.dias},'${a.fecha}')" class="px-4 py-2 rounded-xl text-sm font-semibold ${a.telefono ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(74,222,128,0.3)]' : 'bg-gray-700 text-gray-400 cursor-not-allowed'} transition-all flex items-center gap-2" ${!a.telefono ? 'disabled' : ''}>
                        <i class="fab fa-whatsapp"></i> Enviar
                    </button>
                </div>
            </div>`;
        cont.appendChild(card);
    });
}

// Previsualizar mensaje
window.previsualizarMensaje = function(nombre, dias, fecha) {
    const msg = generarMensajeWhatsApp(nombre, dias, fecha);
    alert('📱 Vista previa del mensaje:\n\n' + msg);
};
