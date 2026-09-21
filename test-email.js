// One-off delivery test. Run: NOTIFY_EMAIL=... RESEND_API_KEY=... npm run test-email
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const to = process.env.NOTIFY_EMAIL;
if (!apiKey || !to) {
  console.error('Set RESEND_API_KEY and NOTIFY_EMAIL first.');
  process.exit(1);
}
const { data, error } = await new Resend(apiKey).emails.send({
  from: 'PS5 Pro Alert <onboarding@resend.dev>',
  to,
  subject: 'PS5 Pro monitor — delivery test',
  html: '<p style="font-family:sans-serif;font-size:15px;">If you can read this, alerts will reach you.</p>',
});
if (error) {
  console.error('FAILED:', JSON.stringify(error));
  process.exit(1);
}
console.log('Sent OK to', to, '| id', data?.id);
