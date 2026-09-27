/**
 * Minimal Sent.dm SMS integration.
 *
 * Sent.dm supports both templated sends and free-form text. Free-form text to a
 * brand-new contact is subject to conversation-window rules (the first message
 * usually needs an approved template). If your first message to users is
 * blocked, set SENT_DM_TEMPLATE_NAME and SENT_DM_TEMPLATE_PARAMETERS_PREFIX and
 * create the matching approved template in your Sent.dm dashboard.
 *
 * @see https://docs.sent.dm/start/guides/sending-messages
 */

interface SentDmMessageResponse {
  data?: {
    recipients: {
      channel: string;
      message_id: string;
      to: string;
    }[];
    status: string;
    template_id?: string;
    template_name?: string;
  } | null;
  error?: {
    code: string;
    message: string;
  } | null;
  success: boolean;
}

export interface SendSmsInput {
  apiKey: string;
  baseUrl?: string;
  sandbox?: boolean;
  templateName?: string;
  templateParameters?: Record<string, string>;
  text?: string;
  to: string;
}

/**
 * Send a single SMS via Sent.dm. Returns the message ID if accepted.
 *
 * The API returns 202 on acceptance; final delivery status is async via
 * webhooks (not implemented here).
 */
export const sendSms = async ({
  apiKey,
  baseUrl = "https://api.sent.dm",
  sandbox = false,
  templateName,
  templateParameters,
  text,
  to,
}: SendSmsInput): Promise<{ messageId: string; status: string }> => {
  if (!to.startsWith("+")) {
    throw new Error("Phone number must be in E.164 format (e.g. +14155550123)");
  }

  const body: Record<string, unknown> = {
    channel: ["sms"],
    sandbox,
    to: [to],
  };

  if (templateName) {
    body.template = {
      name: templateName,
      ...(templateParameters ? { parameters: templateParameters } : {}),
    };
  } else if (text) {
    body.text = text;
  } else {
    throw new Error("Either templateName or text must be provided");
  }

  const response = await fetch(`${baseUrl}/v3/messages`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    method: "POST",
  });

  const result = (await response.json()) as SentDmMessageResponse;

  if (!response.ok || !result.success) {
    throw new Error(
      result.error?.message ?? `Sent.dm request failed (${response.status})`
    );
  }

  const recipient = result.data?.recipients[0];
  if (!recipient?.message_id) {
    throw new Error("Sent.dm response did not include a message_id");
  }

  return {
    messageId: recipient.message_id,
    status: result.data?.status ?? "QUEUED",
  };
};
