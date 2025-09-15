# Dynamic Route Conflict Resolution

## The Error:
`[Error: You cannot use different slug names for the same dynamic path ('id' !== 'folderId').]`

## Likely Cause:
Conflicting dynamic routes in the API folder with different parameter names:
- `/api/vimeo/folders/[id]/route.ts`  
- `/api/vimeo/folders/[folderId]/route.ts`
- `/api/vimeo/videos/[id]/route.ts`
- `/api/vimeo/videos/[videoId]/route.ts`

## Solution:
Remove the broken dynamic route files since we're using query parameters instead.

## Files to Remove:
- `c:\sr97\src\app\api\vimeo\folders\[id]\route.ts` (if exists)
- `c:\sr97\src\app\api\vimeo\folders\[folderId]\route.ts` (if exists)  
- `c:\sr97\src\app\api\vimeo\folders\delete\[id]\route.ts` (if exists)
- `c:\sr97\src\app\api\vimeo\videos\[id]\route.ts` (if exists)
- `c:\sr97\src\app\api\vimeo\videos\[videoId]\route.ts` (if exists)
- `c:\sr97\src\app\api\vimeo\videos\delete\[id]\route.ts` (if exists)

## Keep:
- `c:\sr97\src\app\api\vimeo\folders\route.ts` (with DELETE method)
- `c:\sr97\src\app\api\vimeo\videos\route.ts` (with DELETE method)
- `c:\sr97\src\app\api\vimeo\folders\create\route.ts`