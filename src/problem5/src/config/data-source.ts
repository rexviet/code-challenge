import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './env';
import { UserEntity } from '../entities/user.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.db.host,
  port: env.db.port,
  username: env.db.user,
  password: env.db.password,
  database: env.db.name,
  entities: [UserEntity],
  migrations: [
    env.nodeEnv === 'production'
      ? 'dist/migrations/*.js'
      : 'src/migrations/*.ts'
  ],
  synchronize: false,
  logging: env.nodeEnv === 'development',
});
