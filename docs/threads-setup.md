# Threads API Setup Guide

Step-by-step guide to obtain your Threads API credentials and configure Spool for local development.

## Prerequisites

- A personal [Threads](https://www.threads.net/) account
- A [Meta Developer](https://developers.facebook.com/) account (free to create)

---

## 1. Create a Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/apps/) and click **Create App**.
2. Select the **Other** use case, then click **Next**.
3. Select **Business** as the app type, then click **Next**.
4. Enter an app name (e.g. "Spool Dev") and your contact email.
5. Click **Create App**.

## 2. Add the Threads Use Case

1. In your app dashboard, find the **Add a product** section.
2. Locate **Threads** and click **Set up**.
3. This adds the Threads API product to your app.

## 3. Configure OAuth Settings

1. In the left sidebar, go to **Threads** > **Settings**.
2. Under **Threads App ID** and **Threads App Secret**, note these values — you will need them for your `.env.local`.
3. Under **Redirect Callback URLs**, add:
   ```
   http://localhost:3000/api/auth/callback
   ```
4. Click **Save**.

## 4. Add a Threads Tester

While your app is in **Development** mode, only invited testers can authorize. You must add your own Threads account as a tester.

1. In the left sidebar, go to **App Roles** > **Roles**.
2. Click **Add People** and select **Threads Tester**.
3. Enter your Threads username and send the invitation.
4. Open the Threads app on your phone:
   - Go to **Settings** > **Account** > **Website permissions** > **Invites**.
   - Accept the tester invitation.

> Without accepting the invitation, the OAuth flow will fail with an "unknown error."

## 5. Configure Environment Variables

Copy the example env file if you haven't already:

```bash
cp .env.local.example .env.local
```

Then fill in the Threads credentials in `.env.local`:

```env
THREADS_APP_ID=<your-threads-app-id>
THREADS_APP_SECRET=<your-threads-app-secret>
THREADS_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

- **THREADS_APP_ID** — Found under **Threads** > **Settings** in the Meta app dashboard.
- **THREADS_APP_SECRET** — Same location; click **Show** to reveal it.
- **THREADS_REDIRECT_URI** — Must match exactly what you entered in step 3.

## 6. Verify the OAuth Flow

1. Start the dev server:
   ```bash
   npm run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000).
3. Click **Connect to Threads**.
4. You should be redirected to a Threads authorization screen — log in and click **Allow**.
5. After authorizing, you should be redirected back to the app.

## Troubleshooting

| Symptom | Likely Cause |
| --- | --- |
| "An unknown error has occurred" on authorize | Missing or invalid `THREADS_APP_ID`, or tester invitation not accepted |
| Redirect URI mismatch error | `THREADS_REDIRECT_URI` in `.env.local` doesn't match the one configured in the Meta dashboard |
| "User is not a tester" error | You haven't added and accepted the Threads tester role (see step 4) |
| Token exchange fails | `THREADS_APP_SECRET` is incorrect or missing |
