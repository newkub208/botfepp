const axios = require("axios");

async function testAPI() {
    const apiKey = "024875ee661a808c753b5e2f6a3eb908547691275d2015a884772153679618ef";
    
    // Test with empty URL first to see what the API expects
    try {
        console.log("Testing API endpoint with empty URL...");
        
        const apiUrl = `https://haji-mix-api.gleeze.com/api/autodl?url=&stream=true&api_key=${apiKey}`;
        console.log("Full API URL:", apiUrl);
        
        const response = await axios.get(apiUrl, { timeout: 10000 });
        console.log("API Response Status:", response.status);
        console.log("API Response Data:", JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error("API Test Error:", error.message);
        if (error.response) {
            console.error("Response Status:", error.response.status);
            console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

testAPI();
