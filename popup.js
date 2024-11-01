document.getElementById("scrapeButton").addEventListener("click", () => {
  const url = document.getElementById("urlInput").value;

  let pageNumber = document.getElementById("maxPageInput").value;
  pageNumber = pageNumber > 0 ? parseInt(pageNumber) : 30;

  chrome.runtime.sendMessage({ action: "scrapeData", url, pageNumber });
});
