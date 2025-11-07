const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

// Mengizinkan CORS dari semua origin
server.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    next();
});

server.use(middlewares);
server.use(router);

const port = 3000;
server.listen(port, '0.0.0.0', () => {
    console.log(`JSON Server berjalan di http://localhost:${port}`);
    console.log(`Untuk mengakses dari device lain, gunakan IP komputer ini`);
});