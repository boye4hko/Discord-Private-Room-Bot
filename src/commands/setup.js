const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const { successEmbed, errorEmbed, infoEmbed } = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Настроить каналы управления приватными комнатами')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;
            let category = guild.channels.cache.find(ch => ch.name === 'Приватные комнаты' && ch.type === ChannelType.GuildCategory);

            if (!category) {
                category = await guild.channels.create({
                    name: 'Приватные комнаты',
                    type: ChannelType.GuildCategory
                });
                logger.info('Категория создана', { categoryId: category.id });
            }

            let createChannel = guild.channels.cache.find(
                ch => ch.name === 'создать-комнату' && ch.parent?.id === category.id
            );

            if (!createChannel) {
                createChannel = await guild.channels.create({
                    name: 'создать-комнату',
                    type: ChannelType.GuildText,
                    parent: category.id
                });
                logger.info('Канал создания комнаты создан');
            }

            let manageChannel = guild.channels.cache.find(
                ch => ch.name === 'настройки-комнаты' && ch.parent?.id === category.id
            );

            if (!manageChannel) {
                manageChannel = await guild.channels.create({
                    name: 'настройки-комнаты',
                    type: ChannelType.GuildText,
                    parent: category.id
                });
                logger.info('Канал настроек комнаты создану');
            }

            const createMsgs = await createChannel.messages.fetch({ limit: 5 }).catch(() => []);
            for (const msg of createMsgs.values()) {
                await msg.delete().catch(() => {});
            }
            
            const manageMsgs = await manageChannel.messages.fetch({ limit: 5 }).catch(() => []);
            for (const msg of manageMsgs.values()) {
                await msg.delete().catch(() => {});
            }

            const createEmbed = infoEmbed(
                'Создание приватной комнаты',
                'Нажмите на кнопку ниже, чтобы создать новую приватную комнату. Для управления комнатой перейдите в канал настроек комнаты.',
                guild
            );

            await createChannel.send({
                embeds: [createEmbed],
                components: [{
                    type: 1,
                    components: [{
                        type: 2,
                        style: 1,
                        label: 'Создать комнату',
                        custom_id: 'create_room_btn'
                    }]
                }]
            });

            const manageEmbed = infoEmbed(
                'Настройка приватной комнаты',
                'Выберите опцию управления вашей приватной комнатой. Для взаимодействия с настройками Вы должны быть владельцем и находиться в комнате.',
                guild
            );

            await manageChannel.send({
                embeds: [manageEmbed],
                components: [{
                    type: 1,
                    components: [{
                        type: 3,
                        custom_id: 'room_manage_select',
                        placeholder: 'Выберите опцию управления...',
                        min_values: 1,
                        max_values: 1,
                        options: [
                            { label: 'Переименовать комнату', value: 'rename_room', description: 'Изменить название комнаты' },
                            { label: 'Установить лимит', value: 'set_limit', description: 'Установить максимум пользователей' },
                            { label: 'Выдать доступ', value: 'grant_access', description: 'Дать пользователю доступ' },
                            { label: 'Забрать доступ', value: 'revoke_access', description: 'Убрать доступ пользователя' },
                            { label: 'Закрыть комнату', value: 'lock_room', description: 'Закрыть комнату для всех' },
                            { label: 'Открыть комнату', value: 'unlock_room', description: 'Открыть комнату для всех' },
                            { label: 'Замьютить участника', value: 'mute_member', description: 'Отключить микрофон' },
                            { label: 'Размьютить участника', value: 'unmute_member', description: 'Включить микрофон' },
                            { label: 'Задисаблить участника', value: 'deafen_member', description: 'Отключить наушники' },
                            { label: 'Включить наушники', value: 'undeafen_member', description: 'Включить наушники' },
                            { label: 'Передать владение', value: 'transfer_owner', description: 'Сделать кого-то владельцем' },
                            { label: 'Удалить комнату', value: 'delete_room', description: 'Удалить комнату навсегда' }
                        ]
                    }]
                }]
            });

            await interaction.editReply({
                embeds: [successEmbed(
                    'Настройка завершена',
                    `Каналы настроены успешно!\n\nДля создания: ${createChannel}\nДля управления: ${manageChannel}`,
                    guild
                )]
            });

            logger.success('Setup выполнен', { guildId: guild.id });
        } catch (error) {
            logger.error('Ошибка setup:', error.message);
            await interaction.editReply({
                embeds: [errorEmbed('Ошибка настройки', 'Произошла ошибка при настройке.', interaction.guild)]
            });
        }
    }
};
