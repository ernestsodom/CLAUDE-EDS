import { neon } from '@neondatabase/serverless';

let client;
export function sql(strings, ...values) {
  client ??= neon(process.env.DATABASE_URL);
  return client(strings, ...values);
}
