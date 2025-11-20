const request = require('supertest');
const { io: Client } = require('socket.io-client');
const { app, server } = require('../src/index');
const { sequelize } = require('../src/config/database');
const { Usuario, Local, Producto, Mesa } = require('../src/models');
const { generateToken } = require('../src/config/jwt');

describe('Socket integration - comanda emissions', () => {
  let mesero, local, mesa, producto, token;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await sequelize.sync({ force: true });

    const admin = await Usuario.create({ nombre: 'Admin', email: 'a@test.local', password: 'password123', tipo: 'admin' });
    local = await Local.create({ nombre: 'Local Test', usuarioPropietarioId: admin.id });
    mesero = await Usuario.create({ nombre: 'Mesero', email: 'm@test.local', password: 'password123', tipo: 'atencion', localId: local.id });
    mesa = await Mesa.create({ nombre: 'Mesa', numero: 1, localId: local.id });
    producto = await Producto.create({ nombre: 'Pizza', precio: 30, costo: 10, tipo: 'comida', localId: local.id });
    token = generateToken({ id: mesero.id, email: mesero.email, tipo: mesero.tipo });
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  test('cocina should receive nueva-comanda with local scoping', (done) => {
    const URL = process.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
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
