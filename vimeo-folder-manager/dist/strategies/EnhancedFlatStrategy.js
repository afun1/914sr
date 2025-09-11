"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedFlatStrategy = void 0;
class EnhancedFlatStrategy {
    constructor() {
        this.name = 'enhanced-flat';
        this.priority = 3;
    }
    async canCreate(config) {
        // Enhanced flat always works
        return true;
    }
    async findExisting(parentId, childName, config) {
        try {
            const enhancedName = this.generateEnhancedName(childName, config);
            const response = await fetch('https://api.vimeo.com/me/folders', {
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                // Try multiple naming patterns for backward compatibility
                const namingPatterns = [
                    enhancedName,
                    `SSR - ${childName}`,
                    `📁 SSR • ${childName}`,
                    childName
                ];
                for (const pattern of namingPatterns) {
                    const existing = data.data?.find(folder => folder.name === pattern);
                    if (existing) {
                        return existing;
                    }
                }
            }
        }
        catch (error) {
            console.log('Enhanced flat search failed:', error);
        }
        return null;
    }
    async create(parentId, childName, config) {
        const enhancedName = this.generateEnhancedName(childName, config);
        const response = await fetch('https://api.vimeo.com/me/folders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: enhancedName,
                description: `Enhanced folder for ${childName} • Auto-organized by VimeoFolderManager`
            })
        });
        if (!response.ok) {
            throw new Error(`Failed to create enhanced flat folder: ${response.statusText}`);
        }
        return await response.json();
    }
    generateEnhancedName(childName, config) {
        const { prefix = '📁 SSR', separator = ' • ', useEmoji = true } = config.namingConvention || {};
        if (config.namingConvention?.customPattern) {
            return config.namingConvention.customPattern.replace('{name}', childName);
        }
        return `${prefix}${separator}${childName}`;
    }
}
exports.EnhancedFlatStrategy = EnhancedFlatStrategy;
//# sourceMappingURL=EnhancedFlatStrategy.js.map