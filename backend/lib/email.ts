import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { RequestStatus } from '../types';

const ses = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const SENDER = process.env.SENDER_EMAIL ?? 'noreply@jpdxsolo.com';

const STATUS_LABELS: Record<RequestStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  downloading: 'Downloading',
  complete: 'Complete',
  rejected: 'Rejected',
};

interface StatusChangeEmailParams {
  recipientEmail: string;
  title: string;
  mediaType: 'movie' | 'tv';
  newStatus: RequestStatus;
  adminNote?: string;
}

export async function sendStatusChangeEmail(params: StatusChangeEmailParams): Promise<void> {
  const { recipientEmail, title, mediaType, newStatus, adminNote } = params;
  const statusLabel = STATUS_LABELS[newStatus];
  const mediaLabel = mediaType === 'movie' ? 'Movie' : 'TV Show';
  const subject = `Your request for "${title}" has been ${statusLabel.toLowerCase()}`;

  const noteSection = adminNote
    ? `<p style="margin-top:16px;padding:12px;background:#f5f5f5;border-radius:6px;"><strong>Admin note:</strong> ${adminNote}</p>`
    : '';

  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;color:#333;">
      <h2 style="color:#7c3aed;">Plex Request Update</h2>
      <p>Your request for the ${mediaLabel.toLowerCase()} <strong>${title}</strong> has been updated:</p>
      <p style="font-size:18px;font-weight:bold;color:#7c3aed;">${statusLabel}</p>
      ${noteSection}
      <hr style="margin-top:24px;border:none;border-top:1px solid #eee;" />
      <p style="font-size:12px;color:#999;">You received this because you submitted a request on Plex Request.</p>
    </div>
  `.trim();

  const text = [
    `Plex Request Update`,
    ``,
    `Your request for the ${mediaLabel.toLowerCase()} "${title}" has been updated to: ${statusLabel}`,
    adminNote ? `\nAdmin note: ${adminNote}` : '',
  ].join('\n');

  const command = new SendEmailCommand({
    Source: SENDER,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: html },
        Text: { Data: text },
      },
    },
  });

  await ses.send(command);
}
