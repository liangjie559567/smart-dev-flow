import { validateEmail, validatePassword, validateUsername } from '../utils/validators';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

// validateEmail
assert(validateEmail('user@example.com') === null, 'valid email returns null');
assert(validateEmail('bad-email') !== null, 'invalid email returns error');
assert(validateEmail('') !== null, 'empty email returns error');

// validatePassword
assert(validatePassword('123456') === null, 'valid password returns null');
assert(validatePassword('12345') !== null, 'short password returns error');
assert(validatePassword('') !== null, 'empty password returns error');

// validateUsername
assert(validateUsername('ab') === null, 'valid username returns null');
assert(validateUsername('a') !== null, 'short username returns error');
assert(validateUsername('') !== null, 'empty username returns error');
