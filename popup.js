document.addEventListener("DOMContentLoaded", async function () {

    try {

        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!tab || !tab.url) {
            return;
        }

        analyzeURL(tab.url);

    } catch (error) {

        console.error("Error retrieving tab:", error);

    }

});


function analyzeURL(urlString) {

    try {

        const url = new URL(urlString);

        const protocol = url.protocol.replace(":", "");
        const hostname = url.hostname;

        document.getElementById("protocol").textContent =
            protocol.toUpperCase();

        document.getElementById("hostname").textContent =
            hostname;

    } catch (error) {

        console.error("URL analysis failed:", error);

    }

}