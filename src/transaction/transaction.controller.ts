import { Controller, Post, Body, Param } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { WebhookDto } from './dto/webhook.dto';
import { Transaction } from './entities/transaction.entity';

@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  async create(@Body() createTransactionDto: CreateTransactionDto): Promise<Transaction> {
    return this.transactionService.createTransaction(createTransactionDto.id);
  }

  @Post('webhook')
  async webhook(
    @Body() webhookDto: WebhookDto
  ): Promise<void> {
    const { id, status } = webhookDto;
    this.transactionService.updateTransactionStatus(id, status);
  }
}