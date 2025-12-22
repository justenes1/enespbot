const { Client, GatewayIntentBits, Collection, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ========================
// Configuration (Hardcoded)
// ========================
const CLIENT_ID = '1447366056904491079';
const BOT_TOKEN = 'MTQ0NzM2NjA1NjkwNDQ5MTA3OQ.GVrPWo.IKL3oGWFwu0qPyvUu_8llLEQS4fFi_R-tPlspE';
const LTC_ADDRESS = 'Lendcpxh1hrmCePoKiNx8otRksC1TG8T8H';
const LTC_QR_CODE_URL = 'https://cdn.discordapp.com/attachments/1434886109707636868/1449906838148616292/Gemini_Generated_Image_vehcwkvehcwkvehc2.png?ex=69414338&is=693ff1b8&hm=18e6937bf7e6d0e03520658a99ec8e149d56804dabf15fa8930030d2b194d4af&';
const BOT_OWNER_ID = '1425207525166551261';
const BLOCKCYPHER_API_KEY = '3609bcf9b4d848a18ade642fe8f5565e';
const VOUCH_CHANNEL_ID = '1429486757333962883';

// ========================
// TICKET CHANNEL CONFIG (Set these!)
// ========================
const TICKET_CHANNEL_ID = 'YOUR_TICKET_CHANNEL_ID_HERE'; // Channel to send ticket embed on startup
const TICKET_CATEGORY_ID = 'YOUR_TICKET_CATEGORY_ID_HERE'; // Category for tickets
const SUPPORT_CATEGORY_ID = 'YOUR_SUPPORT_CATEGORY_ID_HERE'; // Category for support tickets
const WELCOME_CHANNEL_ID = '1452387702367326218'; // Channel to send welcome/product message

const CONFIRMATION_THRESHOLDS = {
    small: { maxAmount: 0.1, confirmations: 1 },
    medium: { maxAmount: 1, confirmations: 3 },
    large: { maxAmount: 10, confirmations: 6 },
    xlarge: { confirmations: 10 }
};

// ========================
// Initialize Database
// ========================
const db = require('./database');

// ========================
// Discord Client Setup
// ========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.config = {
    CLIENT_ID,
    LTC_ADDRESS,
    LTC_QR_CODE_URL,
    BOT_OWNER_ID,
    BLOCKCYPHER_API_KEY,
    VOUCH_CHANNEL_ID,
    TICKET_CHANNEL_ID,
    TICKET_CATEGORY_ID,
    SUPPORT_CATEGORY_ID,
    CONFIRMATION_THRESHOLDS
};

client.commands = new Collection();
client.pendingProducts = new Map();
client.pendingOrders = new Map();
client.purchaseSessions = new Map();
client.pendingConfirmations = new Map(); // For delete/edit confirmations
client.editSessions = new Map(); // For edit product sessions

// ========================
// Commands Definition
// ========================
const commands = [
    // /products - View all products
    new SlashCommandBuilder()
        .setName('products')
        .setDescription('View all available products'),

    // /orders - View your order history
    new SlashCommandBuilder()
        .setName('orders')
        .setDescription('View your order history'),

    // /addproduct - Add a new product (Owner only)
    new SlashCommandBuilder()
        .setName('addproduct')
        .setDescription('Add a new product (Owner only)')
        .addStringOption(option => option.setName('name').setDescription('Product name').setRequired(true))
        .addNumberOption(option => option.setName('usd_price').setDescription('Price in USD').setRequired(true))
        .addNumberOption(option => option.setName('ltc_price').setDescription('Price in LTC').setRequired(true))
        .addStringOption(option => option.setName('description').setDescription('Product description').setRequired(false))
        .addIntegerOption(option => option.setName('stock').setDescription('Initial stock').setRequired(false)),

    // /stock - View product stock (Owner only)
    new SlashCommandBuilder()
        .setName('stock')
        .setDescription('View product stock (Owner only)'),

    // /setuptickets - Send ticket panel manually
    new SlashCommandBuilder()
        .setName('setuptickets')
        .setDescription('Send the ticket panel to the configured channel (Owner only)'),

    // /help - Show all commands
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands'),

    // /send - Send embed message to a channel (Owner only)
    new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send an embed message to a channel (Owner only)')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to send the message to')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('image')
                .setDescription('Image URL (optional)')
                .setRequired(false)),

    // /delete - Delete a product (Owner only)
    new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Delete a product (Owner only)')
        .addStringOption(option => 
            option.setName('product')
                .setDescription('Product name to delete')
                .setRequired(true)),

    // /editproduct - Edit a product (Owner only)
    new SlashCommandBuilder()
        .setName('editproduct')
        .setDescription('Edit a product (Owner only)')
        .addStringOption(option => 
            option.setName('product')
                .setDescription('Product name to edit')
                .setRequired(true)),

    // /hold - Put a product on hold (Owner only)
    new SlashCommandBuilder()
        .setName('hold')
        .setDescription('Put a product on hold or remove hold (Owner only)')
        .addStringOption(option => 
            option.setName('product')
                .setDescription('Product name to hold/unhold')
                .setRequired(true))
];

// ========================
// Register Slash Commands
// ========================
async function registerCommands() {
    const rest = new REST().setToken(BOT_TOKEN);
    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(c => c.toJSON()) });
        console.log(`✅ Registered ${commands.length} slash commands!`);
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
}

// ========================
// Send Ticket Embed (called on startup)
// ========================
async function sendTicketEmbed(channel) {
    const embed = new EmbedBuilder()
        .setTitle('🎁 Welcome!')
        .setColor(0x00AAFF)
        .setDescription(`🎁 Hello! If you would like to purchase one of our product's please open a ticket below

🏷️ Our Product's are the **CHEAPEST** on the market.

✅ Please wait patiently until a seller responds to your ticket.

🛡️ Please check our vouches before opening a ticket.

⚠️ Please follow Discord ToS and guidelines.

*(By opening you are agreeing to our terms of service)*`);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('open_purchase_ticket')
                .setLabel('🛒 Purchase')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('open_support_ticket')
                .setLabel('🎫 Support')
                .setStyle(ButtonStyle.Primary)
        );

    await channel.send({ embeds: [embed], components: [row] });
    console.log('✅ Ticket embed sent to channel!');
}

// ========================
// Send Welcome/Products Embed (called on startup)
// ========================
async function sendWelcomeEmbed(channel) {
    const embed = new EmbedBuilder()
        .setTitle("Welcome to [Enes's Shop]")
        .setColor(0xFF0000)
        .setDescription(`We sell **premium Discord bots** with instant setup and 24/7 support. From security, payments, giveaways, and music to stock management — everything your server needs is here.

---

<a:1441618456238620743:1441618456238620743> **Premium Bots**

• <a:ArrowRed:1452388020966785094> Auto MM Bot – Automated middleman for safe trades
• <a:ArrowRed:1452388020966785094> Boosts Bot – Track & manage server boosts easily
• <a:ArrowRed:1452388020966785094> Promo Checker / Token Checker – Validate tokens instantly
• <a:ArrowRed:1452388020966785094> Ticket Message Sender Bot – Auto-send custom messages in tickets (set via panel per category)
• <a:ArrowRed:1452388020966785094> LTC Sender Bot – Fast & secure Litecoin transfers
• <a:ArrowRed:1452388020966785094> Vanity Tracker / Status – Track vanity URLs & monitor activity
• <a:ArrowRed:1452388020966785094> Slot Bot – Sell channel slots safely; bot handles pings, timing & scam protection
• <a:ArrowRed:1452388020966785094> Payment Method Bot – Organize & show payment options
• <a:ArrowRed:1452388020966785094> Vouch Bot – Collect & highlight trusted vouches
• <a:ArrowRed:1452388020966785094> Invoice Bot – Generate & send your own custom invoices
• <a:ArrowRed:1452388020966785094> Multi Stock Sender Bot – Deliver multiple stock with one click
• <a:ArrowRed:1452388020966785094> Stocker Bot – Store and send products instantly
• <a:ArrowRed:1452388020966785094> Regen Bot – Refresh Nitro & gift links in seconds
• <a:ArrowRed:1452388020966785094> Backup Bot – Backup & restore server roles, channels & emojis
• <a:ArrowRed:1452388020966785094> Status Rotator – Auto-cycle your Discord status
• <a:ArrowRed:1452388020966785094> Client Saver – Track & organize client orders
• <a:ArrowRed:1452388020966785094> VC Joiner Tool – Bulk IDs join voice channels instantly when triggered
• <a:ArrowRed:1452388020966785094> Vanity Sniper – Snipe Vanity Instant / Guard Your Vanity With Production

---

### 📌 How To B4y
1. Open a ticket in **#ticket** (🎫 button) <#1429476661153501336>
2. Our staff will assist you instantly
3. Setup is done within minutes 🚀

💡 Need something custom? DM the **server owner** directly.`);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_bot_tool')
        .setPlaceholder('Select a b0t or t00l')
        .addOptions([
            { label: 'Auto MM Bot', value: 'auto_mm', description: 'Automated middleman for safe trades' },
            { label: 'Boost Bot', value: 'boost_bot', description: 'Track & manage server boosts' },
            { label: 'Promo/Token Checker', value: 'promo_checker', description: 'Validate tokens instantly' },
            { label: 'Ticket Message Sender', value: 'ticket_sender', description: 'Auto-send custom messages in tickets' },
            { label: 'Vanity Tracker/Status', value: 'vanity_tracker', description: 'Track vanity URLs & monitor activity' },
            { label: 'Slot Bot', value: 'slot_bot', description: 'Sell channel slots safely' },
            { label: 'Payment Method Bot', value: 'payment_bot', description: 'Organize & show payment options' },
            { label: 'Vouch Bot', value: 'vouch_bot', description: 'Collect & highlight trusted vouches' },
            { label: 'Multi Stock Sender', value: 'stock_sender', description: 'Deliver multiple stock with one click' },
            { label: 'Regen Bot', value: 'regen_bot', description: 'Refresh Nitro & gift links in seconds' },
            { label: 'Backup Bot', value: 'backup_bot', description: 'Backup & restore server setup' },
            { label: 'Status Rotator', value: 'status_rotator', description: 'Auto-cycle your Discord status' },
            { label: 'Client Saver', value: 'client_saver', description: 'Track & organize client orders' },
            { label: 'Vanity Sniper', value: 'vanity_sniper', description: 'Guard your vanity with production' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await channel.send({ embeds: [embed], components: [row] });
    console.log('✅ Welcome embed sent to channel!');
}

// Bot product descriptions for ephemeral replies
const BOT_DESCRIPTIONS = {
    auto_mm: `**Auto MM Bot – Secure & Advanced**
Powered by **Enes**

Features:
• \`.setupticket\` → Instantly send a ticket panel for trades
• \`.dashboard\` → Check pending & completed tickets in real-time
• \`.close\` → Close tickets safely once deals are done
• \`.release @user\` → Release funds if no scam is detected
• \`.cancle\` → Cancel tickets anytime with one command
• \`Advanced Logging System\` → All actions are saved for full transparency

Why choose our Auto MM Bot?
• Fast, reliable & fully automated
• Advanced scam protection with detailed logs
• Source code included

<a:ArrowRed:1452388020966785094> Price: **$10** (One-time, with SRC included)`,

    boost_bot: `**Boost Bots – V1 & V2**
Powered by **Enes**

━━━━━━━━━━━
**Boost Bot V1 – Secure • Simple • Logged**

Features:
• /boost → Boost server instantly
• /multi_boost → Multi-server boosts
• /fetch-order → Order details by invoice ID
• /restock → Add Nitro tokens
• /sendtokens → Send tokens
• /stock → Check boosts/tokens
• /unboost → Remove boosts
• /add-owner & /remove-owner → Owner control

Logs: All actions (boost, restock, send, unboost) saved for transparency

<a:ArrowRed:1452388020966785094> Price: **$5.00** (SRC included)

━━━━━━━━━━━
**Boost Bot V2 – Advanced • Auto-Buy • Key System**

Features:
• /boostpanel → Boost panel
• /new_keys, /get_keys, /use_key → Full key system
• /key_stats → Track keys
• /stock & /livestock → Live stock
• /ltcprice → Litecoin price checker
• /transferTokens → Send tokens
• /failed & /filecleaner → Handle failed tokens

<a:ArrowRed:1452388020966785094> Website Auto-Buy: Buy key → Paste with server → Auto boosting (great for resellers)

Logs: Tracks boosts, restocks, key usage, transfers (100% transparent)

<a:ArrowRed:1452388020966785094> Price: **$9.00** (SRC + Auto-Buy support)

━━━━━━━━━━━
**V1 vs V2**
✔️ V1 → Small sellers / personal use
✔️ V2 → Pro sellers & resellers (Auto-Buy + Key System)`,

    promo_checker: `**Promo & Token Checker Bot**
Powered by **Enes**

**Commands:**
• \`/check_promos\` → Instantly check all your available promos
• \`/check_tokens\` → Verify & fetch detailed token information

**Features:**
• Fast & accurate promo checking
• Secure token verification system
• Clean slash-command support
• Simple & reliable for sellers and users

<a:ArrowRed:1452388020966785094> **Price:** $7.00 (SRC Included)`,

    ticket_sender: `**Auto Message Sender Bot – Multi Ticket System**
Powered by **Enes**

Features:
• Multi-Category Support → Set different auto-messages for different ticket categories
• Smart Auto Reply → Bot can send a message after a custom delay (e.g. 5s after ticket creation – adjustable as you like)
• Support Button → Users can request help anytime with one click
• Staff Reply System → Staff can reply directly from logs → Bot forwards the response to the user's DMs
• Customizable Panels → Different ticket panels, different replies

Advanced Logs:
• Every ticket, reply, and support action is saved
• Staff can view and reply directly from logs
• Full transparency + professional management

Why this Bot?
• Perfect for managing multiple ticket categories with automated replies
• Logs ensure nothing is missed
• Users get fast and clear support in their DMs
• Flexible timing and category control for professional setups

<a:ArrowRed:1452388020966785094> Price: **$7.00** (One-time, SRC included)`,

    vanity_tracker: `**Vanity Checker Bot – Auto Role System**
Powered by **Enes**

How it Works:
1️⃣ User opens a ticket (through Ticket Tool panel)
2️⃣ User submits their vanity (example: discord.gg/myvanity)
3️⃣ Bot checks the vanity automatically
4️⃣ If vanity is valid → Bot gives the reward role instantly
5️⃣ If vanity is invalid → No role is given (staff can see in logs)

Logs System:
• Every vanity submission is saved in logs
• Staff can track who claimed, what vanity, and result

Why this Bot?
• Automates vanity verification
• Instant role assignment when vanity is correct
• Safe and transparent with logs
• Saves staff time and prevents fake claims

<a:ArrowRed:1452388020966785094> Price: **$9.00** (One-time, SRC included)`,

    slot_bot: `**Slot Bot – Full System**
Powered by **Enes**

Core Features
• Auto Ping Detection → If user makes extra pings, slot is automatically put on hold
• Hold & Unhold System
  - /hold → Put slot on hold
  - /unhold → Restore slot access

• Recovery System
  - /gen-recovery-code → Generate backup code for recovery
  - /recover-slot recovery_code → Recover slot instantly with valid key
  - /get-key → Get recovery key of a user
  - /slotinfo → Show full info of slot

• Slot Management
  - /create-slot → Create new slot
  - /delete-slot → Delete slot
  - /nuke → Nuke & recreate slot channel
  - /transfer-slot → Transfer slot to another user
  - /revoke → Revoke a slot permanently
  - /myslot → Check your assigned slot

• Ping Control
  - /ping-reset → Reset ping counter if limit exceeded

• Auto Buy System (LTC Supported)
  - User pays via LTC → Bot automatically creates slot + sends recovery key
  - Supports: 3 Days / 7 Days / 15 Days / 30 Days / Lifetime Slots
  - Each duration & price is fully customizable

• Advanced Login System
  - Tracks & saves every action taken
  - Detailed logs for full transparency
  - Never seen before style of secure login & logging system

Why this Bot?
✔ Full slot automation (create, hold, recover, transfer, revoke)
✔ Auto ping detection keeps slots safe
✔ Recovery keys ensure no slot is ever lost
✔ Auto buy via LTC makes it 100% hands-free
✔ Advanced login system → logs everything like never before
✔ Safe, secure & powerful

<a:ArrowRed:1452388020966785094> Price: **$20.00 (SRC Included)**`,

    payment_bot: `**Payment Panel Bot – Dropdown System**
Powered by **Enes**

Command
• .paymentpanel → Opens a custom embed with dropdown menu

Features
• Supports up to **25 different payment methods**
• Clean **dropdown selector** (no cluttered embeds)
• Show **QR codes** for instant scan & pay
• Smart error handling – smooth & reliable
• Fully **customizable embed** (colors, title, footer, notes, etc.)
• Users just select a method → bot shows payment details instantly

Why this Bot?
✔ Dropdown makes it simple & professional
✔ One panel handles every payment method
✔ Saves staff time – no more sending details manually
✔ Safe, error-free, and user-friendly

<a:ArrowRed:1452388020966785094> Price: **$7.00 (SRC Included)**`,

    vouch_bot: `**Vouch Bot – Rating & Trust System**
Powered by **Enes**

Commands
• /vouch [message + rating] → Saves the vouch from the user and posts it into your setup vouch channel
• /restorevouch → Restore all saved vouches back into the channel (useful after channel wipe or reset)

Features
• Save unlimited vouches with rating & message
• Auto-post vouches into a channel you set in config
• Restore system → never lose your vouches
• Fully customizable (embed colors, layout, footer, style, etc.)
• Clean slash commands (no clutter, easy to use)

Why this Bot?
✔ Build trust with a professional vouch system
✔ Easy rating + feedback in one command
✔ Safe storage with restore option
✔ Customizable to fit your server branding

<a:ArrowRed:1452388020966785094> Price: **$7.00 (SRC Included)**`,

    stock_sender: `**Stock Bot – Stock Management**
Powered by **Enes**

How it Works
• Save your stock messages + channel IDs into the bot (supports multiple channels)
• Bot remembers everything → no need to retype again

Commands
• .ssend → Send saved stock messages into your stock channels
• .spurge → Delete stock messages from the channels instantly
• .sresend → Delete old stock & replace with updated embed
• Store & manage unlimited stock messages

Features
• Manage stock across multiple channels at once
• Super easy updates – just edit your stock file & resend
• Perfect for sellers (update prices/rates in seconds)
• Keeps your stock professional & always up-to-date

Why this Bot?
✔ Save time – no more manual copy paste
✔ One command to update stock everywhere
✔ Clean, professional embeds
✔ Seller-focused system

<a:ArrowRed:1452388020966785094> Price: **$7.00 (SRC Included)**`,

    regen_bot: `**Inventory Code Regen Bot**
Powered by **Enes**

**Commands**
• \`add-token\` → Add or replace your Discord token
• \`delete-codes\` → Delete saved inventory codes instantly
• \`delete-custom-link\` → Remove custom links easily
• \`find-generated-codes\` → Export all your codes in a file
• \`regen-code\` → Regenerate all saved inventory codes
• \`regen-custom-link\` → Refresh your custom links
• \`token-inv-info\` → View full token inventory info

**Features**
• Regenerate Nitro, gift links, and other inventory codes
• Supports decorated codes and nameplates
• Safe storage of tokens & codes
• Fetch, delete, or regenerate anytime
• Full slash-command support (clean & modern)
• Ideal for sellers & advanced inventory managers

<a:ArrowRed:1452388020966785094> **Price:** $13.00 (SRC Included)`,

    backup_bot: `**Server Backup & Restore Bot**
Powered by **Enes**

Core Features
• /backup → Save entire server setup (channels + roles)
• /restore → Instantly restore saved channels & roles into a new/fresh server
• /save_emoji → Backup all emojis from the server
• /restore_emoji → Restore all saved emojis into a new server

Why Use This Bot?
✔ Protect your server from nukes or accidents
✔ Save hours of setup time — restore everything in seconds
✔ Secure data system → bot stores your server structure safely
✔ Works for unlimited channels, roles & emojis

Example Use
• Moving to a new server? → Just /backup and /restore ✅
• Got nuked? → /restore and get your full setup back in seconds ⚡
• Want to duplicate a server? → Backup once, restore multiple times 🎯

<a:ArrowRed:1452388020966785094> Price: **$4.00 (SRC Included)**`,

    status_rotator: `**Multi-Status Rotator Bot**
Powered by **Enes**

Features
• Set up to **8 different custom statuses**
• Auto-rotate statuses every **3s, 5s, 15s, or any time you want**
• Fully customizable text & emojis in status
• Professional smooth switching system
• Works 24/7 without lag

Example
Status 1 → PLAY GAME
Status 2 → DOING BIG EVENT
Status 3 → JOIN MY LEGIT DC SERVER
…and it keeps rotating automatically every few seconds!

<a:ArrowRed:1452388020966785094> Price: **$4.00 (SRC Included)**`,

    client_saver: `**Buyer Saver Bot (Client Recovery System)**
Powered by **Enes**

Features
• /savebuyer → Save your client's Discord ID safely
• /listbuyer → See your full saved buyer list
• Always updates with their latest username & tag
• 101% secure logging — IDs stored safely in bot files
• Helps you reconnect with clients even if your ID/server gets termed

Why Use This Bot?
✔ Never lose buyers again
✔ Easy recovery of client list
✔ Perfect for sellers with repeat customers
✔ Keeps your business safe, professional & organized

Example Flow
1. Add a buyer → \`/savebuyer @user\`
2. Later, check list → \`/listbuyer\`
3. If ID/server is termed, you still have your clients saved

<a:ArrowRed:1452388020966785094> Price: **$7.00 (SRC Included)**`,

    vanity_sniper: `**Vanity Guard – Monitor & Alert (Safe & Compliant)**
Powered by **Enes**

What it does
• 24/7 monitors target vanity URLs and detects changes instantly
• When your vanity will release it will automatically shifted in your backup server
• Sends immediate alerts to a configured staff channel or owner DMs when a vanity becomes available or is changed
• You have to post the token and password
• It is fully automatic

Benefits
• Fast, legal alerts so your team can react within seconds
• Full audit trail for accountability
• Protects your branding without enabling abuse

Example
If your server vanity url is \`.gg/theaurainfinity\` and if someone will remove the vanity from our server then it will instantly shift into our backup server

<a:ArrowRed:1452388020966785094> Price: **$50** (One-time, SRC included)
<a:ArrowRed:1452388020966785094> Also available at **$8.00** (Per month price)`
};

// ========================
// Handle Interactions
// ========================
client.on('interactionCreate', async interaction => {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        try {
            await handleCommand(interaction, client);
        } catch (error) {
            console.error(`❌ Error in /${interaction.commandName}:`, error);
            const reply = { content: '❌ Command error!', ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
        return;
    }

    // Handle buttons
    if (interaction.isButton()) {
        await handleButton(interaction, client);
        return;
    }

    // Handle select menus
    if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction, client);
        return;
    }

    // Handle modals
    if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction, client);
        return;
    }
});

// ========================
// Message Handler (for confirmations)
// ========================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const userId = message.author.id;
    const channelId = message.channel.id;
    const content = message.content.toLowerCase().trim();

    // Check for delete confirmations
    const deleteKey = `delete_${userId}_${channelId}`;
    if (client.pendingConfirmations.has(deleteKey)) {
        const confirmation = client.pendingConfirmations.get(deleteKey);
        
        if (content === 'confirm') {
            db.deleteProduct(confirmation.productId);
            client.pendingConfirmations.delete(deleteKey);
            
            const embed = new EmbedBuilder()
                .setTitle('✅ Product Deleted')
                .setColor(0x00FF00)
                .setDescription(`**${confirmation.productName}** has been deleted.`)
                .setTimestamp();
            
            console.log(`🗑️ Product ${confirmation.productName} deleted by ${message.author.tag}`);
            await message.reply({ embeds: [embed] });
            return;
        } else if (content === 'cancel' || content === 'decline') {
            client.pendingConfirmations.delete(deleteKey);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Deletion Cancelled')
                .setColor(0xFF0000)
                .setDescription(`Product **${confirmation.productName}** was not deleted.`)
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
            return;
        }
    }

    // Check for edit sessions
    const editKey = `edit_${userId}_${channelId}`;
    if (client.editSessions.has(editKey)) {
        const session = client.editSessions.get(editKey);
        const isSkip = content === 'skip' || content === 'next';

        // Step 1: Product Name
        if (session.step === 1) {
            if (!isSkip) {
                session.updates.name = message.content.trim(); // Keep original case
            }
            session.step = 2;
            client.editSessions.set(editKey, session);

            const embed = new EmbedBuilder()
                .setTitle('✏️ Edit Product')
                .setColor(0x00AAFF)
                .setDescription(`**Step 2/3: Would you like to change the product's price?**\n\nType a number for the new USD price or type \`skip\`/\`next\` to keep it the same.`)
                .addFields({ name: 'Current Price', value: `$${session.currentPrice || 'N/A'}` })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            return;
        }

        // Step 2: Product Price
        if (session.step === 2) {
            if (!isSkip) {
                const price = parseFloat(message.content.trim());
                if (!isNaN(price) && price > 0) {
                    session.updates.usd_price = price;
                } else {
                    await message.reply({ content: '❌ Invalid price. Please enter a valid number or type `skip`/`next`.' });
                    return;
                }
            }
            session.step = 3;
            client.editSessions.set(editKey, session);

            const embed = new EmbedBuilder()
                .setTitle('✏️ Edit Product')
                .setColor(0x00AAFF)
                .setDescription(`**Step 3/3: Would you like to change the product's description?**\n\nType a new description or type \`skip\`/\`next\` to keep it the same.`)
                .addFields({ name: 'Current Description', value: session.currentDescription || 'No description' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            return;
        }

        // Step 3: Product Description
        if (session.step === 3) {
            if (!isSkip) {
                session.updates.description = message.content.trim();
            }

            // Apply updates
            client.editSessions.delete(editKey);

            if (Object.keys(session.updates).length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('ℹ️ No Changes Made')
                    .setColor(0xFFAA00)
                    .setDescription(`No changes were made to **${session.productName}**.`)
                    .setTimestamp();

                await message.reply({ embeds: [embed] });
                return;
            }

            db.updateProduct(session.productId, session.updates);

            const changesText = Object.entries(session.updates)
                .map(([key, value]) => {
                    if (key === 'name') return `**Name:** ${value}`;
                    if (key === 'usd_price') return `**Price:** $${value}`;
                    if (key === 'description') return `**Description:** ${value}`;
                    return `${key}: ${value}`;
                })
                .join('\n');

            const embed = new EmbedBuilder()
                .setTitle('✅ Product Updated')
                .setColor(0x00FF00)
                .setDescription(`**${session.productName}** has been updated!\n\n**Changes:**\n${changesText}`)
                .setTimestamp();

            console.log(`✏️ Product ${session.productName} updated by ${message.author.tag}`);
            await message.reply({ embeds: [embed] });
            return;
        }
    }
});

// ========================
// Command Handler
// ========================
async function handleCommand(interaction, client) {
    const { commandName } = interaction;

    // /products
    if (commandName === 'products') {
        const guildId = interaction.guild?.id;
        const products = db.getProducts(guildId);
        
        if (products.length === 0) {
            return interaction.reply({ content: '📦 No products available yet.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🛒 Available Products')
            .setColor(0x00AAFF)
            .setTimestamp();

        for (const product of products) {
            const holdStatus = product.on_hold ? '⏸️ ON HOLD' : '';
            embed.addFields({
                name: `${product.product_id} - ${product.name} ${holdStatus}`,
                value: `💰 ${product.ltc_price} LTC ($${product.usd_price || 'N/A'}) | 📦 Stock: ${product.stock}\n${product.description || 'No description'}`,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
        return;
    }

    // /orders
    if (commandName === 'orders') {
        const orders = db.getOrdersByUser(interaction.user.id);

        if (orders.length === 0) {
            return interaction.reply({ content: '📋 You have no orders yet.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Your Orders')
            .setColor(0x00AAFF)
            .setTimestamp();

        for (const order of orders.slice(0, 10)) {
            const product = db.getProductById(order.product_id);
            const statusEmoji = {
                'pending': '⏳',
                'paid': '✅',
                'delivered': '📦',
                'refunded': '💸',
                'cancelled': '❌'
            }[order.status] || '❓';
            
            embed.addFields({
                name: `${statusEmoji} ${order.order_id}`,
                value: `Product: ${product ? product.name : 'Unknown'} | $${order.usd_amount || order.amount + ' LTC'} | Status: ${order.status}`,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    // /addproduct (Owner only)
    if (commandName === 'addproduct') {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return interaction.reply({ content: '❌ Only the bot owner can add products.', ephemeral: true });
        }

        const guildId = interaction.guild?.id;
        const name = interaction.options.getString('name');
        const usdPrice = interaction.options.getNumber('usd_price');
        const ltcPrice = interaction.options.getNumber('ltc_price');
        const description = interaction.options.getString('description') || '';
        const stock = interaction.options.getInteger('stock') || 0;

        const result = db.addProduct(name, description, ltcPrice, usdPrice, stock, null, guildId, interaction.user.id);

        const embed = new EmbedBuilder()
            .setTitle('✅ Product Added')
            .setColor(0x00FF00)
            .addFields(
                { name: 'Product ID', value: result.productId, inline: true },
                { name: 'Name', value: name, inline: true },
                { name: 'USD Price', value: `$${usdPrice}`, inline: true },
                { name: 'LTC Price', value: `${ltcPrice} LTC`, inline: true },
                { name: 'Stock', value: `${stock}`, inline: true }
            )
            .setTimestamp();

        console.log(`📦 Product added: ${result.productId} - ${name} by ${interaction.user.id}`);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    // /stock (Owner only)
    if (commandName === 'stock') {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return interaction.reply({ content: '❌ Only the bot owner can view stock.', ephemeral: true });
        }

        const guildId = interaction.guild?.id;
        const products = db.getProductsBySeller(guildId, interaction.user.id);

        if (products.length === 0) {
            return interaction.reply({ content: '📦 You have no products yet.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('📊 Your Stock Overview')
            .setColor(0x00AAFF)
            .setTimestamp();

        for (const product of products) {
            const keyCount = db.getProductKeyCount(product.product_id);
            embed.addFields({
                name: `${product.product_id} - ${product.name}`,
                value: `💰 $${product.usd_price || 'N/A'} | 📦 Stock: ${product.stock} | 🔑 Keys: ${keyCount}`,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    // /setuptickets (Owner only)
    if (commandName === 'setuptickets') {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
        }

        const channel = interaction.channel;
        await sendTicketEmbed(channel);
        await interaction.reply({ content: '✅ Ticket panel sent!', ephemeral: true });
        return;
    }

    // /help
    if (commandName === 'help') {
        const isOwner = interaction.user.id === BOT_OWNER_ID;

        const embed = new EmbedBuilder()
            .setTitle('📚 Bot Commands')
            .setColor(0x00AAFF)
            .setDescription('Here are all available commands:')
            .addFields(
                { name: '🛒 Customer Commands', value: 
                    `**/products** - View all available products
**/orders** - View your order history
**/help** - Show this help message`
                }
            )
            .setTimestamp();

        if (isOwner) {
            embed.addFields(
                { name: '👑 Owner Commands', value: 
                    `**/addproduct** - Add a new product
**/delete** - Delete a product
**/editproduct** - Edit a product (name, price, description)
**/hold** - Put a product on hold or remove hold
**/stock** - View your product stock
**/setuptickets** - Send ticket panel to current channel
**/send** - Send embed message to a channel`
                }
            );
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    // /send (Owner only)
    if (commandName === 'send') {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');
        const imageUrl = interaction.options.getString('image');

        if (!channel.isTextBased()) {
            return interaction.reply({ content: '❌ Please select a text channel.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setDescription(message)
            .setColor(0x00AAFF)
            .setTimestamp()
            .setFooter({ text: `Sent by ${interaction.user.username}` });

        if (imageUrl) {
            embed.setImage(imageUrl);
        }

        try {
            await channel.send({ embeds: [embed] });
            
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Message Sent')
                .setColor(0x00FF00)
                .setDescription(`Message sent to <#${channel.id}>`)
                .setTimestamp();

            await interaction.reply({ embeds: [successEmbed], ephemeral: true });
            console.log(`📨 Message sent to #${channel.name} by ${interaction.user.tag}`);
        } catch (error) {
            console.error('Failed to send message:', error);
            await interaction.reply({ content: `❌ Failed to send message: ${error.message}`, ephemeral: true });
        }
        return;
    }

    // /delete (Owner only)
    if (commandName === 'delete') {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
        }

        const productName = interaction.options.getString('product');
        const guildId = interaction.guild?.id;
        const product = db.getProductByName(productName, guildId);

        if (!product) {
            return interaction.reply({ content: `❌ Product "${productName}" not found.`, ephemeral: true });
        }

        // Store pending confirmation
        client.pendingConfirmations.set(`delete_${interaction.user.id}_${interaction.channel.id}`, {
            type: 'delete',
            productId: product.product_id,
            productName: product.name,
            userId: interaction.user.id,
            channelId: interaction.channel.id,
            createdAt: Date.now()
        });

        const embed = new EmbedBuilder()
            .setTitle('⚠️ Confirm Product Deletion')
            .setColor(0xFFAA00)
            .setDescription(`Are you sure you want to delete **${product.name}**?\n\n**Type \`confirm\` to delete or \`cancel\` to abort.**`)
            .addFields(
                { name: 'Product ID', value: product.product_id, inline: true },
                { name: 'Price', value: `$${product.usd_price || 'N/A'}`, inline: true },
                { name: 'Stock', value: `${product.stock}`, inline: true }
            )
            .setFooter({ text: 'This action cannot be undone!' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
    }

    // /editproduct (Owner only)
    if (commandName === 'editproduct') {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
        }

        const productName = interaction.options.getString('product');
        const guildId = interaction.guild?.id;
        const product = db.getProductByName(productName, guildId);

        if (!product) {
            return interaction.reply({ content: `❌ Product "${productName}" not found.`, ephemeral: true });
        }

        // Start edit session
        client.editSessions.set(`edit_${interaction.user.id}_${interaction.channel.id}`, {
            productId: product.product_id,
            productName: product.name,
            currentPrice: product.usd_price,
            currentDescription: product.description,
            userId: interaction.user.id,
            channelId: interaction.channel.id,
            step: 1, // 1 = name, 2 = price, 3 = description
            updates: {},
            createdAt: Date.now()
        });

        const embed = new EmbedBuilder()
            .setTitle('✏️ Edit Product')
            .setColor(0x00AAFF)
            .setDescription(`Editing **${product.name}**\n\n**Step 1/3: Would you like to change the product's name?**\n\nType a new name or type \`skip\`/\`next\` to keep it the same.`)
            .addFields(
                { name: 'Current Name', value: product.name },
                { name: 'Current Price', value: `$${product.usd_price || 'N/A'}` },
                { name: 'Current Description', value: product.description || 'No description' }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
    }

    // /hold (Owner only)
    if (commandName === 'hold') {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
        }

        const productName = interaction.options.getString('product');
        const guildId = interaction.guild?.id;
        const product = db.getProductByName(productName, guildId);

        if (!product) {
            return interaction.reply({ content: `❌ Product "${productName}" not found.`, ephemeral: true });
        }

        const newHoldStatus = !product.on_hold;
        db.setProductHold(product.product_id, newHoldStatus);

        const embed = new EmbedBuilder()
            .setTitle(newHoldStatus ? '⏸️ Product On Hold' : '▶️ Product Available')
            .setColor(newHoldStatus ? 0xFFAA00 : 0x00FF00)
            .setDescription(newHoldStatus 
                ? `**${product.name}** is now on hold. Customers cannot purchase it until you remove the hold.`
                : `**${product.name}** is now available for purchase.`)
            .setTimestamp();

        console.log(`${newHoldStatus ? '⏸️' : '▶️'} Product ${product.name} ${newHoldStatus ? 'put on hold' : 'taken off hold'} by ${interaction.user.tag}`);
        await interaction.reply({ embeds: [embed] });
        return;
    }
}

// ========================
// Button Handler
// ========================
async function handleButton(interaction, client) {
    const customId = interaction.customId;

    // Open purchase ticket
    if (customId === 'open_purchase_ticket') {
        await showPurchaseModal(interaction);
        return;
    }

    // Open support ticket
    if (customId === 'open_support_ticket') {
        await showSupportModal(interaction);
        return;
    }

    // Close ticket
    if (customId === 'ticket_close') {
        await closeTicket(interaction, client);
        return;
    }

    // Claim ticket
    if (customId === 'ticket_claim') {
        await claimTicket(interaction, client);
        return;
    }

    // Start purchase in ticket
    if (customId.startsWith('start_purchase_')) {
        const guildId = customId.replace('start_purchase_', '');
        await startDMPurchaseFlow(interaction, client, guildId);
        return;
    }

    // Check order status
    if (customId.startsWith('check_')) {
        const orderId = customId.replace('check_', '');
        const order = db.getOrderById(orderId);
        if (!order) {
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription('Order not found.')], ephemeral: true });
        }
        
        const statusEmoji = { 'pending': '⏳', 'paid': '✅', 'delivered': '📦', 'refunded': '💸', 'cancelled': '❌' }[order.status] || '❓';
        
        const statusEmbed = new EmbedBuilder()
            .setTitle(`${statusEmoji} Order Status`)
            .setColor(order.status === 'delivered' ? 0x00FF00 : order.status === 'pending' ? 0xFFAA00 : 0xFF0000)
            .addFields(
                { name: 'Order ID', value: orderId, inline: true },
                { name: 'Status', value: order.status.toUpperCase(), inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
        return;
    }

    // Cancel order
    if (customId.startsWith('cancel_')) {
        const orderId = customId.replace('cancel_', '');
        const order = db.getOrderById(orderId);
        if (!order) {
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription('Order not found.')], ephemeral: true });
        }
        
        if (order.user_id !== interaction.user.id) {
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription('This is not your order.')], ephemeral: true });
        }
        
        if (order.status !== 'pending') {
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription(`Cannot cancel order with status: ${order.status}`)], ephemeral: true });
        }
        
        db.updateOrderStatus(orderId, 'cancelled');
        client.pendingOrders.delete(orderId);
        
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ Order Cancelled').setColor(0x00FF00).setDescription(`Order **${orderId}** has been cancelled.`).setTimestamp()], ephemeral: true });
        return;
    }

    // Confirm purchase
    if (customId.startsWith('confirm_purchase_')) {
        await confirmPurchase(interaction, client, customId);
        return;
    }

    // Decline purchase
    if (customId.startsWith('decline_purchase_')) {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Purchase Cancelled').setColor(0xFF0000).setDescription('Your purchase has been cancelled.').setTimestamp()], ephemeral: true });
        return;
    }
}

// ========================
// DM Purchase Flow
// ========================
async function startDMPurchaseFlow(interaction, client, guildId) {
    const sellers = db.getSellersWithProducts(guildId);
    
    // Filter products: in stock AND not on hold
    const products = db.getProducts(guildId).filter(p => p.stock > 0 && !p.on_hold);
    
    if (products.length === 0) {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ No Products Available').setColor(0xFF0000).setDescription('No products available at the moment.')], ephemeral: true });
    }

    const options = products.map((product, index) => ({
        label: `${index + 1}. ${product.name}`,
        description: `$${product.usd_price || product.ltc_price + ' LTC'}`,
        value: `${guildId}_${product.seller_id || BOT_OWNER_ID}_${product.product_id}`
    }));

    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_product')
                .setPlaceholder('Select a product to purchase')
                .addOptions(options.slice(0, 25))
        );

    const embed = new EmbedBuilder()
        .setTitle('🛒 Available Products')
        .setColor(0x00AAFF)
        .setDescription('Select a product to purchase:');

    let productList = '';
    products.forEach((product, index) => {
        productList += `**${index + 1}.** ${product.name} - $${product.usd_price || product.ltc_price + ' LTC'}\n`;
    });
    embed.addFields({ name: 'Products', value: productList || 'No products' });

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// ========================
// Select Menu Handler
// ========================
async function handleSelectMenu(interaction, client) {
    const customId = interaction.customId;

    // Handle bot/tool selection from welcome embed
    if (customId === 'select_bot_tool') {
        const selected = interaction.values[0];
        const description = BOT_DESCRIPTIONS[selected];
        
        if (description) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(description)
                .setFooter({ text: 'Only you can see this message' });
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
            await interaction.reply({ content: 'Product info not found.', ephemeral: true });
        }
        return;
    }

    if (customId === 'select_product') {
        const [guildId, sellerId, ...productIdParts] = interaction.values[0].split('_');
        const productId = productIdParts.join('_');
        await showPurchaseConfirmation(interaction, client, guildId, sellerId, productId);
        return;
    }
}

async function showPurchaseConfirmation(interaction, client, guildId, sellerId, productId) {
    const product = db.getProductById(productId, guildId);
    if (!product || product.stock <= 0) {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription('Product not found or out of stock.')], ephemeral: true });
    }

    // Check if product is on hold
    if (product.on_hold) {
        return interaction.reply({ 
            embeds: [new EmbedBuilder()
                .setTitle('⏸️ Product On Hold')
                .setColor(0xFFAA00)
                .setDescription('The product is currently on hold. Select another product if you would like to purchase something else.')
            ], 
            ephemeral: true 
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('🛒 Confirm Purchase')
        .setColor(0xFFAA00)
        .setDescription(`Confirm the purchase of **${product.name}** for **$${product.usd_price || product.ltc_price + ' LTC'}**?`)
        .addFields(
            { name: 'Product', value: product.name, inline: true },
            { name: 'Price', value: `$${product.usd_price || 'N/A'}`, inline: true },
            { name: 'LTC Price', value: `${product.ltc_price} LTC`, inline: true }
        )
        .setFooter({ text: 'Click Confirm to proceed or Decline to cancel' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_purchase_${guildId}_${sellerId}_${productId}`)
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`decline_purchase_${guildId}_${sellerId}_${productId}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function confirmPurchase(interaction, client, customId) {
    const parts = customId.replace('confirm_purchase_', '').split('_');
    const guildId = parts[0];
    const sellerId = parts[1];
    const productId = parts.slice(2).join('_');

    const product = db.getProductById(productId, guildId);
    if (!product || product.stock <= 0) {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription('Product not found or out of stock.')], ephemeral: true });
    }

    const ltcAddress = LTC_ADDRESS;
    const ltcQrUrl = LTC_QR_CODE_URL;

    const ticket = db.getTicketByChannelId(interaction.channel?.id);
    const ticketChannelId = ticket ? interaction.channel.id : null;
    const isInTicket = !!ticket;

    const result = db.createOrder(
        interaction.user.id,
        product.product_id,
        ltcAddress,
        product.ltc_price,
        product.usd_price,
        'ltc',
        null,
        guildId,
        sellerId,
        ticketChannelId
    );

    client.pendingOrders.set(result.orderId, {
        orderId: result.orderId,
        userId: interaction.user.id,
        productId: product.product_id,
        ltcAddress: ltcAddress,
        amount: product.ltc_price,
        usdAmount: product.usd_price,
        sellerId: sellerId,
        guildId: guildId,
        ticketChannelId: ticketChannelId,
        createdAt: Date.now()
    });

    const paymentEmbed = new EmbedBuilder()
        .setTitle('⏳ Waiting for Transaction')
        .setColor(0xF7931A)
        .setDescription('When the payment is confirmed, the product will be delivered. Please be patient.')
        .addFields(
            { name: '📦 Order ID', value: result.orderId, inline: true },
            { name: '💰 Amount', value: `$${product.usd_price || 'N/A'} (${product.ltc_price} LTC)`, inline: true },
            { name: '📬 Send LTC to:', value: `\`${ltcAddress}\`` },
            { name: '⏱️ Expires', value: '30 minutes', inline: true }
        )
        .setImage(ltcQrUrl)
        .setFooter({ text: 'Payment will be detected automatically' })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`check_${result.orderId}`)
                .setLabel('Check Status')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`cancel_${result.orderId}`)
                .setLabel('Cancel Order')
                .setStyle(ButtonStyle.Danger)
        );

    if (isInTicket) {
        await interaction.reply({ embeds: [paymentEmbed], components: [row] });
    } else {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ Order Created').setColor(0x00FF00).setDescription('Check your DMs for payment instructions!').addFields({ name: 'Order ID', value: result.orderId, inline: true }, { name: 'Product', value: product.name, inline: true }).setTimestamp()], ephemeral: true });

        try {
            const user = await client.users.fetch(interaction.user.id);
            await user.send({ embeds: [paymentEmbed], components: [row] });
        } catch (e) {
            console.error('Could not DM user:', e.message);
            await interaction.followUp({ embeds: [new EmbedBuilder().setTitle('⚠️ Could not send DM').setColor(0xFFAA00).setDescription('Please enable DMs from server members.'), paymentEmbed], components: [row], ephemeral: true });
        }
    }
}

// ========================
// Ticket System
// ========================
async function showPurchaseModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('purchase_ticket_modal')
        .setTitle('🛒 Purchase Ticket');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('product_name')
                .setLabel('What Product are you buying?')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('payment_method')
                .setLabel('What is your payment method?')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('LTC')
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('acknowledge')
                .setLabel('Do you acknowledge you are going first?')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Yes/No')
                .setRequired(true)
        )
    );

    await interaction.showModal(modal);
}

async function showSupportModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('support_ticket_modal')
        .setTitle('🎫 Support Ticket');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('issue')
                .setLabel('What do you need support with?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        )
    );

    await interaction.showModal(modal);
}

async function handleModalSubmit(interaction, client) {
    if (interaction.customId === 'purchase_ticket_modal') {
        await createPurchaseTicket(interaction, client);
        return;
    }
    if (interaction.customId === 'support_ticket_modal') {
        await createSupportTicket(interaction, client);
        return;
    }
}

async function createPurchaseTicket(interaction, client) {
    const productName = interaction.fields.getTextInputValue('product_name');
    const paymentMethod = interaction.fields.getTextInputValue('payment_method');
    const acknowledge = interaction.fields.getTextInputValue('acknowledge');

    const guildId = interaction.guild.id;

    if (!TICKET_CATEGORY_ID || TICKET_CATEGORY_ID === 'YOUR_TICKET_CATEGORY_ID_HERE') {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription('Ticket system not configured. Please set TICKET_CATEGORY_ID in the code.')], ephemeral: true });
    }

    const ticketChannel = await interaction.guild.channels.create({
        name: `purchase-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: BOT_OWNER_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
    });

    const ticketResult = db.createTicket(guildId, ticketChannel.id, interaction.user.id, 'purchase', null, productName, paymentMethod, acknowledge.toLowerCase() === 'yes' ? 1 : 0);

    const embed = new EmbedBuilder()
        .setTitle('🛒 Purchase Ticket')
        .setColor(0x00AAFF)
        .setDescription(`Hello <@${interaction.user.id}>! Please wait for the owner to respond to your ticket. Thanks, after the deal is finished don't forget to vouch!!`)
        .addFields(
            { name: 'What are you trying to buy?', value: productName },
            { name: 'Do you have any form of crypto?', value: paymentMethod },
            { name: 'Do you acknowledge that you are going first?', value: acknowledge }
        )
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

    await ticketChannel.send({ content: `<@${interaction.user.id}> <@${BOT_OWNER_ID}>`, embeds: [embed], components: [row] });

    // Show products in ticket (filter out held products)
    const products = db.getProducts(guildId).filter(p => p.stock > 0 && !p.on_hold);
    if (products.length > 0) {
        const productEmbed = new EmbedBuilder()
            .setTitle('🛒 Available Products')
            .setColor(0x00AAFF);

        let productList = '';
        products.forEach((product, index) => {
            productList += `**${index + 1}.** ${product.name} - $${product.usd_price || product.ltc_price + ' LTC'}\n`;
        });

        if (productList) {
            productEmbed.addFields({ name: 'Products', value: productList });
            
            const buyRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`start_purchase_${guildId}`)
                        .setLabel('🛒 Purchase')
                        .setStyle(ButtonStyle.Success)
                );

            await ticketChannel.send({ embeds: [productEmbed], components: [buyRow] });
        }
    }

    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ Ticket Created').setColor(0x00FF00).setDescription(`Your ticket has been created! <#${ticketChannel.id}>`).setTimestamp()], ephemeral: true });
}

async function createSupportTicket(interaction, client) {
    const issue = interaction.fields.getTextInputValue('issue');
    const guildId = interaction.guild.id;

    const categoryId = SUPPORT_CATEGORY_ID !== 'YOUR_SUPPORT_CATEGORY_ID_HERE' ? SUPPORT_CATEGORY_ID : TICKET_CATEGORY_ID;
    
    if (!categoryId || categoryId === 'YOUR_TICKET_CATEGORY_ID_HERE') {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription('Ticket system not configured.')], ephemeral: true });
    }

    const ticketChannel = await interaction.guild.channels.create({
        name: `support-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: BOT_OWNER_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
    });

    db.createTicket(guildId, ticketChannel.id, interaction.user.id, 'support');

    const embed = new EmbedBuilder()
        .setTitle('🎫 Support Ticket')
        .setColor(0x00AAFF)
        .setDescription(`Welcome <@${interaction.user.id}>! Please wait for the owner to respond.`)
        .addFields({ name: 'Issue', value: issue })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

    await ticketChannel.send({ content: `<@${interaction.user.id}> <@${BOT_OWNER_ID}>`, embeds: [embed], components: [row] });
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ Ticket Created').setColor(0x00FF00).setDescription(`Your support ticket has been created! <#${ticketChannel.id}>`).setTimestamp()], ephemeral: true });
}

async function closeTicket(interaction, client) {
    const ticket = db.getTicketByChannelId(interaction.channel.id);
    if (!ticket) {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription('This is not a ticket channel.')], ephemeral: true });
    }

    db.updateTicketStatus(ticket.ticket_id, 'closed');

    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔒 Ticket Closing').setColor(0xFF0000).setDescription('This ticket will be closed in 5 seconds...').setTimestamp()] });
    
    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch (e) {
            console.error('Could not delete ticket channel:', e.message);
        }
    }, 5000);
}

async function claimTicket(interaction, client) {
    if (interaction.user.id !== BOT_OWNER_ID) {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Permission Denied').setColor(0xFF0000).setDescription('Only the owner can claim tickets.')], ephemeral: true });
    }

    const ticket = db.getTicketByChannelId(interaction.channel.id);
    if (!ticket) {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription('This is not a ticket channel.')], ephemeral: true });
    }

    if (ticket.claimed_by) {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ Already Claimed').setColor(0xFF0000).setDescription(`This ticket has already been claimed by <@${ticket.claimed_by}>`)], ephemeral: true });
    }

    db.claimTicket(ticket.ticket_id, interaction.user.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ Ticket Claimed').setColor(0x00FF00).setDescription(`This ticket has been claimed by <@${interaction.user.id}>`).setTimestamp()] });
}

// ========================
// Payment Checker Service
// ========================
const axios = require('axios');

const CHECK_INTERVAL = 25000;
const ORDER_EXPIRY_MS = 30 * 60 * 1000;

async function checkPayments() {
    try {
        const pending = db.prepare("SELECT * FROM orders WHERE status = 'pending' AND payment_method = 'ltc'").all();
        if (pending.length === 0) return;

        console.log(`🔍 Checking ${pending.length} pending LTC order(s)...`);
        
        for (const order of pending) {
            const orderAge = Date.now() - (order.created_at * 1000);
            if (orderAge > ORDER_EXPIRY_MS) {
                console.log(`⏰ Order ${order.order_id} expired`);
                db.updateOrderStatus(order.order_id, 'cancelled');
                client.pendingOrders.delete(order.order_id);
                
                try {
                    const user = await client.users.fetch(order.user_id);
                    await user.send({
                        embeds: [{
                            color: 0xFF0000,
                            title: '⏰ Order Expired',
                            description: `Your order **${order.order_id}** has expired.`,
                            timestamp: new Date().toISOString()
                        }]
                    });
                } catch {}
                continue;
            }

            await checkOrderPayment(order);
        }
    } catch (error) {
        console.error('❌ Payment check error:', error.message);
    }
}

async function checkOrderPayment(order) {
    try {
        const response = await axios.get(`https://api.blockcypher.com/v1/ltc/main/addrs/${order.ltc_address}?token=${BLOCKCYPHER_API_KEY}`);
        const transactions = response.data.txrefs || [];

        for (const tx of transactions) {
            if (tx.tx_input_n === -1) {
                const ltcValue = tx.value / 100000000;
                const txTime = new Date(tx.confirmed || tx.received).getTime();
                const orderTime = order.created_at * 1000;

                if (txTime >= orderTime - 60000 && Math.abs(ltcValue - order.amount) < 0.0001) {
                    const existingTx = db.getTransactionByTxid(tx.tx_hash);
                    if (existingTx) continue;

                    console.log(`💰 Payment detected for ${order.order_id}: ${ltcValue} LTC`);
                    await processPayment(order, tx.tx_hash, ltcValue);
                    break;
                }
            }
        }
    } catch (error) {
        if (error.response?.status !== 429) {
            console.error(`❌ Error checking ${order.order_id}:`, error.message);
        }
    }
}

async function processPayment(order, txid, amount) {
    db.addTransaction(order.order_id, txid, amount);
    db.markOrderPaid(order.order_id, txid);
    client.pendingOrders.delete(order.order_id);

    const product = db.getProductById(order.product_id);
    const key = db.getAvailableKey(order.product_id);

    if (key) {
        db.markKeyUsed(key.id, order.user_id);
        db.updateProductStock(order.product_id, db.getProductKeyCount(order.product_id));
        db.markOrderDelivered(order.order_id, key.key_value);
    }

    try {
        const user = await client.users.fetch(order.user_id);

        await user.send({
            embeds: [{
                color: 0x00FF00,
                title: '✅ Payment Confirmed!',
                description: `Your payment for **${product?.name || 'your order'}** was confirmed!`,
                fields: [
                    { name: 'Order ID', value: order.order_id, inline: true },
                    { name: 'Amount', value: `${amount} LTC`, inline: true }
                ],
                timestamp: new Date().toISOString()
            }]
        });

        if (key) {
            await user.send({
                embeds: [{
                    color: 0x00AAFF,
                    title: '📦 Product Delivered!',
                    fields: [{ name: '🔑 Your Key', value: `\`\`\`${key.key_value}\`\`\`` }]
                }]
            });

            await user.send({
                embeds: [{
                    color: 0xFFD700,
                    title: '⭐ Thank You For Your Purchase!',
                    description: `If you're satisfied, please vouch for us in <#${VOUCH_CHANNEL_ID}>!`,
                    fields: [
                        { name: '📝 Copy & Paste This:', value: `\`+vouch Owner ${product?.name || 'Product'} $${order.usd_amount || amount}\`` }
                    ],
                    footer: { text: 'Your feedback helps us grow!' }
                }]
            });
            
            console.log(`📦 Key delivered for order ${order.order_id}`);
        }
    } catch (e) {
        console.error('❌ Could not notify user:', e.message);
    }
}

// ========================
// Bot Ready
// ========================
client.once('ready', async () => {
    console.log(`\n========================================`);
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
    console.log(`========================================\n`);

    // Register commands
    await registerCommands();

    // Start payment checker
    console.log('🔄 Payment checker started (25s interval)');
    setInterval(checkPayments, CHECK_INTERVAL);

    // Load pending orders
    const pending = db.prepare("SELECT * FROM orders WHERE status = 'pending'").all();
    for (const order of pending) {
        client.pendingOrders.set(order.order_id, order);
    }
    console.log(`📋 Loaded ${pending.length} pending orders`);

    // AUTO-SEND TICKET EMBED ON STARTUP
    if (TICKET_CHANNEL_ID && TICKET_CHANNEL_ID !== 'YOUR_TICKET_CHANNEL_ID_HERE') {
        try {
            const channel = await client.channels.fetch(TICKET_CHANNEL_ID);
            if (channel) {
                await sendTicketEmbed(channel);
                console.log('✅ Auto-sent ticket embed on startup!');
            }
        } catch (e) {
            console.error('❌ Could not send ticket embed on startup:', e.message);
        }
    } else {
        console.log('⚠️ TICKET_CHANNEL_ID not set - skipping auto-send ticket embed');
    }

    // AUTO-SEND WELCOME/PRODUCTS EMBED ON STARTUP
    if (WELCOME_CHANNEL_ID) {
        try {
            const welcomeChannel = await client.channels.fetch(WELCOME_CHANNEL_ID);
            if (welcomeChannel) {
                await sendWelcomeEmbed(welcomeChannel);
                console.log('✅ Auto-sent welcome embed on startup!');
            }
        } catch (e) {
            console.error('❌ Could not send welcome embed on startup:', e.message);
        }
    }

    // Print commands info
    console.log('\n📚 AVAILABLE COMMANDS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Customer Commands:');
    console.log('  /products     - View all available products');
    console.log('  /orders       - View your order history');
    console.log('  /help         - Show all commands');
    console.log('\n👑 Owner Commands:');
    console.log('  /addproduct   - Add a new product');
    console.log('  /delete       - Delete a product (with confirmation)');
    console.log('  /editproduct  - Edit a product (name, price, description)');
    console.log('  /hold         - Put a product on hold or remove hold');
    console.log('  /stock        - View product stock');
    console.log('  /setuptickets - Send ticket panel to current channel');
    console.log('  /send         - Send embed message to a channel');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// ========================
// Error Handling
// ========================
client.on('error', e => console.error('❌ Client error:', e));
process.on('unhandledRejection', e => console.error('❌ Unhandled rejection:', e));

// ========================
// Start Bot
// ========================
client.login(BOT_TOKEN);
