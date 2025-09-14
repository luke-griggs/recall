import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../drizzle/schema';

const db = drizzle(process.env.DATABASE_URL!, { schema });

export { db };
export * from '../../drizzle/schema';