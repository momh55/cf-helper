import { openDB, type DBSchema } from 'idb';

interface CFHelperDB extends DBSchema {
    submissions: {
        key: number;
        value: {
            id: number;
            contestId: number;
            index: string;
            name: string;
            rating?: number;
            tags: string[];
            programmingLanguage: string;
            verdict: string;
            testset: string;
            passedTestCount: number;
            timeConsumedMillis: number;
            memoryConsumedBytes: number;
            creationTimeSeconds: number;
            code?: string;
        };
        indexes: { 'by-creation': number };
    };
}

const DB_NAME = 'cf-helper-db';
const DB_VERSION = 1;

export const initDB = async () => {
    return openDB<CFHelperDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('submissions')) {
                const store = db.createObjectStore('submissions', { keyPath: 'id' });
                store.createIndex('by-creation', 'creationTimeSeconds');
            }
        },
    });
};

export const saveSubmissions = async (submissions: any[]) => {
    const db = await initDB();
    const tx = db.transaction('submissions', 'readwrite');
    const store = tx.objectStore('submissions');
    for (const sub of submissions) {
        if (sub.id && sub.problem) {
            // 保留原有的 code 字段（如果未来抓取了代码）
            const existing = await store.get(sub.id);

            await store.put({
                id: sub.id,
                contestId: sub.problem.contestId,
                index: sub.problem.index,
                name: sub.problem.name,
                rating: sub.problem.rating,
                tags: sub.problem.tags || [],
                programmingLanguage: sub.programmingLanguage,
                verdict: sub.verdict,
                testset: sub.testset,
                passedTestCount: sub.passedTestCount,
                timeConsumedMillis: sub.timeConsumedMillis,
                memoryConsumedBytes: sub.memoryConsumedBytes,
                creationTimeSeconds: sub.creationTimeSeconds,
                code: existing?.code // 继承已有代码
            });
        }
    }
    await tx.done;
};

export const getAllSubmissions = async () => {
    const db = await initDB();
    return db.getAllFromIndex('submissions', 'by-creation'); // 按时间排序
};

export const getSubmissionCount = async () => {
    const db = await initDB();
    return db.count('submissions');
}

export const clearDB = async () => {
    const db = await initDB();
    await db.clear('submissions');
}

export const getRecentSubmissions = async (limit: number = 50) => {
    const db = await initDB();
    let cursor = await db.transaction('submissions').store.index('by-creation').openCursor(null, 'prev');
    const results = [];
    while (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor = await cursor.continue();
    }
    return results;
}

// === 新增：高级筛选查询 ===
export const querySubmissions = async (filters: { onlyAC: boolean }) => {
    const db = await initDB();
    const all = await db.getAllFromIndex('submissions', 'by-creation');

    // 如果没有筛选条件，直接返回全部
    if (!filters.onlyAC) return all;

    // 内存过滤 (本地数据库速度很快，过滤几万条没问题)
    return all.filter(sub => {
        if (filters.onlyAC && sub.verdict !== 'OK') return false;
        return true;
    });
}