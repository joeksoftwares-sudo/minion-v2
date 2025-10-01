const { EmbedBuilder } = require('discord.js');
const { loadPayouts, savePayouts } = require('../utils/dataHandler');

module.exports = {
    data: { name: 'manual_reset' },
    async execute(interaction) {
        const targetMember = interaction.options.getMember('member');
        const targetId = targetMember.id;

        const payouts = loadPayouts();

        if (!payouts[targetId] || (payouts[targetId].totalEarned - payouts[targetId].paidOut) === 0) {
            return interaction.reply({ content: `❌ ${targetMember.user.tag} has no available balance to reset.`, ephemeral: true });
        }

        const data = payouts[targetId];
        const amountToReset = data.totalEarned - data.paidOut;

        // Perform the reset (add available balance to 'paidOut')
        data.paidOut += amountToReset;
        savePayouts(payouts);

        const embed = new EmbedBuilder()
            .setTitle('✅ Payout Reset Successful')
            .setDescription(`**${targetMember.user.tag}**'s available balance has been marked as paid.`)
            .setColor(0x00ff00)
            .addFields(
                { name: 'Amount Reset', value: `R$${amountToReset.toFixed(0)}`, inline: true },
                { name: 'New Paid Out Total', value: `R$${data.paidOut.toFixed(0)}`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    },
};
