import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedEmail, DEFAULT_ADMIN_EMAIL} from '../lib/email-policy.ts';
test('accepts confirmed administrator and student domain only',()=>{
 const allowed=email=>allowedEmail(email,'unlv.nevada.edu',[DEFAULT_ADMIN_EMAIL]);
 assert.equal(allowed('unlvbadminton@unlv.edu'),true);
 assert.equal(allowed(' UNLVBADMINTON@UNLV.EDU '),true);
 assert.equal(allowed('student@unlv.nevada.edu'),true);
 for(const email of ['other@unlv.edu','unlvbadminton@unlv.edu.attacker.com','student@gmail.com','student@@unlv.nevada.edu',''])assert.equal(allowed(email),false);
 assert.equal(allowedEmail(DEFAULT_ADMIN_EMAIL,'unlv.nevada.edu',[]),false);
});
