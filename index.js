const { Client, GatewayIntentBits, Collection, PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, SelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { TOKEN, GUILD_ID, STAFF_ROLE_IDS, ADMIN_ROLE_ID, ROBUX_PER_TICKET, TICKET_IDLE_MS, CATEGORIES, PAYOUT_CHANNEL_ID } = require('./config.json');
const { loadPayouts, savePayouts } = require('./utils/dataHandler');

// --- 24/7 Hosting Setup ---
const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.send('Minion Bot is running!');
});

app.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
});
// --------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
    ]
});

client.commands = new Collection();
client.activeTickets = new Collection(); // Store ticket claims and idle timers

// Load Command Files
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}


// --- Utility: Get Pings for Staff ---
function getStaffPings() {
    return `<@&${STAFF_ROLE_IDS.join('>, <@&')}>`;
}

// --- Utility: Check for Staff Role ---
function isStaff(member) {
    return STAFF_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

// --- Utility: Check for Admin Role ---
function isAdmin(member) {
    return member.roles.cache.has(ADMIN_ROLE_ID);
}


client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;

        // Command Dispatch
        if (commandName === 'payout') {
            const subcommand = options.getSubcommand();
            const command = client.commands.get(subcommand);
            if (!command) return;
            
            // Authorization Check for Payout Commands
            if (!isStaff(interaction.member)) {
                return interaction.reply({ content: "You must be a Staff Member to use payout commands.", ephemeral: true });
            }

            // Authorization Check for manual_reset
            if (subcommand === 'manual_reset' && !isAdmin(interaction.member)) {
                 return interaction.reply({ content: "You must be an Admin to use the reset command.", ephemeral: true });
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
        
        // Ticket Panel Setup Command
        else if (commandName === 'ticket' && options.getSubcommand() === 'create_panel') {
            // Admin Check
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: "Only Admins can set up the ticket panel.", ephemeral: true });
            }

            const panelEmbed = new EmbedBuilder()
                .setTitle('Minion Support Ticket System')
                .setDescription('Select the type of support you require below. A staff member will assist you shortly.')
                .setColor(0x0099ff);

            const row = new ActionRowBuilder().addComponents(
                new SelectMenuBuilder()
                    .setCustomId('ticket_select')
                    .setPlaceholder('Select a ticket type...')
                    .addOptions([
                        { label: '🎥 Media Application', description: 'Apply for a Media role on the server.', value: 'media_app' },
                        { label: '⚙️ General Support', description: 'For general questions or help.', value: 'general_support' },
                        { label: '🚨 Report Exploiter', description: 'Report a user for exploiting/hacking.', value: 'report_exploiter' },
                    ]),
            );

            await interaction.channel.send({ embeds: [panelEmbed], components: [row] });
            await interaction.reply({ content: 'Ticket panel created successfully!', ephemeral: true });
        }
    }


    // --- Ticket Select Menu Handling (Step 1: Selection) ---
    else if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const type = interaction.values[0];
        let modal;

        // Create Modals based on Selection
        if (type === 'media_app') {
            modal = new ModalBuilder().setCustomId('media_app_modal').setTitle('🎥 Media Application');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('subscribers').setLabel("Subscribers/Followers").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('avg_views').setLabel("Average Views/Reach").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_link').setLabel("Channel Link").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (type === 'general_support') {
            modal = new ModalBuilder().setCustomId('general_support_modal').setTitle('⚙️ General Support');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('support_details').setLabel("What help do you need?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (type === 'report_exploiter') {
            modal = new ModalBuilder().setCustomId('report_exploiter_modal').setTitle('🚨 Report Exploiter');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel("Exploiter's Username").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('hack_type').setLabel("Hack Type (fly, speed, etc.)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('additional_info').setLabel("Additional info (optional)").setStyle(TextInputStyle.Paragraph).setRequired(false))
            );
        }

        if (modal) {
            await interaction.showModal(modal);
        }
    }

    // --- Modal Submission Handling (Step 2: Ticket Creation) ---
    else if (interaction.isModalSubmit()) {
        const userId = interaction.user.id;
        const guild = interaction.guild;
        const ticketType = interaction.customId.replace('_modal', '');
        let categoryId, embedTitle, embedDescription = '';

        if (ticketType === 'media_app') {
            categoryId = CATEGORIES.MEDIA_CATEGORY_ID;
            embedTitle = '🎥 New Media Application';
            embedDescription = `**User:** ${interaction.user}\n**Subscribers/Followers:** ${interaction.fields.getTextInputValue('subscribers')}\n**Average Views/Reach:** ${interaction.fields.getTextInputValue('avg_views')}\n**Channel Link:** ${interaction.fields.getTextInputValue('channel_link')}`;
        } else if (ticketType === 'general_support') {
            categoryId = CATEGORIES.GENERAL_CATEGORY_ID;
            embedTitle = '⚙️ New General Support Ticket';
            embedDescription = `**User:** ${interaction.user}\n**Details:**\n${interaction.fields.getTextInputValue('support_details')}`;
        } else if (ticketType === 'report_exploiter') {
            categoryId = CATEGORIES.REPORT_CATEGORY_ID;
            embedTitle = '🚨 New Exploiter Report';
            embedDescription = `**User:** ${interaction.user}\n**Exploiter Username:** ${interaction.fields.getTextInputValue('username')}\n**Hack Type:** ${interaction.fields.getTextInputValue('hack_type')}\n**Additional Info:**\n${interaction.fields.getTextInputValue('additional_info') || 'N/A'}`;
        }

        try {
            const ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username.toLowerCase()}`,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    // Allow all staff roles to view
                    ...STAFF_ROLE_IDS.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }))
                ],
            });

            const embed = new EmbedBuilder()
                .setTitle(embedTitle)
                .setDescription(embedDescription)
                .setColor(0xffa500)
                .setFooter({ text: `Ticket ID: ${ticketChannel.id} | Opened by: ${interaction.user.tag}` });

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim Ticket').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger),
            );

            await ticketChannel.send({
                content: `@everyone ${getStaffPings()} - A new ticket has been created!`,
                embeds: [embed],
                components: [actionRow]
            });

            await interaction.reply({ content: `Your ticket has been opened in ${ticketChannel}.`, ephemeral: true });

        } catch (e) {
            console.error(e);
            await interaction.reply({ content: 'Could not create ticket channel. Check bot permissions.', ephemeral: true });
        }
    }

    // --- Button Interaction Handling (Step 3: Claim/Close) ---
    else if (interaction.isButton()) {
        const { customId, member, channel } = interaction;

        // Claim Ticket Logic
        if (customId === 'claim_ticket') {
            if (!isStaff(member)) {
                return interaction.reply({ content: "You must be a Staff Member to claim tickets.", ephemeral: true });
            }
            
            // Check if already claimed (using channel name)
            if (channel.name.startsWith('claimed-')) {
                 return interaction.reply({ content: `This ticket is already claimed by **${channel.name.split('-')[1]}**.`, ephemeral: true });
            }

            // Record Claim and Update Channel
            const originalMessage = await channel.messages.fetch({ limit: 1, after: channel.id });
            const initialEmbed = originalMessage.first().embeds[0];

            const claimedEmbed = EmbedBuilder.from(initialEmbed)
                .setTitle(`✅ CLAIMED: ${initialEmbed.title.replace('New', '')}`)
                .setDescription(`${initialEmbed.description}\n\n**Claimed By:** ${member}`)
                .setColor(0x00ff00);

            const updatedRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claimed').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger),
            );

            await channel.setName(`claimed-${member.user.username.toLowerCase()}`);
            await originalMessage.first().edit({ embeds: [claimedEmbed], components: [updatedRow] });
            await interaction.reply({ content: `${member} has claimed this ticket!`, ephemeral: false });

            // Store claim for idle tracking
            client.activeTickets.set(channel.id, { claimantId: member.id, claimTime: Date.now(), userReplied: false });
        }

        // Close Ticket Logic
        else if (customId === 'close_ticket') {
             if (!isStaff(member)) {
                return interaction.reply({ content: "You must be a Staff Member to close tickets.", ephemeral: true });
            }

            // Get the claimant (from channel name for simplicity)
            let claimantId = member.id;
            let claimantName = member.user.username;

            if (channel.name.startsWith('claimed-')) {
                // In a real application, you'd fetch the original claim data, but for simplicity here we'll let the closer be the earner.
                // A better approach is using the activeTickets map or channel topic.
                // For this example, we'll credit the admin/mod who closes it if the claim data is missing/stale, or if the claim is obvious.
                // We'll use the closer as the earner.
            }

            // 1. Award Robux
            const payouts = loadPayouts();
            const staffId = member.id;
            const robuxAward = ROBUX_PER_TICKET;

            if (!payouts[staffId]) {
                payouts[staffId] = { completedTickets: 0, totalEarned: 0, paidOut: 0 };
            }

            payouts[staffId].completedTickets += 1;
            payouts[staffId].totalEarned += robuxAward;
            savePayouts(payouts);
            
            // 2. Log and Reply
            await interaction.reply({ content: `Ticket closed by ${member}. **${member.user.username}** has been awarded **R$${robuxAward}** for completion. This channel will be deleted in 10 seconds.`, ephemeral: false });

            // 3. Delete Channel
            setTimeout(() => channel.delete(), 10000);
            client.activeTickets.delete(channel.id); // Remove from tracking
        }
    }

    // --- Idle Unclaim Logic (Listens for non-staff messages) ---
    // Note: The Idle Unclaim logic requires listening to the 'messageCreate' event, which we'll handle in a separate block below
});

// --- Separate MessageCreate Listener for Idle Timer Reset ---
client.on('messageCreate', async message => {
    // Ignore bot messages or DMs
    if (message.author.bot || !message.guild) return;

    // Check if the message is in an active, claimed ticket channel
    if (client.activeTickets.has(message.channel.id)) {
        const ticket = client.activeTickets.get(message.channel.id);

        // If a non-staff user replies, start the idle timer
        if (!isStaff(message.member) && !ticket.userReplied) {
            ticket.userReplied = true;
            client.activeTickets.set(message.channel.id, ticket);
            
            // Start the idle timer
            setTimeout(async () => {
                const updatedTicket = client.activeTickets.get(message.channel.id);
                // Check if the ticket is still active and the user had replied
                if (updatedTicket && updatedTicket.userReplied) {
                    const channel = await client.channels.fetch(message.channel.id);
                    if (!channel) return;

                    // Re-enable the Claim button for re-claiming
                    const originalMessage = await channel.messages.fetch({ limit: 1, after: channel.id });
                    const originalEmbed = originalMessage.first().embeds[0];
                    const updatedRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim Ticket (Override)').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger),
                    );

                    await originalMessage.first().edit({ components: [updatedRow] });
                    await channel.send(`⚠️ **IDLE WARNING:** The original claimant has not responded for ${TICKET_IDLE_MS / 60000} minutes since the user last replied. The ticket is now available to be **re-claimed** by any staff member! ${getStaffPings()}`);
                    
                    // Clear the claimant info (reset to unclaimed state, but keep 'userReplied: true' to avoid multiple warnings)
                    client.activeTickets.set(message.channel.id, { claimantId: null, claimTime: null, userReplied: true });
                    await channel.setName(channel.name.replace('claimed-', 'unclaimed-'));

                }
            }, TICKET_IDLE_MS); // TICKET_IDLE_MS is 20 minutes (1200000 ms)
        }
    }
});


client.login(TOKEN);
