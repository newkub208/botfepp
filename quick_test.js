const axios = require('axios');

async function testAPI() {
    try {
        const testUrl = 'https://www.tiktok.com/@tiktok/video/7106594312292453675';
        const apiKey = '024875ee661a808c753b5e2f6a3eb908547691275d2015a884772153679618ef';
        const apiUrl = `https://haji-mix-api.gleeze.com/api/autodl?url=${encodeURIComponent(testUrl)}&stream=true&api_key=${apiKey}`;
        
        console.log('🔍 Testing API with real TikTok URL...');
        console.log('📱 URL:', testUrl);
        console.log('🔗 API URL:', apiUrl);
        
        const response = await axios.get(apiUrl, { timeout: 30000 });
        console.log('✅ Status:', response.status);
        console.log('📊 Response:', JSON.stringify(response.data, null, 2));
        
        // Check for download URL
        const data = response.data;
        if (data.download_url) {
            console.log('✅ Found download_url:', data.download_url);
        } else if (data.url) {
            console.log('✅ Found url:', data.url);
        } else if (data.data?.download_url) {
            console.log('✅ Found data.download_url:', data.data.download_url);
        } else {
            console.log('❌ No download URL found');
            console.log('🔍 Available keys:', Object.keys(data));
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('📊 Status:', error.response.status);
            console.error('📊 Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testAPI();
