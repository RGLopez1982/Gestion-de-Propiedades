# 🏠 Sistema de Gestión de Propiedades

Una aplicación completa de gestión de propiedades inmobiliarias con backend funcional, base de datos y frontend React.

## 🎯 Características

### ✅ Completamente funcional
- **Dashboard** - Resumen de ingresos, gastos, balance y reservas
- **Gestión de Propiedades** - Crear, editar, eliminar y listar propiedades
- **Gestión de Inquilinos** - Directorio completo de inquilinos
- **Finanzas** - Tracking de transacciones, ingresos y gastos
- **Calendario** - Disponibilidad de propiedades
- **Reservas** - Sistema de booking de propiedades
- **API REST** - Backend Express con SQLite

### 🔐 Datos Persistentes
- Base de datos SQLite local (automática)
- Datos se guardan automáticamente
- Sin dependencias externas necesarias

## 🚀 Inicio Rápido

### Requisitos
- Node.js 16+ (descargar desde https://nodejs.org/)
- npm (incluido con Node.js)

### Instalación

1. **Abre PowerShell** en la carpeta del proyecto
2. **Instala dependencias**:
   ```bash
   npm install
   ```

3. **Ejecuta el proyecto**:
   ```bash
   npm run dev
   ```

Eso es todo. El proyecto se iniciará automáticamente en:
- Cliente: http://localhost:3000
- API: http://localhost:5000

## 📁 Estructura del Proyecto

```
├── src/
│   ├── screens/          # Pantallas principales
│   ├── components/       # Componentes React
│   ├── services/         # Cliente API
│   └── lib/             # Utilidades
├── server.ts             # Backend Express
├── vite.config.ts        # Configuración de Vite
└── package.json         # Dependencias
```

## 🔧 Desarrollo

### Ejecutar en modo desarrollo
```bash
npm run dev
```

### Ejecutar solo el servidor
```bash
npm run server
```

### Ejecutar solo el cliente
```bash
npm run client
```

### Build para producción
```bash
npm run build
```

## 📊 API Endpoints

### Propiedades
- `GET /api/properties` - Listar propiedades
- `POST /api/properties` - Crear propiedad
- `PUT /api/properties/:id` - Actualizar
- `DELETE /api/properties/:id` - Eliminar

### Inquilinos
- `GET /api/tenants` - Listar inquilinos
- `POST /api/tenants` - Crear inquilino
- `PUT /api/tenants/:id` - Actualizar
- `DELETE /api/tenants/:id` - Eliminar

### Transacciones
- `GET /api/transactions` - Listar transacciones
- `POST /api/transactions` - Crear transacción

### Reservas
- `GET /api/bookings` - Listar reservas
- `POST /api/bookings` - Crear reserva

## 💾 Base de Datos

La aplicación usa SQLite con las siguientes tablas:
- **properties** - Propiedades inmobiliarias
- **tenants** - Información de inquilinos
- **transactions** - Registro de pagos e gastos
- **bookings** - Reservas de propiedades
- **events** - Eventos de propiedades

Datos de ejemplo se cargan automáticamente en la primera ejecución.

## 🛠 Stack Tecnológico

### Frontend
- React 19
- TypeScript
- Tailwind CSS
- Vite
- React Router

### Backend
- Express.js
- SQLite (better-sqlite3)
- CORS

### Herramientas
- TypeScript
- npm

## 📝 Scripts Disponibles

- `npm run dev` - Inicia cliente y servidor
- `npm run server` - Inicia solo el backend
- `npm run client` - Inicia solo el frontend
- `npm run build` - Build para producción
- `npm run lint` - Valida TypeScript

## 🐛 Troubleshooting

### Error: "npm not found"
- Instala Node.js desde https://nodejs.org/

### Puerto 5000 o 3000 en uso
- Cambia los puertos en `server.ts` y `vite.config.ts`

### Base de datos corrupta
- Elimina el archivo `data.db` y reinicia la aplicación

### Proxy API no funciona
- Verifica que el servidor esté corriendo en puerto 5000
- Revisa la consola para errores

## 📄 Licencia

Este proyecto fue creado con ❤️ para gestionar propiedades de manera sencilla.

---

**¿Necesitas ayuda?** Revisa los archivos SETUP.md para instrucciones detalladas.

