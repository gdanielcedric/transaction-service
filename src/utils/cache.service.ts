import { Injectable } from '@nestjs/common';
import { Transaction } from '../transaction/entities/transaction.entity';

@Injectable()
export class CacheService {
  private cache = new Map<string, Transaction>();

  get(id: string): Transaction | undefined {
    return this.cache.get(id);
  }

  set(transaction: Transaction): void {
    this.cache.set(transaction.id, transaction);
  }
}