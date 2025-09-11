import { VimeoFolder, FolderOrganizationConfig, FolderCreationResult } from './types';
/**
 * Advanced Vimeo Folder Manager
 *
 * This library provides intelligent folder organization for Vimeo with multiple strategies:
 * 1. True nested folders (if supported by account)
 * 2. Virtual path naming for hierarchy simulation
 * 3. Enhanced flat structure with visual grouping
 * 4. Showcase/Collection-based organization
 *
 * Features:
 * - Automatic strategy detection and fallback
 * - Existing folder detection across naming patterns
 * - Robust error handling and retry logic
 * - Caching for performance
 * - TypeScript support
 */
export declare class VimeoFolderManager {
    private accessToken;
    private config;
    private strategies;
    private folderCache;
    private strategyCache;
    constructor(config: FolderOrganizationConfig);
    /**
     * Main method to create or find an organized folder
     */
    createOrganizedFolder(parentFolderId: string, folderName: string, options?: {
        forceStrategy?: string;
        skipCache?: boolean;
    }): Promise<FolderCreationResult>;
    /**
     * Search for folders across the account
     */
    searchFolders(searchTerm: string, options?: {
        includeSubfolders?: boolean;
    }): Promise<VimeoFolder[]>;
    /**
     * Get folder hierarchy information
     */
    getFolderHierarchy(folderId: string): Promise<{
        folder: VimeoFolder;
        path: string[];
    }>;
    /**
     * Bulk organize existing videos into folders
     */
    organizeExistingVideos(organizationRules: {
        [pattern: string]: string;
    }): Promise<{
        moved: number;
        errors: number;
    }>;
    private initializeStrategies;
    private cacheFolder;
    private makeApiRequest;
    private getFolder;
    /**
     * Clear all caches
     */
    clearCache(): void;
    /**
     * Get strategy performance statistics
     */
    getStrategyStats(): {
        [strategyName: string]: {
            viable: boolean;
            lastTested: Date;
        };
    };
}
//# sourceMappingURL=VimeoFolderManager.d.ts.map