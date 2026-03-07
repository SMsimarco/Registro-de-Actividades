let registros = [];

// calcular total
function calcularScore(r) {
    let promedio = (r.energia + r.enfoque + r.animo) / 3;
    return promedio * 10;
}

// conexion database
async function cargarRegistrosDesdeBD() {
    try {
        const respuesta = await fetch("http://localhost:3000/daily-logs");
        if (respuesta.ok) {
            const datos = await respuesta.json();
            registros = [];

            datos.forEach(d => {
                let jornadaDefinida = d.jornada;
                if (!jornadaDefinida) {
                    jornadaDefinida = "No definida";
                }
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

            actualizarInterfaz();
        }
    } catch (error) {
        console.error("Error connecting to database", error);
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
        if (respuesta.ok) {
            await cargarRegistrosDesdeBD();
        }
    } catch (error) {
        console.error("Error saving data", error);
    }
}

async function borrarRegistro(id) {
    let confirmacion = confirm("¿Seguro que querés borrar este registro?");
    if (confirmacion) {
        try {
            await fetch(`http://localhost:3000/daily-log/${id}`, { method: "DELETE" });
            await cargarRegistrosDesdeBD();
        } catch (error) {
            console.error("Error deleting data", error);
        }
    }
}

// ====== MOTOR CENTRAL DE UI ======
function actualizarInterfaz() {
    generarRecomendacionCoach();
    mostrarScore();
    renderizarHistorial7Dias(); // Agregado
    mostrarComparacion();
    mostrarInsights();
    generarHeatmap();
    generarRutinaIdeal(); // Para que mantenga la lógica si se agrega un dato
    generarCostoBiologico(); // Agregado
    dibujarGraficoGlobal();
    mostrarHistorial();
    generarDashboardActividades();
    generarQuickTags();
    calcularRacha();
}

// ====== RECOMENDACIÓN DEL DÍA (COACH HUMANIZADO) ======
function generarRecomendacionCoach() {
    let contenedor = document.getElementById("recomendacionCoach");
    if (!contenedor) return;

    if (registros.length < 3) {
        contenedor.innerHTML = `<p class="texto-secundario">Registrá al menos 3 actividades para que pueda analizar tu ritmo y darte consejos útiles.</p>`;
        return;
    }

    let resumen = {};
    for (let i = 0; i < registros.length; i++) {
        let r = registros[i];
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
        `Tu foco está al máximo cuando hacés <b>${mejorAct}</b> por la <b>${mejorJor}</b>. ¡Aprovechá ese impulso hoy!`,
        `Los datos no mienten: la <b>${mejorJor}</b> es tu momento de oro para <b>${mejorAct}</b>.`,
        `Si querés asegurar el día, meté <b>${mejorAct}</b> durante la <b>${mejorJor}</b>. Es tu combinación ganadora.`
    ];

    let frasesNegativas = [
        `Cuidado: <b>${peorAct}</b> por la <b>${peorJor}</b> suele drenarte. ¿Podés moverlo de horario?`,
        `Noté fricción al hacer <b>${peorAct}</b> a la <b>${peorJor}</b>. Si podés, evitalo hoy.`,
        `Tu energía cae cuando intentás <b>${peorAct}</b> por la <b>${peorJor}</b>. ¡Tenelo en cuenta!`
    ];

    let indicePositivo = new Date().getMilliseconds() % frasesPositivas.length;
    let indiceNegativo = new Date().getMilliseconds() % frasesNegativas.length;

    let html = `<p class="item-recomendacion">${frasesPositivas[indicePositivo]}</p>`;
                
    let esOtraActividad = mejorAct !== peorAct;
    let esOtraJornada = mejorJor !== peorJor;

    if (peorPromedio < 65 && (esOtraActividad || esOtraJornada)) {
        html += `<p class="item-recomendacion texto-secundario"> ${frasesNegativas[indiceNegativo]}</p>`;
    }

    contenedor.innerHTML = html;
}

// ====== SCORE VISUAL (RADIAL CHART ANIMATION) ======
function mostrarScore() {
    let contenedor = document.getElementById("score");
    let barraRadial = document.getElementById("scoreRadialBar");
    
    if (!contenedor) return;
    
    let circunferencia = 314.159;

    if (registros.length === 0) { 
        contenedor.innerText = "0%"; 
        if (barraRadial) barraRadial.style.strokeDashoffset = circunferencia;
        return; 
    }
    
    let ultimo = registros[registros.length - 1];
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

    if (registros.length < 2) {
        contenedor.innerText = "Cargá más datos para comparar";
        return;
    }

    let hoy = registros[registros.length - 1];
    let ayer = registros[registros.length - 2];
    let dif = calcularScore(hoy) - calcularScore(ayer);

    if (dif > 0) {
        contenedor.innerHTML = `Subiste un <span class="texto-positivo">${dif.toFixed(0)}%</span> respecto a ayer `;
    } else if (dif < 0) {
        let difPositiva = Math.abs(dif);
        contenedor.innerHTML = `Bajaste un <span class="texto-negativo">${difPositiva.toFixed(0)}%</span> respecto a ayer `;
    } else {
        contenedor.innerText = "Igual que ayer";
    }
}

// ====== GRÁFICO HISTORIAL 7 DÍAS ======
function renderizarHistorial7Dias() {
    let contenedor = document.getElementById("historial7Dias");
    if (!contenedor) return;

    contenedor.innerHTML = ""; 

    if (registros.length === 0) {
        contenedor.style.borderTop = "none";
        let p = document.createElement("p");
        p.className = "texto-secundario mensaje-vacio";
        p.innerText = "Sin datos suficientes.";
        contenedor.appendChild(p);
        return;
    }

    contenedor.style.borderTop = "1px dashed rgba(51, 65, 85, 0.5)";

    let datosPorDia = {};
    let fechasOrdenadas = [];

    for (let i = 0; i < registros.length; i++) {
        let r = registros[i];
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
        
        let partesFecha = f.split("-"); // Ajustado para el formato ISO YYYY-MM-DD
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

    if (registros.length < 2) {
        contenedor.innerHTML = "<p class='texto-secundario'>Cargá un par de días más para que pueda encontrar tus patrones ocultos.</p>";
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
        contenedor.innerHTML = "<p class='texto-secundario'>Tu rendimiento es súper parejo. A medida que registres más, te iré tirando tips personalizados.</p>";
    }
}

function analizarJornadas() {
    let analisis = {};
    let mensajes = [];

    for (let i = 0; i < registros.length; i++) {
        let r = registros[i];
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
                let frase = `💡 <b>${act}</b> por la <b>${mejorJornada}</b> hace que tu productividad se dispare. Es tu momento ideal para el trabajo profundo.`;
                mensajes.push(frase);
            } 
            else if (promedios[peorJornada] <= 4 && difPuntos >= 1) {
                let frase = `⚠️ <b>${act}</b> por la <b>${peorJornada}</b> te está costando demasiado. Tratá de moverlo a la ${mejorJornada} para no frustrarte.`;
                mensajes.push(frase);
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

        let promedio = 0;
        if (datos.cantidad > 0) {
            promedio = Math.round(datos.suma / datos.cantidad);
        }

        let colorClase = "heat-nulo";
        if (promedio >= 80) {
            colorClase = "heat-alto";
        } else if (promedio >= 60) {
            colorClase = "heat-medio";
        } else if (promedio > 0) {
            colorClase = "heat-bajo";
        }

        let textoPromedio = "-";
        if (promedio > 0) {
            textoPromedio = promedio + "%";
        }

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
            <button onclick="borrarRegistro(${r.id})" class="btnBorrar">Eliminar</button>
        `;
        contenedor.appendChild(div);
    });
}

function dibujarGraficoGlobal() {
    let canvas = document.getElementById("grafico");
    if (!canvas || registros.length === 0) return;

    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let cantidadPuntos = 1;
    if (registros.length > 1) {
        cantidadPuntos = registros.length - 1;
    }

    let espacioX = canvas.width / cantidadPuntos;
    ctx.beginPath();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;

    registros.forEach((r, i) => {
        let x = i * espacioX;
        let y = canvas.height - (calcularScore(r) * canvas.height / 100);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    registros.forEach((r, i) => {
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

    registros.forEach(r => {
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
                textoTendencia = `Mejoraste un ${dif.toFixed(0)}% respecto a la última vez`;
                claseTendencia = "positiva";
            } else if (dif < 0) {
                let difPositiva = Math.abs(dif);
                textoTendencia = `Empeoraste un ${difPositiva.toFixed(0)}% respecto a la última vez`;
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

    let cantidadPuntos = 1;
    if (scores.length > 1) {
        cantidadPuntos = scores.length - 1;
    }

    let espacioX = canvas.width / cantidadPuntos;

    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;

    scores.forEach((score, i) => {
        let x = i * espacioX;
        let y = canvas.height - (score * canvas.height / 100);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
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

    for (let i = 0; i < registros.length; i++) {
        let r = registros[i];
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
            <p class="texto-secundario">Basado en ${exactas.length} veces que hiciste esto a la ${jorBuscada}.</p>
        `;
    } else if (similares.length > 0) {
        let puntaje = sacarPromedio(similares);
        contenedor.innerHTML = `
            <span class="numero-prediccion texto-muted">${puntaje}%</span>
            <p class="texto-secundario">No lo registraste a la ${jorBuscada}, pero tu promedio general es este.</p>
        `;
    } else {
        contenedor.innerHTML = `
            <span class="numero-prediccion texto-muted">?</span>
            <p class="texto-secundario">No hay datos previos. ¡Hacelo y registralo!</p>
        `;
    }
}

// ====== COSTO BIOLÓGICO ======
function generarCostoBiologico() {
    let contenedor = document.getElementById("costoBiologicoContenedor");
    if (contenedor === null) return;

    if (registros.length < 2) {
        contenedor.innerHTML = "<p class='texto-secundario span-2-cols'>Cargá más datos para descubrir tus motores y vampiros de energía.</p>";
        return;
    }

    let resumenAnimo = {};

    for (let i = 0; i < registros.length; i++) {
        let r = registros[i];
        let act = r.actividad;

        if (resumenAnimo[act] === undefined) {
            resumenAnimo[act] = { suma: 0, cantidad: 0 };
        }

        resumenAnimo[act].suma = resumenAnimo[act].suma + r.animo;
        resumenAnimo[act].cantidad = resumenAnimo[act].cantidad + 1;
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
        contenedor.innerHTML = "<p class='texto-secundario span-2-cols'>Tu energía se mantiene estable. Registrá diferentes actividades para poder compararlas.</p>";
        return;
    }

    contenedor.innerHTML = `
        <div class="caja-motor">
            <span class="titulo-motor">Te recarga</span>
            <p class="texto-actividad">${mejorActividad}</p>
        </div>
        <div class="caja-vampiro">
            <span class="titulo-vampiro">Te drena</span>
            <p class="texto-actividad">${peorActividad}</p>
        </div>
    `;
}

function generarQuickTags() {
    let contenedor = document.getElementById("quickTags");
    if (!contenedor) return;

    let conteoActividades = {};

    for (let i = 0; i < registros.length; i++) {
        let act = registros[i].actividad;
        if (conteoActividades[act] === undefined) {
            conteoActividades[act] = 1;
        } else {
            conteoActividades[act] = conteoActividades[act] + 1;
        }
    }

    let actividadesUnicas = Object.keys(conteoActividades);

    actividadesUnicas.sort(function (a, b) {
        return conteoActividades[b] - conteoActividades[a];
    });

    contenedor.innerHTML = "";

    let maxBotones = 4;
    if (actividadesUnicas.length < 4) {
        maxBotones = actividadesUnicas.length;
    }

    for (let i = 0; i < maxBotones; i++) {
        let nombre = actividadesUnicas[i];
        let btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-tag";
        btn.innerText = nombre;

        btn.onclick = function () {
            document.getElementById("actividad").value = nombre;
        };

        contenedor.appendChild(btn);
    }
}

function setAutoMomento() {
    let select = document.getElementById("jornada");
    if (!select) return;

    let horaActual = new Date().getHours();
    
    if (horaActual >= 5 && horaActual < 13) {
        select.value = "Mañana";
    } else if (horaActual >= 13 && horaActual < 20) {
        select.value = "Tarde";
    } else {
        select.value = "Noche";
    }
}

function calcularRacha() {
    let contenedor = document.getElementById("rachaFuego");
    if (!contenedor) return;

    if (registros.length === 0) {
        contenedor.innerHTML = "🔥 0 días";
        return;
    }

    let fechasGuardadas = [];
    for (let i = 0; i < registros.length; i++) {
        let fechaRegistro = registros[i].fecha;
        
        if (fechaRegistro !== undefined && fechaRegistro !== null) {
            let yaExiste = false;
            for (let j = 0; j < fechasGuardadas.length; j++) {
                if (fechasGuardadas[j] === fechaRegistro) {
                    yaExiste = true;
                    break; 
                }
            }
            if (yaExiste === false) {
                fechasGuardadas.push(fechaRegistro);
            }
        }
    }

    fechasGuardadas.sort(function(a, b) {
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
    });

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
        
        return anio + "-" + mes + "-" + dia;
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
            racha = racha + 1;
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
    
    setTimeout(function() {
        toast.className = "toast-hidden";
    }, 3000);
}

function generarRutinaIdeal() {
    let contenedor = document.getElementById("rutinaContenedor");
    if (contenedor === null) return;

    if (registros.length < 5) {
        contenedor.innerHTML = "<p class='texto-secundario span-3-cols'>Cargá más datos (al menos 5 registros) para generar una rutina.</p>";
        return;
    }

    let promediosPorJornada = {
        "Mañana": {},
        "Tarde": {},
        "Noche": {}
    };

    for (let i = 0; i < registros.length; i++) {
        let r = registros[i];
        let jor = r.jornada;
        let act = r.actividad;
        
        if (promediosPorJornada[jor] !== undefined) {
            if (promediosPorJornada[jor][act] === undefined) {
                promediosPorJornada[jor][act] = { suma: 0, cantidad: 0 };
            }
            let score = calcularScore(r);
            promediosPorJornada[jor][act].suma = promediosPorJornada[jor][act].suma + score;
            promediosPorJornada[jor][act].cantidad = promediosPorJornada[jor][act].cantidad + 1;
        }
    }

    let rutina = {
        "Mañana": "Libre",
        "Tarde": "Libre",
        "Noche": "Libre"
    };

    let actividadesUsadas = [];
    let momentos = ["Mañana", "Tarde", "Noche"];
    
    for (let i = 0; i < momentos.length; i++) {
        let jor = momentos[i];
        let actividades = promediosPorJornada[jor];
        
        let mejorActividad = "Libre";
        let mejorPromedio = -1;

        for (let act in actividades) {
            let yaUsada = false;
            for (let k = 0; k < actividadesUsadas.length; k++) {
                if (actividadesUsadas[k] === act) {
                    yaUsada = true;
                }
            }

            if (yaUsada === false) {
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
        contenedor.innerHTML = contenedor.innerHTML + htmlCaja;
    }
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

            await agregarRegistro(actividad, jornada, energia, enfoque, animo);
            form.reset();
            mostrarToast();
        });
    }
    setAutoMomento();
    cargarRegistrosDesdeBD();
});