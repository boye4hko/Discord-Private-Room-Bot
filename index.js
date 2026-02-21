const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
require('dotenv').config();

const { initializeDatabase } = require('./src/database/db');
const logger = require('./src/utils/logger');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages
    ]
});

client.commands = new Collection();
client.buttons = new Collection();
client.selectMenus = new Collection();
client.modals = new Collection();

const eventsPath = path.join(__dirname, './src/events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    client.on(event.name, (...args) => event.execute(...args));
}

logger.info(`Загружено ${eventFiles.length} событий`);

const commandsPath = path.join(__dirname, './src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}

logger.info(`Загружено ${commandFiles.length} команд`);

const buttonsPath = path.join(__dirname, './src/interactions/buttons');
if (fs.existsSync(buttonsPath)) {
    const buttonFiles = fs.readdirSync(buttonsPath).filter(file => file.endsWith('.js'));
    for (const file of buttonFiles) {
        const filePath = path.join(buttonsPath, file);
        const button = require(filePath);
        client.buttons.set(button.customId, button);
    }
    logger.info(`Загружено ${buttonFiles.length} кнопок`);
}

const selectMenusPath = path.join(__dirname, './src/interactions/selectMenus');
const selectMenuFiles = fs.readdirSync(selectMenusPath).filter(file => file.endsWith('.js'));

for (const file of selectMenuFiles) {
    const filePath = path.join(selectMenusPath, file);
    const selectMenu = require(filePath);
    client.selectMenus.set(selectMenu.customId, selectMenu);
}

logger.info(`Загружено ${selectMenuFiles.length} выпадающих меню`);

const modalsPath = path.join(__dirname, './src/interactions/modals');
const modalFiles = fs.readdirSync(modalsPath).filter(file => file.endsWith('.js'));

for (const file of modalFiles) {
    const filePath = path.join(modalsPath, file);
    const modal = require(filePath);
    client.modals.set(modal.customId, modal);
}

logger.info(`Загружено ${modalFiles.length} модальных окон`);

client.once('ready', async () => {
    await initializeDatabase();

    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        logger.info('Регистрация слэш команд...');
        const data = await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

        logger.success(`Регистрировано ${data.length} слэш команд`);
    } catch (error) {
        logger.error('Ошибка регистрации команд:', error.message);
    }
});

process.on('unhandledRejection', error => {
    logger.error('Необработанное отклонение:', error.message);
});

process.on('uncaughtException', error => {
    logger.error('Необработанное исключение:', error.message);
    process.exit(1);
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
    logger.error('Ошибка щапуска:', error.message);
    process.exit(1);
});
