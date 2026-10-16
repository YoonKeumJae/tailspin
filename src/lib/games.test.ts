import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getGames,
    getAllCategories,
    getAllPublishers,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    describe('filtering', () => {
        let strategyId: number;
        let puzzleId: number;
        let pubAId: number;
        let pubBId: number;

        beforeEach(async () => {
            [{ id: strategyId }, { id: puzzleId }] = await db
                .insert(categories)
                .values([{ name: 'Strategy' }, { name: 'Puzzle' }])
                .returning({ id: categories.id });
            [{ id: pubAId }, { id: pubBId }] = await db
                .insert(publishers)
                .values([{ name: 'Pub A' }, { name: 'Pub B' }])
                .returning({ id: publishers.id });
            await db.insert(games).values([
                { title: 'Alpha', description: 'a', categoryId: strategyId, publisherId: pubAId },
                { title: 'Beta', description: 'b', categoryId: puzzleId, publisherId: pubAId },
                { title: 'Gamma', description: 'g', categoryId: strategyId, publisherId: pubBId },
            ]);
        });

        const titles = async (filters: Parameters<typeof getGames>[1]): Promise<string[]> =>
            (await getGames(db, filters)).map((g) => g.title);

        it('returns everything without filters', async () => {
            expect(await titles({})).toEqual(['Alpha', 'Beta', 'Gamma']);
            expect(await titles({ categoryIds: [], publisherIds: [] })).toEqual(['Alpha', 'Beta', 'Gamma']);
        });

        it('filters by one or more categories', async () => {
            expect(await titles({ categoryIds: [puzzleId] })).toEqual(['Beta']);
            expect(await titles({ categoryIds: [strategyId, puzzleId] })).toEqual(['Alpha', 'Beta', 'Gamma']);
        });

        it('filters by publisher', async () => {
            expect(await titles({ publisherIds: [pubBId] })).toEqual(['Gamma']);
        });

        it('combines category and publisher filters', async () => {
            expect(await titles({ categoryIds: [strategyId], publisherIds: [pubAId] })).toEqual(['Alpha']);
            expect(await titles({ categoryIds: [puzzleId], publisherIds: [pubBId] })).toEqual([]);
        });

        it('lists categories and publishers by name', async () => {
            expect((await getAllCategories(db)).map((c) => c.name)).toEqual(['Puzzle', 'Strategy']);
            expect((await getAllPublishers(db)).map((p) => p.name)).toEqual(['Pub A', 'Pub B']);
        });
    });
});
