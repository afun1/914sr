import { FolderStrategy, VimeoFolder, FolderOrganizationConfig } from '../types';
export declare class NestedFolderStrategy implements FolderStrategy {
    name: string;
    priority: number;
    canCreate(config: FolderOrganizationConfig): Promise<boolean>;
    findExisting(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder | null>;
    create(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder>;
}
//# sourceMappingURL=NestedFolderStrategy.d.ts.map