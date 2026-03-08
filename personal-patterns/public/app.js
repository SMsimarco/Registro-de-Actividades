let registros = [];
let registrosFiltrados = [];
let filtroActual = 'todo';
let editandoId = null; 


// ====== CONFIGURACIÓN SUPABASE ======
const SUPABASE_URL = "https://ortxannsshuuxqcfkxlj.supabase.co/rest/v1/daily_logs";
const SUPABASE_KEY = "sb_publishable_zGauV0bkumP5Q0UI6pyxhQ_BIi6eQfR";

const supabaseHeaders = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY
};

// ====== CONEXIÓN A BASE DE DATOS EN LA NUBE ======
async function cargarRegistrosDesdeBD() {
    try {
        // Le pedimos a Supabase que traiga todos los registros ordenados por id
        const respuesta = await fetch(SUPABASE_URL + "?select=*&order=id.asc", { 
            headers: supabaseHeaders 
        });
        
        if (respuesta.ok) {
            const datos = await respuesta.json();
            registros = [];

            datos.forEach(d => {
                let jornadaDefinida = d.jornada || "No definida";
                registros.push({
                    id: d.id,
                    fecha: d.fecha, 
                    actividad: d.actividad,
                    jornada: jornadaDefinida,
                    energia: Number(d.energia),
                    enfoque: Number(d.enfoque),
                    animo: Number(d.animo)
                });
            });

            aplicarFiltro(); 
        }
    } catch (error) {
        console.error("Error conectando a Supabase", error);
    }
}

async function agregarRegistro(actividad, jornada, energia, enfoque, animo) {
    let fechaObj = new Date();
    fechaObj.setMinutes(fechaObj.getMinutes() - fechaObj.getTimezoneOffset());
    const fecha = fechaObj.toISOString().split('T')[0];
    
    try {
        const respuesta = await fetch(SUPABASE_URL, {
            method: "POST",
            headers: supabaseHeaders,
            body: JSON.stringify({ fecha, actividad, jornada, energia, enfoque, animo })
        });
        if (respuesta.ok) {
            await cargarRegistrosDesdeBD();
        }
    } catch (error) {
        console.error("Error guardando dato en Supabase", error);
    }
}

async function borrarRegistro(id) {
    let confirmacion = confirm("¿Seguro que querés borrar este registro?");
    if (confirmacion) {
        try {
            // Supabase usa el formato ?columna=eq.valor para borrar
            await fetch(`${SUPABASE_URL}?id=eq.${id}`, { 
                method: "DELETE",
                headers: supabaseHeaders
            });
            await cargarRegistrosDesdeBD();
        } catch (error) {
            console.error("Error borrando dato en Supabase", error);
        }
    }
}

async function modificarRegistro(id, actividad, jornada, energia, enfoque, animo) {
    let registroOriginal = registros.find(x => String(x.id) === String(id));
    let fecha = registroOriginal ? registroOriginal.fecha : new Date().toISOString().split('T')[0];
    
    try {
        // Supabase usa PATCH para actualizar
        const respuesta = await fetch(`${SUPABASE_URL}?id=eq.${id}`, {
            method: "PATCH",
            headers: supabaseHeaders,
            body: JSON.stringify({ fecha, actividad, jornada, energia, enfoque, animo })
        });
        if (respuesta.ok) {
            await cargarRegistrosDesdeBD();
        }
    } catch (error) {
        console.error("Error actualizando dato en Supabase", error);
    }
}

// calcular total
function calcularScore(r) {
    let promedio = (r.energia + r.enfoque + r.animo) / 3;
    return promedio * 10;
}


// ====== LÓGICA DE FILTROS GLOBALES ======
function cambiarFiltro(dias, boton) {
    filtroActual = dias;
    
    // UI de botones
    let botones = document.querySelectorAll('.btn-filtro');
    for (let i = 0; i < botones.length; i++) {
        botones[i].classList.remove('seleccionado');
    }
    boton.classList.add('seleccionado');
    
    aplicarFiltro();
}

function aplicarFiltro() {
    if (filtroActual === 'todo') {
        registrosFiltrados = [...registros];
    } else {
        let diasRestar = parseInt(filtroActual);
        let fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - diasRestar);
        let stringLimite = fechaLimite.toISOString().split('T')[0];

        registrosFiltrados = registros.filter(r => r.fecha >= stringLimite);
    }
    actualizarInterfaz();
}

// ====== MOTOR CENTRAL DE UI ======
function actualizarInterfaz() {
    generarRecomendacionCoach();
    mostrarScore();
    renderizarHistorial7Dias(); 
    mostrarComparacion();
    mostrarInsights();
    generarHeatmap();
    generarRutinaIdeal(); 
    generarImpactoEnergia();
    dibujarGraficoGlobal();
    mostrarHistorial();
    generarDashboardActividades();
    
    // Estas dos SIEMPRE miran el array global sin filtrar
    generarQuickTags();
    calcularRacha();
}

// ====== RECOMENDACIÓN DEL DÍA (COACH HUMANIZADO) ======
function generarRecomendacionCoach() {
    let contenedor = document.getElementById("recomendacionCoach");
    if (!contenedor) return;

    if (registrosFiltrados.length < 3) {
        contenedor.innerHTML = `<p class="texto-secundario">Registrá al menos 3 actividades en este período para darte consejos útiles.</p>`;
        return;
    }

    let resumen = {};
    for (let i = 0; i < registrosFiltrados.length; i++) {
        let r = registrosFiltrados[i];
        let clave = r.actividad + "|" + r.jornada;
        if (resumen[clave] === undefined) {
            resumen[clave] = { suma: 0, cantidad: 0 };
        }
        resumen[clave].suma += calcularScore(r);
        resumen[clave].cantidad += 1;
    }

    let mejorClave = "";
    let mejorPromedio = -1;
    let peorClave = "";
    let peorPromedio = 999;

    for (let clave in resumen) {
        let prom = resumen[clave].suma / resumen[clave].cantidad;
        if (prom > mejorPromedio) {
            mejorPromedio = prom;
            mejorClave = clave;
        }
        if (prom < peorPromedio) {
            peorPromedio = prom;
            peorClave = clave;
        }
    }

    let [mejorAct, mejorJor] = mejorClave.split("|");
    let [peorAct, peorJor] = peorClave.split("|");

    let frasesPositivas = [
        `Tu foco está al máximo cuando hacés <b>${mejorAct}</b> por la <b>${mejorJor}</b>. ¡Aprovechá ese impulso!`,
        `Los datos no mienten: la <b>${mejorJor}</b> es tu momento de oro para <b>${mejorAct}</b>.`,
        `Si querés asegurar el día, meté <b>${mejorAct}</b> durante la <b>${mejorJor}</b>. Es tu combinación ganadora.`
    ];

    let frasesNegativas = [
        `Cuidado: <b>${peorAct}</b> por la <b>${peorJor}</b> suele drenarte. ¿Podés moverlo de horario?`,
        `Noté fricción al hacer <b>${peorAct}</b> a la <b>${peorJor}</b>. Si podés, evitalo.`,
        `Tu energía cae cuando intentás <b>${peorAct}</b> por la <b>${peorJor}</b>. ¡Tenelo en cuenta!`
    ];

    let indicePositivo = new Date().getMilliseconds() % frasesPositivas.length;
    let indiceNegativo = new Date().getMilliseconds() % frasesNegativas.length;

    let html = `<p class="item-recomendacion">${frasesPositivas[indicePositivo]}</p>`;
                
    let esOtraActividad = mejorAct !== peorAct;
    let esOtraJornada = mejorJor !== peorJor;

    if (peorPromedio < 65 && (esOtraActividad || esOtraJornada)) {
        html += `<p class="item-recomendacion texto-secundario">${frasesNegativas[indiceNegativo]}</p>`;
    }

    contenedor.innerHTML = html;
}

// ====== SCORE VISUAL (RADIAL CHART ANIMATION) ======
function mostrarScore() {
    let contenedor = document.getElementById("score");
    let barraRadial = document.getElementById("scoreRadialBar");
    
    if (!contenedor) return;
    
    let circunferencia = 314.159;

    if (registrosFiltrados.length === 0) { 
        contenedor.innerText = "0%"; 
        if (barraRadial) barraRadial.style.strokeDashoffset = circunferencia;
        return; 
    }
    
    let ultimo = registrosFiltrados[registrosFiltrados.length - 1];
    let scoreCalculado = calcularScore(ultimo);
    
    contenedor.innerText = scoreCalculado.toFixed(0) + "%";
    
    if (barraRadial) {
        let offset = circunferencia - (scoreCalculado / 100) * circunferencia;
        barraRadial.style.strokeDashoffset = offset;
    }
}

function mostrarComparacion() {
    let contenedor = document.getElementById("comparacion");
    if (!contenedor) return;

    if (registrosFiltrados.length < 2) {
        contenedor.innerText = "Faltan datos para comparar";
        return;
    }

    let hoy = registrosFiltrados[registrosFiltrados.length - 1];
    let ayer = registrosFiltrados[registrosFiltrados.length - 2];
    let dif = calcularScore(hoy) - calcularScore(ayer);

    if (dif > 0) {
        contenedor.innerHTML = `Subiste un <span class="texto-positivo">${dif.toFixed(0)}%</span> respecto al registro anterior`;
    } else if (dif < 0) {
        let difPositiva = Math.abs(dif);
        contenedor.innerHTML = `Bajaste un <span class="texto-negativo">${difPositiva.toFixed(0)}%</span> respecto al registro anterior`;
    } else {
        contenedor.innerText = "Igual que el registro anterior";
    }
}

// ====== GRÁFICO HISTORIAL 7 DÍAS ======
function renderizarHistorial7Dias() {
    let contenedor = document.getElementById("historial7Dias");
    if (!contenedor) return;

    contenedor.innerHTML = ""; 

    if (registrosFiltrados.length === 0) {
        contenedor.style.borderTop = "none";
        let p = document.createElement("p");
        p.className = "texto-secundario mensaje-vacio";
        p.innerText = "Sin datos en este período.";
        contenedor.appendChild(p);
        return;
    }

    contenedor.style.borderTop = "1px dashed rgba(51, 65, 85, 0.5)";

    let datosPorDia = {};
    let fechasOrdenadas = [];

    for (let i = 0; i < registrosFiltrados.length; i++) {
        let r = registrosFiltrados[i];
        let f = r.fecha;
        if (datosPorDia[f] === undefined) {
            datosPorDia[f] = { suma: 0, cantidad: 0 };
            fechasOrdenadas.push(f);
        }
        let score = calcularScore(r);
        datosPorDia[f].suma = datosPorDia[f].suma + score;
        datosPorDia[f].cantidad = datosPorDia[f].cantidad + 1;
    }

    let ultimosDias = fechasOrdenadas.slice(-7);

    for (let i = 0; i < ultimosDias.length; i++) {
        let f = ultimosDias[i];
        let promedio = datosPorDia[f].suma / datosPorDia[f].cantidad;
        
        let partesFecha = f.split("-"); 
        let labelDia = partesFecha.length >= 3 ? partesFecha[2] + "/" + partesFecha[1] : "Día";

        let colDiv = document.createElement("div");
        colDiv.className = "dia-columna";

        let bgDiv = document.createElement("div");
        bgDiv.className = "dia-barra-bg";

        let fillDiv = document.createElement("div");
        fillDiv.className = "dia-barra-fill";
        fillDiv.style.height = promedio + "%"; 

        let spanLabel = document.createElement("span");
        spanLabel.className = "dia-label";
        spanLabel.innerText = labelDia;

        bgDiv.appendChild(fillDiv);
        colDiv.appendChild(bgDiv);
        colDiv.appendChild(spanLabel);
        
        contenedor.appendChild(colDiv);
    }
}

function mostrarInsights() {
    let contenedor = document.getElementById("insights");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    if (registrosFiltrados.length < 2) {
        contenedor.innerHTML = "<p class='texto-secundario'>Cargá datos para que pueda encontrar tus patrones ocultos.</p>";
        return;
    }

    let mensajes = analizarJornadas();

    if (mensajes.length > 0) {
        for (let i = 0; i < mensajes.length; i++) {
            let div = document.createElement("div");
            div.className = "item-insight";
            div.innerHTML = mensajes[i];
            contenedor.appendChild(div);
        }
    } else {
        contenedor.innerHTML = "<p class='texto-secundario'>Tu rendimiento es súper parejo. A medida que registres más, te iré tirando tips.</p>";
    }
}

function analizarJornadas() {
    let analisis = {};
    let mensajes = [];

    for (let i = 0; i < registrosFiltrados.length; i++) {
        let r = registrosFiltrados[i];
        if (analisis[r.actividad] === undefined) {
            analisis[r.actividad] = { "Mañana": [], "Tarde": [], "Noche": [] };
        }
        analisis[r.actividad][r.jornada].push(r.enfoque);
    }

    for (let act in analisis) {
        let jornadas = analisis[act];
        let promedios = {};

        for (let j in jornadas) {
            if (jornadas[j].length > 0) {
                let suma = 0;
                for (let k = 0; k < jornadas[j].length; k++) {
                    suma = suma + jornadas[j][k];
                }
                promedios[j] = suma / jornadas[j].length;
            }
        }

        let tiempos = Object.keys(promedios);
        if (tiempos.length >= 2) {
            let mejorJornada = tiempos[0];
            let peorJornada = tiempos[0];

            for (let i = 0; i < tiempos.length; i++) {
                let j = tiempos[i];
                if (promedios[j] > promedios[mejorJornada]) {
                    mejorJornada = j;
                }
                if (promedios[j] < promedios[peorJornada]) {
                    peorJornada = j;
                }
            }

            let difPuntos = promedios[mejorJornada] - promedios[peorJornada];

            if (difPuntos >= 1.5 || promedios[mejorJornada] >= 8) {
                let frase = `💡 <b>${act}</b> por la <b>${mejorJornada}</b> dispara tu productividad.`;
                mensajes.push(frase);
            } 
            else if (promedios[peorJornada] <= 4 && difPuntos >= 1) {
                let frase = `⚠️ <b>${act}</b> por la <b>${peorJornada}</b> te está costando demasiado.`;
                mensajes.push(frase);
            }
        }
    }
    return mensajes;
}

function generarHeatmap() {
    let contenedor = document.getElementById("heatmapContenedor");
    if (!contenedor) return;

    if (registrosFiltrados.length === 0) {
        contenedor.innerHTML = "<p class='texto-secundario' style='grid-column: span 3;'>Sin datos en este período.</p>";
        return;
    }

    let resumen = {
        "Mañana": { suma: 0, cantidad: 0 },
        "Tarde": { suma: 0, cantidad: 0 },
        "Noche": { suma: 0, cantidad: 0 }
    };

    registrosFiltrados.forEach(r => {
        if (resumen[r.jornada]) {
            resumen[r.jornada].suma += calcularScore(r);
            resumen[r.jornada].cantidad++;
        }
    });

    contenedor.innerHTML = "";
    let momentos = ["Mañana", "Tarde", "Noche"];

    momentos.forEach(momento => {
        let datos = resumen[momento];
        let promedio = 0;
        
        if (datos.cantidad > 0) {
            promedio = Math.round(datos.suma / datos.cantidad);
        }

        let colorClase = "heat-nulo";
        if (promedio >= 80) colorClase = "heat-alto";
        else if (promedio >= 60) colorClase = "heat-medio";
        else if (promedio > 0) colorClase = "heat-bajo";

        let textoPromedio = promedio > 0 ? promedio + "%" : "-";

        contenedor.innerHTML += `
            <div class="item-heatmap ${colorClase}">
                <span>${momento}</span>
                <strong>${textoPromedio}</strong>
            </div>
        `;
    });
}

function mostrarHistorial() {
    let contenedor = document.getElementById("historialLista");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    let ultimos = registrosFiltrados.slice(-5).reverse();
    ultimos.forEach(r => {
        let div = document.createElement("div");
        div.className = "item-historial";
        div.innerHTML = `
            <span><b>${r.actividad}</b> (${r.jornada}) <br> <small class="texto-muted">Enrg: ${r.energia} | Enf: ${r.enfoque} | Anim: ${r.animo}</small></span>
            <div class="acciones-historial">
                <button onclick="cargarParaEditar('${r.id}')" class="btnEditar">Editar</button>
                <button onclick="borrarRegistro('${r.id}')" class="btnBorrar">Eliminar</button>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

function dibujarGraficoGlobal() {
    let canvas = document.getElementById("grafico");
    if (!canvas || registrosFiltrados.length === 0) return;

    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let cantidadPuntos = registrosFiltrados.length > 1 ? registrosFiltrados.length - 1 : 1;
    let espacioX = canvas.width / cantidadPuntos;
    
    ctx.beginPath();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;

    registrosFiltrados.forEach((r, i) => {
        let x = i * espacioX;
        let y = canvas.height - (calcularScore(r) * canvas.height / 100);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    registrosFiltrados.forEach((r, i) => {
        let x = i * espacioX;
        let y = canvas.height - (calcularScore(r) * canvas.height / 100);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

function generarDashboardActividades() {
    let contenedor = document.getElementById("dashboardActividades");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    let datosPorActividad = {};

    registrosFiltrados.forEach(r => {
        if (!datosPorActividad[r.actividad]) {
            datosPorActividad[r.actividad] = [];
        }
        datosPorActividad[r.actividad].push(calcularScore(r));
    });

    for (let act in datosPorActividad) {
        let scores = datosPorActividad[act];

        if (scores.length >= 2) {
            let dif = scores[scores.length - 1] - scores[scores.length - 2];
            let textoTendencia = "Igual que la última vez";
            let claseTendencia = "neutra";

            if (dif > 0) {
                textoTendencia = `Mejoraste un ${dif.toFixed(0)}%`;
                claseTendencia = "positiva";
            } else if (dif < 0) {
                textoTendencia = `Empeoraste un ${Math.abs(dif).toFixed(0)}%`;
                claseTendencia = "negativa";
            }

            let div = document.createElement("div");
            div.className = "tarjeta-grafico";
            div.innerHTML = `<h3>${act}</h3><p class="tendencia ${claseTendencia}">${textoTendencia}</p>`;

            let canvas = document.createElement("canvas");
            canvas.width = 400;
            canvas.height = 100;

            div.appendChild(canvas);
            contenedor.appendChild(div);

            dibujarMiniGrafico(canvas, scores);
        }
    }
}

function dibujarMiniGrafico(canvas, scores) {
    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let cantidadPuntos = scores.length > 1 ? scores.length - 1 : 1;
    let espacioX = canvas.width / cantidadPuntos;

    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;

    scores.forEach((score, i) => {
        let x = i * espacioX;
        let y = canvas.height - (score * canvas.height / 100);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    scores.forEach((score, i) => {
        let x = i * espacioX;
        let y = canvas.height - (score * canvas.height / 100);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

// ====== SIMULADOR DE RENDIMIENTO ======
function calcularPrediccion() {
    let inputActividad = document.getElementById("simActividad");
    let inputJornada = document.getElementById("simJornada");
    let contenedor = document.getElementById("resultadoSimulador");

    if (!inputActividad || !inputJornada || !contenedor) return;

    let actBuscada = inputActividad.value.trim().toLowerCase();
    let jorBuscada = inputJornada.value;

    if (actBuscada === "") {
        contenedor.innerHTML = `<p class="texto-secundario">Escribí una actividad para simular.</p>`;
        return;
    }

    let exactas = [];
    let similares = [];

    // Ahora simula usando los datos del período filtrado
    for (let i = 0; i < registrosFiltrados.length; i++) {
        let r = registrosFiltrados[i];
        if (r.actividad.toLowerCase() === actBuscada) {
            similares.push(r);
            if (r.jornada === jorBuscada) {
                exactas.push(r);
            }
        }
    }

    let sacarPromedio = (array) => {
        let suma = 0;
        for (let i = 0; i < array.length; i++) {
            suma += calcularScore(array[i]);
        }
        return (suma / array.length).toFixed(0);
    };

    if (exactas.length > 0) {
        let puntaje = sacarPromedio(exactas);
        contenedor.innerHTML = `
            <span class="numero-prediccion texto-positivo">${puntaje}%</span>
            <p class="texto-secundario">Basado en tu historial reciente en este horario.</p>
        `;
    } else if (similares.length > 0) {
        let puntaje = sacarPromedio(similares);
        contenedor.innerHTML = `
            <span class="numero-prediccion texto-muted">${puntaje}%</span>
            <p class="texto-secundario">No lo hiciste a la ${jorBuscada}, este es tu promedio general.</p>
        `;
    } else {
        contenedor.innerHTML = `
            <span class="numero-prediccion texto-muted">?</span>
            <p class="texto-secundario">No hay datos en este período.</p>
        `;
    }
}

// ====== IMPACTO DE ENERGÍA ======
function generarImpactoEnergia() {
    let contenedor = document.getElementById("impactoEnergiaContenedor");
    if (!contenedor) return;

    if (registrosFiltrados.length < 2) {
        contenedor.innerHTML = "<p class='texto-secundario'>Faltan datos en este período para medir tu energía.</p>";
        return;
    }

    let resumenAnimo = {};

    for (let i = 0; i < registrosFiltrados.length; i++) {
        let r = registrosFiltrados[i];
        let act = r.actividad;

        if (resumenAnimo[act] === undefined) {
            resumenAnimo[act] = { suma: 0, cantidad: 0 };
        }

        resumenAnimo[act].suma += r.animo;
        resumenAnimo[act].cantidad += 1;
    }

    let mejorActividad = "Ninguna";
    let mejorPromedio = -1;

    let peorActividad = "Ninguna";
    let peorPromedio = 999;

    for (let act in resumenAnimo) {
        let datos = resumenAnimo[act];
        let prom = datos.suma / datos.cantidad;

        if (prom > mejorPromedio) {
            mejorPromedio = prom;
            mejorActividad = act;
        }

        if (prom < peorPromedio) {
            peorPromedio = prom;
            peorActividad = act;
        }
    }

    if (mejorActividad === peorActividad) {
        contenedor.innerHTML = "<p class='texto-secundario'>Tu energía se mantiene estable con estas actividades.</p>";
        return;
    }

    contenedor.innerHTML = `
        <div class="item-energia energia-positiva">
            <div class="energia-info">
                <span class="energia-titulo">${mejorActividad}</span>
                <span class="energia-sub">Terminás con energía</span>
            </div>
            <span class="energia-icono">🔋</span>
        </div>
        <div class="item-energia energia-negativa">
            <div class="energia-info">
                <span class="energia-titulo">${peorActividad}</span>
                <span class="energia-sub">Terminás agotado</span>
            </div>
            <span class="energia-icono">🪫</span>
        </div>
    `;
}

// NOTA: QuickTags sigue buscando en TODA la base de datos para sugerirte siempre tus hábitos globales.
function generarQuickTags() {
    let contenedor = document.getElementById("quickTags");
    if (!contenedor) return;

    let conteoActividades = {};

    for (let i = 0; i < registros.length; i++) {
        let act = registros[i].actividad;
        if (conteoActividades[act] === undefined) conteoActividades[act] = 1;
        else conteoActividades[act]++;
    }

    let actividadesUnicas = Object.keys(conteoActividades);
    actividadesUnicas.sort((a, b) => conteoActividades[b] - conteoActividades[a]);

    contenedor.innerHTML = "";
    let maxBotones = actividadesUnicas.length < 4 ? actividadesUnicas.length : 4;

    for (let i = 0; i < maxBotones; i++) {
        let nombre = actividadesUnicas[i];
        let btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-tag";
        btn.innerText = nombre;
        btn.onclick = () => document.getElementById("actividad").value = nombre;
        contenedor.appendChild(btn);
    }
}

function setAutoMomento() {
    let select = document.getElementById("jornada");
    if (!select) return;

    let horaActual = new Date().getHours();
    if (horaActual >= 5 && horaActual < 13) select.value = "Mañana";
    else if (horaActual >= 13 && horaActual < 20) select.value = "Tarde";
    else select.value = "Noche";
}

// NOTA: La Racha SIEMPRE analiza toda la BD, el filtro de tiempo no la corta artificialmente.
function calcularRacha() {
    let contenedor = document.getElementById("rachaFuego");
    if (!contenedor) return;

    if (registros.length === 0) {
        contenedor.innerHTML = "🔥 0 días";
        return;
    }

    let fechasGuardadas = [];
    for (let i = 0; i < registros.length; i++) {
        let f = registros[i].fecha;
        if (f && !fechasGuardadas.includes(f)) {
            fechasGuardadas.push(f);
        }
    }

    fechasGuardadas.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

    if (fechasGuardadas.length === 0) {
        contenedor.innerHTML = "🔥 0 días";
        return;
    }

    function obtenerStringFecha(fechaObj) {
        let anio = fechaObj.getFullYear();
        let mes = fechaObj.getMonth() + 1;
        let dia = fechaObj.getDate();
        if (mes < 10) mes = "0" + mes;
        if (dia < 10) dia = "0" + dia;
        return `${anio}-${mes}-${dia}`;
    }

    let hoyObj = new Date();
    let ayerObj = new Date();
    ayerObj.setDate(hoyObj.getDate() - 1); 

    let stringHoy = obtenerStringFecha(hoyObj);
    let stringAyer = obtenerStringFecha(ayerObj);

    let racha = 0;
    let fechaEsperadaObj = new Date();

    let ultimaFecha = fechasGuardadas[0];
    
    if (ultimaFecha === stringHoy) {
        racha = 1;
        fechaEsperadaObj.setDate(hoyObj.getDate() - 1); 
    } else if (ultimaFecha === stringAyer) {
        racha = 1;
        fechaEsperadaObj.setDate(ayerObj.getDate() - 1); 
    } else {
        contenedor.innerHTML = "🔥 0 días";
        return;
    }

    for (let i = 1; i < fechasGuardadas.length; i++) {
        let stringEsperado = obtenerStringFecha(fechaEsperadaObj);
        if (fechasGuardadas[i] === stringEsperado) {
            racha++;
            fechaEsperadaObj.setDate(fechaEsperadaObj.getDate() - 1); 
        } else {
            break; 
        }
    }

    contenedor.innerHTML = "🔥 " + racha + " días";
}

function mostrarToast() {
    let toast = document.getElementById("toast");
    if (!toast) return;
    
    toast.className = "toast-visible";
    setTimeout(() => toast.className = "toast-hidden", 3000);
}

function generarRutinaIdeal() {
    let contenedor = document.getElementById("rutinaContenedor");
    if (contenedor === null) return;

    if (registrosFiltrados.length < 5) {
        contenedor.innerHTML = "<p class='texto-secundario span-3-cols'>Faltan datos en este período para armar la rutina.</p>";
        return;
    }

    let promediosPorJornada = { "Mañana": {}, "Tarde": {}, "Noche": {} };

    for (let i = 0; i < registrosFiltrados.length; i++) {
        let r = registrosFiltrados[i];
        let jor = r.jornada;
        let act = r.actividad;
        
        if (promediosPorJornada[jor] !== undefined) {
            if (promediosPorJornada[jor][act] === undefined) {
                promediosPorJornada[jor][act] = { suma: 0, cantidad: 0 };
            }
            promediosPorJornada[jor][act].suma += calcularScore(r);
            promediosPorJornada[jor][act].cantidad += 1;
        }
    }

    let rutina = { "Mañana": "Libre", "Tarde": "Libre", "Noche": "Libre" };
    let actividadesUsadas = [];
    let momentos = ["Mañana", "Tarde", "Noche"];
    
    for (let i = 0; i < momentos.length; i++) {
        let jor = momentos[i];
        let actividades = promediosPorJornada[jor];
        
        let mejorActividad = "Libre";
        let mejorPromedio = -1;

        for (let act in actividades) {
            if (!actividadesUsadas.includes(act)) {
                let prom = actividades[act].suma / actividades[act].cantidad;
                if (prom > mejorPromedio) {
                    mejorPromedio = prom;
                    mejorActividad = act;
                }
            }
        }

        rutina[jor] = mejorActividad;
        if (mejorActividad !== "Libre") {
            actividadesUsadas.push(mejorActividad);
        }
    }

    contenedor.innerHTML = "";
    
    for (let i = 0; i < momentos.length; i++) {
        let jor = momentos[i];
        let act = rutina[jor];
        
        let htmlCaja = `
            <div class="item-rutina">
                <span>${jor}</span>
                <strong>${act}</strong>
            </div>
        `;
        contenedor.innerHTML += htmlCaja;
    }
}

function cargarParaEditar(id) {
    let r = registros.find(x => String(x.id) === String(id));
    
    if (!r) {
        console.error("No se encontró el registro con ID:", id);
        return;
    }
    
    editandoId = id;
    
    document.getElementById("actividad").value = r.actividad;
    document.getElementById("jornada").value = r.jornada;
    document.getElementById("energia").value = r.energia;
    document.getElementById("enfoque").value = r.enfoque;
    document.getElementById("animo").value = r.animo;
    
    let btnGuardar = document.querySelector("#formRegistro .btnGuardar");
    if (btnGuardar) {
        btnGuardar.innerText = "Actualizar Registro";
        btnGuardar.style.background = "#10b981"; 
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

document.addEventListener('DOMContentLoaded', () => {
    let form = document.getElementById("formRegistro");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            let actividad = document.getElementById("actividad").value;
            let jornada = document.getElementById("jornada").value;
            let energia = document.getElementById("energia").value;
            let enfoque = document.getElementById("enfoque").value;
            let animo = document.getElementById("animo").value;

            if (editandoId !== null) {
                // Modo Edición
                await modificarRegistro(editandoId, actividad, jornada, energia, enfoque, animo);
                editandoId = null; // Reiniciamos el estado
                
                let btnGuardar = document.querySelector("#formRegistro .btnGuardar");
                if (btnGuardar) {
                    btnGuardar.innerText = "Guardar Registro";
                    btnGuardar.style.background = "#3b82f6"; // Vuelve al azul original
                }
            } else {
                // Modo Creación
                await agregarRegistro(actividad, jornada, energia, enfoque, animo);
            }

            form.reset();
            setAutoMomento(); // Restauramos el selector de tiempo por defecto
            mostrarToast();
        });
    }
    setAutoMomento();
    cargarRegistrosDesdeBD();
});