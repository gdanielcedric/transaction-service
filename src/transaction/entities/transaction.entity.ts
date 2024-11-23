export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',
}

export class Transaction {
  id: string;
  status: TransactionStatus;
  createdAt: Date;

  constructor(id: string) {
    this.id = id;
    this.status = TransactionStatus.PENDING;
    this.createdAt = new Date();
  }
}