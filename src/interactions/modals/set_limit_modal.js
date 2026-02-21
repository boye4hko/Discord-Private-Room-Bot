const { successEmbed, errorEmbed } = require('../../utils/helpers');
const logger = require('../../utils/logger');

module.exports = {
    customId: 'set_limit_modal',
    async execute(interaction) {
        try {
            const limitInput = interaction.fields.getTextInputValue('limit_field').trim();
            const voiceChannel = interaction.member.voice.channel;

            if (!voiceChannel) {
                return await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Вы должны находиться в голосовом канале.', interaction.guild)],
                    ephemeral: true
                });
            }

            const limit = parseInt(limitInput, 10);
            if (isNaN(limit) || limit < 0 || limit > 99) {
                return await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Введите число от 0 до 99.', interaction.guild)],
                    ephemeral: true
                });
            }

            await voiceChannel.setUserLimit(limit);

            const limitText = limit === 0 ? 'Без ограничений' : `${limit} пользователей`;

            await interaction.reply({
                embeds: [successEmbed(
                    'Лимит установлен',
                    `Максимум пользователей: **${limitText}**`,
                    interaction.guild
                )],
                ephemeral: true
            });

            logger.info('Лимит установлен', { limit, channelId: voiceChannel.id });
        } catch (error) {
            logger.error('Ошибка установки лимита:', error.message);
            try {
                await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Не удалось установить лимит.', interaction.guild)],
                    ephemeral: true
                });
            } catch (e) {}
        }
    }
};
