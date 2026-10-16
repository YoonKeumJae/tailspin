import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** Optional filters; an empty or omitted list means "no filtering" for that field. */
export interface GameFilters {
    /** Category ids to match; a game matches if its category is any of them. */
    categoryIds?: number[];
    /** Publisher ids to match; a game matches if its publisher is any of them. */
    publisherIds?: number[];
}

/**
 * Games ordered by title. Ids within a filter are OR-ed; the category and
 * publisher filters are combined with AND.
 *
 * @param db - Database connection to query.
 * @param filters - Optional category/publisher filters.
 * @returns Matching games ordered by title.
 */
export async function getGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const { categoryIds = [], publisherIds = [] } = filters;
    const conditions = [
        categoryIds.length > 0 ? inArray(games.categoryId, categoryIds) : undefined,
        publisherIds.length > 0 ? inArray(games.publisherId, publisherIds) : undefined,
    ];
    const rows = await baseGamesQuery(db)
        .where(and(...conditions))
        .orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * All games ordered by title.
 *
 * @param db - Database connection to query.
 * @returns Every game, ordered by title.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    return getGames(db);
}

/**
 * All categories ordered by name.
 *
 * @param db - Database connection to query.
 * @returns Every category, ordered by name.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    return db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
}

/**
 * All publishers ordered by name.
 *
 * @param db - Database connection to query.
 * @returns Every publisher, ordered by name.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
