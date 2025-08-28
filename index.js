const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const axios = require('axios');
const cron = require('node-cron');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    defaultQueryTimeoutMs: 60_000
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update;
    if (qr) console.log("Scan the QR code above with WhatsApp > Linked Devices");
    if (connection === "open") console.log("Bot connected successfully!");
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid === "status@broadcast") return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith("@g.us");

    // Only process commands in groups
    if (isGroup && text.startsWith('!')) {
      const command = text.toLowerCase().split(' ')[0];

      try {
        switch(command) {
          case '!character':
            const charName = text.split(' ').slice(1).join(' ');
            if (!charName) {
              await sock.sendMessage(jid, { text: "Please specify a character name. Usage: !character <name>" });
              return;
            }
            // Example: Fetch character info from AniList API
            const query = `
              query ($search: String) {
                Character(search: $search) {
                  name { full }
                  description
                  siteUrl
                  image { large }
                }
              }
            `;
            const variables = { search: charName };
            const { data } = await axios.post('https://graphql.anilist.co', { query, variables });
            
            if (data.data.Character) {
              const char = data.data.Character;
              const description = char.description ? char.description.replace(/<\/?i>/g, '') : 'No description available.';
              await sock.sendMessage(jid, { 
                text: `*${char.name.full}*\n\n${description}\n\n*More info:* ${char.siteUrl}` 
              });
              if (char.image.large) {
                await sock.sendMessage(jid, { image: { url: char.image.large } });
              }
            } else {
              await sock.sendMessage(jid, { text: `Character "${charName}" not found.` });
            }
            break;

          case '!schedule':
            // Example: Send daily anime schedule
            await sock.sendMessage(jid, { text: "Setting up daily schedule updates..." });
            // Cron job would be set up here
            break;

          case '!quote':
            const quotes = [
              "I'm going to become the King of the Pirates! - Luffy",
              "Wake up to reality! - Madara Uchiha",
              "A lesson without pain is meaningless. - Pain"
            ];
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            await sock.sendMessage(jid, { text: `*Anime Quote:*\n"${randomQuote}"` });
            break;

          case '!help':
            const helpText = `
*Anime MD Bot Commands:*
!character <name> - Get character info
!schedule - Set daily anime updates
!quote - Random anime quote
!help - Show this help
            `;
            await sock.sendMessage(jid, { text: helpText });
            break;
        }
      } catch (error) {
        console.error("Error processing command:", error);
        await sock.sendMessage(jid, { text: "Error processing your command." });
      }
    }
  });
}

startBot().catch(console.error);
