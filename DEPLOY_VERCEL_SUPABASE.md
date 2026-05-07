# Publicar gratis con Vercel + Supabase

Esta opcion usa:

- Vercel para la web y las funciones `/api`.
- Supabase PostgreSQL para guardar los datos.

## 1. Crear proyecto en Supabase

1. Entra a Supabase y crea un proyecto.
2. Ve a `SQL Editor`.
3. Pega y ejecuta el contenido de:

```bash
supabase/schema.sql
```

Eso crea las tablas `properties`, `tenants`, `transactions`, `bookings`, `events` y `settings`.

## 2. Obtener DATABASE_URL

En Supabase:

```bash
Project Settings -> Database -> Connection string
```

Para Vercel usa la connection string del **Transaction pooler**, porque Vercel usa funciones serverless. Debe verse similar a:

```bash
postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres
```

Reemplaza `[PASSWORD]` por la clave real del proyecto.

## 3. Crear proyecto en Vercel

1. Sube los cambios a GitHub.
2. En Vercel, importa el repositorio.
3. Framework: `Vite`.
4. Build command:

```bash
npm run build
```

5. Output directory:

```bash
dist
```

## 4. Variables de entorno en Vercel

En `Project Settings -> Environment Variables`, agrega:

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
AUTH_USER=Maru
AUTH_PASSWORD=TAG123
SESSION_SECRET=una_clave_larga_aleatoria
NODE_ENV=production
```

`SESSION_SECRET` puede ser cualquier texto largo y dificil de adivinar.

## 5. Dominio nxia-lab.com

Recomendado:

```bash
gestion.nxia-lab.com
```

En Vercel:

```bash
Project Settings -> Domains -> Add
```

Agrega:

```bash
gestion.nxia-lab.com
```

En el DNS de `nxia-lab.com`, crea el registro que Vercel te indique. Normalmente:

```bash
Type: CNAME
Name: gestion
Value: cname.vercel-dns-0.com
```

Usa siempre el valor exacto que Vercel te muestre en `Domains`, porque puede variar por proyecto.

Si quieres usar el dominio raiz `nxia-lab.com`, Vercel suele pedir:

```bash
Type: A
Name: @
Value: 76.76.21.21
```

## 6. Probar

Cuando Vercel termine el deploy:

1. Abre la URL de Vercel o `gestion.nxia-lab.com`.
2. Ingresa con:

```bash
Usuario: Maru
Contrasena: TAG123
```

3. Carga una propiedad de prueba.
4. Recarga la pagina y confirma que sigue guardada en Supabase.
