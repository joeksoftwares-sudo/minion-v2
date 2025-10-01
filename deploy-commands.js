const { REST, Routes } = require('discord.js');
const { CLIENT_ID, GUILD_ID, TOKEN } = require('./config.json');

const commands = [
    // Staff Payout Commands
    {
        name: 'payout',
        description: 'Staff payout and tracking commands.',
        options: [
            {
                name: 'info',
                description: 'Check your individual Robux earnings.',
                type: 1, // SUB_COMMAND
            },
            {
                name: 'request',
                description: 'Request a payout when you reach the minimum.',
                type: 1, // SUB_COMMAND
                options: [{
                    name: 'method',
                    description: 'Your Roblox Username or Gamepass Link.',
                    type: 3, // STRING
                    required: true,
                }],
            },
            {
                name: 'manual_reset',
                description: '[Admin-Only] Mark a staff member\'s available balance as paid.',
                type: 1, // SUB_COMMAND
                options: [{
                    name: 'member',
                    description: 'The staff member to reset.',
                    type: 6, // USER
                    required: true,
                }],
            },
        ],
    },
    // Admin-only command to setup the ticket panel
    {
        name: 'ticket',
        description: 'Admin command to manage ticket panels.',
        options: [{
            name: 'create_panel',
            description: 'Creates the main ticket selection panel.',
            type: 1, // SUB_COMMAND
        }]
    }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
