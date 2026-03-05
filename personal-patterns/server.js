const express = require("express");
const cors = require("cors");
const db = require("./database");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// 1. OBTENER TODOS LOS REGISTROS
app.get("/daily-logs", (req, res) => {
  db.all("SELECT * FROM daily_logs", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2. GUARDAR NUEVO REGISTRO
app.post("/daily-log", (req, res) => {
  const { fecha, actividad, jornada, energia, enfoque, animo } = req.body;
  db.run(
    `INSERT INTO daily_logs (fecha, actividad, jornada, energia, enfoque, animo) VALUES (?, ?, ?, ?, ?, ?)`,
    [fecha, actividad, jornada, energia, enfoque, animo],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ status: "ok", id: this.lastID });
    }
  );
});

// 3. BORRAR REGISTRO POR ID
app.delete("/daily-log/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM daily_logs WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ status: "ok", borrados: this.changes });
  });
});

// 4. API IMPACTO
app.get('/api/impacto/:actividad', (req, res) => {
    const actividad = req.params.actividad;
    const sql = `
        SELECT 
            AVG(CASE WHEN actividad = ? THEN enfoque ELSE NULL END) as con_actividad,
            AVG(CASE WHEN actividad != ? OR actividad IS NULL THEN enfoque ELSE NULL END) as sin_actividad
        FROM daily_logs
    `;

    db.get(sql, [actividad, actividad], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const con = row.con_actividad || 0;
        const sin = row.sin_actividad || 0;
        
        let impacto = 0;
        if (sin > 0) impacto = ((con - sin) / sin) * 100;

        res.json({
            actividad: actividad,
            impacto: impacto.toFixed(1),
            comparacion: `Días con: ${con.toFixed(1)} vs Días sin: ${sin.toFixed(1)}`
        });
    });
});

app.listen(3000, () => console.log("Servidor en http://localhost:3000"));