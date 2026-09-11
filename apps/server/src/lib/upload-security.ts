/* oxlint-disable no-await-in-loop -- Signature bytes must be read sequentially from one stream reader. */

const FILE_SIGNATURE_LENGTH = 12;

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((value, index) => bytes[index] === value);

export const matchesDeclaredMimeType = (
  bytes: Uint8Array,
  mimeType: string
): boolean => {
  if (mimeType === "image/jpeg") {
    return startsWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (mimeType === "image/png") {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mimeType === "image/webp") {
    return (
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
    );
  }
  if (mimeType === "image/gif") {
    return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]);
  }
  if (mimeType === "application/pdf") {
    return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  }
  return false;
};

export const inspectStreamSignature = async (
  body: ReadableStream<Uint8Array>,
  mimeType: string
): Promise<{ accepted: boolean; uploadBody: ReadableStream<Uint8Array> }> => {
  const [inspectionBody, uploadBody] = body.tee();
  const reader = inspectionBody.getReader();
  const prefix = new Uint8Array(FILE_SIGNATURE_LENGTH);
  let offset = 0;
  try {
    while (offset < prefix.length) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const available = Math.min(value.length, prefix.length - offset);
      prefix.set(value.subarray(0, available), offset);
      offset += available;
    }
  } finally {
    await reader.cancel();
  }
  return {
    accepted: matchesDeclaredMimeType(prefix.subarray(0, offset), mimeType),
    uploadBody,
  };
};
