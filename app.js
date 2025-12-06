// Navegación entre pantallas
const buttons = document.querySelectorAll("[data-target]");
const screens = document.querySelectorAll(".screen");

buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-target");
        screens.forEach((s) => s.classList.remove("active"));
        document.getElementById(target).classList.add("active");
    });
});

// Datos simulados en localStorage
const initializeDemoData = () => {
    if (!localStorage.getItem("usuarios")) {
        const usuariosDemo = {
            juan: {
                username: "juan",
                password: "1234",
                balance: 5000,
                cardStatus: "Activa",
                transactions: [
                    { type: "credit", amount: 500, date: new Date(Date.now() - 86400000), description: "Depósito" },
                    { type: "debit", amount: 200, date: new Date(Date.now() - 172800000), description: "Transferencia enviada" }
                ]
            },
            maria: {
                username: "maria",
                password: "1234",
                balance: 8500,
                cardStatus: "Activa",
                transactions: [
                    { type: "credit", amount: 1000, date: new Date(Date.now() - 86400000), description: "Transferencia recibida" },
                    { type: "debit", amount: 300, date: new Date(Date.now() - 259200000), description: "Transferencia enviada" }
                ]
            },
            pedro: {
                username: "pedro",
                password: "1234",
                balance: 3200,
                cardStatus: "Activa",
                transactions: []
            }
        };
        localStorage.setItem("usuarios", JSON.stringify(usuariosDemo));
    }
};

initializeDemoData();

const API = "http://192.168.88.153:3000/api";
let usuarioActual = null;

// Login con datos de demostración
const btnLogin = document.getElementById("btnLogin");
btnLogin.addEventListener("click", async() => {
    const usuario = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;
    if (!usuario || !password) {
        alert("Por favor ingresa usuario y contraseña.");
        return;
    }

    // Demo: Validar contra usuarios simulados
    const usuarios = JSON.parse(localStorage.getItem("usuarios"));
    const usuarioEncontrado = usuarios[usuario];

    if (usuarioEncontrado && usuarioEncontrado.password === password) {
        usuarioActual = usuario;
        localStorage.setItem("token", "demo-token-" + usuario);
        document.getElementById("nombreUsuario").textContent = usuario;
        document.getElementById("login").classList.remove("active");
        document.getElementById("dashboard").classList.add("active");
        await actualizarDashboard();
    } else {
        alert("❌ Credenciales incorrectas. Usa: juan, maria o pedro (contraseña: 1234)");
    }
});

// Consultar saldo simulado y mostrar en dashboard
async function mostrarSaldo() {
    if (!usuarioActual) return;
    const usuarios = JSON.parse(localStorage.getItem("usuarios"));
    const usuario = usuarios[usuarioActual];
    const saldo = usuario ? `$${usuario.balance}` : "-";
    document.querySelector(".card.balance p").textContent = saldo;
}

// Consultar estado de la tarjeta simulado y mostrar en dashboard
async function mostrarEstadoTarjeta() {
    if (!usuarioActual) return;
    const usuarios = JSON.parse(localStorage.getItem("usuarios"));
    const usuario = usuarios[usuarioActual];
    const cardStatus = usuario ? usuario.cardStatus : "-";
    document.getElementById("estadoTarjeta").textContent = cardStatus;
}

// Consultar movimientos simulados y mostrar en la tabla
async function mostrarMovimientos() {
    if (!usuarioActual) return;
    const usuarios = JSON.parse(localStorage.getItem("usuarios"));
    const usuario = usuarios[usuarioActual];
    const movimientos = usuario ? usuario.transactions || [] : [];
    const tbody = document.getElementById("tablaMovimientos");
    tbody.innerHTML = "";
    if (movimientos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">Sin movimientos</td></tr>';
        return;
    }
    movimientos
        .slice()
        .reverse()
        .forEach((mov) => {
            const fecha = mov.date ? new Date(mov.date).toLocaleDateString() : "-";
            const desc =
                mov.type === "debit" ?
                "Transferencia enviada" :
                "Transferencia recibida";
            const monto =
                mov.type === "debit" ? `- $${mov.amount}` : `+ $${mov.amount}`;
            tbody.innerHTML += `<tr><td>${fecha}</td><td>${desc}</td><td>${monto}</td></tr>`;
        });
}

// Actualizar dashboard tras login
async function actualizarDashboard() {
    await mostrarSaldo();
    await mostrarEstadoTarjeta();
    await mostrarMovimientos();
}

// Transferencia simulada
const btnTransferir = document.getElementById("btnTransferir");
btnTransferir.addEventListener("click", async() => {
    const cuenta = document.getElementById("cuenta").value;
    const monto = Number.parseFloat(document.getElementById("monto").value);
    if (!cuenta || !monto || monto <= 0) {
        alert("Completa los campos correctamente.");
        return;
    }
    if (!usuarioActual) {
        alert("Debes iniciar sesión primero.");
        return;
    }

    const usuarios = JSON.parse(localStorage.getItem("usuarios"));

    // Verificar que ambos usuarios existan
    if (!usuarios[usuarioActual] || !usuarios[cuenta]) {
        alert("❌ La cuenta destino no existe.");
        return;
    }

    // Verificar que haya saldo suficiente
    if (usuarios[usuarioActual].balance < monto) {
        alert("❌ Saldo insuficiente para realizar la transferencia.");
        return;
    }

    // Realizar la transferencia
    usuarios[usuarioActual].balance -= monto;
    usuarios[cuenta].balance += monto;

    // Registrar transacciones
    usuarios[usuarioActual].transactions.push({
        type: "debit",
        amount: monto,
        date: new Date(),
        description: `Transferencia a ${cuenta}`
    });

    usuarios[cuenta].transactions.push({
        type: "credit",
        amount: monto,
        date: new Date(),
        description: `Transferencia de ${usuarioActual}`
    });

    localStorage.setItem("usuarios", JSON.stringify(usuarios));
    alert("✅ Transferencia realizada exitosamente");
    await actualizarDashboard();

    // Limpiar formulario
    document.getElementById("cuenta").value = "";
    document.getElementById("monto").value = "";
    document.getElementById("descripcion").value = "";
});

// Cerrar sesión
function cerrarSesion() {
    usuarioActual = null;
    localStorage.removeItem("token");
    document.querySelector(".card.balance p").textContent = "$0.00";
    for (const s of screens) {
        s.classList.remove("active");
    }
    document.getElementById("login").classList.add("active");
}

const btnLogout = document.getElementById("logout");
btnLogout.addEventListener("click", cerrarSesion);

// Modo oscuro
const toggleDarkMode = document.getElementById("toggleDarkMode");
toggleDarkMode.addEventListener("change", () => {
    document.body.classList.toggle("dark", toggleDarkMode.checked);
});

// Mostrar movimientos al entrar en la pantalla de movimientos
const btnMovimientos = document.querySelector(
    "button[data-target='movimientos']"
);
btnMovimientos.addEventListener("click", mostrarMovimientos);

// --- Registrar nuevo perfil (Demo) ---
document.getElementById("btnRegistrar").addEventListener("click", async() => {
    const cuenta = document.getElementById("nuevaCuenta").value.trim();
    const password = document.getElementById("nuevaPassword").value.trim();
    const saldo = Number.parseFloat(document.getElementById("saldoInicial").value);

    // Validaciones del lado del cliente
    if (!cuenta || !password || Number.isNaN(saldo)) {
        alert("Por favor, completa todos los campos correctamente.");
        return;
    }

    if (saldo < 0) {
        alert("El saldo inicial no puede ser negativo.");
        return;
    }

    const usuarios = JSON.parse(localStorage.getItem("usuarios"));

    // Verificar si el usuario ya existe
    if (usuarios[cuenta]) {
        alert(
            "❌ Este nombre de usuario ya está registrado. Por favor, elige otro."
        );
        return;
    }

    // Crear nuevo usuario
    usuarios[cuenta] = {
        username: cuenta,
        password: password,
        balance: saldo,
        cardStatus: "Activa",
        transactions: []
    };

    localStorage.setItem("usuarios", JSON.stringify(usuarios));
    alert(
        "✅ Usuario registrado correctamente. Ahora puedes iniciar sesión."
    );

    // Limpiar formulario
    document.getElementById("nuevoNombre").value = "";
    document.getElementById("nuevaCuenta").value = "";
    document.getElementById("nuevaPassword").value = "";
    document.getElementById("saldoInicial").value = "";

    // Redirigir al login
    for (const s of screens) {
        s.classList.remove("active");
    }
    document.getElementById("login").classList.add("active");
});