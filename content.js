/**
 * BrowserGuard Page Analyzer
 *
 * This content script analyzes the currently loaded web page
 * and extracts security-relevant information from the DOM.
 */


/**
 * Analyze security-relevant forms in the current page.
 *
 * @returns {object} Information about detected forms.
 */
function analyzeForms() {

    // Select all form elements in the page
    const forms = document.querySelectorAll("form");

    // Select all password input fields
    const passwordFields =
        document.querySelectorAll('input[type="password"]');

    // Initialize counters
    let externalPasswordForms = 0;
    let insecurePasswordForms = 0;


    // Analyze every form found in the page
    forms.forEach(function (form) {

        // Check whether the form contains a password field
        const passwordField =
            form.querySelector('input[type="password"]');

        // Skip forms that do not collect passwords
        if (!passwordField) {
            return;
        }

        // Read the action attribute of the form
        const action = form.getAttribute("action");


        // If the form has no explicit action,
        // the browser normally submits it to the current page
        if (!action) {
            return;
        }

        try {

            // Convert the action into an absolute URL
            const actionURL =
                new URL(action, window.location.href);

            // Check whether the password is sent to a different host
            if (
                actionURL.hostname !==
                window.location.hostname
            ) {
                externalPasswordForms++;
            }

            // Check whether the password is sent using HTTP
            if (actionURL.protocol === "http:") {
                insecurePasswordForms++;
            }

        } catch (error) {

            // Ignore malformed form actions
            console.error(
                "BrowserGuard: invalid form action",
                error
            );

        }

    });


    // Return the collected information
    return {

        // Total number of forms found in the page
        formCount: forms.length,

        // Total number of password fields
        passwordFieldCount: passwordFields.length,

        // Password forms that submit to another hostname
        externalPasswordForms:
            externalPasswordForms,

        // Password forms that submit over HTTP
        insecurePasswordForms:
            insecurePasswordForms

    };

}


// Run the form analysis when the content script is loaded
const formAnalysis = analyzeForms();

console.log(
    "BrowserGuard Form Analysis:",
    formAnalysis
);