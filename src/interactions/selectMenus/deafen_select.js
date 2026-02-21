const { addDeafenedUser } = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
    customId: 'deafen_select',
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const userId = interaction.values[0];
            const voiceChannel = interaction.member.voice.channel;
            
            if (!voiceChannel) {
                return await interaction.editReply('Вы должны находиться в голосовом канале.');
            }

            const member = voiceChannel.guild.members.cache.get(userId);
            if (!member) {
                return await interaction.editReply('Пользователь не найден.');
            }

            await member.voice.setDeaf(true);
            await addDeafenedUser(voiceChannel.id, userId, true);

            await interaction.editReply({
                content: `${member.user.username} задисаблен.`
            });

            logger.info('Участник задисаблен', { userId, channelId: voiceChannel.id });
        } catch (error) {
            logger.error('Ошибка deafen select:', error.message);
            await interaction.editReply('Произошла ошибка.');
        }
    }
};
