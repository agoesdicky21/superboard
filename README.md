[Vencord Plugin](https://docs.vencord.dev/installing/custom-plugins/)

# SuperBoard

A unified profile board for Discord — combines **MusicBoard**, **AniBoard**, **MangaBoard**, **FilmBoard**, **SeriesBoard**, **BookBoard**, and **GameBoard** into a single tab. Music & films powered by iTunes, anime & manga powered by MyAnimeList (Jikan API), TV series powered by TVMaze, books powered by Open Library. No other plugins required.

## Features

- Adds a **SuperBoard** tab to user profiles with an interactive board selector.
- **🎵 MusicBoard/FavMusic** — Search and add music from iTunes with album art and **30-second audio previews**.
- **🎬 AniBoard/FavAnime** — Search and add anime from MyAnimeList. Supports favorites and hate lists. Import from MAL username.
- **📚 MangaBoard/FavManga** — Search and add manga from MyAnimeList. Score badges and chapter/volume info.
- **🎥 FilmBoard/FavFilm** — Search and add movies from iTunes with poster art.
- **📺 SeriesBoard/FavSeries** — Search and add TV series from TVMaze with ratings and network info.
- **📖 BookBoard/FavBook** — Search and add books from Open Library with cover art, author, year, and page count.
- **🎭 TrollBoards** — Fun stuffs! Show off your favorite Wikipedia page.
- **🎮 GameBoard** — Info about Discord's built-in game activity feature.
- **Fully self-contained** — no need to install any other plugin.
- **Cloud sync** — all your lists are synced to the server so other users can see them on your profile.
- **Backward compatible** — if you previously used FavAnime, your data transfers seamlessly.

## Usage

1. Enable the **SuperBoard** plugin in Vencord settings.
2. Open any user's profile and click the **SuperBoard** tab.
3. Choose **MusicBoard**, **AniBoard**, **MangaBoard**, **FilmBoard**, **SeriesBoard**, **BookBoard**, **TrollBoards**, or **GameBoard** from the selector.
4. Use the **Add** button to search and add items to your lists.
5. Your lists sync automatically. Use **Sync Now** in settings for manual sync.

## Board Types

### 🎵 MusicBoard
- Search songs, artists, and albums via iTunes.
- Album art grid with hover effects.
- Click ▶ to play a 30-second audio preview.
- Click on any card to open the Apple Music page.

### 🎬 AniBoard
- Search and add anime from MyAnimeList via Jikan API.
- **Favorites** — anime you love, with score badges.
- **Hate list** — anime you can't stand, with 💔 badges.
- **MAL Import** — enter your MAL username to import favorites automatically.
- Click on any card to open the MyAnimeList page.

### 🎮 GameBoard
- Informational — Discord natively supports game activity display.

### 📚 MangaBoard
- Search and add manga from MyAnimeList via Jikan API.
- Score badges and chapter/volume counts.
- Click on any card to open the MyAnimeList page.

### 🎥 FilmBoard
- Search and add movies via iTunes.
- Movie poster grid with hover effects.
- Click on any card to open the iTunes/Apple TV page.

### 📺 SeriesBoard
- Search and add TV series from TVMaze.
- Rating badges, network info, and status.
- Click on any card to open the TVMaze page.

### 📖 BookBoard
- Search and add books via Open Library.
- Cover art grid with author, publication year, and page count.
- Subject tags for genre info.
- Click on any card to open the Open Library page.

### 🎭 TrollBoard
- A fun, personal board with silly/random profile fields.
- **Favorite Wikipedia page** — link to the best article ever.

## Settings

In the plugin settings panel you can:
- **Add/remove music** from your favorites list.
- **Add/remove anime** from favorites and hate lists.
- **Add/remove manga** from your favorites list.
- **Add/remove movies** from your favorites list.
- **Add/remove TV series** from your favorites list.
- **Add/remove books** from your favorites list.
- **Edit troll data** — configure your TrollBoard fields.
- **Import from MAL** — bulk import your MAL favorites.
- **Sync Now** — manually sync all lists to the server.


## Notes

If you browse the source code, you'll see variables named `syncToken` (e.g. `musicSyncToken`, `animeSyncToken`). These have **nothing to do with your user token or any account token**.

Each sync token is a random 48-character hex string generated locally with `crypto.getRandomValues()` on first use and stored in user API server. It acts purely as an anonymous write key so that only your client can overwrite your own data on the sync server. Your Discord credentials are never read, stored, or transmitted by this plugin.

## API Disclaimer

This plugin uses the following external APIs:

- **[iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/)** — Music and movie search. No authentication required. Apple's [Terms of Service](https://www.apple.com/legal/internet-services/itunes/) apply.
- **[Jikan API](https://jikan.moe/)** — Unofficial MyAnimeList API for anime/manga search and MAL user favorites import. No authentication required.
- **[TVMaze API](https://www.tvmaze.com/api)** — TV series search. No authentication required.
- **[Open Library API](https://openlibrary.org/developers/api)** — Book search and cover images. No authentication required.
- **Custom sync server** — anachter.dev backend. Stores music, anime, manga, film, series, and book lists by Discord user ID.





