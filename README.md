# Quiniela Mundial 2026

App familiar para predecir partidos desde dieciseisavos hasta la final, guardar marcadores y goleadores, y calcular la tabla automaticamente.

## Puntos

- Ganador correcto: 3 puntos
- Marcador exacto de cada equipo: 1 punto por equipo
- Al menos 1 goleador correcto: 1 punto
- Maximo por partido: 6 puntos
- Si hay penales, al ganador de los penales se le suma 1 gol. Ejemplo: 2-2 y gana equipo 1 por penales cuenta como 3-2.

## Desarrollo local

```bash
npm install
cd client
npm install
cd ..
npm run dev:server
```

En otra terminal:

```bash
cd client
npm run dev
```

Sin `DATABASE_URL`, el servidor usa una base en memoria para demo. Para datos reales usa Postgres.

## Deploy en Railway

1. Sube esta carpeta a GitHub.
2. En Railway crea un proyecto desde el repo.
3. Agrega un plugin de PostgreSQL.
4. Define estas variables:

```bash
DATABASE_URL=la_url_del_postgres_de_railway
JWT_SECRET=un_secreto_largo
NODE_ENV=production
LOCK_MINUTES_BEFORE_MATCH=0
AUTO_SYNC_MINUTES=20
CRON_SECRET=otro_secreto_largo
```

Railway usa `railway.toml`:

```bash
npm install && npm run build
npm start
```

## Deploy con Netlify

Netlify puede alojar el frontend y consumir la API desplegada en Railway.

1. Despliega el backend completo en Railway.
2. En Netlify, selecciona la carpeta `client`.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Variable de entorno:

```bash
VITE_API_URL=https://tu-api-en-railway.up.railway.app
```

## Sincronizacion automatica de resultados

La app recalcula la tabla automaticamente cada vez que cambian los resultados. Para traer marcadores desde una API deportiva configura uno de estos proveedores:

### API-Football

```bash
API_FOOTBALL_KEY=tu_llave
API_FOOTBALL_LEAGUE_ID=1
API_FOOTBALL_SEASON=2026
AUTO_SYNC_MINUTES=20
```

### football-data.org

```bash
FOOTBALL_DATA_API_KEY=tu_llave
FOOTBALL_DATA_COMPETITION=WC
FOOTBALL_DATA_SEASON=2026
AUTO_SYNC_MINUTES=20
```

Si tu proveedor no incluye goleadores, puedes cargarlos manualmente desde Admin. Los puntajes se recalculan al instante.

Tambien puedes llamar el sync desde un cron externo:

```bash
curl "https://tu-app.railway.app/api/sync/results?secret=CRON_SECRET"
```

## Uso

- El primer usuario registrado sera administrador.
- Cada familiar crea su usuario y llena sus predicciones.
- El servidor bloquea predicciones cuando llega la hora del partido.
- Admin puede editar equipos, horarios, marcadores, penales y goleadores.
