const form = document.getElementById("formRegistro");
const lista = document.getElementById("listaPatrones");

/* RENDER PATRONES*/
function mostrarPatrones() {
    const patrones = calcularImpactos();
    lista.innerHTML = "";
    patrones.forEach(p => {
        const item = document.createElement("p");
        item.textContent =
            `${p.actividad} → impacto ${p.impacto}% en enfoque`;

        lista.appendChild(item);
    });
}


/* EVENTO FORM*/
form.addEventListener("submit", function(e) {
    e.preventDefault();
    const actividad = document.getElementById("actividad").value;
    const energia = document.getElementById("energia").value;
    const enfoque = document.getElementById("enfoque").value;
    const animo = document.getElementById("animo").value;

    agregarRegistro(actividad, energia, enfoque, animo);
    mostrarPatrones();
    form.reset();
});

function mostrarScore() {
    let score = calcularScoreDelDia();
    let contenedor = document.getElementById("score");
    contenedor.innerText = "Performance del día: " + score + "%";
}

function mostrarComparacion() {
    let mensaje = compararConAyer();
    let contenedor = document.getElementById("comparacion");
    contenedor.innerText = mensaje;
}

function mostrarInsights() {
    let lista = detectarInsights();
    let contenedor = document.getElementById("insights");
    contenedor.innerHTML = "";

    for (let i = 0; i < lista.length; i++) {
        let p = document.createElement("p");
        p.innerText = lista[i];
        contenedor.appendChild(p);
    }
}

function dibujarGrafico() {
    let canvas = document.getElementById("grafico");
    let ctx = canvas.getContext("2d");
    let scores = obtenerScores();

    // limpiar gráfico
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (scores.length === 0) return;

    let espacioX = canvas.width / scores.length;

    ctx.beginPath();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;          

    for (let i = 0; i < scores.length; i++) {
        let x = i * espacioX;
        let y = canvas.height - (scores[i] * 2);
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}