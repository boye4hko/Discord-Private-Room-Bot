const logger = require('../utils/logger');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (interaction.isCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (command) await command.execute(interaction);
            } else if (interaction.isAutocomplete && interaction.isAutocomplete()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (command && typeof command.autocomplete === 'function') {
                    await command.autocomplete(interaction);
                }
            } 
            else if (interaction.isButton()) {
                const button = interaction.client.buttons.get(interaction.customId);
                if (button) await button.execute(interaction);
            }
            else if (interaction.isStringSelectMenu()) {
                const selectMenu = interaction.client.selectMenus.get(interaction.customId);
                if (selectMenu) await selectMenu.execute(interaction);
            }
            else if (interaction.isModalSubmit()) {
                const modal = interaction.client.modals.get(interaction.customId);
                if (modal) await modal.execute(interaction);
            }
        } catch (error) {
            logger.error('Ошибка взаимодействия:', error.message);
            try {
                await interaction.reply({
                    content: 'Произошла ошибка при обработке запроса.',
                    ephemeral: true
                }).catch(() => {});
            } catch (e) {}
        }
    }
};
