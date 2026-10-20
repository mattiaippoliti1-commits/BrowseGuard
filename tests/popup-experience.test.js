const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const presentation = require('../popup/presentation');
const { setup, completionKey } = require('../popup/experience');
// Small DOM contract harness, kept dependency-free like the existing popup tests.
class Element {
    constructor(id, document) {
        this.id = id; this.document = document; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {};
        this.hidden = false; this.open = false; this.textContent = ''; this.classList = { toggle() {}, add() {}, remove() {} };
    }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    async emit(name, event = {}) { for (const fn of this.listeners[name] || []) await fn(event); if (name === 'click' && this.onclick) await this.onclick(event); }
    appendChild(child) { this.children.push(child); return child; }
    focus() { this.document.activeElement = this; }
    showModal() { this.open = true; this.focus(); }
    close() { this.open = false; void this.emit('close'); }
    scrollIntoView() {}
}
function harness(completed = false) {
    const elements = new Map(); const document = {
        documentElement: { dataset: {} }, listeners: {},
        getElementById(id) { if (!elements.has(id)) elements.set(id, new Element(id, document)); return elements.get(id); },
        createElement(tag) { return new Element(tag, document); },
        addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); },
        querySelectorAll(selector) { return selector === '.assessment-card' ? cards : []; },
        querySelector(selector) { return cards.find(c => selector.includes("'" + c.dataset.dimension + "'")) || this.getElementById('summary'); }
    };
    document.body = new Element('body', document); document.activeElement = document.body;
    const cards = presentation.dimensions.map(d => { const c = new Element(d, document); c.dataset.dimension = d; return c; });
    const stored = { [completionKey]: completed };
    const chrome = { storage: { local: { get: async () => stored, set: async value => Object.assign(stored, value) } } };
    return { document, chrome, stored, cards, el: id => document.getElementById(id) };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('first run, steps, completion, reopening, skip and Escape persistence', async () => {
    const h = harness(); setup(h.document, h.chrome); await settle();
    assert.equal(h.el('onboarding').open, true);
    assert.equal(h.document.activeElement.id, 'onboarding-title');
    assert.equal(h.el('onboarding-back').disabled, true);
    await h.el('onboarding-next').emit('click'); assert.match(h.el('onboarding-progress').textContent, /2 of 3/);
    await h.el('onboarding-next').emit('click'); assert.match(h.el('onboarding-title').textContent, /limitations/);
    await h.el('onboarding-next').emit('click'); await settle();
    assert.equal(h.stored[completionKey], true); assert.equal(h.el('onboarding').open, false);
    assert.equal(h.document.activeElement.id, 'help-button');
    await h.el('help-button').emit('click'); assert.equal(h.el('onboarding').open, true);
    await h.el('onboarding-skip').emit('click'); assert.equal(h.el('onboarding').open, false);
    await h.el('help-button').emit('click');
    let prevented = false;
    await h.el('onboarding').emit('cancel', { preventDefault() { prevented = true; } }); await settle();
    assert.ok(prevented); assert.equal(h.el('onboarding').open, false);
});
test('completed introduction stays closed on later opens', async () => {
    const h = harness(true); setup(h.document, h.chrome); await settle();
    assert.equal(h.el('onboarding').open, false);
});
test('glossary click and keyboard-compatible close restore focus', async () => {
    const h = harness(true); globalThis.BrowserGuardPresentation = presentation;
    setup(h.document, h.chrome);
    const trigger = new Element('term', h.document); trigger.dataset.glossary = 'HTTPS';
    for (const fn of h.document.listeners.click) fn({ target: { closest: () => trigger } });
    assert.equal(h.el('glossary-dialog').open, true);
    assert.match(h.el('glossary-copy').textContent, /Encrypts/);
    await h.el('glossary-close').emit('click');
    assert.equal(h.document.activeElement, trigger);
    delete globalThis.BrowserGuardPresentation;
});
test('category cards open evidence directly, move focus, and preserve long hostnames', () => {
    const h = harness(true);
    const context = vm.createContext({ document: h.document, window: { matchMedia: () => ({ matches: true }) }, console,
        BrowserGuardPresentation: presentation });
    vm.runInContext(fs.readFileSync('popup/popup.js', 'utf8'), context);
    vm.runInContext('updateAssessment(null)', context);
    const card = h.cards[0];
    for (const fn of h.document.listeners.click) fn({ target: { closest: selector => selector === '.assessment-card' ? card : null } });
    assert.equal(h.el('technical-details-content').hidden, false);
    assert.equal(h.el('technical-details-trigger').getAttribute('aria-expanded'), 'true');
    assert.equal(h.document.activeElement.id, 'security-findings-title');
    const host = 'long-domain.'.repeat(30) + 'example.com'; context.host = host;
    vm.runInContext('updateText("hostname", host)', context);
    assert.equal(h.el('hostname').textContent, host);
    assert.match(fs.readFileSync('popup/popup.css', 'utf8'), /\.site-host\s*\{[^}]*text-overflow: ellipsis/);
});
test('storage write failure offers a usable close without claiming persistence', async () => {
    const h = harness();
    h.chrome.storage.local.set = async () => { throw new Error('storage unavailable'); };
    setup(h.document, h.chrome); await settle();
    await h.el('onboarding-skip').emit('click');
    assert.equal(h.stored[completionKey], false);
    assert.match(h.el('onboarding-storage-status').textContent, /could not be saved/);
    await h.el('onboarding-skip').emit('click');
    assert.equal(h.el('onboarding').open, false);
});
test('real engine results render evidence and explanations without changing input', () => {
    const { assessBrowserState } = require('../modules/assessment/assessment-engine');
    const h = harness(true);
    const assessment = assessBrowserState({ urlAnalysis: { usesHTTPS: false, protocol: 'http' }, networkActivity: {
        totalRequests: 80, trackerDomainCount: 5, trackerRequests: 40, thirdPartyRequests: 60, thirdPartyDomainCount: 16
    } });
    const context = vm.createContext({ document: h.document, window: { matchMedia: () => ({ matches: true }) }, console,
        BrowserGuardPresentation: presentation, assessment });
    vm.runInContext(fs.readFileSync('popup/popup.js', 'utf8'), context);
    const before = JSON.stringify(assessment);
    vm.runInContext('updateAssessment(assessment); focusTechnicalDetailsSection("privacy")', context);
    assert.equal(h.el('panel-privacy').hidden, false);
    assert.equal(JSON.stringify(assessment), before);
    function allText(element) { return element.textContent + element.children.map(allText).join(' '); }
    assert.match(allText(h.el('assessment-reasons')), /Tracker domain count/i);
    assert.match(allText(h.el('assessment-reasons')), /Supporting evidence/);
    assert.equal(h.el('assessment-security').textContent, 'High');
    assert.equal(h.el('assessment-privacy').textContent, 'High');
    assert.equal(h.el('assessment-network').textContent, '—');
});
