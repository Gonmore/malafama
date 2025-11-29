'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('mesas', 'mesero_asignado_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Mesero asignado a esta mesa'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('mesas', 'mesero_asignado_id');
  }
};
