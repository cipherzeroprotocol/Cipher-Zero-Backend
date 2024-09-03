// src/security/accessControl.js

const roles = {
    ADMIN: 'admin',
    USER: 'user',
    GUEST: 'guest'
};

/**
 * Checks if a user has the required role.
 * @param {string} userRole - The role of the user.
 * @param {string} requiredRole - The role required to access the resource.
 * @returns {boolean} - Whether the user has access.
 */
const hasAccess = (userRole, requiredRole) => {
    const roleHierarchy = [roles.GUEST, roles.USER, roles.ADMIN];
    return roleHierarchy.indexOf(userRole) >= roleHierarchy.indexOf(requiredRole);
};

/**
 * Middleware function for role-based access control.
 * @param {string} requiredRole - The role required to access the route.
 * @returns {Function} - The middleware function.
 */
const roleBasedAccessControl = (requiredRole) => {
    return (req, res, next) => {
        const userRole = req.user.role; // Assumes user role is attached to req.user
        if (hasAccess(userRole, requiredRole)) {
            next();
        } else {
            res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
        }
    };
};

module.exports = { roles, hasAccess, roleBasedAccessControl };
