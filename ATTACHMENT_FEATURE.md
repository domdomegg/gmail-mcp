# Attachment Support for Gmail MCP Draft Tools

## Summary
Added attachment support to `draft_create` and `draft_update` tools in the gmail-mcp package.

## Changes Made

### Modified Files
1. `src/tools/draft-create.ts`
2. `src/tools/draft-update.ts`

### Features Added
- **New Parameter**: `attachments` (optional array) with schema:
  ```typescript
  {
    filename: string,    // e.g., "document.pdf"
    mimeType: string,    // e.g., "application/pdf"
    content: string      // base64-encoded file data
  }
  ```

- **MIME Message Building**:
  - When attachments present: builds RFC 2822 compliant multipart/mixed MIME message
  - When no attachments: maintains existing plain text behavior (backward compatible)
  - Proper MIME boundaries using timestamp + random string
  - Content-Transfer-Encoding: base64 for attachments
  - Content-Disposition: attachment with filename

### Example Usage
```javascript
await draft_create({
  to: "user@example.com",
  subject: "Report",
  body: "Please find the report attached.",
  attachments: [
    {
      filename: "report.pdf",
      mimeType: "application/pdf",
      content: "<base64-encoded-pdf-data>"
    }
  ]
});
```

## Testing
- ✅ TypeScript compilation successful
- ✅ Built files deployed to `/home/rbnkv/mcp-servers/node_modules/gmail-mcp/dist/`
- ✅ Backward compatible (no attachments = plain text)

## Git Branch
- Branch: `feature/draft-attachments`
- Commit: `1713ed2` - "feat: add attachment support to draft_create and draft_update tools"

## Ready for
- Contribution to upstream repository
- Testing with actual Gmail API
