const jwt = require('jsonwebtoken');

const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key',
  expiresIn: process.env.JWT_EXPIRE || '7d'
};

// Generar token JWT
const generateToken = (payload) => {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn
  });
};

// Verificar token JWT
const verifyToken = (token) => {
  try {
    return jwt.verify(token, jwtConfig.secret);
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
};

module.exports = {
  jwtConfig,
  generateToken,
  verifyToken
};
