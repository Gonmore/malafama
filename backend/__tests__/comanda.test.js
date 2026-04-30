process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'malafama_test';

if (!/test/i.test(process.env.DB_NAME || '')) {
  throw new Error(`Unsafe DB_NAME for tests: ${process.env.DB_NAME}. Use a dedicated test database.`);
}

const request = require('supertest');
const { app, server } = require('../src/index');
const { sequelize } = require('../src/config/database');
const { Usuario, Local, Producto, Mesa, Comanda, Pedido } = require('../src/models');
const { generateToken } = require('../src/config/jwt');

describe('Comanda flow with notas and forzar', () => {
  let admin, mesero, local, mesa, producto, token;

  beforeAll(async () => {
    await sequelize.drop({ cascade: true });
    await sequelize.sync({ force: true });

    // Crear admin, local y mesero
    admin = await Usuario.create({ nombre: 'Admin', email: 'admin@test.local', password: 'password123', tipo: 'admin' });
    local = await Local.create({ nombre: 'Local Test', usuarioPropietarioId: admin.id });
    mesero = await Usuario.create({ nombre: 'Mesero', email: 'mesero@test.local', password: 'password123', tipo: 'atencion', localId: local.id });

    // Crear mesa y producto
    mesa = await Mesa.create({ nombre: 'Mesa Test', numero: 1, localId: local.id });
    producto = await Producto.create({ nombre: 'Hamburguesa', precio: 40, costo: 20, tipo: 'comida', localId: local.id });

    token = generateToken({ id: mesero.id, email: mesero.email, tipo: mesero.tipo });
  });

  afterAll(async () => {
    await sequelize.close();
    if (server?.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('should create comanda for mesa', async () => {
    const res = await request(app)
      .post('/api/v1/comandas')
      .set('Authorization', `Bearer ${token}`)
      .send({ mesaId: mesa.id });

    expect(res.status).toBe(201);
    expect(res.body.data.mesa.id).toBe(mesa.id);
  });

  test('creating new comanda without forzar should fail', async () => {
    const res = await request(app)
      .post('/api/v1/comandas')
      .set('Authorization', `Bearer ${token}`)
      .send({ mesaId: mesa.id });

    expect(res.status).toBe(400);
    expect(res.body.comandaExistente).toBeTruthy();
  });

  test('creating new comanda with forzar should succeed', async () => {
    const res = await request(app)
      .post('/api/v1/comandas')
      .set('Authorization', `Bearer ${token}`)
      .send({ mesaId: mesa.id, forzar: true });

    expect(res.status).toBe(201);
    const comandas = await Comanda.findAll({ where: { mesaId: mesa.id } });
    expect(comandas.length).toBe(2);
  });

  test('add pedidos with notas', async () => {
    // Get last comanda
    const comandas = await Comanda.findAll({ where: { mesaId: mesa.id }, order: [['created_at', 'DESC']] });
    const comanda = comandas[0];

    const res = await request(app)
      .post(`/api/v1/comandas/${comanda.id}/pedidos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pedidos: [{ productoId: producto.id, cantidad: 2, notas: 'sin cebolla' }] });

    expect(res.status).toBe(200);
    const pedido = await Pedido.findOne({ where: { comandaId: comanda.id } });
    expect(pedido.notas).toBe('sin cebolla');
  });

  test('mesas endpoint should include closed and delivered comandas from today', async () => {
    const comandas = await Comanda.findAll({ where: { mesaId: mesa.id }, order: [['created_at', 'ASC']] });
    const comandaToClose = comandas[0];

    const closeRes = await request(app)
      .put(`/api/v1/comandas/${comandaToClose.id}/cerrar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ metodoPago: 'efectivo' });

    expect(closeRes.status).toBe(200);

    const deliverRes = await request(app)
      .put(`/api/v1/comandas/${comandaToClose.id}/entregar`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(deliverRes.status).toBe(200);

    const mesasRes = await request(app)
      .get('/api/v1/mesas')
      .set('Authorization', `Bearer ${token}`);

    expect(mesasRes.status).toBe(200);
    const mesaFromList = (mesasRes.body?.data || []).find((m) => m.id === mesa.id);
    expect(mesaFromList).toBeTruthy();

    const includedClosedDelivered = (mesaFromList.comandas || []).find((c) => c.id === comandaToClose.id);
    expect(includedClosedDelivered).toBeTruthy();
    expect(includedClosedDelivered.estado).toBe('cerrada');
    expect(includedClosedDelivered.entregado).toBe(true);
  });
});
