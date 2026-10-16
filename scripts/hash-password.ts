// Prints an OWNER_PASSWORD_HASH for the password read from stdin.
// Usage: echo -n 'my password' | bun run hash-password
import { hashPassword } from "../src/worker/auth";

const pw = (await Bun.stdin.text()).replace(/\r?\n$/, "");
if (pw.length < 8) {
  console.error("Use a password of at least 8 characters.");
  process.exit(1);
}
console.log(await hashPassword(pw));
