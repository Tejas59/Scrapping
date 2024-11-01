chrome.runtime.onInstalled.addListener(() => {
  
});

let additionalDataArray = [];
let scrapingTabId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrapeData") {
    const { url, pageNumber } = request;

    additionalDataArray = [];
    let currentPage = 1;

    function openOrUpdateTab(pageUrl) {
      if (scrapingTabId === null) {
        chrome.tabs.create({ url: pageUrl }, (newTab) => {
          scrapingTabId = newTab.id;
          waitForTabLoad(newTab.id, pageUrl);
        });
      } else {
        chrome.tabs.update(scrapingTabId, { url: pageUrl }, () => {
          waitForTabLoad(scrapingTabId, pageUrl);
        });
      }
    }

    function waitForTabLoad(tabId, pageUrl) {
      chrome.tabs.onUpdated.addListener(function listener(
        updatedTabId,
        changeInfo
      ) {
        if (updatedTabId === tabId && changeInfo.status === "complete") {
          chrome.scripting.executeScript(
            { target: { tabId }, function: scrapeCompanies },
            (results) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error injecting script:",
                  chrome.runtime.lastError.message
                );
              } else {
                const { companies, hasNextPage } = results[0].result;
           

                chrome.tabs.sendMessage(tabId, {
                  action: "scrapeCompanyDetails",
                  companies,
                });

                chrome.runtime.onMessage.addListener(function listener(
                  request
                ) {
                  if (request.action === "sendScrapedData") {
                    const scrapedData = request.data;
                    additionalDataArray.push(...scrapedData);
                  

                    if (hasNextPage && currentPage < pageNumber) {
                      currentPage++;
                      const nextPageUrl = `${url}&page=${currentPage}`;
                      openOrUpdateTab(nextPageUrl);
                    } else {
                    
                      triggerCSVDownload();
                      closeTab();
                    }
                    chrome.runtime.onMessage.removeListener(listener);
                  }
                });
              }
            }
          );
          chrome.tabs.onUpdated.removeListener(listener);
        }
      });
    }

    function closeTab() {
      if (scrapingTabId !== null) {
        chrome.tabs.remove(scrapingTabId, () => {
        
          scrapingTabId = null;
        });
      }
    }

    const firstPageUrl = `${url}`;
    openOrUpdateTab(firstPageUrl);
  }
});

function convertToCSV(dataArray) {
  const headers = [
    "Name",
    "Founded Year",
    "India Employee Count",
    "Global Employee Count",
    "Headquarters",
    "Office Locations",
    "Website Link",
    "Primary Industry",
    "Other Industries",
  ];

  const csvRows = [headers.join(",")];

  dataArray.forEach((item) => {
    const row = [
      item.name,
      item.foundedYear,
      item.indiaEmployeeCount,
      item.globalEmployeeCount,
      item.headquarters,
      (item.officeLocations || []).join(" | "),
      item.websiteLink,
      item.primaryIndustry,
      (item.otherIndustries || []).join(" | "),
    ];
    csvRows.push(row.map((val) => `"${val}"`).join(","));
  });

  return csvRows.join("\n");
}

function downloadCSV(dataArray) {
  const csvContent = convertToCSV(dataArray);
  const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(
    csvContent
  )}`;

  chrome.downloads.download({
    url: dataUrl,
    filename: "company_data.csv",
    saveAs: true,
  });

 
}

function triggerCSVDownload() {
  if (additionalDataArray.length > 0) {
    downloadCSV(additionalDataArray);
  } else {
  }
}

function scrapeCompanies() {
  const companies = [];
  const cards = document.querySelectorAll(".companyCardWrapper");

  if (cards.length === 0) {
    return { companies, hasNextPage: false };
  }

  cards.forEach((card) => {
    const name =
      card.querySelector('meta[itemprop="name"]')?.getAttribute("content") ||
      "N/A";
    const companyUrl =
      card.querySelector('meta[itemprop="url"]')?.getAttribute("content") ||
      "N/A";
    companies.push({ name, companyUrl });
  });

  const hasNextPage = !!document.querySelector(".page-nav-btn");
  return { companies, hasNextPage };
}
