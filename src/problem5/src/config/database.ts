import { AppDataSource } from './data-source';

export { AppDataSource };

export async function connectDatabase(): Promise<void> {
  await AppDataSource.initialize();
}
