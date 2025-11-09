require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const User = require("./models/User");

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a MongoDB usando variable de entorno
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch((err) => console.error("❌ Error al conectar a MongoDB:", err));

// Importar y usar las rutas de API
const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);

// Puerto
app.listen(3000, () =>
  console.log("🚀 Servidor backend corriendo en http://localhost:3000")
);
