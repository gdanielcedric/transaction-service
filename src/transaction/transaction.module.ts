import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { CacheService } from '../utils/cache.service';

@Module({
  controllers: [TransactionController],
  providers: [TransactionService, CacheService],
})
export class TransactionModule {}