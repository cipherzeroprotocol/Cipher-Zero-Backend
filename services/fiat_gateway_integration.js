// services/fiat_gateway_integration.js

const axios = require('axios');

// Replace with your fiat gateway API endpoint and key
const fiatGatewayApiUrl = "https://api.your-fiat-gateway.com";
const apiKey = "YOUR_API_KEY";

async function convertCryptoToFiat(cryptoAmount, cryptoCurrency, fiatCurrency) {
    try {
        const response = await axios.post(`${fiatGatewayApiUrl}/convert`, {
            amount: cryptoAmount,
            from: cryptoCurrency,
            to: fiatCurrency,
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Converted ${cryptoAmount} ${cryptoCurrency} to ${response.data.amount} ${fiatCurrency}`);
    } catch (error) {
        console.error("Error converting crypto to fiat:", error);
    }
}

async function convertFiatToCrypto(fiatAmount, fiatCurrency, cryptoCurrency) {
    try {
        const response = await axios.post(`${fiatGatewayApiUrl}/convert`, {
            amount: fiatAmount,
            from: fiatCurrency,
            to: cryptoCurrency,
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Converted ${fiatAmount} ${fiatCurrency} to ${response.data.amount} ${cryptoCurrency}`);
    } catch (error) {
        console.error("Error converting fiat to crypto:", error);
    }
}

async function main() {
    const cryptoAmount = "1.0"; // Amount of cryptocurrency
    const cryptoCurrency = "ETH"; // Cryptocurrency code
    const fiatCurrency = "USD"; // Fiat currency code

    await convertCryptoToFiat(cryptoAmount, cryptoCurrency, fiatCurrency);
    await convertFiatToCrypto("100.0", fiatCurrency, cryptoCurrency);
}

main().catch(console.error);
