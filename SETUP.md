# 🏠 Gestión de Propiedades - Guía de Inicio

¡La aplicación ha sido completamente actualizada con funcionalidad real!

## ✅ Qué está funcionando

- ✨ **Backend Express** con base de datos SQLite
- 📊 **API REST** completamente funcional
- 🔗 **Frontend conectado a la API**
- 💾 **Persistencia de datos** (propiedades, inquilinos, transacciones, reservas)
- 📱 **Todas las pantallas actualizadas**:
  - Dashboard (datos reales)
  - Gestión de Propiedades
  - Gestión de Inquilinos
  - Finanzas (ingresos/gastos reales)
  - Calendario
  - Eventos

## 🚀 Cómo ejecutar el proyecto

### Paso 1: Instalar Node.js
1. Ve a https://nodejs.org/
2. Descarga la versión **LTS** (Long Term Support)
3. Instala siguiendo el asistente
4. Verifica la instalación abriendo PowerShell y escribiendo:
   ```
   node --version
   npm --version
   ```

### Paso 2: Instalar dependencias
```bash
cd "d:\Documents\Proyectos\RGLopez1982\Gestion-de-Propiedades"
npm install
```

### Paso 3: Ejecutar el proyecto

**Opción A: Ejecutar cliente y servidor juntos (recomendado)**
```bash
npm run dev
```

**Opción B: Ejecutar por separado**

Terminal 1 (Backend):
```bash
npm run server
```

Terminal 2 (Frontend):
```bash
npm run client
```

## 🌐 Acceso a la aplicación

- **Frontend**: http://localhost:3000
- **API Backend**: http://localhost:5000

## 📦 Estructura del Backend

El backend está configurado con:
- **Express.js** para la API
- **SQLite** para la base de datos (archivo `data.db`)
- **CORS** habilitado para comunicación con el frontend

### Endpoints disponibles

#### Propiedades
- `GET /api/properties` - Listar propiedades
- `GET /api/properties/:id` - Obtener propiedad
- `POST /api/properties` - Crear propiedad
- `PUT /api/properties/:id` - Actualizar propiedad
- `DELETE /api/properties/:id` - Eliminar propiedad

#### Inquilinos
- `GET /api/tenants` - Listar inquilinos
- `GET /api/tenants/:id` - Obtener inquilino
- `POST /api/tenants` - Crear inquilino
- `PUT /api/tenants/:id` - Actualizar inquilino
- `DELETE /api/tenants/:id` - Eliminar inquilino

#### Transacciones
- `GET /api/transactions` - Listar transacciones
- `POST /api/transactions` - Crear transacción

#### Reservas
- `GET /api/bookings` - Listar reservas
- `POST /api/bookings` - Crear reserva

## 💡 Datos de ejemplo

La base de datos se auto-inicializa con datos de ejemplo:
- 4 propiedades
- 3 inquilinos
- 6 transacciones iniciales

Puedes agregar más datos usando los formularios en la aplicación.

## 🔧 Configuración personalizada

Edita `server.ts` para cambiar:
- Puerto del servidor (default: 5000)
- Puerto del cliente (default: 3000)
- Estructura de la base de datos
- Endpoints de la API

## 📝 Notas

- Los datos se guardan en `data.db` (ignorado en .gitignore)
- El servidor se reiniciará automáticamente en cambios (si usas nodemon)
- Asegúrate que los puertos 5000 y 3000 estén disponibles

¡Listo! Ya puedes empezar a usar la aplicación. 🎉
