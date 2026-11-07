# Behind the Margins

Website for **Behind the Margins**, a student-led business podcast from Kuala Lumpur.

## How it works
- `index.html`: the whole site (Home, Episodes, Tools, Sponsors, Contact).
- `covers/`: episode covers, team photos and the banner image.
- `netlify/functions/feed.mjs`: `/api/feed` reads the podcast RSS feed, so new episodes, descriptions, lengths, Spotify links and the audio player appear automatically.
- `netlify/functions/reviews.mjs`: `/api/reviews` stores star ratings and comments (Netlify Blobs).
- `admin.html`: remove unsuitable comments. Needs the `ADMIN_KEY` environment variable set in Netlify.
- Contact form: Netlify Forms (form name `contact`). Set an email notification in Netlify → Forms.

## Updating
Edit the `EPISODES` list near the top of the script in `index.html` to add covers, guest names, Apple Podcasts / YouTube links. Push to `main` and Netlify redeploys in about a minute.
