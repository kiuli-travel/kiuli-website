# API Reference

Documentation for Kiuli's custom API endpoints.

## Authentication

All endpoints support two authentication methods:

### 1. Bearer Token (Programmatic Access)
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://admin.kiuli.com/api/endpoint
```

Valid tokens:
- `PAYLOAD_API_KEY` - General API access
- `SCRAPER_API_KEY` - Scraper pipeline access

### 2. Payload Session (Admin UI)
Browser-based authentication via Payload CMS login. Session cookie is automatically sent.

---

## Endpoints

### POST /api/scrape-itinerary

Triggers the Lambda scraper pipeline to import an itinerary from iTrvl.

**Request:**
```json
{
  "itrvlUrl": "https://itrvl.com/client/portal/{accessKey}/{itineraryId}",
  "mode": "create"  // Optional: "create" (default) or "update"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "jobId": "abc123",
  "itineraryId": "itrvl-id-here",
  "mode": "create",
  "existingItineraryId": null,
  "message": "Processing started. Poll /api/job-status/abc123 for progress."
}
```

**Response (Conflict - 409):**
```json
{
  "success": false,
  "error": "A job is already running for this URL",
  "existingJobId": "existing-job-id",
  "existingJobStatus": "processing",
  "existingJobProgress": 45,
  "message": "Poll /api/job-status/existing-job-id for progress."
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": "Invalid iTrvl URL format"
}
```

**Example:**
```bash
curl -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/abc123/def456"}'
```

---

### GET /api/job-status/[jobId]

Retrieves the current status and progress of a scraper job.

**Response (Success - 200):**
```json
{
  "jobId": "abc123",
  "status": "processing",
  "progress": 65,
  "currentPhase": "Phase 2: Processing Images",

  "images": {
    "total": 48,
    "processed": 31,
    "skipped": 2,
    "failed": 0,
    "labeled": 15
  },

  "phases": {
    "phase1CompletedAt": "2026-01-29T10:30:00.000Z",
    "phase2CompletedAt": null,
    "phase3CompletedAt": null,
    "phase4CompletedAt": null
  },

  "timing": {
    "startedAt": "2026-01-29T10:25:00.000Z",
    "completedAt": null,
    "duration": null,
    "estimatedTimeRemaining": 180
  },

  "payloadId": null,
  "processedItinerary": null,
  "error": null,
  "errorPhase": null,
  "notes": null
}
```

**Response (Completed - 200):**
```json
{
  "jobId": "abc123",
  "status": "completed",
  "progress": 100,
  "currentPhase": "Complete",

  "images": {
    "total": 48,
    "processed": 45,
    "skipped": 3,
    "failed": 0,
    "labeled": 45
  },

  "timing": {
    "startedAt": "2026-01-29T10:25:00.000Z",
    "completedAt": "2026-01-29T10:45:00.000Z",
    "duration": 1200,
    "estimatedTimeRemaining": null
  },

  "payloadId": "123",
  "processedItinerary": {
    "id": "123",
    "title": "Safari Adventure"
  },

  "notes": "Ready for review. 3 images were skipped (duplicates)."
}
```

**Response (Failed - 200):**
```json
{
  "jobId": "abc123",
  "status": "failed",
  "progress": 25,
  "currentPhase": "Phase 1: Scraping",

  "error": "Failed to fetch iTrvl data: 403 Forbidden",
  "errorPhase": "scraping",

  "failedItems": [
    {
      "sourceS3Key": "media/original/123/image1.jpg",
      "error": "Download failed: 404"
    }
  ]
}
```

**Example:**
```bash
curl https://admin.kiuli.com/api/job-status/abc123 \
  -H "Authorization: Bearer $PAYLOAD_API_KEY"
```

---

### POST /api/job-control/[jobId]

Controls job execution (cancel, retry, retry-failed).

**Request - Cancel:**
```json
{
  "action": "cancel"
}
```

**Request - Retry (Full Re-run):**
```json
{
  "action": "retry"
}
```

**Request - Retry Failed Images Only:**
```json
{
  "action": "retry-failed"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Job cancelled",
  "jobId": "abc123"
}
```

**Response (Retry Success - 200):**
```json
{
  "success": true,
  "message": "Job re-run started",
  "jobId": "abc123"
}
```

**Response (Retry Failed Success - 200):**
```json
{
  "success": true,
  "message": "Retrying 3 failed images",
  "jobId": "abc123",
  "retryCount": 3
}
```

**Example:**
```bash
# Cancel a job
curl -X POST https://admin.kiuli.com/api/job-control/abc123 \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "cancel"}'
```

---

### POST /api/enhance

Enhances itinerary content using AI (Claude 3.5 Sonnet via Gemini).

**Request:**
```json
{
  "itineraryId": "123",
  "fieldPath": "overview.summary",
  "voiceConfig": {
    "name": "Kiuli Brand Voice",
    "tone": "luxurious, aspirational",
    "guidelines": "Focus on emotional experience..."
  }
}
```

**Valid Field Paths:**
- `title` - Itinerary title
- `metaTitle` - SEO title
- `metaDescription` - SEO description
- `whyKiuli` - Why Kiuli section
- `overview.summary` - Trip overview
- `investmentLevel.includes` - What's included
- `days.{n}.title` - Day titles
- `days.{n}.segments.{m}.description` - Segment descriptions
- `faqItems.{n}.answer` - FAQ answers

**Response (Success - 200):**
```json
{
  "success": true,
  "enhanced": "Your luxurious safari experience awaits...",
  "tokensUsed": 450,
  "fieldPath": "overview.summaryEnhanced"
}
```

**Response (RichText Field - 200):**
```json
{
  "success": true,
  "enhanced": {
    "root": {
      "type": "root",
      "children": [...]
    }
  },
  "tokensUsed": 620,
  "fieldPath": "whyKiuliEnhanced"
}
```

**Example:**
```bash
curl -X POST https://admin.kiuli.com/api/enhance \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "itineraryId": "123",
    "fieldPath": "overview.summary",
    "voiceConfig": {
      "name": "Kiuli",
      "tone": "luxurious, aspirational"
    }
  }'
```

---

### GET /api/notifications

Retrieves admin notifications.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `unread` | boolean | Only return unread notifications |
| `limit` | number | Max notifications to return (default: 50) |
| `jobId` | string | Filter by job ID |
| `type` | string | Filter by type: success, error, warning, info |

**Response (Success - 200):**
```json
{
  "success": true,
  "notifications": [
    {
      "id": "456",
      "type": "success",
      "message": "Job completed: Safari Adventure",
      "read": false,
      "job": "123",
      "createdAt": "2026-01-29T10:45:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "page": 1,
    "totalPages": 1
  },
  "unreadCount": 5
}
```

**Example:**
```bash
# Get all unread notifications
curl "https://admin.kiuli.com/api/notifications?unread=true" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY"
```

---

### POST /api/notifications

Creates or manages notifications.

**Request - Create Notification:**
```json
{
  "type": "success",
  "message": "Job completed successfully",
  "job": "123",
  "itinerary": "456"
}
```

**Request - Mark as Read:**
```json
{
  "action": "read",
  "notificationIds": ["id1", "id2"]
}
```

**Request - Mark All as Read:**
```json
{
  "action": "read",
  "markAll": true
}
```

**Request - Delete:**
```json
{
  "action": "delete",
  "notificationIds": ["id1", "id2"]
}
```

**Response (Create - 200):**
```json
{
  "success": true,
  "doc": { ... },
  "id": "789"
}
```

**Response (Action - 200):**
```json
{
  "success": true,
  "action": "read",
  "updated": 5,
  "deleted": 0,
  "unreadCount": 0
}
```

---

### GET /api/scraper-health

Health check endpoint for the scraper pipeline.

**Response (Healthy - 200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-29T10:00:00.000Z"
}
```

---

## Payload REST API

Payload CMS provides auto-generated REST API endpoints at `/api/{collection}`.

### Common Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/itineraries` | List itineraries |
| GET | `/api/itineraries/{id}` | Get single itinerary |
| POST | `/api/itineraries` | Create itinerary |
| PATCH | `/api/itineraries/{id}` | Update itinerary |
| DELETE | `/api/itineraries/{id}` | Delete itinerary |
| GET | `/api/media` | List media |
| GET | `/api/media/{id}` | Get single media |
| POST | `/api/media` | Upload media |

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `depth` | Populate relationships (0-3) |
| `limit` | Max results per page |
| `page` | Page number |
| `where` | Filter query |
| `sort` | Sort field |

**Example - Get Published Itineraries:**
```bash
curl "https://admin.kiuli.com/api/itineraries?where[_status][equals]=published&depth=2" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY"
```

See [Payload REST API Documentation](https://payloadcms.com/docs/rest-api/overview) for complete reference.

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid auth |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate job |
| 500 | Server Error - Internal error |

## Rate Limits

No explicit rate limits are enforced. However:
- AI enhancement has a 60-second timeout
- Scraper jobs are deduplicated (only one active job per URL)
- Lambda functions have 15-minute timeout

## Webhooks

Currently no webhook support. Poll `/api/job-status/{jobId}` for job progress.
