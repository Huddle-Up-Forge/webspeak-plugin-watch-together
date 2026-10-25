import assert from 'node:assert/strict';import test from 'node:test';
import {copies} from '../client/i18n.mjs';
test('all UI strings are supplied in five languages',()=>{for(const language of ['zh','en','de','ru','ja'])assert.deepEqual(Object.keys(copies[language]).sort(),Object.keys(copies.en).sort(),language);});
