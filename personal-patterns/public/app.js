// ===== VARIABLES GLOBALES =====
let registros = [];

// ===== FUNCIONES AUXILIARES =====
// Centralizamos el cálculo del score para no repetir código
function calcularScore(registro) {
    return ((registro.energia + registro.enfoque + registro.animo) / 3) * 10;
}

// ===== CONEXIÓN AL BACKEND (SQLite) =====
async function cargarRegistrosDesdeBD() {
    try {
        const respuesta = await fetch("http://localhost:3000/daily-logs");
        if (respuesta.ok) {
            const datos = await respuesta.json();
            registros = datos.map(d => ({
                id: d.id,
                actividad: d.actividad,
                jornada: d.jornada || "No definida",
                energia: Number(d.energia),
                enfoque: Number(d.enfoque),
                animo: Number(d.animo)
            }));
            actualizarInterfaz();
        }
    } catch (error) {
        console.error("Error conectando a SQLite.", error);
    }
}

async function agregarRegistro(actividad, jornada, energia, enfoque, animo) {
    const fecha = new Date().toISOString().split('T')[0];
    try {
        const respuesta = await fetch("http://localhost:3000/daily-log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fecha, actividad, jornada, energia, enfoque, animo })
        });
        if (respuesta.ok) await cargarRegistrosDesdeBD();
    } catch (error) {
        console.error("Error al guardar:", error);
    }
}

async function borrarRegistro(id) {
    if (!confirm("¿Seguro que querés borrar este registro?")) return;
    try {
        await fetch(`http://localhost:3000/daily-log/${id}`, { method: "DELETE" });
        await cargarRegistrosDesdeBD();
    } catch (error) {
        console.error("Error al borrar:", error);
    }
}

// ===== RENDERIZADO DE INTERFAZ =====
function actualizarInterfaz() {
    generarRecomendacionCoach();
    mostrarScore();
    mostrarComparacion();
    mostrarInsights();
    generarHeatmap();
    dibujarGraficoGlobal();
    mostrarHistorial();
    generarDashboardActividades();
}

function generarRecomendacionCoach() {
    let contenedor = document.getElementById("recomendacionCoach");
    if (!contenedor) return;

    if (registros.length < 3) {
        contenedor.innerHTML = "<p class='texto-secundario'>Cargá más datos para que el coach pueda analizar tu rutina.</p>";
        return;
    }

    let combinaciones = {};
    registros.forEach(r => {
        let clave = `${r.actividad}|${r.jornada}`;
        if (!combinaciones[clave]) combinaciones[clave] = { suma: 0, cantidad: 0 };
        
        combinaciones[clave].suma += calcularScore(r);
        combinaciones[clave].cantidad++;
    });

    let promedios = Object.keys(combinaciones).map(clave => {
        let [actividad, jornada] = clave.split("|");
        return { 
            actividad, 
            jornada, 
            promedio: combinaciones[clave].suma / combinaciones[clave].cantidad 
        };
    });

    promedios.sort((a, b) => b.promedio - a.promedio);
    let mejor = promedios[0];
    let peor = promedios[promedios.length - 1];

    let html = `<p class="titulo-recomendacion">Hoy podrías mejorar tu rendimiento si:</p>`;
    html += `<p class="item-recomendacion">• <b>${mejor.actividad}</b> por la <b>${mejor.jornada}</b></p>`;
    
    if (peor.promedio < 70 && (mejor.actividad !== peor.actividad || mejor.jornada !== peor.jornada)) {
        html += `<p class="item-recomendacion">• Evitás <b>${peor.actividad}</b> por la <b>${peor.jornada}</b></p>`;
    }

    contenedor.innerHTML = html;
}

function mostrarScore() {
    let contenedor = document.getElementById("score");
    if (!contenedor) return;
    if (registros.length === 0) { contenedor.innerText = "0%"; return; }
    
    let ultimo = registros[registros.length - 1];
    let score = calcularScore(ultimo);
    contenedor.innerText = score.toFixed(0) + "%";
}

function mostrarComparacion() {
    let contenedor = document.getElementById("comparacion");
    if (!contenedor) return;
    if (registros.length < 2) { contenedor.innerText = "Cargá más datos para comparar"; return; }
    
    let hoy = registros[registros.length - 1];
    let ayer = registros[registros.length - 2];
    
    let dif = calcularScore(hoy) - calcularScore(ayer);

    if (dif > 0) {
        contenedor.innerHTML = `Subiste un <span class="texto-positivo">${dif.toFixed(0)}%</span> respecto a ayer 📈`;
    } else if (dif < 0) {
        contenedor.innerHTML = `Bajaste un <span class="texto-negativo">${Math.abs(dif).toFixed(0)}%</span> respecto a ayer 📉`;
    } else {
        contenedor.innerText = "Igual que ayer";
    }
}

function mostrarInsights() {
    let contenedor = document.getElementById("insights");
    if (!contenedor) return;
    contenedor.innerHTML = "";
    
    if (registros.length < 2) {
        contenedor.innerHTML = "<p>Todavía no hay suficientes datos</p>";
        return;
    }
    
    let mensajes = analizarJornadas();
    
    if (mensajes.length > 0) {
        mensajes.forEach(msg => {
            contenedor.innerHTML += `<p>${msg}</p>`;
        });
    } else {
        contenedor.innerHTML = "<p>Todavía no se detectan patrones claros</p>";
    }
}

function analizarJornadas() {
    let analisis = {};
    let mensajes = [];

    registros.forEach(r => {
        if (!analisis[r.actividad]) analisis[r.actividad] = { Mañana: [], Tarde: [], Noche: [] };
        if (analisis[r.actividad][r.jornada]) {
            analisis[r.actividad][r.jornada].push(r.enfoque);
        }
    });

    for (let act in analisis) {
        let jornadas = analisis[act];
        let promedios = {};

        for (let j in jornadas) {
            if (jornadas[j].length > 0) {
                promedios[j] = jornadas[j].reduce((a,b) => a+b, 0) / jornadas[j].length;
            }
        }

        let keys = Object.keys(promedios);
        if (keys.length >= 2) {
            let mejorJornada = keys.reduce((a, b) => promedios[a] > promedios[b] ? a : b);
            let peorJornada = keys.reduce((a, b) => promedios[a] < promedios[b] ? a : b);

            if (mejorJornada !== peorJornada) {
                let difPuntos = promedios[mejorJornada] - promedios[peorJornada];
                if (difPuntos >= 0.1) { 
                    mensajes.push(`⏱️ <b>${act}</b> a la ${mejorJornada} te da <b>+${difPuntos.toFixed(1)} puntos</b> de enfoque que a la ${peorJornada}.`);
                }
            }
        }
    }
    return mensajes;
}

function generarHeatmap() {
    let contenedor = document.getElementById("heatmapContenedor");
    if (!contenedor) return;

    if (registros.length === 0) {
        contenedor.innerHTML = "<p class='texto-secundario' style='grid-column: span 3;'>Cargá datos para ver tu rendimiento.</p>";
        return;
    }

    let resumen = {
        "Mañana": { suma: 0, cantidad: 0 },
        "Tarde": { suma: 0, cantidad: 0 },
        "Noche": { suma: 0, cantidad: 0 }
    };

    registros.forEach(r => {
        if (resumen[r.jornada]) {
            resumen[r.jornada].suma += calcularScore(r);
            resumen[r.jornada].cantidad++;
        }
    });

    contenedor.innerHTML = "";
    let momentos = ["Mañana", "Tarde", "Noche"];

    momentos.forEach(momento => {
        let datos = resumen[momento];
        let promedio = datos.cantidad > 0 ? Math.round(datos.suma / datos.cantidad) : 0;
        
        let colorClase = "heat-nulo";
        if (promedio >= 80) colorClase = "heat-alto";
        else if (promedio >= 60) colorClase = "heat-medio";
        else if (promedio > 0) colorClase = "heat-bajo";

        let textoPromedio = promedio > 0 ? `${promedio}%` : "-";

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

    let ultimos = registros.slice(-5).reverse();
    ultimos.forEach(r => {
        let div = document.createElement("div");
        div.className = "item-historial";
        div.innerHTML = `
            <span><b>${r.actividad}</b> (${r.jornada}) <br> <small class="texto-muted">Enrg: ${r.energia} | Enf: ${r.enfoque} | Anim: ${r.animo}</small></span>
            <button onclick="borrarRegistro(${r.id})" class="btnBorrar" title="Borrar registro">🗑️</button>
        `;
        contenedor.appendChild(div);
    });
}

// ===== GRÁFICOS =====
function dibujarGraficoGlobal() {
    let canvas = document.getElementById("grafico");
    if (!canvas || registros.length === 0) return;
    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let scores = registros.map(r => calcularScore(r));
    let espacioX = canvas.width / (scores.length > 1 ? scores.length - 1 : 1); 

    ctx.beginPath();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;

    for (let i = 0; i < scores.length; i++) {
        let x = i * espacioX;
        let y = canvas.height - (scores[i] * canvas.height / 100);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < scores.length; i++) {
        let x = i * espacioX;
        let y = canvas.height - (scores[i] * canvas.height / 100);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function generarDashboardActividades() {
    let contenedor = document.getElementById("dashboardActividades");
    if (!contenedor) return;
    contenedor.innerHTML = ""; 

    let datosPorActividad = {};
    registros.forEach(r => {
        if (!datosPorActividad[r.actividad]) datosPorActividad[r.actividad] = [];
        datosPorActividad[r.actividad].push(calcularScore(r));
    });

    for (let act in datosPorActividad) {
        let scores = datosPorActividad[act];
        if (scores.length < 2) continue;

        let diferencia = scores[scores.length - 1] - scores[scores.length - 2];
        let textoTendencia = diferencia > 0 ? `📈 Mejoraste un ${diferencia.toFixed(0)}% respecto a la última vez` :
                             diferencia < 0 ? `📉 Empeoraste un ${Math.abs(diferencia).toFixed(0)}% respecto a la última vez` :
                             "Igual que la última vez";
        let claseTendencia = diferencia > 0 ? "positiva" : diferencia < 0 ? "negativa" : "neutra";

        let div = document.createElement("div");
        div.className = "tarjeta-grafico";
        div.innerHTML = `<h3>${act}</h3><p class="tendencia ${claseTendencia}">${textoTendencia}</p>`;
        
        let canvas = document.createElement("canvas");
        canvas.width = 400; canvas.height = 100;
        div.appendChild(canvas);
        contenedor.appendChild(div);

        dibujarMiniGrafico(canvas, scores);
    }
}

function dibujarMiniGrafico(canvas, scores) {
    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let espacioX = canvas.width / (scores.length > 1 ? scores.length - 1 : 1);

    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;

    for (let i = 0; i < scores.length; i++) {
        let x = i * espacioX;
        let y = canvas.height - (scores[i] * canvas.height / 100);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < scores.length; i++) {
        let x = i * espacioX;
        let y = canvas.height - (scores[i] * canvas.height / 100);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ===== EVENTOS =====
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById("formRegistro");
    if (form) {
        form.addEventListener("submit", async function(e) {
            e.preventDefault();
            
            const actividad = document.getElementById("actividad").value;
            const jornada = document.getElementById("jornada").value;
            const energia = document.getElementById("energia").value;
            const enfoque = document.getElementById("enfoque").value;
            const animo = document.getElementById("animo").value;

            await agregarRegistro(actividad, jornada, energia, enfoque, animo);
            form.reset();
        });
    }
    
    cargarRegistrosDesdeBD();
});