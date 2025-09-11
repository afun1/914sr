import { FolderStrategy, VimeoFolder, FolderOrganizationConfig } from '../types';
export declare class EnhancedFlatStrategy implements FolderStrategy {
    name: string;
    priority: number;
    canCreate(config: FolderOrganizationConfig): Promise<boolean>;
    findExisting(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder | null>;
    create(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder>;
    private generateEnhancedName;
}
//# sourceMappingURL=EnhancedFlatStrategy.d.ts.map