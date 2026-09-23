import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

// Two ways to deliver, picked automatically:
//   1. Resend, if RESEND_API_KEY is set (works anywhere, including CI).
//   2. The Mac's own Mail.app, which needs no account and no key.
export function transport() {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.platform === 'darwin') return 'mail';
  return null;
}

function applescriptString(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

async function sendViaMail({ to, subject, text }) {
  const script = `
    tell application "Mail"
      set msg to make new outgoing message with properties {subject:${applescriptString(
        subject
      )}, content:${applescriptString(text)}, visible:false}
      tell msg to make new to recipient at end of to recipients with properties {address:${applescriptString(
        to
      )}}
      send msg
    end tell`;
  await run('osascript', ['-e', script], { timeout: 60_000 });
}

async function sendViaResend({ to, subject, html }) {
  const { Resend } = await import('resend');
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'PS5 Pro Alert <onboarding@resend.dev>',
    to,
    subject,
    html,
  });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
}

// A 45-second restock window is too short to rely on email alone if he is at
// the Mac, so an alert also fires a banner with sound.
export async function notifyDesktop(title, message) {
  if (process.platform !== 'darwin') return;
  try {
    await run('osascript', [
      '-e',
      `display notification ${applescriptString(message)} with title ${applescriptString(
        title
      )} sound name "Glass"`,
    ]);
  } catch {
    // A failed banner must never block the email.
  }
}

// The window is measured in seconds, so the product page is opened the
// instant stock is seen — no waiting for him to read the mail and click.
// Opening a page is all this does; nothing is added to a cart or bought.
export async function openProductPage(url) {
  if (process.platform !== 'darwin' || process.env.NO_AUTO_OPEN === '1') return;
  try {
    await run('open', [url]);
  } catch {
    // Never let a failed open block the alert.
  }
}

export async function send({ subject, text, html }) {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) throw new Error('NOTIFY_EMAIL not set');
  const how = transport();
  if (how === 'resend') return sendViaResend({ to, subject, html });
  if (how === 'mail') return sendViaMail({ to, subject, text });
  throw new Error('No way to send mail: set RESEND_API_KEY, or run on a Mac with Mail configured');
}
