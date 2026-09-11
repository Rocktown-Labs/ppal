const constantTimeEqual = (left: string, right: string): boolean => {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    // oxlint-disable-next-line no-bitwise -- constant-time token comparison
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
};

export const hasOperationsAccess = (
  request: Request,
  expectedToken: string | undefined
): boolean => {
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "") ?? "";
  return (
    Boolean(expectedToken && expectedToken.length >= 32) &&
    constantTimeEqual(supplied, expectedToken ?? "")
  );
};
