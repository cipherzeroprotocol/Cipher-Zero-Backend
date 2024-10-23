class PermissionManager {
    constructor(roleManager) {
        this.roleManager = roleManager;
        this.permissionCache = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    }

    async checkPermission(userPublicKey, requiredPermission) {
        try {
            // Check cache first
            const cachedPermission = this.getCachedPermission(userPublicKey, requiredPermission);
            if (cachedPermission !== null) {
                return cachedPermission;
            }

            // Get user's role
            const userRole = this.roleManager.userRoles.get(userPublicKey);
            if (!userRole) {
                return false;
            }

            // Get role's permissions
            const rolePermissions = this.roleManager.roles.get(userRole.role)?.permissions || [];

            // Check if required permission exists
            const hasPermission = rolePermissions.includes(requiredPermission);

            // Cache the result
            this.cachePermission(userPublicKey, requiredPermission, hasPermission);

            return hasPermission;
        } catch (error) {
            console.error(`Error checking permission: ${error.message}`);
            return false;
        }
    }

    async verifyZkPermission(userPublicKey, requiredPermission, zkProof) {
        try {
            // First verify the ZK proof
            const proofValid = await verifyZkProof(zkProof);
            if (!proofValid) {
                return false;
            }

            // Then check regular permission
            return await this.checkPermission(userPublicKey, requiredPermission);
        } catch (error) {
            console.error(`Error verifying ZK permission: ${error.message}`);
            return false;
        }
    }

    getCachedPermission(userPublicKey, permission) {
        const cacheKey = `${userPublicKey}:${permission}`;
        const cached = this.permissionCache.get(cacheKey);
        
        if (!cached) {
            return null;
        }

        if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
            this.permissionCache.delete(cacheKey);
            return null;
        }

        return cached.hasPermission;
    }

    cachePermission(userPublicKey, permission, hasPermission) {
        const cacheKey = `${userPublicKey}:${permission}`;
        this.permissionCache.set(cacheKey, {
            hasPermission,
            timestamp: Date.now()
        });
    }

    // Middleware for Express.js routes
    createPermissionMiddleware(requiredPermission) {
        return async (req, res, next) => {
            const userPublicKey = req.user?.publicKey;
            
            if (!userPublicKey) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const hasPermission = await this.checkPermission(userPublicKey, requiredPermission);
            
            if (!hasPermission) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            next();
        };
    }

    // Middleware for WebSocket connections
    createWsPermissionMiddleware(requiredPermission) {
        return async (socket, next) => {
            const userPublicKey = socket.user?.publicKey;
            
            if (!userPublicKey) {
                return next(new Error('Unauthorized'));
            }

            const hasPermission = await this.checkPermission(userPublicKey, requiredPermission);
            
            if (!hasPermission) {
                return next(new Error('Forbidden'));
            }

            next();
        };
    }
}

module.exports = {
    RoleManager,
    PermissionManager
};