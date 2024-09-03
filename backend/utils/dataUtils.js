// src/utils/dataUtils.js

/**
 * Validates if an object is not empty.
 * @param {Object} obj - The object to validate.
 * @returns {boolean} - True if the object is not empty, false otherwise.
 */
const isNotEmpty = (obj) => {
    return obj && Object.keys(obj).length > 0;
};

/**
 * Filters an array of objects based on a predicate function.
 * @param {Array<Object>} array - The array to filter.
 * @param {Function} predicate - The function used to test each element.
 * @returns {Array<Object>} - The filtered array.
 */
const filterArray = (array, predicate) => {
    return array.filter(predicate);
};

/**
 * Transforms data to a specific format.
 * @param {Object} data - The data to transform.
 * @param {Function} transformFn - The transformation function.
 * @returns {Object} - The transformed data.
 */
const transformData = (data, transformFn) => {
    return transformFn(data);
};

module.exports = { isNotEmpty, filterArray, transformData };
