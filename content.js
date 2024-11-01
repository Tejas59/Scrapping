chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrapeCompanyDetails") {
    const companyList = request.companies;

    const promises = companyList.map(({ companyUrl, name }) => {
      return fetch(companyUrl)
        .then((response) => response.text())
        .then((html) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");

          return scrapeCompanyDetails(doc, name);
        })
        .catch((error) => console.error("Error fetching company URL:", error));
    });

    Promise.all(promises).then((scrapedDataArray) => {
      chrome.runtime.sendMessage({
        action: "sendScrapedData",
        data: scrapedDataArray,
      });
    });
  }

  if (request.action === "downloadExcel") {
    downloadExcel(request.data);
  }
});

function scrapeCompanyDetails(doc, name) {
  const data = {
    name: name,
    foundedYear: "N/A",
    indiaEmployeeCount: "N/A",
    globalEmployeeCount: "N/A",
    headquarters: "N/A",
    officeLocations: [],
    websiteLink: "N/A",
    primaryIndustry: "N/A",
    otherIndustries: [],
  };

  const spanElements = Array.from(doc.querySelectorAll("span"));
  spanElements.forEach((span) => {
    const nextElement = span.nextElementSibling;
    if (span.textContent?.includes("Founded in")) {
      data.foundedYear = nextElement ? nextElement.textContent : "N/A";
    } else if (span.textContent?.includes("India Employee Count")) {
      data.indiaEmployeeCount = nextElement ? nextElement.textContent : "N/A";
    } else if (span.textContent?.includes("Global Employee Count")) {
      data.globalEmployeeCount = nextElement ? nextElement.textContent : "N/A";
    } else if (span.textContent?.includes("India Headquarters")) {
      data.headquarters = nextElement ? nextElement.textContent : "N/A";
    }
  });

  const locationElements = Array.from(
    doc.querySelectorAll('a[data-testid^="Office_Locations"]')
  );
  data.officeLocations = locationElements.map(
    (el) => el.textContent?.trim() || "N/A"
  );

  const websiteElement = doc.querySelector('a[data-testid="Website"]');
  data.websiteLink = websiteElement
    ? websiteElement.getAttribute("href") || "N/A"
    : "N/A";

  const primaryIndustryElement = doc.querySelector(
    'a[data-testid^="Primary_Industry_"]'
  );
  data.primaryIndustry = primaryIndustryElement
    ? primaryIndustryElement.textContent?.trim() || "N/A"
    : "N/A";

  const industryElements = doc.querySelectorAll(
    'a[data-testid^="Other_Industries_"]'
  );
  data.otherIndustries = Array.from(industryElements).map(
    (industry) => industry.textContent?.trim() || "N/A"
  );

  return data;
}

function downloadExcel(dataArray) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(dataArray);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Companies");

  const excelFile = XLSX.write(workbook, { bookType: "xlsx", type: "binary" });

  const buffer = new ArrayBuffer(excelFile.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < excelFile.length; i++) {
    view[i] = excelFile.charCodeAt(i) & 0xff;
  }
  const blob = new Blob([buffer], { type: "application/octet-stream" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "company_data.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
