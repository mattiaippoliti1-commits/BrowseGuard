document.addEventListener("DOMContentLoaded", async () => {

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    const urlElement = document.getElementById("url");

    if (tab && tab.url) {
        urlElement.textContent = tab.url;
    } else {
        urlElement.textContent = "Unable to retrieve URL";
    }

});