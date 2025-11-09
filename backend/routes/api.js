const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Verificar que JWT_SECRET esté configurado
if (!process.env.JWT_SECRET) {
  console.error(
    "⚠️ JWT_SECRET no está configurado en las variables de entorno"
  );
  process.exit(1);
}

// small helper to validate amounts
function isValidAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

// JWT authentication middleware
function authenticateToken(req, res, next) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader)
    return res.status(401).json({ error: "No token proporcionado" });
  const parts = authHeader.split(" ");
  const token = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : null;
  if (!token) return res.status(401).json({ error: "Token inválido" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// Endpoint para verificar si un usuario existe
router.get("/users/check/:username", async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username });
    return res.json({ exists: !!user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al verificar usuario" });
  }
});

// Register endpoint
router.post("/register", async (req, res) => {
  try {
    const { username, password, balance } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Credenciales incompletas",
      });
    }

    // Verificar si el usuario ya existe
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "El usuario ya existe en la base de datos",
      });
    }

    const user = new User({
      username,
      password,
      balance: balance || 1000, // Balance inicial por defecto
      cardStatus: "active",
      transactions: [],
    });
    await user.save();

    const token = jwt.sign(
      { username: user.username, id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    return res.status(201).json({ success: true, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error del servidor" });
  }
});

// Requerimiento 1: Consultar saldo (protegido)
router.get("/balance/:username", authenticateToken, async (req, res) => {
  try {
    // Only allow the authenticated user to view their own balance
    if (req.user.username !== req.params.username)
      return res.status(403).json({ error: "Acceso denegado" });
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json({ balance: user.balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error del servidor" });
  }
});

// Requerimiento 2: Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Credenciales incompletas" });

    const user = await User.findOne({ username });
    if (!user)
      return res
        .status(401)
        .json({ success: false, error: "Credenciales inválidas" });

    const match = user.comparePassword(password);
    if (!match)
      return res
        .status(401)
        .json({ success: false, error: "Credenciales inválidas" });

    // Issue JWT
    const token = jwt.sign(
      { username: user.username, id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    return res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error del servidor" });
  }
});

// Requerimiento 3: Transferencia (protegido)
router.post("/transfer", authenticateToken, async (req, res) => {
  const { from, to, amount } = req.body;

  // Validaciones básicas
  if (!from || !to || amount === undefined) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }
  if (from === to) {
    return res
      .status(400)
      .json({ error: "No se puede transferir al mismo usuario" });
  }
  if (!isValidAmount(amount)) {
    return res.status(400).json({ error: "Monto inválido" });
  }
  if (req.user.username !== from) {
    return res.status(403).json({ error: "No autorizado" });
  }

  try {
    // 1. Verificar que el emisor existe y tiene fondos suficientes
    const sender = await User.findOne({ username: from });
    if (!sender) {
      return res.status(404).json({ error: "Cuenta de origen no encontrada" });
    }
    if (sender.balance < amount) {
      return res.status(400).json({ error: "Fondos insuficientes" });
    }

    // 2. Verificar que el receptor existe
    const receiver = await User.findOne({ username: to });
    if (!receiver) {
      return res.status(404).json({ error: "Cuenta destino no encontrada" });
    }

    // 3. Realizar la transferencia
    const now = new Date();

    // Actualizar emisor
    sender.balance -= amount;
    sender.transactions.push({
      type: "debit",
      amount,
      date: now,
    });
    await sender.save();

    // Actualizar receptor
    receiver.balance += amount;
    receiver.transactions.push({
      type: "credit",
      amount,
      date: now,
    });
    await receiver.save();

    return res.json({
      success: true,
      message: "Transferencia realizada con éxito",
      newBalance: sender.balance,
    });
  } catch (err) {
    console.error("Error en la transferencia:", err);
    return res.status(500).json({
      success: false,
      error: "Error al procesar la transferencia",
    });
  }
});

// Requerimiento 6: Estado de tarjeta (protegido)
router.get("/card/:username", authenticateToken, async (req, res) => {
  try {
    if (req.user.username !== req.params.username)
      return res.status(403).json({ error: "Acceso denegado" });
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json({ cardStatus: user.cardStatus });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error del servidor" });
  }
});

module.exports = router;
