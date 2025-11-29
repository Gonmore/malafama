'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('pagos_proveedores', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      proveedor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'proveedores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      local_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'locales',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      fecha_inicio: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Fecha de inicio del período pagado'
      },
      fecha_fin: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Fecha de fin del período pagado'
      },
      monto_pagado: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Monto total pagado al proveedor'
      },
      comprobante_url: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'URL o base64 de la imagen del comprobante'
      },
      detalle: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Detalle de productos incluidos en el pago'
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      creado_por: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'usuarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Crear índice para búsquedas por proveedor y período
    await queryInterface.addIndex('pagos_proveedores', ['proveedor_id', 'fecha_inicio', 'fecha_fin'], {
      name: 'idx_pagos_proveedor_periodo'
    });

    // Crear índice para búsquedas por local
    await queryInterface.addIndex('pagos_proveedores', ['local_id'], {
      name: 'idx_pagos_local'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('pagos_proveedores');
  }
};
