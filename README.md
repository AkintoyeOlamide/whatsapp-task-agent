# WhatsApp task agent

A small personal agent that remembers tasks, messages you when they are due, and replies when you text it.

It uses the official WhatsApp Cloud API. Your phone stays a normal WhatsApp account. The agent talks through a WhatsApp Business number that Meta gives you.

## How a message moves

1. You text the business number: `add Buy milk at 18:30`.
2. Meta sends that message to this app's webhook (`POST /webhook`).
3. The app checks the message is from your number, saves the task, and replies on WhatsApp.
4. Every 15 seconds the app looks for tasks whose time has arrived.
5. It sends `Reminder: Buy milk`, then marks the task reminded. A daily task is scheduled for the next day instead.

Replies and reminders are both real WhatsApp messages. They follow different rules:

- **Replies** are free-form text. They work for 24 hours after you last message the bot. Each new message from you resets that 24-hour window.
- **Reminders you did not just ask for in chat** are business-initiated. Outside that 24-hour window, WhatsApp only allows a pre-approved template. This app sends normal text while the window is open, and uses `WHATSAPP_TEMPLATE_NAME` when it is closed.

The computer running `npm start` is the clock and the scheduler. If that process stops, reminders wait until it is running again. Times use that computer's local timezone.

## What you need

- Node.js 20 or newer
- A Meta developer account: https://developers.facebook.com
- A Meta app with the WhatsApp product added
- The test business number from WhatsApp > API Setup
- Your own phone number added as a test recipient (Meta's test mode only delivers to numbers you register)
- `WHATSAPP_TOKEN` and `PHONE_NUMBER_ID` from that API Setup page
- `OWNER_PHONE`, your number with country code and no plus sign
- A public HTTPS address for the webhook while you want replies. `ngrok http 3000` is enough on your PC. Reminders can be tried without it; replies from WhatsApp cannot.
- Optional: an approved utility template if you want reminders when you have not texted the bot in 24 hours. Body: `Reminder: {{1}}`. Put its name in `WHATSAPP_TEMPLATE_NAME`.

Meta bills business WhatsApp messages. The test number is enough to try this with your own phone. Check current rates in WhatsApp Manager before you rely on it.

A temporary token from API Setup expires in about 24 hours. For something you leave running, create a permanent token with a system user in Meta Business Settings.

## Run it

```powershell
cd C:\Users\USER\develop\whatsapp-task-agent
copy .env.example .env
npm install
npm start
```

Without tokens, the app starts in dry-run mode and prints messages in the terminal instead of sending them.

Try the commands locally, with no WhatsApp account:

```powershell
npm run say -- "add Buy milk at 18:30"
npm run say -- list
```

## Connect WhatsApp

1. Fill in `.env`.
2. Start the app.
3. Run a tunnel, for example `ngrok http 3000`.
4. In the Meta app, open WhatsApp > Configuration.
5. Callback URL: `https://<your-tunnel>/webhook`
6. Verify token: the same string as `VERIFY_TOKEN`.
7. Subscribe to the `messages` field.
8. From your phone, open the test business number and send `help`.

## Commands

```text
add Buy milk at 18:30
add Call mom at tomorrow 09:00
add Pay rent at 2026-10-07 09:00
add Vitamins at 08:00 daily
add Stretch in 30m
list
done 1
delete 1
help
```

`remind me to buy milk at 18:30` works the same way as `add`.

Anything else gets a short reply telling you to send `help`. This agent does not hold an open conversation or answer general questions. It only replies about tasks.
