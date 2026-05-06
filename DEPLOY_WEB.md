# Publicar como web

La app queda publicada como un unico servicio web: Express sirve la API (`/api`) y tambien el frontend compilado de React (`dist`).

## Opcion recomendada: Render

El repo incluye `render.yaml`, que crea un Web Service con Node, disco persistente y las variables necesarias.

1. Sube los cambios a GitHub.
2. En Render, entra a `Blueprints` y conecta este repositorio.
3. Render detecta `render.yaml`.
4. Cuando pida el valor secreto `AUTH_PASSWORD`, carga:

```bash
TAG123
```

El usuario queda configurado como `Maru`.

Si preferis crear el servicio manualmente en lugar de Blueprint:

```bash
Build command: npm ci && npm run build
Start command: npm start
```

Variables de entorno:

```bash
DB_PATH=/var/data/data.db
SEED_DEMO_DATA=false
AUTH_USER=Maru
AUTH_PASSWORD=TAG123
SESSION_SECRET=una_clave_larga_aleatoria
```

Render inyecta `PORT` automaticamente, y el servidor ya lo toma.

Agrega un disco persistente:

```bash
Mount path: /var/data
Size: 1 GB
```

Render indica que los discos persistentes requieren un servicio pago. Sin disco persistente, los datos de SQLite se pueden perder al redeploy/restart.

## Dominio nxia-lab.com en Render

Recomendado:

```bash
gestion.nxia-lab.com
```

Pasos:

1. En Render, abre el servicio `gestion-propiedades`.
2. Ve a `Settings` -> `Custom Domains`.
3. Agrega `gestion.nxia-lab.com`.
4. En el DNS de `nxia-lab.com`, crea un registro:

```bash
Type: CNAME
Name: gestion
Value: gestion-propiedades.onrender.com
```

Usa el valor exacto `onrender.com` que Render te muestre si es distinto.

Si queres usar el dominio raiz `nxia-lab.com`, Render puede pedir:

```bash
Type: A
Name: @
Value: 216.24.57.1
```

Elimina registros `AAAA` si existen, porque Render usa IPv4 para dominios custom.

Despues vuelve a Render y presiona `Verify`.

## Uso local

```bash
npm install
npm run dev
```

Cliente local: `http://localhost:3000`
API local: `http://localhost:5000`

## Probar modo produccion local

```bash
npm run build
npm start
```

Abre `http://localhost:5000`.

## Nota sobre SQLite

Si publicas sin disco persistente, la app puede funcionar, pero los datos creados se pueden perder al reiniciar o redesplegar el servicio. Para uso real, usa un disco persistente o migra la base a PostgreSQL.
