const { EmbedBuilder } = require('discord.js');
const { loadPayouts } = require('../utils/dataHandler');
const { MIN_PAYOUT } = require('../config.json');

module.exports = {
    data: { name: 'info' },
    async execute(interaction) {
        const userId = interaction.user.id;
        const payouts = loadPayouts();
        const data = payouts[userId] || { completedTickets: 0, totalEarned: 0, paidOut: 0 };

        const availableBalance = data.totalEarned - data.paidOut;

        const embed = new EmbedBuilder()
            .setTitle('💰 Robux Payout Info')
            .setDescription(`Earnings tracked for ${interaction.user}`)
            .setColor(availableBalance >= MIN_PAYOUT ? 0x00ff00 : 0xffff00)
            .addFields(
                { name: 'Tickets Completed', value: data.completedTickets.toString(), inline: true },
                { name: 'Total Robux Earned', value: `R$${data.totalEarned.toFixed(0)}`, inline: true },
                { name: 'Robux Paid Out', value: `R$${data.paidOut.toFixed(0)}`, inline: true },
                { name: 'Available for Payout', value: `R$${availableBalance.toFixed(0)}`, inline: false },
                { name: 'Payout Requirement', value: `Minimum R$${MIN_PAYOUT} required to request payout.`, inline: false }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
