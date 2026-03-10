/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import "./style.css";

import { get as DataStoreGet, set as DataStoreSet } from "@api/DataStore";
import { Settings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import ErrorBoundary from "@components/ErrorBoundary";
import { Logger } from "@utils/Logger";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { User } from "@vencord/discord-types";
import { findCssClassesLazy } from "@webpack";
import { Button, Forms, React, ScrollerThin, Text, TextInput, Toasts, useCallback, useEffect, useRef, UserStore, useState } from "@webpack/common";

const Native = VencordNative.pluginHelpers.SuperBoard as PluginNative<typeof import("./native")>;

const ProfileListClasses = findCssClassesLazy("empty", "textContainer", "connectionIcon");
const TabBarClasses = findCssClassesLazy("tabPanelScroller", "tabBarPanel");

// ==================== Constants ====================

const STORE_KEY_MUSIC = "FavMusic_favorites";
const STORE_KEY_MUSIC_TOKEN = "FavMusic_syncToken";
const STORE_KEY_FAV = "FavAnime_favorites";
const STORE_KEY_HATE = "FavAnime_hated";
const STORE_KEY_ANIME_TOKEN = "FavAnime_syncToken";
const STORE_KEY_MANGA = "FavManga_favorites";
const STORE_KEY_MANGA_TOKEN = "FavManga_syncToken";

const STORE_KEY_SERIES = "FavSeries_favorites";
const STORE_KEY_SERIES_TOKEN = "FavSeries_syncToken";
const STORE_KEY_BOOK = "FavBook_favorites";
const STORE_KEY_BOOK_TOKEN = "FavBook_syncToken";
const STORE_KEY_TROLL = "SuperBoard_troll";
const STORE_KEY_TROLL_TOKEN = "SuperBoard_trollSyncToken";
const logger = new Logger("SuperBoard");

type ListMode = "fav" | "hate";

// ==================== Types ====================

interface MusicData {
    id: number;
    title: string;
    artist_name: string;
    album_title: string;
    cover_small: string;
    cover_medium: string;
    cover_big: string;
    preview_url: string;
    duration: number;
    link: string;
}

interface AnimeData {
    mal_id: number;
    title: string;
    title_english: string | null;
    images: {
        jpg: {
            image_url: string;
            small_image_url: string;
            large_image_url: string;
        };
    };
    score: number | null;
    episodes: number | null;
    type: string;
    status: string;
    synopsis: string | null;
    year: number | null;
    genres: Array<{ mal_id: number; name: string; }>;
}

interface MangaData {
    mal_id: number;
    title: string;
    title_english: string | null;
    images: {
        jpg: {
            image_url: string;
            small_image_url: string;
            large_image_url: string;
        };
    };
    score: number | null;
    chapters: number | null;
    volumes: number | null;
    type: string;
    status: string;
    synopsis: string | null;
    year: number | null;
    genres: Array<{ mal_id: number; name: string; }>;
}

interface SeriesData {
    id: number;
    title: string;
    image_medium: string;
    image_original: string;
    rating: number | null;
    year: number | null;
    status: string;
    genres: string;
    network: string;
    link: string;
}

interface BookData {
    id: string;
    title: string;
    author: string;
    cover_small: string;
    cover_medium: string;
    cover_big: string;
    year: number | null;
    pages: number | null;
    subject: string;
    link: string;
}

interface WikipediaArticle {
    pageid: number;
    title: string;
    description: string;
    thumbnail: string;
    url: string;
}

type TrollData = WikipediaArticle[];

// ==================== Music Data Layer ====================

let cachedMusic: MusicData[] = [];

function slimMusic(m: MusicData): MusicData {
    return {
        id: m.id,
        title: m.title,
        artist_name: m.artist_name,
        album_title: m.album_title,
        cover_small: m.cover_small,
        cover_medium: m.cover_medium,
        cover_big: m.cover_big,
        preview_url: m.preview_url,
        duration: m.duration,
        link: m.link,
    };
}

async function loadMusic(): Promise<MusicData[]> {
    try {
        const data = await DataStoreGet(STORE_KEY_MUSIC) as MusicData[] | undefined;
        cachedMusic = data ?? [];
    } catch (e) {
        logger.error("Failed to load music:", e);
        cachedMusic = [];
    }
    return cachedMusic;
}

async function addMusic(music: MusicData) {
    if (cachedMusic.some(m => m.id === music.id)) return;
    cachedMusic = [...cachedMusic, music];
    await DataStoreSet(STORE_KEY_MUSIC, cachedMusic);
    scheduleMusicSync();
}

async function removeMusic(id: number) {
    cachedMusic = cachedMusic.filter(m => m.id !== id);
    await DataStoreSet(STORE_KEY_MUSIC, cachedMusic);
    scheduleMusicSync();
}

async function reorderMusic(newList: MusicData[]) {
    cachedMusic = newList;
    await DataStoreSet(STORE_KEY_MUSIC, cachedMusic);
    scheduleMusicSync();
}

// ==================== Anime Data Layer ====================

let cachedFavorites: AnimeData[] = [];
let cachedHated: AnimeData[] = [];

function slimAnime(a: AnimeData): AnimeData {
    return {
        mal_id: a.mal_id,
        title: a.title,
        title_english: a.title_english,
        images: { jpg: { image_url: a.images.jpg.image_url, small_image_url: a.images.jpg.small_image_url, large_image_url: a.images.jpg.large_image_url } },
        score: a.score,
        episodes: a.episodes,
        type: a.type,
        status: a.status,
        synopsis: null,
        year: a.year,
        genres: [],
    };
}

async function loadFavorites(): Promise<AnimeData[]> {
    try {
        const data = await DataStoreGet(STORE_KEY_FAV) as AnimeData[] | undefined;
        cachedFavorites = data ?? [];
    } catch (e) {
        logger.error("Failed to load favorites:", e);
        cachedFavorites = [];
    }
    return cachedFavorites;
}

async function loadHated(): Promise<AnimeData[]> {
    try {
        const data = await DataStoreGet(STORE_KEY_HATE) as AnimeData[] | undefined;
        cachedHated = data ?? [];
    } catch (e) {
        logger.error("Failed to load hated:", e);
        cachedHated = [];
    }
    return cachedHated;
}

async function addFavorite(anime: AnimeData) {
    if (cachedFavorites.some(f => f.mal_id === anime.mal_id)) return;
    cachedFavorites = [...cachedFavorites, anime];
    await DataStoreSet(STORE_KEY_FAV, cachedFavorites);
    scheduleAnimeSync();
}

async function removeFavorite(malId: number) {
    cachedFavorites = cachedFavorites.filter(f => f.mal_id !== malId);
    await DataStoreSet(STORE_KEY_FAV, cachedFavorites);
    scheduleAnimeSync();
}

async function addHated(anime: AnimeData) {
    if (cachedHated.some(f => f.mal_id === anime.mal_id)) return;
    cachedHated = [...cachedHated, anime];
    await DataStoreSet(STORE_KEY_HATE, cachedHated);
    scheduleAnimeSync();
}

async function removeHated(malId: number) {
    cachedHated = cachedHated.filter(f => f.mal_id !== malId);
    await DataStoreSet(STORE_KEY_HATE, cachedHated);
    scheduleAnimeSync();
}

async function reorderFavorites(newList: AnimeData[]) {
    cachedFavorites = newList;
    await DataStoreSet(STORE_KEY_FAV, cachedFavorites);
    scheduleAnimeSync();
}

async function reorderHated(newList: AnimeData[]) {
    cachedHated = newList;
    await DataStoreSet(STORE_KEY_HATE, cachedHated);
    scheduleAnimeSync();
}

// ==================== Manga Data Layer ====================

let cachedManga: MangaData[] = [];

function slimManga(m: MangaData): MangaData {
    return {
        mal_id: m.mal_id,
        title: m.title,
        title_english: m.title_english,
        images: { jpg: { image_url: m.images.jpg.image_url, small_image_url: m.images.jpg.small_image_url, large_image_url: m.images.jpg.large_image_url } },
        score: m.score,
        chapters: m.chapters,
        volumes: m.volumes,
        type: m.type,
        status: m.status,
        synopsis: null,
        year: m.year,
        genres: [],
    };
}

async function loadManga(): Promise<MangaData[]> {
    try {
        const data = await DataStoreGet(STORE_KEY_MANGA) as MangaData[] | undefined;
        cachedManga = data ?? [];
    } catch (e) {
        logger.error("Failed to load manga:", e);
        cachedManga = [];
    }
    return cachedManga;
}

async function addManga(manga: MangaData) {
    if (cachedManga.some(m => m.mal_id === manga.mal_id)) return;
    cachedManga = [...cachedManga, manga];
    await DataStoreSet(STORE_KEY_MANGA, cachedManga);
    scheduleMangaSync();
}

async function removeManga(malId: number) {
    cachedManga = cachedManga.filter(m => m.mal_id !== malId);
    await DataStoreSet(STORE_KEY_MANGA, cachedManga);
    scheduleMangaSync();
}

async function reorderManga(newList: MangaData[]) {
    cachedManga = newList;
    await DataStoreSet(STORE_KEY_MANGA, cachedManga);
    scheduleMangaSync();
}

// ==================== Series Data Layer ====================

let cachedSeries: SeriesData[] = [];

function slimSeries(s: SeriesData): SeriesData {
    return {
        id: s.id,
        title: s.title,
        image_medium: s.image_medium,
        image_original: s.image_original,
        rating: s.rating,
        year: s.year,
        status: s.status,
        genres: s.genres,
        network: s.network,
        link: s.link,
    };
}

async function loadSeries(): Promise<SeriesData[]> {
    try {
        const data = await DataStoreGet(STORE_KEY_SERIES) as SeriesData[] | undefined;
        cachedSeries = data ?? [];
    } catch (e) {
        logger.error("Failed to load series:", e);
        cachedSeries = [];
    }
    return cachedSeries;
}

async function addSeries(series: SeriesData) {
    if (cachedSeries.some(s => s.id === series.id)) return;
    cachedSeries = [...cachedSeries, series];
    await DataStoreSet(STORE_KEY_SERIES, cachedSeries);
    scheduleSeriesSync();
}

async function removeSeries(id: number) {
    cachedSeries = cachedSeries.filter(s => s.id !== id);
    await DataStoreSet(STORE_KEY_SERIES, cachedSeries);
    scheduleSeriesSync();
}

async function reorderSeries(newList: SeriesData[]) {
    cachedSeries = newList;
    await DataStoreSet(STORE_KEY_SERIES, cachedSeries);
    scheduleSeriesSync();
}

// ==================== Book Data Layer ====================

let cachedBooks: BookData[] = [];

function slimBook(b: BookData): BookData {
    return {
        id: b.id,
        title: b.title,
        author: b.author,
        cover_small: b.cover_small,
        cover_medium: b.cover_medium,
        cover_big: b.cover_big,
        year: b.year,
        pages: b.pages,
        subject: b.subject,
        link: b.link,
    };
}

async function loadBooks(): Promise<BookData[]> {
    try {
        const data = await DataStoreGet(STORE_KEY_BOOK) as BookData[] | undefined;
        cachedBooks = data ?? [];
    } catch (e) {
        logger.error("Failed to load books:", e);
        cachedBooks = [];
    }
    return cachedBooks;
}

async function addBook(book: BookData) {
    if (cachedBooks.some(b => b.id === book.id)) return;
    cachedBooks = [...cachedBooks, book];
    await DataStoreSet(STORE_KEY_BOOK, cachedBooks);
    scheduleBookSync();
}

async function removeBook(id: string) {
    cachedBooks = cachedBooks.filter(b => b.id !== id);
    await DataStoreSet(STORE_KEY_BOOK, cachedBooks);
    scheduleBookSync();
}

async function reorderBooks(newList: BookData[]) {
    cachedBooks = newList;
    await DataStoreSet(STORE_KEY_BOOK, cachedBooks);
    scheduleBookSync();
}

// ==================== Troll Data Layer ====================

let cachedTroll: TrollData = [];

function slimWiki(w: WikipediaArticle): WikipediaArticle {
    return {
        pageid: w.pageid,
        title: w.title,
        description: w.description,
        thumbnail: w.thumbnail,
        url: w.url,
    };
}

async function loadTroll(): Promise<TrollData> {
    try {
        const data = await DataStoreGet(STORE_KEY_TROLL) as TrollData | undefined;
        cachedTroll = data ?? [];
    } catch (e) {
        logger.error("Failed to load troll data:", e);
        cachedTroll = [];
    }
    return cachedTroll;
}

async function addTrollArticle(article: WikipediaArticle) {
    if (cachedTroll.some(a => a.pageid === article.pageid)) return;
    cachedTroll = [...cachedTroll, article];
    await DataStoreSet(STORE_KEY_TROLL, cachedTroll);
    scheduleTrollSync();
}

async function removeTrollArticle(pageid: number) {
    cachedTroll = cachedTroll.filter(a => a.pageid !== pageid);
    await DataStoreSet(STORE_KEY_TROLL, cachedTroll);
    scheduleTrollSync();
}

async function reorderTroll(newList: TrollData) {
    cachedTroll = newList;
    await DataStoreSet(STORE_KEY_TROLL, cachedTroll);
    scheduleTrollSync();
}

// ==================== Remote Caches ====================

const REMOTE_CACHE_MAX = 200;
const REMOTE_CACHE_TTL = 120_000; // 2 minutes

const remoteMusicCache = new Map<string, { music: MusicData[]; fetchedAt: number; }>();
function remoteMusicCacheSet(userId: string, value: { music: MusicData[]; fetchedAt: number; }) {
    if (remoteMusicCache.size >= REMOTE_CACHE_MAX) remoteMusicCache.delete(remoteMusicCache.keys().next().value!);
    remoteMusicCache.set(userId, value);
}

const remoteAnimeCache = new Map<string, { favs: AnimeData[]; hated: AnimeData[]; fetchedAt: number; }>();
function remoteAnimeCacheSet(userId: string, value: { favs: AnimeData[]; hated: AnimeData[]; fetchedAt: number; }) {
    if (remoteAnimeCache.size >= REMOTE_CACHE_MAX) remoteAnimeCache.delete(remoteAnimeCache.keys().next().value!);
    remoteAnimeCache.set(userId, value);
}

const remoteMangaCache = new Map<string, { manga: MangaData[]; fetchedAt: number; }>();
function remoteMangaCacheSet(userId: string, value: { manga: MangaData[]; fetchedAt: number; }) {
    if (remoteMangaCache.size >= REMOTE_CACHE_MAX) remoteMangaCache.delete(remoteMangaCache.keys().next().value!);
    remoteMangaCache.set(userId, value);
}

const remoteSeriesCache = new Map<string, { series: SeriesData[]; fetchedAt: number; }>();
function remoteSeriesCacheSet(userId: string, value: { series: SeriesData[]; fetchedAt: number; }) {
    if (remoteSeriesCache.size >= REMOTE_CACHE_MAX) remoteSeriesCache.delete(remoteSeriesCache.keys().next().value!);
    remoteSeriesCache.set(userId, value);
}

const remoteBookCache = new Map<string, { books: BookData[]; fetchedAt: number; }>();
function remoteBookCacheSet(userId: string, value: { books: BookData[]; fetchedAt: number; }) {
    if (remoteBookCache.size >= REMOTE_CACHE_MAX) remoteBookCache.delete(remoteBookCache.keys().next().value!);
    remoteBookCache.set(userId, value);
}

const remoteTrollCache = new Map<string, { troll: TrollData; fetchedAt: number; }>();
function remoteTrollCacheSet(userId: string, value: { troll: TrollData; fetchedAt: number; }) {
    if (remoteTrollCache.size >= REMOTE_CACHE_MAX) remoteTrollCache.delete(remoteTrollCache.keys().next().value!);
    remoteTrollCache.set(userId, value);
}

// ==================== Music Server Sync ====================

let musicSyncToken: string | null = null;
let musicSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleMusicSync() {
    if (musicSyncTimer) clearTimeout(musicSyncTimer);
    musicSyncTimer = setTimeout(() => { musicSyncTimer = null; syncMusicToServer().catch(() => { }); }, 2000);
}

async function loadMusicSyncToken(): Promise<string> {
    if (musicSyncToken) return musicSyncToken;
    let token = await DataStoreGet(STORE_KEY_MUSIC_TOKEN) as string | undefined;
    if (!token) {
        const arr = new Uint8Array(24);
        crypto.getRandomValues(arr);
        token = Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
        await DataStoreSet(STORE_KEY_MUSIC_TOKEN, token);
    }
    musicSyncToken = token;
    return token;
}

async function syncMusicToServer(): Promise<boolean> {
    try {
        const token = await loadMusicSyncToken();
        const userId = UserStore.getCurrentUser()?.id;
        if (!userId) return false;
        const result = await Native.syncMusicList(userId, token, cachedMusic.map(slimMusic));
        if (!result.success) { logger.error("Music sync failed:", result.error); return false; }
        return true;
    } catch (e) { logger.error("Music sync exception:", e); return false; }
}

async function fetchRemoteMusicList(userId: string): Promise<{ music: MusicData[]; } | null> {
    const cached = remoteMusicCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < REMOTE_CACHE_TTL) return cached;
    try {
        const data = await Native.fetchMusicList(userId);
        const music: MusicData[] = data.favorites ?? [];
        if (music.length === 0) return null;
        const result = { music, fetchedAt: Date.now() };
        remoteMusicCacheSet(userId, result);
        return result;
    } catch (e) { logger.error(`Failed to fetch remote music for ${userId}:`, e); return null; }
}

// ==================== Anime Server Sync ====================

let animeSyncToken: string | null = null;
let animeSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAnimeSync() {
    if (animeSyncTimer) clearTimeout(animeSyncTimer);
    animeSyncTimer = setTimeout(() => { animeSyncTimer = null; syncAnimeToServer().catch(() => { }); }, 2000);
}

async function loadAnimeSyncToken(): Promise<string> {
    if (animeSyncToken) return animeSyncToken;
    let token = await DataStoreGet(STORE_KEY_ANIME_TOKEN) as string | undefined;
    if (!token) {
        const arr = new Uint8Array(24);
        crypto.getRandomValues(arr);
        token = Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
        await DataStoreSet(STORE_KEY_ANIME_TOKEN, token);
    }
    animeSyncToken = token;
    return token;
}

async function syncAnimeToServer(): Promise<boolean> {
    try {
        const token = await loadAnimeSyncToken();
        const userId = UserStore.getCurrentUser()?.id;
        if (!userId) return false;
        const result = await Native.syncAnimeList(userId, token, cachedFavorites.map(slimAnime), cachedHated.map(slimAnime));
        if (!result.success) { logger.error("Anime sync failed:", result.error); return false; }
        return true;
    } catch (e) { logger.error("Anime sync exception:", e); return false; }
}

async function fetchRemoteAnimeList(userId: string): Promise<{ favs: AnimeData[]; hated: AnimeData[]; } | null> {
    const cached = remoteAnimeCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < REMOTE_CACHE_TTL) return cached;
    try {
        const data = await Native.fetchAnimeList(userId);
        const favs: AnimeData[] = data.favorites ?? [];
        const hated: AnimeData[] = data.hated ?? [];
        if (favs.length === 0 && hated.length === 0) return null;
        const result = { favs, hated, fetchedAt: Date.now() };
        remoteAnimeCacheSet(userId, result);
        return result;
    } catch (e) { logger.error(`Failed to fetch remote anime for ${userId}:`, e); return null; }
}

// ==================== Manga Server Sync ====================

let mangaSyncToken: string | null = null;
let mangaSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleMangaSync() {
    if (mangaSyncTimer) clearTimeout(mangaSyncTimer);
    mangaSyncTimer = setTimeout(() => { mangaSyncTimer = null; syncMangaToServer().catch(() => { }); }, 2000);
}

async function loadMangaSyncToken(): Promise<string> {
    if (mangaSyncToken) return mangaSyncToken;
    let token = await DataStoreGet(STORE_KEY_MANGA_TOKEN) as string | undefined;
    if (!token) {
        const arr = new Uint8Array(24);
        crypto.getRandomValues(arr);
        token = Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
        await DataStoreSet(STORE_KEY_MANGA_TOKEN, token);
    }
    mangaSyncToken = token;
    return token;
}

async function syncMangaToServer(): Promise<boolean> {
    try {
        const token = await loadMangaSyncToken();
        const userId = UserStore.getCurrentUser()?.id;
        if (!userId) return false;
        const result = await Native.syncMangaList(userId, token, cachedManga.map(slimManga));
        if (!result.success) { logger.error("Manga sync failed:", result.error); return false; }
        return true;
    } catch (e) { logger.error("Manga sync exception:", e); return false; }
}

async function fetchRemoteMangaList(userId: string): Promise<{ manga: MangaData[]; } | null> {
    const cached = remoteMangaCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < REMOTE_CACHE_TTL) return cached;
    try {
        const data = await Native.fetchMangaList(userId);
        const manga: MangaData[] = data.favorites ?? [];
        if (manga.length === 0) return null;
        const result = { manga, fetchedAt: Date.now() };
        remoteMangaCacheSet(userId, result);
        return result;
    } catch (e) { logger.error(`Failed to fetch remote manga for ${userId}:`, e); return null; }
}

// ==================== Series Server Sync ====================

let seriesSyncToken: string | null = null;
let seriesSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSeriesSync() {
    if (seriesSyncTimer) clearTimeout(seriesSyncTimer);
    seriesSyncTimer = setTimeout(() => { seriesSyncTimer = null; syncSeriesToServer().catch(() => { }); }, 2000);
}

async function loadSeriesSyncToken(): Promise<string> {
    if (seriesSyncToken) return seriesSyncToken;
    let token = await DataStoreGet(STORE_KEY_SERIES_TOKEN) as string | undefined;
    if (!token) {
        const arr = new Uint8Array(24);
        crypto.getRandomValues(arr);
        token = Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
        await DataStoreSet(STORE_KEY_SERIES_TOKEN, token);
    }
    seriesSyncToken = token;
    return token;
}

async function syncSeriesToServer(): Promise<boolean> {
    try {
        const token = await loadSeriesSyncToken();
        const userId = UserStore.getCurrentUser()?.id;
        if (!userId) return false;
        const result = await Native.syncSeriesList(userId, token, cachedSeries.map(slimSeries));
        if (!result.success) { logger.error("Series sync failed:", result.error); return false; }
        return true;
    } catch (e) { logger.error("Series sync exception:", e); return false; }
}

async function fetchRemoteSeriesList(userId: string): Promise<{ series: SeriesData[]; } | null> {
    const cached = remoteSeriesCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < REMOTE_CACHE_TTL) return cached;
    try {
        const data = await Native.fetchSeriesList(userId);
        const series: SeriesData[] = data.favorites ?? [];
        if (series.length === 0) return null;
        const result = { series, fetchedAt: Date.now() };
        remoteSeriesCacheSet(userId, result);
        return result;
    } catch (e) { logger.error(`Failed to fetch remote series for ${userId}:`, e); return null; }
}

// ==================== Book Server Sync ====================

let bookSyncToken: string | null = null;
let bookSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBookSync() {
    if (bookSyncTimer) clearTimeout(bookSyncTimer);
    bookSyncTimer = setTimeout(() => { bookSyncTimer = null; syncBookToServer().catch(() => { }); }, 2000);
}

async function loadBookSyncToken(): Promise<string> {
    if (bookSyncToken) return bookSyncToken;
    let token = await DataStoreGet(STORE_KEY_BOOK_TOKEN) as string | undefined;
    if (!token) {
        const arr = new Uint8Array(24);
        crypto.getRandomValues(arr);
        token = Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
        await DataStoreSet(STORE_KEY_BOOK_TOKEN, token);
    }
    bookSyncToken = token;
    return token;
}

async function syncBookToServer(): Promise<boolean> {
    try {
        const token = await loadBookSyncToken();
        const userId = UserStore.getCurrentUser()?.id;
        if (!userId) return false;
        const result = await Native.syncBookList(userId, token, cachedBooks.map(slimBook));
        if (!result.success) { logger.error("Book sync failed:", result.error); return false; }
        return true;
    } catch (e) { logger.error("Book sync exception:", e); return false; }
}

async function fetchRemoteBookList(userId: string): Promise<{ books: BookData[]; } | null> {
    const cached = remoteBookCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < REMOTE_CACHE_TTL) return cached;
    try {
        const data = await Native.fetchBookList(userId);
        const books: BookData[] = data.favorites ?? [];
        if (books.length === 0) return null;
        const result = { books, fetchedAt: Date.now() };
        remoteBookCacheSet(userId, result);
        return result;
    } catch (e) { logger.error(`Failed to fetch remote books for ${userId}:`, e); return null; }
}

// ==================== Troll Server Sync ====================

let trollSyncToken: string | null = null;
let trollSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleTrollSync() {
    if (trollSyncTimer) clearTimeout(trollSyncTimer);
    trollSyncTimer = setTimeout(() => { trollSyncTimer = null; syncTrollToServer().catch(() => { }); }, 2000);
}

async function loadTrollSyncToken(): Promise<string> {
    if (trollSyncToken) return trollSyncToken;
    let token = await DataStoreGet(STORE_KEY_TROLL_TOKEN) as string | undefined;
    if (!token) {
        const arr = new Uint8Array(24);
        crypto.getRandomValues(arr);
        token = Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
        await DataStoreSet(STORE_KEY_TROLL_TOKEN, token);
    }
    trollSyncToken = token;
    return token;
}

async function syncTrollToServer(): Promise<boolean> {
    try {
        const token = await loadTrollSyncToken();
        const userId = UserStore.getCurrentUser()?.id;
        if (!userId) return false;
        if (cachedTroll.length === 0) return true;
        const result = await Native.syncTrollData(userId, token, cachedTroll.map(slimWiki));
        if (!result.success) { logger.error("Troll sync failed:", result.error); return false; }
        return true;
    } catch (e) { logger.error("Troll sync exception:", e); return false; }
}

async function fetchRemoteTrollData(userId: string): Promise<{ troll: TrollData; } | null> {
    const cached = remoteTrollCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < REMOTE_CACHE_TTL) return cached.troll.length > 0 ? { troll: cached.troll } : null;
    try {
        const data = await Native.fetchTrollData(userId);
        const troll: TrollData = data.favorites ?? [];
        const result = { troll, fetchedAt: Date.now() };
        remoteTrollCacheSet(userId, result);
        return troll.length > 0 ? { troll } : null;
    } catch (e) { logger.error(`Failed to fetch remote troll for ${userId}:`, e); return null; }
}

// ==================== Search ======================================

async function searchMusicItunes(query: string): Promise<MusicData[]> {
    if (!query.trim()) return [];
    try {
        return (await Native.searchMusic(query) ?? []) as MusicData[];
    } catch (e) { logger.error("Music search failed:", e); return []; }
}

async function searchAnimeJikan(query: string): Promise<AnimeData[]> {
    if (!query.trim()) return [];
    try {
        return (await Native.searchAnime(query) ?? []) as AnimeData[];
    } catch (e) { logger.error("Anime search failed:", e); return []; }
}

async function fetchMALUserFavorites(username: string): Promise<AnimeData[]> {
    if (!username.trim()) return [];
    try {
        return (await Native.fetchUserFavorites(username) ?? []) as AnimeData[];
    } catch (e) { logger.error("MAL user favorites fetch failed:", e); return []; }
}

async function searchMangaJikan(query: string): Promise<MangaData[]> {
    if (!query.trim()) return [];
    try {
        return (await Native.searchManga(query) ?? []) as MangaData[];
    } catch (e) { logger.error("Manga search failed:", e); return []; }
}

async function searchSeriesTvmaze(query: string): Promise<SeriesData[]> {
    if (!query.trim()) return [];
    try {
        return (await Native.searchSeries(query) ?? []) as SeriesData[];
    } catch (e) { logger.error("Series search failed:", e); return []; }
}

async function searchBookOpenLibrary(query: string): Promise<BookData[]> {
    if (!query.trim()) return [];
    try {
        return (await Native.searchBook(query) ?? []) as BookData[];
    } catch (e) { logger.error("Book search failed:", e); return []; }
}

async function searchWikipedia(query: string): Promise<WikipediaArticle[]> {
    if (!query.trim()) return [];
    try {
        return (await Native.searchWikipedia(query) ?? []) as WikipediaArticle[];
    } catch (e) { logger.error("Wikipedia search failed:", e); return []; }
}

// ==================== Helpers ====================

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ==================== Audio Player ====================

let globalAudio: HTMLAudioElement | null = null;
let globalPlayingId: number | null = null;
const audioListeners = new Set<() => void>();

function notifyAudioListeners() { audioListeners.forEach(fn => fn()); }

const AUDIO_BLOB_CACHE_MAX = 50;
const audioBlobCache = new Map<string, string>();

async function fetchAudioBlob(previewUrl: string): Promise<string> {
    const cached = audioBlobCache.get(previewUrl);
    if (cached) return cached;
    try {
        if (!Native?.fetchAudio) return "";
        const dataUri = await Native.fetchAudio(previewUrl);
        if (!dataUri) return "";
        const [header, b64] = dataUri.split(",", 2);
        const mime = header.split(":")[1]?.split(";")[0] || "audio/mpeg";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        if (audioBlobCache.size >= AUDIO_BLOB_CACHE_MAX) {
            const oldest = audioBlobCache.keys().next().value!;
            URL.revokeObjectURL(audioBlobCache.get(oldest)!);
            audioBlobCache.delete(oldest);
        }
        audioBlobCache.set(previewUrl, blobUrl);
        return blobUrl;
    } catch {
        return "";
    }
}

function togglePreview(previewUrl: string, trackId: number) {
    if (globalAudio) {
        const wasSameTrack = globalPlayingId === trackId;
        globalAudio.pause();
        globalAudio.src = "";
        globalAudio = null;
        globalPlayingId = null;
        notifyAudioListeners();
        if (wasSameTrack) return;
    }
    globalPlayingId = trackId;
    notifyAudioListeners();
    fetchAudioBlob(previewUrl).then(blobUrl => {
        if (globalPlayingId !== trackId) return;
        if (!blobUrl) { globalPlayingId = null; notifyAudioListeners(); return; }
        const audio = new Audio(blobUrl);
        globalAudio = audio;
        audio.volume = 0.5;
        audio.play().catch(() => { globalAudio = null; globalPlayingId = null; notifyAudioListeners(); });
        audio.addEventListener("ended", () => { globalAudio = null; globalPlayingId = null; notifyAudioListeners(); });
        notifyAudioListeners();
    });
}

function stopAllAudio() {
    if (globalAudio) { globalAudio.pause(); globalAudio.src = ""; globalAudio = null; globalPlayingId = null; notifyAudioListeners(); }
}

function useAudioPlaying(trackId: number): boolean {
    const [playing, setPlaying] = useState(globalPlayingId === trackId);
    useEffect(() => {
        const listener = () => setPlaying(globalPlayingId === trackId);
        audioListeners.add(listener);
        return () => { audioListeners.delete(listener); };
    }, [trackId]);
    return playing;
}

// ==================== Components ====================

// Drag-and-drop reorder hook for board grids
function useDragReorder<T>(list: T[], onReorder: (newList: T[]) => void) {
    const listRef = useRef(list);
    listRef.current = list;
    const srcIdx = useRef(-1);

    return useCallback((idx: number) => ({
        draggable: true as const,
        onDragStart(e: React.DragEvent) {
            srcIdx.current = idx;
            e.dataTransfer.effectAllowed = "move";
            (e.currentTarget as HTMLElement).classList.add("vc-superboard-dragging");
        },
        onDragOver(e: React.DragEvent) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            (e.currentTarget as HTMLElement).classList.add("vc-superboard-drag-over");
        },
        onDragLeave(e: React.DragEvent) {
            (e.currentTarget as HTMLElement).classList.remove("vc-superboard-drag-over");
        },
        onDrop(e: React.DragEvent) {
            e.preventDefault();
            (e.currentTarget as HTMLElement).classList.remove("vc-superboard-drag-over");
            const from = srcIdx.current;
            if (from < 0 || from === idx) return;
            const next = [...listRef.current];
            const [item] = next.splice(from, 1);
            next.splice(idx, 0, item);
            onReorder(next);
        },
        onDragEnd(e: React.DragEvent) {
            srcIdx.current = -1;
            (e.currentTarget as HTMLElement).classList.remove("vc-superboard-dragging");
            const parent = (e.currentTarget as HTMLElement).parentElement;
            if (parent) parent.querySelectorAll(".vc-superboard-drag-over").forEach(el => el.classList.remove("vc-superboard-drag-over"));
        },
    }), [onReorder]);
}

const IMAGE_CACHE_MAX = 150;
const imageCache = new Map<string, string>();
function imageCacheSet(key: string, value: string) {
    if (imageCache.size >= IMAGE_CACHE_MAX) imageCache.delete(imageCache.keys().next().value!);
    imageCache.set(key, value);
}

const imageInflight = new Map<string, Promise<string>>();

function ProxiedImage({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
    const [dataUrl, setDataUrl] = useState<string>(imageCache.get(src ?? "") ?? "");
    useEffect(() => {
        if (!src) return;
        const cached = imageCache.get(src);
        if (cached) { setDataUrl(cached); return; }
        let promise = imageInflight.get(src);
        if (!promise) {
            promise = Native?.fetchImage?.(src)?.catch(() => "") ?? Promise.resolve("");
            imageInflight.set(src, promise);
            promise.finally(() => imageInflight.delete(src));
        }
        let cancelled = false;
        promise.then(result => { if (!cancelled && result) { imageCacheSet(src, result); setDataUrl(result); } });
        return () => { cancelled = true; };
    }, [src]);
    if (!dataUrl) return <div style={{ width: "100%", height: "100%", background: "var(--background-secondary)" }} />;
    return <img src={dataUrl} alt={alt} {...props} />;
}

function MusicCard({ music, onAdd, onRemove, added, compact }: {
    music: MusicData;
    onAdd?: () => void;
    onRemove?: () => void;
    added?: boolean;
    compact?: boolean;
}) {
    const playing = useAudioPlaying(music.id);
    const imgUrl = compact ? music.cover_medium : (music.cover_big || music.cover_medium);
    return (
        <div className={`vc-superboard-card${compact ? " vc-superboard-card-compact" : ""}`}
            onClick={() => window.open(music.link, "_blank", "noopener,noreferrer")}>
            <div className="vc-superboard-card-poster">
                <ProxiedImage src={imgUrl} alt={music.title} loading="eager" />
                {music.preview_url && (
                    <button className={`vc-superboard-btn-play${playing ? " vc-superboard-btn-playing" : ""}`}
                        onClick={e => { e.stopPropagation(); togglePreview(music.preview_url, music.id); }}
                        title={playing ? "Stop preview" : "Play 30s preview"}>
                        {playing ? "⏸" : "▶"}
                    </button>
                )}
                {onRemove && (
                    <button className="vc-superboard-btn-remove"
                        onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove">✕</button>
                )}
                {onAdd && (
                    <button className={`vc-superboard-btn-add${added ? " vc-superboard-btn-added" : ""}`}
                        onClick={e => { e.stopPropagation(); if (!added) onAdd(); }}
                        title={added ? "Already added" : "Add to favorites"}>
                        {added ? "✓" : "+"}
                    </button>
                )}
            </div>
            <div className="vc-superboard-card-info">
                <span className="vc-superboard-card-title" title={music.title}>{music.title}</span>
                <span className="vc-superboard-card-meta">
                    {music.artist_name}{music.duration ? ` · ${formatDuration(music.duration)}` : ""}
                </span>
            </div>
        </div>
    );
}

function AnimeCard({ anime, onAdd, onRemove, added, compact, hate }: {
    anime: AnimeData;
    onAdd?: () => void;
    onRemove?: () => void;
    added?: boolean;
    compact?: boolean;
    hate?: boolean;
}) {
    const title = anime.title_english || anime.title;
    const imgUrl = compact
        ? anime.images.jpg.image_url
        : (anime.images.jpg.large_image_url || anime.images.jpg.image_url);
    return (
        <div className={`vc-superboard-card${compact ? " vc-superboard-card-compact" : ""}${hate ? " vc-superboard-card-hate" : ""}`}
            onClick={() => window.open(`https://myanimelist.net/anime/${anime.mal_id}`, "_blank", "noopener,noreferrer")}>
            <div className="vc-superboard-card-poster vc-superboard-poster-anime">
                <ProxiedImage src={imgUrl} alt={title} loading="eager" />
                {!hate && anime.score != null && anime.score > 0 && (
                    <span className="vc-superboard-badge-score">★ {anime.score}</span>
                )}
                {onRemove && (
                    <button className="vc-superboard-btn-remove"
                        onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove">✕</button>
                )}
                {onAdd && (
                    <button className={`vc-superboard-btn-add${hate ? " vc-superboard-btn-add-hate" : ""}${added ? " vc-superboard-btn-added" : ""}`}
                        onClick={e => { e.stopPropagation(); if (!added) onAdd(); }}
                        title={added ? "Already added" : (hate ? "Add to hate list" : "Add to favorites")}>
                        {added ? "✓" : (hate ? "💔" : "+")}
                    </button>
                )}
            </div>
            <div className="vc-superboard-card-info">
                <span className="vc-superboard-card-title" title={title}>{title}</span>
                <span className="vc-superboard-card-meta">
                    {anime.type ?? "?"}{anime.episodes ? ` · ${anime.episodes} Ep` : ""}{anime.year ? ` · ${anime.year}` : ""}
                </span>
            </div>
        </div>
    );
}

function MangaCard({ manga, onAdd, onRemove, added, compact }: {
    manga: MangaData;
    onAdd?: () => void;
    onRemove?: () => void;
    added?: boolean;
    compact?: boolean;
}) {
    const title = manga.title_english || manga.title;
    const imgUrl = compact
        ? manga.images.jpg.image_url
        : (manga.images.jpg.large_image_url || manga.images.jpg.image_url);
    return (
        <div className={`vc-superboard-card${compact ? " vc-superboard-card-compact" : ""}`}
            onClick={() => window.open(`https://myanimelist.net/manga/${manga.mal_id}`, "_blank", "noopener,noreferrer")}>
            <div className="vc-superboard-card-poster vc-superboard-poster-anime">
                <ProxiedImage src={imgUrl} alt={title} loading="eager" />
                {manga.score != null && manga.score > 0 && (
                    <span className="vc-superboard-badge-score">★ {manga.score}</span>
                )}
                {onRemove && (
                    <button className="vc-superboard-btn-remove"
                        onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove">✕</button>
                )}
                {onAdd && (
                    <button className={`vc-superboard-btn-add${added ? " vc-superboard-btn-added" : ""}`}
                        onClick={e => { e.stopPropagation(); if (!added) onAdd(); }}
                        title={added ? "Already added" : "Add to favorites"}>
                        {added ? "✓" : "+"}
                    </button>
                )}
            </div>
            <div className="vc-superboard-card-info">
                <span className="vc-superboard-card-title" title={title}>{title}</span>
                <span className="vc-superboard-card-meta">
                    {manga.type ?? "?"}{manga.chapters ? ` · ${manga.chapters} Ch` : ""}{manga.volumes ? ` · ${manga.volumes} Vol` : ""}{manga.year ? ` · ${manga.year}` : ""}
                </span>
            </div>
        </div>
    );
}

function SeriesCard({ series, onAdd, onRemove, added, compact }: {
    series: SeriesData;
    onAdd?: () => void;
    onRemove?: () => void;
    added?: boolean;
    compact?: boolean;
}) {
    const imgUrl = compact ? series.image_medium : (series.image_original || series.image_medium);
    return (
        <div className={`vc-superboard-card${compact ? " vc-superboard-card-compact" : ""}`}
            onClick={() => window.open(series.link, "_blank", "noopener,noreferrer")}>
            <div className="vc-superboard-card-poster vc-superboard-poster-anime">
                <ProxiedImage src={imgUrl} alt={series.title} loading="eager" />
                {series.rating != null && series.rating > 0 && (
                    <span className="vc-superboard-badge-score">★ {series.rating}</span>
                )}
                {onRemove && (
                    <button className="vc-superboard-btn-remove"
                        onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove">✕</button>
                )}
                {onAdd && (
                    <button className={`vc-superboard-btn-add${added ? " vc-superboard-btn-added" : ""}`}
                        onClick={e => { e.stopPropagation(); if (!added) onAdd(); }}
                        title={added ? "Already added" : "Add to favorites"}>
                        {added ? "✓" : "+"}
                    </button>
                )}
            </div>
            <div className="vc-superboard-card-info">
                <span className="vc-superboard-card-title" title={series.title}>{series.title}</span>
                <span className="vc-superboard-card-meta">
                    {series.network}{series.year ? ` · ${series.year}` : ""}{series.status ? ` · ${series.status}` : ""}
                </span>
            </div>
        </div>
    );
}

function BookCard({ book, onAdd, onRemove, added, compact }: {
    book: BookData;
    onAdd?: () => void;
    onRemove?: () => void;
    added?: boolean;
    compact?: boolean;
}) {
    const imgUrl = compact ? book.cover_medium : (book.cover_big || book.cover_medium);
    return (
        <div className={`vc-superboard-card${compact ? " vc-superboard-card-compact" : ""}`}
            onClick={() => window.open(book.link, "_blank", "noopener,noreferrer")}>
            <div className="vc-superboard-card-poster vc-superboard-poster-anime">
                <ProxiedImage src={imgUrl} alt={book.title} loading="eager" />
                {book.year && (
                    <span className="vc-superboard-badge-score">📅 {book.year}</span>
                )}
                {onRemove && (
                    <button className="vc-superboard-btn-remove"
                        onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove">✕</button>
                )}
                {onAdd && (
                    <button className={`vc-superboard-btn-add${added ? " vc-superboard-btn-added" : ""}`}
                        onClick={e => { e.stopPropagation(); if (!added) onAdd(); }}
                        title={added ? "Already added" : "Add to favorites"}>
                        {added ? "✓" : "+"}
                    </button>
                )}
            </div>
            <div className="vc-superboard-card-info">
                <span className="vc-superboard-card-title" title={book.title}>{book.title}</span>
                <span className="vc-superboard-card-meta">
                    {book.author}{book.pages ? ` · ${book.pages}p` : ""}
                </span>
            </div>
        </div>
    );
}

function WikiCard({ article, onAdd, onRemove, added, compact }: {
    article: WikipediaArticle;
    onAdd?: () => void;
    onRemove?: () => void;
    added?: boolean;
    compact?: boolean;
}) {
    return (
        <div className={`vc-superboard-card${compact ? " vc-superboard-card-compact" : ""}`}
            onClick={() => window.open(article.url, "_blank", "noopener,noreferrer")}>
            <div className="vc-superboard-card-poster">
                {article.thumbnail ? (
                    <ProxiedImage src={article.thumbnail} alt={article.title} loading="eager" />
                ) : (
                    <div style={{ width: "100%", height: "100%", background: "var(--background-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>📰</div>
                )}
                {onRemove && (
                    <button className="vc-superboard-btn-remove"
                        onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove">✕</button>
                )}
                {onAdd && (
                    <button className={`vc-superboard-btn-add${added ? " vc-superboard-btn-added" : ""}`}
                        onClick={e => { e.stopPropagation(); if (!added) onAdd(); }}
                        title={added ? "Already added" : "Add to favorites"}>
                        {added ? "✓" : "+"}
                    </button>
                )}
            </div>
            <div className="vc-superboard-card-info">
                <span className="vc-superboard-card-title" title={article.title}>{article.title}</span>
                <span className="vc-superboard-card-meta">{article.description || "Wikipedia"}</span>
            </div>
        </div>
    );
}

// ==================== Music Search Modal ====================

function MusicSearchModal({ rootProps, onChanged }: { rootProps: any; onChanged: () => void; }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<MusicData[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedIds, setAddedIds] = useState<Set<number>>(new Set(cachedMusic.map(m => m.id)));
    const debouncedQuery = useDebounce(query, 400);

    useEffect(() => {
        if (!debouncedQuery.trim()) { setResults([]); return; }
        let cancelled = false;
        setLoading(true);
        searchMusicItunes(debouncedQuery).then(data => { if (!cancelled) { setResults(data); setLoading(false); } });
        return () => { cancelled = true; };
    }, [debouncedQuery]);

    useEffect(() => () => stopAllAudio(), []);

    const handleAdd = useCallback(async (music: MusicData) => {
        await addMusic(music);
        setAddedIds(new Set(cachedMusic.map(m => m.id)));
        onChanged();
    }, [onChanged]);

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>🎵 Search Music — iTunes</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div className="vc-superboard-search-container">
                    <TextInput placeholder="Search for songs, artists, or albums..." value={query} onChange={setQuery} autoFocus />
                    {loading && (
                        <div className="vc-superboard-loading">
                            <div className="vc-superboard-spinner" />
                            <Text variant="text-md/medium">Searching...</Text>
                        </div>
                    )}
                    {!loading && results.length === 0 && debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <Text variant="text-md/medium">No results for &quot;{debouncedQuery}&quot;</Text>
                        </div>
                    )}
                    {!loading && !debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <div className="vc-superboard-empty-icon">🔍</div>
                            <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>
                                Type above to find your favorite music
                            </Text>
                        </div>
                    )}
                    {!loading && results.length > 0 && (
                        <div className="vc-superboard-search-grid">
                            {results.map(music => (
                                <MusicCard key={music.id} music={music} onAdd={() => handleAdd(music)} added={addedIds.has(music.id)} />
                            ))}
                        </div>
                    )}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function openMusicSearchModal(onChanged: () => void) {
    openModal(props => <MusicSearchModal rootProps={props} onChanged={onChanged} />);
}

// ==================== Anime Search Modal ====================

function AnimeSearchModal({ rootProps, onChanged, mode }: { rootProps: any; onChanged: () => void; mode: ListMode; }) {
    const isHate = mode === "hate";
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<AnimeData[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedIds, setAddedIds] = useState<Set<number>>(
        new Set((isHate ? cachedHated : cachedFavorites).map(f => f.mal_id))
    );
    const debouncedQuery = useDebounce(query, 400);

    useEffect(() => {
        if (!debouncedQuery.trim()) { setResults([]); return; }
        let cancelled = false;
        setLoading(true);
        searchAnimeJikan(debouncedQuery).then(data => { if (!cancelled) { setResults(data); setLoading(false); } });
        return () => { cancelled = true; };
    }, [debouncedQuery]);

    const handleAdd = useCallback(async (anime: AnimeData) => {
        if (isHate) {
            await addHated(anime);
            setAddedIds(new Set(cachedHated.map(f => f.mal_id)));
        } else {
            await addFavorite(anime);
            setAddedIds(new Set(cachedFavorites.map(f => f.mal_id)));
        }
        onChanged();
    }, [isHate, onChanged]);

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>
                    {isHate ? "💔 Add to Hate List" : "Search Anime — MyAnimeList"}
                </Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div className="vc-superboard-search-container">
                    <TextInput
                        placeholder={isHate ? "Find an anime you hate..." : "Search anime"}
                        value={query} onChange={setQuery} autoFocus
                    />
                    {loading && (
                        <div className="vc-superboard-loading">
                            <div className="vc-superboard-spinner" />
                            <Text variant="text-md/medium">Searching...</Text>
                        </div>
                    )}
                    {!loading && results.length === 0 && debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <Text variant="text-md/medium">No results for &quot;{debouncedQuery}&quot;</Text>
                        </div>
                    )}
                    {!loading && !debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <div className="vc-superboard-empty-icon">{isHate ? "💔" : "🔍"}</div>
                            <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>
                                {isHate ? "Search for anime you despise" : "Type above to find your favorite anime"}
                            </Text>
                        </div>
                    )}
                    {!loading && results.length > 0 && (
                        <div className="vc-superboard-search-grid">
                            {results.map(anime => (
                                <AnimeCard key={anime.mal_id} anime={anime} onAdd={() => handleAdd(anime)} added={addedIds.has(anime.mal_id)} hate={isHate} />
                            ))}
                        </div>
                    )}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function openAnimeSearchModal(mode: ListMode, onChanged: () => void) {
    openModal(props => <AnimeSearchModal rootProps={props} mode={mode} onChanged={onChanged} />);
}

// ==================== Manga Search Modal ====================

function MangaSearchModal({ rootProps, onChanged }: { rootProps: any; onChanged: () => void; }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<MangaData[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedIds, setAddedIds] = useState<Set<number>>(new Set(cachedManga.map(m => m.mal_id)));
    const debouncedQuery = useDebounce(query, 400);

    useEffect(() => {
        if (!debouncedQuery.trim()) { setResults([]); return; }
        let cancelled = false;
        setLoading(true);
        searchMangaJikan(debouncedQuery).then(data => { if (!cancelled) { setResults(data); setLoading(false); } });
        return () => { cancelled = true; };
    }, [debouncedQuery]);

    const handleAdd = useCallback(async (manga: MangaData) => {
        await addManga(manga);
        setAddedIds(new Set(cachedManga.map(m => m.mal_id)));
        onChanged();
    }, [onChanged]);

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>📚 Search Manga — MyAnimeList</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div className="vc-superboard-search-container">
                    <TextInput placeholder="Search for manga, manhwa, manhua..." value={query} onChange={setQuery} autoFocus />
                    {loading && (
                        <div className="vc-superboard-loading">
                            <div className="vc-superboard-spinner" />
                            <Text variant="text-md/medium">Searching...</Text>
                        </div>
                    )}
                    {!loading && results.length === 0 && debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <Text variant="text-md/medium">No results for &quot;{debouncedQuery}&quot;</Text>
                        </div>
                    )}
                    {!loading && !debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <div className="vc-superboard-empty-icon">🔍</div>
                            <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>
                                Type above to find your favorite manga
                            </Text>
                        </div>
                    )}
                    {!loading && results.length > 0 && (
                        <div className="vc-superboard-search-grid">
                            {results.map(manga => (
                                <MangaCard key={manga.mal_id} manga={manga} onAdd={() => handleAdd(manga)} added={addedIds.has(manga.mal_id)} />
                            ))}
                        </div>
                    )}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function openMangaSearchModal(onChanged: () => void) {
    openModal(props => <MangaSearchModal rootProps={props} onChanged={onChanged} />);
}

// ==================== Series Search Modal ====================

function SeriesSearchModal({ rootProps, onChanged }: { rootProps: any; onChanged: () => void; }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SeriesData[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedIds, setAddedIds] = useState<Set<number>>(new Set(cachedSeries.map(s => s.id)));
    const debouncedQuery = useDebounce(query, 400);

    useEffect(() => {
        if (!debouncedQuery.trim()) { setResults([]); return; }
        let cancelled = false;
        setLoading(true);
        searchSeriesTvmaze(debouncedQuery).then(data => { if (!cancelled) { setResults(data); setLoading(false); } });
        return () => { cancelled = true; };
    }, [debouncedQuery]);

    const handleAdd = useCallback(async (series: SeriesData) => {
        await addSeries(series);
        setAddedIds(new Set(cachedSeries.map(s => s.id)));
        onChanged();
    }, [onChanged]);

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>📺 Search TV Series — TVMaze</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div className="vc-superboard-search-container">
                    <TextInput placeholder="Search for TV series..." value={query} onChange={setQuery} autoFocus />
                    {loading && (
                        <div className="vc-superboard-loading">
                            <div className="vc-superboard-spinner" />
                            <Text variant="text-md/medium">Searching...</Text>
                        </div>
                    )}
                    {!loading && results.length === 0 && debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <Text variant="text-md/medium">No results for &quot;{debouncedQuery}&quot;</Text>
                        </div>
                    )}
                    {!loading && !debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <div className="vc-superboard-empty-icon">🔍</div>
                            <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>
                                Type above to find your favorite TV series
                            </Text>
                        </div>
                    )}
                    {!loading && results.length > 0 && (
                        <div className="vc-superboard-search-grid">
                            {results.map(series => (
                                <SeriesCard key={series.id} series={series} onAdd={() => handleAdd(series)} added={addedIds.has(series.id)} />
                            ))}
                        </div>
                    )}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function openSeriesSearchModal(onChanged: () => void) {
    openModal(props => <SeriesSearchModal rootProps={props} onChanged={onChanged} />);
}

// ==================== Book Search Modal ====================

function BookSearchModal({ rootProps, onChanged }: { rootProps: any; onChanged: () => void; }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<BookData[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set(cachedBooks.map(b => b.id)));
    const debouncedQuery = useDebounce(query, 400);

    useEffect(() => {
        if (!debouncedQuery.trim()) { setResults([]); return; }
        let cancelled = false;
        setLoading(true);
        searchBookOpenLibrary(debouncedQuery).then(data => { if (!cancelled) { setResults(data); setLoading(false); } });
        return () => { cancelled = true; };
    }, [debouncedQuery]);

    const handleAdd = useCallback(async (book: BookData) => {
        await addBook(book);
        setAddedIds(new Set(cachedBooks.map(b => b.id)));
        onChanged();
    }, [onChanged]);

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>📖 Search Books — Open Library</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div className="vc-superboard-search-container">
                    <TextInput placeholder="Search for books, authors..." value={query} onChange={setQuery} autoFocus />
                    {loading && (
                        <div className="vc-superboard-loading">
                            <div className="vc-superboard-spinner" />
                            <Text variant="text-md/medium">Searching...</Text>
                        </div>
                    )}
                    {!loading && results.length === 0 && debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <Text variant="text-md/medium">No results for &quot;{debouncedQuery}&quot;</Text>
                        </div>
                    )}
                    {!loading && !debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <div className="vc-superboard-empty-icon">🔍</div>
                            <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>
                                Type above to find your favorite books
                            </Text>
                        </div>
                    )}
                    {!loading && results.length > 0 && (
                        <div className="vc-superboard-search-grid">
                            {results.map(book => (
                                <BookCard key={book.id} book={book} onAdd={() => handleAdd(book)} added={addedIds.has(book.id)} />
                            ))}
                        </div>
                    )}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function openBookSearchModal(onChanged: () => void) {
    openModal(props => <BookSearchModal rootProps={props} onChanged={onChanged} />);
}

// ==================== Wikipedia Search Modal ====================

function WikiSearchModal({ rootProps, onChanged }: { rootProps: any; onChanged: () => void; }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<WikipediaArticle[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedIds, setAddedIds] = useState<Set<number>>(new Set(cachedTroll.map(a => a.pageid)));
    const debouncedQuery = useDebounce(query, 400);

    useEffect(() => {
        if (!debouncedQuery.trim()) { setResults([]); return; }
        let cancelled = false;
        setLoading(true);
        searchWikipedia(debouncedQuery).then(data => { if (!cancelled) { setResults(data); setLoading(false); } });
        return () => { cancelled = true; };
    }, [debouncedQuery]);

    const handleAdd = useCallback(async (article: WikipediaArticle) => {
        await addTrollArticle(article);
        setAddedIds(new Set(cachedTroll.map(a => a.pageid)));
        onChanged();
    }, [onChanged]);

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>📰 Search Wikipedia</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div className="vc-superboard-search-container">
                    <TextInput placeholder="Search Wikipedia articles..." value={query} onChange={setQuery} autoFocus />
                    {loading && (
                        <div className="vc-superboard-loading">
                            <div className="vc-superboard-spinner" />
                            <Text variant="text-md/medium">Searching...</Text>
                        </div>
                    )}
                    {!loading && results.length === 0 && debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <Text variant="text-md/medium">No results for &quot;{debouncedQuery}&quot;</Text>
                        </div>
                    )}
                    {!loading && !debouncedQuery.trim() && (
                        <div className="vc-superboard-empty">
                            <div className="vc-superboard-empty-icon">🔍</div>
                            <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>
                                Type above to find Wikipedia articles
                            </Text>
                        </div>
                    )}
                    {!loading && results.length > 0 && (
                        <div className="vc-superboard-search-grid">
                            {results.map(article => (
                                <WikiCard key={article.pageid} article={article} onAdd={() => handleAdd(article)} added={addedIds.has(article.pageid)} />
                            ))}
                        </div>
                    )}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function openWikiSearchModal(onChanged: () => void) {
    openModal(props => <WikiSearchModal rootProps={props} onChanged={onChanged} />);
}

// ==================== Board Contents ====================

function MusicBoardContent({ user, isCurrentUser, onBack }: { user: User; isCurrentUser: boolean; onBack: () => void; }) {
    const [musicList, setMusicList] = useState<MusicData[]>(isCurrentUser ? cachedMusic : []);
    const [loading, setLoading] = useState(!isCurrentUser);

    useEffect(() => {
        if (isCurrentUser) {
            loadMusic().then(setMusicList);
        } else {
            setLoading(true);
            fetchRemoteMusicList(user.id).then(data => {
                if (data) setMusicList(data.music);
                setLoading(false);
            });
        }
        return () => stopAllAudio();
    }, [user.id]);

    const handleRemove = useCallback(async (id: number) => {
        await removeMusic(id);
        setMusicList([...cachedMusic]);
    }, []);

    const handleAdd = useCallback(() => {
        openMusicSearchModal(() => loadMusic().then(setMusicList));
    }, []);

    const handleReorder = useCallback((newList: MusicData[]) => {
        setMusicList(newList);
        reorderMusic(newList);
    }, []);
    const dragProps = useDragReorder(musicList, handleReorder);

    if (loading) {
        return (
            <div className="vc-superboard-board-content">
                <div className="vc-superboard-back-row">
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
                </div>
                <div className="vc-superboard-loading">
                    <div className="vc-superboard-spinner" />
                    <Text variant="text-md/medium">Loading music list...</Text>
                </div>
            </div>
        );
    }

    return (
        <div className="vc-superboard-board-content">
            <div className="vc-superboard-back-row">
                <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
            </div>
            <div className="vc-superboard-board-header">
                <Text variant="text-xs/semibold" style={{ color: "var(--header-secondary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    🎵 ({musicList.length})
                </Text>
                {isCurrentUser && (
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={handleAdd}>Add</Button>
                )}
            </div>
            {musicList.length > 0 ? (
                <div className="vc-superboard-board-grid">
                    {musicList.map((music, i) => (
                        isCurrentUser ? (
                            <div key={music.id} {...dragProps(i)} className="vc-superboard-drag-item">
                                <MusicCard music={music} onRemove={() => handleRemove(music.id)} compact />
                            </div>
                        ) : (
                            <MusicCard key={music.id} music={music} compact />
                        )
                    ))}
                </div>
            ) : (
                <div className={ProfileListClasses.empty} style={{ padding: "16px 0" }}>
                    <div className={ProfileListClasses.textContainer}>
                        <BaseText tag="h3" size="md" weight="medium" style={{ color: "var(--text-strong)" }}>
                            {isCurrentUser ? "No music added yet. Use the Add button!" : "No favorite music."}
                        </BaseText>
                    </div>
                </div>
            )}
        </div>
    );
}

function AnimeBoardContent({ user, isCurrentUser, onBack }: { user: User; isCurrentUser: boolean; onBack: () => void; }) {
    const [favList, setFavList] = useState<AnimeData[]>(isCurrentUser ? cachedFavorites : []);
    const [hateList, setHateList] = useState<AnimeData[]>(isCurrentUser ? cachedHated : []);
    const [loading, setLoading] = useState(!isCurrentUser);

    useEffect(() => {
        if (isCurrentUser) {
            loadFavorites().then(setFavList);
            loadHated().then(setHateList);
        } else {
            setLoading(true);
            fetchRemoteAnimeList(user.id).then(data => {
                if (data) { setFavList(data.favs); setHateList(data.hated); }
                setLoading(false);
            });
        }
    }, [user.id]);

    const handleRemoveFav = useCallback(async (malId: number) => {
        await removeFavorite(malId);
        setFavList([...cachedFavorites]);
    }, []);

    const handleRemoveHate = useCallback(async (malId: number) => {
        await removeHated(malId);
        setHateList([...cachedHated]);
    }, []);

    const handleAddFav = useCallback(() => {
        openAnimeSearchModal("fav", () => loadFavorites().then(setFavList));
    }, []);

    const handleAddHate = useCallback(() => {
        openAnimeSearchModal("hate", () => loadHated().then(setHateList));
    }, []);

    const handleReorderFav = useCallback((newList: AnimeData[]) => {
        setFavList(newList);
        reorderFavorites(newList);
    }, []);
    const handleReorderHate = useCallback((newList: AnimeData[]) => {
        setHateList(newList);
        reorderHated(newList);
    }, []);
    const dragPropsFav = useDragReorder(favList, handleReorderFav);
    const dragPropsHate = useDragReorder(hateList, handleReorderHate);

    if (loading) {
        return (
            <div className="vc-superboard-board-content">
                <div className="vc-superboard-back-row">
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
                </div>
                <div className="vc-superboard-loading">
                    <div className="vc-superboard-spinner" />
                    <Text variant="text-md/medium">Loading anime list...</Text>
                </div>
            </div>
        );
    }

    if (favList.length === 0 && hateList.length === 0 && !isCurrentUser) {
        return (
            <div className="vc-superboard-board-content">
                <div className="vc-superboard-back-row">
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
                </div>
                <div className="vc-superboard-empty">
                    <div className="vc-superboard-empty-icon">🎬</div>
                    <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>No anime data found for this user.</Text>
                </div>
            </div>
        );
    }

    return (
        <div className="vc-superboard-board-content">
            <div className="vc-superboard-back-row">
                <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
            </div>

            {/* Favorites section */}
            <div className="vc-superboard-board-header">
                <Text variant="text-xs/semibold" style={{ color: "var(--header-secondary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    ❤️ ({favList.length})
                </Text>
                {isCurrentUser && (
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={handleAddFav}>Add</Button>
                )}
            </div>
            {favList.length > 0 ? (
                <div className="vc-superboard-board-grid">
                    {favList.map((anime, i) => (
                        isCurrentUser ? (
                            <div key={anime.mal_id} {...dragPropsFav(i)} className="vc-superboard-drag-item">
                                <AnimeCard anime={anime} onRemove={() => handleRemoveFav(anime.mal_id)} compact />
                            </div>
                        ) : (
                            <AnimeCard key={anime.mal_id} anime={anime} compact />
                        )
                    ))}
                </div>
            ) : (
                <div className={ProfileListClasses.empty} style={{ padding: "16px 0" }}>
                    <div className={ProfileListClasses.textContainer}>
                        <BaseText tag="h3" size="md" weight="medium" style={{ color: "var(--text-strong)" }}>
                            {isCurrentUser ? "No favorites yet. Use the Add button!" : "No favorite anime."}
                        </BaseText>
                    </div>
                </div>
            )}

            {/* Hated section */}
            <div className="vc-superboard-board-divider" />
            <div className="vc-superboard-board-header">
                <Text variant="text-xs/semibold" style={{ color: "var(--header-secondary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    💔 ({hateList.length})
                </Text>
                {isCurrentUser && (
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={handleAddHate}>Add</Button>
                )}
            </div>
            {hateList.length > 0 ? (
                <div className="vc-superboard-board-grid">
                    {hateList.map((anime, i) => (
                        isCurrentUser ? (
                            <div key={anime.mal_id} {...dragPropsHate(i)} className="vc-superboard-drag-item">
                                <AnimeCard anime={anime} onRemove={() => handleRemoveHate(anime.mal_id)} compact hate />
                            </div>
                        ) : (
                            <AnimeCard key={anime.mal_id} anime={anime} compact hate />
                        )
                    ))}
                </div>
            ) : (
                <div className={ProfileListClasses.empty} style={{ padding: "16px 0" }}>
                    <div className={ProfileListClasses.textContainer}>
                        <BaseText tag="h3" size="md" weight="medium" style={{ color: "var(--text-strong)" }}>
                            {isCurrentUser ? "No hated anime yet." : "No hated anime."}
                        </BaseText>
                    </div>
                </div>
            )}
        </div>
    );
}

function MangaBoardContent({ user, isCurrentUser, onBack }: { user: User; isCurrentUser: boolean; onBack: () => void; }) {
    const [mangaList, setMangaList] = useState<MangaData[]>(isCurrentUser ? cachedManga : []);
    const [loading, setLoading] = useState(!isCurrentUser);

    useEffect(() => {
        if (isCurrentUser) {
            loadManga().then(setMangaList);
        } else {
            setLoading(true);
            fetchRemoteMangaList(user.id).then(data => {
                if (data) setMangaList(data.manga);
                setLoading(false);
            });
        }
    }, [user.id]);

    const handleRemove = useCallback(async (malId: number) => {
        await removeManga(malId);
        setMangaList([...cachedManga]);
    }, []);

    const handleAdd = useCallback(() => {
        openMangaSearchModal(() => loadManga().then(setMangaList));
    }, []);

    const handleReorder = useCallback((newList: MangaData[]) => {
        setMangaList(newList);
        reorderManga(newList);
    }, []);
    const dragProps = useDragReorder(mangaList, handleReorder);

    if (loading) {
        return (
            <div className="vc-superboard-board-content">
                <div className="vc-superboard-back-row">
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
                </div>
                <div className="vc-superboard-loading">
                    <div className="vc-superboard-spinner" />
                    <Text variant="text-md/medium">Loading manga list...</Text>
                </div>
            </div>
        );
    }

    return (
        <div className="vc-superboard-board-content">
            <div className="vc-superboard-back-row">
                <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
            </div>
            <div className="vc-superboard-board-header">
                <Text variant="text-xs/semibold" style={{ color: "var(--header-secondary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    📚 ({mangaList.length})
                </Text>
                {isCurrentUser && (
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={handleAdd}>Add</Button>
                )}
            </div>
            {mangaList.length > 0 ? (
                <div className="vc-superboard-board-grid">
                    {mangaList.map((manga, i) => (
                        isCurrentUser ? (
                            <div key={manga.mal_id} {...dragProps(i)} className="vc-superboard-drag-item">
                                <MangaCard manga={manga} onRemove={() => handleRemove(manga.mal_id)} compact />
                            </div>
                        ) : (
                            <MangaCard key={manga.mal_id} manga={manga} compact />
                        )
                    ))}
                </div>
            ) : (
                <div className={ProfileListClasses.empty} style={{ padding: "16px 0" }}>
                    <div className={ProfileListClasses.textContainer}>
                        <BaseText tag="h3" size="md" weight="medium" style={{ color: "var(--text-strong)" }}>
                            {isCurrentUser ? "No manga added yet. Use the Add button!" : "No favorite manga."}
                        </BaseText>
                    </div>
                </div>
            )}
        </div>
    );
}

function SeriesBoardContent({ user, isCurrentUser, onBack }: { user: User; isCurrentUser: boolean; onBack: () => void; }) {
    const [seriesList, setSeriesList] = useState<SeriesData[]>(isCurrentUser ? cachedSeries : []);
    const [loading, setLoading] = useState(!isCurrentUser);

    useEffect(() => {
        if (isCurrentUser) {
            loadSeries().then(setSeriesList);
        } else {
            setLoading(true);
            fetchRemoteSeriesList(user.id).then(data => {
                if (data) setSeriesList(data.series);
                setLoading(false);
            });
        }
    }, [user.id]);

    const handleRemove = useCallback(async (id: number) => {
        await removeSeries(id);
        setSeriesList([...cachedSeries]);
    }, []);

    const handleAdd = useCallback(() => {
        openSeriesSearchModal(() => loadSeries().then(setSeriesList));
    }, []);

    const handleReorder = useCallback((newList: SeriesData[]) => {
        setSeriesList(newList);
        reorderSeries(newList);
    }, []);
    const dragProps = useDragReorder(seriesList, handleReorder);

    if (loading) {
        return (
            <div className="vc-superboard-board-content">
                <div className="vc-superboard-back-row">
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
                </div>
                <div className="vc-superboard-loading">
                    <div className="vc-superboard-spinner" />
                    <Text variant="text-md/medium">Loading series list...</Text>
                </div>
            </div>
        );
    }

    return (
        <div className="vc-superboard-board-content">
            <div className="vc-superboard-back-row">
                <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
            </div>
            <div className="vc-superboard-board-header">
                <Text variant="text-xs/semibold" style={{ color: "var(--header-secondary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    📺 ({seriesList.length})
                </Text>
                {isCurrentUser && (
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={handleAdd}>Add</Button>
                )}
            </div>
            {seriesList.length > 0 ? (
                <div className="vc-superboard-board-grid">
                    {seriesList.map((series, i) => (
                        isCurrentUser ? (
                            <div key={series.id} {...dragProps(i)} className="vc-superboard-drag-item">
                                <SeriesCard series={series} onRemove={() => handleRemove(series.id)} compact />
                            </div>
                        ) : (
                            <SeriesCard key={series.id} series={series} compact />
                        )
                    ))}
                </div>
            ) : (
                <div className={ProfileListClasses.empty} style={{ padding: "16px 0" }}>
                    <div className={ProfileListClasses.textContainer}>
                        <BaseText tag="h3" size="md" weight="medium" style={{ color: "var(--text-strong)" }}>
                            {isCurrentUser ? "No series added yet. Use the Add button!" : "No favorite series."}
                        </BaseText>
                    </div>
                </div>
            )}
        </div>
    );
}

function BookBoardContent({ user, isCurrentUser, onBack }: { user: User; isCurrentUser: boolean; onBack: () => void; }) {
    const [bookList, setBookList] = useState<BookData[]>(isCurrentUser ? cachedBooks : []);
    const [loading, setLoading] = useState(!isCurrentUser);

    useEffect(() => {
        if (isCurrentUser) {
            loadBooks().then(setBookList);
        } else {
            setLoading(true);
            fetchRemoteBookList(user.id).then(data => {
                if (data) setBookList(data.books);
                setLoading(false);
            });
        }
    }, [user.id]);

    const handleRemove = useCallback(async (id: string) => {
        await removeBook(id);
        setBookList([...cachedBooks]);
    }, []);

    const handleAdd = useCallback(() => {
        openBookSearchModal(() => loadBooks().then(setBookList));
    }, []);

    const handleReorder = useCallback((newList: BookData[]) => {
        setBookList(newList);
        reorderBooks(newList);
    }, []);
    const dragProps = useDragReorder(bookList, handleReorder);

    if (loading) {
        return (
            <div className="vc-superboard-board-content">
                <div className="vc-superboard-back-row">
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
                </div>
                <div className="vc-superboard-loading">
                    <div className="vc-superboard-spinner" />
                    <Text variant="text-md/medium">Loading book list...</Text>
                </div>
            </div>
        );
    }

    return (
        <div className="vc-superboard-board-content">
            <div className="vc-superboard-back-row">
                <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
            </div>
            <div className="vc-superboard-board-header">
                <Text variant="text-xs/semibold" style={{ color: "var(--header-secondary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    📖 ({bookList.length})
                </Text>
                {isCurrentUser && (
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={handleAdd}>Add</Button>
                )}
            </div>
            {bookList.length > 0 ? (
                <div className="vc-superboard-board-grid">
                    {bookList.map((book, i) => (
                        isCurrentUser ? (
                            <div key={book.id} {...dragProps(i)} className="vc-superboard-drag-item">
                                <BookCard book={book} onRemove={() => handleRemove(book.id)} compact />
                            </div>
                        ) : (
                            <BookCard key={book.id} book={book} compact />
                        )
                    ))}
                </div>
            ) : (
                <div className={ProfileListClasses.empty} style={{ padding: "16px 0" }}>
                    <div className={ProfileListClasses.textContainer}>
                        <BaseText tag="h3" size="md" weight="medium" style={{ color: "var(--text-strong)" }}>
                            {isCurrentUser ? "No books added yet. Use the Add button!" : "No favorite books."}
                        </BaseText>
                    </div>
                </div>
            )}
        </div>
    );
}

function TrollBoardContent({ user, isCurrentUser, onBack }: { user: User; isCurrentUser: boolean; onBack: () => void; }) {
    const [trollList, setTrollList] = useState<TrollData>(isCurrentUser ? cachedTroll : []);
    const [loading, setLoading] = useState(!isCurrentUser);

    useEffect(() => {
        if (isCurrentUser) {
            loadTroll().then(setTrollList);
        } else {
            setLoading(true);
            fetchRemoteTrollData(user.id).then(result => {
                if (result) setTrollList(result.troll);
                setLoading(false);
            });
        }
    }, [user.id, isCurrentUser]);

    const handleRemove = useCallback(async (pageid: number) => {
        await removeTrollArticle(pageid);
        setTrollList([...cachedTroll]);
    }, []);

    const handleAdd = useCallback(() => {
        openWikiSearchModal(() => loadTroll().then(setTrollList));
    }, []);

    const handleReorder = useCallback((newList: TrollData) => {
        setTrollList(newList);
        reorderTroll(newList);
    }, []);
    const dragProps = useDragReorder(trollList, handleReorder);

    if (loading) {
        return (
            <div className="vc-superboard-board-content">
                <div className="vc-superboard-back-row">
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
                </div>
                <div className="vc-superboard-loading">
                    <div className="vc-superboard-spinner" />
                    <Text variant="text-md/medium">Loading wiki data...</Text>
                </div>
            </div>
        );
    }

    return (
        <div className="vc-superboard-board-content">
            <div className="vc-superboard-back-row">
                <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={onBack}>←</Button>
            </div>
            <div className="vc-superboard-board-header">
                <Text variant="text-xs/semibold" style={{ color: "var(--header-secondary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    📰 FavWiki ({trollList.length})
                </Text>
                {isCurrentUser && (
                    <Button size={Button.Sizes.MIN} color={Button.Colors.PRIMARY} onClick={handleAdd}>Add</Button>
                )}
            </div>
            {trollList.length > 0 ? (
                <div className="vc-superboard-board-grid">
                    {trollList.map((article, i) => (
                        isCurrentUser ? (
                            <div key={article.pageid} {...dragProps(i)} className="vc-superboard-drag-item">
                                <WikiCard article={article} onRemove={() => handleRemove(article.pageid)} compact />
                            </div>
                        ) : (
                            <WikiCard key={article.pageid} article={article} compact />
                        )
                    ))}
                </div>
            ) : (
                <div className={ProfileListClasses.empty} style={{ padding: "16px 0" }}>
                    <div className={ProfileListClasses.textContainer}>
                        <BaseText tag="h3" size="md" weight="medium" style={{ color: "var(--text-strong)" }}>
                            {isCurrentUser ? "No articles added yet. Use the Add button!" : "No wiki data."}
                        </BaseText>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== Settings Panel ====================

function MusicListSection({ list, onRefresh }: { list: MusicData[]; onRefresh: () => void; }) {
    const handleRemove = useCallback(async (id: number) => { await removeMusic(id); onRefresh(); }, [onRefresh]);
    return (
        <Forms.FormSection>
            <Forms.FormTitle tag="h3">🎵 Your Favorite Music</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: 12 }}>
                Search and add music from iTunes — shown on your profile's SuperBoard.
            </Forms.FormText>
            <Button onClick={() => openMusicSearchModal(onRefresh)} size={Button.Sizes.SMALL} color={Button.Colors.BRAND}>
                🎵 Add Music
            </Button>
            {list.length > 0 ? (
                <div className="vc-superboard-settings-grid">
                    {list.map(music => <MusicCard key={music.id} music={music} onRemove={() => handleRemove(music.id)} />)}
                </div>
            ) : (
                <div className="vc-superboard-settings-empty">
                    <div className="vc-superboard-empty-icon">🎵</div>
                    <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>No music added yet. Use the button above to get started!</Text>
                </div>
            )}
        </Forms.FormSection>
    );
}

function AnimeListSection({ title, mode, list, onRefresh }: { title: string; mode: ListMode; list: AnimeData[]; onRefresh: () => void; }) {
    const isHate = mode === "hate";
    const handleRemove = useCallback(async (malId: number) => {
        if (isHate) await removeHated(malId); else await removeFavorite(malId);
        onRefresh();
    }, [isHate, onRefresh]);
    return (
        <Forms.FormSection>
            <Forms.FormTitle tag="h3">{title}</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: 12 }}>
                {isHate ? "Anime you can't stand — shown on your profile." : "Search and add anime from MyAnimeList — shown on your profile."}
            </Forms.FormText>
            <Button onClick={() => openAnimeSearchModal(mode, onRefresh)} size={Button.Sizes.SMALL}
                color={isHate ? Button.Colors.RED : Button.Colors.BRAND}>
                {isHate ? "💔 Add Hated Anime" : "❤️ Add Favorite Anime"}
            </Button>
            {list.length > 0 ? (
                <div className="vc-superboard-settings-grid">
                    {list.map(anime => <AnimeCard key={anime.mal_id} anime={anime} onRemove={() => handleRemove(anime.mal_id)} hate={isHate} />)}
                </div>
            ) : (
                <div className="vc-superboard-settings-empty">
                    <div className="vc-superboard-empty-icon">{isHate ? "💔" : "🎬"}</div>
                    <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>
                        {isHate ? "No hated anime added yet." : "No favorites added yet. Use the button above to get started!"}
                    </Text>
                </div>
            )}
        </Forms.FormSection>
    );
}

function MangaListSection({ list, onRefresh }: { list: MangaData[]; onRefresh: () => void; }) {
    const handleRemove = useCallback(async (malId: number) => { await removeManga(malId); onRefresh(); }, [onRefresh]);
    return (
        <Forms.FormSection>
            <Forms.FormTitle tag="h3">📚 Your Favorite Manga</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: 12 }}>
                Search and add manga from MyAnimeList — shown on your profile's SuperBoard.
            </Forms.FormText>
            <Button onClick={() => openMangaSearchModal(onRefresh)} size={Button.Sizes.SMALL} color={Button.Colors.BRAND}>
                📚 Add Manga
            </Button>
            {list.length > 0 ? (
                <div className="vc-superboard-settings-grid">
                    {list.map(manga => <MangaCard key={manga.mal_id} manga={manga} onRemove={() => handleRemove(manga.mal_id)} />)}
                </div>
            ) : (
                <div className="vc-superboard-settings-empty">
                    <div className="vc-superboard-empty-icon">📚</div>
                    <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>No manga added yet. Use the button above to get started!</Text>
                </div>
            )}
        </Forms.FormSection>
    );
}

function SeriesListSection({ list, onRefresh }: { list: SeriesData[]; onRefresh: () => void; }) {
    const handleRemove = useCallback(async (id: number) => { await removeSeries(id); onRefresh(); }, [onRefresh]);
    return (
        <Forms.FormSection>
            <Forms.FormTitle tag="h3">📺 Your Favorite TV Series</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: 12 }}>
                Search and add TV series from TVMaze — shown on your profile's SuperBoard.
            </Forms.FormText>
            <Button onClick={() => openSeriesSearchModal(onRefresh)} size={Button.Sizes.SMALL} color={Button.Colors.BRAND}>
                📺 Add Series
            </Button>
            {list.length > 0 ? (
                <div className="vc-superboard-settings-grid">
                    {list.map(series => <SeriesCard key={series.id} series={series} onRemove={() => handleRemove(series.id)} />)}
                </div>
            ) : (
                <div className="vc-superboard-settings-empty">
                    <div className="vc-superboard-empty-icon">📺</div>
                    <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>No series added yet. Use the button above to get started!</Text>
                </div>
            )}
        </Forms.FormSection>
    );
}

function BookListSection({ list, onRefresh }: { list: BookData[]; onRefresh: () => void; }) {
    const handleRemove = useCallback(async (id: string) => { await removeBook(id); onRefresh(); }, [onRefresh]);
    return (
        <Forms.FormSection>
            <Forms.FormTitle tag="h3">📖 Your Favorite Books</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: 12 }}>
                Search and add books from Open Library — shown on your profile's SuperBoard.
            </Forms.FormText>
            <Button onClick={() => openBookSearchModal(onRefresh)} size={Button.Sizes.SMALL} color={Button.Colors.BRAND}>
                📖 Add Book
            </Button>
            {list.length > 0 ? (
                <div className="vc-superboard-settings-grid">
                    {list.map(book => <BookCard key={book.id} book={book} onRemove={() => handleRemove(book.id)} />)}
                </div>
            ) : (
                <div className="vc-superboard-settings-empty">
                    <div className="vc-superboard-empty-icon">📖</div>
                    <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>No books added yet. Use the button above to get started!</Text>
                </div>
            )}
        </Forms.FormSection>
    );
}

function TrollSettingsSection({ trollData, onRefresh }: { trollData: TrollData; onRefresh: () => void; }) {
    const handleRemove = useCallback(async (pageid: number) => { await removeTrollArticle(pageid); onRefresh(); }, [onRefresh]);
    return (
        <Forms.FormSection>
            <Forms.FormTitle tag="h3">📰 FavWiki</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: 12 }}>
                Search and add Wikipedia articles — shown on your profile's FavWiki board.
            </Forms.FormText>
            <Button onClick={() => openWikiSearchModal(onRefresh)} size={Button.Sizes.SMALL} color={Button.Colors.BRAND}>
                📰 Add Wikipedia Article
            </Button>
            {trollData.length > 0 ? (
                <div className="vc-superboard-settings-grid">
                    {trollData.map(article => <WikiCard key={article.pageid} article={article} onRemove={() => handleRemove(article.pageid)} />)}
                </div>
            ) : (
                <div className="vc-superboard-settings-empty">
                    <div className="vc-superboard-empty-icon">📰</div>
                    <Text variant="text-md/medium" style={{ color: "var(--text-muted)" }}>No articles added yet. Use the button above to get started!</Text>
                </div>
            )}
        </Forms.FormSection>
    );
}

function MALImportSection({ onImport }: { onImport: () => void; }) {
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleImport = useCallback(async () => {
        if (!username.trim()) return;
        setLoading(true);
        setMessage("");
        try {
            const animes = await fetchMALUserFavorites(username);
            if (animes.length === 0) {
                setMessage("No favorite anime found for this user.");
            } else {
                const existing = new Set(cachedFavorites.map(f => f.mal_id));
                const newAnimes = animes.filter(a => !existing.has(a.mal_id));
                if (newAnimes.length > 0) {
                    cachedFavorites = [...cachedFavorites, ...newAnimes];
                    await DataStoreSet(STORE_KEY_FAV, cachedFavorites);
                    scheduleAnimeSync();
                }
                setMessage(`${newAnimes.length} anime imported (${animes.length - newAnimes.length} already in list).`);
                onImport();
            }
        } catch {
            setMessage("Import failed. Please check the username.");
        }
        setLoading(false);
    }, [username, onImport]);

    return (
        <div className="vc-superboard-import-section">
            <Forms.FormTitle tag="h3">Import from MAL</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: 8 }}>
                Enter your MyAnimeList username to automatically import your favorite anime.
            </Forms.FormText>
            <div className="vc-superboard-import-row">
                <TextInput placeholder="MAL username" value={username} onChange={setUsername} style={{ flex: 1 }} />
                <Button onClick={handleImport} disabled={loading || !username.trim()} size={Button.Sizes.SMALL}>
                    {loading ? "Importing..." : "Import"}
                </Button>
            </div>
            {message && (
                <Text variant="text-sm/medium" style={{ marginTop: 8, color: "var(--text-muted)" }}>{message}</Text>
            )}
        </div>
    );
}

function CloudSyncStatus() {
    const [syncing, setSyncing] = useState(false);
    const [lastResult, setLastResult] = useState<string>("");

    const handleSync = useCallback(async () => {
        const hasData = cachedMusic.length > 0 || cachedFavorites.length > 0 || cachedHated.length > 0 || cachedManga.length > 0 || cachedSeries.length > 0 || cachedBooks.length > 0 || cachedTroll.length > 0;
        if (!hasData) {
            Toasts.show({ type: Toasts.Type.FAILURE, message: "No data to sync!", id: Toasts.genId() });
            return;
        }
        setSyncing(true);
        setLastResult("");
        const results = await Promise.all([syncMusicToServer(), syncAnimeToServer(), syncMangaToServer(), syncSeriesToServer(), syncBookToServer(), syncTrollToServer()]);
        setSyncing(false);
        const allOk = results.every(Boolean);
        if (allOk) {
            setLastResult("Synced successfully! Other SuperBoard users can now see your lists.");
            Toasts.show({ type: Toasts.Type.SUCCESS, message: "All lists synced!", id: Toasts.genId() });
        } else {
            setLastResult("Some syncs failed. Please try again later.");
            Toasts.show({ type: Toasts.Type.FAILURE, message: "Sync partially failed!", id: Toasts.genId() });
        }
    }, []);

    return (
        <div className="vc-superboard-import-section">
            <Forms.FormTitle tag="h3">Sync to Server</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: 8 }}>
                If you have problems with automatic sync, you can sync all your lists manually so other users can see them on your profile.
            </Forms.FormText>
            <Button onClick={handleSync} size={Button.Sizes.SMALL} color={Button.Colors.BRAND} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync Now"}
            </Button>
            {lastResult && (
                <Text variant="text-sm/medium" style={{ marginTop: 8, color: "var(--text-muted)" }}>{lastResult}</Text>
            )}
        </div>
    );
}

type SettingsTab = "music" | "anime" | "manga" | "series" | "book" | "troll" | "sync";

function SettingsPanel() {
    const [tab, setTab] = useState<SettingsTab>("music");
    const [musicList, setMusicList] = useState<MusicData[]>(cachedMusic);
    const [favorites, setFavorites] = useState<AnimeData[]>(cachedFavorites);
    const [hated, setHated] = useState<AnimeData[]>(cachedHated);
    const [mangaList, setMangaList] = useState<MangaData[]>(cachedManga);

    const [seriesList, setSeriesList] = useState<SeriesData[]>(cachedSeries);
    const [bookList, setBookList] = useState<BookData[]>(cachedBooks);
    const [trollData, setTrollData] = useState<TrollData>(cachedTroll);

    const refreshAll = useCallback(() => {
        Promise.all([loadMusic(), loadFavorites(), loadHated(), loadManga(), loadSeries(), loadBooks(), loadTroll()]).then(([m, f, h, mn, sr, bk, tr]) => {
            setMusicList([...m]);
            setFavorites([...f]);
            setHated([...h]);
            setMangaList([...mn]);
            setSeriesList([...sr]);
            setBookList([...bk]);
            setTrollData([...tr]);
        });
    }, []);

    useEffect(() => { refreshAll(); }, []);

    return (
        <div className="vc-superboard-settings">
            <div className="vc-superboard-settings-tabs">
                <button className={`vc-superboard-settings-tab${tab === "music" ? " vc-superboard-settings-tab-active" : ""}`}
                    onClick={() => setTab("music")}>🎵 Music</button>
                <button className={`vc-superboard-settings-tab${tab === "anime" ? " vc-superboard-settings-tab-active" : ""}`}
                    onClick={() => setTab("anime")}>🎬 Anime</button>
                <button className={`vc-superboard-settings-tab${tab === "manga" ? " vc-superboard-settings-tab-active" : ""}`}
                    onClick={() => setTab("manga")}>📚 Manga</button>

                <button className={`vc-superboard-settings-tab${tab === "series" ? " vc-superboard-settings-tab-active" : ""}`}
                    onClick={() => setTab("series")}>📺 Series</button>
                <button className={`vc-superboard-settings-tab${tab === "book" ? " vc-superboard-settings-tab-active" : ""}`}
                    onClick={() => setTab("book")}>📖 Book</button>
                {isTrollEnabled() && (
                    <button className={`vc-superboard-settings-tab${tab === "troll" ? " vc-superboard-settings-tab-active" : ""}`}
                        onClick={() => setTab("troll")}>📰 FavWiki</button>
                )}
                <button className={`vc-superboard-settings-tab${tab === "sync" ? " vc-superboard-settings-tab-active" : ""}`}
                    onClick={() => setTab("sync")}>☁️ Sync & Import</button>
            </div>
            {tab === "music" && <MusicListSection list={musicList} onRefresh={refreshAll} />}
            {tab === "anime" && (
                <>
                    <AnimeListSection title="❤️ Your Favorite Anime" mode="fav" list={favorites} onRefresh={refreshAll} />
                    <div style={{ marginTop: 20 }}>
                        <AnimeListSection title="💔 Anime You Hate" mode="hate" list={hated} onRefresh={refreshAll} />
                    </div>
                </>
            )}
            {tab === "manga" && <MangaListSection list={mangaList} onRefresh={refreshAll} />}

            {tab === "series" && <SeriesListSection list={seriesList} onRefresh={refreshAll} />}
            {tab === "book" && <BookListSection list={bookList} onRefresh={refreshAll} />}
            {tab === "troll" && <TrollSettingsSection trollData={trollData} onRefresh={refreshAll} />}
            {tab === "sync" && (
                <>
                    <MALImportSection onImport={refreshAll} />
                    <div style={{ marginTop: 16 }}>
                        <CloudSyncStatus />
                    </div>
                </>
            )}
        </div>
    );
}

// ==================== Plugin Definition ====================

const IS_PATCHED = Symbol("SuperBoard.Patched");
let originalBoardText = "Board";

function isTrollEnabled(): boolean {
    return Settings.plugins?.SuperBoard?.enableTrollBoard !== false;
}

export default definePlugin({
    name: "SuperBoard",
    description: "SuperBoard — A unified profile board with GameBoard, MusicBoard, AniBoard, MangaBoard, SeriesBoard, BookBoard, and troll content boards (FavWiki). Music powered by iTunes, anime & manga powered by MyAnimeList via Jikan API, TV series powered by TVMaze, books powered by Open Library, troll articles powered by Wikipedia.",
    authors: [{ name: "canplus", id: 852614422235971655n }],

    options: {
        enableTrollBoard: {
            type: OptionType.BOOLEAN,
            description: "Enable troll content boards (FavWiki, etc.) on SuperBoard",
            default: false,
        },
    },

    settingsAboutComponent: () => <SettingsPanel />,

    async start() {
        await Promise.all([loadMusic(), loadFavorites(), loadHated(), loadManga(), loadSeries(), loadBooks(), loadTroll()]);
    },

    stop() {
        stopAllAudio();
    },

    patches: [
        // User Profile Modal (v1)
        {
            find: ".BOT_DATA_ACCESS?(",
            replacement: [
                {
                    match: /\i\.useEffect.{0,100}(\i)\[0\]\.section/,
                    replace: "$self.pushSection($1,arguments[0].user);$&"
                },
                {
                    match: /\(0,\i\.jsx\)\(\i,\{items:\i,section:(\i)/,
                    replace: "$1==='SUPER_BOARD'?$self.renderSuperBoard(arguments[0]):$&"
                },
                {
                    match: /className:\i\.\i(?=,type:"top")/,
                    replace: '$& + " vc-superboard-modal-tab-bar"',
                    noWarn: true
                }
            ]
        },
        // User Profile Modal v2
        {
            find: ".WIDGETS?",
            replacement: [
                {
                    match: /items:(\i),.+?(?=return\(0,\i\.jsxs?\)\("div)/,
                    replace: "$&$self.pushSection($1,arguments[0].user);"
                },
                {
                    match: /\(0,\i\.jsxs?\)\(\i,\{.{0,200}?section:(\i)/,
                    replace: "$1==='SUPER_BOARD'?$self.renderSuperBoard(arguments[0]):$&"
                },
                {
                    match: /type:"top",/,
                    replace: '$&className:"vc-superboard-modal-v2-tab-bar",'
                },
            ]
        },
    ],

    pushSection(sections: any[], user: User) {
        try {
            if (sections[IS_PATCHED]) return;
            sections[IS_PATCHED] = true;
            const origText = sections[0].text;
            const origSection = sections[0].section;
            originalBoardText = origText;
            sections[0].text = "SuperBoard";
            sections[0].section = "SUPER_BOARD";
            sections.splice(1, 0, { text: origText, section: origSection });
        } catch (e) {
            logger.error("Failed to push SuperBoard section:", e);
        }
    },

    renderSuperBoard: ErrorBoundary.wrap(({ user, onClose }: { user: User; onClose: () => void; }) => {
        const containerRef = React.useRef<HTMLDivElement>(null);
        const boardTabRef = React.useRef<HTMLElement | null>(null);
        const currentUser = UserStore.getCurrentUser();
        const isCurrentUser = !!currentUser && !!user && user.id === currentUser.id;
        const [activeBoard, setActiveBoard] = useState<"selector" | "music" | "anime" | "manga" | "series" | "book" | "troll">("selector");
        const [availableBoards, setAvailableBoards] = useState<Set<string> | null>(isCurrentUser ? null : new Set());
        const [boardsLoading, setBoardsLoading] = useState(!isCurrentUser);

        useEffect(() => {
            if (isCurrentUser) return;
            let cancelled = false;
            setBoardsLoading(true);
            const boards = new Set<string>();
            Promise.all([
                fetchRemoteMusicList(user.id).then(d => { if (d) boards.add("music"); }),
                fetchRemoteAnimeList(user.id).then(d => { if (d) boards.add("anime"); }),
                fetchRemoteMangaList(user.id).then(d => { if (d) boards.add("manga"); }),
                fetchRemoteSeriesList(user.id).then(d => { if (d) boards.add("series"); }),
                fetchRemoteBookList(user.id).then(d => { if (d) boards.add("book"); }),
                fetchRemoteTrollData(user.id).then(d => { if (d) boards.add("troll"); }),
            ]).then(() => { if (!cancelled) { setAvailableBoards(boards); setBoardsLoading(false); } });
            return () => { cancelled = true; };
        }, [user.id, isCurrentUser]);

        useEffect(() => {
            const hide = () => {
                if (!containerRef.current || boardTabRef.current) return;
                let el: HTMLElement | null = containerRef.current;
                for (let i = 0; i < 25 && el; i++) {
                    el = el.parentElement;
                    if (!el) break;
                    const tabList = el.querySelector('[role="tablist"]');
                    if (tabList) {
                        for (let j = 0; j < tabList.children.length; j++) {
                            const child = tabList.children[j] as HTMLElement;
                            const txt = child.textContent?.trim() ?? "";
                            if (txt === originalBoardText || txt.startsWith(originalBoardText + " ") || txt.startsWith(originalBoardText + "(")) {
                                child.style.display = "none";
                                boardTabRef.current = child;
                                return;
                            }
                        }
                    }
                }
            };
            const f = requestAnimationFrame(hide);
            const t1 = setTimeout(hide, 50);
            const t2 = setTimeout(hide, 200);
            return () => { cancelAnimationFrame(f); clearTimeout(t1); clearTimeout(t2); };
        }, []);

        const handleGameBoard = useCallback(() => {
            if (boardTabRef.current) {
                boardTabRef.current.style.display = "";
                boardTabRef.current.click();
            }
        }, []);

        const goBack = useCallback(() => {
            stopAllAudio();
            setActiveBoard("selector");
        }, []);

        let content: React.ReactNode;
        switch (activeBoard) {
            case "music":
                content = <MusicBoardContent user={user} isCurrentUser={isCurrentUser} onBack={goBack} />;
                break;
            case "anime":
                content = <AnimeBoardContent user={user} isCurrentUser={isCurrentUser} onBack={goBack} />;
                break;
            case "manga":
                content = <MangaBoardContent user={user} isCurrentUser={isCurrentUser} onBack={goBack} />;
                break;
            case "series":
                content = <SeriesBoardContent user={user} isCurrentUser={isCurrentUser} onBack={goBack} />;
                break;
            case "book":
                content = <BookBoardContent user={user} isCurrentUser={isCurrentUser} onBack={goBack} />;
                break;
            case "troll":
                content = <TrollBoardContent user={user} isCurrentUser={isCurrentUser} onBack={goBack} />;
                break;
            case "selector":
            default:
                content = <BoardSelector onSelect={setActiveBoard} onGameBoard={handleGameBoard} isCurrentUser={isCurrentUser} availableBoards={availableBoards} boardsLoading={boardsLoading} />;
                break;
        }

        return (
            <ScrollerThin className={TabBarClasses.tabPanelScroller} fade={true} onClose={onClose}>
                <div ref={containerRef}>
                    {content}
                </div>
            </ScrollerThin>
        );
    }),
});

// ==================== Board Selector ====================

function BoardSelector({ onSelect, onGameBoard, isCurrentUser, availableBoards, boardsLoading }: { onSelect: (board: "music" | "anime" | "manga" | "series" | "book" | "troll") => void; onGameBoard: () => void; isCurrentUser: boolean; availableBoards: Set<string> | null; boardsLoading: boolean; }) {
    const show = (board: string) => isCurrentUser || !availableBoards || availableBoards.has(board);

    return (
        <div className="vc-superboard-selector">
            <Text variant="heading-lg/bold" style={{ textAlign: "center", marginBottom: 8 }}>
                SuperBoard
            </Text>
            <Text variant="text-sm/normal" style={{ textAlign: "center", marginBottom: 24, color: "var(--text-muted)" }}>
                Choose a board to view
            </Text>
            <div className="vc-superboard-selector-grid">
                <button className="vc-superboard-selector-card" onClick={onGameBoard}>
                    <span className="vc-superboard-selector-icon">🎮</span>
                    <Text variant="text-sm/bold">GameBoard</Text>
                    <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>Game Widgets</Text>
                </button>
                {show("music") && (
                    <button className="vc-superboard-selector-card" onClick={() => onSelect("music")}>
                        <span className="vc-superboard-selector-icon">🎵</span>
                        <Text variant="text-sm/bold">MusicBoard</Text>
                        <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>Favorite Musics</Text>
                    </button>
                )}
                {show("anime") && (
                    <button className="vc-superboard-selector-card" onClick={() => onSelect("anime")}>
                        <span className="vc-superboard-selector-icon">🎬</span>
                        <Text variant="text-sm/bold">AniBoard</Text>
                        <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>Anime List</Text>
                    </button>
                )}
                {show("manga") && (
                    <button className="vc-superboard-selector-card" onClick={() => onSelect("manga")}>
                        <span className="vc-superboard-selector-icon">📚</span>
                        <Text variant="text-sm/bold">MangaBoard</Text>
                        <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>Manga List</Text>
                    </button>
                )}
                {show("series") && (
                    <button className="vc-superboard-selector-card" onClick={() => onSelect("series")}>
                        <span className="vc-superboard-selector-icon">📺</span>
                        <Text variant="text-sm/bold">SeriesBoard</Text>
                        <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>TV Series</Text>
                    </button>
                )}
                {show("book") && (
                    <button className="vc-superboard-selector-card" onClick={() => onSelect("book")}>
                        <span className="vc-superboard-selector-icon">📖</span>
                        <Text variant="text-sm/bold">BookBoard</Text>
                        <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>Favorite Books</Text>
                    </button>
                )}
                {(isCurrentUser ? isTrollEnabled() : show("troll")) && (
                    <button className="vc-superboard-selector-card" onClick={() => onSelect("troll")}>
                        <span className="vc-superboard-selector-icon">📰</span>
                        <Text variant="text-sm/bold">FavWiki</Text>
                        <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>Wikipedia Articles</Text>
                    </button>
                )}
            </div>
            {boardsLoading && (
                <div className="vc-superboard-loading" style={{ marginTop: 16 }}>
                    <div className="vc-superboard-spinner" />
                    <Text variant="text-md/medium">Loading boards...</Text>
                </div>
            )}
        </div>
    );
}

// im just saying token for id, not discord token
