const logger = require('../../utils/logger');

module.exports = {
    customId: 'create_room_btn',
    async execute(interaction) {
        const modal = {
            custom_id: 'create_room_modal',
            title: 'Создание приватной комнаты',
            components: [{
                type: 1,
                components: [{
                    type: 4,
                    custom_id: 'room_name_field',
                    label: 'Название комнаты',
                    style: 1,
                    placeholder: 'Введите название комнаты (макс. 32 символа)',
                    required: true,
                    max_length: 32
                }]
            }]
        };

        await interaction.showModal(modal);
    }
};
