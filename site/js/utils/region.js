async function getRegionalAmazonLink() {
    const regionMap = {
        "GB": "https://www.amazon.co.uk/dp/B0F2ST7CXZ",
        "DE": "https://www.amazon.de/dp/B0F2ST7CXZ",
        "FR": "https://www.amazon.fr/dp/B0F2ST7CXZ",
        "ES": "https://www.amazon.es/dp/B0F2ST7CXZ",
        "IT": "https://www.amazon.it/dp/B0F2ST7CXZ",
        "NL": "https://www.amazon.nl/dp/B0F2ST7CXZ",
        "JP": "https://www.amazon.co.jp/dp/B0F2ST7CXZ",
        "BR": "https://www.amazon.com.br/dp/B0F2ST7CXZ",
        "CA": "https://www.amazon.ca/dp/B0F2ST7CXZ",
        "MX": "https://www.amazon.com.mx/dp/B0F2ST7CXZ",
        "AU": "https://www.amazon.com.au/dp/B0F2ST7CXZ",
        "IN": "https://www.amazon.in/dp/B0F2ST7CXZ"
    };
    const defaultLink = "https://www.amazon.com/dp/B0F2ST7CXZ";
    try {
        const response = await fetch("https://ipapi.co/json/");
        if (!response.ok) throw new Error("Failed to fetch IP data");
        const data = await response.json();
        const countryCode = data.country_code;
        return regionMap[countryCode] || defaultLink;
    } catch (error) {
        console.error("Error determining region:", error);
        return defaultLink;
    }
}
function openRegionalAmazonLink() {
    getRegionalAmazonLink()
        .then(link => window.open(link, '_blank'))
        .catch(error => console.error('Error opening regional Amazon link:', error));
}
