/** Local onboarding and shared, modal glossary controls. Native dialogs provide focus containment. */
(function (root) {
    const completionKey = 'browserguard.onboarding.v1';
    const steps = [
        ['What BrowserGuard does', 'BrowserGuard analyzes observable technical signals from websites to help you better understand security, privacy, and network activity.'],
        ['Understanding results', 'Green: Low.\nYellow: Moderate.\nRed: High.\nGray: — (unavailable).\nResults are based only on signals BrowserGuard can observe. Missing information is shown alongside confirmed findings.'],
        ['Important limitations', 'BrowserGuard does not certify that a website is safe or trustworthy and does not automatically block threats or tracking. Expand each category for explanations and open Technical Details for evidence.']
    ];
    function setup(document, chrome) {
        const dialog = document.getElementById('onboarding');
        const help = document.getElementById('help-button');
        let step = 0;
        let returnFocus = help;
        function render() {
            document.getElementById('onboarding-progress').textContent = `Getting started · ${step + 1} of 3`;
            document.getElementById('onboarding-title').textContent = steps[step][0];
            document.getElementById('onboarding-copy').textContent = steps[step][1];
            document.getElementById('onboarding-back').disabled = step === 0;
            document.getElementById('onboarding-next').textContent = step === 2 ? 'Get started' : 'Next';
            const title = document.getElementById('onboarding-title');
            title.setAttribute('tabindex', '-1');
            title.focus();
        }
        function open() {
            step = 0;
            returnFocus = document.activeElement === document.body ? help : document.activeElement;
            dialog.showModal();
            render();
        }
        async function finish() {
            try {
                await chrome.storage.local.set({ [completionKey]: true });
                dialog.close();
                returnFocus?.focus();
            } catch {
                document.getElementById('onboarding-storage-status').textContent = 'Your preference could not be saved. You can close this introduction; it may appear again next time.';
                document.getElementById('onboarding-skip').textContent = 'Close introduction';
                document.getElementById('onboarding-skip').onclick = () => { dialog.close(); returnFocus?.focus(); };
            }
        }
        help.addEventListener('click', open);
        document.getElementById('onboarding-next').addEventListener('click', () => {
            if (step === 2) { void finish(); return; }
            step++; render();
        });
        document.getElementById('onboarding-back').addEventListener('click', () => { step = Math.max(0, step - 1); render(); });
        document.getElementById('onboarding-skip').onclick = finish;
        dialog.addEventListener('cancel', event => { event.preventDefault(); void finish(); });
        chrome.storage.local.get(completionKey).then(stored => {
            if (stored[completionKey] !== true && !dialog.open) open();
        }).catch(open);

        const glossary = document.getElementById('glossary-dialog');
        let glossaryTrigger;
        document.addEventListener('click', event => {
            const button = event.target.closest('[data-glossary]');
            if (!button) return;
            const term = button.dataset.glossary;
            const explanation = root.BrowserGuardPresentation.glossary[term];
            if (!explanation) return;
            glossaryTrigger = button;
            document.getElementById('glossary-title').textContent = term;
            document.getElementById('glossary-copy').textContent = explanation;
            glossary.showModal();
        });
        document.getElementById('glossary-close').addEventListener('click', () => glossary.close());
        glossary.addEventListener('close', () => glossaryTrigger?.focus());
    }
    const api = { setup, completionKey };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BrowserGuardExperience = api;
})(globalThis);
