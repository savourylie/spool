# Threads API Reference

> Source: https://developers.facebook.com/docs/threads/
>
> Base URL: `https://graph.threads.net/v1.0`

## Table of Contents

- [Authentication & Setup](#authentication--setup)
- [Posts (Publishing)](#posts-publishing)
- [Retrieving Posts](#retrieving-posts)
- [Reply Management](#reply-management)
- [Keyword Search](#keyword-search)
- [Insights](#insights)
- [Webhooks](#webhooks)
- [Rate Limits](#rate-limits)
- [Troubleshooting](#troubleshooting)

---

## Authentication & Setup

The Threads API uses **OAuth 2.0** for authentication. All requests require a Threads user access token.

### Permissions / Scopes

| Scope                       | Purpose                                    |
| --------------------------- | ------------------------------------------ |
| `threads_basic`             | Required for **all** Threads API endpoints |
| `threads_content_publish`   | Publishing posts                           |
| `threads_manage_replies`    | POST operations on replies                 |
| `threads_read_replies`      | GET operations on replies                  |
| `threads_manage_insights`   | Insights endpoints                         |
| `threads_keyword_search`    | Searching public posts                     |
| `threads_manage_mentions`   | Mention webhook notifications              |
| `threads_delete`            | Delete webhook notifications               |

### Token Types

| Type          | Lifetime | Notes                                                                 |
| ------------- | -------- | --------------------------------------------------------------------- |
| Short-lived   | 1 hour   | Obtained after user authorization; exchange for long-lived token      |
| Long-lived    | 60 days  | Refreshable via `GET /refresh_access_token` (extends by 90 days)     |

- Public profile permissions remain valid for 90 days and auto-extend on token refresh.
- Private profile permissions **cannot** be extended; users must re-authorize.

### Setup Checklist

1. Create a Meta app with the **Threads** use case in the Meta Developer Dashboard.
2. Invite Threads Testers via app settings.
3. Implement the OAuth flow to obtain authorization codes.
4. Host any media on a **publicly accessible** server.

---

## Posts (Publishing)

Publishing uses a **two-step container model**:

1. **Create a media container** — `POST /{threads-user-id}/threads`
2. **Publish the container** — `POST /{threads-user-id}/threads_publish`

### Supported Media Types

| Type       | Description                         |
| ---------- | ----------------------------------- |
| `TEXT`     | Text-only post (max 500 characters) |
| `IMAGE`   | Single image (JPEG, PNG)            |
| `VIDEO`   | Single video (MP4, MOV)             |
| `CAROUSEL`| 2–20 images/videos combined         |

### Container Creation Parameters

| Parameter          | Type    | Notes                                           |
| ------------------ | ------- | ----------------------------------------------- |
| `media_type`       | String  | Required. `TEXT`, `IMAGE`, `VIDEO`, `CAROUSEL`  |
| `text`             | String  | Required for TEXT; optional for other types      |
| `image_url`        | String  | Public URL to image                              |
| `video_url`        | String  | Public URL to video                              |
| `is_carousel_item` | Boolean | `true` when creating items for a carousel        |
| `children`         | Array   | Container IDs for carousel items                 |
| `link_attachment`   | String  | URL for link preview (TEXT only)                 |
| `gif_attachment`    | Object  | `{ gif_id, provider }` for GIF embeds           |
| `reply_control`     | String  | Who can reply (see Reply Management)             |
| `topic_tag`         | String  | Hashtag for post categorization                  |

### Publish Parameters

| Parameter      | Type   | Notes                               |
| -------------- | ------ | ----------------------------------- |
| `creation_id`  | String | Required. Container ID from step 1  |

### Media Specifications

**Images:**
- Max file size: 8 MB
- Width: 320–1440 px
- Aspect ratio: up to 10:1
- Formats: JPEG, PNG (sRGB)

**Videos:**
- Max file size: 1 GB
- Max duration: 5 minutes
- Codecs: H.264 / HEVC video, AAC audio (48 kHz, mono/stereo)
- Frame rate: 23–60 FPS
- Aspect ratio: 0.01:1 to 10:1 (9:16 recommended)

### Carousel Flow

1. Create individual media containers with `is_carousel_item=true`.
2. Create a carousel container with `media_type=CAROUSEL` and `children=[id1, id2, ...]`.
3. Publish the carousel container.

### Responses

```json
{ "id": "<THREADS_MEDIA_ID>" }
```

---

## Retrieving Posts

- **Single post:** `GET /{threads-media-id}` — returns post fields (text, media URL, timestamp, etc.)
- **User's posts:** `GET /{threads-user-id}/threads` — paginated list of the user's posts

---

## Reply Management

### Hide / Unhide Replies

```
POST /{THREADS_REPLY_ID}/manage_reply
```

| Parameter | Type    | Notes                                    |
| --------- | ------- | ---------------------------------------- |
| `hide`    | Boolean | `true` to hide, `false` to unhide        |

- Hiding a top-level reply **automatically hides all nested replies**.
- Nested replies cannot be individually hidden.

### Reply Control (set at post creation)

Set via the `reply_control` parameter on `POST /{threads-user-id}/threads`:

| Value                       | Who can reply            |
| --------------------------- | ------------------------ |
| `everyone`                  | All users                |
| `accounts_you_follow`       | Followed accounts only   |
| `mentioned_only`            | Mentioned users only     |
| `parent_post_author_only`   | Original author only     |
| `followers_only`            | Followers only           |

### Reply Approvals (Moderation)

1. Create a post with `enable_reply_approvals=true`.
2. Retrieve pending replies: `GET /{threads-media-id}/pending_replies`
   - Filter with `approval_status`: `pending` or `ignored`
3. Approve/reject: `POST /{THREADS_REPLY_ID}/manage_pending_reply`
   - `approve`: Boolean

**Restrictions:**
- Reply approvals cannot be enabled for ephemeral posts.
- Nested reply moderation requires approving the parent reply first.

---

## Keyword Search

```
GET /keyword_search
```

### Parameters

| Parameter          | Type      | Notes                                            |
| ------------------ | --------- | ------------------------------------------------ |
| `q`                | String    | Required. Keyword or hashtag                     |
| `search_type`      | String    | `TOP` (default) or `RECENT`                      |
| `search_mode`      | String    | `KEYWORD` (default) or `TAG`                     |
| `media_type`       | String    | Filter: `TEXT`, `IMAGE`, or `VIDEO`              |
| `since` / `until`  | Timestamp | Unix timestamps for date range                   |
| `limit`            | Integer   | Results per page (max 100, default 25)           |
| `author_username`  | String    | Filter by specific creator                       |

### Restrictions

- **2,200 queries per 24-hour period** across all apps for a user.
- Queries returning no results do not count against the limit.
- Timestamps must be >= `1688540400` (Threads launch date).
- Requires `threads_keyword_search` permission; without it, only the authenticated user's own posts are searched.

---

## Insights

### Media-Level Insights

```
GET /{threads-media-id}/insights
```

| Metric    | Description                                  |
| --------- | -------------------------------------------- |
| `views`   | Number of times the post was displayed       |
| `likes`   | Number of likes                              |
| `replies` | Number of replies (includes nested for root) |
| `reposts` | Number of reposts                            |
| `quotes`  | Number of quote posts                        |
| `shares`  | Number of shares to other platforms          |

### User-Level Insights

```
GET /{threads-user-id}/threads_insights
```

**Time-series metrics:** `views` (daily profile views)

**Aggregate metrics:**

| Metric                   | Description                                 |
| ------------------------ | ------------------------------------------- |
| `likes`                  | Total likes across posts                    |
| `replies`                | Total replies across posts                  |
| `reposts`                | Total reposts across posts                  |
| `quotes`                 | Total quote posts                           |
| `clicks`                 | URL clicks by followers                     |
| `followers_count`        | Total follower count                        |
| `follower_demographics`  | Audience breakdown by geography and gender  |

### Parameters

| Parameter | Type      | Notes                                    |
| --------- | --------- | ---------------------------------------- |
| `metric`  | String    | Comma-separated list of metrics          |
| `since`   | Timestamp | Start of analysis window (Unix)          |
| `until`   | Timestamp | End of analysis window (Unix)            |

### Restrictions

- Data availability begins **April 13, 2024**.
- Repost facades return empty arrays.
- `follower_demographics` requires a minimum of **100 followers** and supports single-dimension filtering only.
- Post metrics exclude nested conversation threads.

---

## Webhooks

Real-time notifications for Threads events.

### Supported Topics

| Topic      | Description                                           | Required Permission         |
| ---------- | ----------------------------------------------------- | --------------------------- |
| `replies`  | Replies to the authenticated user's posts             | `threads_read_replies`      |
| `delete`   | When a verified user deletes a post                   | `threads_delete`            |
| `mentions` | Public posts mentioning the authenticated user        | `threads_manage_mentions`   |
| `publish`  | New posts published by the authenticated user         | `threads_basic`             |

### Payload Structure

```json
{
  "app_id": "<APP_ID>",
  "topic": "<TOPIC>",
  "target_id": "<CONTENT_OR_USER_ID>",
  "time": 1234567890,
  "subscription_id": "<SUBSCRIPTION_ID>",
  "values": {
    "field": "<FIELD_NAME>",
    "value": { ... }
  }
}
```

### Setup

1. Add the "Get real-time notifications via Threads Webhooks" sub-use case to your app.
2. Configure a callback URL and verification token in the app dashboard.
3. Subscribe to desired topics.
4. Ensure Advanced Access permissions and business verification (for technical vendors).

### Restrictions

- Private account content does **not** generate webhook notifications.
- Apps must complete application review to access all fields.

---

## Rate Limits

| Operation          | Limit                     | Window    |
| ------------------ | ------------------------- | --------- |
| Publishing posts   | 250 requests              | 24 hours  |
| Replies            | 1,000 requests            | 24 hours  |
| Deletions          | 100 requests              | 24 hours  |
| Location searches  | 500 requests              | 24 hours  |
| Keyword searches   | 2,200 queries             | 24 hours  |

Check remaining quota:

```
GET /{threads-user-id}/threads_publishing_limit
```

---

## Troubleshooting

### Container Status

Poll `GET /{threads-container-id}` to check publishing status:

| Status          | Meaning                                    |
| --------------- | ------------------------------------------ |
| `FINISHED`      | Ready to publish                           |
| `IN_PROGRESS`   | Still processing                           |
| `PUBLISHED`     | Successfully published                     |
| `ERROR`         | Processing failed                          |
| `EXPIRED`       | Exceeded 24-hour publication window        |

**Recommendation:** Poll once per minute for up to 5 minutes.

### Common Error Codes

| Error                              | Description                          |
| ---------------------------------- | ------------------------------------ |
| `FAILED_DOWNLOADING_VIDEO`         | Could not download the video file    |
| `FAILED_PROCESSING_AUDIO`          | Audio processing failure             |
| `FAILED_PROCESSING_VIDEO`          | Video processing failure             |
| `INVALID_ASPEC_RATIO`              | Aspect ratio out of allowed range    |
| `INVALID_BIT_RATE`                 | Bit rate not supported               |
| `INVALID_DURATION`                 | Duration exceeds 5-minute limit      |
| `INVALID_FRAME_RATE`               | Frame rate outside 23–60 FPS range   |
| `INVALID_AUDIO_CHANNELS`           | Unsupported audio channel count      |
| `INVALID_AUDIO_CHANNEL_LAYOUT`     | Unsupported audio channel layout     |
| `UNKNOWN`                          | Unspecified error                    |
