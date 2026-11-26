'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const tf = require(path.join(__dirname, '..', '..', 'src', 'usr', 'local', 'emhttp', 'plugins', 'firesquire', 'scripts', 'time-field.js'));

test('a time reads and writes as HH:MM, and one it cannot read stands as midnight', () => {
  assert.deepEqual(tf.parse('7:05'), { hour: 7, minute: 5 });
  assert.deepEqual(tf.parse(' 22:30 '), { hour: 22, minute: 30 });
  assert.deepEqual(tf.parse('noon'), { hour: 0, minute: 0 });
  assert.deepEqual(tf.parse('99:99'), { hour: 23, minute: 59 });
  assert.equal(tf.format(7, 5), '07:05');
});

test('the minutes go in steps of five, and a stored minute marks the nearest row', () => {
  assert.deepEqual(tf.minutes(5).slice(0, 3), [0, 5, 10]);
  assert.equal(tf.minutes(5).length, 12);
  assert.equal(tf.nearest(tf.minutes(5), 7), 5);
  assert.equal(tf.nearest(tf.minutes(5), 58), 55);
});

test('the arrows step a column, Home and End jump to its ends', () => {
  assert.equal(tf.step('ArrowDown', 3, 24), 4);
  assert.equal(tf.step('ArrowDown', 23, 24), 23);
  assert.equal(tf.step('ArrowUp', 0, 24), 0);
  assert.equal(tf.step('Home', 9, 12), 0);
  assert.equal(tf.step('End', 0, 12), 11);
  assert.equal(tf.step('a', 0, 12), null);
});

test('the field shows its value with the clock and says what it is', () => {
  const made = [];
  const doc = { createElement: (tag) => { const n = { tag, attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.children.push(c); } }; made.push(n); return n; } };
  const fired = [];
  const b = {
    ownerDocument: doc, attrs: {}, children: [], listeners: {}, classes: [], classList: { add(c) { b.classes.push(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
    appendChild(c) { this.children.push(c); }, addEventListener(t, fn) { this.listeners[t] = fn; },
    dispatchEvent(e) { fired.push(e); }, set textContent(v) { this.children = []; }
  };
  tf.enhance(b, { label: 'From' });
  b.value = '22:00';
  assert.equal(b.value, '22:00');
  assert.equal(b.attrs['aria-label'], 'From: 22:00');
  assert.equal(b.attrs.dir, 'ltr');
  assert.match(b.children[0].innerHTML, /^<svg viewBox="0 0 14 14"/);
  assert.equal(b.children[1].textContent, '22:00');
  assert.deepEqual(b.classes, ['glim-tf-field']);
  assert.equal(fired.length, 0, 'setting the value is no change of the reader');
});

test('the field shows the focus as a step up its fill, as a text field does, and draws no ring', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'usr', 'local', 'emhttp', 'plugins', 'firesquire', 'styles', 'time-field.css'), 'utf8');
  assert.match(css, /button\.glim-tf-field:is\(:hover, :focus-visible, \[aria-expanded="true"\]\) \{ background-color: var\(--tf-field-hover\) !important; \}/);
  assert.match(css, /button\.glim-tf-field:focus-visible \{ outline: none !important; \}/);
  assert.doesNotMatch(css, /glim-tf-field:focus-visible \{[^}]*outline: 2px/);
});
