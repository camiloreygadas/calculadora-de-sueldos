// --- INICIALIZACIÓN DE FIREBASE (MÓDULO) ---
// Importa las funciones que necesitas desde los SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ▼▼▼ PEGA AQUÍ TU OBJETO firebaseConfig QUE COPIASTE DE LA CONSOLA DE FIREBASE ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyAxpejPWMOZEgKF8POl27KpaeKLk3BTbqE",
  authDomain: "calculadora-sueldos-compartida.firebaseapp.com",
  projectId: "calculadora-sueldos-compartida",
  storageBucket: "calculadora-sueldos-compartida.firebasestorage.app",
  messagingSenderId: "937496000961",
  appId: "1:937496000961:web:b62a7cf0f781c66b4ed740"
};
// ▲▲▲ NO OLVIDES PEGAR TU CONFIGURACIÓN ARRIBA ▲▲▲

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Nuestra conexión a la base de datos Firestore


// --- VARIABLES GLOBALES Y CONSTANTES ---
let SUELDO_MINIMO, VALOR_UF, TOPE_GRATIFICACION_IMM, TOPE_AFP_UF, TOPE_IPS_UF, TOPE_CESANTIA_UF;
let tablasImpuesto = [], tablasImpuestoOriginal = [];
const TABLA_IMPUESTO_EN_UTM = [
    { hasta: 13.5, factor: 0, rebaja: 0 }, { hasta: 30, factor: 0.04, rebaja: 0.54 },
    { hasta: 50, factor: 0.08, rebaja: 1.74 }, { hasta: 70, factor: 0.135, rebaja: 4.49 },
    { hasta: 90, factor: 0.23, rebaja: 11.14 }, { hasta: 120, factor: 0.304, rebaja: 17.8 },
    { hasta: 310, factor: 0.35, rebaja: 23.6 }, { hasta: 99999, factor: 0.4, rebaja: 39.1 }
];
const cargosPredefinidos = [
    { cargo: 'CAPATAZ MEC-CAÑ-ELEC', liquido: 1260000 },{ cargo: 'SOLDADOR CAÑ I (TIG)', liquido: 1780000 },{ cargo: 'SOLDADOR CAÑ II/PLANCHA I (7018)', liquido: 1330000 },{ cargo: 'SOLDADOR PLII/CAÑ III (4G)', liquido: 1120000 },{ cargo: 'MM ESTR/MEC/CAÑ/ELEC/MANT.', liquido: 1260093 },{ cargo: 'M1ª ESTR/MEC/CAÑ/ELEC/ RIGGER', liquido: 1099881 },{ cargo: 'M2ª ESTR/MEC/CAÑ/ELEC', liquido: 887469 },{ cargo: 'AYUDANTE MONTAJE', liquido: 590000 },{ cargo: 'ESPECIALIDAD OBRAS CIVILES', liquido: 1500000 },{ cargo: 'CAPATAZ OOCC', liquido: 1340033 },{ cargo: 'M1ª OOCC', liquido: 1115038 },{ cargo: 'M2 OOCC', liquido: 700000 },{ cargo: 'AYUDANTE OO.CC./ALARIFE/SERENO', liquido: 296923 },{ cargo: 'BODEGUERO / PAÑOLERO', liquido: 1000000 },{ cargo: 'CHOFER CAMIONETA', liquido: 1000000 },{ cargo: 'RIGGER', liquido: 1200000 },{ cargo: 'ELECTRICO / MECANICO MANTENCION', liquido: 1200000 },{ cargo: 'OPERADOR CAMION PLUMA', liquido: 1300000 },{ cargo: 'CHOFER CAMION 3/4', liquido: 1100000 },{ cargo: 'PREVENCIONISTA', liquido: 1500000 },{ cargo: 'PROGRAMADOR', liquido: 2000000 }
];
let TOPE_GRATIFICACION_MENSUAL, TOPE_AFP_PESOS, TOPE_IPS_PESOS, TOPE_CESANTIA_PESOS;

// --- INICIALIZACIÓN DE LA APLICACIÓN ---
window.onload = function() {
    // UI Setup
    generarTablaImpuestosHTML();
    restaurarValoresDefaultImpuestos();
    cargarCargosPredefinidos();
    actualizarParametros();
    actualizarSelectorPerfiles();
    
    // Theme setup
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    themeToggle.addEventListener('click', toggleTheme);

    // Set default month for tax table
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    document.getElementById('mesTablaImpuestos').value = `${year}-${month}`;

    // Fetch initial data
    fetchUfHoy();
};

// Exponer funciones al objeto window para que los `onclick` del HTML funcionen
Object.assign(window, {
    showTab,
    calcularIndividual,
    calcularMasivo,
    calcularDirecto,
    agregarCargo,
    actualizarPorcentajeAFP,
    actualizarVisibilidadBono,
    actualizarParametros,
    buscarUfPorFechaSeleccionada,
    fetchUfHoy,
    cargarTablaImpuestosHistorica,
    restaurarValoresDefaultImpuestos,
    validarInput,
    guardarPerfil,
    cargarPerfil,
    borrarPerfil,
    exportarExcel,
    exportarPDF
});

// --- LÓGICA DE NAVEGACIÓN (TABS) ---
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// --- LÓGICA DE TEMA (MODO OSCURO) ---
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('theme-toggle').textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

// --- LÓGICA DE PERFILES (FIREBASE) ---
async function guardarPerfil() {
    const profileNameInput = document.getElementById('profileNameInput');
    const profileName = profileNameInput.value.trim();
    if (!profileName) {
        alert('Por favor, ingrese un nombre para el perfil.');
        return;
    }

    const config = {
        afp: document.getElementById('afp').value,
        salud: document.getElementById('salud').value,
        tipoContrato: document.getElementById('tipoContrato').value,
        tipoBono: document.getElementById('tipoBono').value,
        valorBono: document.getElementById('valorBono').value,
        bonoColacion: document.getElementById('bonoColacion').value,
        bonoMovilizacion: document.getElementById('bonoMovilizacion').value
    };

    try {
        await setDoc(doc(db, "perfiles", profileName), config);
        alert(`✅ Perfil "${profileName}" guardado correctamente.`);
        profileNameInput.value = '';
        actualizarSelectorPerfiles();
    } catch (error) {
        console.error("Error al guardar el perfil: ", error);
        alert("Hubo un error al guardar el perfil.");
    }
}

async function cargarPerfil() {
    const selector = document.getElementById('profileSelector');
    const profileName = selector.value;
    if (!profileName) return;

    try {
        const docRef = doc(db, "perfiles", profileName);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const config = docSnap.data();
            document.getElementById('afp').value = config.afp || '10';
            document.getElementById('salud').value = config.salud || '7';
            document.getElementById('tipoContrato').value = config.tipoContrato || '0.6';
            document.getElementById('tipoBono').value = config.tipoBono || 'sin';
            document.getElementById('valorBono').value = config.valorBono || '';
            document.getElementById('bonoColacion').value = config.bonoColacion || '';
            document.getElementById('bonoMovilizacion').value = config.bonoMovilizacion || '';
            
            actualizarVisibilidadBono();
            actualizarParametros();
            alert(`✅ Perfil "${profileName}" cargado.`);
        }
    } catch (error) {
        console.error("Error al cargar el perfil: ", error);
        alert("Hubo un error al cargar el perfil.");
    }
}

async function borrarPerfil() {
    const selector = document.getElementById('profileSelector');
    const profileName = selector.value;
    if (!profileName) return;

    if (confirm(`¿Estás seguro de que quieres borrar el perfil "${profileName}"? Esta acción es irreversible.`)) {
        try {
            await deleteDoc(doc(db, "perfiles", profileName));
            alert(`🗑️ Perfil "${profileName}" borrado.`);
            actualizarSelectorPerfiles();
        } catch (error) {
            console.error("Error al borrar el perfil: ", error);
            alert("Hubo un error al borrar el perfil.");
        }
    }
}

async function actualizarSelectorPerfiles() {
    const selector = document.getElementById('profileSelector');
    selector.innerHTML = '<option value="">Seleccionar perfil...</option>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "perfiles"));
        querySnapshot.forEach((doc) => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.id;
            selector.appendChild(option);
        });
    } catch (error) {
        console.error("Error al obtener perfiles: ", error);
    }
}


// --- FUNCIONES DE CÁLCULO ---
function calcularDesdeBase(sueldoBase) {
    const afp = parseFloat(document.getElementById('afp').value) / 100;
    const salud = parseFloat(document.getElementById('salud').value) / 100;
    const cesantia = parseFloat(document.getElementById('tipoContrato').value) / 100;
    const tipoBono = document.getElementById('tipoBono').value;
    const valorBono = parseFloat(document.getElementById('valorBono').value) || 0;
    const colacion = parseFloat(document.getElementById('bonoColacion').value) || 0;
    const movilizacion = parseFloat(document.getElementById('bonoMovilizacion').value) || 0;

    let bono = 0;
    if (tipoBono === 'fijo') bono = valorBono;
    else if (tipoBono === 'porcentaje') bono = sueldoBase * (valorBono / 100);
    
    const gratificacion = Math.min(sueldoBase * 0.25, TOPE_GRATIFICACION_MENSUAL);
    const totalImponible = sueldoBase + gratificacion + bono;

    const baseAFP = Math.min(totalImponible, TOPE_AFP_PESOS);
    const baseSalud = Math.min(totalImponible, TOPE_AFP_PESOS);
    const baseCesantia = Math.min(totalImponible, TOPE_CESANTIA_PESOS);
    
    const descAFP = baseAFP * afp;
    const descSalud = baseSalud * salud;
    const descCesantia = baseCesantia * cesantia;
    const totalDescPrev = descAFP + descSalud + descCesantia;
    
    const baseTributable = totalImponible - totalDescPrev;
    const impuesto = calcularImpuesto(baseTributable);
    const totalDescuentos = totalDescPrev + impuesto;
    const liquidoImponible = totalImponible - totalDescuentos;
    const liquidoFinal = liquidoImponible + colacion + movilizacion;

    return { sueldoBase, gratificacion, bono, totalImponible, afp: descAFP, salud: descSalud, cesantia: descCesantia, impuesto, totalDescuentos, colacion, movilizacion, liquidoCalculado: liquidoFinal };
}

function calcularSueldoBaseInverso(liquidoPagoDeseado) {
    const colacion = parseFloat(document.getElementById('bonoColacion').value) || 0;
    const movilizacion = parseFloat(document.getElementById('bonoMovilizacion').value) || 0;
    const liquidoImponibleDeseado = liquidoPagoDeseado - colacion - movilizacion;
    if (liquidoImponibleDeseado <= 0) {
        alert("El líquido deseado es menor que los haberes no imponibles. No se puede calcular.");
        return null;
    }

    let min = 0, max = liquidoImponibleDeseado * 2.5, mejorBase = 0, mejorDiferencia = Infinity;
    
    for (let i = 0; i < 100; i++) {
        const sueldoBasePrueba = (min + max) / 2;
        const resultadoPrueba = calcularDesdeBase(sueldoBasePrueba);
        const liquidoImponibleCalculado = resultadoPrueba.liquidoCalculado - resultadoPrueba.colacion - resultadoPrueba.movilizacion;
        const diferencia = Math.abs(liquidoImponibleCalculado - liquidoImponibleDeseado);
        
        if (diferencia < mejorDiferencia) {
            mejorDiferencia = diferencia;
            mejorBase = sueldoBasePrueba;
        }
        
        if (liquidoImponibleCalculado < liquidoImponibleDeseado) min = sueldoBasePrueba; 
        else max = sueldoBasePrueba;
        
        if (mejorDiferencia <= 1) break;
    }
    
    return calcularDesdeBase(mejorBase);
}

function calcularImpuesto(baseTributable) {
    if (!tablasImpuesto || tablasImpuesto.length === 0) return 0;
    for (let tramo of tablasImpuesto) {
        if (baseTributable >= tramo.desde && baseTributable <= tramo.hasta) {
            return (baseTributable * tramo.factor) - tramo.rebaja;
        }
    }
    return 0;
}

// --- MANEJADORES DE EVENTOS Y UI ---
function calcularDirecto(event) {
    const btn = event.currentTarget;
    const input = document.getElementById('baseDirecto');
    if (!validarInput(input)) return;
    
    toggleButtonLoading(btn, true);
    setTimeout(() => {
        const baseDirecto = parseFloat(input.value);
        const r = calcularDesdeBase(baseDirecto);
        document.getElementById('resultadoDirecto').innerHTML = generarHTMLResultado(r, r.sueldoBase);
        toggleButtonLoading(btn, false);
    }, 50);
}

function calcularIndividual(event) {
    const btn = event.currentTarget;
    const input = document.getElementById('liquidoIndividual');
    if (!validarInput(input)) return;

    toggleButtonLoading(btn, true);
    setTimeout(() => {
        const liquidoDeseado = parseFloat(input.value);
        const r = calcularSueldoBaseInverso(liquidoDeseado);
        if (r) {
            document.getElementById('resultadoIndividual').innerHTML = generarHTMLResultado(r, liquidoDeseado, true);
        }
        toggleButtonLoading(btn, false);
    }, 50);
}

function calcularMasivo(event) {
    const btn = event.currentTarget;
    toggleButtonLoading(btn, true);

    setTimeout(() => {
        const cargos = document.querySelectorAll('.cargo-input'), liquidos = document.querySelectorAll('.liquido-input');
        if (cargos.length === 0) {
            alert('Por favor agregue al menos un cargo');
            toggleButtonLoading(btn, false);
            return;
        }
        
        let html = `<div class="table-wrapper"><table class="result-table"><thead><tr><th>Cargo</th><th>Líquido Obj.</th><th>S. Base</th><th>Grat.</th><th>Bono</th><th>T. Imponible</th><th>AFP</th><th>Salud</th><th>Cesantía</th><th>Impuesto</th><th>T. Descuentos</th><th>Colación</th><th>Movil.</th><th>Líquido a Pago</th></tr></thead><tbody>`;
        let totalLiquidos = 0, totalBases = 0;

        for (let i = 0; i < cargos.length; i++) {
            const liquidoDeseado = parseFloat(liquidos[i].value);
            if (liquidoDeseado && liquidoDeseado > 0) {
                const r = calcularSueldoBaseInverso(liquidoDeseado);
                if (r) {
                    totalLiquidos += r.liquidoCalculado; totalBases += r.sueldoBase;
                    html += `<tr>
                        <td style="text-align: left; font-weight: 600;">${cargos[i].value || `Cargo ${i+1}`}</td>
                        <td>${formatMoney(liquidoDeseado)}</td>
                        <td style="background: var(--info-box-bg);">${formatMoney(r.sueldoBase)}</td>
                        <td>${formatMoney(r.gratificacion)}</td>
                        <td>${formatMoney(r.bono)}</td>
                        <td>${formatMoney(r.totalImponible)}</td>
                        <td>${formatMoney(r.afp)}</td>
                        <td>${formatMoney(r.salud)}</td>
                        <td>${formatMoney(r.cesantia)}</td>
                        <td>${formatMoney(r.impuesto)}</td>
                        <td style="font-weight: bold;">${formatMoney(r.totalDescuentos)}</td>
                        <td>${formatMoney(r.colacion)}</td>
                        <td>${formatMoney(r.movilizacion)}</td>
                        <td style="background: #d4edda; font-weight: bold; color: #155724;">${formatMoney(r.liquidoCalculado)}</td>
                    </tr>`;
                }
            }
        }
        html += `</tbody></table></div><div class="summary-box"><h3>Resumen Total</h3><div class="summary-grid"><div class="summary-item"><h3>Total Sueldos Base</h3><p>${formatMoney(totalBases)}</p></div><div class="summary-item"><h3>Total Líquidos Pagados</h3><p>${formatMoney(totalLiquidos)}</p></div></div></div><button class="btn-export" onclick="exportarExcel()">📥 Exportar a Excel</button><button class="btn-export" style="background: linear-gradient(135deg, #d32f2f 0%, #c2185b 100%);" onclick="exportarPDF()">📄 Exportar a PDF</button>`;
        document.getElementById('resultadoMasivo').innerHTML = html;
        toggleButtonLoading(btn, false);
    }, 50);
}

function generarHTMLResultado(r, objetivo, esInverso = false) {
    const cargo = esInverso ? document.getElementById('cargoIndividual').value : '';
    const objetivoLabel = esInverso ? "Líquido Objetivo" : "Sueldo Base";
    const resultadoPrincipalLabel = esInverso ? "Sueldo Base Calculado" : "Líquido Imponible";
    const resultadoPrincipalValor = esInverso ? r.sueldoBase : (r.liquidoCalculado - r.colacion - r.movilizacion);

    return `<div class="summary-box"><h3>Resultado para: ${cargo || 'Cálculo'}</h3><div class="summary-grid"><div class="summary-item"><h3>${objetivoLabel}</h3><p>${formatMoney(objetivo)}</p></div><div class="summary-item"><h3>${resultadoPrincipalLabel}</h3><p>${formatMoney(resultadoPrincipalValor)}</p></div><div class="summary-item"><h3>Líquido a Pago Real</h3><p>${formatMoney(r.liquidoCalculado)}</p></div></div></div>
    <table class="result-table">
        <tr><th colspan="2">Haberes</th></tr>
        <tr><td>Sueldo Base</td><td>${formatMoney(r.sueldoBase)}</td></tr>
        <tr><td>Gratificación</td><td>${formatMoney(r.gratificacion)}</td></tr>
        <tr><td>Bono (Imponible)</td><td>${formatMoney(r.bono)}</td></tr>
        <tr style="font-weight: bold;"><td>Total Imponible</td><td>${formatMoney(r.totalImponible)}</td></tr>
        <tr><th colspan="2">Descuentos</th></tr>
        <tr><td>AFP (-)</td><td>${formatMoney(r.afp)}</td></tr>
        <tr><td>Salud (-)</td><td>${formatMoney(r.salud)}</td></tr>
        <tr><td>Seguro Cesantía (-)</td><td>${formatMoney(r.cesantia)}</td></tr>
        <tr><td>Impuesto 2ª Categoría (-)</td><td>${formatMoney(r.impuesto)}</td></tr>
        <tr style="font-weight: bold;"><td>Total Descuentos</td><td>${formatMoney(r.totalDescuentos)}</td></tr>
        <tr><th colspan="2">Haberes No Imponibles</th></tr>
        <tr><td>Asig. Colación</td><td>${formatMoney(r.colacion)}</td></tr>
        <tr><td>Asig. Movilización</td><td>${formatMoney(r.movilizacion)}</td></tr>
        <tr style="background: #d4edda; color: #155724; font-weight: bold; font-size: 1.1em;"><td>SUELDO LÍQUIDO A PAGO</td><td>${formatMoney(r.liquidoCalculado)}</td></tr>
    </table>`;
}


// --- FUNCIONES AUXILIARES Y DE CONFIGURACIÓN ---
function actualizarParametros() {
    SUELDO_MINIMO = parseFloat(document.getElementById('sueldoMinimo').value) || 0;
    VALOR_UF = parseFloat(document.getElementById('valorUF').value) || 0;
    TOPE_GRATIFICACION_IMM = parseFloat(document.getElementById('topeGratificacion').value) || 0;
    TOPE_AFP_UF = parseFloat(document.getElementById('topeAFP').value) || 0;
    TOPE_IPS_UF = parseFloat(document.getElementById('topeIPS').value) || 0;
    TOPE_CESANTIA_UF = parseFloat(document.getElementById('topeCesantia').value) || 0;
    
    TOPE_GRATIFICACION_MENSUAL = (TOPE_GRATIFICACION_IMM * SUELDO_MINIMO) / 12;
    TOPE_AFP_PESOS = TOPE_AFP_UF * VALOR_UF;
    TOPE_IPS_PESOS = TOPE_IPS_UF * VALOR_UF;
    TOPE_CESANTIA_PESOS = TOPE_CESANTIA_UF * VALOR_UF;
    
    const display = document.getElementById('valoresCalculados');
    display.innerHTML = `<strong>Valores Calculados:</strong><br>
        Tope Gratificación Mensual: ${formatMoney(TOPE_GRATIFICACION_MENSUAL)}<br>
        Tope AFP y Salud en pesos: ${formatMoney(TOPE_AFP_PESOS)}<br>
        Tope IPS en pesos: ${formatMoney(TOPE_IPS_PESOS)}<br>
        Tope Cesantía en pesos: ${formatMoney(TOPE_CESANTIA_PESOS)}`;
}

function formatMoney(amount) {
    if (isNaN(amount)) return '$0';
    return '$' + Math.round(amount).toLocaleString('es-CL');
}

function actualizarPorcentajeAFP() {
    const select = document.getElementById('afpSeleccion');
    if (select.value !== 'manual') document.getElementById('afp').value = select.value;
}

function actualizarVisibilidadBono() {
    const tipoBono = document.getElementById('tipoBono').value;
    const valorBonoInput = document.getElementById('valorBono');
    valorBonoInput.style.display = (tipoBono === 'sin') ? 'none' : 'block';
    if (tipoBono === 'sin') valorBonoInput.value = '';
}

function validarInput(inputElement) {
    const value = inputElement.value;
    const errorEl = inputElement.nextElementSibling;
    if (value === '' || parseFloat(value) < 0) { // Permitir 0 pero no vacío o negativo
        inputElement.classList.add('input-error');
        errorEl.textContent = 'El valor debe ser un número válido.';
        return false;
    }
    inputElement.classList.remove('input-error');
    errorEl.textContent = '';
    return true;
}

function toggleButtonLoading(button, isLoading) {
    const text = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');
    if (isLoading) {
        button.disabled = true;
        text.classList.add('hidden');
        spinner.classList.remove('hidden');
    } else {
        button.disabled = false;
        text.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
}

function agregarCargo() {
    const container = document.getElementById('cargosContainer');
    const div = document.createElement('div');
    div.className = 'cargo-input-grid';
    div.innerHTML = `<div class="input-item"><input type="text" class="cargo-input" placeholder="Nombre del cargo"></div><div class="input-item"><input type="number" class="liquido-input" placeholder="Líquido deseado"></div><button class="btn-remove" onclick="this.parentElement.remove()">❌</button>`;
    container.appendChild(div);
}

function cargarCargosPredefinidos() {
    const container = document.getElementById('cargosContainer');
    container.innerHTML = '';
    cargosPredefinidos.forEach(item => {
        const div = document.createElement('div');
        div.className = 'cargo-input-grid';
        div.innerHTML = `<div class="input-item"><input type="text" class="cargo-input" value="${item.cargo}"></div><div class="input-item"><input type="number" class="liquido-input" value="${item.liquido}"></div><button class="btn-remove" onclick="this.parentElement.remove()">❌</button>`;
        container.appendChild(div);
    });
}

function setUfStatus(message, isError = false) {
    const statusEl = document.getElementById('ufStatus');
    statusEl.textContent = message;
    statusEl.style.color = isError ? 'var(--input-error-color)' : 'var(--btn-add-bg)';
}

async function fetchUf(fecha = null) {
    let url = 'https://mindicador.cl/api/uf';
    if (fecha) {
        const [year, month, day] = fecha.split('-');
        url = `https://mindicador.cl/api/uf/${day}-${month}-${year}`;
    }
    try {
        setUfStatus('(Cargando...)', false);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error de red al consultar API.');
        const data = await response.json();
        if (data.serie && data.serie.length > 0) {
            const valorUf = data.serie[0].valor;
            document.getElementById('valorUF').value = valorUf;
            actualizarParametros();
            const fechaMostrada = new Date(data.serie[0].fecha).toLocaleDateString('es-CL');
            setUfStatus(`(Valor para ${fechaMostrada})`, false);
        } else { throw new Error('No se encontró valor para la fecha.'); }
    } catch (error) {
        console.error('Error al buscar UF:', error);
        setUfStatus(`(${error.message})`, true);
    }
}

function fetchUfHoy() { fetchUf(); }
function buscarUfPorFechaSeleccionada() {
    const fecha = document.getElementById('fechaUF').value;
    if (fecha) fetchUf(fecha); else setUfStatus('(Seleccione una fecha)', true);
}

function setTablaStatus(message, isError = false) {
    const statusEl = document.getElementById('tablaImpuestosStatus');
    statusEl.textContent = message;
    statusEl.style.color = isError ? 'var(--input-error-color)' : 'var(--btn-add-bg)';
}

async function cargarTablaImpuestosHistorica() {
    const mesSeleccionado = document.getElementById('mesTablaImpuestos').value;
    if (!mesSeleccionado) {
        setTablaStatus('Por favor, seleccione un mes.', true);
        return;
    }
    const [year, month] = mesSeleccionado.split('-');
    const url = `https://mindicador.cl/api/utm/01-${month}-${year}`;

    try {
        setTablaStatus('Cargando valor UTM...', false);
        const response = await fetch(url);
        if (!response.ok) throw new Error('No se pudo obtener el valor de la UTM.');
        const data = await response.json();
        if (!data.serie || data.serie.length === 0) throw new Error('No hay datos de UTM para esa fecha.');
        const valorUTM = data.serie[0].valor;
        setTablaStatus(`UTM de ${month}/${year}: ${formatMoney(valorUTM)}`, false);

        let desdeAnterior = 0;
        TABLA_IMPUESTO_EN_UTM.forEach((tramo, index) => {
            const desdePesos = (desdeAnterior + 0.01);
            const hastaPesos = tramo.hasta * valorUTM;
            const rebajaPesos = tramo.rebaja * valorUTM;

            document.getElementById(`desde${index}`).value = (index === 0) ? 0 : desdePesos.toFixed(2);
            document.getElementById(`hasta${index}`).value = hastaPesos.toFixed(2);
            document.getElementById(`factor${index}`).value = tramo.factor;
            document.getElementById(`rebaja${index}`).value = rebajaPesos.toFixed(2);
            desdeAnterior = hastaPesos;
        });
        document.getElementById('hasta7').value = 999999999;
        actualizarTablaImpuestos();
    } catch (error) {
        console.error("Error al cargar tabla de impuestos:", error);
        setTablaStatus(error.message, true);
    }
}

function generarTablaImpuestosHTML() {
    let html = `<table class="result-table" id="tablaImpuestos"><thead><tr><th>Tramo</th><th>Desde ($)</th><th>Hasta ($)</th><th>Factor</th><th>Rebaja ($)</th></tr></thead><tbody>`;
    for (let i = 0; i < 8; i++) {
        html += `<tr><td>${i+1}</td>
            <td><input type="number" id="desde${i}" step="0.01" onchange="actualizarTablaImpuestos()"></td>
            <td><input type="number" id="hasta${i}" step="0.01" onchange="actualizarTablaImpuestos()"></td>
            <td><input type="number" id="factor${i}" step="0.001" onchange="actualizarTablaImpuestos()"></td>
            <td><input type="number" id="rebaja${i}" step="0.01" onchange="actualizarTablaImpuestos()"></td></tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('tablaImpuestosContainer').innerHTML = html;
}

function actualizarTablaImpuestos() {
    for (let i = 0; i < 8; i++) {
        tablasImpuesto[i] = {
            desde: parseFloat(document.getElementById(`desde${i}`).value) || 0,
            hasta: parseFloat(document.getElementById(`hasta${i}`).value) || 0,
            factor: parseFloat(document.getElementById(`factor${i}`).value) || 0,
            rebaja: parseFloat(document.getElementById(`rebaja${i}`).value) || 0
        };
    }
}

function restaurarValoresDefaultImpuestos() {
    const valoresDefault = [
        { desde: 0, hasta: 935077.50, factor: 0, rebaja: 0 }, { desde: 935077.51, hasta: 2077950, factor: 0.04, rebaja: 37403.10 },
        { desde: 2077950.01, hasta: 3463250, factor: 0.08, rebaja: 120521.10 }, { desde: 3463250.01, hasta: 4848550, factor: 0.135, rebaja: 310999.85 },
        { desde: 4848550.01, hasta: 6233850, factor: 0.23, rebaja: 771612.10 }, { desde: 6233850.01, hasta: 8311800, factor: 0.304, rebaja: 1232917 },
        { desde: 8311800.01, hasta: 21472150, factor: 0.35, rebaja: 1615259.80 }, { desde: 21472150.01, hasta: 999999999, factor: 0.4, rebaja: 2688867.30 }
    ];
    tablasImpuestoOriginal = JSON.parse(JSON.stringify(valoresDefault));
    valoresDefault.forEach((tramo, i) => {
        document.getElementById(`desde${i}`).value = tramo.desde;
        document.getElementById(`hasta${i}`).value = tramo.hasta;
        document.getElementById(`factor${i}`).value = tramo.factor;
        document.getElementById(`rebaja${i}`).value = tramo.rebaja;
    });
    actualizarTablaImpuestos();
}

function exportarExcel() {
    const table = document.querySelector('#resultadoMasivo table');
    if (!table) return alert('No hay datos para exportar');
    const ws = XLSX.utils.table_to_sheet(table, { raw: true });
    ws['!cols'] = Array.from({ length: table.rows[0].cells.length }, () => ({ wch: 15 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sueldos');
    XLSX.writeFile(wb, 'calculo_sueldos.xlsx');
}

function exportarPDF() {
    const table = document.querySelector('#resultadoMasivo table');
    if (!table) return alert('No hay datos para exportar a PDF');
    
    // La librería jsPDF ahora es importada al principio del módulo
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
    doc.setFontSize(16);
    doc.text('Reporte de Cálculo de Sueldos', 40, 50);
    // El plugin autoTable se adjunta automáticamente al prototipo de jsPDF
    doc.autoTable({
        html: '#resultadoMasivo table', startY: 70, theme: 'grid',
        headStyles: { fillColor: [220, 53, 69] },
        styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    });
    doc.save('reporte_sueldos.pdf');
}