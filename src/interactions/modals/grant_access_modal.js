const { successEmbed, errorEmbed } = require('../../utils/helpers');
const logger = require('../../utils/logger');

module.exports = {
    customId: 'grant_access_modal',
    async execute(interaction) {
        try {
            const username = interaction.fields.getTextInputValue('user_mention_field').trim();
            const voiceChannel = interaction.member.voice.channel;

            if (!voiceChannel) {
                return await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Вы должны находиться в голосовом канале.', interaction.guild)],
                    ephemeral: true
                });
            }

            let member = null;
            
            if (/^\d+$/.test(username)) {
                member = await interaction.guild.members.fetch(username).catch(() => null);
            } else {
                const members = await interaction.guild.members.fetch();
                member = members.find(m => m.user.username.toLowerCase() === username.toLowerCase() || m.displayName.toLowerCase() === username.toLowerCase());
            }

            if (!member) {
                return await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Пользователь не найден на этом сервере.', interaction.guild)],
                    ephemeral: true
                });
            }

            const userId = member.id;

            await voiceChannel.permissionOverwrites.create(userId, {
                ViewChannel: true,
                Connect: true,
                Speak: true
            });

            await interaction.reply({
                embeds: [successEmbed(
                    'Доступ предоставлен',
                    `${member.user.username} теперь имеет доступ к этой комнате.`,
                    interaction.guild
                )],
                ephemeral: true
            });

            logger.info('Доступ предоставлен', { userId, channelId: voiceChannel.id });
        } catch (error) {
            logger.error('Ошибка предоставления доступа:', error.message);
            try {
                await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Не удалось предоставить доступ.', interaction.guild)],
                    ephemeral: true
                });
            } catch (e) {}
        }
    }
};
