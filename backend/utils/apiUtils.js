// src/utils/apiUtils.js

const axios = require('axios');

/**
 * Makes an HTTP GET request to the specified URL.
 * @param {string} url - The URL to send the request to.
 * @param {Object} [params] - Optional query parameters.
 * @returns {Promise<Object>} - The response data.
 */
const getRequest = async (url, params = {}) => {
    try {
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        handleError(error);
    }
};

/**
 * Makes an HTTP POST request to the specified URL.
 * @param {string} url - The URL to send the request to.
 * @param {Object} [data] - The data to send in the request body.
 * @returns {Promise<Object>} - The response data.
 */
const postRequest = async (url, data = {}) => {
    try {
        const response = await axios.post(url, data);
        return response.data;
    } catch (error) {
        handleError(error);
    }
};

/**
 * Handles API errors by logging them and throwing a new error.
 * @param {Error} error - The error object to handle.
 * @throws {Error} - Throws a new error with a standardized message.
 */
const handleError = (error) => {
    console.error('API Request Error:', error.response ? error.response.data : error.message);
    throw new Error('An error occurred while making the API request.');
};

module.exports = { getRequest, postRequest };
