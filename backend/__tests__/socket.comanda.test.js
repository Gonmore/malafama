process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'malafama_test';

if (!/test/i.test(process.env.DB_NAME || '')) {
  throw new Error(`Unsafe DB_NAME for tests: ${process.env.DB_NAME}. Use a dedicated test database.`);
}

jest.setTimeout(30000);

const request = require('supertest');
const { io: Client } = require('socket.io-client');
const { app, server, startServer } = require('../src/index');
const { sequelize } = require('../src/config/database');
const { Usuario, Local, Producto, Mesa } = require('../src/models');
const { generateToken } = require('../src/config/jwt');

describe('Socket integration - comanda emissions', () => {
  let mesero, local, mesa, producto, token;

  beforeAll(async () => {
    await sequelize.drop({ cascade: true });
    await sequelize.sync({ force: true });

    // Start an ephemeral server port for this test suite
    await startServer({ port: 0, startScheduler: false });

    const admin = await Usuario.create({ nombre: 'Admin', email: 'a@test.local', password: 'password123', tipo: 'admin' });
    local = await Local.create({ nombre: 'Local Test', usuarioPropietarioId: admin.id });
    mesero = await Usuario.create({ nombre: 'Mesero', email: 'm@test.local', password: 'password123', tipo: 'atencion', localId: local.id });
    mesa = await Mesa.create({ nombre: 'Mesa', numero: 1, localId: local.id });
    producto = await Producto.create({ nombre: 'Pizza', precio: 30, costo: 10, tipo: 'comida', localId: local.id });
    token = generateToken({ id: mesero.id, email: mesero.email, tipo: mesero.tipo });
  });

  afterAll(async () => {
    await sequelize.close();
    if (server?.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('cocina should receive nueva-comanda with local scoping', (done) => {
    const address = server.address();
    const URL = `http://127.0.0.1:${address.port}`;
    const client = new Client(URL, { transports: ['websocket'] });

    client.on('connect', () => {
      client.emit('join-room', `cocina:${local.id}`);

      client.once('nueva-comanda', (data) => {
        try {
          expect(data).toHaveProperty('comandaId');
          expect(data.pedidos.length).toBe(1);
          client.close();
          done();
        } catch (err) {
          client.close();
          done(err);
        }
      });

      // Create comanda with payload
      request(app)
      .post('/api/v1/comandas')
      .set('Authorization', `Bearer ${token}`)
      .send({ mesaId: mesa.id, pedidos: [{ productoId: producto.id, cantidad: 1 }] })
      .then(res => {
        expect(res.status).toBe(201);
      }).catch(err => {
        client.close();
        done(err);
      });
    });
  }, 10000);
});
