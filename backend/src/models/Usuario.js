const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const Usuario = sequelize.define('Usuario', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nombre: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  tipo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['admin', 'atencion', 'cocina', 'bar', 'proveedor']]
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  onboarding_completado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indica si el usuario admin completó la configuración inicial'
  },
  localId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'local_id',
    comment: 'Local al que pertenece el empleado (atención, cocina, bar). NULL para admin propietario'
  },
  rolCocina: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'rol_cocina',
    validate: {
      isIn: [['cocina', 'bar']]
    },
    comment: 'Para usuarios tipo cocina/bar: especifica si trabaja en cocina o bar'
  }
  ,
  foto: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Foto del usuario (URL o Base64)'
  }
  ,
  fotoUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true,
    field: 'foto_url',
    comment: 'URL pública al archivo de foto del usuario (en /uploads o CDN)'
  }
}, {
  tableName: 'usuarios',
  hooks: {
    beforeCreate: async (usuario) => {
      if (usuario.password) {
        const salt = await bcrypt.genSalt(10);
        usuario.password = await bcrypt.hash(usuario.password, salt);
      }
    },
    beforeUpdate: async (usuario) => {
      if (usuario.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        usuario.password = await bcrypt.hash(usuario.password, salt);
      }
    }
  }
});

// Método de instancia para comparar passwords
Usuario.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para ocultar password en JSON
Usuario.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = Usuario;
