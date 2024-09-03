// api/example_api.js

import axios from 'axios';

const API_URL = 'http://localhost:3000/api'; // Replace with your actual API URL

export const fetchUserData = async (userId) => {
    try {
        const response = await axios.get(`${API_URL}/users/${userId}`);
        console.log('User data:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
    }
};

export const createUser = async (userData) => {
    try {
        const response = await axios.post(`${API_URL}/users`, userData);
        console.log('User created:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
};
