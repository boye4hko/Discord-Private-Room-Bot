const { successEmbed, errorEmbed } = require('../../utils/helpers');
const logger = require('../../utils/logger');

module.exports = {
    customId: 'rename_room_modal',
    async execute(interaction) {
        try {
            const newName = interaction.fields.getTextInputValue('new_name_field').trim();
            const voiceChannel = interaction.member.voice.channel;

            if (!voiceChannel) {
                return await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Вы должны находиться в голосовом канале.', interaction.guild)],
                    ephemeral: true
                });
            }

            const oldName = voiceChannel.name;
            await voiceChannel.setName(newName);

            await interaction.reply({
                embeds: [successEmbed(
                    'Комната переименована',
                    `Название изменено с **${oldName}** на **${newName}**`,
                    interaction.guild
                )],
                ephemeral: true
            });

            logger.info('Комната переименована', { oldName, newName, channelId: voiceChannel.id });
        } catch (error) {
            logger.error('Ошибка переименования комнаты:', error.message);
            try {
                await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Не удалось переименовать комнату.', interaction.guild)],
                    ephemeral: true
                });
            } catch (e) {}
        }
    }
};
