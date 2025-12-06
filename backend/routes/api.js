const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Verificar que JWT_SECRET esté configurado


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
router.get("/users/check/:username", async(req, res) => {
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
router.post("/register", async(req, res) => {
    try {
        const { username, password, balance } = req.body;
        if (!username || !password) {
            return res
                .status(400)
                .json({ success: false, error: "Credenciales incompletas" });
        }

        // Verificar si el usuario ya existe
        const existing = await User.findOne({ username });
        if (existing) {
            return res
                .status(409)
                .json({
                    success: false,
                    error: "El usuario ya existe en la base de datos",
                });
        }

        const user = new User({
            username,
            password,
            balance: balance || 1000,
            cardStatus: "active",
            transactions: [],
        });
        await user.save();

        const token = jwt.sign({ username: user.username, id: user._id },
            process.env.JWT_SECRET, { expiresIn: "1h" }
        );
        return res.status(201).json({ success: true, token });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error del servidor" });
    }
});

// Login endpoint
router.post("/login", async(req, res) => {
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
        const token = jwt.sign({ username: user.username, id: user._id },
            process.env.JWT_SECRET, { expiresIn: "1h" }
        );
        return res.json({ success: true, token });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error del servidor" });
    }
});

// Balance endpoint: devuelve balance, transactions y cardStatus
router.get("/balance/:username", authenticateToken, async(req, res) => {
    try {
        if (req.user.username !== req.params.username)
            return res.status(403).json({ error: "Acceso denegado" });
        const user = await User.findOne({ username: req.params.username }).select(
            "balance transactions cardStatus"
        );
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
        return res.json({
            balance: user.balance,
            transactions: user.transactions || [],
            cardStatus: user.cardStatus,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error del servidor" });
    }
});

// Transfer endpoint (mejorado: decremento atómico del emisor)
router.post("/transfer", authenticateToken, async(req, res) => {
    const { from, to, amount } = req.body;

    // Validaciones básicas
    if (!from || !to || amount === undefined)
        return res.status(400).json({ error: "Parámetros inválidos" });
    if (from === to)
        return res
            .status(400)
            .json({ error: "No se puede transferir al mismo usuario" });
    if (!isValidAmount(amount))
        return res.status(400).json({ error: "Monto inválido" });
    if (req.user.username !== from)
        return res.status(403).json({ error: "No autorizado" });

    try {
        const now = new Date();

        // 1) Intentar decrementar al emisor de forma atómica sólo si tiene fondos suficientes
        const updatedSender = await User.findOneAndUpdate({ username: from, balance: { $gte: amount } }, {
            $inc: { balance: -amount },
            $push: { transactions: { type: "debit", amount, date: now } },
        }, { new: true });

        if (!updatedSender)
            return res
                .status(400)
                .json({
                    success: false,
                    error: "Fondos insuficientes o cuenta de origen no encontrada",
                });

        // 2) Actualizar receptor
        const updatedReceiver = await User.findOneAndUpdate({ username: to }, {
            $inc: { balance: amount },
            $push: { transactions: { type: "credit", amount, date: now } },
        }, { new: true });

        if (!updatedReceiver) {
            // Receptor no existe: intentar revertir al emisor
            try {
                await User.findOneAndUpdate({ username: from }, {
                    $inc: { balance: amount },
                    $push: {
                        transactions: {
                            type: "reversal",
                            amount,
                            date: new Date(),
                            note: "rollback: receptor inexistente",
                        },
                    },
                });
            } catch (revertErr) {
                console.error(
                    "Error al revertir la transferencia tras receptor inexistente:",
                    revertErr
                );
            }
            return res
                .status(404)
                .json({
                    success: false,
                    error: "Cuenta destino no encontrada. Transferencia revertida si fue posible.",
                });
        }

        return res.json({
            success: true,
            message: "Transferencia realizada con éxito",
            newBalance: updatedSender.balance,
        });
    } catch (err) {
        console.error("Error en la transferencia:", err);
        return res
            .status(500)
            .json({ success: false, error: "Error al procesar la transferencia" });
    }
});

// Estado de tarjeta (protegido)
router.get("/card/:username", authenticateToken, async(req, res) => {
    try {
        if (req.user.username !== req.params.username)
            return res.status(403).json({ error: "Acceso denegado" });
        const user = await User.findOne({ username: req.params.username }).select(
            "cardStatus"
        );
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
        return res.json({ cardStatus: user.cardStatus });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error del servidor" });
    }
});

module.exports = router;