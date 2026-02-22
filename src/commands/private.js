const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { getRoomsByGuildId, getRoomByChannelId, deleteRoom, banUser, unbanUser } = require('../database/db');
const { successEmbed, errorEmbed } = require('../utils/helpers');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('private')
        .setDescription('Модерация приватных комнат')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('change')
                .setDescription('Сменить название приватной комнаты')
                .addStringOption(opt => opt.setName('room').setDescription('Название комнаты').setRequired(true).setAutocomplete(true))
                .addStringOption(opt => opt.setName('new_name').setDescription('Новое название').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Удалить приватную комнату')
                .addStringOption(opt => opt.setName('room').setDescription('Название комнаты').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(sub =>
            sub.setName('ban')
                .setDescription('Запретить пользователю создавать приватные комнаты')
                .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
                .addIntegerOption(opt => opt.setName('duration').setDescription('Длительность бана в минутах (0 = навсегда)'))
                .addStringOption(opt => opt.setName('reason').setDescription('Причина'))
        )
        .addSubcommand(sub =>
            sub.setName('unban')
                .setDescription('Снять запрет на создание приватных комнат')
                .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('owner')
                .setDescription('Узнать владельца приватной комнаты')
                .addStringOption(opt => opt.setName('room').setDescription('Название комнаты').setRequired(true).setAutocomplete(true))
        ),

    async autocomplete(interaction) {
        try {
            const focused = interaction.options.getFocused();
            const guildId = interaction.guild.id;
            const rooms = await getRoomsByGuildId(guildId);
            const voiceChannels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);

            const choices = rooms
                .map(r => voiceChannels.get(r.channel_id))
                .filter(Boolean)
                .map(ch => ({ name: ch.name, value: ch.name }));

            const filtered = choices.filter(c => c.name.toLowerCase().includes(focused.toLowerCase())).slice(0, 25);
            await interaction.respond(filtered);
        } catch (error) {
            logger.error('Autocomplete error:', error.message);
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const sub = interaction.options.getSubcommand();

        try {
            if (sub === 'change') {
                const roomName = interaction.options.getString('room');
                const newName = interaction.options.getString('new_name');
                const channel = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === roomName);
                if (!channel) return await interaction.editReply({ embeds: [errorEmbed('Ошибка', 'Комната не найдена.', interaction.guild)] });
                const old = channel.name;
                await channel.setName(newName).catch(err => { throw err; });
                await interaction.editReply({ embeds: [successEmbed('Готово', `Комната "${old}" переименована в "${newName}".`, interaction.guild)] });
                return;
            }

            if (sub === 'delete') {
                const roomName = interaction.options.getString('room');
                const channel = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === roomName);
                if (!channel) return await interaction.editReply({ embeds: [errorEmbed('Ошибка', 'Комната не найдена.', interaction.guild)] });
                await deleteRoom(channel.id);
                const name = channel.name;
                await channel.delete().catch(() => {});
                await interaction.editReply({ embeds: [successEmbed('Удалено', `Комната "${name}" удалена.`, interaction.guild)] });
                return;
            }

            if (sub === 'ban') {
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'Не указана';
                const duration = interaction.options.getInteger('duration') || 0; // минутыъ
                const expiresAt = duration > 0 ? new Date(Date.now() + duration * 60000).toISOString().slice(0, 19).replace('T', ' ') : null;
                const ok = await banUser(interaction.guild.id, user.id, reason, expiresAt);
                if (!ok) return await interaction.editReply({ embeds: [errorEmbed('Ошибка', 'Не удалось забанить пользователя в БД.', interaction.guild)] });

                const mod = interaction.member;
                const moderatorText = `${mod.user.tag}`;
                const durationText = expiresAt ? `До: ${new Date(expiresAt).toLocaleString()}` : 'Навсегда';

                const dmLines = [
                    `Вы получили запрет на создание приватных комнат на сервере: ${interaction.guild.name}`,
                    `Кем: ${moderatorText}`,
                    `ID модератора: ${mod.id}`,
                    `Длительность: ${durationText}`,
                    `Причина: ${reason}`,
                    `Сервер ID: ${interaction.guild.id}`
                ];

                await user.send({ content: dmLines.join('\n') }).catch(() => {});
                await interaction.editReply({ embeds: [successEmbed('Готово', `Пользователь ${user.tag} заблокирован от создания приватных комнат.`, interaction.guild)] });
                return;
            }

            if (sub === 'unban') {
                const user = interaction.options.getUser('user');
                const ok = await unbanUser(interaction.guild.id, user.id);
                if (!ok) return await interaction.editReply({ embeds: [errorEmbed('Ошибка', 'Не удалось снять бан в БД.', interaction.guild)] });

                const mod = interaction.member;
                const moderatorText = `${mod.user.tag} (${mod.id})`;
                const dmLines = [
                    `Вам снят запрет на создание приватных комнат на сервере: ${interaction.guild.name}`,
                    `Кто снял: ${moderatorText}`,
                    `ID модератора: ${mod.id}`,
                    `Сервер ID: ${interaction.guild.id}`
                ];

                await user.send({ content: dmLines.join('\n') }).catch(() => {});
                await interaction.editReply({ embeds: [successEmbed('Готово', `Пользователь ${user.tag} разблокирован.`, interaction.guild)] });
                return;
            }

            if (sub === 'owner') {
                const roomName = interaction.options.getString('room');
                const channel = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === roomName);
                if (!channel) return await interaction.editReply({ embeds: [errorEmbed('Ошибка', 'Комната не найдена.', interaction.guild)] });
                const room = await getRoomByChannelId(channel.id);
                if (!room) return await interaction.editReply({ embeds: [errorEmbed('Ошибка', 'Комната не зарегистрирована в БД.', interaction.guild)] });
                const member = await interaction.guild.members.fetch(room.owner_id).catch(() => null);
                const ownerText = member ? `${member.user.tag} (${member.id})` : `${room.owner_id} (не в гильдии)`;
                await interaction.editReply({ embeds: [successEmbed('Владелец', `Владелец комнаты "${channel.name}": ${ownerText}`, interaction.guild)] });
                return;
            }

            await interaction.editReply({ embeds: [errorEmbed('Ошибка', 'Неизвестная субкоманда.', interaction.guild)] });
        } catch (error) {
            logger.error('Private command error:', error.message);
            await interaction.editReply({ embeds: [errorEmbed('Ошибка', 'Произошла ошибка при выполнении команды.', interaction.guild)] });
        }
    }
};
