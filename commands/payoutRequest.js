const { EmbedBuilder } = require('discord.js');
const { loadPayouts } = require('../utils/dataHandler');
const { MIN_PAYOUT, PAYOUT_CHANNEL_ID, ADMIN_ROLE_ID } = require('../config.json');

module.exports = {
    data: { name: 'request' },
    async execute(interaction) {
        const userId = interaction.user.id;
        const method = interaction.options.getString('method');
        const payouts = loadPayouts();
        const data = payouts[userId] || { totalEarned: 0, paidOut: 0 };
        const availableBalance = data.totalEarned - data.paidOut;

        if (availableBalance < MIN_PAYOUT) {
            return interaction.reply({ content: `❌ You currently have R$${availableBalance.toFixed(0)} available. You must have at least R$${MIN_PAYOUT} to request a payout.`, ephemeral: true });
        }

        try {
            const adminChannel = await interaction.client.channels.fetch(PAYOUT_CHANNEL_ID);
            if (!adminChannel) {
                console.error(`Payout channel ID not found: ${PAYOUT_CHANNEL_ID}`);
                return interaction.reply({ content: '❌ Error: The bot could not find the designated admin payout channel. Contact an admin.', ephemeral: true });
            }

            const requestEmbed = new EmbedBuilder()
                .setTitle('🚨 MANUAL PAYOUT REQUEST')
                .setColor(0xff0000)
                .addFields(
                    { name: 'Staff Member', value: `${interaction.user} (\`${userId}\`)`, inline: true },
                    { name: 'Amount Requested', value: `**R$${availableBalance.toFixed(0)}**`, inline: true },
                    { name: 'Payout Method / Username', value: `\`${method}\``, inline: false }
                )
                .setFooter({ text: `Admin must run /payout manual_reset with this user after payment.` });

            await adminChannel.send({
                content: `<@&${ADMIN_ROLE_ID}> New Payout Request!`,
                embeds: [requestEmbed]
            });

            await interaction.reply({ content: `✅ Payout request for **R$${availableBalance.toFixed(0)}** submitted successfully! An admin has been notified for manual processing.`, ephemeral: true });
        } catch (e) {
            console.error(e);
            await interaction.reply({ content: 'An unexpected error occurred during the request.', ephemeral: true });
        }
    },
};
