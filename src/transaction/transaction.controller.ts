import { Controller, Post, Body, Param } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  async create(@Body() createTransactionDto: CreateTransactionDto): Promise<string> {
    return this.transactionService.createTransaction(createTransactionDto.id);
  }

  @Post('webhook/:id')
  async webhook(
    @Param('id') id: string,
    @Body('status') status: string,
  ): Promise<void> {
    this.transactionService.updateTransactionStatus(id, status);
  }
}