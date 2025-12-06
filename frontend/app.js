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

const API = "http://192.168.88.153:3000/api";
let usuarioActual = null;

// Login real
const btnLogin = document.getElementById("btnLogin");
btnLogin.addEventListener("click", async() => {
    const usuario = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;
    if (!usuario || !password) {
        alert("Por favor ingresa usuario y contraseña.");
        return;
    }
    try {
        const res = await fetch(`${API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: usuario, password }),
        });
        const data = await res.json();
        if (data.success) {
            usuarioActual = usuario;
            // Guardar el token JWT
            localStorage.setItem("token", data.token);
            document.getElementById("nombreUsuario").textContent = usuario;
            document.getElementById("login").classList.remove("active");
            document.getElementById("dashboard").classList.add("active");
            // Consultar saldo real
            await actualizarDashboard();
        } else {
            alert(data.error || "Credenciales incorrectas");
        }
    } catch (err) {
        alert("Error de conexión al servidor");
    }
});

// Consultar saldo real y mostrar en dashboard
async function mostrarSaldo() {
    if (!usuarioActual) return;
    try {
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Sesión expirada. Por favor, inicie sesión nuevamente.");
            cerrarSesion();
            return;
        }
        const res = await fetch(`${API}/balance/${usuarioActual}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await res.json();
        const saldo = data.balance !== undefined ? `$${data.balance}` : "-";
        document.querySelector(".card.balance p").textContent = saldo;
    } catch (err) {
        document.querySelector(".card.balance p").textContent = "Error";
    }
}

// Consultar estado de la tarjeta y mostrar en dashboard
async function mostrarEstadoTarjeta() {
    if (!usuarioActual) return;
    try {
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Sesión expirada. Por favor, inicie sesión nuevamente.");
            cerrarSesion();
            return;
        }
        const res = await fetch(`${API}/card/${usuarioActual}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await res.json();
        document.getElementById("estadoTarjeta").textContent =
            data.cardStatus || "-";
    } catch (err) {
        document.getElementById("estadoTarjeta").textContent = "Error";
    }
}

// Consultar movimientos y mostrar en la tabla
async function mostrarMovimientos() {
    if (!usuarioActual) return;
    try {
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Sesión expirada. Por favor, inicie sesión nuevamente.");
            cerrarSesion();
            return;
        }
        // Obtener usuario completo para acceder a transactions
        const res = await fetch(`${API}/balance/${usuarioActual}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await res.json();
        // Suponiendo que el backend devuelve transactions en el usuario
        const movimientos = data.transactions || [];
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
    } catch (err) {
        document.getElementById("tablaMovimientos").innerHTML =
            '<tr><td colspan="3">Error al cargar movimientos</td></tr>';
    }
}

// Actualizar dashboard tras login
async function actualizarDashboard() {
    await mostrarSaldo();
    await mostrarEstadoTarjeta();
    await mostrarMovimientos();
}

// Transferencia real
const btnTransferir = document.getElementById("btnTransferir");
btnTransferir.addEventListener("click", async() => {
    const cuenta = document.getElementById("cuenta").value;
    const monto = parseFloat(document.getElementById("monto").value);
    if (!cuenta || !monto || monto <= 0) {
        alert("Completa los campos correctamente.");
        return;
    }
    if (!usuarioActual) {
        alert("Debes iniciar sesión primero.");
        return;
    }
    try {
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Sesión expirada. Por favor, inicie sesión nuevamente.");
            cerrarSesion();
            return;
        }
        const res = await fetch(`${API}/transfer`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ from: usuarioActual, to: cuenta, amount: monto }),
        });
        const data = await res.json();
        if (data.success) {
            alert(data.message || "Transferencia realizada");
            await actualizarDashboard();
        } else {
            alert(data.error || "Error en la transferencia");
        }
    } catch (err) {
        alert("Error de conexión al servidor");
    }
});

// Cerrar sesión
function cerrarSesion() {
    usuarioActual = null;
    localStorage.removeItem("token");
    document.querySelector(".card.balance p").textContent = "$0.00";
    screens.forEach((s) => s.classList.remove("active"));
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

// --- Registrar nuevo perfil ---
document.getElementById("btnRegistrar").addEventListener("click", async() => {
    const nombre = document.getElementById("nuevoNombre").value.trim();
    const cuenta = document.getElementById("nuevaCuenta").value.trim();
    const password = document.getElementById("nuevaPassword").value.trim();
    const saldo = parseFloat(document.getElementById("saldoInicial").value);

    // Validaciones del lado del cliente
    if (!cuenta || !password || isNaN(saldo)) {
        alert("Por favor, completa todos los campos correctamente.");
        return;
    }

    if (saldo < 0) {
        alert("El saldo inicial no puede ser negativo.");
        return;
    }

    try {
        // Primero verificamos si el usuario ya existe
        const verificacion = await fetch(`${API}/users/check/${cuenta}`);
        const verificacionData = await verificacion.json();

        if (verificacionData.exists) {
            alert(
                "❌ Este nombre de usuario ya está registrado. Por favor, elige otro."
            );
            return;
        }

        // Si el usuario no existe, procedemos con el registro
        const respuesta = await fetch(`${API}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: cuenta,
                password: password,
                balance: saldo,
            }),
        });

        const data = await respuesta.json();

        if (respuesta.ok && data.success) {
            alert(
                "✅ Usuario registrado correctamente. Ahora puedes iniciar sesión."
            );
            // Limpiar formulario
            document.getElementById("nuevoNombre").value = "";
            document.getElementById("nuevaCuenta").value = "";
            document.getElementById("nuevaPassword").value = "";
            document.getElementById("saldoInicial").value = "";
            // Redirigir al login
            screens.forEach((s) => s.classList.remove("active"));
            document.getElementById("login").classList.add("active");
        } else {
            // Mostrar el mensaje de error específico del servidor
            alert(data.error || "Error al registrar el usuario");
        }
    } catch (error) {
        console.error("Error:", error);
        alert("❌ Error al conectar con el servidor");
    }
});