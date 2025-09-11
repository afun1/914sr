# Vimeo Folder Manager

Advanced Vimeo folder organization library with intelligent strategies and automatic fallbacks.

## Features

- 🎯 **Multiple Organization Strategies**: Nested folders, virtual paths, enhanced flat structure, showcases
- 🧠 **Intelligent Fallbacks**: Automatically tries different approaches when one fails
- 🔍 **Smart Detection**: Finds existing folders across different naming patterns
- ⚡ **Performance Optimized**: Built-in caching and strategy optimization
- 🔒 **TypeScript Support**: Full type safety and IntelliSense
- 🛡️ **Robust Error Handling**: Graceful degradation with detailed logging

## Installation

```bash
npm install vimeo-folder-manager
```

## Quick Start

```typescript
import { VimeoFolderManager } from 'vimeo-folder-manager'

const manager = new VimeoFolderManager({
  accessToken: 'your-vimeo-access-token',
  parentFolderId: '12345',
  parentFolderName: 'Sparky Screen Recordings',
  organizationPattern: 'enhanced-flat',
  namingConvention: {
    prefix: '📁 SSR',
    separator: ' • ',
    useEmoji: true
  },
  fallbackStrategies: ['virtual-path', 'nested', 'showcase']
})

// Create or find an organized folder
const result = await manager.createOrganizedFolder(
  'parent-folder-id',
  'John Supervisor'
)

console.log('Folder created:', result.folder.name)
console.log('Strategy used:', result.strategy)
console.log('Was existing:', result.wasExisting)
```

## Organization Strategies

### 1. Enhanced Flat Structure (Recommended)
Creates folders with visual prefixes for easy organization:
```
📁 SSR • John Supervisor
📁 SSR • John Manager
📁 SSR • John User
```

### 2. Virtual Path Naming
Simulates nested structure with path-like names:
```
Sparky Screen Recordings/John Supervisor
Sparky Screen Recordings/John Manager
```

### 3. True Nested Folders
Creates actual nested folders when supported by Vimeo API:
```
Sparky Screen Recordings/
├── John Supervisor/
├── John Manager/
└── John User/
```

### 4. Showcase Organization
Uses Vimeo showcases/albums for organization:
```
John Supervisor (Showcase)
John Manager (Showcase)
```

## Configuration Options

```typescript
interface FolderOrganizationConfig {
  accessToken: string
  parentFolderId?: string
  parentFolderName?: string
  organizationPattern: 'nested' | 'flat' | 'virtual-path' | 'showcase' | 'enhanced-flat'
  namingConvention: {
    prefix?: string           // Default: '📁 SSR'
    separator?: string        // Default: ' • '
    useEmoji?: boolean        // Default: true
    customPattern?: string    // Use {name} placeholder
  }
  fallbackStrategies?: string[]
  retryOptions?: {
    maxRetries: number
    retryDelay: number
  }
}
```

## Advanced Usage

### Custom Naming Pattern
```typescript
const manager = new VimeoFolderManager({
  accessToken: 'your-token',
  organizationPattern: 'enhanced-flat',
  namingConvention: {
    customPattern: '🎥 Recordings • {name} • 2025'
  }
})
```

### Force Specific Strategy
```typescript
const result = await manager.createOrganizedFolder(
  'parent-id',
  'folder-name',
  { forceStrategy: 'nested' }
)
```

### Search Folders
```typescript
const folders = await manager.searchFolders('John', {
  includeSubfolders: true
})
```

### Clear Cache
```typescript
manager.clearCache()
```

### Get Strategy Performance
```typescript
const stats = manager.getStrategyStats()
console.log('Strategy viability:', stats)
```

## Integration with Existing Projects

### Next.js/React Integration

```typescript
// lib/vimeo-manager.ts
import { VimeoFolderManager } from 'vimeo-folder-manager'

export const vimeoManager = new VimeoFolderManager({
  accessToken: process.env.VIMEO_ACCESS_TOKEN!,
  parentFolderName: 'Sparky Screen Recordings',
  organizationPattern: 'enhanced-flat',
  namingConvention: {
    prefix: '📁 SSR',
    separator: ' • '
  }
})

// api/upload.ts
export async function POST(request: Request) {
  const { userDisplayName, videoData } = await request.json()
  
  const folderResult = await vimeoManager.createOrganizedFolder(
    'parent-folder-id',
    userDisplayName
  )
  
  // Upload video to the organized folder
  // ... upload logic
}
```

## Error Handling

The library includes comprehensive error handling:

```typescript
try {
  const result = await manager.createOrganizedFolder('parent-id', 'folder-name')
} catch (error) {
  if (error.message.includes('All folder organization strategies failed')) {
    // Handle complete failure
    console.error('Could not create folder with any strategy')
  } else {
    // Handle other errors
    console.error('Folder creation error:', error)
  }
}
```

## Performance Considerations

- **Caching**: Folders and strategy viability are cached for 5 minutes by default
- **Strategy Optimization**: Failed strategies are temporarily marked as unusable
- **Batch Operations**: Use `organizeExistingVideos()` for bulk operations

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details
